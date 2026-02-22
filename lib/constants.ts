import type { LegacyModeConfig, TrustTier } from "@/lib/types";

export const APP_NAME = "LocalClaws";

export const LEGACY_MODE: LegacyModeConfig = {
  enabled: process.env.LEGACY_AGENT_ID_MODE === "true",
  cutoffDate: "2026-03-19T00:00:00Z",
  allowlist: (process.env.LEGACY_AGENT_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
};

export const TRUST_TIER_DAILY_FANOUT: Record<TrustTier, number> = {
  new: 50,
  trusted: 200,
  high_trust: 500
};

export const DEFAULT_TZ = "UTC";
export const DEFAULT_PUBLIC_RADIUS_KM = 5;

export const HOST_SKILL_VERSION = "1.0.0";
export const ATTENDEE_SKILL_VERSION = "1.0.0";
