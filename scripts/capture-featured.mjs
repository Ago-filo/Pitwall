import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const base = process.argv[2] ?? "http://localhost:5173";
const destination = fileURLToPath(
  new URL("../worker/snapshots/bahrain-2024.json", import.meta.url),
);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function read(path) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(new URL(path, base));
    if (response.headers.get("X-PitWall-Source") === "snapshot") {
      throw new Error(
        `${path} returned an existing snapshot. Capture requires fresh OpenF1 data.`,
      );
    }
    if (response.status === 429 && attempt < 2) {
      await pause(4000 * (attempt + 1));
      continue;
    }
    if (!response.ok)
      throw new Error(
        `${path} returned HTTP ${response.status}: ${await response.text()}`,
      );
    return response.json();
  }
  throw new Error(`${path} could not be loaded after retries.`);
}

const races = await read("/api/races?season=2024");
await pause(1500);
const drivers = await read("/api/races/9472/drivers");
await pause(1500);
const comparison = await read("/api/races/9472/comparison?drivers=16,55");
if (
  !Array.isArray(races.races) ||
  !races.races.some((race) => race.sessionKey === 9472)
)
  throw new Error("Bahrain 2024 is absent from the race list.");
if (
  !Array.isArray(drivers.drivers) ||
  ![16, 55].every((number) =>
    drivers.drivers.some((driver) => driver.number === number),
  )
)
  throw new Error("Featured drivers are absent.");
if (
  comparison.race?.sessionKey !== 9472 ||
  comparison.drivers?.length !== 2 ||
  comparison.drivers[0].driver.number !== 16 ||
  comparison.drivers[1].driver.number !== 55 ||
  comparison.drivers.some(
    (driver) => driver.laps.length < 40 || driver.stints.length === 0,
  )
)
  throw new Error("Featured comparison is incomplete.");
if (comparison.source?.kind === "snapshot")
  throw new Error("The comparison came from a saved snapshot.");
const snapshot = {
  capturedAt: new Date().toISOString(),
  races: races.races,
  drivers: drivers.drivers,
  comparison,
};
await mkdir(fileURLToPath(new URL("../worker/snapshots/", import.meta.url)), {
  recursive: true,
});
await writeFile(destination, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(
  `Saved ${destination}: ${races.races.length} races, ${drivers.drivers.length} drivers, ${comparison.drivers.map((driver) => driver.laps.length).join("/")} laps.`,
);
