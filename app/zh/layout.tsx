import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "/zh",
    languages: {
      en: "/",
      "zh-CN": "/zh",
    },
  },
};

export default function ZhLayout({ children }: { children: React.ReactNode }) {
  return <div lang="zh-CN">{children}</div>;
}
