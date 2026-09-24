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
}
