import {
  buildComparison,
  isCompleted,
  OpenF1,
  toDriver,
  toRace,
  UpstreamError,
} from "./openf1";
import {
  archivedComparison,
  archivedDrivers,
  archivedRaces,
  guidedRaces,
} from "./snapshots";

const json = (body: unknown, status = 200, maxAge = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": maxAge
        ? `public, max-age=${maxAge}, stale-if-error=${maxAge >= 604800 ? 30 * 86400 : 86400}`
        : "no-store",
    },
  });
const bad = (message: string, status = 400) => json({ error: message }, status);
const keyFrom = (value: string) =>
  /^\d{4,7}$/.test(value) ? Number(value) : null;

function archived(body: unknown): Response {
  const response = json(body, 200, 30 * 86400);
  response.headers.set("X-PitWall-Source", "snapshot");
  return response;
}

function snapshotFallback(url: URL): Response | null {
  if (url.pathname === "/api/races") {
    const season = Number(url.searchParams.get("season"));
    const races = archivedRaces(season);
    return races.length ? archived({ races }) : null;
  }
  const match = /^\/api\/races\/(\d+)\/(drivers|comparison)$/.exec(
    url.pathname,
  );
  if (!match) return null;
  const sessionKey = keyFrom(match[1]);
  if (!sessionKey) return null;
  if (match[2] === "drivers") {
    const drivers = archivedDrivers(sessionKey);
    return drivers ? archived({ drivers }) : null;
  }
  const numbers = url.searchParams.get("drivers")?.split(",").map(Number) ?? [];
  const comparison = archivedComparison(sessionKey, numbers);
  return comparison ? archived(comparison) : null;
}

export async function handleRequest(
  request: Request,
  api = new OpenF1(
    fetch,
    (caches as CacheStorage & { default: Cache }).default,
  ),
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET") return bad("Method not allowed.", 405);
  if (url.pathname === "/api/health") return json({ status: "ok" });
  if (url.pathname === "/api/highlights")
    return json({ highlights: guidedRaces() }, 200, 30 * 86400);
  if (url.pathname === "/api/seasons")
    return json(
      {
        seasons: Array.from(
          { length: new Date().getUTCFullYear() - 2022 },
          (_, i) => 2023 + i,
        ).reverse(),
      },
      200,
      86400,
    );
  try {
    if (url.pathname === "/api/races") {
      const year = Number(url.searchParams.get("season"));
      if (
        !Number.isInteger(year) ||
        year < 2023 ||
        year > new Date().getUTCFullYear()
      )
        return bad("Select a season from 2023 onward.");
      const sessions = await api.sessions(year);
      const races = sessions.filter((s) => isCompleted(s)).map(toRace);
      for (const archivedRace of archivedRaces(year))
        if (!races.some((race) => race.sessionKey === archivedRace.sessionKey))
          races.push(archivedRace);
      return json(
        {
          races: races.sort((a, b) => Date.parse(a.date) - Date.parse(b.date)),
        },
        200,
        year < new Date().getUTCFullYear() ? 30 * 86400 : 3600,
      );
    }
    const match = /^\/api\/races\/(\d+)\/(drivers|comparison)$/.exec(
      url.pathname,
    );
    if (!match) return bad("Route not found.", 404);
    const sessionKey = keyFrom(match[1]);
    if (!sessionKey) return bad("Invalid race.");
    const requested =
      match[2] === "comparison"
        ? (url.searchParams.get("drivers")?.split(",") ?? [])
        : [];
    if (
      match[2] === "comparison" &&
      (requested.length !== 2 ||
        requested[0] === requested[1] ||
        requested.some((number) => !/^\d{1,3}$/.test(number)))
    )
      return bad("Choose two different drivers.");
    if (match[2] === "comparison" && url.searchParams.get("live") !== "1") {
      const saved = archivedComparison(sessionKey, requested.map(Number));
      if (saved) return archived(saved);
    }
    const sessions = await api.session(sessionKey);
    const session = sessions[0];
    if (!session || !isCompleted(session))
      return bad("Completed race not found.", 404);
    const rawDrivers = await api.drivers(sessionKey);
    const drivers = rawDrivers
      .map(toDriver)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (match[2] === "drivers") return json({ drivers }, 200, 604800);
    const chosen = requested.map((s) =>
      drivers.find((d) => d.number === Number(s)),
    );
    if (!chosen[0] || !chosen[1])
      return bad("Both drivers must belong to this race.");
    const datasets = { laps: await api.laps(sessionKey) };
    const positions = await api.positions(sessionKey);
    const pits = await api.pits(sessionKey);
    const stints = await api.stints(sessionKey);
    const results = await api.results(sessionKey);
    const optional = async <T>(
      load: () => Promise<T[]>,
    ): Promise<T[] | null> => {
      try {
        return await load();
      } catch (error) {
        if (error instanceof UpstreamError) return null;
        throw error;
      }
    };
    const raceControl = await optional(() => api.raceControl(sessionKey));
    const firstIntervals = await optional(() =>
      api.intervals(sessionKey, chosen[0]!.number),
    );
    const secondIntervals = await optional(() =>
      api.intervals(sessionKey, chosen[1]!.number),
    );
    const unavailable = [
      ...(datasets.laps.length ? [] : ["Lap"]),
      ...(positions.length ? [] : ["Position"]),
      ...(pits.length ? [] : ["Pit stop"]),
      ...(stints.length ? [] : ["Stint"]),
      ...(results.length ? [] : ["Result"]),
    ];
    const comparison = buildComparison(
      toRace(session),
      [chosen[0], chosen[1]],
      {
        ...datasets,
        positions,
        pits,
        stints,
        results,
        raceControl: raceControl ?? [],
        intervals: [...(firstIntervals ?? []), ...(secondIntervals ?? [])],
      },
      unavailable,
    );
    if (!raceControl?.length)
      comparison.notes.push("Race control data is unavailable for this race.");
    if (!firstIntervals?.length || !secondIntervals?.length)
      comparison.notes.push(
        "Gap-to-leader samples are unavailable for one or both selected drivers.",
      );
    return json(comparison, 200, 604800);
  } catch (error) {
    if (error instanceof UpstreamError)
      return snapshotFallback(url) ?? bad(error.message, error.status);
    console.error("PitWall API request failed", error);
    return bad("Race data is temporarily unavailable.", 500);
  }
}

export default {
  fetch(request: Request) {
    return handleRequest(request);
  },
};
