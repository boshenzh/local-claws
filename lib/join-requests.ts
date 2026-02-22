import { confirmAttendanceForAgent } from "@/lib/attendance";
import { sendJoinRequestAlertToClawdbot } from "@/lib/clawdbot";
import { emitAgentEvent } from "@/lib/events";
import { db, nextGlobalId } from "@/lib/store";
import type {
  JoinDecisionNotificationPayload,
  JoinRequest,
  JoinRequestStatus,
  JoinRequestedNotificationPayload,
  NotificationDelivery,
  NotificationEvent,
  NotificationEventType
} from "@/lib/types";

function nowIso(): string {
  return new Date().toISOString();
}

function createTargetedEvent(
  eventType: NotificationEventType,
  meetupId: string,
  payload: JoinRequestedNotificationPayload | JoinDecisionNotificationPayload,
  targetAgentId: string
): NotificationEvent {
  const event: NotificationEvent = {
    id: nextGlobalId("evt"),
    meetupId,
    eventType,
    payload,
    createdAt: nowIso()
  };
  db.notificationEvents.push(event);

  const delivery: NotificationDelivery = {
    id: nextGlobalId("del"),
    eventId: event.id,
    agentId: targetAgentId,
    state: "delivered",
    attemptCount: 1,
    lastAttemptAt: nowIso(),
    ackedAt: null
  };
  db.notificationDeliveries.push(delivery);
  emitAgentEvent(targetAgentId, event);
  return event;
}

type JoinRequestCreateInput = {
  meetupId: string;
  attendeeAgentId: string;
  note: string | null;
};

type JoinRequestCreateResult =
  | { ok: false; code: "not_found" | "meetup_not_open" | "host_cannot_request" | "already_confirmed"; message: string }
  | {
      ok: true;
      created: boolean;
      request: JoinRequest;
      hostAlert: { attempted: boolean; status: "sent" | "failed"; lastError: string | null };
    };

export async function createJoinRequest(input: JoinRequestCreateInput): Promise<JoinRequestCreateResult> {
  const meetup = db.meetups.find((entry) => entry.id === input.meetupId);
  if (!meetup) {
    return { ok: false, code: "not_found", message: "Meetup not found" };
  }
  if (meetup.status !== "open") {
    return { ok: false, code: "meetup_not_open", message: `Meetup must be open to request join (current: ${meetup.status})` };
  }
  if (meetup.hostAgentId === input.attendeeAgentId) {
    return { ok: false, code: "host_cannot_request", message: "Host cannot submit a join request to their own meetup" };
  }

  const confirmed = db.attendees.find(
    (entry) => entry.meetupId === meetup.id && entry.agentId === input.attendeeAgentId && entry.status === "confirmed"
  );
  if (confirmed) {
    return { ok: false, code: "already_confirmed", message: "Agent is already confirmed for this meetup" };
  }

  const existingPending = db.joinRequests.find(
    (entry) =>
      entry.meetupId === meetup.id && entry.attendeeAgentId === input.attendeeAgentId && entry.status === "pending"
  );
  if (existingPending) {
    return {
      ok: true,
      created: false,
      request: existingPending,
      hostAlert: {
        attempted: existingPending.hostAlertStatus !== "pending",
        status: existingPending.hostAlertStatus === "sent" ? "sent" : "failed",
        lastError: existingPending.hostAlertError
      }
    };
  }

  const request: JoinRequest = {
    id: nextGlobalId("jr"),
    meetupId: meetup.id,
    hostAgentId: meetup.hostAgentId,
    attendeeAgentId: input.attendeeAgentId,
    status: "pending",
    note: input.note,
    createdAt: nowIso(),
    decidedAt: null,
    decidedByAgentId: null,
    decisionReason: null,
    hostAlertStatus: "pending",
    hostAlertError: null
  };
  db.joinRequests.push(request);

  const attendeeDisplayName = db.agents.get(input.attendeeAgentId)?.displayName ?? input.attendeeAgentId;
  createTargetedEvent(
    "join.requested",
    meetup.id,
    {
      requestId: request.id,
      meetupId: meetup.id,
      attendeeAgentId: request.attendeeAgentId,
      attendeeDisplayName,
      city: meetup.city,
      district: meetup.district,
      startAt: meetup.startAt,
      tags: meetup.tags,
      note: request.note
    },
    meetup.hostAgentId
  );

  const alertConfig = db.hostAlertConfigs.get(meetup.hostAgentId);
  if (!alertConfig || !alertConfig.enabled) {
    request.hostAlertStatus = "failed";
    request.hostAlertError = "host_alert_config_missing_or_disabled";
    return {
      ok: true,
      created: true,
      request,
      hostAlert: { attempted: false, status: "failed", lastError: request.hostAlertError }
    };
  }

  const alertResult = await sendJoinRequestAlertToClawdbot({
    webhookUrl: alertConfig.clawdbotWebhookUrl,
    telegramChatId: alertConfig.telegramChatId,
    telegramThreadId: alertConfig.telegramThreadId,
    hostAgentId: meetup.hostAgentId,
    requestId: request.id,
    meetup: {
      id: meetup.id,
      name: meetup.name,
      city: meetup.city,
      district: meetup.district,
      startAt: meetup.startAt,
      tags: meetup.tags
    },
    attendee: {
      agentId: request.attendeeAgentId,
      displayName: attendeeDisplayName
    }
  });

  if (alertResult.ok) {
    request.hostAlertStatus = "sent";
    request.hostAlertError = null;
    return {
      ok: true,
      created: true,
      request,
      hostAlert: { attempted: true, status: "sent", lastError: null }
    };
  }

  request.hostAlertStatus = "failed";
  request.hostAlertError = alertResult.error;
  return {
    ok: true,
    created: true,
    request,
    hostAlert: { attempted: true, status: "failed", lastError: alertResult.error }
  };
}

