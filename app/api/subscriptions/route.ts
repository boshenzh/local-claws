import { authorizeRequest } from "@/lib/auth";
import { db } from "@/lib/store";
import { jsonCreated, jsonError, jsonOk } from "@/lib/http";
import type { AgentSubscription, QuietHours } from "@/lib/types";

let subCounter = 500;
function nextSubId(): string {
  subCounter += 1;
  return `sub_${subCounter}`;
}

function isQuietHours(input: unknown): input is QuietHours {
  if (!input || typeof input !== "object") return false;
  const value = input as Record<string, unknown>;
  return typeof value.start === "string" && typeof value.end === "string" && typeof value.tz === "string";
}

export async function GET(request: Request) {
  const auth = authorizeRequest(request, "invite:receive");
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const rows = db.agentSubscriptions.filter((row) => row.agentId === auth.agent.id);
  return jsonOk({ subscriptions: rows });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const auth = authorizeRequest(request, "subscription:write", {
    legacyAgentId: typeof body?.agent_id === "string" ? body.agent_id : undefined
  });

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const city = typeof body?.city === "string" ? body.city.trim().toLowerCase() : "";
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
    id: nextSubId(),
    agentId: auth.agent.id,
    city,
    radiusKm,
    tags,
    quietHours,
    status: "active",
    createdAt: now,
    updatedAt: now
  };

  db.agentSubscriptions.push(subscription);
  return jsonCreated(subscription);
}
