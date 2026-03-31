"use client";
import { usePostureHistory } from "@/hooks/usePostureHistory";
import { usePosture } from "@/context/PostureContext";
import { formatDate } from "@/lib/utils";
import { TrendingUp, TrendingDown, Clock, AlertTriangle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
} from "recharts";

// ── Helpers ───────────────────────────────────────────────────────
function formatMins(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.round(mins)}m`;
}

// Convert raw frame count → minutes (each frame = 0.5s)
function framesToMins(frames: number): number {
  return Math.round(((frames * 0.5) / 60) * 10) / 10;
}

export default function AnalyticsPage() {
  const { report, loading, error } = usePostureHistory();
  const { liveData } = usePosture();

  const days = report.days ?? [];

  const chartData = days.map((d) => ({
    date: formatDate(d.date),
    score: d.avg_score,
    badMins: d.bad_duration_mins,
    // Convert frame counts → minutes for meaningful display
    neck: framesToMins(d.neck_issues),
    spine: framesToMins(d.spine_issues),
    lean: framesToMins(d.leaning_issues),
    tilt: framesToMins(d.tilt_issues),
  }));

  const summary = report.summary;

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <span className="w-8 h-8 border-2 border-gray-200 border-t-green-500 rounded-full animate-spin" />
      </div>
    );

  if (error)
    return (
      <div className="flex items-center justify-center h-64 text-red-400 text-sm">
        Failed to load analytics: {error}
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Analytics</h1>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "7-Day Avg Score",
              value: `${summary.avg_score}`,
              icon: summary.trend === "improving" ? TrendingUp : TrendingDown,
              color:
                summary.trend === "improving"
                  ? "text-green-500"
                  : "text-red-500",
              bg: summary.trend === "improving" ? "bg-green-50" : "bg-red-50",
            },
            {
              label: "Total Bad Posture",
              value: formatMins(summary.total_bad_mins),
              icon: Clock,
              color: "text-orange-500",
              bg: "bg-orange-50",
            },
            {
              label: "Best Day",
              value: formatDate(summary.best_day),
              icon: TrendingUp,
              color: "text-green-500",
              bg: "bg-green-50",
            },
            {
              label: "Worst Day",
              value: formatDate(summary.worst_day),
              icon: AlertTriangle,
              color: "text-red-500",
              bg: "bg-red-50",
            },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`${bg} rounded-2xl p-5`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">{label}</p>
                <Icon size={16} className={color} />
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* No data state */}
      {days.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm flex flex-col items-center py-20 gap-3">
          <TrendingUp size={40} className="text-gray-200" />
          <p className="text-gray-400 text-sm">No data yet</p>
          <p className="text-gray-300 text-xs">
            Start a camera session to begin tracking
          </p>
        </div>
      )}

      {days.length > 0 && (
        <>
          {/* Score trend chart */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Posture Score — Last 7 Days
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                  }}
                  labelStyle={{ fontWeight: 600, color: "#374151" }}
                />
                <ReferenceLine
                  y={65}
                  stroke="#f97316"
                  strokeDasharray="4 4"
                  label={{
                    value: "65 threshold",
                    fill: "#f97316",
                    fontSize: 10,
                  }}
                />
                <ReferenceLine
                  y={80}
                  stroke="#22c55e"
                  strokeDasharray="4 4"
                  label={{ value: "80 optimal", fill: "#22c55e", fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ fill: "#6366f1", r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Avg Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bad posture duration chart */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Bad Posture Duration (mins)
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                  }}
                  formatter={(val: number) => [
                    `${formatMins(val)}`,
                    "Bad Posture",
                  ]}
                />
                <Bar
                  dataKey="badMins"
                  fill="#f97316"
                  radius={[6, 6, 0, 0]}
                  name="Bad Posture"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Issues breakdown — shown in minutes now */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-1">
              Issue Breakdown — Last 7 Days
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Time spent with each issue (minutes)
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} unit="m" />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                  }}
                  formatter={(val: number) => [`${val}m`]}
                />
                <Bar
                  dataKey="neck"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                  name="Neck"
                />
                <Bar
                  dataKey="spine"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                  name="Spine"
                />
                <Bar
                  dataKey="lean"
                  fill="#f97316"
                  radius={[4, 4, 0, 0]}
                  name="Lean"
                />
                <Bar
                  dataKey="tilt"
                  fill="#eab308"
                  radius={[4, 4, 0, 0]}
                  name="Tilt"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Daily table */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Daily Summary
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="text-left py-2 font-medium">Date</th>
                    <th className="text-right py-2 font-medium">Avg Score</th>
                    <th className="text-right py-2 font-medium">Bad Time</th>
                    <th className="text-right py-2 font-medium">Neck</th>
                    <th className="text-right py-2 font-medium">Spine</th>
                    <th className="text-right py-2 font-medium">Lean</th>
                    <th className="text-right py-2 font-medium">Tilt</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => (
                    <tr
                      key={d.date}
                      className="border-b border-gray-50 hover:bg-gray-50 transition"
                    >
                      <td className="py-2.5 text-gray-600">
                        {formatDate(d.date)}
                      </td>
                      <td
                        className="py-2.5 text-right font-semibold"
                        style={{
                          color:
                            d.avg_score >= 80
                              ? "#22c55e"
                              : d.avg_score >= 65
                                ? "#f97316"
                                : "#ef4444",
                        }}
                      >
                        {d.avg_score}
                      </td>
                      {/* ✅ Show formatted time instead of raw mins */}
                      <td className="py-2.5 text-right text-orange-500">
                        {formatMins(d.bad_duration_mins)}
                      </td>
                      {/* ✅ Show minutes instead of raw frame counts */}
                      <td className="py-2.5 text-right text-indigo-400">
                        {framesToMins(d.neck_issues)}m
                      </td>
                      <td className="py-2.5 text-right text-red-400">
                        {framesToMins(d.spine_issues)}m
                      </td>
                      <td className="py-2.5 text-right text-orange-400">
                        {framesToMins(d.leaning_issues)}m
                      </td>
                      <td className="py-2.5 text-right text-yellow-500">
                        {framesToMins(d.tilt_issues)}m
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
