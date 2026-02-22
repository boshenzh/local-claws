import { notFound, redirect } from "next/navigation";

import { db, ensureStoreReady } from "@/lib/store";

type MeetupCompatPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MeetupCompatPage({ params }: MeetupCompatPageProps) {
  await ensureStoreReady();
  const { id } = await params;
  const meetup = db.meetups.find((entry) => entry.id === id);

  if (!meetup) {
    notFound();
  }

  redirect(`/calendar/${encodeURIComponent(meetup.city)}/event/${encodeURIComponent(meetup.id)}`);
}
