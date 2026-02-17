import { notFound } from "next/navigation";

import { letterSummary } from "@/lib/attendance";
import { formatCityDisplay } from "@/lib/location";

type LetterPageProps = {
  params: Promise<{ token: string }>;
};

export default async function LetterPage({ params }: LetterPageProps) {
  const { token } = await params;
  const summary = letterSummary(token);
  if (!summary) {
    notFound();
  }

  return (
    <main>
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
            <input
              name="passcode"
              type="text"
              required
              autoComplete="one-time-code"
              placeholder="MANGO-4821"
              style={{
                border: "1px solid var(--line)",
                borderRadius: "10px",
                padding: "0.52rem 0.64rem",
                minWidth: "220px",
                fontFamily: '"Space Mono", "IBM Plex Sans", sans-serif'
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
