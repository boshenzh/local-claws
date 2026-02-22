import type { PrivateLocationParseStatus, PrivateLocationProvider } from "./types";

type CoordinateOrder = "lat_lon" | "lon_lat";

export type ParsedPrivateLocation = {
  provider: PrivateLocationProvider;
  providerHost: string;
  canonicalUrl: string;
  label: string | null;
  latitude: number | null;
  longitude: number | null;
  parseStatus: PrivateLocationParseStatus;
};

export type ParsePrivateLocationResult =
  | { ok: true; venue: ParsedPrivateLocation }
  | { ok: false; error: string };

type ParsedPrivateLocationFields = Omit<
  ParsedPrivateLocation,
  "provider" | "providerHost" | "canonicalUrl" | "parseStatus"
>;

const GOOGLE_HOST_MARKERS = ["google.", "maps.app.goo.gl", "goo.gl"];
const APPLE_HOST_MARKERS = ["maps.apple.com"];
const AMAP_HOST_MARKERS = ["amap.com", "gaode.com"];
const LABEL_PARAM_KEYS = ["q", "query", "name", "title", "address", "poi", "poiname", "destName", "destination", "place"];
const LAT_KEYS = ["lat", "latitude", "y"];
const LON_KEYS = ["lng", "lon", "long", "longitude", "x"];
const PAIR_KEYS_LAT_LON = ["ll", "sll", "center", "location", "loc", "coords", "coordinate", "coordinates", "point", "latlng", "dest", "to", "cp"];
const PAIR_KEYS_LON_LAT = ["position"];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function decodeField(value: string | null): string | null {
  if (!value) return null;
  const plusNormalized = value.replace(/\+/g, " ");
  let decoded = plusNormalized;
  try {
    decoded = decodeURIComponent(plusNormalized);
  } catch {
    decoded = plusNormalized;
  }
  const cleaned = normalizeWhitespace(decoded);
  return cleaned || null;
}

function parseCoordinatePair(value: string | null, order: CoordinateOrder): { lat: number; lon: number } | null {
  if (!value) return null;
  const normalized = decodeField(value);
  if (!normalized) return null;
  const numbers = normalized.match(/-?\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length < 2) return null;

  const first = Number.parseFloat(numbers[0]);
  const second = Number.parseFloat(numbers[1]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;

  const lat = order === "lat_lon" ? first : second;
  const lon = order === "lat_lon" ? second : first;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

function looksLikeCoordinates(value: string): boolean {
  return parseCoordinatePair(value, "lat_lon") !== null;
}

function parsePairFromParams(url: URL, keys: string[], order: CoordinateOrder): { lat: number; lon: number } | null {
  for (const key of keys) {
    const raw = url.searchParams.get(key);
    const candidate =
      parseCoordinatePair(raw, order) ??
      (order === "lat_lon" ? parseCoordinatePair(raw, "lon_lat") : parseCoordinatePair(raw, "lat_lon"));
    if (candidate) return candidate;
  }
  return null;
}

function parseSeparateLatLonFromParams(url: URL): { lat: number; lon: number } | null {
  let latValue: number | null = null;
  let lonValue: number | null = null;

  for (const key of LAT_KEYS) {
    const raw = url.searchParams.get(key);
    if (!raw) continue;
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed >= -90 && parsed <= 90) {
      latValue = parsed;
      break;
    }
  }

  for (const key of LON_KEYS) {
    const raw = url.searchParams.get(key);
    if (!raw) continue;
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed >= -180 && parsed <= 180) {
      lonValue = parsed;
      break;
    }
  }

  if (latValue === null || lonValue === null) return null;
  return { lat: latValue, lon: lonValue };
}

