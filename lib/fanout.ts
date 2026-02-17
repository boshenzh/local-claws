import { TRUST_TIER_DAILY_FANOUT } from "@/lib/constants";
import { emitAgentEvent } from "@/lib/events";
import { metricIncrement } from "@/lib/metrics";
import { db } from "@/lib/store";
import type {
  Agent,
  DeliveryState,
  Meetup,
  NotificationDelivery,
  NotificationEvent,
  NotificationEventPayload
} from "@/lib/types";

let eventCounter = 1000;
let deliveryCounter = 2000;

function nextEventId(): string {
  eventCounter += 1;
  return `evt_${eventCounter}`;
}

function nextDeliveryId(): string {
  deliveryCounter += 1;
  return `del_${deliveryCounter}`;
}

function overlap(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return true;
  const set = new Set(a.map((value) => value.toLowerCase()));
  return b.some((value) => set.has(value.toLowerCase()));
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

export function createInviteEvent(meetup: Meetup): NotificationEvent {
  const payload: NotificationEventPayload = {
    meetupId: meetup.id,
    city: meetup.city,
    district: meetup.district,
    startAt: meetup.startAt,
    tags: meetup.tags,
    publicUrl: `/meetups/${meetup.id}`
  };

  const event: NotificationEvent = {
    id: nextEventId(),
    meetupId: meetup.id,
    eventType: "invite.created",
    payload,
    createdAt: new Date().toISOString()
  };

  db.notificationEvents.push(event);
  metricIncrement("events_created_total", 1);
  return event;
}

export function fanoutInvite(meetup: Meetup): {
  event: NotificationEvent;
  deliveries: NotificationDelivery[];
  throttled: boolean;
} {
  const host = db.agents.get(meetup.hostAgentId);
  if (!host) {
    throw new Error("Unknown host");
  }

  const targets = db.agentSubscriptions
    .filter((sub) => sub.status === "active")
    .filter((sub) => sub.city.toLowerCase() === meetup.city.toLowerCase())
    .filter((sub) => overlap(sub.tags, meetup.tags))
    .map((sub) => sub.agentId);

  if (!canFanout(host, targets.length)) {
    metricIncrement("events_failed_total", 1);
    return { event: createInviteEvent(meetup), deliveries: [], throttled: true };
  }

  incrementFanout(host, targets.length);

  const event = createInviteEvent(meetup);
  const deliveries: NotificationDelivery[] = [];

  for (const agentId of targets) {
    const delivery: NotificationDelivery = {
      id: nextDeliveryId(),
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

  return { event, deliveries, throttled: false };
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
