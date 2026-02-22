import { authorizeRequest } from "@/lib/auth";
import { db, ensureStoreReady, nextGlobalId, persistStore } from "@/lib/store";
import { jsonCreated, jsonError, jsonOk } from "@/lib/http";
import type { AgentSubscription, QuietHours } from "@/lib/types";

function isQuietHours(input: unknown): input is QuietHours {
  if (!input || typeof input !== "object") return false;
  const value = input as Record<string, unknown>;
  return typeof value.start === "string" && typeof value.end === "string" && typeof value.tz === "string";
}

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
  const homeDistrictRaw = typeof body?.home_district === "string" ? body.home_district.trim() : "";
  const homeDistrict = homeDistrictRaw ? homeDistrictRaw : null;
  const radiusKm = typeof body?.radius_km === "number" ? body.radius_km : 20;
  const tags = Array.isArray(body?.tags) ? body.tags.filter((tag: unknown): tag is string => typeof tag === "string") : [];
  const quietHours = isQuietHours(body?.quiet_hours) ? body.quiet_hours : null;

  if (!city) {
    return jsonError("city is required", 400);
  }
  if (radiusKm <= 0 || radiusKm > 200) {
    return jsonError("radius_km must be between 1 and 200", 400);
  }

  const now = new Date().toISOString();
  const subscription: AgentSubscription = {
    id: nextGlobalId("sub"),
    agentId: auth.agent.id,
    city,
    homeDistrict,
    radiusKm,
    tags,
    quietHours,
    status: "active",
    createdAt: now,
    updatedAt: now
  };

  db.agentSubscriptions.push(subscription);
  await persistStore();
  return jsonCreated(subscription);
}
