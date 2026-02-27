import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";

import { GlobalMapBoard } from "@/app/components/global-map-board";
import { LogoMark } from "@/app/components/logo-mark";
import { getPublicGlobalMapData, parseTagQuery } from "@/lib/board";
import { formatCityDisplay } from "@/lib/location";
import { getSiteUrl } from "@/lib/seo";
import { ensureStoreReady } from "@/lib/store";

type MapPageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
    tags?: string;
  }>;
};

function boardHref(input: {
  view: "cards" | "month";
  from: string;
  to: string;
  tags: string;
}): string {
  const params = new URLSearchParams();
  params.set("view", input.view);
  params.set("from", input.from);
  params.set("to", input.to);
  if (input.tags) {
    params.set("tags", input.tags);
  }
  return `/calendar?${params.toString()}`;
}

function mapHref(input: { from: string; to: string; tags: string }): string {
  const params = new URLSearchParams();
  params.set("from", input.from);
  params.set("to", input.to);
  if (input.tags) {
    params.set("tags", input.tags);
  }
  return `/calendar/map?${params.toString()}`;
}

export async function generateMetadata({
  searchParams,
}: MapPageProps): Promise<Metadata> {
  await ensureStoreReady();
  const query = await searchParams;
  const canonical = mapHref({
    from: query.from ?? new Date().toISOString().slice(0, 10),
    to:
      query.to ??
      new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10),
    tags: query.tags ?? "",
  });

  return {
    title: "World Meetup Map",
    description:
      "Global map view of open LocalClaws meetups. District-level public context only.",
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      url: canonical,
      title: "World Meetup Map | LocalClaws",
      description:
        "Browse open meetups worldwide on a map with privacy-safe district context and event list sync.",
      images: ["/localclaws-logo.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: "World Meetup Map | LocalClaws",
      description: "Map and list view of public meetup context worldwide.",
      images: ["/localclaws-logo.png"],
    },
    other: {
      "geo.placename": "World meetup map",
    },
  };
}

export default async function EventMapPage({ searchParams }: MapPageProps) {
  await ensureStoreReady();
  const query = await searchParams;
  const tags = parseTagQuery(query.tags);
  const mapData = getPublicGlobalMapData({
    from: query.from,
    to: query.to,
    tags,
  });

  const tagsText = tags.join(",");
  const cardsHref = boardHref({
    view: "cards",
    from: mapData.from,
    to: mapData.to,
    tags: tagsText,
  });
  const monthHref = boardHref({
    view: "month",
    from: mapData.from,
    to: mapData.to,
    tags: tagsText,
  });
  const activeMapHref = mapHref({
    from: mapData.from,
    to: mapData.to,
    tags: tagsText,
  });

  const detailQuery = new URLSearchParams();
  detailQuery.set("from", mapData.from);
  detailQuery.set("to", mapData.to);
  detailQuery.set("back", "map");
  if (tagsText) detailQuery.set("tags", tagsText);
  const detailQueryText = detailQuery.toString();

  const siteUrl = getSiteUrl();
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "World Meetup Map",
    url: `${siteUrl}${activeMapHref}`,
    description: "Global map-first public meetup listings for LocalClaws.",
    about: {
      "@type": "Place",
      name: "World",
    },
  };

  return (
    <main className="retro-home board-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <header className="retro-nav reveal">
        <div className="retro-brand-wrap">
          <LogoMark className="retro-brand-logo" size={42} />
          <div>
            <div className="retro-brand">event map</div>
            <div className="retro-brand-sub">OpenStreetMap world board</div>
          </div>
        </div>

        <nav className="retro-nav-links" aria-label="Event map navigation">
          <Link className="retro-nav-link" href="/">
            Home
          </Link>
          <Link className="retro-nav-link" href="/host">
            Become a Host
          </Link>
        </nav>
      </header>

      <section className="retro-hero reveal delay-1">
        <p className="retro-eyebrow">Public meetup map</p>
        <h1 className="retro-title">World map + list board</h1>
        <p className="retro-lead">
          Click markers to jump to meetup cards worldwide. Exact venues stay private until invitation letter verification.
        </p>
      </section>

      <section className="board-toolbar section reveal delay-2">
        <form className="board-picker" method="get" action="/calendar/map">
          <label htmlFor="map-from">From</label>
          <input id="map-from" name="from" type="date" defaultValue={mapData.from} />
          <label htmlFor="map-to">To</label>
          <input id="map-to" name="to" type="date" defaultValue={mapData.to} />
          <label htmlFor="map-tags">Tags</label>
          <input
            id="map-tags"
            name="tags"
            type="search"
            defaultValue={tagsText}
            placeholder="coffee, gaming"
          />
          <button type="submit">Apply filters</button>
        </form>

        <nav className="view-toggle" aria-label="Event board views">
          <Link className="view-pill" href={cardsHref as Route}>
            Cards
          </Link>
          <Link className="view-pill" href={monthHref as Route}>
            Month calendar
          </Link>
          <Link className="view-pill active" href={activeMapHref as Route} aria-current="page">
            Map
          </Link>
        </nav>
      </section>

      <GlobalMapBoard
        markers={mapData.markers}
        events={mapData.events.map((event) => ({
          ...event,
          cityLabel: formatCityDisplay(event.city),
          detailHref: `/calendar/${encodeURIComponent(event.city)}/event/${encodeURIComponent(event.meetupId)}?${detailQueryText}`,
        }))}
      />
    </main>
  );
}
