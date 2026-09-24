import { describe, expect, it, vi } from "vitest";
import { buildComparison, normalizeLaps, OpenF1 } from "../worker/openf1";
import { handleRequest } from "../worker/index";

const race = {
  sessionKey: 7953,
  year: 2023,
  name: "Sakhir",
  circuit: "Bahrain",
  country: "Bahrain",
  date: "2023-03-05T15:00:00Z",
};
const a = {
  number: 16,
  name: "Charles LECLERC",
  acronym: "LEC",
  team: "Ferrari",
  color: "#ed1c24",
};
const b = {
  number: 44,
  name: "Lewis HAMILTON",
  acronym: "HAM",
  team: "Mercedes",
  color: "#00d2be",
};

describe("race data normalization", () => {
  it("uses the last position event before lap end and preserves missing points", () => {
    const laps = [
      {
        driver_number: 16,
        lap_number: 1,
        date_start: "2023-03-05T15:00:00Z",
        lap_duration: 90,
        is_pit_out_lap: false,
      },
      {
        driver_number: 16,
        lap_number: 2,
        date_start: "2023-03-05T15:01:30Z",
        lap_duration: null,
        is_pit_out_lap: true,
      },
    ];
    const positions = [
      { driver_number: 16, date: "2023-03-05T15:00:30Z", position: 3 },
      { driver_number: 16, date: "2023-03-05T15:02:00Z", position: 2 },
    ];
    expect(normalizeLaps(laps, positions)).toMatchObject([
      { position: 3, durationSeconds: 90 },
      { position: null, durationSeconds: null, pitOut: true },
    ]);
  });

  it("keeps a DNF with no final position and distinguishes pit durations", () => {
    const value = buildComparison(
      race,
      [a, b],
      {
        laps: [],
        positions: [],
        pits: [
          {
            driver_number: 16,
            lap_number: 13,
            lane_duration: 24.2,
            stop_duration: null,
          },
        ],
        stints: [],
        results: [
          { driver_number: 16, position: null, number_of_laps: 39, dnf: true },
        ],
      },
      ["Stint"],
    );
    expect(value.drivers[0].result).toEqual({
      position: null,
      lapsCompleted: 39,
      status: "DNF",
    });
    expect(value.drivers[0].pitStops[0]).toEqual({
      lap: 13,
      laneSeconds: 24.2,
      stationarySeconds: null,
    });
    expect(value.notes).toContain("Stint data is unavailable for this race.");
  });
  it("keeps valid stints and explains missing starting laps", () => {
    const value = buildComparison(race, [a, b], {
      laps: [],
      positions: [],
      pits: [],
      results: [],
      stints: [
        {
          driver_number: 16,
          stint_number: 1,
          lap_start: null,
          lap_end: 12,
          compound: "SOFT",
          tyre_age_at_start: 0,
        },
        {
          driver_number: 16,
          stint_number: 2,
          lap_start: 13,
          lap_end: 30,
          compound: "HARD",
          tyre_age_at_start: 0,
        },
      ],
    });
    expect(value.drivers[0].stints).toHaveLength(1);
    expect(value.drivers[0].stints[0].startLap).toBe(13);
    expect(value.notes).toContain(
      "Some stints have no starting lap and are omitted from the timeline.",
    );
  });
});

