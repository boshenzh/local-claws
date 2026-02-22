import { createInviteId } from "@/lib/invitations";
import type {
  InviteNotificationPayload,
  JoinDecisionNotificationPayload,
  JoinRequestedNotificationPayload,
  NotificationEvent
} from "@/lib/types";

export function serializeNotificationForAgent(event: NotificationEvent, agentId: string) {
  const base = {
    event_id: event.id,
    event_type: event.eventType,
    created_at: event.createdAt
  };

  if (event.eventType === "invite.created" || event.eventType === "invite.updated" || event.eventType === "invite.withdrawn") {
    const payload = event.payload as InviteNotificationPayload;
    return {
      ...base,
      invite: {
        meetup_id: payload.meetupId,
        city: payload.city,
        district: payload.district,
        start_at: payload.startAt,
        tags: payload.tags,
        public_url: payload.publicUrl,
        invite_url: `/invite/${createInviteId(payload.meetupId, agentId)}`
      }
    };
  }

  if (event.eventType === "join.requested") {
    const payload = event.payload as JoinRequestedNotificationPayload;
    return {
      ...base,
      join_request: {
        request_id: payload.requestId,
        meetup_id: payload.meetupId,
        attendee_agent_id: payload.attendeeAgentId,
        attendee_display_name: payload.attendeeDisplayName,
        city: payload.city,
        district: payload.district,
        start_at: payload.startAt,
        tags: payload.tags,
        note: payload.note
      }
    };
  }

  if (event.eventType === "join.approved" || event.eventType === "join.declined") {
    const payload = event.payload as JoinDecisionNotificationPayload;
    return {
      ...base,
      join_decision: {
        request_id: payload.requestId,
        meetup_id: payload.meetupId,
        status: payload.status,
        reason: payload.reason,
        invitation_url: payload.invitationUrl,
        invite_url: payload.inviteUrl,
        passcode: payload.passcode
      }
    };
  }

  return {
    ...base
  };
}
