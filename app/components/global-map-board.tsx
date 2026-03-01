"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { PublicMapEvent, PublicMapMarker } from "@/lib/board";

const LEAFLET_CSS_ID = "localclaws-leaflet-css";
const LEAFLET_SCRIPT_ID = "localclaws-leaflet-script";
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_SCRIPT_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

type LeafletLike = {
  map: (container: HTMLElement, options?: Record<string, unknown>) => LeafletMapLike;
  tileLayer: (url: string, options?: Record<string, unknown>) => LeafletLayerLike;
  marker: (latLng: [number, number], options?: Record<string, unknown>) => LeafletMarkerLike;
  divIcon: (options: Record<string, unknown>) => unknown;
  latLngBounds: (points: Array<[number, number]>) => unknown;
};

type LeafletMapLike = {
  setView: (center: [number, number], zoom: number) => void;
  fitBounds: (bounds: unknown, options?: Record<string, unknown>) => void;
  remove: () => void;
};

type LeafletLayerLike = {
  addTo: (map: LeafletMapLike) => void;
};

type LeafletMarkerLike = {
  addTo: (map: LeafletMapLike) => LeafletMarkerLike;
  on: (event: string, handler: () => void) => LeafletMarkerLike;
  setIcon: (icon: unknown) => void;
};

declare global {
  interface Window {
    L?: LeafletLike;
  }
}

type MapEventCard = PublicMapEvent & {
  cityLabel: string;
  detailHref: string;
};

type GlobalMapBoardProps = {
  events: MapEventCard[];
  markers: PublicMapMarker[];
  labels?: {
    mapTitle?: string;
    mapSubtitle?: string;
    mapAriaLabel?: string;
    mapUnavailablePrefix?: string;
    mapFallbackNote?: string;
    listTitle?: string;
    listSubtitle?: string;
    emptyTitle?: string;
    emptyHint?: string;
    parsedMarker?: string;
    clusterMarker?: string;
    fallbackMarker?: string;
    listOnlyMarker?: string;
    spotsRemainingSuffix?: string;
    viewDetails?: string;
  };
};

type MarkerHandle = {
  marker: LeafletMarkerLike;
  meetupIds: string[];
  source: PublicMapMarker["source"];
  count: number;
};

function ensureLeafletCss(): void {
  if (document.getElementById(LEAFLET_CSS_ID)) return;
  const link = document.createElement("link");
  link.id = LEAFLET_CSS_ID;
  link.rel = "stylesheet";
  link.href = LEAFLET_CSS_URL;
  link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
  link.crossOrigin = "";
  document.head.appendChild(link);
}

function loadLeafletScript(): Promise<LeafletLike> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Leaflet only loads in browser"));
  }
  if (window.L) {
    return Promise.resolve(window.L);
  }

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(LEAFLET_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.L) resolve(window.L);
      });
      existing.addEventListener("error", () => reject(new Error("Failed to load Leaflet script")));
      return;
    }

    const script = document.createElement("script");
    script.id = LEAFLET_SCRIPT_ID;
    script.src = LEAFLET_SCRIPT_URL;
    script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    script.crossOrigin = "";
    script.async = true;
    script.addEventListener("load", () => {
      if (window.L) {
        resolve(window.L);
      } else {
        reject(new Error("Leaflet loaded without window.L"));
      }
    });
    script.addEventListener("error", () => reject(new Error("Failed to load Leaflet script")));
    document.body.appendChild(script);
  });
}

function markerClassName(input: {
  source: PublicMapMarker["source"];
  count: number;
  active: boolean;
}): string {
  const classes = ["city-map-pin"];
  if (input.source === "city_fallback") classes.push("is-fallback");
  if (input.count > 1) classes.push("is-cluster");
  if (input.active) classes.push("is-active");
  return classes.join(" ");
}

function markerIconHtml(input: {
  source: PublicMapMarker["source"];
  count: number;
  active: boolean;
}): string {
  const label = input.count > 1 ? String(input.count) : "";
  const className = markerClassName(input);
  return `<span class="${className}" aria-hidden="true">${label}</span>`;
}

