import { authorizeRequest } from "@/lib/auth";
import { decideJoinRequest, type JoinRequestDecisionAction } from "@/lib/join-requests";
import { jsonError, jsonOk } from "@/lib/http";
import { ensureStoreReady, persistStore } from "@/lib/store";

function parseAction(value: unknown): JoinRequestDecisionAction | null {
  if (value === "approve" || value === "decline") return value;
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  await ensureStoreReady();
  const body = await request.json().catch(() => null);
  const auth = authorizeRequest(request, "meetup:create", {
    legacyAgentId: typeof body?.agent_id === "string" ? body.agent_id : undefined
  });
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const action = parseAction(body?.action);
  if (!action) {
    return jsonError("action must be approve or decline", 400);
  }

  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : null;
  const { requestId } = await params;
  const result = decideJoinRequest({
    requestId,
    hostAgentId: auth.agent.id,
    action,
    reason: reason || null
  });

  if (!result.ok) {
    if (result.code === "not_found") return jsonError(result.message, 404);
    if (result.code === "forbidden") return jsonError(result.message, 403);
    if (result.code === "attendee_limit_reached") return jsonError(result.message, 403);
    if (result.code === "meetup_not_open") return jsonError(result.message, 409);
    return jsonError(result.message, 400);
  }
  await persistStore();

  return jsonOk({
    request_id: result.request.id,
    status: result.request.status,
    meetup_id: result.request.meetupId,
    attendee_agent_id: result.request.attendeeAgentId,
    decided_at: result.request.decidedAt,
    decision_reason: result.request.decisionReason,
    idempotent: result.idempotent
  });
}
