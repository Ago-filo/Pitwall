import type { Comparison, DriverRace, RaceEvent } from "./domain";

export type StorySignalKind = "position" | "pit" | "control" | "retirement";

export interface StorySignal {
  kind: StorySignalKind;
  text: string;
}

export interface StoryMoment {
  lap: number;
  signals: StorySignal[];
  observedPositions: { acronym: string; position: number }[];
}

export interface RaceStory {
  moments: StoryMoment[];
  classification: string[];
  unplacedControlCount: number;
}

function classification(driver: DriverRace): string {
  const { acronym } = driver.driver;
  const result = driver.result;
  if (!result) return acronym + ": classification unavailable";
  const place =
    result.position === null ? result.status : "P" + result.position;
  const laps =
    result.lapsCompleted === null
      ? "completed laps unavailable"
      : result.lapsCompleted + " completed laps";
  return acronym + ": " + place + " · " + laps;
}

function pitDescription(driver: DriverRace, lap: number): string[] {
  return driver.pitStops
    .filter((stop) => stop.lap === lap)
    .map((stop) => {
      const durations: string[] = [];
      if (stop.laneSeconds !== null)
        durations.push(stop.laneSeconds.toFixed(1) + " s in pit lane");
      if (stop.stationarySeconds !== null)
        durations.push(stop.stationarySeconds.toFixed(1) + " s stationary");
      return (
        driver.driver.acronym +
        ": recorded pit stop" +
        (durations.length
          ? " · " + durations.join(" · ")
          : " · duration unavailable")
      );
    });
}

function notableControl(event: RaceEvent): boolean {
  return event.category === "SafetyCar" || event.flag === "RED";
}

export function raceStory(comparison: Comparison): RaceStory {
  const lapNumbers = comparison.drivers.flatMap((driver) =>
    driver.laps.map((lap) => lap.number),
  );
  const validLap = (lap: number): boolean =>
    Number.isInteger(lap) && lap > 0 && lapNumbers.includes(lap);
  const moments = new Map<number, StorySignal[]>();
  const add = (lap: number, signal: StorySignal) => {
    const current = moments.get(lap) ?? [];
    current.push(signal);
    moments.set(lap, current);
  };

  const positioned = comparison.drivers.map(
    (driver) =>
      new Set(
        driver.laps
          .filter((lap) => lap.position !== null)
          .map((lap) => lap.number),
      ),
  );
  const firstSharedLap = [...positioned[0]]
    .sort((a, b) => a - b)
    .find((lap) => positioned[1].has(lap));
  if (firstSharedLap !== undefined) {
    add(firstSharedLap, {
      kind: "position",
      text: "First lap with a reconstructed position for both selected drivers.",
    });
  }

  for (const driver of comparison.drivers) {
    const pitLaps = [...new Set(driver.pitStops.map((stop) => stop.lap))];
    for (const lap of pitLaps) {
      if (!validLap(lap)) continue;
      for (const text of pitDescription(driver, lap))
        add(lap, { kind: "pit", text });
    }
    if (driver.result?.status === "DNF") {
      const lastRecordedLap = Math.max(
        ...driver.laps.map((lap) => lap.number),
        0,
      );
      if (validLap(lastRecordedLap)) {
        add(lastRecordedLap, {
          kind: "retirement",
          text:
            driver.driver.acronym +
            ": classified DNF; this is the last recorded lap, not a verified retirement lap.",
        });
      }
    }
  }

  let unplacedControlCount = 0;
  for (const event of comparison.events ?? []) {
    if (!notableControl(event)) continue;
    if (event.lap === null || !validLap(event.lap)) {
      unplacedControlCount++;
      continue;
    }
    add(event.lap, { kind: "control", text: event.message });
  }

  return {
    moments: [...moments.entries()]
      .sort(([a], [b]) => a - b)
      .map(([lap, signals]) => ({
        lap,
        signals,
        observedPositions: comparison.drivers.flatMap((driver) => {
          const position = driver.laps.find(
            (entry) => entry.number === lap,
          )?.position;
          return position === null || position === undefined
            ? []
            : [{ acronym: driver.driver.acronym, position }];
        }),
      })),
    classification: comparison.drivers.map(classification),
    unplacedControlCount,
  };
}
