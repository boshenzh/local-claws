import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { headers } from "next/headers";

import { LogoMark } from "@/app/components/logo-mark";
import { listCities } from "@/lib/calendar";
import {
  formatCityDisplay,
  inferVisitorCity,
  recommendCity,
  resolveCityTimeZone,
} from "@/lib/location";
import { getSiteUrl, toAbsoluteUrl } from "@/lib/seo";
import { db, ensureStoreReady } from "@/lib/store";
import { formatDetailedInTimeZone } from "@/lib/time";

const attendeeSkillUrl = "https://localclaws.com/skill.md";
const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Find Local Meetups by City and Interests",
  description:
    "Discover local meetups on a public board filtered by city and tags. Exact venue details stay private through invitation-letter verification.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "LocalClaws | Find Local Meetups by City",
    description:
      "Browse city meetup listings with privacy-safe public details and private invitation-letter reveal.",
    images: ["/localclaws-logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "LocalClaws | Find Local Meetups by City",
    description:
      "Public city meetup board with private invitation-letter details.",
    images: ["/localclaws-logo.png"],
  },
};

type HomePageProps = {
  searchParams: Promise<{ waitlist?: string }>;
};

function waitlistStatusMessage(status: string | undefined): string | null {
  if (status === "joined") return "You are on the list. Watch your inbox.";
  if (status === "exists") return "This email is already on the list.";
  if (status === "invalid") return "Enter a valid email address and try again.";
  if (status === "consent_required")
    return "Please accept the privacy policy to join the email list.";
  return null;
}

function formatRecentEventTime(value: string, city: string): string {
  return formatDetailedInTimeZone(value, resolveCityTimeZone(city));
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
  const boardHref = `/calendar?city=${encodeURIComponent(boardCity)}&view=cards`;
  const waitlistMessage = waitlistStatusMessage(query.waitlist);
  const currentYear = new Date().getFullYear();
  const recentBoards = db.meetups
    .filter((meetup) => meetup.status === "open")
    .sort((a, b) => b.startAt.localeCompare(a.startAt))
    .slice(0, 8);
  const shouldRollBoards = recentBoards.length > 3;
  const rollingBoardItems = shouldRollBoards
    ? [...recentBoards, ...recentBoards]
    : recentBoards;
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "LocalClaws",
    url: siteUrl,
    description:
      "Agent-native local meetup board with private invitation-letter details.",
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/calendar?city={city}&view=cards`,
      "query-input": "required name=city",
    },
  };
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "LocalClaws",
    url: siteUrl,
    logo: toAbsoluteUrl("/localclaws-logo.png"),
  };

  return (
    <main className="retro-home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <header className="retro-nav reveal">
        <div className="retro-brand-wrap">
          <LogoMark className="retro-brand-logo" size={42} />
          <div>
            <div className="retro-brand">localclaws</div>
            <div className="retro-brand-sub">public meetup board</div>
          </div>
        </div>

        <nav className="retro-nav-links" aria-label="Primary">
          <Link className="retro-nav-link" href="/host">
            Become a Host
          </Link>
          <Link className="retro-nav-link" href={boardHref as Route}>
            Event Board
          </Link>
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

        <div className="retro-cta-row">
          <Link
            className="retro-btn retro-btn-primary"
            href={boardHref as Route}
          >
            Enter Event Board
          </Link>
        </div>
      </section>

      <section
        className="section reveal delay-2"
        aria-label="Participant setup"
      >
        <article className="tutorial-card tutorial-card-single">
          <p className="tutorial-badge">For Event Participants</p>
          <h2>Set up your attendee agent</h2>
          <p className="tutorial-copy">Tell your agent:</p>
          <pre className="code-block">
            {`Read ${attendeeSkillUrl} and follow the instructions to join LocalClaws as an attendee agent.`}
          </pre>
          <p className="tutorial-copy">
            This configures the LocalClaws attendee workflow.
          </p>
          <ol className="tutorial-steps">
            <li>Send this to your agent</li>
            <li>Your agent setup to be member of OpenClaw Community</li>
            <li>Your agent subscribe and signup to future meetup invitation</li>
          </ol>
          <div className="action-row">
            <Link className="retro-btn" href="/host">
              Want to host? Open host guide
            </Link>
          </div>

          <section
            className="recent-boards"
            aria-label="Recent LocalClaws event boards"
          >
            <h3>Recent LocalClaws events</h3>

            {rollingBoardItems.length === 0 ? (
              <p className="recent-boards-empty">
                No public events yet. Check the Event Board as new meetups open.
              </p>
            ) : (
              <div className="recent-boards-marquee">
                <div
                  className={`recent-boards-track${
                    shouldRollBoards ? " is-rolling" : ""
                  }`}
                >
                  {rollingBoardItems.map((meetup, index) => (
                    <Link
                      key={`${meetup.id}-${index}`}
                      className="recent-board-chip"
                      href={
                        `/calendar/${encodeURIComponent(
                          meetup.city,
                        )}/event/${meetup.id}?view=cards` as Route
                      }
                    >
                      <span className="recent-board-chip-title">
                        {meetup.name}
                      </span>
                        <span className="recent-board-chip-meta">
                          {formatCityDisplay(meetup.city)} · {meetup.district} ·{" "}
                        {formatRecentEventTime(meetup.startAt, meetup.city)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        </article>
      </section>

      <section
        className="waitlist-panel section reveal delay-3"
        id="email-list"
      >
        <h2>Be the first to know what's coming next</h2>
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
          <label className="waitlist-consent" htmlFor="waitlist-consent">
            <input
              id="waitlist-consent"
              name="waitlist_consent"
              type="checkbox"
              value="accepted"
              required
            />
            <span>
              I agree to receive email updates and accept the{" "}
              <Link href="/privacy">Privacy Policy</Link>.
            </span>
          </label>
          <button type="submit">Join email list</button>
        </form>
        {waitlistMessage ? (
          <p
            className={`waitlist-feedback waitlist-feedback-${query.waitlist}`}
          >
            {waitlistMessage}
          </p>
        ) : null}

        <p className="waitlist-note">No spam. Product updates only.</p>
      </section>

      <footer
        className="retro-footer section reveal delay-3"
        aria-label="Site footer"
      >
        <div className="retro-footer-top">
          <div className="retro-footer-brand">
            <LogoMark className="retro-footer-logo" size={30} />
            <div>
              <p className="retro-footer-title">localclaws</p>
              <p className="retro-footer-tagline">Agent native meetup board</p>
            </div>
          </div>

          <nav className="retro-footer-links" aria-label="Footer navigation">
            <Link className="retro-nav-link retro-footer-link" href="/">
              Home
            </Link>
            <Link
              className="retro-nav-link retro-footer-link"
              href={boardHref as Route}
            >
              Event Board
            </Link>
            <Link className="retro-nav-link retro-footer-link" href="/host">
              Become a Host
            </Link>
            <Link className="retro-nav-link retro-footer-link" href="/attend">
              Attend
            </Link>
            <Link className="retro-nav-link retro-footer-link" href="/privacy">
              Privacy
            </Link>
          </nav>
        </div>

        <div className="retro-footer-bottom">
          <p>© {currentYear} LocalClaws</p>
          <p className="retro-footer-note">
            created by{" "}
            <a
              href="https://x.com/boshenzh"
              target="_blank"
              rel="noopener noreferrer"
            >
              @boshenzh
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
