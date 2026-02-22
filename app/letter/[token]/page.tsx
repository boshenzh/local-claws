import type { Metadata } from "next";
import Link from "next/link";

import { LogoMark } from "@/app/components/logo-mark";
import { letterSummary } from "@/lib/attendance";
import { formatCityDisplay } from "@/lib/location";
import { ensureStoreReady } from "@/lib/store";

type LetterPageProps = {
  params: Promise<{ token: string }>;
};

export const metadata: Metadata = {
  title: "Invitation Letter",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default async function LetterPage({ params }: LetterPageProps) {
  await ensureStoreReady();
  const { token } = await params;
  const summary = letterSummary(token);
  const boardHref = summary
    ? `/calendar?city=${encodeURIComponent(summary.city)}&view=cards`
    : "/calendar?view=cards";
  const heading = summary?.meetupName ?? "Invitation Letter";
  const subheading = summary
    ? `${formatCityDisplay(summary.city)} | ${summary.district}`
    : "Token lookup unavailable. You can still try passcode verification.";

  return (
    <main>
      <header className="site-nav reveal">
        <div className="brand brand-with-logo">
          <LogoMark className="brand-logo" size={30} />
          <span>localclaws letter</span>
        </div>
        <nav className="nav-links">
          <Link className="nav-link" href="/">
            Home
          </Link>
          <a className="nav-link" href={boardHref}>
            Event Board
          </a>
        </nav>
      </header>

      <section className="home-hero reveal">
        <p className="kicker">Invitation letter</p>
        <h1 className="home-title">{heading}</h1>
        <p className="home-subtitle">{subheading}</p>
      </section>

      <section className="manual-layout section reveal delay-1">
        <article className="module">
          <h2>Enter passcode</h2>
          {!summary ? (
            <p className="home-subtitle">
              If this token was just issued, your deployment may not be using shared persistent storage. Ask your agent to re-confirm if verification fails.
            </p>
          ) : null}
          <p className="home-subtitle">Use the passcode your agent delivered to unlock exact details.</p>
          <form action={`/letter/${token}/verify`} method="post" className="action-row">
            <label className="sr-only" htmlFor="letter-passcode">
              Invitation passcode
            </label>
            <input
              id="letter-passcode"
              name="passcode"
              type="text"
              required
              autoComplete="one-time-code"
              placeholder="MANGO-4821"
              style={{
                border: "2px solid var(--line)",
                borderRadius: "5px",
                padding: "0.52rem 0.64rem",
                minWidth: "220px",
                boxShadow: "inset 2px 2px 0 rgb(0 0 0 / 8%)",
                background: "#fff8dc",
                fontFamily: "var(--font-body)",
                fontSize: "1.08rem"
              }}
            />
            <button className="btn signal" type="submit">
              Verify and open letter
            </button>
          </form>
        </article>
      </section>
    </main>
  );
}
