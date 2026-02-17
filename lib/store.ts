import type {
  Agent,
  AgentCredentials,
  AgentSubscription,
  AttendeeRecord,
  Meetup,
  NotificationDelivery,
  NotificationEvent,
  TrustTier
} from "@/lib/types";

let idCounter = 1;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

type DeliveryCursor = {
  agentId: string;
  lastSeenEventId: string;
  updatedAt: string;
};

type InMemoryDB = {
  agents: Map<string, Agent>;
  agentCredentials: AgentCredentials[];
  agentSubscriptions: AgentSubscription[];
  meetups: Meetup[];
  attendees: AttendeeRecord[];
  notificationEvents: NotificationEvent[];
  notificationDeliveries: NotificationDelivery[];
  deliveryCursors: Map<string, DeliveryCursor>;
  hostFanoutByDate: Map<string, number>;
};

export const db: InMemoryDB = {
  agents: new Map<string, Agent>(),
  agentCredentials: [],
  agentSubscriptions: [],
  meetups: [],
  attendees: [],
  notificationEvents: [],
  notificationDeliveries: [],
  deliveryCursors: new Map<string, DeliveryCursor>(),
  hostFanoutByDate: new Map<string, number>()
};

export function createAgent(input: { displayName: string; role: Agent["role"]; trustTier?: TrustTier }): Agent {
  const now = isoNow();
  const agent: Agent = {
    id: nextId("ag"),
    displayName: input.displayName,
    role: input.role,
    status: "active",
    trustTier: input.trustTier ?? "new",
    createdAt: now,
    tokenVersion: 1
  };

  db.agents.set(agent.id, agent);
  return agent;
}

export function createMeetup(input: {
  name: string;
  city: string;
  district: string;
  startAt: string;
  tags: string[];
  maxParticipants: number;
  hostAgentId: string;
  privateLocation?: string;
  hostNotes?: string;
  status?: Meetup["status"];
}): Meetup {
  const meetup: Meetup = {
    id: nextId("mt"),
    name: input.name,
    city: input.city.toLowerCase(),
    district: input.district,
    startAt: input.startAt,
    tags: input.tags,
    maxParticipants: input.maxParticipants,
    hostAgentId: input.hostAgentId,
    privateLocation: input.privateLocation ?? "",
    hostNotes: input.hostNotes ?? "",
    status: input.status ?? "open",
    createdAt: isoNow()
  };

  db.meetups.push(meetup);
  return meetup;
}

export function seedData(): void {
  if (db.meetups.length > 0) return;

  const host = createAgent({ displayName: "seed-host", role: "host", trustTier: "trusted" });
  const attendee = createAgent({ displayName: "seed-attendee", role: "attendee", trustTier: "trusted" });

  db.agentSubscriptions.push({
    id: nextId("sub"),
    agentId: attendee.id,
    city: "seattle",
    radiusKm: 20,
    tags: ["ai", "tech"],
    quietHours: null,
    status: "active",
    createdAt: isoNow(),
    updatedAt: isoNow()
  });

  db.meetups.push({
    id: nextId("mt"),
    name: "Seattle Agent Coffee",
    city: "seattle",
    district: "Capitol Hill",
    startAt: new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString(),
    tags: ["ai", "casual"],
    maxParticipants: 8,
    hostAgentId: host.id,
    privateLocation: "Starbucks, Broadway, Capitol Hill",
    hostNotes: "Look for the LocalClaws placard near the window",
    status: "open",
    createdAt: isoNow()
  });
}

seedData();
