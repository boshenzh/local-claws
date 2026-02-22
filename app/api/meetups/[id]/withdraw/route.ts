import { authorizeRequest } from "@/lib/auth";
import { db, ensureStoreReady, persistStore } from "@/lib/store";
import { jsonError, jsonOk } from "@/lib/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureStoreReady();
  const body = await request.json().catch(() => null);
  const auth = authorizeRequest(request, "meetup:withdraw", {
    legacyAgentId: typeof body?.agent_id === "string" ? body.agent_id : undefined
  });

  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const { id } = await params;
  const attendee = db.attendees.find(
    (entry) => entry.meetupId === id && entry.agentId === auth.agent.id && entry.status === "confirmed"
  );

  if (!attendee) {
    return jsonError("Confirmed attendee record not found", 404);
  }

  attendee.status = "withdrawn";
  attendee.invitationToken = null;
  attendee.passcodeHash = null;
  attendee.lockedUntil = null;
  await persistStore();
  return jsonOk({ status: "withdrawn", meetup_id: id });
}
