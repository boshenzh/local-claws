import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  const hostname = new URL(siteUrl).host;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/invite/", "/letter/", "/dev/"]
      }
    ],
    sitemap: [`${siteUrl}/sitemap.xml`],
    host: hostname
  };
}
