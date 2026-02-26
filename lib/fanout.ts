import { TRUST_TIER_DAILY_FANOUT } from "@/lib/constants";
import { emitAgentEvent } from "@/lib/events";
import { metricIncrement } from "@/lib/metrics";
import { db, nextGlobalId } from "@/lib/store";
import type {
  Agent,
  DeliveryState,
  Meetup,
  NotificationDelivery,
  NotificationEvent,
  NotificationEventPayload,
  NotificationEventType,
  TrustTier
} from "@/lib/types";

function meetupPublicUrl(city: string, meetupId: string): string {
  return `/calendar/${encodeURIComponent(city)}/event/${encodeURIComponent(meetupId)}`;
}

function normalizeText(input: string): string {
  return input.trim().toLowerCase();
}

function overlap(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return true;
  const set = new Set(a.map((value) => value.toLowerCase()));
  return b.some((value) => set.has(value.toLowerCase()));
}

function intersectTags(a: string[], b: string[]): string[] {
  const lookup = new Set(a.map((value) => value.toLowerCase()));
  const intersection = new Set<string>();
  for (const value of b) {
    const normalized = value.toLowerCase();
    if (lookup.has(normalized)) {
      intersection.add(normalized);
    }
  }
  return Array.from(intersection);
}

function keyForHostDailyQuota(agentId: string, isoDate: string): string {
  return `${agentId}:${isoDate.slice(0, 10)}`;
}

function canFanout(host: Agent, targets: number): boolean {
  const key = keyForHostDailyQuota(host.id, new Date().toISOString());
  const used = db.hostFanoutByDate.get(key) ?? 0;
  const limit = TRUST_TIER_DAILY_FANOUT[host.trustTier];
  return used + targets <= limit;
}

function incrementFanout(host: Agent, targets: number): void {
  const key = keyForHostDailyQuota(host.id, new Date().toISOString());
  const used = db.hostFanoutByDate.get(key) ?? 0;
  db.hostFanoutByDate.set(key, used + targets);
}

type InviteLifecycleEventType = Extract<NotificationEventType, "invite.created" | "invite.updated" | "invite.withdrawn">;

export function createInviteEvent(meetup: Meetup, eventType: InviteLifecycleEventType = "invite.created"): NotificationEvent {
  const payload: NotificationEventPayload = {
    meetupId: meetup.id,
    city: meetup.city,
    district: meetup.district,
    startAt: meetup.startAt,
    tags: meetup.tags,
    publicUrl: meetupPublicUrl(meetup.city, meetup.id)
  };

  const event: NotificationEvent = {
    id: nextGlobalId("evt"),
    meetupId: meetup.id,
    eventType,
    payload,
    createdAt: new Date().toISOString()
  };

  db.notificationEvents.push(event);
  metricIncrement("events_created_total", 1);
  return event;
}

export function deliverInviteEventToAgents(
  meetup: Meetup,
  eventType: Exclude<InviteLifecycleEventType, "invite.created">,
  requestedAgentIds: string[]
): { event: NotificationEvent | null; deliveries: NotificationDelivery[] } {
  const targetAgentIds = Array.from(
    new Set(
      requestedAgentIds
        .map((value) => value.trim())
        .filter((value) => Boolean(value))
        .filter((agentId) => agentId !== meetup.hostAgentId)
        .filter((agentId) => {
          const agent = db.agents.get(agentId);
          return Boolean(agent && agent.status === "active");
        })
    )
  );

  if (targetAgentIds.length === 0) {
    return {
      event: null,
      deliveries: []
    };
  }

  const event = createInviteEvent(meetup, eventType);
  const deliveries: NotificationDelivery[] = [];
  for (const agentId of targetAgentIds) {
    const delivery: NotificationDelivery = {
      id: nextGlobalId("del"),
      eventId: event.id,
      agentId,
      state: "delivered",
      attemptCount: 1,
      lastAttemptAt: new Date().toISOString(),
      ackedAt: null
    };
    db.notificationDeliveries.push(delivery);
    deliveries.push(delivery);
    metricIncrement("events_delivered_total", 1);
    emitAgentEvent(agentId, event);
  }

  return {
    event,
    deliveries
  };
}

export type InviteCandidate = {
  candidateId: string;
  displayName: string;
  trustTier: TrustTier | "external";
  matchedTags: string[];
  radiusKm: number | null;
  source: "subscription" | "cold_start_pool" | "moltbook";
  subscriptionStatus: "active" | "none";
  city: string;
  district: string | null;
  locationMatch: "same_city_same_district" | "same_city" | "unknown";
  deliveryChannel: "localclaws" | "external_moltbook";
  externalInviteUrl: string | null;
  localAgentId: string | null;
};

function districtMatch(meetupDistrict: string, candidateDistrict: string | null): boolean {
  if (!candidateDistrict) return false;
  return normalizeText(meetupDistrict) === normalizeText(candidateDistrict);
}

