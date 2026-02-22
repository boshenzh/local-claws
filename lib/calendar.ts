import { DEFAULT_TZ } from "@/lib/constants";
import { db } from "@/lib/store";
import { formatFriendlyInTimeZone, formatInTimeZone, isValidIanaTimeZone, toIcsUtcStamp } from "@/lib/time";

export type CalendarEvent = {
  meetup_id: string;
  name: string;
  district: string;
  start_at: string;
  start_local: string;
  start_human: string;
  spots_remaining: number;
  tags: string[];
};

export function listCities(): string[] {
  const set = new Set<string>();
  for (const meetup of db.meetups) {
    set.add(meetup.city.toLowerCase());
  }
  return Array.from(set).sort();
}

export function getCityCalendar(input: {
  city: string;
  from?: string;
  to?: string;
  tz?: string;
  tags?: string[];
}): { city: string; timezone: string; from: string; to: string; events: CalendarEvent[] } {
  const timezone = input.tz && isValidIanaTimeZone(input.tz) ? input.tz : DEFAULT_TZ;
  const from = input.from ?? new Date().toISOString().slice(0, 10);
  const to = input.to ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);

  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T23:59:59Z`);
  const tagSet = new Set((input.tags ?? []).map((value) => value.toLowerCase()));

  const events = db.meetups
    .filter((meetup) => meetup.city.toLowerCase() === input.city.toLowerCase())
    .filter((meetup) => meetup.status === "open")
    .filter((meetup) => {
      const date = new Date(meetup.startAt);
      return date >= fromDate && date <= toDate;
    })
    .filter((meetup) => {
      if (tagSet.size === 0) return true;
      return meetup.tags.some((tag) => tagSet.has(tag.toLowerCase()));
    })
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .map((meetup) => {
      const attendees = db.attendees.filter((attendee) => attendee.meetupId === meetup.id && attendee.status === "confirmed").length;
      return {
        meetup_id: meetup.id,
        name: meetup.name,
        district: meetup.district,
        start_at: meetup.startAt,
        start_local: formatInTimeZone(meetup.startAt, timezone),
        start_human: formatFriendlyInTimeZone(meetup.startAt, timezone),
        spots_remaining: Math.max(0, meetup.maxParticipants - attendees),
        tags: meetup.tags
      };
    });

  return {
    city: input.city.toLowerCase(),
    timezone,
    from,
    to,
    events
  };
}

export function toIcs(calendar: { city: string; timezone: string; events: CalendarEvent[] }): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LocalClaws//City Calendar//EN",
    "CALSCALE:GREGORIAN"
  ];

  for (const event of calendar.events) {
    const meetup = db.meetups.find((entry) => entry.id === event.meetup_id);
    if (!meetup) continue;
    const start = toIcsUtcStamp(event.start_at);
    const end = toIcsUtcStamp(new Date(new Date(event.start_at).getTime() + 1000 * 60 * 90).toISOString());
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.meetup_id}@localclaws.com`);
    lines.push(`DTSTAMP:${toIcsUtcStamp(new Date().toISOString())}`);
    lines.push(`DTSTART:${start}`);
    lines.push(`DTEND:${end}`);
    lines.push(`SUMMARY:${event.name}`);
    lines.push(`DESCRIPTION:City=${calendar.city}; District=${event.district}; Tags=${event.tags.join(",")}`);
    lines.push(`LOCATION:${event.district}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
