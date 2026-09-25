import { describe, expect, it, vi } from "vitest";
import { handleRequest } from "../worker/index";
import { OpenF1 } from "../worker/openf1";
import { archivedComparison, guidedRaces } from "../worker/snapshots";
import bahrain2023 from "../worker/snapshots/bahrain-2023.json";
import bahrain2024 from "../worker/snapshots/bahrain-2024.json";
import australia2025 from "../worker/snapshots/australia-2025.json";

const snapshots = [bahrain2023, bahrain2024, australia2025];
const unavailable = new OpenF1(
  vi.fn(
    async () => new Response("Unavailable", { status: 503 }),
  ) as typeof fetch,
);

describe("guided race snapshots", () => {
  it("keeps dated coverage consistent with every saved comparison", () => {
    expect(guidedRaces()).toHaveLength(3);
    for (const snapshot of snapshots) {
      expect(Date.parse(snapshot.capturedAt)).not.toBeNaN();
      expect(snapshot.comparison.source).toBeUndefined();
      expect(snapshot.coverage.raceEvents).toBe(
        snapshot.comparison.events.length,
      );
      expect(snapshot.coverage.safetyCarEvents).toBe(
        snapshot.comparison.events.filter(
          (event) => event.category === "SafetyCar",
        ).length,
      );
      expect(snapshot.coverage.notes).toEqual(snapshot.comparison.notes);
      snapshot.comparison.drivers.forEach((driver, index) => {
        expect(snapshot.coverage.drivers[index]).toMatchObject({
          number: driver.driver.number,
          status: driver.result?.status,
          laps: driver.laps.length,
          timedLaps: driver.laps.filter((lap) => lap.durationSeconds !== null)
            .length,
          positionedLaps: driver.laps.filter((lap) => lap.position !== null)
            .length,
          gapSamples: driver.laps.filter((lap) => lap.gapSampledAt).length,
          pitStops: driver.pitStops.length,
          stints: driver.stints.length,
        });
      });
    }
    expect(bahrain2023.comparison.drivers[0].result?.status).toBe("DNF");
    expect(bahrain2023.coverage.notes).toContain(
      "Pit stop data is unavailable for this race.",
    );
    expect(australia2025.coverage.safetyCarEvents).toBeGreaterThan(0);
    expect(
      bahrain2024.coverage.drivers.every((driver) => driver.gapSamples > 0),
    ).toBe(true);
  });

  it("exposes concise metadata without calling OpenF1", async () => {
    const fetcher = vi.fn(
      async () => new Response("Unavailable", { status: 503 }),
    );
    const response = await handleRequest(
      new Request("https://pitwall.test/api/highlights"),
      new OpenF1(fetcher as typeof fetch),
    );
    const body = (await response.json()) as {
      highlights: { id: string; capturedAt: string }[];
    };
    expect(response.status).toBe(200);
    expect(body.highlights.map((item) => item.id)).toEqual([
      "bahrain-2024",
      "bahrain-2023",
      "australia-2025",
    ]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("serves the selected saved pair directly, in either order", async () => {
    const fetcher = vi.fn(
      async () => new Response("Unavailable", { status: 503 }),
    );
    const response = await handleRequest(
      new Request(
        "https://pitwall.test/api/races/9693/comparison?drivers=81,4&v=3",
      ),
      new OpenF1(fetcher as typeof fetch),
    );
    const body = (await response.json()) as {
      drivers: { driver: { number: number } }[];
      source: { kind: string; capturedAt: string };
      events: { category: string }[];
    };
    expect(response.status).toBe(200);
    expect(response.headers.get("X-PitWall-Source")).toBe("snapshot");
    expect(body.drivers.map((driver) => driver.driver.number)).toEqual([81, 4]);
    expect(body.events.some((event) => event.category === "SafetyCar")).toBe(
      true,
    );
    expect(body.source.kind).toBe("snapshot");
    expect(fetcher).not.toHaveBeenCalled();
    expect(archivedComparison(9693, [4, 4])).toBeNull();
  });

  it("limits outage catalogs and rosters to comparisons that can actually open", async () => {
    const races = await handleRequest(
      new Request("https://pitwall.test/api/races?season=2023"),
      unavailable,
    );
    expect(races.status).toBe(200);
    expect(races.headers.get("X-PitWall-Source")).toBe("snapshot");
    expect((await races.json()) as unknown).toMatchObject({
      races: [{ sessionKey: 7953 }],
    });
    const drivers = await handleRequest(
      new Request("https://pitwall.test/api/races/7953/drivers"),
      unavailable,
    );
    const body = (await drivers.json()) as { drivers: { number: number }[] };
    expect(body.drivers.map((driver) => driver.number)).toEqual([16, 55]);
  });

  it("keeps other pairs unavailable during an outage", async () => {
    const response = await handleRequest(
      new Request(
        "https://pitwall.test/api/races/9693/comparison?drivers=4,44&v=3",
      ),
      unavailable,
    );
    expect(response.status).toBe(502);
  });
});
