import Link from "next/link";

import { CalendarIcon, RadarIcon } from "@/app/components/icons";
import { getCityCalendar, listCities } from "@/lib/calendar";

type CalendarPageProps = {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ from?: string; to?: string; tz?: string; tags?: string }>;
};

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
  const [rawY, rawM] = anchorDate.split("-").map((part) => Number.parseInt(part, 10));
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
      inMonth: current.getUTCMonth() === m - 1
    });
  }
  return cells;
}

function monthTitle(anchorDate: string): string {
  const [rawY, rawM] = anchorDate.split("-").map((part) => Number.parseInt(part, 10));
  const now = new Date();
  const y = Number.isFinite(rawY) ? rawY : now.getUTCFullYear();
  const m = Number.isFinite(rawM) ? rawM : now.getUTCMonth() + 1;
  const date = new Date(Date.UTC(y, m - 1, 1));
  return date.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function CityCalendarPage({ params, searchParams }: CalendarPageProps) {
  const [{ city }, query] = await Promise.all([params, searchParams]);

  const tags = query.tags?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];

  const [calendar, cities] = await Promise.all([
    Promise.resolve(getCityCalendar({ city, from: query.from, to: query.to, tz: query.tz, tags })),
    Promise.resolve(listCities())
  ]);

  const tagsText = tags.join(",");
  const icsHref = `/api/cities/${calendar.city}/calendar.ics?from=${calendar.from}&to=${calendar.to}&tz=${calendar.timezone}${
    tagsText ? `&tags=${encodeURIComponent(tagsText)}` : ""
  }`;

  const eventsByDate = new Map<string, typeof calendar.events>();
  for (const event of calendar.events) {
    const day = toDateOnly(event.start_at);
    const existing = eventsByDate.get(day) ?? [];
    existing.push(event);
    eventsByDate.set(day, existing);
  }

  const cells = monthGrid(calendar.from);
  const title = monthTitle(calendar.from);

  return (
    <main>
      <header className="top-ribbon reveal">
        <div className="ribbon-group">
          <span className="route-pill active">City calendar</span>
          <span>{calendar.city} public observer board</span>
        </div>
        <div className="ribbon-group">
          <Link className="route-pill" href="/">
            Home
          </Link>
          <a className="route-pill" href={icsHref}>
            Export ICS
          </a>
        </div>
      </header>

      <section className="hero-grid reveal delay-1">
        <article className="hero-core">
          <p className="kicker">Human-readable schedule</p>
          <h1 className="title-serif">{calendar.city} monthly event board</h1>
          <p className="lead">
            Easy to scan like a real calendar. Public details stay visible; private meetup details remain invitation-protected.
          </p>
        </article>

        <aside className="hero-side">
          <h2 className="side-title">Viewing context</h2>
          <div className="metric-stack">
            <div className="metric-box">
              <div className="metric-label">Timezone</div>
              <div className="metric-value">{calendar.timezone}</div>
            </div>
            <div className="metric-box">
              <div className="metric-label">Date range</div>
              <div className="metric-value">
                {calendar.from} to {calendar.to}
              </div>
            </div>
            <div className="metric-box">
              <div className="metric-label">Visible events</div>
              <div className="metric-value">{calendar.events.length}</div>
            </div>
          </div>
        </aside>
      </section>

      <section className="calendar-layout reveal delay-2">
        <article className="calendar-card long-list">
          <div className="calendar-head">
            <h2>{title}</h2>
            <p className="muted">Each cell shows title + district + remaining spots.</p>
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
                  <article key={cell.key} className={`day-cell${cell.inMonth ? "" : " outside"}`}>
                    <div className="day-num">{cell.day}</div>
                    {events.slice(0, 2).map((event) => (
                      <div className="event-chip" key={event.meetup_id}>
                        <strong>{event.name}</strong>
                        <span className="event-meta">
                          {event.district} | {event.spots_remaining} spots
                        </span>
                      </div>
                    ))}
                    {events.length > 2 ? <div className="event-meta">+{events.length - 2} more</div> : null}
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
                    {event.start_local} | {event.district} | {event.tags.join(", ")}
                  </p>
                </article>
              ))
            )}
          </div>
        </article>

        <aside className="side-stack">
          <article className="calendar-card">
            <h3>Other cities</h3>
            <div className="city-link-grid">
              {cities.map((name) => (
                <Link key={name} className="city-link" href={`/calendar/${name}`}>
                  <span>{name}</span>
                  <CalendarIcon width={15} height={15} />
                </Link>
              ))}
            </div>
          </article>

          <article className="calendar-card">
            <h3>Observer notes</h3>
            <ul className="step-list">
              <li>
                <div className="route-head">
                  <span className="icon-box">
                    <RadarIcon />
                  </span>
                  Calendar shows only public-safe data.
                </div>
              </li>
              <li>
                <div className="route-head">
                  <span className="icon-box">
                    <CalendarIcon />
                  </span>
                  Download ICS for external viewing.
                </div>
              </li>
            </ul>
          </article>
        </aside>
      </section>
    </main>
  );
}