describe("PitWall API", () => {
  const payloads: Record<string, unknown> = {
    "sessions?session_key=7953": [
      {
        session_key: 7953,
        year: 2023,
        session_name: "Race",
        date_start: "2023-03-05T15:00:00Z",
        date_end: "2023-03-05T17:00:00Z",
        country_name: "Bahrain",
        circuit_short_name: "Bahrain",
      },
    ],
    "drivers?session_key=7953": [
      {
        driver_number: 16,
        full_name: "Charles LECLERC",
        name_acronym: "LEC",
        team_name: "Ferrari",
        team_colour: "ed1c24",
      },
      {
        driver_number: 44,
        full_name: "Lewis HAMILTON",
        name_acronym: "HAM",
        team_name: "Mercedes",
        team_colour: "00d2be",
      },
    ],
    "laps?session_key=7953": [
      {
        driver_number: 16,
        lap_number: 1,
        lap_duration: 95,
        date_start: "2023-03-05T15:00:00Z",
        is_pit_out_lap: false,
      },
    ],
    "position?session_key=7953": [
      { driver_number: 16, date: "2023-03-05T15:00:30Z", position: 3 },
    ],
    "stints?session_key=7953": [
      {
        driver_number: 16,
        stint_number: 1,
        lap_start: 1,
        lap_end: 13,
        compound: "SOFT",
        tyre_age_at_start: 0,
      },
    ],
    "session_result?session_key=7953": [
      { driver_number: 16, position: null, number_of_laps: 39, dnf: true },
    ],
  };
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input).split("/v1/")[1];
    return path === "pit?session_key=7953"
      ? new Response(null, { status: 404 })
      : Response.json(payloads[path] ?? []);
  });
  const api = new OpenF1(fetcher as typeof fetch);

  it("returns a complete normalized comparison when pit records are missing", async () => {
    const response = await handleRequest(
      new Request(
        "https://pitwall.test/api/races/7953/comparison?drivers=16,44",
      ),
      api,
    );
    const data = (await response.json()) as {
      drivers: {
        laps: { position: number | null }[];
        result: { status: string };
      }[];
      notes: string[];
    };
    expect(response.status).toBe(200);
    expect(data.drivers[0].laps[0].position).toBe(3);
    expect(data.drivers[0].result.status).toBe("DNF");
    expect(data.notes).toContain("Pit stop data is unavailable for this race.");
  });

  it("rejects duplicate drivers before fetching comparison datasets", async () => {
    const response = await handleRequest(
      new Request(
        "https://pitwall.test/api/races/7953/comparison?drivers=16,16",
      ),
      api,
    );
    expect(response.status).toBe(400);
  });
  it("explains OpenF1's live-session lock without exposing its payment link", async () => {
    const paused = new OpenF1(
      vi.fn(async () =>
        Response.json(
          {
            detail:
              "Live F1 session in progress. Global API access (including past sessions) is restricted to authenticated users until the session ends. Get an API key here: https://example.test/pay",
          },
          { status: 401 },
        ),
      ) as typeof fetch,
    );
    const response = await handleRequest(
      new Request("https://pitwall.test/api/races?season=2025"),
      paused,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error:
        "OpenF1 pauses free historical access during live F1 sessions. Please try again after the session ends.",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("turns upstream rate limits into a readable API response", async () => {
    const limited = new OpenF1(
      vi.fn(async () => new Response(null, { status: 429 })) as typeof fetch,
    );
    const response = await handleRequest(
      new Request("https://pitwall.test/api/races?season=2025"),
      limited,
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "OpenF1 request limit reached. Please try again shortly.",
    });
  });
});

describe("featured race fallback", () => {
  const unavailable = new OpenF1(
    vi.fn(
      async () => new Response("Unavailable", { status: 503 }),
    ) as typeof fetch,
  );

  it("keeps the 2024 catalog and featured drivers available", async () => {
    const races = await handleRequest(
      new Request("https://pitwall.test/api/races?season=2024"),
      unavailable,
    );
    expect(races.status).toBe(200);
    expect(races.headers.get("X-PitWall-Source")).toBe("snapshot");
    expect(
      ((await races.json()) as { races: { sessionKey: number }[] }).races.some(
        (race) => race.sessionKey === 9472,
      ),
    ).toBe(true);

    const drivers = await handleRequest(
      new Request("https://pitwall.test/api/races/9472/drivers"),
      unavailable,
    );
    expect(drivers.status).toBe(200);
    expect(drivers.headers.get("X-PitWall-Source")).toBe("snapshot");
    expect(
      ((await drivers.json()) as { drivers: { number: number }[] }).drivers.map(
        (driver) => driver.number,
      ),
    ).toEqual(expect.arrayContaining([16, 55]));
  });

  it("serves a labelled comparison in the requested driver order", async () => {
    const response = await handleRequest(
      new Request(
        "https://pitwall.test/api/races/9472/comparison?drivers=55,16",
      ),
      unavailable,
    );
    const body = (await response.json()) as {
      drivers: { driver: { number: number }; laps: unknown[] }[];
      source: { kind: string; capturedAt: string };
    };
    expect(response.status).toBe(200);
    expect(response.headers.get("X-PitWall-Source")).toBe("snapshot");
    expect(body.drivers.map((driver) => driver.driver.number)).toEqual([
      55, 16,
    ]);
    expect(body.drivers.every((driver) => driver.laps.length >= 40)).toBe(true);
    expect(body.source.kind).toBe("snapshot");
    expect(Date.parse(body.source.capturedAt)).not.toBeNaN();
  });

  it("does not substitute the sample for other comparisons", async () => {
    const response = await handleRequest(
      new Request(
        "https://pitwall.test/api/races/9472/comparison?drivers=16,44",
      ),
      unavailable,
    );
    expect(response.status).toBe(502);
  });
});
