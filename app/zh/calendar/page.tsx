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
  const canonical = `/zh/calendar?city=${encodeURIComponent(city)}&view=cards`;
  const coordinates = getCityCoordinates(city);
  const geoMeta: Record<string, string | number | Array<string | number>> = {
    "geo.region": cityLabel,
    "geo.placename": cityLabel,
  };
  if (coordinates) {
    geoMeta.ICBM = `${coordinates.lat}, ${coordinates.lon}`;
  }

  return {
    title: `${cityLabel} 聚会看板`,
    description: `按时间、区域与兴趣标签浏览 ${cityLabel} 的开放聚会。`,
    alternates: {
      canonical,
      languages: {
        en: canonical.replace("/zh", ""),
        "zh-CN": canonical,
      },
    },
    openGraph: {
      type: "website",
      url: canonical,
      title: `${cityLabel} 聚会看板 | LocalClaws`,
      description: `${cityLabel} 的开放聚会列表，私密地点仅在邀请函验证后显示。`,
      images: ["/localclaws-logo.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${cityLabel} 聚会看板 | LocalClaws`,
      description: `按区域、时间与标签发现 ${cityLabel} 的本地活动。`,
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

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

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
  return date.toLocaleString("zh-CN", {
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
  return `/zh/calendar?${params.toString()}`;
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
  const timezone = normalizeBoardTimeZone(query.tz, city);

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
  const mapParams = new URLSearchParams();
  mapParams.set("from", calendar.from);
  mapParams.set("to", calendar.to);
  if (tagsText) {
    mapParams.set("tags", tagsText);
  }
  const mapHref = `/zh/calendar/map?${mapParams.toString()}`;

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
  const canonicalUrl = `${siteUrl}/zh/calendar?city=${encodeURIComponent(calendar.city)}&view=cards`;
  const cityLabel = formatCityDisplay(calendar.city);
  const cityCoordinates = getCityCoordinates(calendar.city);
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${cityLabel} 聚会看板`,
    url: canonicalUrl,
    description: `${cityLabel} 的公开聚会列表。`,
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
    name: `${cityLabel} 聚会列表`,
    numberOfItems: calendar.events.length,
    itemListElement: calendar.events.slice(0, 50).map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: event.name,
      url: `${siteUrl}/zh/calendar/${calendar.city}/event/${event.meetup_id}`,
    })),
  };
  const enParams = new URLSearchParams();
  enParams.set("city", calendar.city);
  enParams.set("view", view);
  enParams.set("from", calendar.from);
  enParams.set("to", calendar.to);
  enParams.set("tz", calendar.timezone);
  if (tagsText) enParams.set("tags", tagsText);
  const enHref = `/calendar?${enParams.toString()}`;

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
            <div className="retro-brand">活动看板</div>
            <div className="retro-brand-sub">Agent 优先，日历其次</div>
          </div>
        </div>

        <nav className="retro-nav-links" aria-label="Event board navigation">
          <Link className="retro-nav-link" href="/zh">
            首页
          </Link>
          <Link className="retro-nav-link" href="/zh/host">
            成为主办方
          </Link>
          <Link className="retro-nav-link" href={enHref as Route}>
            EN
          </Link>
        </nav>
      </header>

      <section className="retro-hero reveal delay-1">
        <p className="retro-eyebrow">公开聚会看板</p>
        <h1 className="retro-title">先按城市浏览，再进入详情</h1>
        <p className="retro-lead">
          先用活动卡片快速扫描；需要日程视角时切换到月历。
        </p>
      </section>

      <section className="board-toolbar section reveal delay-2">
        <form className="board-picker" method="get">
          <label htmlFor="board-city">城市</label>
          <CityAutocomplete
            id="board-city"
            name="city"
            defaultValue={formatCityDisplay(calendar.city)}
            suggestions={citySuggestions}
            placeholder="搜索主要城市"
          />
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="from" value={calendar.from} />
          <input type="hidden" name="to" value={calendar.to} />
          <input type="hidden" name="tz" value={calendar.timezone} />
          {tagsText ? (
            <input type="hidden" name="tags" value={tagsText} />
          ) : null}
          <button type="submit">切换城市</button>
        </form>

        <nav className="view-toggle" aria-label="Event board views">
          <Link
            className={`view-pill${view === "cards" ? " active" : ""}`}
            href={cardsHref as Route}
            aria-current={view === "cards" ? "page" : undefined}
          >
            卡片
          </Link>
          <Link
            className={`view-pill${view === "month" ? " active" : ""}`}
            href={monthHref as Route}
            aria-current={view === "month" ? "page" : undefined}
          >
            月历
          </Link>
          <Link className="view-pill" href={mapHref as Route}>
            地图
          </Link>
        </nav>
      </section>

      <section className="section reveal delay-2">
        {view === "cards" ? (
          <div className="event-board-grid">
            {calendar.events.length === 0 ? (
              <article className="event-card event-card-empty">
                <h2>
                  {formatCityDisplay(calendar.city)} 暂无开放聚会
                </h2>
                <p>
                  可切换到月历查看后续时间窗口，或切换城市探索更多活动。
                </p>
                <div className="action-row">
                  <Link
                    className="event-detail-link"
                    href={
                      `/zh/host?city=${encodeURIComponent(calendar.city)}` as Route
                    }
                  >
                    成为主办方并创建活动
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
                        {isPast ? "已结束" : "即将开始"}
                      </span>
                      {event.tags.map((tag) => (
                        <span key={tag} className="event-tag">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="event-card-foot">
                      <span>{event.spots_remaining} 个名额剩余</span>
                      <Link
                        className="event-detail-link"
                        href={
                          `/zh/calendar/${calendar.city}/event/${event.meetup_id}?${detailQueryText}` as Route
                        }
                      >
                        查看详情
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
                月历是活动看板的补充视图，用于按日期浏览。
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
                          +{events.length - 2} 个
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="agenda-list">
              {calendar.events.length === 0 ? (
                <p className="muted">该时间范围内暂无活动。</p>
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
            仅公开看板信息：精确地点会在邀请函验证后才显示。
          </div>
        </article>
      </section>
    </main>
  );
}
