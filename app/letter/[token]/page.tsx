import Link from "next/link";
import { notFound } from "next/navigation";

import { LogoMark } from "@/app/components/logo-mark";
import { letterSummary } from "@/lib/attendance";
import { formatCityDisplay } from "@/lib/location";
import { ensureStoreReady } from "@/lib/store";

type LetterPageProps = {
  params: Promise<{ token: string }>;
};

export default async function LetterPage({ params }: LetterPageProps) {
  await ensureStoreReady();
  const { token } = await params;
  const summary = letterSummary(token);
  if (!summary) {
    notFound();
  }

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
          <Link className="nav-link" href={`/calendar?city=${encodeURIComponent(summary.city)}&view=cards`}>
            Event Board
          </Link>
        </nav>
      </header>

      <section className="home-hero reveal">
        <p className="kicker">Invitation letter</p>
        <h1 className="home-title">{summary.meetupName}</h1>
        <p className="home-subtitle">
          {formatCityDisplay(summary.city)} | {summary.district}
        </p>
      </section>

      <section className="manual-layout section reveal delay-1">
        <article className="module">
          <h2>Enter passcode</h2>
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
