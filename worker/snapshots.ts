import type {
  Comparison,
  Driver,
  GuidedRace,
  Race,
  SnapshotCoverage,
} from "../src/domain";
import bahrain2023 from "./snapshots/bahrain-2023.json";
import bahrain2024 from "./snapshots/bahrain-2024.json";
import australia2025 from "./snapshots/australia-2025.json";

type Snapshot = {
  capturedAt: string;
  drivers: Driver[];
  comparison: Comparison;
  coverage: SnapshotCoverage;
};

const entries: {
  id: string;
  title: string;
  description: string;
  label: string;
  snapshot: Snapshot;
}[] = [
  {
    id: "bahrain-2024",
    title: "Ferrari teammates",
    description:
      "Leclerc and Sainz across 57 recorded laps and two stops each.",
    label: "BASELINE",
    snapshot: bahrain2024 as unknown as Snapshot,
  },
  {
    id: "bahrain-2023",
    title: "A race cut short",
    description:
      "Leclerc's retirement beside Sainz's finish, with missing pit records made explicit.",
    label: "RETIREMENT",
    snapshot: bahrain2023 as unknown as Snapshot,
  },
  {
    id: "australia-2025",
    title: "Safety Car context",
    description:
      "Norris and Piastri in a race with recorded Safety Car messages.",
    label: "SAFETY CAR",
    snapshot: australia2025 as unknown as Snapshot,
  },
];

export function guidedRaces(): GuidedRace[] {
  return entries.map(({ id, title, description, label, snapshot }) => ({
    id,
    title,
    description,
    label,
    race: snapshot.comparison.race,
    drivers: snapshot.comparison.drivers.map((entry) => entry.driver) as [
      Driver,
      Driver,
    ],
    capturedAt: snapshot.capturedAt,
    coverage: snapshot.coverage,
  }));
}

export function archivedRaces(season: number): Race[] {
  return entries
    .filter(({ snapshot }) => snapshot.comparison.race.year === season)
    .map(({ snapshot }) => snapshot.comparison.race);
}

export function archivedDrivers(sessionKey: number): Driver[] | null {
  const entry = entries.find(
    ({ snapshot }) => snapshot.comparison.race.sessionKey === sessionKey,
  );
  return entry
    ? entry.snapshot.comparison.drivers.map((driver) => driver.driver)
    : null;
}

export function archivedComparison(
  sessionKey: number,
  numbers: number[],
): Comparison | null {
  const entry = entries.find(
    ({ snapshot }) => snapshot.comparison.race.sessionKey === sessionKey,
  );
  if (!entry || numbers.length !== 2 || numbers[0] === numbers[1]) return null;
  const selected = numbers.map((number) =>
    entry.snapshot.comparison.drivers.find(
      (driver) => driver.driver.number === number,
    ),
  );
  if (!selected[0] || !selected[1]) return null;
  return {
    ...entry.snapshot.comparison,
    drivers: [selected[0], selected[1]],
    source: { kind: "snapshot", capturedAt: entry.snapshot.capturedAt },
  };
}
