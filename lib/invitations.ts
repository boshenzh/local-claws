import crypto from "node:crypto";

const PASSCODE_WORDS = [
  "MANGO",
  "LOTUS",
  "NEBULA",
  "GINGER",
  "CLOUD",
  "ORBIT",
  "PEBBLE",
  "SPROUT",
  "SUNRISE",
  "LANTERN",
  "DRAGON",
  "BAMBOO",
  "HARBOR",
  "SAPPHIRE",
  "LOBSTER",
  "BAGAGA"
];

type ParsedInviteId = {
  meetupId: string;
  agentId: string;
};

export function createInviteId(meetupId: string, agentId: string): string {
  return Buffer.from(`${meetupId}:${agentId}`, "utf8").toString("base64url");
}

export function parseInviteId(inviteId: string): ParsedInviteId | null {
  try {
    const decoded = Buffer.from(inviteId, "base64url").toString("utf8");
    const [meetupId, agentId] = decoded.split(":");
    if (!meetupId || !agentId) return null;
    return { meetupId, agentId };
  } catch {
    return null;
  }
}

export function generateInvitationToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function generateFunPasscode(): string {
  const word = PASSCODE_WORDS[Math.floor(Math.random() * PASSCODE_WORDS.length)];
  const number = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `${word}-${number}`;
}

export function hashPasscode(passcode: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(passcode, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPasscode(passcode: string, storedHash: string): boolean {
  const [algorithm, saltB64, expectedB64] = storedHash.split("$");
  if (algorithm !== "scrypt" || !saltB64 || !expectedB64) return false;

  const salt = Buffer.from(saltB64, "base64url");
  const expected = Buffer.from(expectedB64, "base64url");
  const calculated = crypto.scryptSync(passcode, salt, expected.length);
  return crypto.timingSafeEqual(calculated, expected);
}
