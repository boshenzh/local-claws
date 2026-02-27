import { DEFAULT_PUBLIC_RADIUS_KM } from "@/lib/constants";
import { getCityCoordinates, resolveCityTimeZone } from "@/lib/location";
import { db } from "@/lib/store";
import { formatFriendlyInTimeZone, isValidIanaTimeZone } from "@/lib/time";

export type BoardView = "cards" | "month";

export type PublicMeetupDetail = {
  meetupId: string;
  name: string;
  city: string;
  district: string;
  publicRadiusKm: number;
  startAt: string;
  startLocal: string;
  tags: string[];
  spotsRemaining: number;
  publicMapCenter: { lat: number; lon: number; source: "parsed_link" } | null;
};

export type PublicMapMarkerSource = "parsed_link" | "city_fallback";

export type PublicMapEvent = {
  meetupId: string;
  name: string;
  city: string;
  district: string;
  startAt: string;
  startHuman: string;
  tags: string[];
  spotsRemaining: number;
  markerKey: string | null;
  markerLat: number | null;
  markerLon: number | null;
  markerSource: PublicMapMarkerSource | null;
  markerClusterCount: number;
  markerClusterMeetupIds: string[];
};

export type PublicMapMarker = {
  key: string;
  lat: number;
  lon: number;
  source: PublicMapMarkerSource;
  meetupIds: string[];
  count: number;
};

export type PublicGlobalMapData = {
  from: string;
  to: string;
  events: PublicMapEvent[];
  markers: PublicMapMarker[];
};

function normalizePublicRadiusKm(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return DEFAULT_PUBLIC_RADIUS_KM;
  return Math.max(1, Math.min(30, Math.round(value)));
}

function snapToPublicGrid(value: number, step: number): number {
  if (step <= 0 || Number.isNaN(step)) return value;
  return Math.round(value / step) * step;
}

function toPublicMapCenter(input: {
  lat: number | null | undefined;
  lon: number | null | undefined;
  radiusKm: number;
}): { lat: number; lon: number } | null {
  const lat = input.lat;
  const lon = input.lon;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  const stepLat = Math.max(input.radiusKm / 111, 0.02);
  const cos = Math.cos((lat * Math.PI) / 180);
  const stepLon = Math.max(stepLat / Math.max(0.2, cos), 0.02);
  return {
    lat: snapToPublicGrid(lat, stepLat),
    lon: snapToPublicGrid(lon, stepLon)
  };
}

export function normalizeBoardView(input: string | undefined): BoardView {
  if (input === "month") return "month";
  return "cards";
}

export function normalizeBoardTimeZone(input: string | undefined, city?: string): string {
  if (input && isValidIanaTimeZone(input)) {
    return input;
  }
  return city ? resolveCityTimeZone(city) : "America/Los_Angeles";
}

export function parseTagQuery(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getPublicMeetupDetail(input: {
  city: string;
  meetupId: string;
  tz?: string;
}): PublicMeetupDetail | null {
  const city = input.city.trim().toLowerCase();
  const meetup = db.meetups.find(
    (entry) =>
      entry.id === input.meetupId &&
      entry.city.toLowerCase() === city &&
      entry.status === "open"
  );

  if (!meetup) return null;

  const timezone = normalizeBoardTimeZone(input.tz, meetup.city);
  const confirmedCount = db.attendees.filter(
    (attendee) => attendee.meetupId === meetup.id && attendee.status === "confirmed"
  ).length;
  const publicRadiusKm = normalizePublicRadiusKm(meetup.publicRadiusKm);
  const parsedCenter = toPublicMapCenter({
    lat: meetup.privateLocationLat,
    lon: meetup.privateLocationLon,
    radiusKm: publicRadiusKm
  });

  return {
    meetupId: meetup.id,
    name: meetup.name,
    city: meetup.city,
    district: meetup.district,
    publicRadiusKm,
    startAt: meetup.startAt,
    startLocal: formatFriendlyInTimeZone(meetup.startAt, timezone),
    tags: meetup.tags,
    spotsRemaining: Math.max(0, meetup.maxParticipants - confirmedCount),
    publicMapCenter: parsedCenter ? { ...parsedCenter, source: "parsed_link" } : null
  };
}

function markerKeyFromCoordinates(lat: number, lon: number): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

export function getPublicGlobalMapData(input: {
  from?: string;
  to?: string;
  tags?: string[];
}): PublicGlobalMapData {
  const from = input.from ?? new Date().toISOString().slice(0, 10);
  const to = input.to ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T23:59:59Z`);
  const tagSet = new Set((input.tags ?? []).map((value) => value.toLowerCase()));

  const eventsBase: PublicMapEvent[] = db.meetups
    .filter((meetup) => meetup.status === "open")
    .filter((meetup) => {
      const date = new Date(meetup.startAt);
      return date >= fromDate && date <= toDate;
    })
    .filter((meetup) => {
      if (tagSet.size === 0) return true;
      return meetup.tags.some((tag) => tagSet.has(tag.toLowerCase()));
    })
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .map((meetup) => {
      const timezone = resolveCityTimeZone(meetup.city);
      const confirmedCount = db.attendees.filter(
        (attendee) => attendee.meetupId === meetup.id && attendee.status === "confirmed"
      ).length;
      const parsedCenter = toPublicMapCenter({
        lat: meetup.privateLocationLat,
        lon: meetup.privateLocationLon,
        radiusKm: normalizePublicRadiusKm(meetup.publicRadiusKm)
      });
      const cityCenter = getCityCoordinates(meetup.city);
      const markerCenter = parsedCenter ?? cityCenter;
      const markerSource: PublicMapMarkerSource | null = parsedCenter
        ? "parsed_link"
        : markerCenter
          ? "city_fallback"
          : null;
      const markerKey = markerCenter ? markerKeyFromCoordinates(markerCenter.lat, markerCenter.lon) : null;

      return {
        meetupId: meetup.id,
        name: meetup.name,
        city: meetup.city,
        district: meetup.district,
        startAt: meetup.startAt,
        startHuman: formatFriendlyInTimeZone(meetup.startAt, timezone),
        tags: meetup.tags,
        spotsRemaining: Math.max(0, meetup.maxParticipants - confirmedCount),
        markerKey,
        markerLat: markerCenter?.lat ?? null,
        markerLon: markerCenter?.lon ?? null,
        markerSource,
        markerClusterCount: 0,
        markerClusterMeetupIds: []
      };
    });

  const clusters = new Map<string, string[]>();
  for (const event of eventsBase) {
    if (!event.markerKey) continue;
    const existing = clusters.get(event.markerKey) ?? [];
    existing.push(event.meetupId);
    clusters.set(event.markerKey, existing);
  }

  const markersByKey = new Map<string, PublicMapMarker>();
  for (const event of eventsBase) {
    if (!event.markerKey || event.markerLat === null || event.markerLon === null || !event.markerSource) continue;
    if (markersByKey.has(event.markerKey)) continue;
    const meetupIds = clusters.get(event.markerKey) ?? [event.meetupId];
    markersByKey.set(event.markerKey, {
      key: event.markerKey,
      lat: event.markerLat,
      lon: event.markerLon,
      source: event.markerSource,
      meetupIds,
      count: meetupIds.length
    });
  }

  const events = eventsBase.map((event) => {
    const meetupIds = event.markerKey ? clusters.get(event.markerKey) ?? [] : [];
    return {
      ...event,
      markerClusterCount: meetupIds.length,
      markerClusterMeetupIds: meetupIds
    };
  });

  return {
    from,
    to,
    events,
    markers: Array.from(markersByKey.values())
  };
}
