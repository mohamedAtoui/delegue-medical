"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { ChartSpec } from "@/lib/insights/agent";

// Brand-led palette (greens + orange) reused across series.
const PALETTE = [
  "oklch(0.52 0.15 145)", // green (brand)
  "oklch(0.70 0.16 55)", // orange (brand)
  "oklch(0.55 0.13 230)", // blue
  "oklch(0.60 0.16 20)", // red
  "oklch(0.60 0.14 300)", // purple
  "oklch(0.65 0.13 170)", // teal
];

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  fontSize: "12px",
  color: "var(--popover-foreground)",
};

/** Renders an AI-produced chart spec inline in the chat using recharts. */
export function ChatChart({ spec }: { spec: ChartSpec }) {
  const { type, title, data, xKey, series } = spec;

  if (!Array.isArray(data) || data.length === 0 || series.length === 0) {
    return null;
  }

  // Categorical bar charts with many or long labels read far better as
  // horizontal bars (matches the dashboard's "Visites par délégué" chart).
  const maxLabelLen = Math.max(
    ...data.map((d) => String(d[xKey] ?? "").length),
    0
  );
  const horizontal = type === "bar" && (data.length > 5 || maxLabelLen > 10);
  const height = horizontal ? Math.max(220, data.length * 36 + 40) : 280;

  return (
    <div className="my-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-foreground">{title}</p>
      <ResponsiveContainer width="100%" height={height}>
        {type === "bar" && horizontal ? (
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey={xKey}
              width={Math.min(160, Math.max(90, maxLabelLen * 7))}
              tick={{ fontSize: 11 }}
            />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={PALETTE[i % PALETTE.length]}
                radius={[0, 4, 4, 0]}
              />
            ))}
          </BarChart>
        ) : type === "bar" ? (
          <BarChart data={data} margin={{ top: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={PALETTE[i % PALETTE.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        ) : type === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        ) : type === "area" ? (
          <AreaChart data={data} margin={{ top: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map((s, i) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={PALETTE[i % PALETTE.length]}
                fill={PALETTE[i % PALETTE.length]}
                fillOpacity={0.2}
              />
            ))}
          </AreaChart>
        ) : (
          <PieChart>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Pie
              data={data}
              dataKey={series[0].key}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={{ fontSize: 11 }}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
