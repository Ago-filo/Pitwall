import { z } from "zod";
import type {
  Comparison,
  Driver,
  DriverRace,
  Lap,
  Race,
  Result,
} from "../src/domain";

const number = z.number().finite();
const nullableNumber = number.nullish();
const sessionSchema = z.object({
  session_key: number,
  year: number,
  session_name: z.string(),
  date_start: z.string(),
  date_end: z.string().nullish(),
  country_name: z.string().nullish(),
  circuit_short_name: z.string().nullish(),
  location: z.string().nullish(),
  is_cancelled: z.boolean().nullish(),
});
const driverSchema = z.object({
  driver_number: number,
  full_name: z.string(),
  name_acronym: z.string(),
  team_name: z.string().nullish(),
  team_colour: z.string().nullish(),
});
const lapSchema = z.object({
  driver_number: number,
  lap_number: number,
  lap_duration: nullableNumber,
  date_start: z.string().nullish(),
  is_pit_out_lap: z.boolean().nullish(),
});
const positionSchema = z.object({
  driver_number: number,
  date: z.string(),
  position: number,
});
const pitSchema = z.object({
  driver_number: number,
  lap_number: number,
  lane_duration: nullableNumber,
  stop_duration: nullableNumber,
});
const stintSchema = z.object({
  driver_number: number,
  stint_number: number,
  lap_start: nullableNumber,
  lap_end: nullableNumber,
  compound: z.string().nullish(),
  tyre_age_at_start: nullableNumber,
});
const resultSchema = z.object({
  driver_number: number,
  position: nullableNumber,
  number_of_laps: nullableNumber,
  dnf: z.boolean().nullish(),
  dns: z.boolean().nullish(),
  dsq: z.boolean().nullish(),
});

export class UpstreamError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Fetcher = typeof fetch;
type CacheStore = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
};

export class OpenF1 {
  private lastRequestAt = 0;
  constructor(
    private fetcher: Fetcher = fetch,
    private cache?: CacheStore,
  ) {}

  async get<T>(path: string, schema: z.ZodType<T>, ttl = 3600): Promise<T[]> {
    const url = `https://api.openf1.org/v1/${path}`;
    const key = new Request(url);
    let response = await this.cache?.match(key);
    if (!response) {
      const wait = Math.max(0, 400 - (Date.now() - this.lastRequestAt));
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      this.lastRequestAt = Date.now();
      try {
        const fetcher = this.fetcher;
        response = await fetcher(url, {
          signal: AbortSignal.timeout(15000),
        });
      } catch (error) {
        console.error("OpenF1 fetch failed", error);
        throw new UpstreamError(503, "OpenF1 is temporarily unavailable.");
      }
      if (response.status === 404) return [];
      if (response.status === 429)
        throw new UpstreamError(
          429,
          "OpenF1 request limit reached. Please try again shortly.",
        );
      if (!response.ok)
        throw new UpstreamError(502, "OpenF1 returned an error.");
      if (this.cache) {
        const cached = new Response(response.clone().body, {
          headers: { "Cache-Control": `public, max-age=${ttl}` },
        });
        await this.cache.put(key, cached).catch(() => undefined);
      }
    }
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new UpstreamError(502, "OpenF1 returned invalid JSON.");
    }
    const parsed = z.array(schema).safeParse(json);
    if (!parsed.success) {
      console.error(
        "OpenF1 schema validation failed",
        path,
        parsed.error.issues.slice(0, 3),
      );
      throw new UpstreamError(502, "OpenF1 data format changed or is invalid.");
    }
    return parsed.data;
  }

  async sessions(year: number) {
    return this.get(
      `sessions?year=${year}&session_name=Race`,
      sessionSchema,
      3600,
    );
  }
  async session(key: number) {
    return this.get(`sessions?session_key=${key}`, sessionSchema, 3600);
  }
  async drivers(key: number) {
    return this.get(`drivers?session_key=${key}`, driverSchema, 604800);
  }
  async laps(key: number) {
    return this.get(`laps?session_key=${key}`, lapSchema, 604800);
  }
  async positions(key: number) {
    return this.get(`position?session_key=${key}`, positionSchema, 604800);
  }
  async pits(key: number) {
    return this.get(`pit?session_key=${key}`, pitSchema, 604800);
  }
  async stints(key: number) {
    return this.get(`stints?session_key=${key}`, stintSchema, 604800);
  }
  async results(key: number) {
    return this.get(`session_result?session_key=${key}`, resultSchema, 604800);
  }
}

