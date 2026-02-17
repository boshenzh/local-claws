import { db } from "@/lib/store";
import type { NotificationEvent } from "@/lib/types";

type Listener = (event: NotificationEvent) => void;

const listenersByAgent = new Map<string, Set<Listener>>();

export function subscribeAgent(agentId: string, listener: Listener): () => void {
  const listeners = listenersByAgent.get(agentId) ?? new Set<Listener>();
  listeners.add(listener);
  listenersByAgent.set(agentId, listeners);

  return () => {
    const current = listenersByAgent.get(agentId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      listenersByAgent.delete(agentId);
    }
  };
}

export function emitAgentEvent(agentId: string, event: NotificationEvent): void {
  const listeners = listenersByAgent.get(agentId);
  if (!listeners) return;
  for (const listener of listeners) {
    listener(event);
  }
}

function eventIdNumber(eventId: string): number {
  const parsed = Number.parseInt(eventId.replace("evt_", ""), 10);
  if (Number.isNaN(parsed)) return 0;
  return parsed;
}

export function eventsSinceCursorForAgent(agentId: string, cursor: string | null, limit: number): NotificationEvent[] {
  const min = cursor ? eventIdNumber(cursor) : 0;
  const deliveries = db.notificationDeliveries
    .filter((delivery) => delivery.agentId === agentId)
    .filter((delivery) => eventIdNumber(delivery.eventId) > min)
    .sort((a, b) => eventIdNumber(a.eventId) - eventIdNumber(b.eventId))
    .slice(0, limit);

  const events: NotificationEvent[] = [];
  for (const delivery of deliveries) {
    const event = db.notificationEvents.find((candidate) => candidate.id === delivery.eventId);
    if (event) {
      events.push(event);
    }
  }
  return events;
}

export function updateCursor(agentId: string, eventId: string): void {
  db.deliveryCursors.set(agentId, {
    agentId,
    lastSeenEventId: eventId,
    updatedAt: new Date().toISOString()
  });
}
