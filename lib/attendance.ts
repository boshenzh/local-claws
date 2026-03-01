import { db, nextGlobalId } from "@/lib/store";
import { createInviteId, generateFunPasscode, generateInvitationToken, hashPasscode, parseInviteId, verifyPasscode } from "@/lib/invitations";
import { toAbsoluteUrl } from "@/lib/seo";
import type { AttendeeRecord, Meetup } from "@/lib/types";

const HOURLY_ATTEMPT_LIMIT = 5;
const TOTAL_ATTEMPT_LIMIT = 10;

type InviteLanding = {
  mode: "targeted" | "generic";
  meetup: Meetup;
  agentId: string | null;
  inviteId: string;
  canConfirm: boolean;
  isConfirmed: boolean;
  letterUrl: string | null;
  confirmationReason: "invite_delivery" | "join_approved" | "confirmed_record" | "none";
};

function nowIso(): string {
  return new Date().toISOString();
}

function hasDeliveryForAgentMeetup(agentId: string, meetupId: string): boolean {
  return db.notificationDeliveries.some((delivery) => {
    if (delivery.agentId !== agentId) return false;
    const event = db.notificationEvents.find((entry) => entry.id === delivery.eventId);
    if (!event || event.meetupId !== meetupId) return false;
    return event.eventType === "invite.created" || event.eventType === "invite.updated";
  });
}

function hasApprovedJoinRequest(agentId: string, meetupId: string): boolean {
  return db.joinRequests.some(
    (request) => request.meetupId === meetupId && request.attendeeAgentId === agentId && request.status === "approved"
  );
}

function confirmedAttendeeRecord(agentId: string, meetupId: string): AttendeeRecord | null {
  return (
    db.attendees.find(
      (entry) => entry.meetupId === meetupId && entry.agentId === agentId && entry.status === "confirmed"
    ) ?? null
  );
}

export function resolveInviteLanding(inviteId: string): InviteLanding | null {
  const parsed = parseInviteId(inviteId);
  if (parsed) {
    const meetup = db.meetups.find((entry) => entry.id === parsed.meetupId);
    if (!meetup) return null;
    const deliveredInvite = hasDeliveryForAgentMeetup(parsed.agentId, parsed.meetupId);
    const approvedJoin = hasApprovedJoinRequest(parsed.agentId, parsed.meetupId);
    const confirmedRecord = confirmedAttendeeRecord(parsed.agentId, parsed.meetupId);
    const confirmationReason: InviteLanding["confirmationReason"] = confirmedRecord
      ? "confirmed_record"
      : deliveredInvite
        ? "invite_delivery"
        : approvedJoin
          ? "join_approved"
          : "none";
    return {
      mode: "targeted",
      meetup,
      agentId: parsed.agentId,
      inviteId,
      canConfirm: !confirmedRecord && (deliveredInvite || approvedJoin),
      isConfirmed: Boolean(confirmedRecord),
      letterUrl: confirmedRecord?.invitationToken ? `/letter/${confirmedRecord.invitationToken}` : null,
      confirmationReason
    };
  }

  const meetup = db.meetups.find((entry) => entry.id === inviteId);
  if (!meetup) return null;
  return {
    mode: "generic",
    meetup,
    agentId: null,
    inviteId,
    canConfirm: false,
    isConfirmed: false,
    letterUrl: null,
    confirmationReason: "none"
  };
}

function upsertAttendee(meetupId: string, agentId: string): AttendeeRecord {
  const existing = db.attendees.find((entry) => entry.meetupId === meetupId && entry.agentId === agentId);
  if (existing) {
    existing.status = "confirmed";
    existing.confirmedAt = nowIso();
    return existing;
  }

  const attendee: AttendeeRecord = {
    id: nextGlobalId("at"),
    meetupId,
    agentId,
    inviteId: createInviteId(meetupId, agentId),
    invitationToken: null,
    passcodeHash: null,
    passcodeIssuedAt: null,
    failedAttempts: 0,
    failedWindowStart: null,
    totalFailures: 0,
    lockedUntil: null,
    confirmedAt: nowIso(),
    status: "confirmed",
    createdAt: nowIso()
  };
  db.attendees.push(attendee);
  return attendee;
}

export function confirmAttendanceForAgent(meetupId: string, agentId: string) {
  const meetup = db.meetups.find((entry) => entry.id === meetupId);
  if (!meetup) {
    return { ok: false as const, error: "Meetup not found" };
  }
  const agent = db.agents.get(agentId);
  if (!agent || agent.status !== "active") {
    return { ok: false as const, error: "Unknown or inactive agent" };
  }
  if (meetup.status !== "open") {
    return { ok: false as const, error: `Meetup is not open (current: ${meetup.status})` };
  }
  const eligible = hasDeliveryForAgentMeetup(agentId, meetupId) || hasApprovedJoinRequest(agentId, meetupId);
  if (!eligible) {
    return { ok: false as const, error: "Agent is not eligible to confirm this meetup yet" };
  }

  const attendee = upsertAttendee(meetupId, agentId);
  const passcode = generateFunPasscode();
  const invitationToken = generateInvitationToken();
  attendee.passcodeHash = hashPasscode(passcode);
  attendee.invitationToken = invitationToken;
  attendee.passcodeIssuedAt = nowIso();
  attendee.failedAttempts = 0;
  attendee.failedWindowStart = nowIso();
  attendee.totalFailures = 0;
  attendee.lockedUntil = null;
  attendee.confirmedAt = nowIso();

  return {
    ok: true as const,
    attendee,
    passcode,
    invitationUrl: toAbsoluteUrl(`/letter/${invitationToken}`),
    inviteUrl: toAbsoluteUrl(`/invite/${attendee.inviteId}`)
  };
}

