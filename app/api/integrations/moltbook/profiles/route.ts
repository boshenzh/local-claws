import { createHash } from "node:crypto";

import { authorizeRequest } from "@/lib/auth";
import { jsonCreated, jsonError, jsonOk } from "@/lib/http";
import { db, ensureStoreReady, persistStore } from "@/lib/store";
import type { MoltbookProfile } from "@/lib/types";

type InputProfile = {
  external_id: string;
  display_name: string;
  city: string;
  district: string;
  tags: string[];
  invite_url: string;
};

function toUniqueLowerTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const set = new Set<string>();
  for (const tag of input) {
    if (typeof tag !== "string") continue;
    const normalized = tag.trim().toLowerCase();
    if (!normalized) continue;
    set.add(normalized);
  }
  return Array.from(set);
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function validateProfile(input: unknown): InputProfile | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;

  const externalId = typeof value.external_id === "string" ? value.external_id.trim() : "";
  const displayName = typeof value.display_name === "string" ? value.display_name.trim() : "";
  const city = typeof value.city === "string" ? value.city.trim().toLowerCase() : "";
  const district = typeof value.district === "string" ? value.district.trim() : "";
  const inviteUrl = typeof value.invite_url === "string" ? value.invite_url.trim() : "";
  const tags = toUniqueLowerTags(value.tags);

  if (!externalId || !displayName || !city || !district || !isHttpUrl(inviteUrl)) {
    return null;
  }

  return {
    external_id: externalId,
    display_name: displayName,
    city,
    district,
    tags,
    invite_url: inviteUrl
  };
}

function profileId(hostAgentId: string, externalId: string): string {
  const hash = createHash("sha1").update(`${hostAgentId}:${externalId}`).digest("hex").slice(0, 16);
  return `mbp_${hash}`;
}

export async function GET(request: Request) {
  await ensureStoreReady();
  const auth = authorizeRequest(request, "meetup:create");
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const profiles = db.moltbookProfiles.filter((profile) => profile.hostAgentId === auth.agent.id);
  return jsonOk({
    source: "moltbook",
    host_agent_id: auth.agent.id,
    count: profiles.length,
    profiles: profiles.map((profile) => ({
      id: profile.id,
      external_id: profile.externalId,
      display_name: profile.displayName,
      city: profile.city,
      district: profile.district,
      tags: profile.tags,
      invite_url: profile.inviteUrl,
      updated_at: profile.updatedAt
    }))
  });
}

export async function POST(request: Request) {
  await ensureStoreReady();
  const body = await request.json().catch(() => null);
  const auth = authorizeRequest(request, "meetup:create", {
    legacyAgentId: typeof body?.agent_id === "string" ? body.agent_id : undefined
  });
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const replace = body?.replace === true;
  const inputProfiles = Array.isArray(body?.profiles) ? body.profiles : [];
  if (inputProfiles.length === 0) {
    return jsonError("profiles must include at least one profile", 400);
  }

  const validated = inputProfiles
    .map(validateProfile)
    .filter((profile: InputProfile | null): profile is InputProfile => profile !== null);
  if (validated.length !== inputProfiles.length) {
    return jsonError("One or more profiles are invalid", 400);
  }

  if (replace) {
    db.moltbookProfiles = db.moltbookProfiles.filter(
      (profile: MoltbookProfile) => profile.hostAgentId !== auth.agent.id
    );
  }

  let created = 0;
  let updated = 0;
  const now = new Date().toISOString();

  for (const profile of validated) {
    const existing = db.moltbookProfiles.find(
      (entry) => entry.hostAgentId === auth.agent.id && entry.externalId === profile.external_id
    );

    if (existing) {
      existing.displayName = profile.display_name;
      existing.city = profile.city;
      existing.district = profile.district;
      existing.tags = profile.tags;
      existing.inviteUrl = profile.invite_url;
      existing.updatedAt = now;
      updated += 1;
      continue;
    }

    const next: MoltbookProfile = {
      id: profileId(auth.agent.id, profile.external_id),
      hostAgentId: auth.agent.id,
      source: "moltbook",
      externalId: profile.external_id,
      displayName: profile.display_name,
      city: profile.city,
      district: profile.district,
      tags: profile.tags,
      inviteUrl: profile.invite_url,
      createdAt: now,
      updatedAt: now
    };
    db.moltbookProfiles.push(next);
    created += 1;
  }

  await persistStore();
  return jsonCreated({
    source: "moltbook",
    host_agent_id: auth.agent.id,
    replaced_existing: replace,
    received: validated.length,
    created,
    updated,
    total_for_host: db.moltbookProfiles.filter((profile) => profile.hostAgentId === auth.agent.id).length
  });
}
