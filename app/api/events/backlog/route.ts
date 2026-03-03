import { authorizeRequest } from "@/lib/auth";
import { eventsSinceCursorForAgent } from "@/lib/events";
import { jsonError, jsonOk, parseIntQuery } from "@/lib/http";
import { metricIncrement } from "@/lib/metrics";
import { serializeNotificationForAgent } from "@/lib/notifications";
import { ensureStoreReady } from "@/lib/store";

export async function GET(request: Request) {
  await ensureStoreReady();
  // Backlog is used by both attendees (to receive invites) and hosts (to observe signup/join-request events).
  // Historically host tokens only had `meetup:create`, so we accept either scope here.
  let auth = authorizeRequest(request, "invite:receive");
  if (!auth.ok) {
    auth = authorizeRequest(request, "meetup:create");
  }
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseIntQuery(searchParams.get("limit"), 100), 100);

  const events = eventsSinceCursorForAgent(auth.agent.id, cursor, limit);
  const payload = events.map((event) => serializeNotificationForAgent(event, auth.agent.id));
  metricIncrement("backlog_fetch_total", 1);
  return jsonOk({
    agent_id: auth.agent.id,
    cursor,
    count: payload.length,
    events: payload
  });
}
