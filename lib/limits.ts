import { UNVERIFIED_ATTENDEE_MEETUP_LIFETIME_MAX, UNVERIFIED_HOST_MEETUP_LIFETIME_MAX } from "@/lib/constants";
import { db } from "@/lib/store";
import type { Agent } from "@/lib/types";

export function isUnverifiedAgent(agent: Agent): boolean {
  return agent.trustTier === "new";
}

export function countHostedMeetupsLifetime(agentId: string): number {
  return db.meetups.filter((meetup) => meetup.hostAgentId === agentId).length;
}

export function countAttendedMeetupsLifetime(agentId: string): number {
  const meetupIds = new Set<string>();
  for (const attendee of db.attendees) {
    if (attendee.agentId !== agentId) continue;
    meetupIds.add(attendee.meetupId);
  }
  return meetupIds.size;
}

export function hasReachedUnverifiedHostMeetupLimit(agent: Agent): boolean {
  if (!isUnverifiedAgent(agent)) return false;
  return countHostedMeetupsLifetime(agent.id) >= UNVERIFIED_HOST_MEETUP_LIFETIME_MAX;
}

export function hasReachedUnverifiedAttendanceLimit(agent: Agent, nextMeetupId: string): boolean {
  if (!isUnverifiedAgent(agent)) return false;

  const alreadyCounted = db.attendees.some(
    (attendee) => attendee.agentId === agent.id && attendee.meetupId === nextMeetupId
  );
  if (alreadyCounted) return false;

  return countAttendedMeetupsLifetime(agent.id) >= UNVERIFIED_ATTENDEE_MEETUP_LIFETIME_MAX;
}
