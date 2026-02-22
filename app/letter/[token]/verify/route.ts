import { verifyLetterPasscode } from "@/lib/attendance";
import { ensureStoreReady, persistStore } from "@/lib/store";
import { NextResponse } from "next/server";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function retroDocument(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
      :root {
        --bg: #0f172a;
        --panel: #f6d38d;
        --panel-edge: #6a4121;
        --ink: #1f130c;
        --muted: #6b4e37;
        --gold: #ffce4d;
        --danger: #c84536;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        padding: 20px;
        background:
          radial-gradient(circle at 20% 20%, #223257 0%, transparent 40%),
          radial-gradient(circle at 80% 10%, #3b1f4e 0%, transparent 34%),
          linear-gradient(180deg, #0a0f1f 0%, var(--bg) 80%);
        color: var(--ink);
        display: grid;
        place-items: center;
      }
      .letter-shell {
        width: min(860px, 100%);
        border: 4px solid #111;
        background: #1f2937;
        padding: 12px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
      }
      .letter {
        border: 4px solid var(--panel-edge);
        background:
          linear-gradient(0deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.12)),
          repeating-linear-gradient(
            0deg,
            #f9dda2 0px,
            #f9dda2 10px,
            #f2ce89 10px,
            #f2ce89 20px
          );
        padding: 28px 24px;
        position: relative;
      }
      .stamp {
        position: absolute;
        top: 10px;
        right: 10px;
        border: 3px solid #111;
        background: var(--gold);
        color: #111;
        padding: 6px 9px;
        font: 700 11px/1 'Press Start 2P', monospace;
        text-transform: uppercase;
      }
      .kicker {
        font: 700 11px/1 'Press Start 2P', monospace;
        text-transform: uppercase;
        color: var(--muted);
        margin: 0 0 16px;
      }
      h1 {
        margin: 0;
        font: 700 24px/1.2 'Press Start 2P', monospace;
      }
      .subtitle {
        margin: 14px 0 0;
        font: 32px/1 'VT323', monospace;
      }
      .rule {
        margin: 18px 0;
        border-top: 3px dashed rgba(58, 38, 21, 0.5);
      }
      .meta-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
      }
      .meta-card {
        border: 3px solid rgba(58, 38, 21, 0.45);
        background: rgba(255, 255, 255, 0.3);
        padding: 12px;
      }
      .meta-label {
        margin: 0 0 6px;
        font: 700 10px/1.2 'Press Start 2P', monospace;
        text-transform: uppercase;
        color: var(--muted);
      }
      .meta-value {
        margin: 0;
        font: 33px/1 'VT323', monospace;
      }
      h2 {
        margin: 18px 0 10px;
        font: 700 14px/1.2 'Press Start 2P', monospace;
        text-transform: uppercase;
      }
      ul {
        list-style: square;
        margin: 0;
        padding-left: 22px;
      }
      li {
        font: 31px/1.1 'VT323', monospace;
      }
      .notes {
        margin-top: 12px;
        border: 3px solid rgba(58, 38, 21, 0.45);
        background: rgba(255, 255, 255, 0.36);
        padding: 12px;
        font: 30px/1.1 'VT323', monospace;
        white-space: pre-wrap;
      }
      .actions {
        margin-top: 18px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      a.btn {
        display: inline-block;
        border: 3px solid #111;
        background: #fff;
        color: #111;
        text-decoration: none;
        padding: 10px 12px;
        font: 700 10px/1.4 'Press Start 2P', monospace;
      }
      a.btn:hover { background: #e5e7eb; }
      .error-title {
        margin: 0;
        font: 700 18px/1.25 'Press Start 2P', monospace;
        color: var(--danger);
      }
      .error-copy {
        margin: 10px 0 0;
        font: 34px/1 'VT323', monospace;
      }
      @media (max-width: 640px) {
        .letter { padding: 18px 14px; }
        h1 { font-size: 16px; line-height: 1.35; }
        .subtitle { font-size: 26px; }
      }
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const destination = new URL(`/letter/${encodeURIComponent(token)}`, request.url);
  return NextResponse.redirect(destination, 303);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  await ensureStoreReady();
  const { token } = await params;
  const formData = await request.formData();
  const passcode = (formData.get("passcode") ?? "").toString().trim();

  if (!passcode) {
    return new Response("Passcode is required", { status: 400 });
  }

  const result = verifyLetterPasscode(token, passcode);
  await persistStore();
  if (!result.ok) {
    const html = retroDocument(
      "Verification failed",
      `<main class="letter-shell">
        <section class="letter">
          <div class="stamp">LOCKED</div>
          <p class="kicker">LocalClaws // Invitation Terminal</p>
          <h1 class="error-title">ACCESS DENIED</h1>
          <p class="error-copy">${escapeHtml(result.message)}</p>
          <div class="actions">
            <a class="btn" href="/letter/${escapeHtml(token)}">Try passcode again</a>
            <a class="btn" href="/">Back to LocalClaws</a>
          </div>
        </section>
      </main>`
    );

    return new Response(html, {
      status: result.status === "rate_limited" ? 429 : 400,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  const details = result.details;
  const attendees =
    details.attendees.length > 0
      ? details.attendees.map((name) => `<li>${escapeHtml(name)}</li>`).join("")
      : "<li>Awaiting more confirmed participants</li>";
  const html = retroDocument(
    "Invitation Letter",
    `<main class="letter-shell">
      <article class="letter">
        <div class="stamp">ACCESS GRANTED</div>
        <p class="kicker">Official LocalClaws Meetup Invitation</p>
        <h1>${escapeHtml(details.meetupName)}</h1>
        <p class="subtitle">Your entry pass has been verified.</p>

        <div class="rule"></div>

        <section class="meta-grid" aria-label="Invitation details">
          <div class="meta-card">
            <p class="meta-label">Mission time</p>
            <p class="meta-value">${escapeHtml(new Date(details.exactTime).toLocaleString())}</p>
          </div>
          <div class="meta-card">
            <p class="meta-label">Rendezvous zone</p>
            <p class="meta-value">${escapeHtml(details.exactLocation)}</p>
          </div>
        </section>
        ${
          details.exactLocationLink
            ? `<div class="actions">
          <a class="btn" href="${escapeHtml(details.exactLocationLink)}" target="_blank" rel="noopener noreferrer">Open map link</a>
        </div>`
            : ""
        }

        <h2>Party roster</h2>
        <ul>${attendees}</ul>

        <h2>Host notes</h2>
        <div class="notes">${escapeHtml(details.hostNotes || "No special notes from host.")}</div>

        <div class="actions">
          <a class="btn" href="/">Return to board</a>
        </div>
      </article>
    </main>`
  );

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}
