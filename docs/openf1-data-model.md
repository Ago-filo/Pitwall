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
