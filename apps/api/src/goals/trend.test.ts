import { describe, expect, it } from "vitest";

import { trendAt, withTrend } from "./trend";

const weighIns = [
  { date: "2026-10-01", weightKg: 80 },
  { date: "2026-10-03", weightKg: 81 },
  { date: "2026-10-07", weightKg: 79 },
  { date: "2026-10-09", weightKg: 78 },
];

describe("trendAt", () => {
  it("averages the 7 days up to the date", () => {
    // 3 Oct - 9 Oct: 81, 79, 78
    expect(trendAt(weighIns, "2026-10-09")).toEqual({ kg: 79.3, count: 3 });
  });

  it("excludes weigh-ins after the date and older than the window", () => {
    expect(trendAt(weighIns, "2026-10-03")).toEqual({ kg: 80.5, count: 2 });
    expect(trendAt(weighIns, "2026-10-12")).toEqual({ kg: 78.5, count: 2 }); // 7 and 9 Oct
    expect(trendAt(weighIns, "2026-10-14")).toEqual({ kg: 78, count: 1 }); // 1 to 7 Oct have aged out
  });

  it("returns null with nothing in the window", () => {
    expect(trendAt(weighIns, "2026-10-30")).toBeNull();
  });
});

describe("withTrend", () => {
  it("adds a trend to each weigh-in in date order", () => {
    const out = withTrend([weighIns[2], weighIns[0]]);
    expect(out.map((w) => w.date)).toEqual(["2026-10-01", "2026-10-07"]);
    expect(out[1].trendKg).toBe(79.5); // 1 Oct is inside the 7-day window ending 7 Oct
  });
});
