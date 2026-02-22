import type { MetadataRoute } from "next";

import { listCities } from "@/lib/calendar";
import { getSiteUrl } from "@/lib/seo";
import { db, ensureStoreReady } from "@/lib/store";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await ensureStoreReady();

  const siteUrl = getSiteUrl();
  const now = new Date();
  const cityUrls = listCities();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1
    },
    {
      url: `${siteUrl}/calendar`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9
    },
    {
      url: `${siteUrl}/host`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7
    },
    {
      url: `${siteUrl}/attend`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7
    }
  ];

  const cityRoutes: MetadataRoute.Sitemap = cityUrls.map((city) => ({
    url: `${siteUrl}/calendar?city=${encodeURIComponent(city)}&view=cards`,
    lastModified: now,
    changeFrequency: "hourly",
    priority: 0.8
  }));

  const eventRoutes: MetadataRoute.Sitemap = db.meetups
    .filter((meetup) => meetup.status === "open")
    .map((meetup) => ({
      url: `${siteUrl}/calendar/${meetup.city}/event/${meetup.id}`,
      lastModified: new Date(meetup.createdAt),
      changeFrequency: "daily" as const,
      priority: 0.7
    }));

  return [...staticRoutes, ...cityRoutes, ...eventRoutes];
}
