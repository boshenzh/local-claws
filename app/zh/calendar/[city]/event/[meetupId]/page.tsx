import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LogoMark } from "@/app/components/logo-mark";
import {
  getPublicMeetupDetail,
  normalizeBoardTimeZone,
  normalizeBoardView,
} from "@/lib/board";
import { formatCityDisplay } from "@/lib/location";
import { getSiteUrl } from "@/lib/seo";
import { ensureStoreReady } from "@/lib/store";
import { formatDetailedInTimeZone } from "@/lib/time";

export const dynamic = "force-dynamic";

type EventDetailPageProps = {
  params: Promise<{ city: string; meetupId: string }>;
  searchParams: Promise<{
    tz?: string;
    view?: string;
    from?: string;
    to?: string;
    tags?: string;
    back?: string;
  }>;
};

export async function generateMetadata({
  params,
}: Pick<EventDetailPageProps, "params">): Promise<Metadata> {
  await ensureStoreReady();
  const { city, meetupId } = await params;
  const detail = getPublicMeetupDetail({ city, meetupId });

  if (!detail) {
    return {
      title: "活动不存在",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const cityLabel = formatCityDisplay(detail.city);
  const canonical = `/zh/calendar/${detail.city}/event/${detail.meetupId}`;
  const tagsText = detail.tags.slice(0, 3).join(", ");
  const description = `${cityLabel}${detail.district}的${detail.name}，开始于${detail.startLocal}。公开区域半径${detail.publicRadiusKm}公里。${tagsText ? ` 标签：${tagsText}。` : ""}`;
  const geoMeta: Record<string, string | number | Array<string | number>> = {
    "geo.region": cityLabel,
    "geo.placename": `${detail.district}, ${cityLabel}`,
  };
  if (detail.publicMapCenter) {
    geoMeta["geo.position"] =
      `${detail.publicMapCenter.lat};${detail.publicMapCenter.lon}`;
    geoMeta.ICBM = `${detail.publicMapCenter.lat}, ${detail.publicMapCenter.lon}`;
  }

  return {
    title: `${cityLabel} | ${detail.name}`,
    description,
    alternates: {
      canonical,
      languages: {
        en: canonical.replace("/zh", ""),
        "zh-CN": canonical,
      },
    },
    openGraph: {
      type: "article",
      url: canonical,
      title: `${detail.name} | ${cityLabel} 聚会`,
      description,
      images: ["/localclaws-logo.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${detail.name} | ${cityLabel} 聚会`,
      description,
      images: ["/localclaws-logo.png"],
    },
    other: geoMeta,
  };
}

function mapZoomForRadius(radiusKm: number): number {
  if (radiusKm <= 2) return 14;
  if (radiusKm <= 5) return 13;
  if (radiusKm <= 10) return 12;
  if (radiusKm <= 20) return 11;
  return 10;
}

function formatDotDateInTimeZone(isoDate: string, timeZone: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return `${map.get("year")}.${map.get("month")}.${map.get("day")}`;
}

export default async function EventDetailPage({
  params,
  searchParams,
}: EventDetailPageProps) {
  await ensureStoreReady();
  const [{ city, meetupId }, query] = await Promise.all([params, searchParams]);

  const timezone = normalizeBoardTimeZone(query.tz, city);
  const view = normalizeBoardView(query.view);
  const detail = getPublicMeetupDetail({
    city,
    meetupId,
    tz: timezone,
  });

  if (!detail) {
    notFound();
  }

  const boardQuery = new URLSearchParams();
  boardQuery.set("city", detail.city);
  boardQuery.set("view", view);
  boardQuery.set("tz", timezone);

  if (typeof query.from === "string" && query.from.trim()) {
    boardQuery.set("from", query.from);
  }
  if (typeof query.to === "string" && query.to.trim()) {
    boardQuery.set("to", query.to);
  }
  if (typeof query.tags === "string" && query.tags.trim()) {
    boardQuery.set("tags", query.tags);
  }

  const mapBackQuery = new URLSearchParams();
  if (typeof query.from === "string" && query.from.trim()) {
    mapBackQuery.set("from", query.from);
  }
  if (typeof query.to === "string" && query.to.trim()) {
    mapBackQuery.set("to", query.to);
  }
  if (typeof query.tags === "string" && query.tags.trim()) {
    mapBackQuery.set("tags", query.tags);
  }
  const prefersMapBack = query.back === "map";
  const boardHref = prefersMapBack
    ? `/zh/calendar/map?${mapBackQuery.toString()}`
    : `/zh/calendar?${boardQuery.toString()}`;
  const enSwitchQuery = new URLSearchParams();
  if (typeof query.tz === "string" && query.tz.trim()) enSwitchQuery.set("tz", query.tz);
  if (typeof query.view === "string" && query.view.trim()) enSwitchQuery.set("view", query.view);
  if (typeof query.from === "string" && query.from.trim()) enSwitchQuery.set("from", query.from);
  if (typeof query.to === "string" && query.to.trim()) enSwitchQuery.set("to", query.to);
  if (typeof query.tags === "string" && query.tags.trim()) enSwitchQuery.set("tags", query.tags);
  if (query.back === "map") enSwitchQuery.set("back", "map");
  const enSwitchHref = `/calendar/${encodeURIComponent(detail.city)}/event/${encodeURIComponent(detail.meetupId)}${enSwitchQuery.size > 0 ? `?${enSwitchQuery.toString()}` : ""}`;
  const backLinkLabel = prefersMapBack ? "返回地图" : "返回看板";
  const mapQuery = `${detail.district}, ${formatCityDisplay(detail.city)}`;
  const mapZoom = mapZoomForRadius(detail.publicRadiusKm);
  const mapSearch = detail.publicMapCenter
    ? `${detail.publicMapCenter.lat},${detail.publicMapCenter.lon}`
    : mapQuery;
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(mapSearch)}&z=${mapZoom}&output=embed`;
  const siteUrl = getSiteUrl();
  const invitePreviewUrl = `${siteUrl}/zh/invite/${encodeURIComponent(detail.meetupId)}`;
  const attendeeSkillUrl =
    "https://localclaws.com/skill.md";
  const clawdbotPrompt = `阅读 ${attendeeSkillUrl}，然后使用这个邀请链接 ${invitePreviewUrl} 加入该聚会并告诉我下一步。`;
  const cityLabel = formatCityDisplay(detail.city);
  const eventSchema = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: detail.name,
    startDate: detail.startAt,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    description: `${cityLabel} 的公开聚会页面。精确地点仅在私密邀请函中显示。`,
    keywords: detail.tags.join(", "),
    url: `${siteUrl}/zh/calendar/${detail.city}/event/${detail.meetupId}`,
    location: {
      "@type": "Place",
      name: `${detail.district}, ${cityLabel}`,
      address: {
        "@type": "PostalAddress",
        addressLocality: detail.district,
        addressRegion: cityLabel,
      },
      ...(detail.publicMapCenter
        ? {
            geo: {
              "@type": "GeoCoordinates",
              latitude: detail.publicMapCenter.lat,
              longitude: detail.publicMapCenter.lon,
            },
          }
        : {}),
    },
    organizer: {
      "@type": "Organization",
      name: "LocalClaws",
      url: siteUrl,
    },
  };

  return (
    <main className="retro-home board-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }}
      />
      <header className="retro-nav reveal">
        <div className="retro-brand-wrap">
          <LogoMark className="retro-brand-logo" size={42} />
          <div>
            <div className="retro-brand">活动详情</div>
            <div className="retro-brand-sub">公开安全概览</div>
          </div>
        </div>

        <nav className="retro-nav-links" aria-label="Event detail navigation">
          <a className="retro-nav-link" href={boardHref}>
            {backLinkLabel}
          </a>
          <Link className="retro-nav-link" href="/zh">
            首页
          </Link>
          <a className="retro-nav-link" href={enSwitchHref}>
            EN
          </a>
        </nav>
      </header>

      <section className="retro-hero reveal delay-1">
        <p className="retro-eyebrow">聚会详情</p>
        <h1 className="retro-title">{detail.name}</h1>
        <p className="retro-lead">
          {cityLabel} | {detail.district} | {detail.startLocal}
        </p>
        <p className="event-map-note">
          聚会公开范围：以 {detail.district} 为中心约 {detail.publicRadiusKm} 公里。
        </p>
        <p className="event-detail-note event-welcome-copy">
          欢迎。此页面保持公开安全，你可先查看日期、区域、标签和粗粒度地图信息，再决定是否加入。
        </p>
      </section>

      <section className="event-detail-layout section reveal delay-2">
        <article className="event-detail-card">
          <h2>公开信息</h2>
          <ul className="step-list">
            <li>
              <div className="step-label">区域</div>
              {detail.district}
            </li>
            <li>
              <div className="step-label">开始时间</div>
              {detail.startLocal}
            </li>
            <li>
              <div className="step-label">日期</div>
              {formatDotDateInTimeZone(detail.startAt, timezone)}
            </li>
            <li>
              <div className="step-label">时区</div>
              {timezone}
            </li>
            <li>
              <div className="step-label">剩余名额</div>
              {detail.spotsRemaining}
            </li>
            <li>
              <div className="step-label">公开半径</div>
              {detail.publicRadiusKm} km
            </li>
            <li>
              <div className="step-label">标签</div>
              {detail.tags.length > 0 ? detail.tags.join(", ") : "无"}
            </li>
          </ul>

          <p className="event-detail-note">
            隐私规则：本页仅展示区域 + 半径上下文。精确地点只会在口令验证后的邀请函里显示。
          </p>
        </article>

        <article className="event-detail-card">
          <h2>半径地图上下文</h2>
          <iframe
            title={`${mapQuery} 地图`}
            src={mapSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="event-map"
          />
          <p className="event-map-note">
            地图仅基于公开区域数据（{detail.publicRadiusKm} km 半径）居中，不代表私密精确地点。
          </p>
          {detail.publicMapCenter ? (
            <p className="event-map-note">
              公开中心点来自主办方地图链接，并吸附到 {detail.publicRadiusKm} km 的隐私网格。
            </p>
          ) : null}
        </article>

        <article className="event-detail-card">
          <h2>使用你的 OpenClaw 助手加入</h2>
          <p className="event-map-note">
            复制下面提示词到 OpenClaw 助手，开始该聚会的参与者报名流程。
          </p>
          <pre className="code-block">{clawdbotPrompt}</pre>
          <div className="action-row">
            <a
              className="event-detail-link"
              href={`/zh/invite/${encodeURIComponent(detail.meetupId)}`}
            >
              打开公开邀请预览
            </a>
          </div>
        </article>
      </section>
    </main>
  );
}
