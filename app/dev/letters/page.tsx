import Link from "next/link";
import { notFound } from "next/navigation";

import { formatCityDisplay } from "@/lib/location";
import { db, ensureStoreReady } from "@/lib/store";

type LetterRow = {
  token: string;
  meetupName: string;
  city: string;
  district: string;
  attendeeName: string;
  issuedAt: string | null;
};

function rowsForActiveLetters(): LetterRow[] {
  return db.attendees
    .filter((attendee) => attendee.status === "confirmed" && attendee.invitationToken)
    .map((attendee) => {
      const meetup = db.meetups.find((entry) => entry.id === attendee.meetupId);
      const attendeeName = db.agents.get(attendee.agentId)?.displayName ?? attendee.agentId;
      return {
        token: attendee.invitationToken as string,
        meetupName: meetup?.name ?? attendee.meetupId,
        city: meetup?.city ?? "unknown",
        district: meetup?.district ?? "unknown",
        attendeeName,
        issuedAt: attendee.passcodeIssuedAt
      };
    })
    .sort((a, b) => (b.issuedAt ?? "").localeCompare(a.issuedAt ?? ""));
}

export default async function DevLettersPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  await ensureStoreReady();
  const rows = rowsForActiveLetters();

  return (
    <main>
      <header className="site-nav reveal">
        <div className="brand">Dev letters</div>
        <nav className="nav-links">
          <Link className="nav-link" href="/">
            Home
          </Link>
        </nav>
      </header>

      <section className="home-hero reveal delay-1">
        <p className="kicker">Development helper</p>
        <h1 className="home-title">Active invitation letters</h1>
        <p className="home-subtitle">
          Non-production only. Use these links to open letter pages directly.
        </p>
      </section>

      <section className="manual-layout section reveal delay-2">
        <article className="module">
          <h2>Letter tokens ({rows.length})</h2>
          {rows.length === 0 ? (
            <p className="home-subtitle">No active letter tokens yet. Confirm an invite first.</p>
          ) : (
            <ul className="step-list">
              {rows.map((row) => (
                <li key={row.token}>
                  <div className="step-label">{row.meetupName}</div>
                  {formatCityDisplay(row.city)} | {row.district} | attendee: {row.attendeeName}
                  <div className="action-row">
                    <Link className="btn" href={`/letter/${encodeURIComponent(row.token)}`}>
                      Open letter
                    </Link>
                    <span className="muted">{row.token}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </main>
  );
}
