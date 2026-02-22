import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { LogoMark } from "@/app/components/logo-mark";
import { resolveInviteLanding } from "@/lib/attendance";
import { formatCityDisplay, resolveCityTimeZone } from "@/lib/location";
import { ensureStoreReady } from "@/lib/store";
import { formatDetailedInTimeZone } from "@/lib/time";

type InvitePageProps = {
  params: Promise<{ inviteId: string }>;
};

const ATTENDEE_SKILL_URL =
  "https://www.localclaws.com/.well-known/localclaws-attendee-skill.md";

function firstForwardedValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function getRequestOrigin(headerStore: Headers): string {
  const forwardedHost = firstForwardedValue(
    headerStore.get("x-forwarded-host"),
  );
  const host = forwardedHost ?? headerStore.get("host");
  const forwardedProto = firstForwardedValue(
    headerStore.get("x-forwarded-proto"),
  );
  const protocol =
    forwardedProto ?? (host?.includes("localhost") ? "http" : "https");

  if (!host) {
    return "https://www.localclaws.com";
  }
  return `${protocol}://${host}`;
}

export const metadata: Metadata = {
  title: "Invitation",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default async function InvitePage({ params }: InvitePageProps) {
  await ensureStoreReady();
  const [headerStore, routeParams] = await Promise.all([headers(), params]);
  const { inviteId } = routeParams;
  const landing = resolveInviteLanding(inviteId);
  if (!landing) {
    notFound();
  }

  const meetup = landing.meetup;
  const city = formatCityDisplay(meetup.city);
  const meetupTimezone = resolveCityTimeZone(meetup.city);
  const requestOrigin = getRequestOrigin(headerStore);
  const inviteUrl = `${requestOrigin}/invite/${encodeURIComponent(inviteId)}`;
  const clawdbotPrompt = `Read ${ATTENDEE_SKILL_URL}, then use this invite link ${inviteUrl} to join/signup for this meetup and tell me the next step.`;

  return (
    <main>
      <header className="site-nav reveal">
        <div className="brand brand-with-logo">
          <LogoMark className="brand-logo" size={30} />
          <span>localclaws invite</span>
        </div>
        <nav className="nav-links">
          <Link className="nav-link" href="/">
            Home
          </Link>
          <Link className="nav-link" href={`/calendar/${meetup.city}`}>
            City Calendar
          </Link>
        </nav>
      </header>

      <section className="home-hero reveal delay-1">
        <p className="kicker">Invitation</p>
        <h1 className="home-title">{meetup.name}</h1>
        <p className="home-subtitle">
          {city} | {meetup.district} |{" "}
          {formatDetailedInTimeZone(meetup.startAt, meetupTimezone)}
        </p>
      </section>

      <section className="manual-layout section reveal delay-2">
        <article className="module">
          <h2>Public details</h2>
          <ul className="step-list">
            <li>
              <div className="step-label">City</div>
              {city}
            </li>
            <li>
              <div className="step-label">District</div>
              {meetup.district}
            </li>
            <li>
              <div className="step-label">Tags</div>
              {meetup.tags.join(", ") || "none"}
            </li>
            <li>
              <div className="step-label">Spots</div>
              {meetup.maxParticipants}
            </li>
          </ul>
        </article>

        <article className="module">
          <h2>Confirm attendance</h2>
          {landing.mode === "targeted" && landing.canConfirm ? (
            <>
              <p className="home-subtitle">
                Click confirm to generate your invitation letter link and fun passcode.
              </p>
              <form action={`/invite/${inviteId}/confirm`} method="post" className="action-row">
                <button className="btn signal" type="submit">
                  Confirm and get invitation letter
                </button>
              </form>
              <p className="home-subtitle">After confirm, open your letter URL and enter passcode to unlock exact location.</p>
            </>
          ) : landing.mode === "targeted" && landing.isConfirmed && landing.letterUrl ? (
            <>
              <p className="home-subtitle">
                You are already confirmed for this meetup. Open your invitation letter and enter your passcode to reveal precise location details.
              </p>
              <div className="action-row">
                <a className="btn signal" href={landing.letterUrl}>
                  Open invitation letter
                </a>
              </div>
            </>
          ) : landing.mode === "targeted" ? (
            <p className="home-subtitle">
              This personalized invite is not confirmable yet. Wait for invite delivery or join approval, then use the same link to confirm.
            </p>
          ) : (
            <>
              <p className="home-subtitle">
                This is a public invite preview. Ask your agent for your personalized confirmation link.
              </p>
              <p className="home-subtitle">
                Passcode entry happens on your invitation letter page (`/letter/&lt;token&gt;`) after confirmation.
              </p>
            </>
          )}
        </article>

        <article className="module">
          <h2>Use this in ClawDBot</h2>
          <p className="tutorial-copy">
            Paste this into ClawDBot to join this meetup workflow.
          </p>
          <pre className="code-block">{clawdbotPrompt}</pre>
        </article>
      </section>
    </main>
  );
}
