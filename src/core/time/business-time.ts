/**
 * Café business calendar: Asia/Karachi (PKT, UTC+5, no daylight saving).
 * Boundaries are absolute instants, so they do not follow the server's host timezone.
 */

export const BUSINESS_TIME_ZONE = "Asia/Karachi";
export const BUSINESS_TIME_LABEL = "Asia/Karachi (PKT, UTC+5)";

/** Fixed PKT offset. Pakistan does not observe daylight saving. */
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type BusinessParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** Monday-first index: Mon = 0 … Sun = 6 */
  weekdayIndex: number;
};

export function businessInstant(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms) - PKT_OFFSET_MS);
}

export function businessParts(date: Date): BusinessParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const bag = Object.fromEntries(
    fmt
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  const weekday = String(bag.weekday);
  const weekdayIndex = WEEKDAYS.indexOf(weekday as (typeof WEEKDAYS)[number]);
  if (weekdayIndex < 0) {
    throw new Error(`Unexpected weekday from ${BUSINESS_TIME_ZONE}: ${weekday}`);
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
    weekdayIndex,
  };
}

/** 00:00:00.000 PKT on the business day that contains `now`. */
export function startOfBusinessDay(now: Date): Date {
  const parts = businessParts(now);
  return businessInstant(parts.year, parts.month, parts.day);
}

/** 00:00:00.000 PKT on the next business day (exclusive end of `now`'s day). */
export function startOfNextBusinessDay(now: Date): Date {
  return new Date(startOfBusinessDay(now).getTime() + DAY_MS);
}

/** Monday 00:00 PKT of the business week that contains `now`. */
export function startOfBusinessWeek(now: Date): Date {
  const parts = businessParts(now);
  const start = businessInstant(parts.year, parts.month, parts.day);
  return new Date(start.getTime() - parts.weekdayIndex * DAY_MS);
}

export function startOfNextBusinessWeek(now: Date): Date {
  return new Date(startOfBusinessWeek(now).getTime() + 7 * DAY_MS);
}

/** 1st 00:00 PKT of the business month that contains `now`. */
export function startOfBusinessMonth(now: Date): Date {
  const parts = businessParts(now);
  return businessInstant(parts.year, parts.month, 1);
}

export function startOfNextBusinessMonth(now: Date): Date {
  const parts = businessParts(now);
  const month = parts.month === 12 ? 1 : parts.month + 1;
  const year = parts.month === 12 ? parts.year + 1 : parts.year;
  return businessInstant(year, month, 1);
}

export function businessHour(date: Date): number {
  return businessParts(date).hour;
}

/**
 * Inclusive start of a `YYYY-MM-DD` café day.
 * Date-only values are PKT midnights, not the host or UTC midnight.
 * Other parseable instants are returned as-is.
 */
export function startOfNamedBusinessDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const instant = businessInstant(year, month, day);
  const check = businessParts(instant);
  if (check.year !== year || check.month !== month || check.day !== day) return null;
  return instant;
}

/** Prisma `createdAt` filter for café date inputs. `to` is inclusive of that PKT day. */
export function businessCreatedAtFilter(
  from?: string,
  to?: string
): { gte?: Date; lt?: Date } | undefined {
  if (!from && !to) return undefined;
  const createdAt: { gte?: Date; lt?: Date } = {};
  if (from) {
    const start = startOfNamedBusinessDay(from);
    if (start) createdAt.gte = start;
  }
  if (to) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to.trim());
    const start = startOfNamedBusinessDay(to);
    if (start && match) createdAt.lt = new Date(start.getTime() + DAY_MS);
    else if (start) createdAt.lt = new Date(start.getTime() + 1);
  }
  if (!createdAt.gte && !createdAt.lt) return undefined;
  return createdAt;
}

export function formatBusinessDateTime(date: Date): string {
  const formatted = new Intl.DateTimeFormat("en-PK", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${formatted} PKT`;
}

/** New order numbers: WF + PKT date. Stored TIS numbers are never rewritten. */
export function orderNumberPrefix(now: Date = new Date()): string {
  const parts = businessParts(now);
  const year = String(parts.year).slice(-2);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `WF${year}${month}${day}`;
}
