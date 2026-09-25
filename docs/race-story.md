# Race Story

Race Story turns a normalized two-driver comparison into a lap-ordered list of source-backed moments. The implementation lives in `src/race-story.ts`; the React view lives in `src/RaceStoryView.tsx`. This is a descriptive sequence, not a reconstruction of causes or complete race phases.

## Selection rules

1. Add the first lap with a reconstructed position for both selected drivers. The recorded values are shown as a reference, not as reported starting positions.
2. Add every recorded pit-stop entry whose lap exists in at least one selected driver's lap data. When present, display pit lane duration and stationary duration separately. Missing durations stay missing.
3. Add OpenF1 Safety Car messages and red-flag messages with a usable lap number. Other flags remain in the detailed lap timeline. Messages without a usable lap number are counted but not placed.
4. For a driver classified DNF, add their last recorded lap. This is explicitly not identified as the exact retirement lap.
5. Group signals from the same lap and sort by lap number. Show reconstructed positions on that lap only when they exist. Show reported classification in a separate footer because it may differ from the last lap record.

The view initially shows seven moments and offers an explicit control to reveal the full sequence. Each moment links to the corresponding lap snapshot. The algorithm does not infer overtakes, pit-stop effects, Safety Car duration, or why a driver retired.

## Worked examples

- **Bahrain 2023:** Leclerc has 39 completed laps in the reported result and a final lap record at lap 40. Race Story labels lap 40 as the last recorded lap and lists the DNF in reported classification. Pit-stop records for this comparison are unavailable, so no pit moment is generated.
- **Bahrain 2024:** The two Ferrari drivers have recorded pit stops on different laps. The story lists each stop and its available duration fields. It contains no Safety Car message because none is in this saved comparison.
- **Australia 2025:** Multiple Safety Car messages and pit records appear, including several on the same lap. The story groups the recorded signals by lap while preserving each message, without treating a deployment and an in-lap message as a continuous measured interval.

## Verification

`tests/race-story.test.ts` checks chronological grouping, missing positions and durations, an unplaced red flag, DNF wording and all three dated guided snapshots. The rules use the same normalized response as the charts and lap timeline, so no extra API call is needed.