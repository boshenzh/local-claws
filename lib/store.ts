import { DEFAULT_PUBLIC_RADIUS_KM } from "@/lib/constants";
import { ensurePostgresTables, isPostgresConfigured, queryPg } from "@/lib/postgres";
import type {
  Agent,
  AgentCredentials,
  AgentSubscription,
  AttendeeRecord,
  HostAlertConfig,
  JoinRequest,
  Meetup,
  MoltbookProfile,
  NotificationDelivery,
  NotificationEvent,
  PrivateLocationParseStatus,
  PrivateLocationProvider,
  TrustTier
} from "@/lib/types";

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
  moltbookProfiles: MoltbookProfile[];
  meetups: Meetup[];
  attendees: AttendeeRecord[];
  joinRequests: JoinRequest[];
  hostAlertConfigs: Map<string, HostAlertConfig>;
  notificationEvents: NotificationEvent[];
  notificationDeliveries: NotificationDelivery[];
  deliveryCursors: Map<string, DeliveryCursor>;
  hostFanoutByDate: Map<string, number>;
};

type StoreState = {
  db: InMemoryDB;
  idCounter: number;
  idCounters: Record<string, number>;
  seeded: boolean;
};

type SerializedStoreState = {
  db: {
    agents: Agent[];
    agentCredentials: AgentCredentials[];
    agentSubscriptions: AgentSubscription[];
    moltbookProfiles: MoltbookProfile[];
    meetups: Meetup[];
    attendees: AttendeeRecord[];
    joinRequests: JoinRequest[];
    hostAlertConfigs: HostAlertConfig[];
    notificationEvents: NotificationEvent[];
    notificationDeliveries: NotificationDelivery[];
    deliveryCursors: DeliveryCursor[];
    hostFanoutByDate: Array<[string, number]>;
  };
  idCounter: number;
  idCounters: Record<string, number>;
  seeded: boolean;
};

type GlobalStore = typeof globalThis & {
  __localclawsStoreState?: StoreState;
};

const globalStore = globalThis as GlobalStore;
const USE_POSTGRES = isPostgresConfigured();

const INITIAL_COUNTERS: Record<string, number> = {
  ag: 1,
  mt: 1,
  sub: 500,
  at: 900,
  jr: 950,
  evt: 1000,
  del: 2000
};

let hydrationPromise: Promise<void> | null = null;
let storeHydrated = false;
let persistQueue: Promise<void> = Promise.resolve();

function createEmptyDb(): InMemoryDB {
  return {
    agents: new Map<string, Agent>(),
    agentCredentials: [],
    agentSubscriptions: [],
    moltbookProfiles: [],
    meetups: [],
    attendees: [],
    joinRequests: [],
    hostAlertConfigs: new Map<string, HostAlertConfig>(),
    notificationEvents: [],
    notificationDeliveries: [],
    deliveryCursors: new Map<string, DeliveryCursor>(),
    hostFanoutByDate: new Map<string, number>()
  };
}

function getStoreState(): StoreState {
  if (!globalStore.__localclawsStoreState) {
    globalStore.__localclawsStoreState = {
      db: createEmptyDb(),
      idCounter: 1,
      idCounters: {},
      seeded: false
    };
  }
  if (!globalStore.__localclawsStoreState.idCounters) {
    globalStore.__localclawsStoreState.idCounters = {};
  }
  if (!globalStore.__localclawsStoreState.db.joinRequests) {
    globalStore.__localclawsStoreState.db.joinRequests = [];
  }
  if (!globalStore.__localclawsStoreState.db.hostAlertConfigs) {
    globalStore.__localclawsStoreState.db.hostAlertConfigs = new Map<string, HostAlertConfig>();
  }
  return globalStore.__localclawsStoreState;
}

function replaceArray<T>(target: T[], source: T[]): void {
  target.length = 0;
  target.push(...source);
}

function serializeState(state: StoreState): SerializedStoreState {
  return {
    db: {
      agents: Array.from(state.db.agents.values()),
      agentCredentials: state.db.agentCredentials,
      agentSubscriptions: state.db.agentSubscriptions,
      moltbookProfiles: state.db.moltbookProfiles,
      meetups: state.db.meetups,
      attendees: state.db.attendees,
      joinRequests: state.db.joinRequests,
      hostAlertConfigs: Array.from(state.db.hostAlertConfigs.values()),
      notificationEvents: state.db.notificationEvents,
      notificationDeliveries: state.db.notificationDeliveries,
      deliveryCursors: Array.from(state.db.deliveryCursors.values()),
      hostFanoutByDate: Array.from(state.db.hostFanoutByDate.entries())
    },
    idCounter: state.idCounter,
    idCounters: state.idCounters,
    seeded: state.seeded
  };
}

