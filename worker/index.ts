import {
  buildComparison,
  isCompleted,
  OpenF1,
  toDriver,
  toRace,
  UpstreamError,
} from "./openf1";

const json = (body: unknown, status = 200, maxAge = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store",
    },
  });
const bad = (message: string, status = 400) => json({ error: message }, status);
const keyFrom = (value: string) =>
  /^\d{4,7}$/.test(value) ? Number(value) : null;

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
      return json(
        {
          races: sessions
            .filter((s) => isCompleted(s))
            .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))
            .map(toRace),
        },
        200,
        3600,
      );
    }
    const match = /^\/api\/races\/(\d+)\/(drivers|comparison)$/.exec(
      url.pathname,
    );
    if (!match) return bad("Route not found.", 404);
    const sessionKey = keyFrom(match[1]);
    if (!sessionKey) return bad("Invalid race.");
    const sessions = await api.session(sessionKey);
    const session = sessions[0];
    if (!session || !isCompleted(session))
      return bad("Completed race not found.", 404);
    const rawDrivers = await api.drivers(sessionKey);
    const drivers = rawDrivers
      .map(toDriver)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (match[2] === "drivers") return json({ drivers }, 200, 604800);
    const requested = url.searchParams.get("drivers")?.split(",") ?? [];
    if (
      requested.length !== 2 ||
      requested[0] === requested[1] ||
      requested.some((s) => !/^\d{1,3}$/.test(s))
    )
      return bad("Choose two different drivers.");
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
    const unavailable = [
      ...(datasets.laps.length ? [] : ["Lap"]),
      ...(positions.length ? [] : ["Position"]),
      ...(pits.length ? [] : ["Pit stop"]),
      ...(stints.length ? [] : ["Stint"]),
      ...(results.length ? [] : ["Result"]),
    ];
    return json(
      buildComparison(
        toRace(session),
        [chosen[0], chosen[1]],
        { ...datasets, positions, pits, stints, results },
        unavailable,
      ),
      200,
      604800,
    );
  } catch (error) {
    if (error instanceof UpstreamError) return bad(error.message, error.status);
    console.error("PitWall API request failed", error);
    return bad("Race data is temporarily unavailable.", 500);
  }
}

export default {
  fetch(request: Request) {
    return handleRequest(request);
  },
};
