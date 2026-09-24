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
import type { Comparison, RaceEvent } from "./domain";

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
    : String(Math.floor(seconds / 60)) +
      ":" +
      (seconds % 60).toFixed(3).padStart(6, "0");

function majorEventLaps(events: RaceEvent[]): number[] {
  return [
    ...new Set(
      events
        .filter(
          (event) => event.category === "SafetyCar" || event.flag === "RED",
        )
        .map((event) => event.lap)
        .filter((lap): lap is number => lap !== null),
    ),
  ];
}

function ChartDataTable({
  drivers,
  metric,
}: {
  drivers: Comparison["drivers"];
  metric: "position" | "pace";
}) {
  const maxLap = Math.max(
    ...drivers.flatMap((driver) => driver.laps.map((lap) => lap.number)),
    0,
  );
  const records = drivers.map(
    (driver) => new Map(driver.laps.map((lap) => [lap.number, lap])),
  );
  return (
    <details className="chart-data">
      <summary>
        View {metric === "position" ? "position" : "lap time"} data as a table
      </summary>
      <div className="table-wrap">
        <table>
          <caption>
            {metric === "position"
              ? "Recorded position by lap"
              : "Recorded lap time by lap"}
          </caption>
          <thead>
            <tr>
              <th scope="col">Lap</th>
              {drivers.map((driver) => (
                <th scope="col" key={driver.driver.number}>
                  {driver.driver.acronym}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxLap }, (_, index) => index + 1).map(
              (lap) => (
                <tr key={lap}>
                  <th scope="row">{lap}</th>
                  {records.map((record, index) => {
                    const value = record.get(lap);
                    return (
                      <td key={drivers[index].driver.number}>
                        {metric === "position"
                          ? value?.position == null
                            ? "Unavailable"
                            : "P" + value.position
                          : displayTime(value?.durationSeconds ?? null)}
                      </td>
                    );
                  })}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function PositionChart({
  drivers,
  selectedLap,
  events,
}: {
  drivers: Comparison["drivers"];
  selectedLap: number;
  events: RaceEvent[];
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
              data: [
                { xAxis: selectedLap },
                ...majorEventLaps(events).map((lap) => ({
                  xAxis: lap,
                  lineStyle: {
                    color: "#f4d95a",
                    type: "dashed",
                    opacity: 0.65,
                  },
                })),
              ],
            }
          : undefined,
      data: d.laps.map((l) => [l.number, l.position]),
    })),
  };
  return (
    <>
      <div aria-hidden="true">
        <ReactECharts
          echarts={echarts}
          option={options}
          style={{ height: 350 }}
          notMerge
        />
      </div>
      <ChartDataTable drivers={drivers} metric="position" />
    </>
  );
}

export function PaceChart({
  drivers,
  selectedLap,
  events,
}: {
  drivers: Comparison["drivers"];
  selectedLap: number;
  events: RaceEvent[];
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
                ...majorEventLaps(events).map((lap) => ({
                  xAxis: lap,
                  lineStyle: {
                    color: "#f4d95a",
                    type: "dashed",
                    opacity: 0.65,
                  },
                })),
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
    <>
      <div aria-hidden="true">
        <ReactECharts
          echarts={echarts}
          option={options}
          style={{ height: 350 }}
          notMerge
        />
      </div>
      <ChartDataTable drivers={drivers} metric="pace" />
    </>
  );
}
