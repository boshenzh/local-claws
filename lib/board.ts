import { DEFAULT_PUBLIC_RADIUS_KM } from "@/lib/constants";
import { resolveCityTimeZone } from "@/lib/location";
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
