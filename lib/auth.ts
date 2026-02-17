import crypto from "node:crypto";

import { LEGACY_MODE } from "@/lib/constants";
import { db } from "@/lib/store";
import type { Agent, AgentClaims } from "@/lib/types";

const JWT_SECRET = process.env.LOCALCLAWS_JWT_SECRET ?? "localclaws-dev-secret";

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
}

export function mintToken(claims: Omit<AgentClaims, "iat" | "exp">, ttlSeconds = 60 * 60 * 24 * 30): string {
  const now = Math.floor(Date.now() / 1000);
  const fullClaims: AgentClaims = {
    ...claims,
    iat: now,
    exp: now + ttlSeconds
  };
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify(fullClaims));
  const signature = sign(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): AgentClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expected = sign(`${header}.${payload}`);
  if (signature !== expected) return null;

  try {
    const claims = base64UrlDecode<AgentClaims>(payload);
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp < now) return null;
    return claims;
  } catch {
    return null;
  }
}

function hasScope(scopes: string[], required: string): boolean {
  return scopes.includes(required);
}

export type AuthResult =
  | { ok: true; agent: Agent; legacy: boolean }
  | { ok: false; status: number; error: string };

export function authorizeRequest(
  request: Request,
  requiredScope: string,
  opts?: { legacyAgentId?: string | undefined }
): AuthResult {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    const claims = verifyToken(token);
    if (!claims) {
      return { ok: false, status: 401, error: "Invalid token" };
    }

    const agent = db.agents.get(claims.sub);
    if (!agent || agent.status !== "active") {
      return { ok: false, status: 401, error: "Unknown or inactive agent" };
    }

    if (agent.tokenVersion !== claims.tokenVersion) {
      return { ok: false, status: 401, error: "Token revoked" };
    }

    if (!hasScope(claims.scopes, requiredScope)) {
      return { ok: false, status: 403, error: "Missing required scope" };
    }

    return { ok: true, agent, legacy: false };
  }

  const legacyAgentId = opts?.legacyAgentId;
  if (!LEGACY_MODE.enabled || !legacyAgentId) {
    return { ok: false, status: 401, error: "Missing bearer token" };
  }
  if (new Date().toISOString() > LEGACY_MODE.cutoffDate) {
    return { ok: false, status: 403, error: "Legacy mode cutoff has passed" };
  }

  if (!LEGACY_MODE.allowlist.includes(legacyAgentId)) {
    return { ok: false, status: 403, error: "Legacy mode disabled for this agent" };
  }

  const agent = db.agents.get(legacyAgentId);
  if (!agent || agent.status !== "active") {
    return { ok: false, status: 401, error: "Unknown legacy agent" };
  }

  return { ok: true, agent, legacy: true };
}