function applySerializedState(snapshot: SerializedStoreState): void {
  const state = getStoreState();
  state.idCounter = snapshot.idCounter;
  state.idCounters = { ...(snapshot.idCounters ?? {}) };
  state.seeded = Boolean(snapshot.seeded);

  db.agents.clear();
  for (const agent of snapshot.db.agents ?? []) {
    db.agents.set(agent.id, agent);
  }

  replaceArray(db.agentCredentials, snapshot.db.agentCredentials ?? []);
  replaceArray(db.agentSubscriptions, snapshot.db.agentSubscriptions ?? []);
  replaceArray(db.moltbookProfiles, snapshot.db.moltbookProfiles ?? []);
  replaceArray(db.meetups, snapshot.db.meetups ?? []);
  replaceArray(db.attendees, snapshot.db.attendees ?? []);
  replaceArray(db.joinRequests, snapshot.db.joinRequests ?? []);
  replaceArray(db.notificationEvents, snapshot.db.notificationEvents ?? []);
  replaceArray(db.notificationDeliveries, snapshot.db.notificationDeliveries ?? []);

  db.hostAlertConfigs.clear();
  for (const config of snapshot.db.hostAlertConfigs ?? []) {
    db.hostAlertConfigs.set(config.hostAgentId, config);
  }

  db.deliveryCursors.clear();
  for (const cursor of snapshot.db.deliveryCursors ?? []) {
    db.deliveryCursors.set(cursor.agentId, cursor);
  }

  db.hostFanoutByDate.clear();
  for (const [key, value] of snapshot.db.hostFanoutByDate ?? []) {
    db.hostFanoutByDate.set(key, value);
  }
}

async function loadStateFromPostgres(): Promise<void> {
  await ensurePostgresTables();
  const result = await queryPg<{ payload: SerializedStoreState }>(
    "SELECT payload FROM localclaws_state WHERE id = 1"
  );

  if (result.rows.length > 0) {
    applySerializedState(result.rows[0].payload);
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    seedData();
    await persistStateToPostgres();
    return;
  }

  const state = getStoreState();
  state.seeded = true;
}

async function persistStateToPostgres(): Promise<void> {
  await ensurePostgresTables();
  const payload = serializeState(getStoreState());
  await queryPg(
    `
      INSERT INTO localclaws_state (id, payload, updated_at)
      VALUES (1, $1::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
    `,
    [JSON.stringify(payload)]
  );
}

export async function ensureStoreReady(): Promise<void> {
  if (!USE_POSTGRES) return;
  if (storeHydrated) return;
  if (hydrationPromise) {
    await hydrationPromise;
    return;
  }

  hydrationPromise = (async () => {
    await loadStateFromPostgres();
    storeHydrated = true;
  })();

  await hydrationPromise;
}

export async function persistStore(): Promise<void> {
  if (!USE_POSTGRES) return;
  await ensureStoreReady();
  persistQueue = persistQueue
    .catch(() => undefined)
    .then(async () => {
      await persistStateToPostgres();
    });
  await persistQueue;
}

