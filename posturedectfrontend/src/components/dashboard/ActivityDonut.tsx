"use client";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export default function ActivityDonut({ score }: { score: number }) {
  const good = Math.max(0, Math.min(100, score));
  const bad = Math.max(0, 100 - good);

  const data = [
    { name: "Optimal Posture", value: good },
    { name: "Needs Adjustment", value: bad },
  ];

  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie
          data={data}
          cx="40%"
          cy="50%"
          innerRadius={45}
          outerRadius={70}
          dataKey="value"
          startAngle={90}
          endAngle={-270}
          paddingAngle={2}
        >
          <Cell fill="#22c55e" />
          <Cell fill="#f87171" />
        </Pie>
        <Tooltip
          formatter={(val: number) => [`${val}%`]}
          contentStyle={{
            borderRadius: "10px",
            border: "none",
            fontSize: "12px",
          }}
        />
        <Legend
          iconType="circle"
          iconSize={10}
          layout="vertical"
          align="right"
          verticalAlign="middle"
          formatter={(v) => (
            <span style={{ fontSize: 12, color: "#6b7280" }}>{v}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