function findCoordinatesInText(raw: string): { lat: number; lon: number } | null {
  const text = decodeField(raw) ?? raw;
  const pattern = /(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/g;
  let match: RegExpExecArray | null = pattern.exec(text);
  while (match) {
    const candidate = parseCoordinatePair(`${match[1]},${match[2]}`, "lat_lon");
    if (candidate) return candidate;
    match = pattern.exec(text);
  }

  const osmHashPattern = /map=\d{1,2}\/(-?\d{1,2}(?:\.\d+)?)\/(-?\d{1,3}(?:\.\d+)?)/;
  const osmMatch = text.match(osmHashPattern);
  if (osmMatch) {
    const candidate = parseCoordinatePair(`${osmMatch[1]},${osmMatch[2]}`, "lat_lon");
    if (candidate) return candidate;
  }

  const tildePattern = /(-?\d{1,2}(?:\.\d+)?)\s*~\s*(-?\d{1,3}(?:\.\d+)?)/;
  const tildeMatch = text.match(tildePattern);
  if (tildeMatch) {
    const candidate = parseCoordinatePair(`${tildeMatch[1]},${tildeMatch[2]}`, "lat_lon");
    if (candidate) return candidate;
  }

  return null;
}

function parseGenericCoordinates(url: URL): { lat: number; lon: number } | null {
  const fromParams =
    parsePairFromParams(url, PAIR_KEYS_LAT_LON, "lat_lon") ??
    parsePairFromParams(url, PAIR_KEYS_LON_LAT, "lon_lat") ??
    parseSeparateLatLonFromParams(url);
  if (fromParams) return fromParams;

  const fromPath = findCoordinatesInText(`${url.pathname}${url.search}${url.hash}`);
  if (fromPath) return fromPath;
  return null;
}

function parseGenericLabel(url: URL): string | null {
  for (const key of LABEL_PARAM_KEYS) {
    const value = decodeField(url.searchParams.get(key));
    if (!value || looksLikeCoordinates(value)) continue;
    return value;
  }

  const pathSegments = url.pathname
    .split("/")
    .map((segment) => decodeField(segment))
    .filter((segment): segment is string => Boolean(segment));
  for (let index = pathSegments.length - 1; index >= 0; index -= 1) {
    const segment = pathSegments[index];
    if (looksLikeCoordinates(segment)) continue;
    if (/^[\d\W_]+$/.test(segment)) continue;
    return segment;
  }

  return null;
}

function getProvider(hostname: string): PrivateLocationProvider | null {
  const host = hostname.toLowerCase();
  if (GOOGLE_HOST_MARKERS.some((marker) => host.includes(marker))) return "google_maps";
  if (APPLE_HOST_MARKERS.some((marker) => host.includes(marker))) return "apple_maps";
  if (AMAP_HOST_MARKERS.some((marker) => host.includes(marker))) return "amap";
  return "other";
}

function parseGoogle(url: URL): ParsedPrivateLocationFields {
  const coordinateCandidates = [
    parseCoordinatePair(url.searchParams.get("ll"), "lat_lon"),
    parseCoordinatePair(url.searchParams.get("sll"), "lat_lon"),
    parseCoordinatePair(url.searchParams.get("center"), "lat_lon"),
    parseCoordinatePair(url.searchParams.get("q"), "lat_lon")
  ];
  let coordinates = coordinateCandidates.find((entry) => Boolean(entry)) ?? null;

  if (!coordinates) {
    const atPathMatch = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (atPathMatch) {
      coordinates = parseCoordinatePair(`${atPathMatch[1]},${atPathMatch[2]}`, "lat_lon");
    }
  }
  if (!coordinates) {
    const bangMatch = `${url.pathname}${url.search}${url.hash}`.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (bangMatch) {
      coordinates = parseCoordinatePair(`${bangMatch[1]},${bangMatch[2]}`, "lat_lon");
    }
  }

  const query = decodeField(url.searchParams.get("q")) ?? decodeField(url.searchParams.get("query"));
  let label = query && !looksLikeCoordinates(query) ? query : null;
  if (!label) {
    const placeMatch = url.pathname.match(/\/place\/([^/]+)/);
    label = placeMatch ? decodeField(placeMatch[1]) : null;
  }

  return {
    label,
    latitude: coordinates?.lat ?? null,
    longitude: coordinates?.lon ?? null
  };
}

function parseApple(url: URL): ParsedPrivateLocationFields {
  const coordinates =
    parseCoordinatePair(url.searchParams.get("ll"), "lat_lon") ??
    parseCoordinatePair(url.searchParams.get("sll"), "lat_lon");
  const label = decodeField(url.searchParams.get("q")) ?? decodeField(url.searchParams.get("address"));

  return {
    label,
    latitude: coordinates?.lat ?? null,
    longitude: coordinates?.lon ?? null
  };
}

function parseAmap(url: URL): ParsedPrivateLocationFields {
  const coordinates =
    parseCoordinatePair(url.searchParams.get("position"), "lon_lat") ??
    parseCoordinatePair(url.searchParams.get("location"), "lon_lat") ??
    parseCoordinatePair(url.searchParams.get("center"), "lon_lat") ??
    parseCoordinatePair(url.searchParams.get("dest"), "lon_lat") ??
    parseCoordinatePair(url.searchParams.get("to"), "lon_lat");

  const label =
    decodeField(url.searchParams.get("name")) ??
    decodeField(url.searchParams.get("destName")) ??
    decodeField(url.searchParams.get("q")) ??
    decodeField(url.searchParams.get("poiname"));

  return {
    label,
    latitude: coordinates?.lat ?? null,
    longitude: coordinates?.lon ?? null
  };
}

function parseWithProvider(url: URL, provider: PrivateLocationProvider): ParsedPrivateLocationFields {
  if (provider === "google_maps" || provider === "apple_maps" || provider === "amap") {
    const specific = provider === "google_maps" ? parseGoogle(url) : provider === "apple_maps" ? parseApple(url) : parseAmap(url);
    if (specific.latitude !== null && specific.longitude !== null && specific.label) return specific;

    const genericCoordinates = parseGenericCoordinates(url);
    return {
      label: specific.label ?? parseGenericLabel(url),
      latitude: specific.latitude ?? genericCoordinates?.lat ?? null,
      longitude: specific.longitude ?? genericCoordinates?.lon ?? null
    };
  }

  const genericCoordinates = parseGenericCoordinates(url);
  return {
    label: parseGenericLabel(url),
    latitude: genericCoordinates?.lat ?? null,
    longitude: genericCoordinates?.lon ?? null
  };
}

function parseUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    try {
      return new URL(`https://${input}`);
    } catch {
      return null;
    }
  }
}

function deriveParseStatus(input: { label: string | null; latitude: number | null; longitude: number | null }): PrivateLocationParseStatus {
  if (input.latitude !== null && input.longitude !== null) return "parsed_exact";
  if (input.label) return "parsed_partial";
  return "unresolved";
}

export function parsePrivateLocationLink(raw: string): ParsePrivateLocationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "private_location_link is required" };
  }

  const url = parseUrl(trimmed);
  if (!url) {
    return { ok: false, error: "private_location_link must be a valid URL" };
  }

  const provider = getProvider(url.hostname);
  if (!provider) return { ok: false, error: "private_location_link must be a valid URL" };

  const parsed = parseWithProvider(url, provider);
  const parseStatus = deriveParseStatus(parsed);

  return {
    ok: true,
    venue: {
      provider,
      providerHost: url.hostname.toLowerCase(),
      canonicalUrl: url.toString(),
      label: parsed.label,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      parseStatus
    }
  };
}
