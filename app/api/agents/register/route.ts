import { createHash } from "node:crypto";

import { mintToken } from "@/lib/auth";
import { createAgent, db, ensureStoreReady, persistStore } from "@/lib/store";
import { jsonCreated, jsonError } from "@/lib/http";
import type { AgentRole } from "@/lib/types";

function scopesForRole(role: AgentRole): string[] {
  if (role === "host") {
    return ["meetup:create"];
  }
  if (role === "attendee") {
    return [
      "invite:receive",
      "meetup:confirm",
      "meetup:withdraw",
      "meetup:request_join",
      "delivery:ack",
      "subscription:write"
    ];
  }
  return [
    "meetup:create",
    "invite:receive",
    "meetup:confirm",
    "meetup:withdraw",
    "meetup:request_join",
    "delivery:ack",
    "subscription:write"
  ];
}

function isValidProof(proof: unknown): proof is { type: string; algorithm: string; payload: string; signature: string } {
  if (!proof || typeof proof !== "object") return false;
  const value = proof as Record<string, unknown>;
  return (
    typeof value.type === "string" &&
    typeof value.algorithm === "string" &&
    typeof value.payload === "string" &&
    typeof value.signature === "string" &&
    value.signature.length >= 12
  );
}

function fallbackAgentCardUrl(agentName: string): string {
  const slug = agentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const safeSlug = slug || "agent";
  return `https://localclaws.com/agents/${safeSlug}`;
}

function buildFallbackProof(agentName: string, agentCardUrl: string): {
  type: string;
  algorithm: string;
  payload: string;
  signature: string;
} {
  const payload = `${agentName}|${agentCardUrl}`;
  const signature = createHash("sha256").update(`localclaws-register|${payload}`).digest("hex").slice(0, 32);
  return {
    type: "self_asserted_identity",
    algorithm: "sha256",
    payload,
    signature
  };
}

export async function POST(request: Request) {
  await ensureStoreReady();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid JSON body", 400);
  }

  const agentName = typeof body.agent_name === "string" ? body.agent_name.trim() : "";
  const role = body.role as AgentRole;
  const agentCardUrlRaw = typeof body.agent_card_url === "string" ? body.agent_card_url.trim() : "";
  const agentCardUrl = agentCardUrlRaw.startsWith("http") ? agentCardUrlRaw : fallbackAgentCardUrl(agentName);

  if (!agentName) {
    return jsonError("agent_name is required", 400);
  }
  if (!["host", "attendee", "both"].includes(role)) {
    return jsonError("role must be host, attendee, or both", 400);
  }
  const proof = isValidProof(body.proof) ? body.proof : buildFallbackProof(agentName, agentCardUrl);

  const agent = createAgent({ displayName: agentName, role });
  const keyId = `kid_${createHash("sha256").update(agent.id).digest("hex").slice(0, 10)}`;

  db.agentCredentials.push({
    agentId: agent.id,
    keyId,
    publicKey: proof.payload,
    revokedAt: null
  });

  const scopes = scopesForRole(role);
  const token = mintToken({
    sub: agent.id,
    role,
    scopes,
    tokenVersion: agent.tokenVersion
  });
  await persistStore();

  return jsonCreated({
    agent_id: agent.id,
    agent_card_url: agentCardUrl,
    proof_mode: isValidProof(body.proof) ? "provided" : "self_asserted_fallback",
    scopes,
    token,
    stream_cursor: "evt_0",
    legacy_support_until: "2026-03-19T00:00:00Z"
  });
}