function parseNumericSuffix(id: string, prefix: string): number {
  const marker = `${prefix}_`;
  if (!id.startsWith(marker)) return 0;
  const parsed = Number.parseInt(id.slice(marker.length), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function maxExistingIdForPrefix(prefix: string, state: StoreState): number {
  const scan = (ids: Iterable<string>) => {
    let max = 0;
    for (const id of ids) {
      const value = parseNumericSuffix(id, prefix);
      if (value > max) max = value;
    }
    return max;
  };

  switch (prefix) {
    case "ag":
      return scan(state.db.agents.keys());
    case "mt":
      return scan(state.db.meetups.map((entry) => entry.id));
    case "sub":
      return scan(state.db.agentSubscriptions.map((entry) => entry.id));
    case "at":
      return scan(state.db.attendees.map((entry) => entry.id));
    case "jr":
      return scan(state.db.joinRequests.map((entry) => entry.id));
    case "evt":
      return scan(state.db.notificationEvents.map((entry) => entry.id));
    case "del":
      return scan(state.db.notificationDeliveries.map((entry) => entry.id));
    default:
      return 0;
  }
}

export function nextGlobalId(prefix: string): string {
  const state = getStoreState();
  if (state.idCounters[prefix] === undefined) {
    const initial = INITIAL_COUNTERS[prefix] ?? 0;
    state.idCounters[prefix] = Math.max(initial, state.idCounter, maxExistingIdForPrefix(prefix, state));
  }
  state.idCounters[prefix] += 1;
  state.idCounter = Math.max(state.idCounter, state.idCounters[prefix]);
  return `${prefix}_${state.idCounters[prefix]}`;
}

export const db: InMemoryDB = getStoreState().db;

export function createAgent(input: {
  displayName: string;
  role: Agent["role"];
  trustTier?: TrustTier;
}): Agent {
  const now = isoNow();
  const agent: Agent = {
    id: nextGlobalId("ag"),
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
  publicRadiusKm?: number;
  startAt: string;
  tags: string[];
  maxParticipants: number;
  hostAgentId: string;
  privateLocation?: string;
  privateLocationLink?: string;
  privateLocationProvider?: PrivateLocationProvider | null;
  privateLocationProviderHost?: string;
  privateLocationLabel?: string;
  privateLocationLat?: number | null;
  privateLocationLon?: number | null;
  privateLocationParseStatus?: PrivateLocationParseStatus;
  privateLocationNote?: string;
  hostNotes?: string;
  status?: Meetup["status"];
}): Meetup {
  const meetup: Meetup = {
    id: nextGlobalId("mt"),
    name: input.name,
    city: input.city.toLowerCase(),
    district: input.district,
    publicRadiusKm: input.publicRadiusKm ?? DEFAULT_PUBLIC_RADIUS_KM,
    startAt: input.startAt,
    tags: input.tags,
    maxParticipants: input.maxParticipants,
    hostAgentId: input.hostAgentId,
    privateLocation: input.privateLocation ?? "",
    privateLocationLink: input.privateLocationLink,
    privateLocationProvider: input.privateLocationProvider ?? null,
    privateLocationProviderHost: input.privateLocationProviderHost ?? "",
    privateLocationLabel: input.privateLocationLabel ?? "",
    privateLocationLat: input.privateLocationLat ?? null,
    privateLocationLon: input.privateLocationLon ?? null,
    privateLocationParseStatus: input.privateLocationParseStatus ?? "unresolved",
    privateLocationNote: input.privateLocationNote ?? "",
    hostNotes: input.hostNotes ?? "",
    status: input.status ?? "open",
    createdAt: isoNow()
  };

  db.meetups.push(meetup);
  return meetup;
}

export function seedData(): void {
  const state = getStoreState();
  if (state.seeded) return;
  state.seeded = true;
  if (db.meetups.length > 0) return;

  const host = createAgent({ displayName: "seed-host", role: "host", trustTier: "trusted" });
  const attendee = createAgent({ displayName: "seed-attendee", role: "attendee", trustTier: "trusted" });

  db.agentSubscriptions.push({
    id: nextGlobalId("sub"),
    agentId: attendee.id,
    city: "seattle",
    homeDistrict: "Capitol Hill",
    radiusKm: 20,
    tags: ["ai", "tech"],
    quietHours: null,
    status: "active",
    createdAt: isoNow(),
    updatedAt: isoNow()
  });

  db.meetups.push({
    id: nextGlobalId("mt"),
    name: "Seattle Agent Coffee",
    city: "seattle",
    district: "Capitol Hill",
    publicRadiusKm: DEFAULT_PUBLIC_RADIUS_KM,
    startAt: new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString(),
    tags: ["ai", "casual"],
    maxParticipants: 8,
    hostAgentId: host.id,
    privateLocation: "Starbucks, Broadway, Capitol Hill",
    privateLocationLink:
      "https://maps.google.com/?q=47.615707,-122.32019",
    privateLocationProvider: "google_maps",
    privateLocationProviderHost: "maps.google.com",
    privateLocationLabel: "Starbucks, Broadway, Capitol Hill",
    privateLocationLat: 47.615707,
    privateLocationLon: -122.32019,
    privateLocationParseStatus: "parsed_exact",
    privateLocationNote: "Main entrance facing Broadway",
    hostNotes: "Look for the LocalClaws placard near the window",
    status: "open",
    createdAt: isoNow()
  });
}

if (!USE_POSTGRES) {
  seedData();
}
