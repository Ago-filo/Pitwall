import type { Comparison, Driver, Race } from "./domain";

export class PitwallApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "Unable to load race data.";
    throw new PitwallApiError(message, response.status);
  }
  return body as T;
}

export const pitwall = {
  seasons: () => get<{ seasons: number[] }>("/api/seasons"),
  races: (season: number) =>
    get<{ races: Race[] }>(`/api/races?season=${season}`),
  drivers: (key: number) =>
    get<{ drivers: Driver[] }>(`/api/races/${key}/drivers`),
  comparison: (key: number, a: number, b: number) =>
    get<Comparison>(`/api/races/${key}/comparison?drivers=${a},${b}&v=2`),
};
