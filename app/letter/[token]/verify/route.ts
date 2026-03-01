import { verifyLetterPasscode } from "@/lib/attendance";
import { resolveCityTimeZone } from "@/lib/location";
import { ensureStoreReady, persistStore } from "@/lib/store";
import { formatDetailedInTimeZone } from "@/lib/time";
import { NextResponse } from "next/server";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function serializeForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildExactMinimapSrc(details: {
  exactLocation: string;
  exactLocationLat?: number | null;
  exactLocationLon?: number | null;
}): string {
  const query =
    typeof details.exactLocationLat === "number" && typeof details.exactLocationLon === "number"
      ? `${details.exactLocationLat},${details.exactLocationLon}`
      : details.exactLocation;

  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;
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
        --mint: #00bf8f;
        --rose: #d9527a;
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
        width: min(900px, 100%);
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
        overflow: hidden;
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
        animation: stampPulse 2.4s ease-in-out infinite;
      }
      .party-burst {
        pointer-events: none;
        position: absolute;
        inset: 0;
      }
      .party-burst span {
        position: absolute;
        width: 8px;
        height: 8px;
        border-radius: 999px;
        opacity: 0;
        animation: pop 2.8s ease-in-out infinite;
      }
      .party-burst span:nth-child(1) { left: 8%; top: 14%; background: #ff5f5f; animation-delay: 0.1s; }
      .party-burst span:nth-child(2) { left: 22%; top: 7%; background: #31c48d; animation-delay: 0.5s; }
      .party-burst span:nth-child(3) { left: 76%; top: 10%; background: #59a8ff; animation-delay: 0.2s; }
      .party-burst span:nth-child(4) { left: 90%; top: 22%; background: #ffbf47; animation-delay: 0.8s; }
      .party-burst span:nth-child(5) { left: 12%; top: 74%; background: #d275ff; animation-delay: 1.2s; }
      .party-burst span:nth-child(6) { left: 84%; top: 76%; background: #ff7ab8; animation-delay: 1.5s; }

      .letter-brand {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
      }
      .letter-logo {
        width: 44px;
        height: 44px;
        object-fit: contain;
      }
      .letter-brand-copy {
        font: 700 10px/1.4 'Press Start 2P', monospace;
        color: var(--muted);
        text-transform: uppercase;
      }
      .party-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 4px 0 12px;
      }
      .party-chip {
        border: 2px solid #111;
        padding: 4px 8px;
        border-radius: 999px;
        font: 700 10px/1 'Press Start 2P', monospace;
        text-transform: uppercase;
        color: #111;
        background: #fff;
      }
      .party-chip.mint { background: color-mix(in srgb, var(--mint) 45%, white); }
      .party-chip.rose { background: color-mix(in srgb, var(--rose) 35%, white); }

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
      .utility-grid {
        margin-top: 16px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 12px;
      }
      .radar-card {
        border: 3px solid rgba(58, 38, 21, 0.45);
        background: rgba(255, 255, 255, 0.36);
        padding: 12px;
      }
      .radar-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .radar-chip {
        border: 2px solid #111;
        border-radius: 999px;
        background: #d7ffef;
        color: #0f4b35;
        padding: 4px 8px;
        font: 700 9px/1 'Press Start 2P', monospace;
        text-transform: uppercase;
      }
      .radar-wrap {
        margin-top: 8px;
        border: 2px solid #111;
        border-radius: 10px;
        overflow: hidden;
        background: #111;
      }
      .location-description {
        margin-top: 10px;
        border: 2px solid rgba(58, 38, 21, 0.45);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.36);
        padding: 10px;
        font: 30px/1.08 'VT323', monospace;
      }
      .radar-map {
        display: block;
        width: 100%;
        height: 220px;
        border: 0;
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
      .private-image-card {
        margin-top: 12px;
        border: 3px solid rgba(58, 38, 21, 0.45);
        background: rgba(255, 255, 255, 0.36);
        padding: 12px;
      }
      .private-image-frame {
        margin-top: 8px;
        border: 2px solid #111;
        border-radius: 10px;
        background: #fff7de;
        padding: 8px;
      }
      .private-image-preview {
        display: block;
        width: 100%;
        max-height: 320px;
        object-fit: contain;
        border-radius: 6px;
      }
      .private-image-link {
        margin-top: 10px;
      }
      .actions {
        margin-top: 18px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .btn {
        display: inline-block;
        border: 3px solid #111;
        background: #fff;
        color: #111;
        text-decoration: none;
        padding: 10px 12px;
        font: 700 10px/1.4 'Press Start 2P', monospace;
        cursor: pointer;
      }
      .btn:hover { background: #e5e7eb; }
      .btn:focus-visible {
        outline: 3px solid #59a8ff;
        outline-offset: 2px;
      }
      .status-note {
        margin: 8px 0 0;
        min-height: 18px;
        font: 700 10px/1.4 'Press Start 2P', monospace;
        color: #2f3f53;
      }
      .error-title {
        margin: 0;
        font: 700 18px/1.25 'Press Start 2P', monospace;
        color: var(--danger);
      }
      .error-copy {
        margin: 10px 0 0;
        font: 34px/1 'VT323', monospace;
      }
      @keyframes stampPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      @keyframes pop {
        0%, 40%, 100% { opacity: 0; transform: translateY(0) scale(0.5); }
        15% { opacity: 1; transform: translateY(-8px) scale(1); }
      }
      @media (max-width: 640px) {
        .letter { padding: 18px 14px; }
        h1 { font-size: 16px; line-height: 1.35; }
        .subtitle { font-size: 26px; }
        .radar-map { height: 190px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .stamp,
        .party-burst span {
          animation: none;
        }
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
          <div class="letter-brand">
            <img class="letter-logo" src="/localclaws-logo.png" alt="LocalClaws logo" />
            <div class="letter-brand-copy">LocalClaws</div>
          </div>
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

  const mapEmbedSrc = buildExactMinimapSrc({
    exactLocation: details.exactLocation,
    exactLocationLat: details.exactLocationLat,
    exactLocationLon: details.exactLocationLon
  });
  const localTimeText = formatDetailedInTimeZone(
    details.exactTime,
    resolveCityTimeZone(details.city)
  );

  const letterDataJson = serializeForInlineScript({
    meetupName: details.meetupName,
    exactTime: details.exactTime,
    exactLocation: details.exactLocation,
    exactLocationLink: details.exactLocationLink ?? "",
    secretCode: details.secretCode ?? "",
    hostNotes: details.hostNotes ?? "",
    durationMinutes: 90
  });
  const privateInviteImageSection =
    details.privateInviteImageUrl && details.privateInviteImageUrl.trim()
      ? `<article class="private-image-card">
          <h2>Private host attachment</h2>
          <p class="meta-label">Shared for confirmed attendees only.</p>
          <div class="private-image-frame">
            <img
              class="private-image-preview"
              src="${escapeHtml(details.privateInviteImageUrl)}"
              alt="${escapeHtml(details.privateInviteImageCaption || "Private meetup attachment")}"
              loading="lazy"
            />
          </div>
          <p class="meta-label" style="margin-top:10px;">
            ${escapeHtml(details.privateInviteImageCaption || "Host-shared private image")}
          </p>
          <p class="meta-label">If preview fails, open the image directly.</p>
          <div class="private-image-link">
            <a class="btn" href="${escapeHtml(details.privateInviteImageUrl)}" target="_blank" rel="noopener noreferrer">Open Private Image</a>
          </div>
        </article>`
      : "";

  const html = retroDocument(
    "Invitation Letter",
    `<main class="letter-shell">
      <article class="letter" id="invite-letter-capture">
        <div class="party-burst" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <div class="stamp">ACCESS GRANTED</div>
        <div class="letter-brand">
          <img class="letter-logo" src="/localclaws-logo.png" alt="LocalClaws logo" />
          <div class="letter-brand-copy">LocalClaws</div>
        </div>
        <div class="party-chips">
          <span class="party-chip mint">VIP CONFIRMED</span>
          <span class="party-chip rose">MISSION READY</span>
        </div>
        <p class="kicker">Official LocalClaws Meetup Invitation</p>
        <h1>${escapeHtml(details.meetupName)}</h1>
        <p class="subtitle">Your entry pass has been verified.</p>

        <div class="rule"></div>

        <section>
          <section class="meta-grid" aria-label="Invitation details">
            <div class="meta-card">
              <p class="meta-label">Mission time</p>
              <p class="meta-value">${escapeHtml(localTimeText)}</p>
            </div>
            <div class="meta-card">
              <p class="meta-label">Rendezvous zone</p>
              <p class="meta-value">${escapeHtml(details.exactLocation)}</p>
            </div>
            ${
              details.secretCode
                ? `<div class="meta-card">
              <p class="meta-label">Secret fun code (暗号)</p>
              <p class="meta-value">${escapeHtml(details.secretCode)}</p>
            </div>`
                : ""
            }
          </section>

          <h2>Party roster</h2>
          <ul>${attendees}</ul>

          <h2>Host notes</h2>
          <div class="notes">${escapeHtml(details.hostNotes || "No special notes from host.")}</div>
          ${privateInviteImageSection}
        </section>

        <section class="utility-grid">
          <article class="radar-card">
            <div class="radar-head">
              <h2>Rendezvous radar</h2>
              <span class="radar-chip">live</span>
            </div>
            <div class="radar-wrap">
              <iframe
                title="Exact location minimap"
                src="${escapeHtml(mapEmbedSrc)}"
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
                class="radar-map"
              ></iframe>
            </div>
            <p class="meta-label" style="margin-top:10px;">Location description</p>
            <div class="location-description">${escapeHtml(details.exactLocation)}</div>
            <p class="kicker" style="margin-top:10px;">Exact location unlocked for confirmed attendee.</p>
          </article>
        </section>

        <div class="actions" aria-label="Party pack actions">
          <button class="btn" id="save-calendar-btn" type="button">Save to Calendar (.ics)</button>
          <button class="btn" id="save-image-btn" type="button">Save as Image (PNG)</button>
          ${
            details.exactLocationLink
              ? `<a class="btn" href="${escapeHtml(details.exactLocationLink)}" target="_blank" rel="noopener noreferrer">Open Map</a>`
              : ""
          }
          <a class="btn" href="/">Return to board</a>
        </div>
        <p id="party-status" class="status-note" role="status" aria-live="polite"></p>
      </article>
    </main>

    <script>
      (() => {
        const LETTER_DATA = ${letterDataJson};
        const calendarBtn = document.getElementById('save-calendar-btn');
        const imageBtn = document.getElementById('save-image-btn');
        const statusNode = document.getElementById('party-status');

        const setStatus = (message) => {
          if (statusNode) statusNode.textContent = message;
        };

        const safeSlug = (value) => {
          const slug = (value || 'localclaws-invitation')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
          return slug || 'localclaws-invitation';
        };

        const toIcsUtcStamp = (isoValue) => {
          const date = new Date(isoValue);
          const pad = (n) => String(n).padStart(2, '0');
          return (
            date.getUTCFullYear().toString() +
            pad(date.getUTCMonth() + 1) +
            pad(date.getUTCDate()) +
            'T' +
            pad(date.getUTCHours()) +
            pad(date.getUTCMinutes()) +
            pad(date.getUTCSeconds()) +
            'Z'
          );
        };

        const addMinutes = (isoValue, minutes) => {
          const date = new Date(isoValue);
          return new Date(date.getTime() + minutes * 60 * 1000).toISOString();
        };

        const buildIcs = () => {
          const startAt = LETTER_DATA.exactTime;
          const endAt = addMinutes(startAt, LETTER_DATA.durationMinutes || 90);
          const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//LocalClaws//Invitation Letter//EN',
            'CALSCALE:GREGORIAN',
            'BEGIN:VEVENT',
            'UID:' + safeSlug(LETTER_DATA.meetupName) + '@localclaws.com',
            'DTSTAMP:' + toIcsUtcStamp(new Date().toISOString()),
            'DTSTART:' + toIcsUtcStamp(startAt),
            'DTEND:' + toIcsUtcStamp(endAt),
            'SUMMARY:' + LETTER_DATA.meetupName,
            'LOCATION:' + LETTER_DATA.exactLocation,
            'DESCRIPTION:' + [LETTER_DATA.hostNotes, LETTER_DATA.exactLocationLink].filter(Boolean).join(' | '),
            'END:VEVENT',
            'END:VCALENDAR'
          ];
          return lines.join('\\r\\n');
        };

        const downloadText = (filename, text, contentType) => {
          const blob = new Blob([text], { type: contentType });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = filename;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(url);
        };

        const replaceMapIframesForCapture = (node) => {
          node.querySelectorAll('iframe').forEach((frame) => {
            const replacement = document.createElement('div');
            replacement.style.border = '2px solid #111';
            replacement.style.borderRadius = '10px';
            replacement.style.background = '#fef3d4';
            replacement.style.color = '#3c2a17';
            replacement.style.padding = '10px';
            replacement.style.height = '220px';
            replacement.style.display = 'grid';
            replacement.style.placeItems = 'center';
            replacement.style.font = "700 12px/1.4 'Press Start 2P', monospace";
            replacement.textContent = 'Map preview available in browser. Use Open Map for live navigation.';
            frame.replaceWith(replacement);
          });
        };

        const cloneForCapture = (captureNode) => {
          const cloned = captureNode.cloneNode(true);
          cloned.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
          cloned.style.margin = '0';
          cloned.querySelectorAll('*').forEach((el) => {
            el.style.animation = 'none';
            el.style.transition = 'none';
          });
          replaceMapIframesForCapture(cloned);
          return cloned;
        };

        const loadImage = (src) =>
          new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = src;
          });

        const captureViaSvgFallback = async (captureNode) => {
          const width = captureNode.scrollWidth;
          const height = captureNode.scrollHeight;
          const cloned = cloneForCapture(captureNode);
          const serialized = new XMLSerializer().serializeToString(cloned);
          const svg = [
            '<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"' + width + '\" height=\"' + height + '\" viewBox=\"0 0 ' + width + ' ' + height + '\">',
            '<foreignObject width=\"100%\" height=\"100%\">',
            serialized,
            '</foreignObject>',
            '</svg>'
          ].join('');
          const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
          const image = await loadImage(svgUrl);
          const canvas = document.createElement('canvas');
          canvas.width = width * 2;
          canvas.height = height * 2;
          const context = canvas.getContext('2d');
          if (!context) {
            throw new Error('Canvas context unavailable');
          }
          context.setTransform(2, 0, 0, 2, 0, 0);
          context.fillStyle = '#f6d38d';
          context.fillRect(0, 0, width, height);
          context.drawImage(image, 0, 0);
          return canvas.toDataURL('image/png');
        };

        calendarBtn?.addEventListener('click', () => {
          try {
            const ics = buildIcs();
            const filename = safeSlug(LETTER_DATA.meetupName) + '-localclaws.ics';
            downloadText(filename, ics, 'text/calendar;charset=utf-8');
            setStatus('Calendar crystalized.');
          } catch {
            setStatus('Calendar export failed. Please try again.');
          }
        });

        imageBtn?.addEventListener('click', async () => {
          setStatus('Packing invite card...');
          try {
            const captureNode = document.getElementById('invite-letter-capture');
            if (!captureNode) {
              setStatus('Capture target missing.');
              return;
            }
            let dataUrl;
            if (window.html2canvas) {
              try {
                const canvas = await window.html2canvas(captureNode, {
                  scale: 2,
                  backgroundColor: '#f6d38d',
                  useCORS: true,
                  logging: false,
                  width: captureNode.scrollWidth,
                  height: captureNode.scrollHeight,
                  windowWidth: Math.max(document.documentElement.clientWidth, captureNode.scrollWidth),
                  windowHeight: Math.max(document.documentElement.clientHeight, captureNode.scrollHeight),
                  scrollX: 0,
                  scrollY: -window.scrollY
                });
                dataUrl = canvas.toDataURL('image/png');
              } catch {
                dataUrl = await captureViaSvgFallback(captureNode);
              }
            } else {
              dataUrl = await captureViaSvgFallback(captureNode);
            }
            const filename = safeSlug(LETTER_DATA.meetupName) + '-invite-card.png';
            const anchor = document.createElement('a');
            anchor.href = dataUrl;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setStatus('Invite card saved to inventory.');
          } catch {
            setStatus('Capture failed. Try again after map finishes loading.');
          }
        });
      })();
    </script>`
  );

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}
