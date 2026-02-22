import { authorizeRequest } from "@/lib/auth";
import { sendInvitesToAgents } from "@/lib/fanout";
import { jsonError, jsonOk } from "@/lib/http";
import { db, ensureStoreReady, persistStore } from "@/lib/store";

function asBooleanFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["1", "true", "yes"].includes(value.toLowerCase());
  }
  if (typeof value === "number") return value === 1;
  return false;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureStoreReady();
  const body = await request.json().catch(() => null);
  const auth = authorizeRequest(request, "meetup:create", {
    legacyAgentId: typeof body?.agent_id === "string" ? body.agent_id : undefined
  });
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const candidateIds = Array.isArray(body?.candidate_ids)
    ? body.candidate_ids
        .filter((value: unknown): value is string => typeof value === "string")
        .map((value: string) => value.trim())
        .filter(Boolean)
    : Array.isArray(body?.agent_ids)
    ? body.agent_ids
        .filter((value: unknown): value is string => typeof value === "string")
        .map((value: string) => value.trim())
        .filter(Boolean)
    : [];
  if (candidateIds.length === 0) {
    return jsonError("candidate_ids (or legacy agent_ids) must include at least one id", 400);
  }
  const allowUnsubscribed = asBooleanFlag(body?.allow_unsubscribed);
  const allowMoltbook = asBooleanFlag(body?.allow_moltbook);

  const { id } = await params;
  const meetup = db.meetups.find((entry) => entry.id === id);
  if (!meetup) {
    return jsonError("Meetup not found", 404);
  }
  if (meetup.hostAgentId !== auth.agent.id) {
    return jsonError("Only the host agent can send invites for this meetup", 403);
  }
  if (meetup.status !== "open") {
    return jsonError(`Invites can only be sent when meetup status is open (current: ${meetup.status})`, 409);
  }

  const result = sendInvitesToAgents(meetup, candidateIds, { allowUnsubscribed, allowMoltbook });
  await persistStore();

  return jsonOk({
    meetup_id: meetup.id,
    allow_unsubscribed: allowUnsubscribed,
    allow_moltbook: allowMoltbook,
    status: result.throttled
      ? "queued_for_moderation"
      : result.deliveries.length > 0 || result.externalInviteTasks.length > 0
      ? "sent"
      : "no_new_invites",
    invite_event_id: result.event?.id ?? null,
    invited_count: result.deliveries.length,
    invited_agent_ids: result.deliveries.map((delivery) => delivery.agentId),
    external_invite_count: result.externalInviteTasks.length,
    external_invite_tasks: result.externalInviteTasks,
    skipped_not_candidate: result.notEligibleAgentIds,
    skipped_already_invited: result.alreadyInvitedAgentIds
  });
}
