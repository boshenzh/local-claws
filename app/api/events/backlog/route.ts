import { authorizeRequest } from "@/lib/auth";
import { eventsSinceCursorForAgent } from "@/lib/events";
import { jsonError, jsonOk, parseIntQuery } from "@/lib/http";
import { createInviteId } from "@/lib/invitations";
import { metricIncrement } from "@/lib/metrics";

export async function GET(request: Request) {
  const auth = authorizeRequest(request, "invite:receive");
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseIntQuery(searchParams.get("limit"), 100), 100);

  const events = eventsSinceCursorForAgent(auth.agent.id, cursor, limit);
  const payload = events.map((event) => ({
    event_id: event.id,
    event_type: event.eventType,
    created_at: event.createdAt,
    invite: {
      meetup_id: event.payload.meetupId,
      city: event.payload.city,
      district: event.payload.district,
      start_at: event.payload.startAt,
      tags: event.payload.tags,
      public_url: event.payload.publicUrl,
      invite_url: `/invite/${createInviteId(event.payload.meetupId, auth.agent.id)}`
    }
  }));
  metricIncrement("backlog_fetch_total", 1);
  return jsonOk({
    agent_id: auth.agent.id,
    cursor,
    count: payload.length,
    events: payload
  });
}
