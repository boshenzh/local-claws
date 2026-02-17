export type AgentRole = "host" | "attendee" | "both";
export type AgentStatus = "active" | "revoked";
export type TrustTier = "new" | "trusted" | "high_trust";

export type Agent = {
  id: string;
  displayName: string;
  role: AgentRole;
  status: AgentStatus;
  trustTier: TrustTier;
  createdAt: string;
  tokenVersion: number;
};

export type AgentCredentials = {
  agentId: string;
  keyId: string;
  publicKey: string;
  revokedAt: string | null;
};

export type QuietHours = {
  start: string;
  end: string;
  tz: string;
};

export type AgentSubscription = {
  id: string;
  agentId: string;
  city: string;
  radiusKm: number;
  tags: string[];
  quietHours: QuietHours | null;
  status: "active" | "paused";
  createdAt: string;
  updatedAt: string;
};

export type Meetup = {
  id: string;
  name: string;
  city: string;
  district: string;
  startAt: string;
  tags: string[];
  maxParticipants: number;
  hostAgentId: string;
  privateLocation: string;
  hostNotes: string;
  status: "open" | "closed" | "canceled" | "quarantined";
  createdAt: string;
};

export type AttendeeRecord = {
  id: string;
  meetupId: string;
  agentId: string;
  inviteId: string;
  invitationToken: string | null;
  passcodeHash: string | null;
  passcodeIssuedAt: string | null;
  failedAttempts: number;
  failedWindowStart: string | null;
  totalFailures: number;
  lockedUntil: string | null;
  confirmedAt: string | null;
  status: "confirmed" | "withdrawn";
  createdAt: string;
};

export type NotificationEventType =
  | "invite.created"
  | "invite.updated"
  | "invite.withdrawn"
  | "system.notice";

export type NotificationEventPayload = {
  meetupId: string;
  city: string;
  district: string;
  startAt: string;
  tags: string[];
  publicUrl: string;
};

export type NotificationEvent = {
  id: string;
  meetupId: string;
  eventType: NotificationEventType;
  payload: NotificationEventPayload;
  createdAt: string;
};

export type DeliveryState =
  | "queued"
  | "delivered"
  | "acknowledged"
  | "actioned"
  | "retrying"
  | "failed_dead_letter";

export type NotificationDelivery = {
  id: string;
  eventId: string;
  agentId: string;
  state: DeliveryState;
  attemptCount: number;
  lastAttemptAt: string;
  ackedAt: string | null;
};

export type LegacyModeConfig = {
  enabled: boolean;
  cutoffDate: string;
  allowlist: string[];
};

export type AgentClaims = {
  sub: string;
  role: AgentRole;
  scopes: string[];
  tokenVersion: number;
  iat: number;
  exp: number;
};
