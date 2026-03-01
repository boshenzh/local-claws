import { authorizeRequest } from "@/lib/auth";
import { confirmAttendanceForAgent } from "@/lib/attendance";
import { jsonError, jsonOk } from "@/lib/http";
import { ensureStoreReady, persistStore } from "@/lib/store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureStoreReady();
  const body = await request.json().catch(() => null);
  const auth = authorizeRequest(request, "meetup:confirm", {
    legacyAgentId: typeof body?.agent_id === "string" ? body.agent_id : undefined
  });
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const { id } = await params;
  const result = confirmAttendanceForAgent(id, auth.agent.id);
  if (!result.ok) {
    const normalized = result.error.toLowerCase();
    const status = normalized.includes("not found")
      ? 404
      : normalized.includes("not eligible") || normalized.includes("unverified attendance limit")
        ? 403
        : 409;
    return jsonError(result.error, status);
  }
  await persistStore();

  return jsonOk({
    status: "confirmed",
    meetup_id: id,
    attendee_id: result.attendee.id,
    invitation_url: result.invitationUrl,
    invite_url: result.inviteUrl,
    passcode: result.passcode
  });
}
