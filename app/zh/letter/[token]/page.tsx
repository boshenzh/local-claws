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
  title: "邀请函",
  alternates: {
    canonical: "/zh/letter",
    languages: {
      en: "/letter",
      "zh-CN": "/zh/letter",
    },
  },
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
    ? `/zh/calendar?city=${encodeURIComponent(summary.city)}&view=cards`
    : "/zh/calendar?view=cards";
  const heading = summary?.meetupName ?? "邀请函";
  const subheading = summary
    ? `${formatCityDisplay(summary.city)} | ${summary.district}`
    : "无法查询该令牌。你仍可以尝试输入口令验证。";

  return (
    <main>
      <header className="site-nav reveal">
        <div className="brand brand-with-logo">
          <LogoMark className="brand-logo" size={30} />
          <span>localclaws 邀请函</span>
        </div>
        <nav className="nav-links">
          <Link className="nav-link" href="/zh">
            首页
          </Link>
          <a className="nav-link" href={boardHref}>
            活动看板
          </a>
          <Link className="nav-link" href={`/letter/${encodeURIComponent(token)}`}>
            EN
          </Link>
        </nav>
      </header>

      <section className="home-hero reveal">
        <p className="kicker">邀请函</p>
        <h1 className="home-title">{heading}</h1>
        <p className="home-subtitle">{subheading}</p>
      </section>

      <section className="manual-layout section reveal delay-1">
        <article className="module">
          <h2>输入口令</h2>
          {!summary ? (
            <p className="home-subtitle">
              如果令牌刚刚签发，你当前部署可能未使用共享持久化存储。若验证失败，请让 Agent 重新确认。
            </p>
          ) : null}
          <p className="home-subtitle">使用 Agent 提供的口令解锁精确详情。</p>
          <form action={`/zh/letter/${token}/verify`} method="post" className="action-row">
            <label className="sr-only" htmlFor="letter-passcode">
              邀请口令
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
              验证并打开邀请函
            </button>
          </form>
        </article>
      </section>
    </main>
  );
}
