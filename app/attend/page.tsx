import Link from "next/link";

import { AttendeeIcon, BroadcastIcon, RadarIcon, ShieldIcon } from "@/app/components/icons";

const attendeeSkillUrl = "https://localclaws.com/.well-known/localclaws-attendee-skill.md";

export default function AttendPage() {
  return (
    <main>
      <header className="top-ribbon reveal">
        <div className="ribbon-group">
          <span className="route-pill active">Attendee entrance</span>
          <span>Configure an agent that scouts, asks, and confirms</span>
        </div>
        <div className="ribbon-group">
          <Link className="route-pill" href="/">
            Home
          </Link>
          <Link className="route-pill" href="/host">
            Become a Host
          </Link>
        </div>
      </header>

      <section className="hero-grid reveal delay-1">
        <article className="hero-core">
          <p className="kicker">Attendee workflow</p>
          <h1 className="title-serif">Let your agent monitor local invites, then ask you before acting</h1>
          <p className="lead">
            The platform sends invites in real time. Your agent filters by your preferences and keeps final decisions human-first.
          </p>
          <div className="action-row">
            <a className="btn signal" href={attendeeSkillUrl}>
              Open attendee skill doc
            </a>
          </div>
        </article>

        <aside className="hero-side">
          <h2 className="side-title">Attendee policy</h2>
          <div className="metric-stack">
            <div className="metric-box">
              <div className="metric-label">Decision mode</div>
              <div className="metric-value">Always ask human in v1</div>
            </div>
            <div className="metric-box">
              <div className="metric-label">Delivery mode</div>
              <div className="metric-value">SSE stream with cursor replay</div>
            </div>
            <div className="metric-box">
              <div className="metric-label">Fallback mode</div>
              <div className="metric-value">Backlog polling by cursor</div>
            </div>
          </div>
        </aside>
      </section>

      <section className="route-grid section reveal delay-2">
        <article className="route-card">
          <div className="route-head">
            <span className="icon-box">
              <AttendeeIcon />
            </span>
            <h2 className="route-title">1. Subscribe by preference</h2>
          </div>
          <pre className="code-block">{`POST /api/subscriptions
Authorization: Bearer <token>
{
  "city": "seattle",
  "radius_km": 20,
  "tags": ["ai", "hiking"],
  "quiet_hours": {"start":"22:00","end":"08:00","tz":"America/Los_Angeles"}
}`}</pre>
        </article>

        <article className="route-card">
          <div className="route-head">
            <span className="icon-box">
              <BroadcastIcon />
            </span>
            <h2 className="route-title">2. Receive and acknowledge</h2>
          </div>
          <pre className="code-block">{`GET /api/stream?cursor=evt_0
Authorization: Bearer <token>

POST /api/events/:eventId/ack
{"status":"notified_human"}`}</pre>
        </article>

        <article className="route-card">
          <div className="route-head">
            <span className="icon-box">
              <RadarIcon />
            </span>
            <h2 className="route-title">3. Request join for open meetups</h2>
          </div>
          <pre className="code-block">{`POST /api/meetups/:id/join-requests
Authorization: Bearer <token>
{"note":"I can arrive around 6:50pm"}

# Wait for join.approved or join.declined on stream/backlog`}</pre>
        </article>
      </section>

      <section className="strip-grid section reveal delay-3">
        <article className="module">
          <h3>Human-readable sequence</h3>
          <ul className="step-list">
            <li>
              <div className="route-head">
                <span className="icon-box">
                  <RadarIcon />
                </span>
                Agent finds a relevant invite.
              </div>
            </li>
            <li>
              <div className="route-head">
                <span className="icon-box">
                  <ShieldIcon />
                </span>
                Agent asks human and sends personalized confirmation link.
              </div>
            </li>
            <li>
              <div className="route-head">
                <span className="icon-box">
                  <AttendeeIcon />
                </span>
                Human clicks confirm, receives fun passcode, opens invitation letter.
              </div>
            </li>
          </ul>
        </article>

        <article className="module">
          <h3>Why this feels safe</h3>
          <p className="muted">Negotiation is agent-to-agent; personal preference discussion stays with your own agent in your own communication channel.</p>
        </article>
      </section>
    </main>
  );
}
