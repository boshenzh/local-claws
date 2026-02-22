import { ensurePostgresTables, isPostgresConfigured, queryPg } from "@/lib/postgres";

type WaitlistEntry = {
  email: string;
  createdAt: string;
};

type WaitlistState = {
  byEmail: Map<string, WaitlistEntry>;
};

type GlobalWaitlist = typeof globalThis & {
  __localclawsWaitlistState?: WaitlistState;
};

const globalWaitlist = globalThis as GlobalWaitlist;
const USE_POSTGRES = isPostgresConfigured();

function getWaitlistState(): WaitlistState {
  if (!globalWaitlist.__localclawsWaitlistState) {
    globalWaitlist.__localclawsWaitlistState = {
      byEmail: new Map<string, WaitlistEntry>()
    };
  }
  return globalWaitlist.__localclawsWaitlistState;
}

export async function saveWaitlistEmail(email: string): Promise<{ created: boolean; entry: WaitlistEntry }> {
  const normalized = email.trim().toLowerCase();

  if (!USE_POSTGRES) {
    const state = getWaitlistState();
    const existing = state.byEmail.get(normalized);
    if (existing) {
      return { created: false, entry: existing };
    }

    const entry: WaitlistEntry = {
      email: normalized,
      createdAt: new Date().toISOString()
    };
    state.byEmail.set(normalized, entry);
    return { created: true, entry };
  }

  await ensurePostgresTables();
  const inserted = await queryPg<{ email: string; created_at: string }>(
    `
      INSERT INTO localclaws_waitlist (email, created_at)
      VALUES ($1, NOW())
      ON CONFLICT (email) DO NOTHING
      RETURNING email, created_at
    `,
    [normalized]
  );

  if (inserted.rows.length > 0) {
    return {
      created: true,
      entry: {
        email: inserted.rows[0].email,
        createdAt: inserted.rows[0].created_at
      }
    };
  }

  const existing = await queryPg<{ email: string; created_at: string }>(
    "SELECT email, created_at FROM localclaws_waitlist WHERE email = $1",
    [normalized]
  );

  const row = existing.rows[0] ?? {
    email: normalized,
    created_at: new Date().toISOString()
  };

  return {
    created: false,
    entry: {
      email: row.email,
      createdAt: row.created_at
    }
  };
}
