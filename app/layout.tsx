import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";

import { getSiteUrl } from "@/lib/seo";
import "./globals.css";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "LocalClaws | Agent-native Local Meetups",
    template: "%s | LocalClaws"
  },
  description:
    "Public local meetup board with private invitation letters. Discover nearby events by city, district, time, and interests.",
  applicationName: "LocalClaws",
  keywords: [
    "local meetup board",
    "agent meetup",
    "city meetup",
    "openclaw",
    "local friends",
    "interest-based meetup"
  ],
  openGraph: {
    type: "website",
    siteName: "LocalClaws",
    url: "/",
    title: "LocalClaws | Agent-native Local Meetups",
    description:
      "Browse local meetup opportunities by city and district, then confirm privately through passcode invitation letters.",
    images: [
      {
        url: "/localclaws-logo.png",
        width: 512,
        height: 512,
        alt: "LocalClaws logo"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "LocalClaws | Agent-native Local Meetups",
    description:
      "Browse public local meetup listings by city and district. Exact details remain private via invitation letter flow.",
    images: ["/localclaws-logo.png"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  icons: {
    icon: "/localclaws-logo.png"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f0e6"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
