import { describe, expect, it } from "vitest";
import type { Comparison, DriverRace, Lap } from "../src/domain";
import { raceStory } from "../src/race-story";
import { archivedComparison } from "../worker/snapshots";

const laps = (positions: (number | null)[]): Lap[] =>
  positions.map((position, index) => ({
    number: index + 1,
    durationSeconds: 90,
    start: null,
    pitOut: false,
    position,
  }));

const driver = (number: number, acronym: string): DriverRace => ({
  driver: { number, acronym, name: acronym, team: "Team", color: "#ffffff" },
  laps: laps([null, 3, 2, null, 4]),
  pitStops: [],
  stints: [],
  result: { status: "FINISHED", position: 4, lapsCompleted: 5 },
  unavailable: [],
});

const fixture: Comparison = {
  race: {
    sessionKey: 1234,
    year: 2024,
    name: "Test",
    circuit: "Test",
    country: "Test",
    date: "2024-01-01",
  },
  drivers: [driver(1, "ONE"), driver(2, "TWO")],
  notes: [],
};

describe("race story", () => {
  it("orders and groups recorded signals while keeping missing positions empty", () => {
    const comparison: Comparison = {
      ...fixture,
      drivers: [
        {
          ...fixture.drivers[0],
          pitStops: [{ lap: 3, laneSeconds: 24.25, stationarySeconds: 2.5 }],
        },
        {
          ...fixture.drivers[1],
          pitStops: [{ lap: 3, laneSeconds: null, stationarySeconds: null }],
        },
      ],
      events: [
        {
          date: "2024-01-01",
          lap: 3,
          category: "SafetyCar",
          flag: null,
          scope: null,
          message: "SAFETY CAR DEPLOYED",
        },
        {
          date: "2024-01-01",
          lap: 4,
          category: "Flag",
          flag: "YELLOW",
          scope: null,
          message: "YELLOW FLAG",
        },
        {
          date: "2024-01-01",
          lap: null,
          category: "Flag",
          flag: "RED",
          scope: null,
          message: "RED FLAG",
        },
      ],
    };
    const story = raceStory(comparison);
    expect(story.moments.map((moment) => moment.lap)).toEqual([2, 3]);
    expect(story.moments[1].signals.map((signal) => signal.kind)).toEqual([
      "pit",
      "pit",
      "control",
    ]);
    expect(story.moments[1].signals[0].text).toContain(
      "24.3 s in pit lane · 2.5 s stationary",
    );
    expect(story.moments[1].signals[1].text).toContain("duration unavailable");
    expect(story.moments[1].observedPositions).toHaveLength(2);
    expect(story.unplacedControlCount).toBe(1);
  });

  it("labels the last recorded lap without claiming it is the retirement lap", () => {
    const comparison: Comparison = {
      ...fixture,
      drivers: [
        {
          ...fixture.drivers[0],
          laps: laps([2, 3, null]),
          result: { status: "DNF", position: null, lapsCompleted: 2 },
        },
        fixture.drivers[1],
      ],
    };
    const story = raceStory(comparison);
    expect(story.moments.at(-1)?.lap).toBe(3);
    expect(story.moments.at(-1)?.signals[0].text).toContain(
      "not a verified retirement lap",
    );
    expect(story.moments.at(-1)?.observedPositions).toEqual([
      { acronym: "TWO", position: 2 },
    ]);
    expect(story.classification[0]).toBe("ONE: DNF · 2 completed laps");
  });

  it("builds a usable sequence for each saved race scenario", () => {
    const scenarios = [
      { key: 7953, pair: [16, 55], dnf: true, control: true },
      { key: 9472, pair: [16, 55], dnf: false, control: false },
      { key: 9693, pair: [4, 81], dnf: false, control: true },
    ];
    for (const scenario of scenarios) {
      const saved = archivedComparison(scenario.key, scenario.pair);
      expect(saved).not.toBeNull();
      const story = raceStory(saved!);
      expect(story.moments.length).toBeGreaterThan(1);
      expect(
        story.moments.some((moment) =>
          moment.signals.some((signal) => signal.kind === "retirement"),
        ),
      ).toBe(scenario.dnf);
      expect(
        story.moments.some((moment) =>
          moment.signals.some((signal) => signal.kind === "control"),
        ),
      ).toBe(scenario.control);
      expect(story.moments.map((moment) => moment.lap)).toEqual(
        [...story.moments.map((moment) => moment.lap)].sort((a, b) => a - b),
      );
    }
  });
});