export function listInviteCandidates(
  meetup: Meetup,
  options?: { includeUnsubscribed?: boolean; includeMoltbook?: boolean }
): InviteCandidate[] {
  const includeUnsubscribed = options?.includeUnsubscribed ?? false;
  const includeMoltbook = options?.includeMoltbook ?? false;
  const byId = new Map<string, InviteCandidate>();

  for (const sub of db.agentSubscriptions) {
    if (sub.status !== "active") continue;
    if (sub.agentId === meetup.hostAgentId) continue;
    if (sub.city.toLowerCase() !== meetup.city.toLowerCase()) continue;
    if (!overlap(sub.tags, meetup.tags)) continue;

    const agent = db.agents.get(sub.agentId);
    if (!agent || agent.status !== "active") continue;
    if (agent.role === "host") continue;

    const matchedTags = intersectTags(sub.tags, meetup.tags);
    const candidateId = sub.agentId;
    const sameDistrict = districtMatch(meetup.district, sub.homeDistrict);
    const existing = byId.get(candidateId);

    if (!existing) {
      byId.set(candidateId, {
        candidateId,
        displayName: agent.displayName,
        trustTier: agent.trustTier,
        matchedTags,
        radiusKm: sub.radiusKm,
        source: "subscription",
        subscriptionStatus: "active",
        city: sub.city,
        district: sub.homeDistrict,
        locationMatch: sameDistrict ? "same_city_same_district" : "same_city",
        deliveryChannel: "localclaws",
        externalInviteUrl: null,
        localAgentId: sub.agentId
      });
      continue;
    }

    if (matchedTags.length > existing.matchedTags.length) {
      existing.matchedTags = matchedTags;
    }
    if (existing.radiusKm === null || sub.radiusKm < existing.radiusKm) {
      existing.radiusKm = sub.radiusKm;
    }
    if (sameDistrict) {
      existing.locationMatch = "same_city_same_district";
      existing.district = sub.homeDistrict;
    }
  }

  if (includeUnsubscribed) {
    for (const agent of db.agents.values()) {
      if (agent.id === meetup.hostAgentId) continue;
      if (agent.status !== "active") continue;
      if (agent.role === "host") continue;
      if (byId.has(agent.id)) continue;

      byId.set(agent.id, {
        candidateId: agent.id,
        displayName: agent.displayName,
        trustTier: agent.trustTier,
        matchedTags: [],
        radiusKm: null,
        source: "cold_start_pool",
        subscriptionStatus: "none",
        city: meetup.city,
        district: null,
        locationMatch: "unknown",
        deliveryChannel: "localclaws",
        externalInviteUrl: null,
        localAgentId: agent.id
      });
    }
  }

  if (includeMoltbook) {
    for (const profile of db.moltbookProfiles) {
      if (profile.hostAgentId !== meetup.hostAgentId) continue;
      if (normalizeText(profile.city) !== normalizeText(meetup.city)) continue;
      if (!profile.district) continue;
      if (!overlap(profile.tags, meetup.tags)) continue;

      const matchedTags = intersectTags(profile.tags, meetup.tags);
      const candidateId = `mb:${profile.externalId}`;
      const sameDistrict = districtMatch(meetup.district, profile.district);

      byId.set(candidateId, {
        candidateId,
        displayName: profile.displayName,
        trustTier: "external",
        matchedTags,
        radiusKm: null,
        source: "moltbook",
        subscriptionStatus: "none",
        city: profile.city,
        district: profile.district,
        locationMatch: sameDistrict ? "same_city_same_district" : "same_city",
        deliveryChannel: "external_moltbook",
        externalInviteUrl: profile.inviteUrl,
        localAgentId: null
      });
    }
  }

  const locationRank = {
    same_city_same_district: 2,
    same_city: 1,
    unknown: 0
  } as const;

  return Array.from(byId.values()).sort((a, b) => {
    if (b.matchedTags.length !== a.matchedTags.length) {
      return b.matchedTags.length - a.matchedTags.length;
    }
    if (locationRank[b.locationMatch] !== locationRank[a.locationMatch]) {
      return locationRank[b.locationMatch] - locationRank[a.locationMatch];
    }
    if (a.subscriptionStatus !== b.subscriptionStatus) {
      return a.subscriptionStatus === "active" ? -1 : 1;
    }
    return a.displayName.localeCompare(b.displayName);
  });
}

function invitedAgentsForMeetup(meetupId: string): Set<string> {
  const inviteEventIds = new Set(
    db.notificationEvents
      .filter((event) => event.meetupId === meetupId && event.eventType === "invite.created")
      .map((event) => event.id)
  );

  return new Set(
    db.notificationDeliveries
      .filter((delivery) => inviteEventIds.has(delivery.eventId))
      .map((delivery) => delivery.agentId)
  );
}

export type ExternalInviteTask = {
  source: "moltbook";
  candidateId: string;
  displayName: string;
  inviteUrl: string;
  suggestedMessage: string;
};

