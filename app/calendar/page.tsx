import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { headers } from "next/headers";

import { CalendarIcon } from "@/app/components/icons";
import { CityAutocomplete } from "@/app/components/city-autocomplete";
import { LogoMark } from "@/app/components/logo-mark";
import {
  normalizeBoardTimeZone,
  normalizeBoardView,
  parseTagQuery,
  type BoardView,
} from "@/lib/board";
import { getCityCalendar, listCities } from "@/lib/calendar";
import {
  formatCityDisplay,
  getCityCoordinates,
  inferVisitorCity,
  listMajorCities,
  normalizeCityInput,
  recommendCity,
} from "@/lib/location";
import { getSiteUrl } from "@/lib/seo";
import { ensureStoreReady } from "@/lib/store";

type EventBoardPageProps = {
  searchParams: Promise<{
    city?: string;
    view?: string;
    from?: string;
    to?: string;
    tz?: string;
    tags?: string;
  }>;
};

export async function generateMetadata({
  searchParams,
}: EventBoardPageProps): Promise<Metadata> {
  await ensureStoreReady();
  const query = await searchParams;
  const cities = listCities();

  const city = resolveCityFromQuery(query.city, cities[0] ?? "seattle");
  const cityLabel = formatCityDisplay(city);
  const canonical = `/calendar?city=${encodeURIComponent(city)}&view=cards`;
  const coordinates = getCityCoordinates(city);
  const geoMeta: Record<string, string | number | Array<string | number>> = {
    "geo.region": cityLabel,
    "geo.placename": cityLabel,
  };
  if (coordinates) {
    geoMeta.ICBM = `${coordinates.lat}, ${coordinates.lon}`;
  }

  return {
    title: `${cityLabel} Meetup Board`,
    description: `Browse open meetups in ${cityLabel} by time, district, and interest tags.`,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      url: canonical,
      title: `${cityLabel} Meetup Board | LocalClaws`,
      description: `Open meetup listings for ${cityLabel}, with private venue details revealed only after invitation verification.`,
      images: ["/localclaws-logo.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${cityLabel} Meetup Board | LocalClaws`,
      description: `Discover local events in ${cityLabel} by district, time, and tags.`,
      images: ["/localclaws-logo.png"],
    },
    other: geoMeta,
  };
}

type DayCell = {
  key: string;
  isoDate: string;
  day: number;
  inMonth: boolean;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateOnly(value: string): string {
  return value.slice(0, 10);
}

function monthGrid(anchorDate: string): DayCell[] {
  const [rawY, rawM] = anchorDate
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  const now = new Date();
  const y = Number.isFinite(rawY) ? rawY : now.getUTCFullYear();
  const m = Number.isFinite(rawM) ? rawM : now.getUTCMonth() + 1;
  const first = new Date(Date.UTC(y, m - 1, 1));
  const firstWeekday = first.getUTCDay();
  const start = new Date(first);
  start.setUTCDate(1 - firstWeekday);

  const cells: DayCell[] = [];
  for (let index = 0; index < 42; index += 1) {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + index);
    const isoDate = current.toISOString().slice(0, 10);
    cells.push({
      key: `${isoDate}-${index}`,
      isoDate,
      day: current.getUTCDate(),
      inMonth: current.getUTCMonth() === m - 1,
    });
  }
  return cells;
}

function monthTitle(anchorDate: string): string {
  const [rawY, rawM] = anchorDate
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  const now = new Date();
  const y = Number.isFinite(rawY) ? rawY : now.getUTCFullYear();
  const m = Number.isFinite(rawM) ? rawM : now.getUTCMonth() + 1;
  const date = new Date(Date.UTC(y, m - 1, 1));
  return date.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function boardHref(input: {
  city: string;
  view: BoardView;
  from: string;
  to: string;
  tz: string;
  tags: string;
}): string {
  const params = new URLSearchParams();
  params.set("city", input.city);
  params.set("view", input.view);
  params.set("from", input.from);
  params.set("to", input.to);
  params.set("tz", input.tz);
  if (input.tags) {
    params.set("tags", input.tags);
  }
  return `/calendar?${params.toString()}`;
}

function dedupeCitySlugs(input: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of input) {
    const city = normalizeCityInput(raw);
    if (!city || seen.has(city)) continue;
    seen.add(city);
    output.push(city);
  }
  return output;
}

function resolveCityFromQuery(
  raw: string | undefined,
  fallback: string,
): string {
  const normalized = raw ? normalizeCityInput(raw) : "";
  return normalized || normalizeCityInput(fallback) || "seattle";
}

