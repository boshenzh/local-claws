import { redirect } from "next/navigation";

type LegacyCityPageProps = {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ from?: string; to?: string; tz?: string; tags?: string; view?: string }>;
};

export default async function LegacyCityCalendarPage({ params, searchParams }: LegacyCityPageProps) {
  const [{ city }, query] = await Promise.all([params, searchParams]);

  const nextParams = new URLSearchParams();
  nextParams.set("city", city.trim().toLowerCase());
  nextParams.set("view", query.view === "cards" || query.view === "month" ? query.view : "month");

  if (typeof query.from === "string") {
    nextParams.set("from", query.from);
  }
  if (typeof query.to === "string") {
    nextParams.set("to", query.to);
  }
  if (typeof query.tz === "string") {
    nextParams.set("tz", query.tz);
  }
  if (typeof query.tags === "string") {
    nextParams.set("tags", query.tags);
  }

  redirect(`/calendar?${nextParams.toString()}`);
}
