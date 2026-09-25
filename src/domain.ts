export interface Race {
  sessionKey: number;
  year: number;
  name: string;
  circuit: string;
  country: string;
  date: string;
}

export interface Driver {
  number: number;
  name: string;
  acronym: string;
  team: string;
  color: string;
}

export interface Lap {
  number: number;
  durationSeconds: number | null;
  start: string | null;
  pitOut: boolean;
  position: number | null;
  gapToLeader?: number | string | null;
  gapSampledAt?: string | null;
}

export interface PitStop {
  lap: number;
  laneSeconds: number | null;
  stationarySeconds: number | null;
}

export interface Stint {
  number: number;
  startLap: number;
  endLap: number | null;
  compound: string;
  tyreAgeAtStart: number | null;
}

export interface RaceEvent {
  date: string;
  lap: number | null;
  category: "SafetyCar" | "Flag";
  flag: string | null;
  scope: string | null;
  message: string;
}

export interface Result {
  position: number | null;
  lapsCompleted: number | null;
  status: "FINISHED" | "DNF" | "DNS" | "DSQ" | "UNKNOWN";
}

export interface DriverRace {
  driver: Driver;
  laps: Lap[];
  pitStops: PitStop[];
  stints: Stint[];
  result: Result | null;
  unavailable: string[];
}

export interface Comparison {
  race: Race;
  drivers: [DriverRace, DriverRace];
  notes: string[];
  events?: RaceEvent[];
  source?: { kind: "snapshot"; capturedAt: string };
}

export interface SnapshotCoverage {
  drivers: {
    number: number;
    status: Result["status"];
    laps: number;
    timedLaps: number;
    positionedLaps: number;
    gapSamples: number;
    pitStops: number;
    stints: number;
  }[];
  raceEvents: number;
  safetyCarEvents: number;
  notes: string[];
}

export interface GuidedRace {
  id: string;
  title: string;
  description: string;
  label: string;
  race: Race;
  drivers: [Driver, Driver];
  capturedAt: string;
  coverage: SnapshotCoverage;
}