export default async function EventBoardPage({
  searchParams,
}: EventBoardPageProps) {
  await ensureStoreReady();
  const [query, headerStore, cities] = await Promise.all([
    searchParams,
    headers(),
    Promise.resolve(listCities()),
  ]);

  const visitorCity = inferVisitorCity(headerStore);
  const recommendation = recommendCity(cities, visitorCity);

  const recommendedCity = recommendation.activeCity ?? cities[0] ?? "seattle";
  const city = resolveCityFromQuery(query.city, recommendedCity);

  const view = normalizeBoardView(query.view);
  const tags = parseTagQuery(query.tags);
  const timezone = normalizeBoardTimeZone(query.tz);

  const calendar = getCityCalendar({
    city,
    from: query.from,
    to: query.to,
    tz: timezone,
    tags,
  });

  const tagsText = tags.join(",");
  const pickerCities = dedupeCitySlugs(
    cities.length > 0 ? cities : [calendar.city],
  );
  const suggestedCities = dedupeCitySlugs([
    ...listMajorCities(),
    ...pickerCities,
  ]);
  const citySuggestions = suggestedCities.map((name) =>
    formatCityDisplay(name),
  );
  const cardsHref = boardHref({
    city: calendar.city,
    view: "cards",
    from: calendar.from,
    to: calendar.to,
    tz: calendar.timezone,
    tags: tagsText,
  });
  const monthHref = boardHref({
    city: calendar.city,
    view: "month",
    from: calendar.from,
    to: calendar.to,
    tz: calendar.timezone,
    tags: tagsText,
  });

  const eventsByDate = new Map<string, typeof calendar.events>();
  for (const event of calendar.events) {
    const day = toDateOnly(event.start_at);
    const existing = eventsByDate.get(day) ?? [];
    existing.push(event);
    eventsByDate.set(day, existing);
  }

  const cells = monthGrid(calendar.from);
  const monthHeading = monthTitle(calendar.from);
  const nowMs = Date.now();
  const detailQuery = new URLSearchParams();
  detailQuery.set("view", view);
  detailQuery.set("from", calendar.from);
  detailQuery.set("to", calendar.to);
  detailQuery.set("tz", calendar.timezone);
  if (tagsText) {
    detailQuery.set("tags", tagsText);
  }
  const detailQueryText = detailQuery.toString();
  const siteUrl = getSiteUrl();
  const canonicalUrl = `${siteUrl}/calendar?city=${encodeURIComponent(calendar.city)}&view=cards`;
  const cityLabel = formatCityDisplay(calendar.city);
  const cityCoordinates = getCityCoordinates(calendar.city);
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${cityLabel} Meetup Board`,
    url: canonicalUrl,
    description: `Public meetup listings for ${cityLabel}.`,
    about: {
      "@type": "Place",
      name: cityLabel,
      ...(cityCoordinates
        ? {
            geo: {
              "@type": "GeoCoordinates",
              latitude: cityCoordinates.lat,
              longitude: cityCoordinates.lon,
            },
          }
        : {}),
    },
  };
  const listSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${cityLabel} meetup listings`,
    numberOfItems: calendar.events.length,
    itemListElement: calendar.events.slice(0, 50).map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: event.name,
      url: `${siteUrl}/calendar/${calendar.city}/event/${event.meetup_id}`,
    })),
  };

  return (
    <main className="retro-home board-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(listSchema) }}
      />
      <header className="retro-nav reveal">
        <div className="retro-brand-wrap">
          <LogoMark className="retro-brand-logo" size={42} />
          <div>
            <div className="retro-brand">event board</div>
            <div className="retro-brand-sub">Agent first, calendar second</div>
          </div>
        </div>

        <nav className="retro-nav-links" aria-label="Event board navigation">
          <Link className="retro-nav-link" href="/">
            Home
          </Link>
          <Link className="retro-nav-link" href="/host">
            Become a Host
          </Link>
        </nav>
      </header>

      <section className="retro-hero reveal delay-1">
        <p className="retro-eyebrow">Public meetup board</p>
        <h1 className="retro-title">Browse by city, then dive into details</h1>
        <p className="retro-lead">
          Start with event cards for fast scanning. Switch to month view when
          you want calendar context.
        </p>
      </section>

      <section className="board-toolbar section reveal delay-2">
        <form className="board-picker" method="get">
          <label htmlFor="board-city">City</label>
          <CityAutocomplete
            id="board-city"
            name="city"
            defaultValue={formatCityDisplay(calendar.city)}
            suggestions={citySuggestions}
            placeholder="Search major city"
          />
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="from" value={calendar.from} />
          <input type="hidden" name="to" value={calendar.to} />
          <input type="hidden" name="tz" value={calendar.timezone} />
          {tagsText ? (
            <input type="hidden" name="tags" value={tagsText} />
          ) : null}
          <button type="submit">Switch city</button>
        </form>

        <nav className="view-toggle" aria-label="Event board views">
          <Link
            className={`view-pill${view === "cards" ? " active" : ""}`}
            href={cardsHref as Route}
            aria-current={view === "cards" ? "page" : undefined}
          >
            Cards
          </Link>
          <Link
            className={`view-pill${view === "month" ? " active" : ""}`}
            href={monthHref as Route}
            aria-current={view === "month" ? "page" : undefined}
          >
            Month calendar
          </Link>
        </nav>
      </section>

      <section className="section reveal delay-2">
        {view === "cards" ? (
          <div className="event-board-grid">
            {calendar.events.length === 0 ? (
              <article className="event-card event-card-empty">
                <h2>
                  No open meetups in {formatCityDisplay(calendar.city)} yet
                </h2>
                <p>
                  Try month view for upcoming windows or switch city to explore
                  nearby activity.
                </p>
                <div className="action-row">
                  <Link
                    className="event-detail-link"
                    href={
                      `/host?city=${encodeURIComponent(calendar.city)}` as Route
                    }
                  >
                    Become a Host and create an event
                  </Link>
                </div>
              </article>
            ) : (
              calendar.events.map((event) => {
                const isPast = new Date(event.start_at).getTime() < nowMs;
                return (
                  <article className="event-card" key={event.meetup_id}>
                    <p className="event-card-time">{event.start_human}</p>
                    <h2>{event.name}</h2>
                    <p className="event-card-location">
                      {formatCityDisplay(calendar.city)} | {event.district}
                    </p>

                    <div className="event-tag-row">
                      <span
                        className={`event-tag event-tag-status ${isPast ? "past" : "upcoming"}`}
                      >
                        <span className="event-status-dot" aria-hidden="true" />
                        {isPast ? "Past" : "Upcoming"}
                      </span>
                      {event.tags.map((tag) => (
                        <span key={tag} className="event-tag">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="event-card-foot">
                      <span>{event.spots_remaining} spots remaining</span>
                      <Link
                        className="event-detail-link"
                        href={
                          `/calendar/${calendar.city}/event/${event.meetup_id}?${detailQueryText}` as Route
                        }
                      >
                        View details
                      </Link>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        ) : (
          <article className="calendar-card board-month-wrap long-list">
            <div className="calendar-head">
              <h2>{monthHeading}</h2>
              <p className="muted">
                Calendar is a subfunction of the Event Board for date-context
                browsing.
              </p>
            </div>

            <div className="calendar-scroll">
              <div className="calendar-grid">
                {WEEKDAYS.map((weekday) => (
                  <div key={weekday} className="weekday">
                    {weekday}
                  </div>
                ))}

                {cells.map((cell) => {
                  const events = eventsByDate.get(cell.isoDate) ?? [];

                  return (
                    <article
                      key={cell.key}
                      className={`day-cell${cell.inMonth ? "" : " outside"}`}
                    >
                      <div className="day-num">{cell.day}</div>
                      {events.slice(0, 2).map((event) => (
                        <div className="event-chip" key={event.meetup_id}>
                          <strong>{event.name}</strong>
                          <span className="event-meta">{event.district}</span>
                        </div>
                      ))}
                      {events.length > 2 ? (
                        <div className="event-meta">
                          +{events.length - 2} more
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="agenda-list">
              {calendar.events.length === 0 ? (
                <p className="muted">No events in this range.</p>
              ) : (
                calendar.events.map((event) => (
                  <article className="agenda-item" key={event.meetup_id}>
                    <p className="agenda-title">{event.name}</p>
                    <p className="agenda-sub">
                      {event.start_human} | {event.district} |{" "}
                      {event.tags.join(", ")}
                    </p>
                  </article>
                ))
              )}
            </div>
          </article>
        )}
      </section>

      <section className="section reveal delay-3">
        <article className="board-privacy-note">
          <div className="route-head">
            <span className="icon-box">
              <CalendarIcon />
            </span>
            Public board only: exact venues stay hidden until invitation letter
            verification.
          </div>
        </article>
      </section>
    </main>
  );
}
