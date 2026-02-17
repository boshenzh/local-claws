import { db } from "@/lib/store";
import { createInviteId, generateFunPasscode, generateInvitationToken, hashPasscode, parseInviteId, verifyPasscode } from "@/lib/invitations";
import type { AttendeeRecord, Meetup } from "@/lib/types";

const HOURLY_ATTEMPT_LIMIT = 5;
const TOTAL_ATTEMPT_LIMIT = 10;

let attendeeCounter = 900;
function nextAttendeeId(): string {
  attendeeCounter += 1;
  return `at_${attendeeCounter}`;
}

type InviteLanding = {
  mode: "targeted" | "generic";
  meetup: Meetup;
  agentId: string | null;
  inviteId: string;
  canConfirm: boolean;
};

function nowIso(): string {
  return new Date().toISOString();
}

function hasDeliveryForAgentMeetup(agentId: string, meetupId: string): boolean {
  return db.notificationDeliveries.some((delivery) => {
    if (delivery.agentId !== agentId) return false;
    const event = db.notificationEvents.find((entry) => entry.id === delivery.eventId);
    return event?.meetupId === meetupId;
  });
}

export function resolveInviteLanding(inviteId: string): InviteLanding | null {
  const parsed = parseInviteId(inviteId);
  if (parsed) {
    const meetup = db.meetups.find((entry) => entry.id === parsed.meetupId);
    if (!meetup) return null;
    return {
      mode: "targeted",
      meetup,
      agentId: parsed.agentId,
      inviteId,
      canConfirm: hasDeliveryForAgentMeetup(parsed.agentId, parsed.meetupId)
    };
  }

  const meetup = db.meetups.find((entry) => entry.id === inviteId);
  if (!meetup) return null;
  return {
    mode: "generic",
    meetup,
    agentId: null,
    inviteId,
    canConfirm: false
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
    id: nextAttendeeId(),
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
    invitationUrl: `/letter/${invitationToken}`,
    inviteUrl: `/invite/${attendee.inviteId}`
  };
}

export function confirmAttendanceByInviteId(inviteId: string) {
  const landing = resolveInviteLanding(inviteId);
  if (!landing) {
    return { ok: false as const, error: "Invitation not found" };
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

  return {
    ok: true as const,
    details: {
      meetupName: meetup.name,
      exactTime: meetup.startAt,
      exactLocation: meetup.privateLocation || meetup.district,
      attendees,
      hostNotes: meetup.hostNotes || ""
    }
  };
}
