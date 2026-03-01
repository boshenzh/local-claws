import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { LogoMark } from "@/app/components/logo-mark";
import { resolveInviteLanding } from "@/lib/attendance";
import { formatCityDisplay, resolveCityTimeZone } from "@/lib/location";
import { ensureStoreReady } from "@/lib/store";
import { formatDetailedInTimeZone } from "@/lib/time";

type InvitePageProps = {
  params: Promise<{ inviteId: string }>;
};

const ATTENDEE_SKILL_URL =
  "https://localclaws.com/skill.md";

function firstForwardedValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function getRequestOrigin(headerStore: Headers): string {
  const forwardedHost = firstForwardedValue(
    headerStore.get("x-forwarded-host"),
  );
  const host = forwardedHost ?? headerStore.get("host");
  const forwardedProto = firstForwardedValue(
    headerStore.get("x-forwarded-proto"),
  );
  const protocol =
    forwardedProto ?? (host?.includes("localhost") ? "http" : "https");

  if (!host) {
    return "https://www.localclaws.com";
  }
  return `${protocol}://${host}`;
}

export const metadata: Metadata = {
  title: "邀请",
  alternates: {
    canonical: "/zh/invite",
    languages: {
      en: "/invite",
      "zh-CN": "/zh/invite",
    },
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function InvitePage({ params }: InvitePageProps) {
  await ensureStoreReady();
  const [headerStore, routeParams] = await Promise.all([headers(), params]);
  const { inviteId } = routeParams;
  const landing = resolveInviteLanding(inviteId);
  if (!landing) {
    notFound();
  }

  const meetup = landing.meetup;
  const city = formatCityDisplay(meetup.city);
  const meetupTimezone = resolveCityTimeZone(meetup.city);
  const requestOrigin = getRequestOrigin(headerStore);
  const inviteUrl = `${requestOrigin}/zh/invite/${encodeURIComponent(inviteId)}`;
  const clawdbotPrompt = `请阅读 ${ATTENDEE_SKILL_URL}。我想加入这个 LocalClaws 聚会：${inviteUrl}。请帮我完成报名并告诉我下一步。`;
  const zhLetterUrl = landing.letterUrl
    ? landing.letterUrl.replace("/letter/", "/zh/letter/")
    : null;

  return (
    <main className="invite-page">
      <header className="site-nav reveal">
        <div className="brand brand-with-logo">
          <LogoMark className="brand-logo" size={30} />
          <span>localclaws 邀请</span>
        </div>
        <nav className="nav-links">
          <Link className="nav-link" href="/zh">
            首页
          </Link>
          <Link className="nav-link" href={`/zh/calendar?city=${encodeURIComponent(meetup.city)}&view=cards`}>
            城市看板
          </Link>
          <Link className="nav-link" href={`/invite/${encodeURIComponent(inviteId)}`}>
            EN
          </Link>
        </nav>
      </header>

      <section className="home-hero invite-hero reveal delay-1">
        <p className="kicker">你收到邀请</p>
        <h1 className="home-title invite-title">{meetup.name}</h1>
        <p className="home-subtitle invite-subtitle">
          {city} | {meetup.district} |{" "}
          {formatDetailedInTimeZone(meetup.startAt, meetupTimezone)}
        </p>
        <p className="home-subtitle invite-intro">
          欢迎来到 LocalClaws。本页展示公开聚会信息，并帮你完成下一步加入流程。
        </p>
        <div className="invite-chip-row" aria-label="公开聚会信息">
          <span className="invite-chip">城市：{city}</span>
          <span className="invite-chip">区域：{meetup.district}</span>
          <span className="invite-chip">名额：{meetup.maxParticipants}</span>
          <span className="invite-chip">
            标签：{meetup.tags.join(", ") || "无"}
          </span>
        </div>
      </section>

      <section className="invite-grid section reveal delay-2">
        <article className="module invite-card invite-card-primary">
          <h2>如何加入</h2>
          {landing.mode === "targeted" && landing.canConfirm ? (
            <>
              <p className="home-subtitle invite-copy">
                好消息，这个邀请已为你准备完成。
              </p>
              <form
                action={`/zh/invite/${inviteId}/confirm`}
                method="post"
                className="action-row"
              >
                <button className="btn signal" type="submit">
                  立即加入并打开邀请函
                </button>
              </form>
              <ol className="invite-steps">
                <li>点击上方按钮。</li>
                <li>
                  你会收到私密邀请函和口令。
                </li>
                <li>打开邀请函查看聚会精确地点。</li>
              </ol>
            </>
          ) : landing.mode === "targeted" &&
            landing.isConfirmed &&
            zhLetterUrl ? (
            <>
              <p className="home-subtitle invite-copy">
                你已在来宾名单中。可随时打开邀请函。
              </p>
              <div className="action-row">
                <a className="btn signal" href={zhLetterUrl}>
                  打开我的邀请函
                </a>
              </div>
              <p className="home-subtitle invite-copy">
                邀请函内含私密地点信息和主办方备注。
              </p>
            </>
          ) : landing.mode === "targeted" ? (
            <>
              <p className="home-subtitle invite-copy">
                你的邀请正在准备中。请稍后回到此页面再试。
              </p>
              <p className="home-subtitle invite-copy">
                如有需要，请让助手帮你检查加入状态。
              </p>
            </>
          ) : (
            <>
              <p className="home-subtitle invite-copy">
                若要申请名额，请将右侧消息发送给你的助手。
              </p>
              <p className="home-subtitle invite-copy">
                通过后你会收到可查看精确地点的私密邀请函。
              </p>
            </>
          )}
        </article>

        <article className="module invite-card">
          <h2>把这段消息发给你的助手</h2>
          <p className="tutorial-copy invite-copy">
            复制下面内容并发送给 OpenClaw 助手。
          </p>
          <pre className="code-block invite-code-block">{clawdbotPrompt}</pre>
          <p className="muted invite-note">
            你的助手会一步步引导你完成流程。
          </p>
        </article>
      </section>
    </main>
  );
}
