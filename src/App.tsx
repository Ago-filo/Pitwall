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
import type { Comparison, DriverRace, Race } from "./domain";
import { pitwall } from "./api";

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

function ResultCard({ data, color }: { data: DriverRace; color: string }) {
  const r = data.result;
  return (
    <article className="result-card" style={{ borderTopColor: color }}>
      <div className="driver-line">
        <span className="driver-number">{data.driver.number}</span>
        <div>
          <h3>{data.driver.name}</h3>
          <p>{data.driver.team}</p>
        </div>
      </div>
      <div className="result-meta">
        <strong>
          {r?.status === "FINISHED" && r.position
            ? `P${r.position}`
            : r?.status || "NO RESULT"}
        </strong>
        <span>{r?.lapsCompleted ?? "—"} laps completed</span>
      </div>
    </article>
  );
}

function PositionChart({ drivers }: { drivers: Comparison["drivers"] }) {
  const maxLap = Math.max(
    ...drivers.flatMap((d) => d.laps.map((l) => l.number)),
    1,
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
    series: drivers.map((d) => ({
      name: d.driver.acronym,
      type: "line",
      step: "end",
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 3 },
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

function PaceChart({ drivers }: { drivers: Comparison["drivers"] }) {
  const maxLap = Math.max(
    ...drivers.flatMap((d) => d.laps.map((l) => l.number)),
    1,
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
        data: d.pitStops.map((p) => ({ xAxis: p.lap })),
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

function ComparisonView({ data }: { data: Comparison }) {
  const hasLaps = data.drivers.some((d) => d.laps.length);
  return (
    <section className="comparison" aria-label="Race comparison">
      <div className="section-heading">
        <div>
          <span className="eyebrow">RACE COMPARISON</span>
          <h2>
            {data.race.name} <span>{data.race.year}</span>
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
            <PositionChart drivers={data.drivers} />
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
            <PaceChart drivers={data.drivers} />
          ) : (
            <p className="empty-inline">Lap data unavailable.</p>
          )}
        </article>
      </div>
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
    enabled: !!raceKey,
  });
  const comparison = useQuery({
    queryKey: ["comparison", raceKey, a, b],
    queryFn: () => pitwall.comparison(Number(raceKey), Number(a), Number(b)),
    enabled: !!raceKey && !!a && !!b && a !== b,
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
  const error = [
    seasons.error,
    races.error,
    drivers.error,
    comparison.error,
  ].find(Boolean);
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark">
            PW<span>.</span>
          </span>
          <span>PITWALL</span>
        </div>
        <a href="https://openf1.org/" target="_blank" rel="noreferrer">
          DATA BY OPENF1 ↗
        </a>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="live-dot" /> THE RACE, EXPLAINED
            </span>
            <h1>
              Every race
              <br />
              <em>has a story.</em>
            </h1>
            <p>
              Compare two drivers through position, pace and strategy. See how
              the race unfolded, lap by lap.
            </p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-ring ring-one" />
            <div className="hero-ring ring-two" />
            <div className="hero-ring ring-three" />
            <span>
              RACE
              <br />
              INTELLIGENCE
            </span>
          </div>
        </section>
        <section
          className="selector-panel"
          aria-label="Choose race and drivers"
        >
          <div className="selector-title">
            <span className="eyebrow">BUILD YOUR COMPARISON</span>
            <h2>Choose the grid.</h2>
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
                  void seasons.refetch();
                  void races.refetch();
                  void drivers.refetch();
                  void comparison.refetch();
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
        {comparison.data && <ComparisonView data={comparison.data} />}
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
          Independent fan project · Historical data from{" "}
          <a href="https://openf1.org/" target="_blank" rel="noreferrer">
            OpenF1
          </a>
        </span>
      </footer>
    </div>
  );
}
