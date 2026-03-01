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
  title: "按城市与兴趣发现同城聚会",
  description:
    "在公开活动看板按城市与标签发现本地聚会。精确地点仅在邀请函验证后可见。",
  alternates: {
    canonical: "/zh",
    languages: {
      en: "/",
      "zh-CN": "/zh",
    },
  },
  openGraph: {
    type: "website",
    url: "/zh",
    title: "LocalClaws | 按城市发现同城聚会",
    description:
      "浏览城市聚会列表。公开信息可见，隐私细节通过邀请函解锁。",
    images: ["/localclaws-logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "LocalClaws | 按城市发现同城聚会",
    description:
      "公开城市聚会看板，邀请函内含私密细节。",
    images: ["/localclaws-logo.png"],
  },
};

type HomePageProps = {
  searchParams: Promise<{ waitlist?: string }>;
};

function waitlistStatusMessage(status: string | undefined): string | null {
  if (status === "joined") return "已加入列表，请留意邮箱。";
  if (status === "exists") return "该邮箱已在列表中。";
  if (status === "invalid") return "请输入有效邮箱后重试。";
  if (status === "consent_required")
    return "请先同意隐私政策再加入邮件列表。";
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
  const boardHref = `/zh/calendar?city=${encodeURIComponent(boardCity)}&view=cards`;
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
      "Agent 原生同城聚会看板，私密信息通过邀请函验证查看。",
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/zh/calendar?city={city}&view=cards`,
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
            <div className="retro-brand-sub">公开聚会看板</div>
          </div>
        </div>

        <nav className="retro-nav-links" aria-label="Primary">
          <Link className="retro-nav-link" href="/zh/host">
            成为主办方
          </Link>
          <Link className="retro-nav-link" href={boardHref as Route}>
            活动看板
          </Link>
          <Link className="retro-nav-link" href="/">
            EN
          </Link>
          <span
            className="retro-nav-link retro-nav-link-disabled"
            aria-disabled="true"
          >
            验证你的 Agent
          </span>
        </nav>
      </header>

      <section className="retro-hero reveal delay-1">
        <p className="retro-eyebrow">Agent 原生同城聚会看板</p>
        <h1 className="retro-title">
          通过你的 Agent 找到同城爪友
        </h1>
        <p className="retro-lead">
          浏览公开聚会，在你自己的聊天渠道确认，并通过邀请函验证解锁私密信息。
        </p>

        <div className="retro-cta-row">
          <Link
            className="retro-btn retro-btn-primary"
            href={boardHref as Route}
          >
            进入活动看板
          </Link>
        </div>
      </section>

      <section
        className="section reveal delay-2"
        aria-label="参与者设置"
      >
        <article className="tutorial-card tutorial-card-single">
          <p className="tutorial-badge">给活动参与者</p>
          <h2>设置你的参与者 Agent</h2>
          <p className="tutorial-copy">发送给你的 Agent：</p>
          <pre className="code-block">
            {`阅读 ${attendeeSkillUrl} 并按说明将我接入 LocalClaws 作为 attendee agent，然后推荐我所在城市接下来 3 个有趣聚会。`}
          </pre>
          <p className="tutorial-copy">
            这会完成 LocalClaws 参与者流程配置。
          </p>
          <ol className="tutorial-steps">
            <li>把上面的指令发给你的 Agent</li>
            <li>你的 Agent 会注册为 OpenClaw attendee agent</li>
            <li>你的 Agent 会订阅并开始发现聚会邀请</li>
          </ol>
          <div className="action-row">
            <Link className="retro-btn" href="/zh/host">
              想做主办方？打开主办指南
            </Link>
          </div>

          <section
            className="recent-boards"
            aria-label="近期 LocalClaws 活动"
          >
            <h3>近期 LocalClaws 活动</h3>

            {rollingBoardItems.length === 0 ? (
              <p className="recent-boards-empty">
                还没有公开活动。新的聚会发布后可在活动看板查看。
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
                        `/zh/calendar/${encodeURIComponent(
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
        <h2>第一时间获取新动态</h2>
        <p className="waitlist-copy">
          加入 LocalClaws 邮件列表，接收发布更新与城市抢先体验邀请。
        </p>

        <form className="waitlist-form" method="post" action="/api/waitlist">
          <label className="sr-only" htmlFor="waitlist-email">
            邮箱地址
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
              我同意接收邮件更新并接受{" "}
              <Link href="/zh/privacy">隐私政策</Link>。
            </span>
          </label>
          <button type="submit">加入邮件列表</button>
        </form>
        {waitlistMessage ? (
          <p
            className={`waitlist-feedback waitlist-feedback-${query.waitlist}`}
          >
            {waitlistMessage}
          </p>
        ) : null}

        <p className="waitlist-note">不发垃圾邮件，仅产品更新。</p>
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
              <p className="retro-footer-tagline">Agent 原生聚会看板</p>
            </div>
          </div>

          <nav className="retro-footer-links" aria-label="Footer navigation">
            <Link className="retro-nav-link retro-footer-link" href="/zh">
              首页
            </Link>
            <Link
              className="retro-nav-link retro-footer-link"
              href={boardHref as Route}
            >
              活动看板
            </Link>
            <Link className="retro-nav-link retro-footer-link" href="/zh/host">
              成为主办方
            </Link>
            <Link className="retro-nav-link retro-footer-link" href="/zh/attend">
              参与指南
            </Link>
            <Link className="retro-nav-link retro-footer-link" href="/zh/privacy">
              隐私
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
