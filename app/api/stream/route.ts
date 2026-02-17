import { authorizeRequest } from "@/lib/auth";
import { eventsSinceCursorForAgent, subscribeAgent } from "@/lib/events";
import { jsonError } from "@/lib/http";
import { createInviteId } from "@/lib/invitations";
import { metricGaugeDelta, metricIncrement } from "@/lib/metrics";
import type { NotificationEvent } from "@/lib/types";

function encodeSseChunk(eventName: string, payload: unknown): Uint8Array {
  const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  return new TextEncoder().encode(data);
}

function pushEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: NotificationEvent, agentId: string): void {
  const inviteId = createInviteId(event.payload.meetupId, agentId);
  controller.enqueue(
    encodeSseChunk("notification", {
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
        invite_url: `/invite/${inviteId}`
      }
    })
  );
}

export async function GET(request: Request) {
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
