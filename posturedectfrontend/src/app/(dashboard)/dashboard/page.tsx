"use client";
import { useEffect, useState } from "react";
import { usePosture } from "@/context/PostureContext";
import { getScoreHex, getScoreLabel } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface TodayLog {
  posture_score: number;
  created_at: string;
  neck_bad?: boolean;
  spine_bad?: boolean;
  leaning?: boolean;
  head_tilt?: boolean;
}

export default function DashboardPage() {
  const { liveData: data, connected, running } = usePosture();
  const [todayLogs, setTodayLogs] = useState<TodayLog[]>([]);

  // ── Fetch today's logs every 15s for timeline + donut ────────
  useEffect(() => {
    const fetchLogs = () =>
      api
        .today()
        .then((res: any) => setTodayLogs(res.logs ?? []))
        .catch(() => {});

    fetchLogs();
    const interval = setInterval(fetchLogs, 15000);
    return () => clearInterval(interval);
  }, []);

  // Build timeline chart data
  const timelineData = todayLogs.slice(-60).map((l) => ({
    time: new Date(l.created_at).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    score: l.posture_score,
  }));

  // Donut chart data
  const badCount = todayLogs.filter((l) => l.posture_score < 65).length;
  const goodCount = todayLogs.length - badCount;
  const donutData =
    todayLogs.length > 0
      ? [
          { name: "Needs Adjustment", value: badCount, color: "#ef4444" },
          { name: "Optimal Posture", value: goodCount, color: "#22c55e" },
        ]
      : [{ name: "Optimal Posture", value: 1, color: "#22c55e" }];

  // Insight message based on live score
  const insight =
    data.posture_score >= 80
      ? {
          title: "Great work maintaining posture!",
          sub: "Remember to take a quick stretch break every hour.",
        }
      : data.posture_score >= 65
        ? {
            title: "Posture needs attention.",
            sub: "Try sitting back and relaxing your shoulders.",
          }
        : {
            title: "Poor posture detected!",
            sub: "Sit straight, relax shoulders, keep screen at eye level.",
          };

  // Metric cards
  const metrics = [
    {
      label: "Neck Alignment",
      bad: data.neck_bad,
      good: "Good",
      warn: "Forward",
      emoji: "🧍",
      goodColor: "text-green-500",
    },
    {
      label: "Spine Straightness",
      bad: data.spine_bad,
      good: "Aligned",
      warn: "Misaligned",
      emoji: "🔩",
      goodColor: "text-green-500",
    },
    {
      label: "Shoulder Balance",
      bad: data.leaning,
      good: "Level",
      warn: `Leaning ${data.leaning_direction ?? ""}`,
      emoji: "🏋️",
      goodColor: "text-green-500",
    },
    {
      label: "Head Tilt",
      bad: data.head_tilt,
      good: "Centered",
      warn: "Tilted",
      emoji: "😊",
      goodColor: "text-green-500",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Row 1 — Score gauge + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Score Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center justify-center">
          <p className="text-lg font-semibold text-gray-800 self-start mb-4">
            Posture Score
          </p>

          {/* Circular gauge */}
          <div className="relative w-44 h-44 my-2">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
              <circle
                cx="80"
                cy="80"
                r="64"
                fill="none"
                stroke="#f3f4f6"
                strokeWidth="12"
              />
              <circle
                cx="80"
                cy="80"
                r="64"
                fill="none"
                stroke={getScoreHex(data.posture_score)}
                strokeWidth="12"
                strokeDasharray={`${(data.posture_score / 100) * 2 * Math.PI * 64} ${2 * Math.PI * 64}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 0.6s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-5xl font-bold"
                style={{ color: getScoreHex(data.posture_score) }}
              >
                {data.posture_score}
              </span>
              <span className="text-sm text-gray-400">/100</span>
              <span
                className="text-xs font-medium mt-1"
                style={{ color: getScoreHex(data.posture_score) }}
              >
                {getScoreLabel(data.posture_score)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 mt-3">
            <span
              className={`w-2 h-2 rounded-full ${
                running ? "bg-green-500 animate-pulse" : "bg-gray-300"
              }`}
            />
            <span className="text-xs text-gray-400">
              {running
                ? "Currently monitoring in the background"
                : "Start camera to monitor"}
            </span>
          </div>
        </div>

        {/* Daily Timeline */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-lg font-semibold text-gray-800">
              Daily Posture Timeline
            </p>
            <span
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                connected
                  ? "bg-green-50 text-green-600"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connected ? "bg-green-500 animate-pulse" : "bg-gray-400"
                }`}
              />
              {connected ? "Live" : "Offline"}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={
                timelineData.length > 1
                  ? timelineData
                  : [{ time: "", score: data.posture_score }]
              }
            >
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                  fontSize: 12,
                }}
              />
              <ReferenceLine
                y={65}
                stroke="#f97316"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
              />
              <ReferenceLine
                y={80}
                stroke="#22c55e"
                strokeDasharray="4 4"
                strokeOpacity={0.4}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: "#6366f1" }}
                fill="url(#scoreGrad)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2 — 4 metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(({ label, bad, good, warn, emoji, goodColor }) => (
          <div key={label} className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{emoji}</span>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
            <p
              className={`text-base font-bold ${bad ? "text-red-500" : goodColor}`}
            >
              {bad ? warn : good}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {bad ? "Issue detected" : "No issues detected"}
            </p>
          </div>
        ))}
      </div>

      {/* Row 3 — Activity Breakdown + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Activity Donut */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm p-6">
          <p className="text-lg font-semibold text-gray-800">
            Activity Breakdown
          </p>
          <p className="text-xs text-gray-400 mb-4">Summary for today</p>
          <div className="flex items-center justify-center gap-10">
            <PieChart width={160} height={160}>
              <Pie
                data={donutData}
                cx={75}
                cy={75}
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
              >
                {donutData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
            <div className="space-y-3">
              {donutData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-gray-600">{entry.name}</span>
                </div>
              ))}
              {todayLogs.length > 0 && (
                <p className="text-xs text-gray-400 pt-1">
                  {todayLogs.length} samples today
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">💡</span>
            <p className="text-lg font-semibold text-gray-800">Insights</p>
          </div>
          <p className="text-sm font-medium text-gray-700">{insight.title}</p>
          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
            {insight.sub}
          </p>

          {/* Quick stats */}
          {todayLogs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
              <div>
                <p className="text-lg font-bold text-green-500">{goodCount}</p>
                <p className="text-xs text-gray-400">Good samples</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-400">{badCount}</p>
                <p className="text-xs text-gray-400">Bad samples</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
