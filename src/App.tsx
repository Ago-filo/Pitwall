import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { LineChart, ScatterChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
  MarkLineComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { Comparison, Driver, DriverRace, Race } from "./domain";
import { portraitFor } from "./portraits";
import { pitwall } from "./api";
import { lapSnapshot, stintPace } from "./analysis";

const surface = "#122632";
const comparisonColors = ["#d8e95d", "#65d6dc"] as const;
echarts.use([
  LineChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  MarkLineComponent,
  CanvasRenderer,
]);
const line = "#36515c";
const text = "#dce9e8";
const axis = {
  axisLine: { lineStyle: { color: line } },
  axisLabel: { color: "#a5bdc0" },
  splitLine: { lineStyle: { color: "#29404a" } },
};
const displayTime = (seconds: number | null) =>
  seconds === null
    ? "—"
    : `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(3).padStart(6, "0")}`;

function Select({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PortraitPanel({
  driver,
  side,
  season,
}: {
  driver: Driver | null;
  side: "A" | "B";
  season: number;
}) {
  const [failed, setFailed] = useState(false);
  const portrait = driver ? portraitFor(driver.name, season) : null;
  return (
    <article
      className={`portrait-panel portrait-${side.toLowerCase()} ${driver ? "is-selected" : ""}`}
    >
      <div className="portrait-topline">
        <span>DRIVER {side}</span>
        <span>{driver ? `#${driver.number}` : "AWAITING SELECTION"}</span>
      </div>
      <div className="portrait-visual">
        {driver && portrait && !failed ? (
          <img
            src={portrait.url}
            alt={driver.name}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="portrait-monogram" aria-hidden="true">
            {driver ? driver.acronym : side}
          </span>
        )}
        <span className="portrait-number" aria-hidden="true">
          {driver?.number ?? "—"}
        </span>
      </div>
      <div className="portrait-information">
        <div>
          <span className="portrait-team">
            {driver?.team ?? "THE GRID IS OPEN"}
          </span>
          <h3>{driver?.name ?? "Select a driver"}</h3>
        </div>
        <span className="portrait-acronym">{driver?.acronym ?? "---"}</span>
      </div>
      {driver && portrait && !failed && (
        <a
          className="portrait-credit"
          href={portrait.source}
          target="_blank"
          rel="noreferrer"
        >
          ARCHIVE PHOTO {portrait.year}: {portrait.author} · {portrait.license}{" "}
          ↗
        </a>
      )}
    </article>
  );
}

function ResultCard({ data, color }: { data: DriverRace; color: string }) {
  const r = data.result;
  const result =
    r?.status === "FINISHED" && r.position
      ? `P${r.position}`
      : r?.status || "NO RESULT";
  return (
    <article className="result-card" style={{ borderColor: color }}>
      <div className="result-card-kicker">
        <span>RACE CLASSIFICATION</span>
        <span>#{data.driver.number}</span>
      </div>
      <div className="result-card-main">
        <div>
          <span className="result-acronym" style={{ color }}>
            {data.driver.acronym}
          </span>
          <h3>{data.driver.name}</h3>
          <p>{data.driver.team}</p>
        </div>
        <strong className="result-position">{result}</strong>
      </div>
      <div className="result-card-footer">
        <span>{r?.lapsCompleted ?? "—"} LAPS COMPLETED</span>
        <span>
          {data.pitStops.length} PIT{" "}
          {data.pitStops.length === 1 ? "STOP" : "STOPS"}
        </span>
      </div>
    </article>
  );
}

function PositionChart({
  drivers,
  selectedLap,
}: {
  drivers: Comparison["drivers"];
  selectedLap: number;
}) {
  const maxLap = Math.max(
    ...drivers.flatMap((d) => d.laps.map((l) => l.number)),
    1,
  );
  const cursorDriverIndex = drivers.findIndex(
    (driver) => driver.laps.length > 0,
  );
  const options = {
    backgroundColor: "transparent",
    color: comparisonColors,
    tooltip: {
      trigger: "axis",
      backgroundColor: surface,
      borderColor: line,
      textStyle: { color: text },
      formatter: (
        params: {
          axisValue: string;
          seriesName: string;
          value: [number, number | null];
        }[],
      ) =>
        `Lap ${params[0]?.axisValue}<br/>${params.map((p) => `${p.seriesName}: ${p.value[1] == null ? "unavailable" : `P${p.value[1]}`}`).join("<br/>")}`,
    },
    legend: { textStyle: { color: text }, top: 2 },
    grid: { left: 46, right: 18, top: 48, bottom: 45 },
    xAxis: {
      type: "value",
      name: "Lap",
      min: 1,
      max: maxLap,
      nameTextStyle: { color: text },
      ...axis,
    },
    yAxis: {
      type: "value",
      name: "Position",
      inverse: true,
      min: 1,
      minInterval: 1,
      nameTextStyle: { color: text },
      ...axis,
    },
    series: drivers.map((d, index) => ({
      name: d.driver.acronym,
      type: "line",
      step: "end",
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 3 },
      markLine:
        index === cursorDriverIndex
          ? {
              silent: true,
              symbol: "none",
              label: { show: false },
              lineStyle: {
                color: "#f4f3ef",
                type: "solid",
                width: 1.5,
                opacity: 0.75,
              },
              data: [{ xAxis: selectedLap }],
            }
          : undefined,
      data: d.laps.map((l) => [l.number, l.position]),
    })),
  };
  return (
    <ReactECharts
      echarts={echarts}
      option={options}
      style={{ height: 350 }}
      notMerge
    />
  );
}

function PaceChart({
  drivers,
  selectedLap,
}: {
  drivers: Comparison["drivers"];
  selectedLap: number;
}) {
  const maxLap = Math.max(
    ...drivers.flatMap((d) => d.laps.map((l) => l.number)),
    1,
  );
  const cursorDriverIndex = drivers.findIndex(
    (driver) => driver.laps.length > 0,
  );
  const series = drivers.flatMap((d, index) => [
    {
      name: d.driver.acronym,
      type: "line",
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 2.5 },
      data: d.laps.map((l) => [l.number, l.durationSeconds]),
      markLine: {
        silent: true,
        symbol: "none",
        label: { show: false },
        lineStyle: {
          type: "dashed",
          color: comparisonColors[index],
          opacity: 0.5,
        },
        data: [
          ...d.pitStops.map((p) => ({ xAxis: p.lap })),
          ...(index === cursorDriverIndex
            ? [
                {
                  xAxis: selectedLap,
                  lineStyle: {
                    color: "#f4f3ef",
                    type: "solid",
                    width: 1.5,
                    opacity: 0.75,
                  },
                },
              ]
            : []),
        ],
      },
    },
    {
      name: `${d.driver.acronym} pit-out`,
      type: "scatter",
      symbolSize: 10,
      data: d.laps
        .filter((l) => l.pitOut && l.durationSeconds !== null)
        .map((l) => [l.number, l.durationSeconds]),
    },
  ]);
  const options = {
    backgroundColor: "transparent",
    color: [
      comparisonColors[0],
      comparisonColors[0],
      comparisonColors[1],
      comparisonColors[1],
    ],
    tooltip: {
      trigger: "item",
      backgroundColor: surface,
      borderColor: line,
      textStyle: { color: text },
      formatter: (p: { seriesName: string; value: [number, number] }) =>
        `${p.seriesName}<br/>Lap ${p.value[0]} · ${displayTime(p.value[1])}`,
    },
    legend: {
      data: drivers.map((d) => d.driver.acronym),
      textStyle: { color: text },
      top: 2,
    },
    grid: { left: 65, right: 18, top: 48, bottom: 45 },
    xAxis: {
      type: "value",
      name: "Lap",
      min: 1,
      max: maxLap,
      nameTextStyle: { color: text },
      ...axis,
    },
    yAxis: {
      type: "value",
      name: "Seconds",
      scale: true,
      nameTextStyle: { color: text },
      ...axis,
    },
    series,
  };
  return (
    <ReactECharts
      echarts={echarts}
      option={options}
      style={{ height: 350 }}
      notMerge
    />
  );
}

function Stints({ drivers }: { drivers: Comparison["drivers"] }) {
  const maxLap = Math.max(
    ...drivers.flatMap((d) => d.laps.map((l) => l.number)),
    1,
  );
  return (
    <div className="stints">
      {drivers.map((d, index) => (
        <div className="stint-row" key={d.driver.number}>
          <div
            className="stint-name"
            style={{ color: comparisonColors[index] }}
          >
            {d.driver.acronym}
          </div>
          <div className="stint-track">
            {d.stints.length ? (
              d.stints.map((s) => (
                <div
                  key={s.number}
                  className={`stint stint-${s.compound.toLowerCase()}`}
                  style={{
                    left: `${((s.startLap - 1) / maxLap) * 100}%`,
                    width: `${(((s.endLap ?? maxLap) - s.startLap + 1) / maxLap) * 100}%`,
                  }}
                  title={`${s.compound}, laps ${s.startLap}–${s.endLap ?? "?"}, tyre age ${s.tyreAgeAtStart ?? "unknown"}`}
                >
                  <span>
                    {s.compound} · {s.startLap}–{s.endLap ?? "?"}
                  </span>
                </div>
              ))
            ) : (
              <span className="empty-inline">Stint data unavailable</span>
            )}
          </div>
          <div className="stint-detail">
            {d.stints.map((s) => (
              <span key={s.number}>
                {s.compound} {s.startLap}–{s.endLap ?? "?"}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PitTable({ drivers }: { drivers: Comparison["drivers"] }) {
  const rows = drivers
    .flatMap((d, index) =>
      d.pitStops.map((p) => ({
        ...p,
        driver: d.driver,
        color: comparisonColors[index],
      })),
    )
    .sort((a, b) => a.lap - b.lap);
  return rows.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Driver</th>
            <th>Lap</th>
            <th>Pit lane</th>
            <th>Stationary</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={`${p.driver.number}-${p.lap}-${i}`}>
              <td style={{ color: p.color }}>{p.driver.acronym}</td>
              <td>{p.lap}</td>
              <td>
                {p.laneSeconds == null ? "—" : `${p.laneSeconds.toFixed(3)} s`}
              </td>
              <td>
                {p.stationarySeconds == null
                  ? "Unavailable"
                  : `${p.stationarySeconds.toFixed(3)} s`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="empty-inline">
      No pit stop records are available for this comparison.
    </p>
  );
}

function LapTimeline({
  drivers,
  selectedLap,
  maxLap,
  onSelectLap,
}: {
  drivers: Comparison["drivers"];
  selectedLap: number;
  maxLap: number;
  onSelectLap: (lap: number) => void;
}) {
  return (
    <article
      className="panel lap-timeline"
      aria-label="Explore the race lap by lap"
    >
      <div className="panel-heading">
        <span>RACE TIMELINE</span>
        <h3>Read the race, one lap at a time.</h3>
        <p>
          Move through the race to see both drivers at the same lap. Chart
          markers follow your selection; unavailable data stays blank.
        </p>
      </div>
      <div className="timeline-control">
        <button
          type="button"
          onClick={() => onSelectLap(selectedLap - 1)}
          disabled={selectedLap <= 1}
          aria-label="Previous lap"
        >
          ←
        </button>
        <label htmlFor="lap-scrubber">
          LAP <strong>{selectedLap}</strong>
          <span> / {maxLap}</span>
        </label>
        <input
          id="lap-scrubber"
          type="range"
          min="1"
          max={maxLap}
          value={selectedLap}
          onChange={(event) => onSelectLap(Number(event.target.value))}
          aria-label="Selected race lap"
        />
        <button
          type="button"
          onClick={() => onSelectLap(selectedLap + 1)}
          disabled={selectedLap >= maxLap}
          aria-label="Next lap"
        >
          →
        </button>
      </div>
      <div className="timeline-driver-grid">
        {drivers.map((driver, index) => {
          const snapshot = lapSnapshot(driver, selectedLap);
          const { lap, stint, pitStop } = snapshot;
          return (
            <div
              className="timeline-driver"
              key={driver.driver.number}
              style={{ borderColor: comparisonColors[index] }}
            >
              <div className="timeline-driver-heading">
                <strong style={{ color: comparisonColors[index] }}>
                  {driver.driver.acronym}
                </strong>
                <span>{driver.driver.name}</span>
              </div>
              <div className="timeline-stats">
                <div>
                  <span>POSITION</span>
                  <strong>
                    {lap?.position == null ? "—" : `P${lap.position}`}
                  </strong>
                </div>
                <div>
                  <span>LAP TIME</span>
                  <strong>{displayTime(lap?.durationSeconds ?? null)}</strong>
                </div>
                <div>
                  <span>TYRE</span>
                  <strong>{stint?.compound ?? "—"}</strong>
                </div>
              </div>
              <p className="timeline-event">
                {pitStop
                  ? `Pit stop recorded on lap ${selectedLap}${pitStop.laneSeconds == null ? "" : ` · ${pitStop.laneSeconds.toFixed(3)} s in pit lane`}`
                  : lap?.pitOut
                    ? "Pit-out lap"
                    : !lap
                      ? "No lap record available"
                      : "No pit stop recorded on this lap"}
              </p>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function StintPace({ drivers }: { drivers: Comparison["drivers"] }) {
  return (
    <article className="panel stint-pace">
      <div className="panel-heading">
        <span>STINT ANALYSIS</span>
        <h3>Pace by tyre stint</h3>
        <p>
          Median of available timed laps in each stint. Recorded pit-stop and
          pit-out laps are excluded; missing times are omitted. Safety Car laps
          remain included. Compare stints with care: conditions and tyre age can
          differ.
        </p>
      </div>
      <div className="stint-pace-grid">
        {drivers.map((driver, index) => (
          <div className="stint-pace-driver" key={driver.driver.number}>
            <h4 style={{ color: comparisonColors[index] }}>
              {driver.driver.acronym} <span>{driver.driver.name}</span>
            </h4>
            {driver.stints.length ? (
              <div className="stint-pace-list">
                {stintPace(driver).map(
                  ({ stint, medianSeconds, timedLaps, excludedPitLaps }) => (
                    <div className="stint-pace-row" key={stint.number}>
                      <div>
                        <strong>{stint.compound}</strong>
                        <span>
                          LAPS {stint.startLap}–{stint.endLap ?? "?"}
                        </span>
                      </div>
                      <div>
                        <strong>{displayTime(medianSeconds)}</strong>
                        <span>
                          {timedLaps} timed {timedLaps === 1 ? "lap" : "laps"}{" "}
                          used
                          {excludedPitLaps
                            ? ` · ${excludedPitLaps} pit ${excludedPitLaps === 1 ? "lap" : "laps"} excluded`
                            : ""}
                        </span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="empty-inline">Stint data unavailable.</p>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}

function ComparisonView({ data }: { data: Comparison }) {
  const hasLaps = data.drivers.some((d) => d.laps.length);
  const maxLap = Math.max(
    ...data.drivers.flatMap((driver) => driver.laps.map((lap) => lap.number)),
    1,
  );
  const [selectedLap, setSelectedLap] = useState(1);
  const selectLap = (lap: number) =>
    setSelectedLap(Math.min(maxLap, Math.max(1, lap)));
  return (
    <section className="comparison" id="analysis" aria-label="Race comparison">
      <div className="section-heading">
        <div>
          <span className="eyebrow">RACE COMPARISON</span>
          <h2>
            {data.race.name.toUpperCase()} <span>{data.race.year}</span>
          </h2>
          <p>
            {data.race.circuit} · {data.race.country} ·{" "}
            {new Date(data.race.date).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>
      <div className="result-grid">
        {data.drivers.map((d, index) => (
          <ResultCard
            key={d.driver.number}
            data={d}
            color={comparisonColors[index]}
          />
        ))}
      </div>
      {data.notes.length > 0 && (
        <div className="notice" role="status">
          <strong>Data notes</strong>
          <ul>
            {data.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
      {hasLaps && (
        <LapTimeline
          drivers={data.drivers}
          selectedLap={selectedLap}
          maxLap={maxLap}
          onSelectLap={selectLap}
        />
      )}
      <div className="chart-grid">
        <article className="panel">
          <div className="panel-heading">
            <span>01 / POSITION</span>
            <h3>Where they ran</h3>
            <p>
              Last known position at each timed lap end. Gaps mean the position
              could not be reconstructed.
            </p>
          </div>
          {hasLaps ? (
            <PositionChart drivers={data.drivers} selectedLap={selectedLap} />
          ) : (
            <p className="empty-inline">Lap data unavailable.</p>
          )}
        </article>
        <article className="panel">
          <div className="panel-heading">
            <span>02 / PACE</span>
            <h3>Lap by lap</h3>
            <p>
              All available lap times. Dots mark pit-out laps; dashed lines mark
              pit stops.
            </p>
          </div>
          {hasLaps ? (
            <PaceChart drivers={data.drivers} selectedLap={selectedLap} />
          ) : (
            <p className="empty-inline">Lap data unavailable.</p>
          )}
        </article>
      </div>
      <StintPace drivers={data.drivers} />
      <div className="detail-grid">
        <article className="panel">
          <div className="panel-heading">
            <span>03 / TYRES</span>
            <h3>Stint strategy</h3>
            <p>Hover over a stint for lap range and initial tyre age.</p>
          </div>
          <Stints drivers={data.drivers} />
        </article>
        <article className="panel">
          <div className="panel-heading">
            <span>04 / PIT LANE</span>
            <h3>Pit stops</h3>
            <p>
              Pit lane time and stationary time are different measures.
              Stationary time is unavailable for older races.
            </p>
          </div>
          <PitTable drivers={data.drivers} />
        </article>
      </div>
    </section>
  );
}

export default function App() {
  const [season, setSeason] = useState("");
  const [raceKey, setRaceKey] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const seasons = useQuery({ queryKey: ["seasons"], queryFn: pitwall.seasons });
  const races = useQuery({
    queryKey: ["races", season],
    queryFn: () => pitwall.races(Number(season)),
    enabled: !!season,
  });
  const drivers = useQuery({
    queryKey: ["drivers", raceKey],
    queryFn: () => pitwall.drivers(Number(raceKey)),
    enabled:
      !!raceKey &&
      !!races.data?.races.some((race) => race.sessionKey === Number(raceKey)),
  });
  const comparison = useQuery({
    queryKey: ["comparison", raceKey, a, b],
    queryFn: () => pitwall.comparison(Number(raceKey), Number(a), Number(b)),
    enabled:
      !!raceKey &&
      !!a &&
      !!b &&
      a !== b &&
      !!drivers.data?.drivers.some((driver) => String(driver.number) === a) &&
      !!drivers.data?.drivers.some((driver) => String(driver.number) === b),
  });
  useEffect(() => {
    if (!season && seasons.data?.seasons.length)
      setSeason(String(seasons.data.seasons[0]));
  }, [season, seasons.data]);
  const raceOptions =
    races.data?.races.map((r: Race) => ({
      value: String(r.sessionKey),
      label: `${r.name} · ${new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
    })) ?? [];
  const driverOptions =
    drivers.data?.drivers.map((d) => ({
      value: String(d.number),
      label: `${d.acronym} — ${d.name}`,
    })) ?? [];
  const selectedA =
    drivers.data?.drivers.find((d) => String(d.number) === a) ?? null;
  const selectedB =
    drivers.data?.drivers.find((d) => String(d.number) === b) ?? null;
  const error = [
    seasons.error,
    races.error,
    drivers.error,
    comparison.error,
  ].find(Boolean);
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="PitWall home">
          <span className="brand-mark">
            P<span>W</span>
            <i>.</i>
          </span>
          <span className="brand-name">
            PITWALL <small>RACE INTELLIGENCE</small>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#grid">THE GRID</a>
          <a href="#analysis">ANALYSIS</a>
        </nav>
        <a
          className="header-source"
          href="https://openf1.org/"
          target="_blank"
          rel="noreferrer"
        >
          POWERED BY OPENF1 <span>↗</span>
        </a>
      </header>
      <main id="top">
        <section className="hero">
          <div className="hero-scan" aria-hidden="true" />
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="live-dot" /> INDEPENDENT RACE INTELLIGENCE /
              2023—PRESENT
            </span>
            <h1>
              EVERY RACE
              <br />
              <em>HAS A STORY.</em>
            </h1>
            <p>
              Go beyond the chequered flag. Put two drivers side by side and
              uncover the pace, position and pit strategy that shaped their
              race.
            </p>
            <a className="hero-cta" href="#grid">
              BUILD A COMPARISON <span>↘</span>
            </a>
          </div>
          <div className="hero-art" aria-hidden="true">
            <span className="hero-art-caption">ENGINEERED FOR THE DETAIL</span>
            <svg viewBox="0 0 780 380" role="presentation" focusable="false">
              <g className="speed-lines" stroke="currentColor" strokeWidth="2">
                <path d="M0 88h260M15 116h225M0 262h220M48 288h245M80 316h180" />
                <path d="M480 88h300M545 116h235M580 262h200M520 288h260M600 316h180" />
              </g>
              <g
                className="car-drawing"
                fill="none"
                stroke="currentColor"
                strokeLinejoin="round"
              >
                <path
                  strokeWidth="6"
                  d="M350 28h80l16 56 30 27 61 29v94l-61 29-30 29-16 58h-80l-16-58-30-29-61-29v-94l61-29 30-27z"
                />
                <path
                  strokeWidth="5"
                  d="M326 110h128l24 31v98l-24 31H326l-24-31v-98z"
                />
                <path
                  strokeWidth="4"
                  d="M357 96l-14 54v80l14 53h66l14-53v-80l-14-54zM360 171h60v38h-60zM325 52h130M315 326h150"
                />
                <path
                  strokeWidth="3"
                  d="M390 28v54M390 292v58M302 164h-56M302 215h-56M478 164h56M478 215h56"
                />
                <rect
                  x="215"
                  y="120"
                  width="38"
                  height="74"
                  rx="7"
                  fill="currentColor"
                  stroke="none"
                />
                <rect
                  x="215"
                  y="200"
                  width="38"
                  height="74"
                  rx="7"
                  fill="currentColor"
                  stroke="none"
                />
                <rect
                  x="527"
                  y="120"
                  width="38"
                  height="74"
                  rx="7"
                  fill="currentColor"
                  stroke="none"
                />
                <rect
                  x="527"
                  y="200"
                  width="38"
                  height="74"
                  rx="7"
                  fill="currentColor"
                  stroke="none"
                />
              </g>
            </svg>
            <span className="hero-art-index">PW / 001</span>
          </div>
          <span className="hero-watermark" aria-hidden="true">
            RACE DATA
          </span>
        </section>
        <div className="race-ticker" aria-label="What PitWall compares">
          <span>
            01 <b>SELECT THE EVENT</b>
          </span>
          <i />
          <span>
            02 <b>SET THE DUEL</b>
          </span>
          <i />
          <span>
            03 <b>READ THE RACE</b>
          </span>
          <strong>POSITION · PACE · STRATEGY</strong>
        </div>
        <section
          className="selector-panel"
          id="grid"
          aria-label="Choose race and drivers"
        >
          <div className="selector-title">
            <span className="eyebrow">BUILD YOUR COMPARISON</span>
            <h2>
              SET THE <em>GRID.</em>
            </h2>
            <p>Choose a completed Grand Prix, then line up two drivers.</p>
          </div>
          <div className="selector-grid">
            <Select
              label="Season"
              value={season}
              onChange={(v) => {
                setSeason(v);
                setRaceKey("");
                setA("");
                setB("");
              }}
              options={
                seasons.data?.seasons.map((y) => ({
                  value: String(y),
                  label: String(y),
                })) ?? []
              }
              disabled={seasons.isLoading}
            />
            <Select
              label="Grand Prix"
              value={raceKey}
              onChange={(v) => {
                setRaceKey(v);
                setA("");
                setB("");
              }}
              options={raceOptions}
              disabled={!season || races.isLoading}
            />
            <Select
              label="Driver A"
              value={a}
              onChange={setA}
              options={driverOptions.filter((d) => d.value !== b)}
              disabled={!raceKey || drivers.isLoading}
            />
            <Select
              label="Driver B"
              value={b}
              onChange={setB}
              options={driverOptions.filter((d) => d.value !== a)}
              disabled={!raceKey || drivers.isLoading}
            />
          </div>
          <button
            className="featured-race"
            type="button"
            onClick={() => {
              setSeason("2024");
              setRaceKey("9472");
              setA("16");
              setB("55");
            }}
          >
            <span>START WITH A RACE</span>
            <strong>BAHRAIN 2024 · LECLERC VS SAINZ</strong>
            <span aria-hidden="true">↗</span>
          </button>
          <div className="portrait-grid" aria-label="Selected drivers">
            <PortraitPanel
              key={selectedA?.name ?? "empty-a"}
              driver={selectedA}
              side="A"
              season={Number(season)}
            />
            <div className="versus" aria-hidden="true">
              VS
            </div>
            <PortraitPanel
              key={selectedB?.name ?? "empty-b"}
              driver={selectedB}
              side="B"
              season={Number(season)}
            />
          </div>
          {races.data && !raceOptions.length && (
            <p className="selector-note">
              No completed races are available for this season yet.
            </p>
          )}
          {error && (
            <div className="error" role="alert">
              {error instanceof Error
                ? error.message
                : "Unable to load race data."}{" "}
              <button
                onClick={() => {
                  if (seasons.error) void seasons.refetch();
                  else if (races.error) void races.refetch();
                  else if (drivers.error) void drivers.refetch();
                  else if (comparison.error) void comparison.refetch();
                }}
              >
                Try again
              </button>
            </div>
          )}
        </section>
        {comparison.isLoading && (
          <div className="loading" role="status">
            Analysing the race data…
          </div>
        )}
        {comparison.data && (
          <ComparisonView
            key={`${comparison.data.race.sessionKey}-${comparison.data.drivers.map((driver) => driver.driver.number).join("-")}`}
            data={comparison.data}
          />
        )}
        {!comparison.data && !comparison.isLoading && (
          <div className="placeholder">
            <span>01 — SELECT A RACE</span>
            <p>Your race comparison will appear here.</p>
          </div>
        )}
      </main>
      <footer>
        <span>© {new Date().getFullYear()} PITWALL</span>
        <span>
          Independent fan project ·{" "}
          <a
            href="https://github.com/Ago-filo/Pitwall/blob/main/docs/photo-credits.md"
            target="_blank"
            rel="noreferrer"
          >
            Photo credits
          </a>{" "}
          · Historical data from{" "}
          <a href="https://openf1.org/" target="_blank" rel="noreferrer">
            OpenF1
          </a>
        </span>
      </footer>
    </div>
  );
}
