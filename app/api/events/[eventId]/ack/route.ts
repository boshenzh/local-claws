import { authorizeRequest } from "@/lib/auth";
import { markDeliveryState } from "@/lib/fanout";
import { updateCursor } from "@/lib/events";
import { jsonError, jsonOk } from "@/lib/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const body = await request.json().catch(() => null);
  const auth = authorizeRequest(request, "delivery:ack", {
    legacyAgentId: typeof body?.agent_id === "string" ? body.agent_id : undefined
  });
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const { eventId } = await params;
  const status = body?.status;

  const mappedState =
    status === "actioned"
      ? "actioned"
      : status === "received" || status === "notified_human"
        ? "acknowledged"
        : null;

  if (!mappedState) {
    return jsonError("status must be one of received|notified_human|actioned", 400);
  }

  const delivery = markDeliveryState(auth.agent.id, eventId, mappedState);
  if (!delivery) {
    return jsonError("Delivery not found", 404);
  }

  updateCursor(auth.agent.id, eventId);
  return jsonOk({ ok: true, delivery });
}
