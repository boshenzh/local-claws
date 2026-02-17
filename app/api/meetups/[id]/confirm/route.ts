import { authorizeRequest } from "@/lib/auth";
import { confirmAttendanceForAgent } from "@/lib/attendance";
import { jsonError, jsonOk } from "@/lib/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    return jsonError(result.error, 404);
  }

  return jsonOk({
    status: "confirmed",
    meetup_id: id,
    attendee_id: result.attendee.id,
    invitation_url: result.invitationUrl,
    invite_url: result.inviteUrl,
    passcode: result.passcode
  });
}
