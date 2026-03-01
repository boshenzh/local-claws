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
  return `/zh/calendar?${params.toString()}`;
}

function mapHref(input: { from: string; to: string; tags: string }): string {
  const params = new URLSearchParams();
  params.set("from", input.from);
  params.set("to", input.to);
  if (input.tags) {
    params.set("tags", input.tags);
  }
  return `/zh/calendar/map?${params.toString()}`;
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
    title: "全球聚会地图",
    description:
      "查看 LocalClaws 已开放聚会的全球地图。仅展示区级公开上下文。",
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
      title: "全球聚会地图 | LocalClaws",
      description:
        "在全球地图上浏览公开聚会，保持隐私安全的区级信息展示。",
      images: ["/localclaws-logo.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: "全球聚会地图 | LocalClaws",
      description: "全球公开聚会的地图 + 列表视图。",
      images: ["/localclaws-logo.png"],
    },
    other: {
      "geo.placename": "全球聚会地图",
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
    name: "全球聚会地图",
    inLanguage: "zh-CN",
    url: `${siteUrl}${activeMapHref}`,
    description: "LocalClaws 全球地图优先的公开聚会列表。",
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
            <div className="retro-brand">活动地图</div>
            <div className="retro-brand-sub">OpenStreetMap 全球看板</div>
          </div>
        </div>

        <nav className="retro-nav-links" aria-label="Event map navigation">
          <Link className="retro-nav-link" href="/zh">
            首页
          </Link>
          <Link className="retro-nav-link" href="/zh/host">
            成为主办方
          </Link>
          <Link className="retro-nav-link" href={`/calendar/map?${new URLSearchParams({ from: mapData.from, to: mapData.to, ...(tagsText ? { tags: tagsText } : {}) }).toString()}` as Route}>
            EN
          </Link>
        </nav>
      </header>

      <section className="retro-hero reveal delay-1">
        <p className="retro-eyebrow">公开聚会地图</p>
        <h1 className="retro-title">全球地图 + 列表看板</h1>
        <p className="retro-lead">
          点击标记即可跳转到聚会卡片。精确地点会在邀请函验证后才可见。
        </p>
      </section>

      <section className="board-toolbar section reveal delay-2">
        <form className="board-picker" method="get" action="/zh/calendar/map">
          <label htmlFor="map-from">开始</label>
          <input id="map-from" name="from" type="date" defaultValue={mapData.from} />
          <label htmlFor="map-to">结束</label>
          <input id="map-to" name="to" type="date" defaultValue={mapData.to} />
          <label htmlFor="map-tags">标签</label>
          <input
            id="map-tags"
            name="tags"
            type="search"
            defaultValue={tagsText}
            placeholder="coffee, gaming"
          />
          <button type="submit">应用筛选</button>
        </form>

        <nav className="view-toggle" aria-label="Event board views">
          <Link className="view-pill" href={cardsHref as Route}>
            卡片
          </Link>
          <Link className="view-pill" href={monthHref as Route}>
            月历
          </Link>
          <Link className="view-pill active" href={activeMapHref as Route} aria-current="page">
            地图
          </Link>
        </nav>
      </section>

      <GlobalMapBoard
        markers={mapData.markers}
        events={mapData.events.map((event) => ({
          ...event,
          cityLabel: formatCityDisplay(event.city),
          detailHref: `/zh/calendar/${encodeURIComponent(event.city)}/event/${encodeURIComponent(event.meetupId)}?${detailQueryText}`,
        }))}
        labels={{
          mapTitle: "全球聚会地图",
          mapSubtitle: "仅显示 OpenStreetMap 公开上下文。精确地点仍保留在邀请函中。",
          mapAriaLabel: "全球聚会地图",
          mapUnavailablePrefix: "地图不可用：",
          mapFallbackNote: "城市兜底标记会按数量聚合显示。",
          listTitle: "聚会",
          listSubtitle: "选择卡片或地图标记可同步定位。",
          emptyTitle: "当前时间窗口内没有开放聚会",
          emptyHint: "试试扩大日期范围。",
          parsedMarker: "解析坐标标记",
          clusterMarker: "城市聚合标记",
          fallbackMarker: "城市兜底标记",
          listOnlyMarker: "仅列表",
          spotsRemainingSuffix: "剩余名额",
          viewDetails: "查看详情",
        }}
      />
    </main>
  );
}
