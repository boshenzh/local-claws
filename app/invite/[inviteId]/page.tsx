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
    nocache: true,
  },
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
  const clawdbotPrompt = `Please read ${ATTENDEE_SKILL_URL}. I want to join this LocalClaws meetup: ${inviteUrl}. Help me sign up and guide me through the next steps.`;

  return (
    <main className="invite-page">
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

      <section className="home-hero invite-hero reveal delay-1">
        <p className="kicker">You are invited</p>
        <h1 className="home-title invite-title">{meetup.name}</h1>
        <p className="home-subtitle invite-subtitle">
          {city} | {meetup.district} |{" "}
          {formatDetailedInTimeZone(meetup.startAt, meetupTimezone)}
        </p>
        <p className="home-subtitle invite-intro">
          Welcome to LocalClaws. This page shares the public meetup details and
          helps you take the next step to join.
        </p>
        <div className="invite-chip-row" aria-label="Public meetup details">
          <span className="invite-chip">City: {city}</span>
          <span className="invite-chip">District: {meetup.district}</span>
          <span className="invite-chip">Spots: {meetup.maxParticipants}</span>
          <span className="invite-chip">
            Tags: {meetup.tags.join(", ") || "none"}
          </span>
        </div>
      </section>

      <section className="invite-grid section reveal delay-2">
        <article className="module invite-card invite-card-primary">
          <h2>How to join</h2>
          {landing.mode === "targeted" && landing.canConfirm ? (
            <>
              <p className="home-subtitle invite-copy">
                Great news, this invitation is ready for you.
              </p>
              <form
                action={`/invite/${inviteId}/confirm`}
                method="post"
                className="action-row"
              >
                <button className="btn signal" type="submit">
                  Join and open my invitation
                </button>
              </form>
              <ol className="invite-steps">
                <li>Click the button above.</li>
                <li>
                  You will receive your private invitation letter and code
                  phrase.
                </li>
                <li>Open your letter to view exact meetup location details.</li>
              </ol>
            </>
          ) : landing.mode === "targeted" &&
            landing.isConfirmed &&
            landing.letterUrl ? (
            <>
              <p className="home-subtitle invite-copy">
                You are on the guest list. Open your invitation letter whenever
                you are ready.
              </p>
              <div className="action-row">
                <a className="btn signal" href={landing.letterUrl}>
                  Open my invitation letter
                </a>
              </div>
              <p className="home-subtitle invite-copy">
                Your letter includes private location details and meetup notes.
              </p>
            </>
          ) : landing.mode === "targeted" ? (
            <>
              <p className="home-subtitle invite-copy">
                Your invite is being prepared. Please check back shortly and use
                this same page again.
              </p>
              <p className="home-subtitle invite-copy">
                If needed, ask your assistant to check your join status.
              </p>
            </>
          ) : (
            <>
              <p className="home-subtitle invite-copy">
                To request a spot, send the message on the right to your
                assistant.
              </p>
              <p className="home-subtitle invite-copy">
                Once approved, you will receive your private invitation letter
                with exact location access.
              </p>
            </>
          )}
        </article>

        <article className="module invite-card">
          <h2>Send this message to your assistant</h2>
          <p className="tutorial-copy invite-copy">
            Copy this message and send it to ClawDBot.
          </p>
          <pre className="code-block invite-code-block">{clawdbotPrompt}</pre>
          <p className="muted invite-note">
            Your assistant will guide you step by step.
          </p>
        </article>
      </section>
    </main>
  );
}
