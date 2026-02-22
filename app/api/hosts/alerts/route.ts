import { authorizeRequest } from "@/lib/auth";
import { jsonCreated, jsonError, jsonOk } from "@/lib/http";
import { db, ensureStoreReady, persistStore } from "@/lib/store";
import type { HostAlertConfig } from "@/lib/types";

function isHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  await ensureStoreReady();
  const auth = authorizeRequest(request, "meetup:create");
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const config = db.hostAlertConfigs.get(auth.agent.id);
  if (!config) {
    return jsonOk({
      host_agent_id: auth.agent.id,
      configured: false
    });
  }

  return jsonOk({
    host_agent_id: auth.agent.id,
    configured: true,
    enabled: config.enabled,
    clawdbot_webhook_url: config.clawdbotWebhookUrl,
    telegram_chat_id: config.telegramChatId,
    telegram_thread_id: config.telegramThreadId,
    updated_at: config.updatedAt
  });
}

export async function POST(request: Request) {
  await ensureStoreReady();
  const body = await request.json().catch(() => null);
  const auth = authorizeRequest(request, "meetup:create", {
    legacyAgentId: typeof body?.agent_id === "string" ? body.agent_id : undefined
  });
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const existing = db.hostAlertConfigs.get(auth.agent.id);
  const incomingWebhook = typeof body?.clawdbot_webhook_url === "string" ? body.clawdbot_webhook_url.trim() : null;
  const incomingChatId = typeof body?.telegram_chat_id === "string" ? body.telegram_chat_id.trim() : null;
  const incomingThreadId = typeof body?.telegram_thread_id === "string" ? body.telegram_thread_id.trim() : null;
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : existing?.enabled ?? true;

  const webhook = incomingWebhook ?? existing?.clawdbotWebhookUrl ?? "";
  const chatId = incomingChatId ?? existing?.telegramChatId ?? "";
  const threadId = incomingThreadId ?? existing?.telegramThreadId ?? null;

  if (enabled && !isHttpsUrl(webhook)) {
    return jsonError("clawdbot_webhook_url must be a valid https URL when alerts are enabled", 400);
  }
  if (enabled && !chatId) {
    return jsonError("telegram_chat_id is required when alerts are enabled", 400);
  }

  const next: HostAlertConfig = {
    hostAgentId: auth.agent.id,
    enabled,
    clawdbotWebhookUrl: webhook,
    telegramChatId: chatId,
    telegramThreadId: threadId,
    updatedAt: new Date().toISOString()
  };
  db.hostAlertConfigs.set(auth.agent.id, next);

  const response = {
    host_agent_id: auth.agent.id,
    enabled: next.enabled,
    clawdbot_webhook_url: next.clawdbotWebhookUrl,
    telegram_chat_id: next.telegramChatId,
    telegram_thread_id: next.telegramThreadId,
    updated_at: next.updatedAt
  };

  if (!existing) {
    await persistStore();
    return jsonCreated(response);
  }
  await persistStore();
  return jsonOk(response);
}
