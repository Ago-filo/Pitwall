# Engineering decisions

## React SPA and Cloudflare Worker

**Problem:** provide a public race comparison with a portfolio-worthy API and low operational cost.

**Options:** browser-to-OpenF1 only; React plus a small Cloudflare Worker; a conventional server and database.

**Decision:** one Vite project with a React SPA and Worker handling `/api/*`.

**Reason:** the Worker owns validation, normalization, error handling and cache policy while the SPA remains simple. One deployment can serve both.

**Trade-off:** more code and a Cloudflare account are needed than for a frontend-only site. No database is needed for historical provider data.

## OpenF1 adapter and domain API

**Problem:** OpenF1 may change or omit fields, and the UI needs consistent race concepts.

**Options:** pass upstream JSON through; normalize at the boundary.

**Decision:** validate upstream arrays with Zod and return PitWall types from the Worker. The comparison endpoint aggregates all required datasets.

**Trade-off:** validation requires schema maintenance; it prevents malformed data from silently reaching charts. A missing endpoint returns an empty dataset with a visible note; an invalid response returns an error.

## Position chart

**Problem:** OpenF1 position events have timestamps, not lap numbers.

**Decision:** calculate each lap's approximate end as `date_start + lap_duration`; use the latest position event at or before that time. A lap with no usable start or duration gets a null position. Missing values remain gaps in the chart.

**Trade-off:** OpenF1 describes `date_start` as approximate. The plotted position is an estimate, not an official lap-end classification. The UI labels this limitation.

## Caching and rate limits

**Problem:** OpenF1's free historical tier is 3 requests per second and 30 per minute. During a live F1 session, its public API can also return `401` for past sessions.

**Decision:** cache historical API responses at the Worker boundary with Workers Caching enabled across deploy versions and `stale-if-error`, retain the Cache API as a local upstream cache, return browser cache headers, and use TanStack Query in memory. Race lists from past seasons remain fresh for 30 days; the current season remains fresh for one hour. Uncached upstream requests within one Worker request are spaced by at least 400 ms. Return actionable messages on `429` and OpenF1's live-session `401`, without automatic browser retries for either condition.

**Trade-off:** The Cache API is local to a data center, while Workers Caching stores completed API responses before the Worker runs. Cross-version caching keeps warm responses after a deploy. The comparison API cache key includes a schema version query parameter; it must be incremented when the response contract changes, because old entries otherwise remain until expiry or purge. A cache miss during a live session still cannot load historical data without OpenF1 authentication. `stale-if-error` can serve previously cached data, but it is not a durable guarantee: edge cache entries may be evicted. Durable snapshots or precomputation would be justified if uninterrupted access becomes a requirement.

## Visualization

**Problem:** charts need tooltips, pit markers and future race annotations.

**Options:** Recharts or Apache ECharts.

**Decision:** ECharts with tree-shaken core components.

**Trade-off:** more configuration than Recharts, but a better fit for rich event overlays.

## Lap timeline and stint pace

**Problem:** separate charts make it difficult to follow the same moment for two drivers. Raw stint lap times are also distorted by recorded pit-stop and pit-out laps.

**Decision:** one selected lap drives both chart markers and the two driver snapshots. The snapshots show only the values actually recorded or reconstructed for that lap. A pure TypeScript analysis function computes each stint's median from available positive lap durations, excluding recorded pit-stop laps and pit-out laps. The UI shows the number of laps used and pit laps excluded.

**Trade-off:** this median is descriptive, not a controlled comparison of driver ability. Missing durations are omitted; Safety Car, traffic, weather and tyre age are not adjusted for. A stint without usable timed laps has no pace value.

## Curated snapshots and guided races

**Problem:** one saved comparison left other portfolio examples dependent on OpenF1 availability, while a fallback season catalog listed races that could not be opened during an outage.

**Decision:** bundle three validated, dated comparisons from different seasons: a DNF with missing pit records, a complete teammate comparison, and a race with Safety Car context. Serve the saved pair directly in either order, mark the response and show its capture date. A static GET /api/highlights endpoint exposes each race, pair and measured data coverage. On an upstream failure reaching the Worker, fallback race and driver catalogs include only saved choices; a previously cached full catalog may still be served until it expires. The capture script requests provider-backed data explicitly, validates each scenario and records coverage.

**Trade-off:** the guided pair is a dated historical snapshot; it does not update automatically if OpenF1 later revises past data. Other driver pairs still need OpenF1 or a warm cache. The source date and data notes remain visible to avoid implying current or complete data. Season, race and drivers remain encoded in shareable URLs.

## Race context and sampled gaps

**Problem:** a change in lap time or position is difficult to interpret without race-control context, while OpenF1 interval readings are timestamped samples rather than lap-end measurements.

**Decision:** fetch race-control messages once per comparison and intervals only for the two selected drivers. Keep Safety Car messages and selected Track/Sector flag events, using their source lap numbers without inventing placement for missing lap numbers. Collapse identical messages repeated within one lap. For each timed lap, use the latest gap-to-leader sample whose timestamp falls inside its approximate start/end window. Preserve numeric seconds, lapped labels and null. Both datasets are optional so their failure does not hide core race data.

**Trade-off:** the gap sample may precede the actual lap end and each driver is sampled independently; it is neither an exact lap-end gap nor a measured gap between the selected drivers. Race-control messages show session context but do not prove their effect on a driver. The current stint median still includes Safety Car laps.


## Evidence-linked Race Analysis

**Problem:** charts make the data visible, but visitors still need to find the main recorded changes themselves.

**Decision:** a pure TypeScript function in src/race-insights.ts produces four optional, descriptive observations from one normalized comparison: first and last reconstructable positions, median times on shared lap numbers, first recorded pit stops, and first and last numeric leader-gap samples. Each observation links to its source laps. Missing or insufficient data suppresses the relevant observation. See [rules and worked example](race-analysis.md).

**Trade-off:** these observations do not establish why a change happened. Same-numbered laps may have different traffic, tyres, weather and Safety Car conditions. The summary uses no hidden pace filters beyond positive lap times and recorded pit/pit-out exclusions.

## Accessible charts and deferred loading

**Problem:** canvas charts do not expose their values reliably to assistive technology, and ECharts dominated the initial client bundle.

**Decision:** provide expandable HTML tables with all charted lap values, visible keyboard focus, a skip link and larger touch targets. Load chart components only after a comparison is available, then split ECharts and zrender into their own chunks.

**Trade-off:** a comparison still downloads the chart engine, while the landing page and selection flow avoid that cost. Tables add markup only when their chart module loads.
