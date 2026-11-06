import { describe, expect, it } from "vitest";
import {
  businessCreatedAtFilter,
  businessHour,
  businessInstant,
  orderNumberPrefix,
  startOfBusinessDay,
  startOfBusinessMonth,
  startOfBusinessWeek,
  startOfNextBusinessMonth,
} from "@/core/time/business-time";

describe("Asia/Karachi business boundaries", () => {
  it("keeps 00:30 PKT on 1 Jan 2026 in that business day, not the previous UTC day", () => {
    const instant = businessInstant(2026, 1, 1, 0, 30);
    expect(instant.toISOString()).toBe("2025-12-31T19:30:00.000Z");
    expect(startOfBusinessDay(instant).toISOString()).toBe("2025-12-31T19:00:00.000Z");
    expect(businessHour(instant)).toBe(0);
    expect(orderNumberPrefix(instant)).toBe("WF260101");
  });

  it("keeps 23:30 PKT on 31 Dec 2025 in 2025", () => {
    const instant = businessInstant(2025, 12, 31, 23, 30);
    expect(instant.toISOString()).toBe("2025-12-31T18:30:00.000Z");
    expect(startOfBusinessDay(instant).toISOString()).toBe("2025-12-30T19:00:00.000Z");
    expect(businessHour(instant)).toBe(23);
    expect(orderNumberPrefix(instant)).toBe("WF251231");
    expect(startOfBusinessMonth(instant).toISOString()).toBe("2025-11-30T19:00:00.000Z");
  });

  it("rolls the month at 1 Mar 2026 00:30 PKT and not before", () => {
    const march = businessInstant(2026, 3, 1, 0, 30);
    const february = businessInstant(2026, 2, 28, 23, 30);
    expect(startOfBusinessMonth(march).toISOString()).toBe("2026-02-28T19:00:00.000Z");
    expect(startOfBusinessMonth(february).toISOString()).toBe("2026-01-31T19:00:00.000Z");
    expect(startOfNextBusinessMonth(february).toISOString()).toBe("2026-02-28T19:00:00.000Z");
  });

  it("rolls the year from December into January", () => {
    const newYear = businessInstant(2026, 1, 1, 0, 5);
    expect(startOfBusinessMonth(newYear).toISOString()).toBe("2025-12-31T19:00:00.000Z");
    expect(startOfNextBusinessMonth(businessInstant(2025, 12, 31, 12)).toISOString()).toBe(
      "2025-12-31T19:00:00.000Z"
    );
  });

  it("starts the week on Monday PKT, including a Sunday that belongs to the previous year", () => {
    const wednesday = businessInstant(2026, 1, 7, 15);
    expect(startOfBusinessWeek(wednesday).toISOString()).toBe("2026-01-04T19:00:00.000Z");
    const sunday = businessInstant(2026, 1, 4, 23);
    expect(startOfBusinessWeek(sunday).toISOString()).toBe("2025-12-28T19:00:00.000Z");
  });

  it("treats a date input as a full PKT day", () => {
    const range = businessCreatedAtFilter("2026-01-01", "2026-01-01");
    expect(range?.gte?.toISOString()).toBe("2025-12-31T19:00:00.000Z");
    expect(range?.lt?.toISOString()).toBe("2026-01-01T19:00:00.000Z");
  });
});
