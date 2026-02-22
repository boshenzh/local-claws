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
  homeDistrict: string | null;
  radiusKm: number;
  tags: string[];
  quietHours: QuietHours | null;
  status: "active" | "paused";
  createdAt: string;
  updatedAt: string;
};

export type HostAlertConfig = {
  hostAgentId: string;
  enabled: boolean;
  clawdbotWebhookUrl: string;
  telegramChatId: string;
  telegramThreadId: string | null;
  updatedAt: string;
};

export type MoltbookProfile = {
  id: string;
  hostAgentId: string;
  source: "moltbook";
  externalId: string;
  displayName: string;
  city: string;
  district: string;
  tags: string[];
  inviteUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type PrivateLocationProvider = "google_maps" | "apple_maps" | "amap" | "other";
export type PrivateLocationParseStatus = "parsed_exact" | "parsed_partial" | "unresolved";

export type Meetup = {
  id: string;
  name: string;
  city: string;
  district: string;
  publicRadiusKm: number;
  startAt: string;
  tags: string[];
  maxParticipants: number;
  hostAgentId: string;
  privateLocation: string;
  privateLocationLink?: string;
  privateLocationProvider?: PrivateLocationProvider | null;
  privateLocationProviderHost?: string;
  privateLocationLabel?: string;
  privateLocationLat?: number | null;
  privateLocationLon?: number | null;
  privateLocationParseStatus?: PrivateLocationParseStatus;
  privateLocationNote?: string;
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

export type JoinRequestStatus = "pending" | "approved" | "declined" | "canceled";

export type JoinRequest = {
  id: string;
  meetupId: string;
  hostAgentId: string;
  attendeeAgentId: string;
  status: JoinRequestStatus;
  note: string | null;
  createdAt: string;
  decidedAt: string | null;
  decidedByAgentId: string | null;
  decisionReason: string | null;
  hostAlertStatus: "pending" | "sent" | "failed";
  hostAlertError: string | null;
};

export type NotificationEventType =
  | "invite.created"
  | "invite.updated"
  | "invite.withdrawn"
  | "join.requested"
  | "join.approved"
  | "join.declined"
  | "system.notice";

export type InviteNotificationPayload = {
  meetupId: string;
  city: string;
  district: string;
  startAt: string;
  tags: string[];
  publicUrl: string;
};

export type JoinRequestedNotificationPayload = {
  requestId: string;
  meetupId: string;
  attendeeAgentId: string;
  attendeeDisplayName: string;
  city: string;
  district: string;
  startAt: string;
  tags: string[];
  note: string | null;
};

export type JoinDecisionNotificationPayload = {
  requestId: string;
  meetupId: string;
  status: "approved" | "declined";
  reason: string | null;
  invitationUrl: string | null;
  inviteUrl: string | null;
  passcode: string | null;
};

export type SystemNoticeNotificationPayload = {
  message: string;
};

export type NotificationEventPayload =
  | InviteNotificationPayload
  | JoinRequestedNotificationPayload
  | JoinDecisionNotificationPayload
  | SystemNoticeNotificationPayload;

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
