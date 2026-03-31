"use client";
import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
} from "recharts";
import { PostureData } from "@/types/posture";

interface DataPoint {
  time: string;
  score: number;
}

// Accepts data as prop — no separate WS hook inside
export default function PostureTimeline({ data }: { data: PostureData }) {
  const [history, setHistory] = useState<DataPoint[]>([]);

  useEffect(() => {
    const time = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setHistory((prev) => [
      ...prev.slice(-40),
      { time, score: data.posture_score },
    ]);
  }, [data.timestamp]); // trigger on timestamp change, not score

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart
        data={history}
        margin={{ top: 5, right: 5, bottom: 0, left: -20 }}
      >
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.5} />
            <stop offset="95%" stopColor="#818cf8" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="time"
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          ticks={[0, 35, 65, 100]}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "10px",
            border: "none",
            fontSize: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
          formatter={(val: number) => [`${val}`, "Score"]}
        />
        <ReferenceLine
          y={65}
          stroke="#f87171"
          strokeDasharray="4 4"
          strokeOpacity={0.6}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke="#818cf8"
          strokeWidth={2}
          fill="url(#scoreGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "#818cf8" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