function markerIcon(
  L: LeafletLike,
  input: {
    source: PublicMapMarker["source"];
    count: number;
    active: boolean;
  },
) {
  return L.divIcon({
    className: "city-map-pin-wrap",
    html: markerIconHtml(input),
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

export function GlobalMapBoard(props: GlobalMapBoardProps) {
  const labels = {
    mapTitle: "World meetup map",
    mapSubtitle:
      "OpenStreetMap public context only. Exact venues remain private in invitation letters.",
    mapAriaLabel: "Global meetup map",
    mapUnavailablePrefix: "Map unavailable:",
    mapFallbackNote: "City-fallback markers are grouped with count badges.",
    listTitle: "Meetups",
    listSubtitle: "Select a card or marker to sync map focus with the list.",
    emptyTitle: "No open meetups in this window",
    emptyHint: "Try a wider date range.",
    parsedMarker: "Parsed map marker",
    clusterMarker: "City marker cluster",
    fallbackMarker: "City fallback marker",
    listOnlyMarker: "List only",
    spotsRemainingSuffix: "spots remaining",
    viewDetails: "View details",
    ...props.labels,
  };
  const [mapError, setMapError] = useState<string | null>(null);
  const [activeMeetupIds, setActiveMeetupIds] = useState<string[]>(
    props.events.length > 0 ? [props.events[0].meetupId] : [],
  );
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMapLike | null>(null);
  const markerHandlesRef = useRef<MarkerHandle[]>([]);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const eventById = useMemo(
    () => new Map(props.events.map((event) => [event.meetupId, event])),
    [props.events],
  );

  useEffect(() => {
    if (props.events.length === 0) {
      setActiveMeetupIds([]);
      return;
    }
    setActiveMeetupIds((current) =>
      current.length > 0 && eventById.has(current[0]) ? current : [props.events[0].meetupId],
    );
  }, [eventById, props.events]);

  useEffect(() => {
    ensureLeafletCss();
    let cancelled = false;

    const buildMap = async () => {
      if (!mapContainerRef.current) return;

      try {
        const L = await loadLeafletScript();
        if (cancelled || !mapContainerRef.current) return;
        setMapError(null);

        const map = L.map(mapContainerRef.current, { zoomControl: true });
        mapRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        const handles: MarkerHandle[] = [];
        const selected = new Set(activeMeetupIds);

        for (const item of props.markers) {
          const icon = markerIcon(L, {
            source: item.source,
            count: item.count,
            active: item.meetupIds.some((meetupId) => selected.has(meetupId)),
          });

          const marker = L.marker([item.lat, item.lon], { icon }).addTo(map);
          marker.on("click", () => {
            setActiveMeetupIds(item.meetupIds);
          });
          handles.push({
            marker,
            meetupIds: item.meetupIds,
            source: item.source,
            count: item.count,
          });
        }

        markerHandlesRef.current = handles;

        if (props.markers.length > 0) {
          const points = props.markers.map((marker) => [marker.lat, marker.lon] as [number, number]);
          map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 13 });
        } else {
          map.setView([20, 0], 2);
        }
      } catch (error) {
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : "Map failed to load");
        }
      }
    };

    buildMap();

    return () => {
      cancelled = true;
      markerHandlesRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [props.markers]);

  useEffect(() => {
    if (markerHandlesRef.current.length === 0 || !window.L) return;
    const selected = new Set(activeMeetupIds);

    for (const handle of markerHandlesRef.current) {
      const icon = markerIcon(window.L, {
        source: handle.source,
        count: handle.count,
        active: handle.meetupIds.some((meetupId) => selected.has(meetupId)),
      });
      handle.marker.setIcon(icon);
    }
  }, [activeMeetupIds]);

  useEffect(() => {
    if (activeMeetupIds.length === 0) return;
    const target = cardRefs.current.get(activeMeetupIds[0]);
    if (!target) return;
    target.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeMeetupIds]);

  return (
    <section className="map-board-layout section reveal delay-2">
      <article className="map-panel">
        <div className="map-panel-head">
          <h2>{labels.mapTitle}</h2>
          <p className="event-map-note">
            {labels.mapSubtitle}
          </p>
        </div>
        <div
          className="city-map-canvas"
          ref={mapContainerRef}
          role="application"
          aria-label={labels.mapAriaLabel}
        />
        {mapError ? <p className="event-map-note">{labels.mapUnavailablePrefix} {mapError}</p> : null}
        <p className="event-map-note">
          {labels.mapFallbackNote}
        </p>
      </article>

      <article className="map-list-panel">
        <div className="map-panel-head">
          <h2>{labels.listTitle} ({props.events.length})</h2>
          <p className="event-map-note">
            {labels.listSubtitle}
          </p>
        </div>

        <div className="map-event-list">
          {props.events.length === 0 ? (
            <article className="event-card event-card-empty">
              <h3>{labels.emptyTitle}</h3>
              <p>{labels.emptyHint}</p>
            </article>
          ) : (
            props.events.map((event) => {
              const isActive = activeMeetupIds.includes(event.meetupId);
              const hasMarker = Boolean(event.markerKey);
              const markerLabel =
                event.markerSource === "parsed_link"
                  ? labels.parsedMarker
                  : event.markerSource === "city_fallback"
                    ? event.markerClusterCount > 1
                      ? `${labels.clusterMarker} (${event.markerClusterCount})`
                      : labels.fallbackMarker
                    : labels.listOnlyMarker;

              return (
                <article
                  key={event.meetupId}
                  className={`event-card map-event-card${isActive ? " is-active" : ""}`}
                  ref={(node) => {
                    if (!node) {
                      cardRefs.current.delete(event.meetupId);
                    } else {
                      cardRefs.current.set(event.meetupId, node);
                    }
                  }}
                >
                  <button
                    type="button"
                    className="map-card-select"
                    onClick={() => setActiveMeetupIds([event.meetupId])}
                  >
                    <span className="event-card-time">{event.startHuman}</span>
                    <h3>{event.name}</h3>
                    <p className="event-card-location">
                      {event.cityLabel} | {event.district}
                    </p>
                    <div className="event-tag-row">
                      {event.tags.map((tag) => (
                        <span key={tag} className="event-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                  <div className="map-event-foot">
                    <span>{event.spotsRemaining} {labels.spotsRemainingSuffix}</span>
                    <span className={`map-marker-chip${hasMarker ? "" : " missing"}`}>
                      {markerLabel}
                    </span>
                  </div>
                  <div className="action-row">
                    <a className="event-detail-link" href={event.detailHref}>
                      {labels.viewDetails}
                    </a>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </article>
    </section>
  );
}