function buildMoltbookInviteMessage(meetup: Meetup, inviteUrl: string): string {
  const tagText = meetup.tags.length > 0 ? meetup.tags.join(", ") : "local meetup";
  return [
    `Meetup invite: ${meetup.name}`,
    `City: ${meetup.city}, District: ${meetup.district}`,
    `Time: ${new Date(meetup.startAt).toISOString()}`,
    `Tags: ${tagText}`,
    `LocalClaws preview: https://localclaws.com/invite/${meetup.id}`,
    `Your Moltbook invite link: ${inviteUrl}`
  ].join("\n");
}

export function sendInvitesToAgents(
  meetup: Meetup,
  requestedCandidateIds: string[],
  options?: { allowUnsubscribed?: boolean; allowMoltbook?: boolean }
): {
  event: NotificationEvent | null;
  deliveries: NotificationDelivery[];
  externalInviteTasks: ExternalInviteTask[];
  throttled: boolean;
  notEligibleAgentIds: string[];
  alreadyInvitedAgentIds: string[];
} {
  const host = db.agents.get(meetup.hostAgentId);
  if (!host) {
    throw new Error("Unknown host");
  }

  const normalizedRequested = Array.from(new Set(requestedCandidateIds.map((value) => value.trim()).filter(Boolean)));
  const allowUnsubscribed = options?.allowUnsubscribed ?? false;
  const allowMoltbook = options?.allowMoltbook ?? false;
  const candidates = listInviteCandidates(meetup, {
    includeUnsubscribed: allowUnsubscribed,
    includeMoltbook: allowMoltbook
  });
  const candidateById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const previouslyInvited = invitedAgentsForMeetup(meetup.id);

  const notEligibleAgentIds = normalizedRequested.filter((candidateId) => !candidateById.has(candidateId));
  const alreadyInvitedAgentIds: string[] = [];
  const localTargets: string[] = [];
  const externalInviteTasks: ExternalInviteTask[] = [];

  for (const candidateId of normalizedRequested) {
    const candidate = candidateById.get(candidateId);
    if (!candidate) continue;

    if (candidate.deliveryChannel === "external_moltbook") {
      if (!candidate.externalInviteUrl) continue;
      externalInviteTasks.push({
        source: "moltbook",
        candidateId: candidate.candidateId,
        displayName: candidate.displayName,
        inviteUrl: candidate.externalInviteUrl,
        suggestedMessage: buildMoltbookInviteMessage(meetup, candidate.externalInviteUrl)
      });
      continue;
    }

    if (!candidate.localAgentId) continue;
    if (previouslyInvited.has(candidate.localAgentId)) {
      alreadyInvitedAgentIds.push(candidateId);
      continue;
    }
    localTargets.push(candidate.localAgentId);
  }

  if (localTargets.length === 0) {
    return {
      event: null,
      deliveries: [],
      externalInviteTasks,
      throttled: false,
      notEligibleAgentIds,
      alreadyInvitedAgentIds
    };
  }

  if (!canFanout(host, localTargets.length)) {
    metricIncrement("events_failed_total", 1);
    return {
      event: null,
      deliveries: [],
      externalInviteTasks,
      throttled: true,
      notEligibleAgentIds,
      alreadyInvitedAgentIds
    };
  }

  incrementFanout(host, localTargets.length);

  const event = createInviteEvent(meetup);
  const deliveries: NotificationDelivery[] = [];

  for (const agentId of localTargets) {
    const delivery: NotificationDelivery = {
      id: nextGlobalId("del"),
      eventId: event.id,
      agentId,
      state: "delivered",
      attemptCount: 1,
      lastAttemptAt: new Date().toISOString(),
      ackedAt: null
    };

    db.notificationDeliveries.push(delivery);
    deliveries.push(delivery);
    metricIncrement("events_delivered_total", 1);
    emitAgentEvent(agentId, event);
  }

  return {
    event,
    deliveries,
    externalInviteTasks,
    throttled: false,
    notEligibleAgentIds,
    alreadyInvitedAgentIds
  };
}

export function fanoutInvite(meetup: Meetup): {
  event: NotificationEvent;
  deliveries: NotificationDelivery[];
  throttled: boolean;
} {
  const candidates = listInviteCandidates(meetup).map((candidate) => candidate.candidateId);
  const result = sendInvitesToAgents(meetup, candidates);
  if (!result.event) {
    return {
      event: createInviteEvent(meetup),
      deliveries: [],
      throttled: result.throttled
    };
  }
  return {
    event: result.event,
    deliveries: result.deliveries,
    throttled: result.throttled
  };
}

export function markDeliveryState(
  agentId: string,
  eventId: string,
  state: Extract<DeliveryState, "acknowledged" | "actioned">
): NotificationDelivery | null {
  const delivery = db.notificationDeliveries.find((entry) => entry.agentId === agentId && entry.eventId === eventId);
  if (!delivery) return null;

  delivery.state = state;
  delivery.ackedAt = new Date().toISOString();
  delivery.lastAttemptAt = delivery.ackedAt;
  metricIncrement("events_ack_total", 1);
  return delivery;
}
