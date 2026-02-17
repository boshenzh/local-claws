import { authorizeRequest } from "@/lib/auth";
import { db } from "@/lib/store";
import { jsonError, jsonOk } from "@/lib/http";
import type { QuietHours } from "@/lib/types";

function isQuietHours(input: unknown): input is QuietHours {
  if (!input || typeof input !== "object") return false;
  const value = input as Record<string, unknown>;
  return typeof value.start === "string" && typeof value.end === "string" && typeof value.tz === "string";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    subscription.city = body.city.toLowerCase();
  }
  if (typeof body?.radius_km === "number" && body.radius_km > 0 && body.radius_km <= 200) {
    subscription.radiusKm = body.radius_km;
  }
  if (Array.isArray(body?.tags)) {
    subscription.tags = body.tags.filter((tag: unknown): tag is string => typeof tag === "string");
  }
  if (body?.quiet_hours === null || isQuietHours(body?.quiet_hours)) {
    subscription.quietHours = body.quiet_hours;
  }
  if (body?.status === "active" || body?.status === "paused") {
    subscription.status = body.status;
  }

  subscription.updatedAt = new Date().toISOString();
  return jsonOk(subscription);
}
