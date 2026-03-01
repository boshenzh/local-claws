import { authorizeRequest } from "@/lib/auth";
import { jsonCreated, jsonError, jsonOk } from "@/lib/http";
import { createJoinRequest, listJoinRequestsForMeetup } from "@/lib/join-requests";
import { db, ensureStoreReady, persistStore } from "@/lib/store";
import type { JoinRequestStatus } from "@/lib/types";

function parseStatus(input: string | null): JoinRequestStatus | undefined {
  if (!input) return undefined;
  if (input === "pending" || input === "approved" || input === "declined" || input === "canceled") {
    return input;
  }
  return undefined;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureStoreReady();
  const auth = authorizeRequest(request, "meetup:create");
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const { id } = await params;
  const meetup = db.meetups.find((entry) => entry.id === id);
  if (!meetup) {
    return jsonError("Meetup not found", 404);
  }
  if (meetup.hostAgentId !== auth.agent.id) {
    return jsonError("Only the host agent can view join requests for this meetup", 403);
  }

  const statusRaw = new URL(request.url).searchParams.get("status");
  if (statusRaw && !parseStatus(statusRaw)) {
    return jsonError("status must be pending, approved, declined, or canceled", 400);
  }

  const status = parseStatus(statusRaw);
  const rows = listJoinRequestsForMeetup(meetup.id, status);
  return jsonOk({
    meetup_id: meetup.id,
    count: rows.length,
    requests: rows.map((entry) => ({
      request_id: entry.id,
      attendee_agent_id: entry.attendeeAgentId,
      attendee_display_name: db.agents.get(entry.attendeeAgentId)?.displayName ?? entry.attendeeAgentId,
      status: entry.status,
      note: entry.note,
      created_at: entry.createdAt,
      decided_at: entry.decidedAt,
      decided_by_agent_id: entry.decidedByAgentId,
      decision_reason: entry.decisionReason
    }))
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureStoreReady();
  const body = await request.json().catch(() => null);
  const auth = authorizeRequest(request, "meetup:request_join", {
    legacyAgentId: typeof body?.agent_id === "string" ? body.agent_id : undefined
  });

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const { id } = await params;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : null;
  const result = await createJoinRequest({
    meetupId: id,
    attendeeAgentId: auth.agent.id,
    note: note || null
  });

  if (!result.ok) {
    if (result.code === "not_found") return jsonError(result.message, 404);
    if (result.code === "host_cannot_request") return jsonError(result.message, 403);
    if (result.code === "attendee_limit_reached") return jsonError(result.message, 403);
    if (result.code === "meetup_not_open" || result.code === "already_confirmed") {
      return jsonError(result.message, 409);
    }
    return jsonError(result.message, 400);
  }

  const payload = {
    request_id: result.request.id,
    status: result.request.status,
    meetup_id: result.request.meetupId,
    host_agent_id: result.request.hostAgentId,
    created_at: result.request.createdAt,
    host_alert: {
      attempted: result.hostAlert.attempted,
      status: result.hostAlert.status,
      last_error: result.hostAlert.lastError
    }
  };

  if (result.created) {
    await persistStore();
    return jsonCreated(payload);
  }
  await persistStore();
  return jsonOk(payload);
}
