export function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function formatInTimeZone(isoDate: string, timeZone: string): string {
  const date = new Date(isoDate);
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return `${map.get("year")}-${map.get("month")}-${map.get("day")}T${map.get("hour")}:${map.get("minute")}:${map.get("second")}`;
}

type LocalDateParts = { year: number; month: number; day: number };

function localDateParts(date: Date, timeZone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number.parseInt(map.get("year") ?? "0", 10),
    month: Number.parseInt(map.get("month") ?? "1", 10),
    day: Number.parseInt(map.get("day") ?? "1", 10)
  };
}

function dayDeltaInTimeZone(target: Date, now: Date, timeZone: string): number {
  const targetParts = localDateParts(target, timeZone);
  const nowParts = localDateParts(now, timeZone);
  const targetUtc = Date.UTC(targetParts.year, targetParts.month - 1, targetParts.day);
  const nowUtc = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day);
  return Math.round((targetUtc - nowUtc) / 86400000);
}

export function formatFriendlyInTimeZone(isoDate: string, timeZone: string, now: Date = new Date()): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  const dayDelta = dayDeltaInTimeZone(date, now, timeZone);
  const timeLabel = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date);

  let dayLabel: string;
  if (dayDelta === 0) {
    dayLabel = "Today";
  } else if (dayDelta === 1) {
    dayLabel = "Tomorrow";
  } else if (dayDelta === -1) {
    dayLabel = "Yesterday";
  } else if (dayDelta > 1 && dayDelta < 7) {
    dayLabel = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(date);
  } else {
    const nowYear = localDateParts(now, timeZone).year;
    const eventYear = localDateParts(date, timeZone).year;
    dayLabel = new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      ...(eventYear !== nowYear ? { year: "numeric" } : {})
    }).format(date);
  }

  return `${dayLabel}, ${timeLabel}`;
}

export function formatDetailedInTimeZone(isoDate: string, timeZone: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short"
  }).format(date);
}

export function toIcsUtcStamp(isoDate: string): string {
  const date = new Date(isoDate);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}
