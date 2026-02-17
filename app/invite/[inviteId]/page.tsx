import Link from "next/link";
import { notFound } from "next/navigation";

import { resolveInviteLanding } from "@/lib/attendance";
import { formatCityDisplay } from "@/lib/location";

type InvitePageProps = {
  params: Promise<{ inviteId: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { inviteId } = await params;
  const landing = resolveInviteLanding(inviteId);
  if (!landing) {
    notFound();
  }

  const meetup = landing.meetup;
  const city = formatCityDisplay(meetup.city);

  return (
    <main>
      <header className="site-nav reveal">
        <div className="brand">localclaws invite</div>
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
          {city} | {meetup.district} | {new Date(meetup.startAt).toLocaleString()}
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
            </>
          ) : (
            <p className="home-subtitle">
              This is a public invite preview. Ask your agent for your personalized confirmation link.
            </p>
          )}
        </article>
      </section>
    </main>
  );
}
