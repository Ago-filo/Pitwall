import { describe, expect, it } from "vitest";
import { raceInsights } from "../src/race-insights";
import type { Comparison, DriverRace, Lap } from "../src/domain";

const makeLaps = (
  times: number[],
  positions: number[],
  gapBase: number,
): Lap[] =>
  times.map((durationSeconds, index) => ({
    number: index + 1,
    durationSeconds,
    start: null,
    pitOut: false,
    position: positions[index],
    gapToLeader: gapBase + index,
    gapSampledAt: "2024-03-02T15:00:00Z",
  }));

const first: DriverRace = {
  driver: {
    number: 16,
    name: "Charles Leclerc",
    acronym: "LEC",
    team: "Ferrari",
    color: "#ff0000",
  },
  laps: makeLaps(
    [90, 89, 91, 120, 119, 90, 88, 87],
    [4, 4, 3, 3, 6, 5, 4, 4],
    3,
  ),
  pitStops: [{ lap: 4, laneSeconds: 24, stationarySeconds: null }],
  stints: [],
  result: { status: "FINISHED", position: 4, lapsCompleted: 8 },
  unavailable: [],
};
const second: DriverRace = {
  driver: {
    number: 55,
    name: "Carlos Sainz",
    acronym: "SAI",
    team: "Ferrari",
    color: "#ff0000",
  },
  laps: makeLaps(
    [91, 92, 92, 93, 125, 122, 90, 89],
    [5, 5, 5, 4, 4, 4, 3, 3],
    5,
  ).map((lap) => (lap.number === 6 ? { ...lap, pitOut: true } : lap)),
  pitStops: [{ lap: 5, laneSeconds: 25, stationarySeconds: null }],
  stints: [],
  result: { status: "FINISHED", position: 3, lapsCompleted: 8 },
  unavailable: [],
};
const comparison: Comparison = {
  race: {
    sessionKey: 9472,
    year: 2024,
    name: "Bahrain",
    circuit: "Bahrain",
    country: "Bahrain",
    date: "2024-03-02",
  },
  drivers: [first, second],
  notes: [],
};

describe("race insights", () => {
  it("links descriptive observations to recorded laps and uses paired clean pit laps for pace", () => {
    const result = raceInsights(comparison);
    expect(result.map((item) => item.id)).toEqual([
      "position",
      "pace",
      "pits",
      "gap",
    ]);
    expect(result[0]).toMatchObject({ laps: [1, 8] });
    expect(result[1].description).toContain("Across 5 shared lap numbers");
    expect(result[1].description).toContain(
      "89.000 s for LEC and 91.000 s for SAI",
    );
    expect(result[1].laps).toEqual([1, 8]);
    expect(result[2].laps).toEqual([4, 5]);
    expect(result[3].title).toBe("Sampled leader gap");
  });

  it("omits claims without enough evidence and never converts a DNF to a finish position", () => {
    const sparse: Comparison = {
      ...comparison,
      drivers: [
        {
          ...first,
          laps: [first.laps[0]],
          pitStops: [],
          result: { status: "DNF", position: null, lapsCompleted: 1 },
        },
        { ...second, laps: [second.laps[0]], pitStops: [] },
      ],
    };
    expect(raceInsights(sparse)).toEqual([]);
  });

  it("excludes missing and invalid times, pit-out laps, and lapped gap labels", () => {
    const altered: Comparison = {
      ...comparison,
      drivers: [
        {
          ...first,
          laps: first.laps.map((lap) =>
            lap.number === 2
              ? { ...lap, durationSeconds: null }
              : lap.number === 3
                ? { ...lap, pitOut: true }
                : lap,
          ),
        },
        {
          ...second,
          laps: second.laps.map((lap) => ({ ...lap, gapToLeader: "+1 LAP" })),
        },
      ],
    };
    const result = raceInsights(altered);
    expect(result.some((item) => item.id === "pace")).toBe(false);
    expect(result.some((item) => item.id === "gap")).toBe(false);
  });
});
