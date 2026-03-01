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
<html><head><meta charset="utf-8" /><title>确认失败</title></head>
<body style="font-family: sans-serif; max-width: 760px; margin: 2rem auto; line-height: 1.5;">
  <h1>当前无法确认</h1>
  <p>${escapeHtml(result.error)}</p>
  <p><a href="/zh/invite/${escapeHtml(inviteId)}">返回邀请页</a></p>
</body></html>`;

    return new Response(html, {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  await persistStore();

  const invitationUrl = result.invitationUrl.replace("/letter/", "/zh/letter/");
  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><title>邀请已确认</title></head>
<body style="font-family: sans-serif; max-width: 760px; margin: 2rem auto; line-height: 1.5;">
  <h1>你已确认参加</h1>
  <p>请立即保存口令。本次确认响应仅展示一次。</p>
  <div style="border: 1px solid #ccc; border-radius: 10px; padding: 12px; background: #f8f8f8; margin: 1rem 0;">
    <div style="font-size: 0.85rem; color: #555;">口令</div>
    <div style="font-size: 1.4rem; font-weight: 700; letter-spacing: 0.06em;">${escapeHtml(result.passcode)}</div>
  </div>
  <p><a href="${escapeHtml(invitationUrl)}">打开邀请函</a></p>
  <p style="color: #666;">你需要口令才能查看精确地点、时间和参与者名单。</p>
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}
