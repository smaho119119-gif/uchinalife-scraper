"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  histogram: { range: string; count: number }[];
  category: string;
}

export default function PriceDistributionChart({ histogram, category }: Props) {
  if (!histogram || histogram.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        価格分布データがありません
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">
        {category} 価格分布
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={histogram}
          margin={{ top: 8, right: 16, left: 0, bottom: 48 }}
        >
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#334155"
            vertical={false}
          />
          <XAxis
            dataKey="range"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            angle={-35}
            textAnchor="end"
            height={60}
            interval={0}
            axisLine={{ stroke: "#475569" }}
            tickLine={{ stroke: "#475569" }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#94a3b8" }}
            axisLine={{ stroke: "#475569" }}
            tickLine={{ stroke: "#475569" }}
            allowDecimals={false}
            label={{
              value: "件数",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 12, fill: "#94a3b8" },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(15, 23, 42, 0.95)",
              border: "1px solid #334155",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
              color: "#e2e8f0",
            }}
            labelStyle={{ color: "#94a3b8", fontWeight: 600 }}
            formatter={(value: number) => [`${value} 件`, "物件数"]}
            cursor={{ fill: "rgba(52, 211, 153, 0.1)" }}
          />
          <Bar
            dataKey="count"
            fill="url(#barGradient)"
            radius={[6, 6, 0, 0]}
            maxBarSize={60}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
