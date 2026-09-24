import type { Comparison, Lap } from "./domain";

export interface RaceInsight {
  id: "position" | "pace" | "pits" | "gap";
  title: string;
  description: string;
  evidence: string;
  laps: number[];
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const timed = (lap: Lap) =>
  lap.durationSeconds !== null &&
  Number.isFinite(lap.durationSeconds) &&
  lap.durationSeconds > 0;

const uniqueLaps = (laps: number[]) => [...new Set(laps)].sort((a, b) => a - b);

export function raceInsights(comparison: Comparison): RaceInsight[] {
  const [a, b] = comparison.drivers;
  const insights: RaceInsight[] = [];
  const positions = comparison.drivers.map((driver) =>
    driver.laps.filter((lap) => lap.position !== null),
  );
  if (positions.every((samples) => samples.length >= 2)) {
    const describe = (index: number) => {
      const samples = positions[index];
      return (
        comparison.drivers[index].driver.acronym +
        ": P" +
        samples[0].position +
        " on lap " +
        samples[0].number +
        " → P" +
        samples.at(-1)!.position +
        " on lap " +
        samples.at(-1)!.number
      );
    };
    insights.push({
      id: "position",
      title: "Observed position",
      description: describe(0) + ". " + describe(1) + ".",
      evidence:
        "First and last reconstructable lap positions. These are not official start or finish positions.",
      laps: uniqueLaps(
        positions.flatMap((samples) => [
          samples[0].number,
          samples.at(-1)!.number,
        ]),
      ),
    });
  }

  const bByLap = new Map(b.laps.map((lap) => [lap.number, lap]));
  const aPitLaps = new Set(a.pitStops.map((pit) => pit.lap));
  const bPitLaps = new Set(b.pitStops.map((pit) => pit.lap));
  const paired = a.laps.flatMap((lap) => {
    const other = bByLap.get(lap.number);
    if (
      !other ||
      !timed(lap) ||
      !timed(other) ||
      lap.pitOut ||
      other.pitOut ||
      aPitLaps.has(lap.number) ||
      bPitLaps.has(lap.number)
    )
      return [];
    return [
      { lap: lap.number, a: lap.durationSeconds!, b: other.durationSeconds! },
    ];
  });
  if (paired.length >= 5) {
    insights.push({
      id: "pace",
      title: "Same-lap pace",
      description:
        "Across " +
        paired.length +
        " shared lap numbers, median recorded times were " +
        median(paired.map((pair) => pair.a)).toFixed(3) +
        " s for " +
        a.driver.acronym +
        " and " +
        median(paired.map((pair) => pair.b)).toFixed(3) +
        " s for " +
        b.driver.acronym +
        ".",
      evidence:
        "Only laps with both positive times count. Recorded pit-stop and pit-out laps for either driver are excluded. Traffic, tyre age, weather and Safety Car periods are not controlled for.",
      laps: uniqueLaps([paired[0].lap, paired.at(-1)!.lap]),
    });
  }

  const firstPit = [...a.pitStops].sort((x, y) => x.lap - y.lap)[0];
  const secondPit = [...b.pitStops].sort((x, y) => x.lap - y.lap)[0];
  if (firstPit && secondPit) {
    insights.push({
      id: "pits",
      title: "First recorded stops",
      description:
        a.driver.acronym +
        " stopped on lap " +
        firstPit.lap +
        "; " +
        b.driver.acronym +
        " stopped on lap " +
        secondPit.lap +
        ".",
      evidence:
        "Recorded pit laps only. Timing alone does not establish an undercut, overcut or strategic benefit.",
      laps: uniqueLaps([firstPit.lap, secondPit.lap]),
    });
  }

  const gaps = comparison.drivers.map((driver) =>
    driver.laps.filter(
      (lap) =>
        lap.gapSampledAt &&
        typeof lap.gapToLeader === "number" &&
        Number.isFinite(lap.gapToLeader),
    ),
  );
  if (gaps.every((samples) => samples.length >= 2)) {
    const describe = (index: number) => {
      const samples = gaps[index];
      const first = samples[0];
      const last = samples.at(-1)!;
      return (
        comparison.drivers[index].driver.acronym +
        ": +" +
        (first.gapToLeader as number).toFixed(3) +
        " s on lap " +
        first.number +
        " → +" +
        (last.gapToLeader as number).toFixed(3) +
        " s on lap " +
        last.number
      );
    };
    insights.push({
      id: "gap",
      title: "Sampled leader gap",
      description: describe(0) + ". " + describe(1) + ".",
      evidence:
        "First and last numeric samples within recorded lap windows. Samples are asynchronous and are not a head-to-head gap.",
      laps: uniqueLaps(
        gaps.flatMap((samples) => [samples[0].number, samples.at(-1)!.number]),
      ),
    });
  }
  return insights;
}