type Session = z.infer<typeof sessionSchema>;
export function toRace(session: Session): Race {
  return {
    sessionKey: session.session_key,
    year: session.year,
    name: session.location || session.country_name || "Grand Prix",
    circuit: session.circuit_short_name || "Circuit unavailable",
    country: session.country_name || "Unknown",
    date: session.date_start,
  };
}
export function isCompleted(session: Session, now = Date.now()): boolean {
  return (
    session.session_name === "Race" &&
    session.is_cancelled !== true &&
    !!session.date_end &&
    Date.parse(session.date_end) + 30 * 60_000 < now
  );
}
export function toDriver(raw: z.infer<typeof driverSchema>): Driver {
  const color = raw.team_colour?.replace(/[^a-fA-F0-9]/g, "");
  return {
    number: raw.driver_number,
    name: raw.full_name,
    acronym: raw.name_acronym,
    team: raw.team_name || "Unknown team",
    color: color?.length === 6 ? `#${color}` : "#65d6dc",
  };
}

export function normalizeLaps(
  raw: z.infer<typeof lapSchema>[],
  positions: z.infer<typeof positionSchema>[],
): Lap[] {
  const events = [...positions].sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date),
  );
  let eventIndex = 0;
  let lastPosition: number | null = null;
  return [...raw]
    .sort((a, b) => a.lap_number - b.lap_number)
    .map((lap) => {
      const start = lap.date_start ? Date.parse(lap.date_start) : NaN;
      const end =
        Number.isFinite(start) && lap.lap_duration != null
          ? start + lap.lap_duration * 1000
          : NaN;
      if (Number.isFinite(end)) {
        while (
          eventIndex < events.length &&
          Date.parse(events[eventIndex].date) <= end
        ) {
          lastPosition = events[eventIndex].position;
          eventIndex++;
        }
      }
      return {
        number: lap.lap_number,
        durationSeconds: lap.lap_duration ?? null,
        start: lap.date_start ?? null,
        pitOut: lap.is_pit_out_lap ?? false,
        position: Number.isFinite(end) ? lastPosition : null,
      };
    });
}

function result(raw: z.infer<typeof resultSchema> | undefined): Result | null {
  if (!raw) return null;
  return {
    position: raw.position ?? null,
    lapsCompleted: raw.number_of_laps ?? null,
    status: raw.dsq
      ? "DSQ"
      : raw.dns
        ? "DNS"
        : raw.dnf
          ? "DNF"
          : raw.position != null
            ? "FINISHED"
            : "UNKNOWN",
  };
}

export type RawComparison = {
  laps: z.infer<typeof lapSchema>[];
  positions: z.infer<typeof positionSchema>[];
  pits: z.infer<typeof pitSchema>[];
  stints: z.infer<typeof stintSchema>[];
  results: z.infer<typeof resultSchema>[];
};
export function buildComparison(
  race: Race,
  drivers: [Driver, Driver],
  raw: RawComparison,
  unavailable: string[] = [],
): Comparison {
  const mapped = drivers.map((driver): DriverRace => {
    const forDriver = <T extends { driver_number: number }>(items: T[]) =>
      items.filter((item) => item.driver_number === driver.number);
    return {
      driver,
      laps: normalizeLaps(forDriver(raw.laps), forDriver(raw.positions)),
      pitStops: forDriver(raw.pits).map((p) => ({
        lap: p.lap_number,
        laneSeconds: p.lane_duration ?? null,
        stationarySeconds: p.stop_duration ?? null,
      })),
      stints: forDriver(raw.stints)
        .filter(
          (s): s is typeof s & { lap_start: number } => s.lap_start != null,
        )
        .map((s) => ({
          number: s.stint_number,
          startLap: s.lap_start,
          endLap: s.lap_end ?? null,
          compound: s.compound || "UNKNOWN",
          tyreAgeAtStart: s.tyre_age_at_start ?? null,
        })),
      result: result(
        raw.results.find((r) => r.driver_number === driver.number),
      ),
      unavailable: [...unavailable],
    };
  }) as [DriverRace, DriverRace];
  const notes = [
    ...unavailable.map((x) => `${x} data is unavailable for this race.`),
  ];
  if (
    raw.stints.some(
      (s) =>
        s.lap_start == null &&
        drivers.some((d) => d.number === s.driver_number),
    )
  )
    notes.push(
      "Some stints have no starting lap and are omitted from the timeline.",
    );
  if (mapped.some((d) => d.laps.some((l) => l.position === null)))
    notes.push(
      "Some lap positions could not be reconstructed from timed position events.",
    );
  return { race, drivers: mapped, notes };
}
