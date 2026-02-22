import { authorizeRequest } from "@/lib/auth";
import { eventsSinceCursorForAgent } from "@/lib/events";
import { jsonError, jsonOk, parseIntQuery } from "@/lib/http";
import { metricIncrement } from "@/lib/metrics";
import { serializeNotificationForAgent } from "@/lib/notifications";
import { ensureStoreReady } from "@/lib/store";

export async function GET(request: Request) {
  await ensureStoreReady();
  const auth = authorizeRequest(request, "invite:receive");
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
