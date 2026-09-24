import type { DriverRace, Lap, PitStop, Stint } from "./domain";

export interface LapSnapshot {
  lap: Lap | null;
  stint: Stint | null;
  pitStop: PitStop | null;
}

export interface StintPace {
  stint: Stint;
  medianSeconds: number | null;
  timedLaps: number;
  excludedPitLaps: number;
}

export function lapSnapshot(
  driver: DriverRace,
  lapNumber: number,
): LapSnapshot {
  const lastRecordedLap = Math.max(...driver.laps.map((lap) => lap.number), 0);
  return {
    lap: driver.laps.find((lap) => lap.number === lapNumber) ?? null,
    stint:
      lapNumber <= lastRecordedLap
        ? (driver.stints.find(
            (stint) =>
              stint.startLap <= lapNumber &&
              (stint.endLap === null || lapNumber <= stint.endLap),
          ) ?? null)
        : null,
    pitStop: driver.pitStops.find((pit) => pit.lap === lapNumber) ?? null,
  };
}

export function stintPace(driver: DriverRace): StintPace[] {
  const pitLaps = new Set(driver.pitStops.map((pit) => pit.lap));
  return driver.stints.map((stint) => {
    const stintLaps = driver.laps.filter(
      (lap) =>
        lap.number >= stint.startLap &&
        (stint.endLap === null || lap.number <= stint.endLap),
    );
    const excludedPitLaps = stintLaps.filter(
      (lap) => lap.pitOut || pitLaps.has(lap.number),
    ).length;
    const times = stintLaps
      .filter(
        (lap) =>
          !lap.pitOut &&
          !pitLaps.has(lap.number) &&
          lap.durationSeconds !== null &&
          Number.isFinite(lap.durationSeconds) &&
          lap.durationSeconds > 0,
      )
      .map((lap) => lap.durationSeconds as number)
      .sort((a, b) => a - b);
    const middle = Math.floor(times.length / 2);
    const medianSeconds = times.length
      ? times.length % 2
        ? times[middle]
        : (times[middle - 1] + times[middle]) / 2
      : null;
    return { stint, medianSeconds, timedLaps: times.length, excludedPitLaps };
  });
}
