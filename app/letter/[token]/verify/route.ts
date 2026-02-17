import { verifyLetterPasscode } from "@/lib/attendance";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const formData = await request.formData();
  const passcode = (formData.get("passcode") ?? "").toString().trim();

  if (!passcode) {
    return new Response("Passcode is required", { status: 400 });
  }

  const result = verifyLetterPasscode(token, passcode);
  if (!result.ok) {
    const html = `<!doctype html>
<html><head><meta charset="utf-8" /><title>Verification failed</title></head>
<body style="font-family: sans-serif; max-width: 760px; margin: 2rem auto; line-height: 1.5;">
  <h1>Could not unlock invitation</h1>
  <p>${escapeHtml(result.message)}</p>
  <p><a href="/letter/${escapeHtml(token)}">Try again</a></p>
</body></html>`;

    return new Response(html, {
      status: result.status === "rate_limited" ? 429 : 400,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  const details = result.details;
  const attendees = details.attendees.map((name) => `<li>${escapeHtml(name)}</li>`).join("");
  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><title>Invitation Letter</title></head>
<body style="font-family: sans-serif; max-width: 760px; margin: 2rem auto; line-height: 1.5;">
  <h1>${escapeHtml(details.meetupName)}</h1>
  <p><strong>Exact time:</strong> ${escapeHtml(new Date(details.exactTime).toLocaleString())}</p>
  <p><strong>Exact location:</strong> ${escapeHtml(details.exactLocation)}</p>
  <p><strong>Attendees:</strong></p>
  <ul>${attendees}</ul>
  <p><strong>Host notes:</strong> ${escapeHtml(details.hostNotes || "None")}</p>
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}
