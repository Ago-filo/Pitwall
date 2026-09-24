# Race Analysis rules

PitWall turns one normalized comparison into a short set of descriptive observations. The implementation is a pure TypeScript function in src/race-insights.ts. It runs in the browser on the already-fetched comparison response; no extra OpenF1 requests or generated text are involved. Each observation contains its title, exact wording, a method note and lap numbers that open the corresponding point in the timeline.

| Observation | Required evidence | Rule |
| --- | --- | --- |
| Observed position | At least two reconstructable lap positions for each driver | Show each driver's first and last available plotted position, with the exact lap numbers. These are not official start or finish positions. |
| Same-lap pace | At least five shared lap numbers with a positive finite time for both | Calculate each driver's median over the *same* selected lap numbers. Exclude a lap if either driver has a recorded pit stop or pit-out flag on it. |
| First recorded stops | A pit record for each driver | Show each driver's earliest recorded pit lap. Do not infer a strategy outcome. |
| Sampled leader gap | At least two numeric gap-to-leader samples for each driver, assigned to recorded laps | Show each driver's first and last numeric sample and its lap. Lapped labels and missing values are not converted to numbers. |

All observations are optional. Missing source data removes only the observations it cannot support. Even when a lap is included in the pace comparison, traffic, tyre age, weather and Safety Car conditions may differ. The lap numbers match, but the cars do not necessarily pass the timing line together.

## Worked test fixture

The fixture in tests/race-insights.test.ts has eight laps for Leclerc and Sainz. Leclerc's first recorded stop is on lap 4 and Sainz's is on lap 5. Sainz's lap 6 is marked as pit-out. Thus the paired pace set is laps 1, 2, 3, 7 and 8: five shared laps after the documented exclusions. Their median recorded times in that set are 89.000 s and 91.000 s respectively. This statement describes those records; it does not claim that one driver would be faster under equal conditions.

The same fixture produces an observed-position statement from laps 1 and 8 and a sampled leader-gap statement from numeric samples on those laps. A separate sparse fixture has a DNF and only one lap per driver; it produces no unsupported observation. Another test checks missing times, pit-out flags and a lapped gap label.

Run the checks with npm test. The application still displays raw lap values, source notes, chart tables and the timeline so a visitor can inspect the evidence behind each observation.