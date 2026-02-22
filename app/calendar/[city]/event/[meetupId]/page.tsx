import Link from "next/link";
import { notFound } from "next/navigation";

import { getPublicMeetupDetail, normalizeBoardTimeZone, normalizeBoardView } from "@/lib/board";
import { formatCityDisplay } from "@/lib/location";
import { ensureStoreReady } from "@/lib/store";

export const dynamic = "force-dynamic";

type EventDetailPageProps = {
  params: Promise<{ city: string; meetupId: string }>;
  searchParams: Promise<{ tz?: string; view?: string; from?: string; to?: string; tags?: string }>;
};

function mapZoomForRadius(radiusKm: number): number {
  if (radiusKm <= 2) return 14;
  if (radiusKm <= 5) return 13;
  if (radiusKm <= 10) return 12;
  if (radiusKm <= 20) return 11;
  return 10;
}

export default async function EventDetailPage({ params, searchParams }: EventDetailPageProps) {
  await ensureStoreReady();
  const [{ city, meetupId }, query] = await Promise.all([params, searchParams]);

  const timezone = normalizeBoardTimeZone(query.tz);
  const view = normalizeBoardView(query.view);
  const detail = getPublicMeetupDetail({
    city,
    meetupId,
    tz: timezone
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

  const boardHref = `/calendar?${boardQuery.toString()}`;
  const mapQuery = `${detail.district}, ${formatCityDisplay(detail.city)}`;
  const mapZoom = mapZoomForRadius(detail.publicRadiusKm);
  const mapSearch = detail.publicMapCenter
    ? `${detail.publicMapCenter.lat},${detail.publicMapCenter.lon}`
    : mapQuery;
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(mapSearch)}&z=${mapZoom}&output=embed`;

  return (
    <main className="retro-home board-page">
      <header className="retro-nav reveal">
        <div className="retro-brand-wrap">
          <span className="retro-brand-dot" aria-hidden="true" />
          <div>
            <div className="retro-brand">event detail</div>
            <div className="retro-brand-sub">public-safe overview</div>
          </div>
        </div>

        <nav className="retro-nav-links" aria-label="Event detail navigation">
          <a className="retro-nav-link" href={boardHref}>
            Back to board
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
          {formatCityDisplay(detail.city)} | {detail.district} | {detail.startLocal}
        </p>
        <p className="event-map-note">Approximate meetup area: within {detail.publicRadiusKm} km of {detail.district}.</p>
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
              <div className="step-label">Exact start (local)</div>
              {detail.startLocal}
            </li>
            <li>
              <div className="step-label">Exact start (UTC)</div>
              {new Date(detail.startAt).toISOString()}
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
            Privacy rule: this page shows district-level + radius context only. Exact venue appears only in invitation letters after passcode verification.
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
          <p className="event-map-note">Map is centered on public area data ({detail.publicRadiusKm} km radius), not exact private venue.</p>
          {detail.publicMapCenter ? (
            <p className="event-map-note">
              Public center derived from host map link and snapped to {detail.publicRadiusKm} km privacy grid.
            </p>
          ) : null}
        </article>
      </section>
    </main>
  );
}
