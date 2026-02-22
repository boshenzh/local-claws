const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  seattle: { lat: 47.6062, lon: -122.3321 },
  portland: { lat: 45.5152, lon: -122.6784 },
  sanfrancisco: { lat: 37.7749, lon: -122.4194 },
  sanjose: { lat: 37.3382, lon: -121.8863 },
  losangeles: { lat: 34.0522, lon: -118.2437 },
  sandiego: { lat: 32.7157, lon: -117.1611 },
  denver: { lat: 39.7392, lon: -104.9903 },
  phoenix: { lat: 33.4484, lon: -112.074 },
  chicago: { lat: 41.8781, lon: -87.6298 },
  austin: { lat: 30.2672, lon: -97.7431 },
  dallas: { lat: 32.7767, lon: -96.797 },
  houston: { lat: 29.7604, lon: -95.3698 },
  miami: { lat: 25.7617, lon: -80.1918 },
  atlanta: { lat: 33.749, lon: -84.388 },
  boston: { lat: 42.3601, lon: -71.0589 },
  newyork: { lat: 40.7128, lon: -74.006 },
  washingtondc: { lat: 38.9072, lon: -77.0369 }
};

const CITY_ALIASES: Record<string, string> = {
  "san francisco": "sanfrancisco",
  "san-francisco": "sanfrancisco",
  sf: "sanfrancisco",
  "san jose": "sanjose",
  "san-jose": "sanjose",
  "los angeles": "losangeles",
  "los-angeles": "losangeles",
  la: "losangeles",
  "new york": "newyork",
  "new-york": "newyork",
  nyc: "newyork",
  "washington dc": "washingtondc",
  "washington, dc": "washingtondc",
  "washington d c": "washingtondc",
  dc: "washingtondc"
};

const CITY_DISPLAY: Record<string, string> = {
  sanfrancisco: "San Francisco",
  sanjose: "San Jose",
  losangeles: "Los Angeles",
  newyork: "New York",
  washingtondc: "Washington, DC"
};

export function toCityKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z]/g, "");
}

export function normalizeCityInput(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return "";

  const compact = trimmed.replace(/[\s_-]+/g, "");
  const keyed = toCityKey(trimmed);
  const alias = CITY_ALIASES[trimmed] ?? CITY_ALIASES[compact] ?? CITY_ALIASES[keyed];
  if (alias) return alias;
  if (CITY_COORDS[trimmed]) return trimmed;
  if (CITY_COORDS[compact]) return compact;
  return keyed || compact;
}

export function listMajorCities(): string[] {
  return Object.keys(CITY_COORDS);
}

export function getCityCoordinates(input: string): { lat: number; lon: number } | null {
  const key = normalizeCityInput(input);
  const coords = CITY_COORDS[key];
  if (!coords) return null;
  return { ...coords };
}

export function formatCityDisplay(input: string): string {
  const normalized = normalizeCityInput(input);
  const knownDisplay = CITY_DISPLAY[normalized];
  if (knownDisplay) return knownDisplay;
  return input
    .split(/\s+|-/)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return r * c;
}

function nearestCity(fromCity: string, cities: string[]): string | null {
  const fromKey = normalizeCityInput(fromCity);
  const from = CITY_COORDS[fromKey];
  if (!from) return null;

  let best: { city: string; distance: number } | null = null;
  for (const city of cities) {
    const key = normalizeCityInput(city);
    const target = CITY_COORDS[key];
    if (!target || key === fromKey) continue;
    const distance = haversine(from, target);
    if (!best || distance < best.distance) {
      best = { city, distance };
    }
  }
  return best?.city ?? null;
}

export function inferVisitorCity(headers: Headers): string | null {
  const candidates = [
    headers.get("x-vercel-ip-city"),
    headers.get("x-geo-city"),
    headers.get("cf-ipcity"),
    headers.get("x-appengine-city")
  ];

  for (const value of candidates) {
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    return trimmed.toLowerCase();
  }

  return null;
}

export type CityRecommendation = {
  visitorCity: string | null;
  activeCity: string | null;
  nearestCity: string | null;
  hasLocalEvents: boolean;
};

export function recommendCity(availableCities: string[], visitorCity: string | null): CityRecommendation {
  if (availableCities.length === 0) {
    return {
      visitorCity,
      activeCity: null,
      nearestCity: null,
      hasLocalEvents: false
    };
  }

  if (!visitorCity) {
    return {
      visitorCity: null,
      activeCity: availableCities[0],
      nearestCity: null,
      hasLocalEvents: false
    };
  }

  const visitorKey = normalizeCityInput(visitorCity);
  const local = availableCities.find((city) => normalizeCityInput(city) === visitorKey) ?? null;
  if (local) {
    return {
      visitorCity,
      activeCity: local,
      nearestCity: null,
      hasLocalEvents: true
    };
  }

  const near = nearestCity(visitorCity, availableCities);
  return {
    visitorCity,
    activeCity: near ?? availableCities[0],
    nearestCity: near,
    hasLocalEvents: false
  };
}

export function orderCitiesByRecommendation(availableCities: string[], rec: CityRecommendation): string[] {
  const base = [...availableCities];
  if (!rec.activeCity) return base;
  return base.sort((a, b) => {
    if (a === rec.activeCity) return -1;
    if (b === rec.activeCity) return 1;
    return a.localeCompare(b);
  });
}
