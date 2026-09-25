import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const specs = {
  "bahrain-2023": {
    season: 2023,
    sessionKey: 7953,
    drivers: [16, 55],
    scenario: "retirement",
  },
  "bahrain-2024": {
    season: 2024,
    sessionKey: 9472,
    drivers: [16, 55],
    scenario: "baseline",
  },
  "australia-2025": {
    season: 2025,
    sessionKey: 9693,
    drivers: [4, 81],
    scenario: "safety-car",
  },
};
const id = process.argv[2];
const spec = specs[id];
if (!spec) throw new Error("Choose one of: " + Object.keys(specs).join(", "));
const base = process.argv[3] ?? "http://localhost:5173";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const finite = z.number().finite();
const driverSchema = z.object({
  number: finite,
  name: z.string(),
  acronym: z.string(),
  team: z.string(),
  color: z.string(),
});
const raceSchema = z.object({
  sessionKey: finite,
  year: finite,
  name: z.string(),
  circuit: z.string(),
  country: z.string(),
  date: z.string(),
});
const lapSchema = z.object({
  number: finite,
  durationSeconds: finite.nullable(),
  start: z.string().nullable(),
  pitOut: z.boolean(),
  position: finite.nullable(),
  gapToLeader: z.union([finite, z.string()]).nullable().optional(),
  gapSampledAt: z.string().nullable().optional(),
});
const driverRaceSchema = z.object({
  driver: driverSchema,
  laps: z.array(lapSchema),
  pitStops: z.array(
    z.object({
      lap: finite,
      laneSeconds: finite.nullable(),
      stationarySeconds: finite.nullable(),
    }),
  ),
  stints: z.array(
    z.object({
      number: finite,
      startLap: finite,
      endLap: finite.nullable(),
      compound: z.string(),
      tyreAgeAtStart: finite.nullable(),
    }),
  ),
  result: z
    .object({
      position: finite.nullable(),
      lapsCompleted: finite.nullable(),
      status: z.enum(["FINISHED", "DNF", "DNS", "DSQ", "UNKNOWN"]),
    })
    .nullable(),
  unavailable: z.array(z.string()),
});
const comparisonSchema = z.object({
  race: raceSchema,
  drivers: z.tuple([driverRaceSchema, driverRaceSchema]),
  events: z.array(
    z.object({
      date: z.string(),
      lap: finite.nullable(),
      category: z.enum(["SafetyCar", "Flag"]),
      flag: z.string().nullable(),
      scope: z.string().nullable(),
      message: z.string(),
    }),
  ),
  notes: z.array(z.string()),
  source: z.unknown().optional(),
});

async function read(path) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(new URL(path, base), {
      signal: AbortSignal.timeout(90000),
    });
    if (response.headers.get("X-PitWall-Source") === "snapshot")
      throw new Error(
        path +
          " came from a saved snapshot; capture requires a provider-backed response.",
      );
    if (response.status === 429 && attempt < 2) {
      await pause(20000 * (attempt + 1));
      continue;
    }
    if (!response.ok)
      throw new Error(
        path +
          " returned HTTP " +
          response.status +
          ": " +
          (await response.text()),
      );
    return response.json();
  }
  throw new Error(path + " could not be loaded after retries.");
}

const races = z
  .object({ races: z.array(raceSchema) })
  .parse(await read("/api/races?season=" + spec.season));
if (!races.races.some((race) => race.sessionKey === spec.sessionKey))
  throw new Error("Selected race is absent from the season catalog.");
await pause(1500);
const drivers = z
  .object({ drivers: z.array(driverSchema) })
  .parse(await read("/api/races/" + spec.sessionKey + "/drivers"));
if (
  !spec.drivers.every((number) =>
    drivers.drivers.some((driver) => driver.number === number),
  )
)
  throw new Error("Selected drivers are absent from the race roster.");
await pause(1500);
const comparison = comparisonSchema.parse(
  await read(
    "/api/races/" +
      spec.sessionKey +
      "/comparison?drivers=" +
      spec.drivers.join(",") +
      "&v=3&live=1",
  ),
);
if (comparison.source !== undefined)
  throw new Error("Comparison already came from a saved snapshot.");
if (
  comparison.race.sessionKey !== spec.sessionKey ||
  comparison.race.year !== spec.season
)
  throw new Error("Comparison race does not match the requested snapshot.");
if (
  comparison.drivers.some(
    (driver, index) =>
      driver.driver.number !== spec.drivers[index] ||
      driver.laps.length < 30 ||
      !driver.result,
  )
)
  throw new Error(
    "Comparison is missing a selected driver, result, or sufficient recorded laps.",
  );
if (
  spec.scenario === "retirement" &&
  comparison.drivers[0].result.status !== "DNF"
)
  throw new Error("Retirement example no longer contains the expected DNF.");
if (
  spec.scenario === "safety-car" &&
  !comparison.events.some((event) => event.category === "SafetyCar")
)
  throw new Error("Safety Car example has no recorded Safety Car event.");
if (
  spec.scenario === "baseline" &&
  !comparison.drivers.every((driver) =>
    driver.laps.some((lap) => lap.gapSampledAt),
  )
)
  throw new Error("Baseline example lacks gap samples.");

const coverage = {
  drivers: comparison.drivers.map((driver) => ({
    number: driver.driver.number,
    status: driver.result.status,
    laps: driver.laps.length,
    timedLaps: driver.laps.filter((lap) => lap.durationSeconds !== null).length,
    positionedLaps: driver.laps.filter((lap) => lap.position !== null).length,
    gapSamples: driver.laps.filter((lap) => lap.gapSampledAt).length,
    pitStops: driver.pitStops.length,
    stints: driver.stints.length,
  })),
  raceEvents: comparison.events.length,
  safetyCarEvents: comparison.events.filter(
    (event) => event.category === "SafetyCar",
  ).length,
  notes: comparison.notes,
};
const destination = fileURLToPath(
  new URL("../worker/snapshots/" + id + ".json", import.meta.url),
);
await mkdir(fileURLToPath(new URL("../worker/snapshots/", import.meta.url)), {
  recursive: true,
});
await writeFile(
  destination,
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      races: races.races,
      drivers: drivers.drivers,
      comparison,
      coverage,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);
console.log("Saved " + destination + "\n" + JSON.stringify(coverage, null, 2));
