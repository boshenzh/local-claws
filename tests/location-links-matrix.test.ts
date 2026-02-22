import assert from "node:assert/strict";
import test from "node:test";

import { parsePrivateLocationLink } from "../lib/location-links";

function approxEqual(actual: number | null, expected: number, tolerance = 0.0001): void {
  assert.ok(actual !== null, "expected coordinate, got null");
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${expected}, got ${actual}`);
}

test("parses Google Maps link", () => {
  const result = parsePrivateLocationLink("https://maps.google.com/?q=47.6205,-122.3493");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.venue.provider, "google_maps");
  assert.equal(result.venue.parseStatus, "parsed_exact");
  approxEqual(result.venue.latitude, 47.6205);
  approxEqual(result.venue.longitude, -122.3493);
});

test("parses Apple Maps link", () => {
  const result = parsePrivateLocationLink("https://maps.apple.com/?ll=47.6205,-122.3493&q=Pike+Place+Market");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.venue.provider, "apple_maps");
  assert.equal(result.venue.parseStatus, "parsed_exact");
  assert.equal(result.venue.label, "Pike Place Market");
});

test("parses Amap link", () => {
  const result = parsePrivateLocationLink("https://uri.amap.com/marker?position=116.481488,39.990464&name=Guomao");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.venue.provider, "amap");
  assert.equal(result.venue.parseStatus, "parsed_exact");
  approxEqual(result.venue.latitude, 39.990464);
  approxEqual(result.venue.longitude, 116.481488);
});

test("parses Bing Maps cp format", () => {
  const result = parsePrivateLocationLink("https://www.bing.com/maps?cp=47.6205~-122.3493&lvl=15&q=Pike+Place+Market");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.venue.provider, "other");
  assert.equal(result.venue.providerHost, "www.bing.com");
  assert.equal(result.venue.parseStatus, "parsed_exact");
  approxEqual(result.venue.latitude, 47.6205);
  approxEqual(result.venue.longitude, -122.3493);
});

test("parses OpenStreetMap hash format", () => {
  const result = parsePrivateLocationLink("https://www.openstreetmap.org/#map=16/47.6205/-122.3493");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.venue.provider, "other");
  assert.equal(result.venue.providerHost, "www.openstreetmap.org");
  assert.equal(result.venue.parseStatus, "parsed_exact");
  approxEqual(result.venue.latitude, 47.6205);
  approxEqual(result.venue.longitude, -122.3493);
});

test("parses Kakao map link with path coordinates", () => {
  const result = parsePrivateLocationLink("https://map.kakao.com/link/map/COEX,37.5123,127.0583");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.venue.provider, "other");
  assert.equal(result.venue.providerHost, "map.kakao.com");
  assert.equal(result.venue.parseStatus, "parsed_exact");
  approxEqual(result.venue.latitude, 37.5123);
  approxEqual(result.venue.longitude, 127.0583);
});

test("parses generic provider with lat/lng params", () => {
  const result = parsePrivateLocationLink("https://maps.example.com/pin?lat=47.6097&lng=-122.3331&name=Downtown+Seattle");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.venue.provider, "other");
  assert.equal(result.venue.parseStatus, "parsed_exact");
  assert.equal(result.venue.label, "Downtown Seattle");
});

test("returns parsed_partial when only place label exists", () => {
  const result = parsePrivateLocationLink("https://maps.example.com/?q=Guomao+Starbucks");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.venue.provider, "other");
  assert.equal(result.venue.parseStatus, "parsed_partial");
  assert.equal(result.venue.label, "Guomao Starbucks");
});

test("rejects non-URL input", () => {
  const result = parsePrivateLocationLink("not a url");
  assert.equal(result.ok, false);
});
