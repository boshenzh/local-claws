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
      title: "Event Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const cityLabel = formatCityDisplay(detail.city);
  const canonical = `/calendar/${detail.city}/event/${detail.meetupId}`;
  const tagsText = detail.tags.slice(0, 3).join(", ");
  const description = `${detail.name} in ${detail.district}, ${cityLabel}. Starts ${detail.startLocal}. Public area radius ${detail.publicRadiusKm} km.${tagsText ? ` Tags: ${tagsText}.` : ""}`;
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
    title: `${detail.name} in ${cityLabel}`,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "article",
      url: canonical,
      title: `${detail.name} | ${cityLabel} Meetup`,
      description,
      images: ["/localclaws-logo.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${detail.name} | ${cityLabel} Meetup`,
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
  const formatter = new Intl.DateTimeFormat("en-US", {
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
    ? `/calendar/map?${mapBackQuery.toString()}`
    : `/calendar?${boardQuery.toString()}`;
  const backLinkLabel = prefersMapBack ? "Back to map" : "Back to board";
  const mapQuery = `${detail.district}, ${formatCityDisplay(detail.city)}`;
  const mapZoom = mapZoomForRadius(detail.publicRadiusKm);
  const mapSearch = detail.publicMapCenter
    ? `${detail.publicMapCenter.lat},${detail.publicMapCenter.lon}`
    : mapQuery;
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(mapSearch)}&z=${mapZoom}&output=embed`;
  const siteUrl = getSiteUrl();
  const invitePreviewUrl = `${siteUrl}/invite/${encodeURIComponent(detail.meetupId)}`;
  const attendeeSkillUrl =
    "https://localclaws.com/skill.md";
  const clawdbotPrompt = `Read ${attendeeSkillUrl}, then use this invite link ${invitePreviewUrl} to join/signup for this meetup and tell me the next step.`;
  const cityLabel = formatCityDisplay(detail.city);
  const eventSchema = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: detail.name,
    startDate: detail.startAt,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    description: `Public meetup listing for ${cityLabel}. Exact venue details are revealed only in private invitation letters.`,
    keywords: detail.tags.join(", "),
    url: `${siteUrl}/calendar/${detail.city}/event/${detail.meetupId}`,
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
            <div className="retro-brand">event detail</div>
            <div className="retro-brand-sub">public-safe overview</div>
          </div>
        </div>

        <nav className="retro-nav-links" aria-label="Event detail navigation">
          <a className="retro-nav-link" href={boardHref}>
            {backLinkLabel}
          </a>
          <Link className="retro-nav-link" href="/">
            Home
          </Link>
        </nav>
      </header>

      <section className="retro-hero reveal delay-1">
        <p className="retro-eyebrow">Meetup details</p>
        <h1 className="retro-title">{detail.name}</h1>
        <p className="retro-lead">
          {cityLabel} | {detail.district} | {detail.startLocal}
        </p>
        <p className="event-map-note">
          Approximate meetup area: within {detail.publicRadiusKm} km of{" "}
          {detail.district}.
        </p>
        <p className="event-detail-note event-welcome-copy">
          Welcome. This page is intentionally public-safe: you can browse date,
          district, tags, and rough map context here before deciding whether to
          join.
        </p>
      </section>

      <section className="event-detail-layout section reveal delay-2">
        <article className="event-detail-card">
          <h2>Public details</h2>
          <ul className="step-list">
            <li>
              <div className="step-label">District</div>
              {detail.district}
            </li>
            <li>
              <div className="step-label">Starting time</div>
              {detail.startLocal}
            </li>
            <li>
              <div className="step-label">Date</div>
              {formatDotDateInTimeZone(detail.startAt, timezone)}
            </li>
            <li>
              <div className="step-label">Timezone</div>
              {timezone}
            </li>
            <li>
              <div className="step-label">Spots remaining</div>
              {detail.spotsRemaining}
            </li>
            <li>
              <div className="step-label">Public area radius</div>
              {detail.publicRadiusKm} km
            </li>
            <li>
              <div className="step-label">Tags</div>
              {detail.tags.length > 0 ? detail.tags.join(", ") : "none"}
            </li>
          </ul>

          <p className="event-detail-note">
            Privacy rule: this page shows district-level + radius context only.
            Exact venue appears only in invitation letters after passcode
            verification.
          </p>
        </article>

        <article className="event-detail-card">
          <h2>Radius map context</h2>
          <iframe
            title={`Map of ${mapQuery}`}
            src={mapSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="event-map"
          />
          <p className="event-map-note">
            Map is centered on public area data ({detail.publicRadiusKm} km
            radius), not exact private venue.
          </p>
          {detail.publicMapCenter ? (
            <p className="event-map-note">
              Public center derived from host map link and snapped to{" "}
              {detail.publicRadiusKm} km privacy grid.
            </p>
          ) : null}
        </article>

        <article className="event-detail-card">
          <h2>Join with Your OpenClaw Assistant</h2>
          <p className="event-map-note">
            Copy this prompt into your OpenClaw assistant to start attendee
            signup flow for this meetup.
          </p>
          <pre className="code-block">{clawdbotPrompt}</pre>
          <div className="action-row">
            <a
              className="event-detail-link"
              href={`/invite/${encodeURIComponent(detail.meetupId)}`}
            >
              Open public invite preview
            </a>
          </div>
        </article>
      </section>
    </main>
  );
}
