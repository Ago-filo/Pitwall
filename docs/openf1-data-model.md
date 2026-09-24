# OpenF1 data model and observed cases

Source: [OpenF1 documentation](https://openf1.org/docs/). Responses were sampled on 24 September 2026.

| OpenF1 endpoint | PitWall use | Important fields |
| --- | --- | --- |
| `sessions` | completed race catalog | `session_key`, `session_name`, `year`, `date_start`, `date_end`, `is_cancelled` |
| `drivers` | participants | `driver_number`, `full_name`, `name_acronym`, `team_colour` |
| `laps` | lap pace and time boundaries | `driver_number`, `lap_number`, `date_start`, `lap_duration`, `is_pit_out_lap` |
| `position` | timed position events | `date`, `driver_number`, `position` |
| `pit` | pit markers and durations | `lap_number`, `lane_duration`, `stop_duration` |
| `stints` | tyre timeline | `stint_number`, `lap_start`, `lap_end`, `compound`, `tyre_age_at_start` |
| `session_result` | finishing status | `position`, `number_of_laps`, `dnf`, `dns`, `dsq` |
| `intervals` | sampled gap to the leader | `date`, `driver_number`, `gap_to_leader` (seconds, lap label or null) |
| `race_control` | notable session context | `date`, `lap_number`, `category`, `flag`, `scope`, `message` |

## Observed data

- Bahrain 2023 (`session_key=7953`): 20 drivers and 40 lap records for driver 16. Leclerc's result reports `dnf: true`, `position: null`, `number_of_laps: 39`. A lap record can exist beyond the official completed-lap count.
- The entire `pit?session_key=7953` request returned HTTP 404 in the sampled API, so PitWall reports pit data unavailable for that race.
- A 2025 race (`session_key=9877`) returned pit records with both `lane_duration` and `stop_duration`. The two measures are shown separately.
- Race session lists were returned for 2023, 2024, 2025 and 2026. Future sessions are excluded using `date_end` plus a 30-minute buffer.

## Normalization rules

- Duration remains in seconds as supplied by OpenF1; absent values become `null`.
- A lap's approximate end is `date_start + lap_duration`. Its plotted position is the last position event at or before that instant. If that time cannot be calculated, position is `null`.
- No lap times are filtered out. Pit-out laps are marked separately.
- `lane_duration` is pit lane time. `stop_duration` is stationary time and may be absent, especially before the 2024 United States Grand Prix. The deprecated `pit_duration` field is ignored.
- `DNF`, `DNS` and `DSQ` take precedence over finishing position. Missing final position is not converted into a numeric position.
- Empty source datasets generate visible notes. Invalid upstream schemas produce a controlled API error.
- For each timed lap, the latest gap-to-leader sample inside the approximate lap start/end window is shown. Samples outside that window are not carried forward; `null` and lapped labels remain distinct. The two drivers are sampled independently, so this is not a measured gap between them.
- Race-control events use OpenF1 lap numbers directly. Safety Car messages and Track/Sector yellow, red, green, clear and chequered flags are shown; repeated identical messages within one lap are collapsed. Events without a lap number are kept in the API but cannot be placed on the lap timeline.
- If `intervals` or `race_control` fails, the core comparison remains available and shows a data note.

- Additional spot checks on 24 September 2026 found non-empty driver, lap, position, pit, stint and result datasets for Bahrain 2024 (session_key=9472), Australia 2025 (session_key=9693) and Australia 2026 (session_key=11234).
- Some 2025 stint records have `lap_start: null`. They are excluded from the tyre timeline because their placement is unknown, and the comparison shows a note explaining this.

## Context spot checks

- Bahrain 2024 (`session_key=9472`): both featured drivers had gap samples on all 57 recorded laps, and the selected race-control set contained 7 events.
- Australia 2025 (`session_key=9693`): the selected race-control set contained 50 events, including 7 Safety Car messages; both checked drivers had sampled gaps on 57 recorded laps. These counts reflect the current OpenF1 response and PitWall's documented event filter.
