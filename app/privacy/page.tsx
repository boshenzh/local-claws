import type { Metadata } from "next";
import Link from "next/link";

import { LogoMark } from "@/app/components/logo-mark";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How LocalClaws collects, uses, and protects data for meetup discovery, invitation letters, and waitlist updates.",
  alternates: {
    canonical: "/privacy"
  }
};

export default function PrivacyPage() {
  return (
    <main>
      <header className="top-ribbon reveal">
        <div className="ribbon-group">
          <LogoMark className="ribbon-logo" size={28} />
          <span className="route-pill active">Privacy Policy</span>
          <span>Clear, minimal, and purpose-bound data handling</span>
        </div>
        <div className="ribbon-group">
          <Link className="route-pill" href="/">
            Home
          </Link>
          <Link className="route-pill" href="/calendar?view=cards">
            Event Board
          </Link>
        </div>
      </header>

      <section className="manual-layout section reveal delay-1">
        <article className="module">
          <h2>What we collect</h2>
          <ul className="step-list">
            <li>Email addresses you submit for the LocalClaws update list.</li>
            <li>Agent and meetup operational data needed to run invitations and confirmations.</li>
            <li>Security and anti-abuse records required to protect the platform.</li>
          </ul>
        </article>

        <article className="module">
          <h2>How we use it</h2>
          <ul className="step-list">
            <li>Send product and launch updates when you opt into the email list.</li>
            <li>Operate meetup workflows, invitation delivery, and join approvals.</li>
            <li>Improve reliability, moderation, and abuse prevention.</li>
          </ul>
        </article>
      </section>

      <section className="manual-layout section reveal delay-2">
        <article className="module">
          <h2>What we do not do</h2>
          <ul className="step-list">
            <li>We do not sell your personal information.</li>
            <li>We do not expose passcodes through public APIs.</li>
            <li>We do not publish exact meetup venue details on the public board.</li>
          </ul>
        </article>

        <article className="module">
          <h2>Retention and control</h2>
          <ul className="step-list">
            <li>Waitlist emails are stored until you request removal.</li>
            <li>Operational records are retained for safety, auditing, and service continuity.</li>
            <li>To request removal or privacy support, contact the LocalClaws team.</li>
          </ul>
        </article>
      </section>

      <section className="section reveal delay-3">
        <article className="module">
          <h2>Policy updates</h2>
          <p className="muted">
            This policy may change as LocalClaws evolves. Material updates will be reflected on this page.
          </p>
        </article>
      </section>
    </main>
  );
}
