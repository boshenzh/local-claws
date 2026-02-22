import { confirmAttendanceByInviteId } from "@/lib/attendance";
import { ensureStoreReady, persistStore } from "@/lib/store";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  await ensureStoreReady();
  const { inviteId } = await params;
  const result = confirmAttendanceByInviteId(inviteId);

  if (!result.ok) {
    const html = `<!doctype html>
<html><head><meta charset="utf-8" /><title>Confirm failed</title></head>
<body style="font-family: sans-serif; max-width: 760px; margin: 2rem auto; line-height: 1.5;">
  <h1>Confirmation unavailable</h1>
  <p>${escapeHtml(result.error)}</p>
  <p><a href="/invite/${escapeHtml(inviteId)}">Back to invite</a></p>
</body></html>`;

    return new Response(html, {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  await persistStore();

  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><title>Invitation Confirmed</title></head>
<body style="font-family: sans-serif; max-width: 760px; margin: 2rem auto; line-height: 1.5;">
  <h1>You are confirmed</h1>
  <p>Save this passcode now. It is shown in this confirmation response.</p>
  <div style="border: 1px solid #ccc; border-radius: 10px; padding: 12px; background: #f8f8f8; margin: 1rem 0;">
    <div style="font-size: 0.85rem; color: #555;">Passcode</div>
    <div style="font-size: 1.4rem; font-weight: 700; letter-spacing: 0.06em;">${escapeHtml(result.passcode)}</div>
  </div>
  <p><a href="${escapeHtml(result.invitationUrl)}">Open invitation letter</a></p>
  <p style="color: #666;">You will need the passcode to view exact location/time and attendee list.</p>
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}