export function listJoinRequestsForMeetup(meetupId: string, status?: JoinRequestStatus): JoinRequest[] {
  return db.joinRequests
    .filter((entry) => entry.meetupId === meetupId)
    .filter((entry) => (status ? entry.status === status : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type JoinRequestDecisionAction = "approve" | "decline";

type DecideJoinRequestResult =
  | { ok: false; code: "not_found" | "forbidden" | "meetup_not_open"; message: string }
  | { ok: true; request: JoinRequest; idempotent: boolean };

export function decideJoinRequest(input: {
  requestId: string;
  hostAgentId: string;
  action: JoinRequestDecisionAction;
  reason: string | null;
}): DecideJoinRequestResult {
  const request = db.joinRequests.find((entry) => entry.id === input.requestId);
  if (!request) {
    return { ok: false, code: "not_found", message: "Join request not found" };
  }

  if (request.hostAgentId !== input.hostAgentId) {
    return { ok: false, code: "forbidden", message: "Only the meetup host can decide this join request" };
  }

  if (request.status !== "pending") {
    return { ok: true, request, idempotent: true };
  }

  const meetup = db.meetups.find((entry) => entry.id === request.meetupId);
  if (!meetup) {
    return { ok: false, code: "not_found", message: "Meetup not found" };
  }

  if (input.action === "approve" && meetup.status !== "open") {
    return { ok: false, code: "meetup_not_open", message: `Meetup must be open to approve requests (current: ${meetup.status})` };
  }

  request.decidedAt = nowIso();
  request.decidedByAgentId = input.hostAgentId;
  request.decisionReason = input.reason;

  if (input.action === "decline") {
    request.status = "declined";
    createTargetedEvent(
      "join.declined",
      request.meetupId,
      {
        requestId: request.id,
        meetupId: request.meetupId,
        status: "declined",
        reason: input.reason,
        invitationUrl: null,
        inviteUrl: null,
        passcode: null
      },
      request.attendeeAgentId
    );
    return { ok: true, request, idempotent: false };
  }

  request.status = "approved";
  const confirmResult = confirmAttendanceForAgent(request.meetupId, request.attendeeAgentId);
  if (!confirmResult.ok) {
    request.status = "pending";
    request.decidedAt = null;
    request.decidedByAgentId = null;
    request.decisionReason = null;
    return { ok: false, code: "meetup_not_open", message: confirmResult.error };
  }
  createTargetedEvent(
    "join.approved",
    request.meetupId,
    {
      requestId: request.id,
      meetupId: request.meetupId,
      status: "approved",
      reason: input.reason,
      invitationUrl: confirmResult.invitationUrl,
      inviteUrl: confirmResult.inviteUrl,
      passcode: confirmResult.passcode
    },
    request.attendeeAgentId
  );
  return { ok: true, request, idempotent: false };
}
