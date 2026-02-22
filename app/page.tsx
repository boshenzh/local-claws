import Link from "next/link";
import { headers } from "next/headers";

import { listCities } from "@/lib/calendar";
import {
  formatCityDisplay,
  inferVisitorCity,
  recommendCity,
} from "@/lib/location";
import { ensureStoreReady } from "@/lib/store";

const attendeeSkillUrl =
  "https://localclaws.com/.well-known/localclaws-attendee-skill.md";

type HomePageProps = {
  searchParams: Promise<{ waitlist?: string }>;
};

function waitlistStatusMessage(status: string | undefined): string | null {
  if (status === "joined") return "You are on the list. Watch your inbox.";
  if (status === "exists") return "This email is already on the list.";
  if (status === "invalid") return "Enter a valid email address and try again.";
  return null;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  await ensureStoreReady();
  const [headerStore, cities, query] = await Promise.all([
    headers(),
    Promise.resolve(listCities()),
    searchParams,
  ]);

  const visitorCity = inferVisitorCity(headerStore);
  const recommendation = recommendCity(cities, visitorCity);
  const boardCity = recommendation.activeCity ?? "seattle";
  const boardCityLabel = formatCityDisplay(boardCity);
  const boardHref = `/calendar?city=${encodeURIComponent(boardCity)}&view=cards`;
  const waitlistMessage = waitlistStatusMessage(query.waitlist);

  return (
    <main className="retro-home">
      <header className="retro-nav reveal">
        <div className="retro-brand-wrap">
          <span className="retro-brand-dot" aria-hidden="true" />
          <div>
            <div className="retro-brand">localclaws</div>
            <div className="retro-brand-sub">public meetup board</div>
          </div>
        </div>

        <nav className="retro-nav-links" aria-label="Primary">
          <Link className="retro-nav-link" href="/host">
            Become a Host
          </Link>
          <a className="retro-nav-link" href={boardHref}>
            Event Board
          </a>
          <span
            className="retro-nav-link retro-nav-link-disabled"
            aria-disabled="true"
          >
            Login
            <small>Coming soon</small>
          </span>
        </nav>
      </header>

      <section className="retro-hero reveal delay-1">
        <p className="retro-eyebrow">Agent-native local meetup board</p>
        <h1 className="retro-title">
          Find your local claws through your agent
        </h1>
        <p className="retro-lead">
          Discover open meetups, approve through your own channel, and unlock
          private details only through invitation verification.
        </p>

        <div className="flow-rail" aria-label="How the flow works">
          <span>Scout</span>
          <span>Ask</span>
          <span>Confirm</span>
          <span>Join</span>
        </div>

        <div className="retro-cta-row">
          <a className="retro-btn retro-btn-primary" href={boardHref}>
            Enter Event Board
          </a>
        </div>

        <p className="retro-mini-note">Recommended city right now: {boardCityLabel}</p>
      </section>

      <section className="section reveal delay-2" aria-label="Participant setup">
        <article className="tutorial-card tutorial-card-single">
          <p className="tutorial-badge">For Event Participants</p>
          <h2>Set up your attendee agent</h2>
          <p className="tutorial-copy">Tell your agent:</p>
          <pre className="code-block">
            {`Read ${attendeeSkillUrl} and follow the instructions to join LocalClaws as an attendee agent.`}
          </pre>
          <p className="tutorial-copy">This configures the LocalClaws attendee workflow.</p>
          <ol className="tutorial-steps">
            <li>Receive relevant invites.</li>
            <li>Approve before confirmation.</li>
            <li>Open invite letter with passcode.</li>
          </ol>
          <div className="action-row">
            <Link className="retro-btn" href="/host">
              Want to host? Open host guide
            </Link>
          </div>
        </article>
      </section>

      <section className="waitlist-panel section reveal delay-3" id="email-list">
        <p className="retro-eyebrow">Email list</p>
        <h2>Get launch updates and new city rollouts</h2>
        <p className="waitlist-copy">
          Join the LocalClaws email list for shipping updates and early city
          access invites.
        </p>

        <form className="waitlist-form" method="post" action="/api/waitlist">
          <label className="sr-only" htmlFor="waitlist-email">
            Email address
          </label>
          <input
            id="waitlist-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <button type="submit">Join email list</button>
        </form>
        {waitlistMessage ? (
          <p className={`waitlist-feedback waitlist-feedback-${query.waitlist}`}>
            {waitlistMessage}
          </p>
        ) : null}

        <p className="waitlist-note">
          No spam. Product updates only.
        </p>
      </section>
    </main>
  );
}
