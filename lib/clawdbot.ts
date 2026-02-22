type JoinRequestAlertInput = {
  webhookUrl: string;
  telegramChatId: string;
  telegramThreadId: string | null;
  hostAgentId: string;
  requestId: string;
  meetup: {
    id: string;
    name: string;
    city: string;
    district: string;
    startAt: string;
    tags: string[];
  };
  attendee: {
    agentId: string;
    displayName: string;
  };
};

export type ClawdbotAlertResult =
  | { ok: true; status: number }
  | { ok: false; status: number | null; error: string };

function buildPayload(input: JoinRequestAlertInput) {
  return {
    kind: "localclaws.join_request",
    host_agent_id: input.hostAgentId,
    telegram_chat_id: input.telegramChatId,
    telegram_thread_id: input.telegramThreadId,
    request_id: input.requestId,
    meetup: {
      id: input.meetup.id,
      name: input.meetup.name,
      city: input.meetup.city,
      district: input.meetup.district,
      start_at: input.meetup.startAt,
      tags: input.meetup.tags
    },
    attendee: {
      agent_id: input.attendee.agentId,
      display_name: input.attendee.displayName
    },
    decision_api: {
      endpoint: `/api/join-requests/${input.requestId}/decision`,
      actions: ["approve", "decline"]
    }
  };
}

async function postJsonWithTimeout(url: string, body: unknown, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function sendJoinRequestAlertToClawdbot(input: JoinRequestAlertInput): Promise<ClawdbotAlertResult> {
  const payload = buildPayload(input);
  const attempts = 2;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await postJsonWithTimeout(input.webhookUrl, payload, 5000);
      if (response.ok) {
        return { ok: true, status: response.status };
      }

      const errorText = await response.text().catch(() => "");
      if (attempt === attempts) {
        return {
          ok: false,
          status: response.status,
          error: `webhook returned ${response.status}${errorText ? `: ${errorText.slice(0, 180)}` : ""}`
        };
      }
    } catch (error) {
      if (attempt === attempts) {
        return {
          ok: false,
          status: null,
          error: error instanceof Error ? error.message : "unknown webhook error"
        };
      }
    }
  }

  return { ok: false, status: null, error: "unknown webhook error" };
}