export function confirmAttendanceByInviteId(inviteId: string) {
  const landing = resolveInviteLanding(inviteId);
  if (!landing) {
    return { ok: false as const, error: "Invitation not found" };
  }
  if (landing.mode === "targeted" && landing.isConfirmed && landing.letterUrl) {
    return { ok: false as const, error: "Attendance already confirmed. Open your existing invitation letter." };
  }
  if (landing.mode !== "targeted" || !landing.agentId || !landing.canConfirm) {
    return { ok: false as const, error: "This invite link cannot confirm attendance" };
  }
  return confirmAttendanceForAgent(landing.meetup.id, landing.agentId);
}

function getAttendeeByToken(token: string): AttendeeRecord | null {
  const attendee = db.attendees.find((entry) => entry.invitationToken === token && entry.status === "confirmed");
  return attendee ?? null;
}

export function letterSummary(token: string) {
  const attendee = getAttendeeByToken(token);
  if (!attendee) return null;
  const meetup = db.meetups.find((entry) => entry.id === attendee.meetupId);
  if (!meetup) return null;
  return {
    meetupName: meetup.name,
    city: meetup.city,
    district: meetup.district
  };
}

function resolvePrivateLocationForLetter(meetup: Meetup): {
  exactLocation: string;
  exactLocationLink: string | null;
} {
  const label = meetup.privateLocationLabel?.trim();
  const legacy = meetup.privateLocation?.trim();
  const district = meetup.district.trim();
  const note = meetup.privateLocationNote?.trim();
  const link = meetup.privateLocationLink?.trim() || null;

  const base = label || legacy || district;
  const exactLocation = note ? `${base} (${note})` : base;
  return { exactLocation, exactLocationLink: link };
}

function updateHourlyWindow(attendee: AttendeeRecord): void {
  const now = Date.now();
  const windowStart = attendee.failedWindowStart ? new Date(attendee.failedWindowStart).getTime() : 0;
  if (!windowStart || now - windowStart >= 1000 * 60 * 60) {
    attendee.failedAttempts = 0;
    attendee.failedWindowStart = nowIso();
  }
}

export function verifyLetterPasscode(token: string, passcode: string) {
  const attendee = getAttendeeByToken(token);
  if (!attendee || !attendee.passcodeHash) {
    return { ok: false as const, status: "not_found", message: "Invitation token not found." };
  }

  const meetup = db.meetups.find((entry) => entry.id === attendee.meetupId);
  if (!meetup) {
    return { ok: false as const, status: "not_found", message: "Meetup not found." };
  }

  const now = Date.now();
  if (attendee.lockedUntil && now < new Date(attendee.lockedUntil).getTime()) {
    return {
      ok: false as const,
      status: "locked",
      message: "Too many attempts. Ask your agent to re-confirm to get a new invitation."
    };
  }

  updateHourlyWindow(attendee);
  if (attendee.failedAttempts >= HOURLY_ATTEMPT_LIMIT) {
    attendee.lockedUntil = new Date(now + 1000 * 60 * 60).toISOString();
    return {
      ok: false as const,
      status: "rate_limited",
      message: "Attempt limit reached for this hour. Please try later."
    };
  }

  if (!verifyPasscode(passcode, attendee.passcodeHash)) {
    attendee.failedAttempts += 1;
    attendee.totalFailures += 1;
    attendee.failedWindowStart = attendee.failedWindowStart ?? nowIso();

    if (attendee.totalFailures >= TOTAL_ATTEMPT_LIMIT) {
      attendee.invitationToken = null;
      attendee.passcodeHash = null;
      attendee.lockedUntil = new Date(now + 1000 * 60 * 60 * 24).toISOString();
      return {
        ok: false as const,
        status: "reconfirm_required",
        message: "Token locked. Ask your agent to re-confirm attendance for a new passcode."
      };
    }

    const remaining = Math.max(0, HOURLY_ATTEMPT_LIMIT - attendee.failedAttempts);
    return {
      ok: false as const,
      status: "invalid_passcode",
      message: `Incorrect passcode. ${remaining} attempt(s) left this hour.`
    };
  }

  attendee.failedAttempts = 0;
  attendee.failedWindowStart = nowIso();
  attendee.lockedUntil = null;

  const attendees = db.attendees
    .filter((entry) => entry.meetupId === meetup.id && entry.status === "confirmed")
    .map((entry) => db.agents.get(entry.agentId)?.displayName ?? entry.agentId);
  const location = resolvePrivateLocationForLetter(meetup);

  return {
    ok: true as const,
    details: {
      meetupName: meetup.name,
      city: meetup.city,
      exactTime: meetup.startAt,
      exactLocation: location.exactLocation,
      exactLocationLink: location.exactLocationLink,
      exactLocationLat: meetup.privateLocationLat ?? null,
      exactLocationLon: meetup.privateLocationLon ?? null,
      attendees,
      hostNotes: meetup.hostNotes || "",
      secretCode: meetup.secretCode || ""
    }
  };
}
