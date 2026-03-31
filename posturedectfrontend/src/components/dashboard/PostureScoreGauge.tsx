"use client";
import { getScoreHex, getScoreLabel } from "@/lib/utils";

export default function PostureScoreGauge({
  score,
  connected,
}: {
  score: number;
  connected: boolean;
}) {
  const color = getScoreHex(score);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const arcLength = circ * 0.75;
  const filled = (score / 100) * arcLength;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-48 h-48">
        <svg
          className="w-full h-full"
          viewBox="0 0 120 120"
          style={{ transform: "rotate(-225deg)" }}
        >
          {/* Background arc */}
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="10"
            strokeDasharray={`${arcLength} ${circ}`}
            strokeLinecap="round"
          />
          {/* Score arc */}
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${filled} ${circ}`}
            strokeLinecap="round"
            style={{
              transition: "stroke-dasharray 0.6s ease, stroke 0.3s ease",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold" style={{ color }}>
            {score}
          </span>
          <span className="text-sm text-gray-400">/100</span>
          <span className="text-xs text-gray-500 mt-1 text-center px-6">
            {getScoreLabel(score)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            connected ? "bg-green-500 animate-pulse" : "bg-red-400"
          }`}
        />
        <span className="text-xs text-gray-500">
          {connected
            ? "Currently monitoring in the background"
            : "Detector not connected"}
        </span>
      </div>
    </div>
  );
}
