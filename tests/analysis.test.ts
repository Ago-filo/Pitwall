import { describe, expect, it } from "vitest";
import { lapSnapshot, stintPace } from "../src/analysis";
import type { DriverRace } from "../src/domain";

const driver: DriverRace = {
  driver: {
    number: 16,
    name: "Charles Leclerc",
    acronym: "LEC",
    team: "Ferrari",
    color: "#ff0000",
  },
  laps: [
    { number: 1, durationSeconds: 91, start: null, pitOut: false, position: 4 },
    { number: 2, durationSeconds: 89, start: null, pitOut: false, position: 3 },
    {
      number: 3,
      durationSeconds: 120,
      start: null,
      pitOut: false,
      position: 3,
    },
    {
      number: 4,
      durationSeconds: 125,
      start: null,
      pitOut: true,
      position: null,
    },
    { number: 5, durationSeconds: 88, start: null, pitOut: false, position: 5 },
    { number: 6, durationSeconds: 90, start: null, pitOut: false, position: 4 },
    {
      number: 7,
      durationSeconds: null,
      start: null,
      pitOut: false,
      position: null,
    },
  ],
  pitStops: [{ lap: 3, laneSeconds: 24.2, stationarySeconds: null }],
  stints: [
    { number: 1, startLap: 1, endLap: 3, compound: "SOFT", tyreAgeAtStart: 0 },
    {
      number: 2,
      startLap: 4,
      endLap: null,
      compound: "HARD",
      tyreAgeAtStart: 0,
    },
  ],
  result: { position: null, lapsCompleted: 7, status: "DNF" },
  unavailable: [],
};

describe("race analysis", () => {
  it("keeps unknown lap values empty while showing known pit and tyre data", () => {
    expect(lapSnapshot(driver, 3)).toMatchObject({
      lap: { number: 3, position: 3 },
      stint: { compound: "SOFT" },
      pitStop: { laneSeconds: 24.2 },
    });
    expect(lapSnapshot(driver, 7)).toMatchObject({
      lap: { durationSeconds: null, position: null },
      stint: { compound: "HARD" },
      pitStop: null,
    });
    expect(lapSnapshot(driver, 8)).toMatchObject({
      lap: null,
      stint: null,
      pitStop: null,
    });
  });

  it("computes median stint pace without pit laps, pit-out laps or missing times", () => {
    expect(stintPace(driver)).toEqual([
      {
        stint: driver.stints[0],
        medianSeconds: 90,
        timedLaps: 2,
        excludedPitLaps: 1,
      },
      {
        stint: driver.stints[1],
        medianSeconds: 89,
        timedLaps: 2,
        excludedPitLaps: 1,
      },
    ]);
  });

  it("does not invent pace for a stint without usable timed laps", () => {
    const sparse = {
      ...driver,
      laps: driver.laps.filter((lap) => lap.number === 4),
    };
    expect(stintPace(sparse)[0].medianSeconds).toBeNull();
    expect(stintPace(sparse)[1]).toMatchObject({
      medianSeconds: null,
      timedLaps: 0,
      excludedPitLaps: 1,
    });
  });
});
