import { authorizeRequest } from "@/lib/auth";
import { db, ensureStoreReady, persistStore } from "@/lib/store";
import { jsonError, jsonOk } from "@/lib/http";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureStoreReady();
  const body = await request.json().catch(() => null);
  const auth = authorizeRequest(request, "subscription:write", {
    legacyAgentId: typeof body?.agent_id === "string" ? body.agent_id : undefined
  });

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const { id } = await params;
  const subscription = db.agentSubscriptions.find((row) => row.id === id && row.agentId === auth.agent.id);
  if (!subscription) {
    return jsonError("Subscription not found", 404);
  }

  if (typeof body?.city === "string") {
    const city = body.city.trim().toLowerCase();
    if (!city) {
      return jsonError("city must be a non-empty string", 400);
    }
    subscription.city = city;
  }
  if (body?.status === "active" || body?.status === "paused") {
    subscription.status = body.status;
  }

  subscription.updatedAt = new Date().toISOString();
  await persistStore();
  return jsonOk(subscription);
}
