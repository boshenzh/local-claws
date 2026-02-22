import { authorizeRequest } from "@/lib/auth";
import { eventsSinceCursorForAgent, subscribeAgent } from "@/lib/events";
import { jsonError } from "@/lib/http";
import { metricGaugeDelta, metricIncrement } from "@/lib/metrics";
import { serializeNotificationForAgent } from "@/lib/notifications";
import { ensureStoreReady } from "@/lib/store";
import type { NotificationEvent } from "@/lib/types";

function encodeSseChunk(eventName: string, payload: unknown): Uint8Array {
  const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  return new TextEncoder().encode(data);
}

function pushEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: NotificationEvent, agentId: string): void {
  controller.enqueue(encodeSseChunk("notification", serializeNotificationForAgent(event, agentId)));
}

export async function GET(request: Request) {
  await ensureStoreReady();
  const auth = authorizeRequest(request, "invite:receive");
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  if (cursor) {
    metricIncrement("stream_reconnect_total", 1);
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encodeSseChunk("ready", { agent_id: auth.agent.id }));
      metricGaugeDelta("stream_connected_agents_gauge", 1);

      const backlog = eventsSinceCursorForAgent(auth.agent.id, cursor, 100);
      for (const event of backlog) {
        pushEvent(controller, event, auth.agent.id);
      }

      const unsubscribe = subscribeAgent(auth.agent.id, (event) => {
        pushEvent(controller, event, auth.agent.id);
      });

      const intervalId = setInterval(() => {
        controller.enqueue(encodeSseChunk("heartbeat", { ts: new Date().toISOString() }));
      }, 20000);

      request.signal.addEventListener("abort", () => {
        clearInterval(intervalId);
        unsubscribe();
        metricGaugeDelta("stream_connected_agents_gauge", -1);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
