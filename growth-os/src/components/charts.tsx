"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Validated categorical slots (colorblind-safe adjacent pairs). Fixed order — never cycled.
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a"];
const AXIS = { stroke: "#8a8f8a", fontSize: 12, tickLine: false, axisLine: false } as const;
const GRID = <CartesianGrid stroke="#ece8df" vertical={false} />;
const tooltipStyle = { borderRadius: 10, border: "1px solid #e5e1d8", fontSize: 12.5, color: "#1f2421", boxShadow: "0 4px 16px rgb(31 36 33 / .08)" };
const monthLabel = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

export function GrowthChart({ data }: { data: { month: string; total: number; added: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        {GRID}
        <XAxis dataKey="month" tickFormatter={monthLabel} {...AXIS} />
        <YAxis allowDecimals={false} {...AXIS} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => monthLabel(String(l))} formatter={(v, n) => [v as number, n === "total" ? "Total contacts" : "Added"]} cursor={{ stroke: "#d3cdc0" }} />
        <Line isAnimationActive={false} type="monotone" dataKey="total" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function EngagementChart({ data }: { data: { label: string; reached: number; replies: number; positive: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }} barGap={2} barCategoryGap="28%">
        {GRID}
        <XAxis dataKey="label" {...AXIS} />
        <YAxis allowDecimals={false} {...AXIS} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1efe9" }} />
        <Legend itemSorter={null} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12.5, color: "#5d635f" }} />
        <Bar dataKey="reached" name="Contacts reached" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Bar dataKey="replies" name="Replies" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Bar dataKey="positive" name="Positive replies" fill={SERIES[2]} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function VolumeChart({ data }: { data: { month: string; NEWSLETTER: number; SEASONAL: number; MILESTONE: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }} barCategoryGap="30%">
        {GRID}
        <XAxis dataKey="month" tickFormatter={monthLabel} {...AXIS} />
        <YAxis allowDecimals={false} {...AXIS} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => monthLabel(String(l))} cursor={{ fill: "#f1efe9" }} />
        <Legend itemSorter={null} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12.5, color: "#5d635f" }} />
        <Bar dataKey="NEWSLETTER" name="Newsletters" stackId="v" fill={SERIES[0]} stroke="#fff" strokeWidth={2} maxBarSize={40} />
        <Bar dataKey="SEASONAL" name="Seasonal" stackId="v" fill={SERIES[1]} stroke="#fff" strokeWidth={2} maxBarSize={40} />
        <Bar dataKey="MILESTONE" name="Milestones" stackId="v" fill={SERIES[2]} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
