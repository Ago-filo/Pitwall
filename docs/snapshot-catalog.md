# Curated race snapshots

PitWall saves three small, validated comparison responses with their source catalog, driver roster, capture time and a coverage report. The cards on the home page are returned by GET /api/highlights. A card opens its saved two-driver comparison without requesting OpenF1. The comparison displays its capture date and its original data notes.

| Example | Drivers | Recorded laps | Gap samples | Pit records | Race-control context |
| --- | --- | ---: | ---: | ---: | --- |
| Bahrain 2023, retirement | Leclerc / Sainz | 40 / 57 | 0 / 57 | 0 / 0 | 13 selected events, 2 Safety Car messages |
| Bahrain 2024, baseline | Leclerc / Sainz | 57 / 57 | 57 / 57 | 2 / 2 | 7 selected events |
| Australia 2025, Safety Car | Norris / Piastri | 58 / 57 | 56 / 57 | 5 / 5 | 50 selected events, 7 Safety Car messages |

These are counts in snapshots captured on 25 September 2026. They describe PitWall's normalized, filtered response, not the complete upstream feed. A recorded lap can lack a timed duration or reconstructed position. Bahrain 2023 has no pit records from the source and no usable leader-gap samples for Leclerc; the UI reports those limits.

## How the fallback works

The three guided pairs are served from saved responses in either driver order and labelled with the capture date. Other pairs remain provider-backed. If a catalog or roster request reaches the Worker and OpenF1 fails, the fallback returns only curated races or drivers that have a saved comparison. A previously cached full catalog or roster can still be served until its cache entry expires; those other pairs may then fail to open during the outage. The three guided cards and their saved comparisons remain actionable. The public catalog lists every completed race returned by OpenF1 when it is available.

The Worker cache can retain an older API response across deployments. The browser's comparison request uses a schema version in its query string; changing that version when the response contract changes avoids accidentally showing an older cached shape. The capture script requests a provider-backed comparison with the live parameter and rejects a saved response.

## Refreshing a snapshot

Run npm ci and npm run dev. In another terminal, run one of:

~~~sh
npm run capture:snapshot -- bahrain-2023
npm run capture:snapshot -- bahrain-2024
npm run capture:snapshot -- australia-2025
~~~

An optional second argument is a PitWall base URL. The script validates the season catalog, driver roster and normalized comparison with Zod. It requires at least 30 recorded laps and a result for each selected driver. It also requires Leclerc's DNF for the retirement example, a Safety Car message for the Australia example, and gap samples for both drivers in the Bahrain 2024 baseline. It writes a new capture timestamp and measured coverage only after the checks pass. Rate-limited requests retry with bounded delays; a snapshot response is rejected. Run npm test to check that saved coverage still matches every file.

Snapshots are intentional editorial examples. Their counts or data notes may change on refresh if OpenF1 revises historical records. Review the diff, verify the examples in the browser and update the table above before publishing.