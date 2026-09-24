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

**Problem:** OpenF1's free historical tier is 3 requests per second and 30 per minute.

**Decision:** cache upstream completed-race responses in the Worker for seven days and season lists for one hour, return browser cache headers, and use TanStack Query in memory. Cold comparison datasets are fetched in sequence with a 400 ms interval. Return an actionable message on `429`; do not retry it automatically in the browser.

**Trade-off:** Cloudflare's Cache API is local to a data center and does not guarantee a global request ceiling during concurrent cold requests. A coordinated limiter or precomputation would be justified if public traffic grows.

## Visualization

**Problem:** charts need tooltips, pit markers and future race annotations.

**Options:** Recharts or Apache ECharts.

**Decision:** ECharts with tree-shaken core components.

**Trade-off:** more configuration than Recharts, but a better fit for rich event overlays.
