import { authorizeRequest } from "@/lib/auth";
import { db, ensureStoreReady, nextGlobalId, persistStore } from "@/lib/store";
import { jsonCreated, jsonError, jsonOk } from "@/lib/http";
import type { AgentSubscription } from "@/lib/types";

export async function GET(request: Request) {
  await ensureStoreReady();
  const auth = authorizeRequest(request, "invite:receive");
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const rows = db.agentSubscriptions.filter((row) => row.agentId === auth.agent.id);
  return jsonOk({ subscriptions: rows });
}

export async function POST(request: Request) {
  await ensureStoreReady();
  const body = await request.json().catch(() => null);
  const auth = authorizeRequest(request, "subscription:write", {
    legacyAgentId: typeof body?.agent_id === "string" ? body.agent_id : undefined
  });

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const city = typeof body?.city === "string" ? body.city.trim().toLowerCase() : "";

  if (!city) {
    return jsonError("city is required", 400);
  }

  const now = new Date().toISOString();
  const existing = db.agentSubscriptions.find((row) => row.agentId === auth.agent.id && row.city === city);
  if (existing) {
    existing.status = "active";
    existing.updatedAt = now;
    await persistStore();
    return jsonOk(existing);
  }

  const subscription: AgentSubscription = {
    id: nextGlobalId("sub"),
    agentId: auth.agent.id,
    city,
    status: "active",
    createdAt: now,
    updatedAt: now
  };

  db.agentSubscriptions.push(subscription);
  await persistStore();
  return jsonCreated(subscription);
}
