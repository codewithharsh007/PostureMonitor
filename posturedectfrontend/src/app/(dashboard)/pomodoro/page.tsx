"use client";
import { usePomodoro } from "@/hooks/usePomodoro";
import { usePosture } from "@/context/PostureContext";
import { Play, Pause, RotateCcw, Brain, Coffee } from "lucide-react";
import { POMODORO_DEFAULTS } from "@/lib/constants";
import { getScoreColor } from "@/lib/utils";

export default function PomodoroPage() {
  // ✅ usePosture from context — no more usePostureSocket
  const { liveData } = usePosture();
  const {
    phase,
    running,
    minutes,
    seconds,
    cycles,
    progress,
    start,
    pause,
    reset,
  } = usePomodoro(liveData.posture_score);

  const circumference = 2 * Math.PI * 80;
  const filled = (progress / 100) * circumference;

  const ringColor = phase === "break" ? "#22c55e" : "#818cf8";
  const breakMins =
    liveData.posture_score < 65
      ? POMODORO_DEFAULTS.EXTENDED_BREAK_MINUTES
      : POMODORO_DEFAULTS.BREAK_MINUTES;

  const phaseConfig = {
    idle: {
      label: "Ready to Start",
      bg: "bg-gray-100 text-gray-500",
      icon: Brain,
      sub: "Press start",
    },
    studying: {
      label: "Study Session",
      bg: "bg-blue-100 text-blue-600",
      icon: Brain,
      sub: "Stay focused",
    },
    break: {
      label: "Break Time",
      bg: "bg-green-100 text-green-600",
      icon: Coffee,
      sub: "Rest up",
    },
  }[phase];

  const PhaseIcon = phaseConfig.icon;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Pomodoro Timer</h1>

      {/* Main Timer Card */}
      <div className="bg-white rounded-2xl shadow-sm p-10 flex flex-col items-center">
        {/* Phase badge */}
        <span
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full mb-8 ${phaseConfig.bg}`}
        >
          <PhaseIcon size={12} />
          {phaseConfig.label}
        </span>

        {/* Circular timer ring */}
        <div className="relative w-52 h-52 mb-8">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 180 180">
            <circle
              cx="90"
              cy="90"
              r="80"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="10"
            />
            <circle
              cx="90"
              cy="90"
              r="80"
              fill="none"
              stroke={ringColor}
              strokeWidth="10"
              strokeDasharray={`${filled} ${circumference}`}
              strokeLinecap="round"
              style={{ transition: "stroke-dasharray 0.8s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-bold text-gray-800 tabular-nums">
              {String(minutes).padStart(2, "0")}:
              {String(seconds).padStart(2, "0")}
            </span>
            <span className="text-sm text-gray-400 mt-1">
              {phaseConfig.sub}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {!running ? (
            <button
              onClick={start}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold px-6 py-3 rounded-xl transition cursor-pointer text-sm"
            >
              <Play size={16} />
              {phase === "idle" ? "Start" : "Resume"}
            </button>
          ) : (
            <button
              onClick={pause}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-6 py-3 rounded-xl transition cursor-pointer text-sm"
            >
              <Pause size={16} /> Pause
            </button>
          )}
          <button
            onClick={reset}
            className="flex items-center gap-2 text-gray-400 hover:text-gray-600 font-medium px-4 py-3 rounded-xl hover:bg-gray-50 transition cursor-pointer text-sm"
          >
            <RotateCcw size={16} /> Reset
          </button>
        </div>

        <p className="text-sm text-gray-400 mt-6">
          Cycles completed:{" "}
          <span className="font-semibold text-gray-600">{cycles}</span>
        </p>
      </div>

      {/* Session info cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Study",
            value: `${POMODORO_DEFAULTS.STUDY_MINUTES}m`,
            color: "text-indigo-500",
          },
          { label: "Break", value: `${breakMins}m`, color: "text-green-500" },
          { label: "Completed", value: `${cycles}`, color: "text-orange-500" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white rounded-2xl shadow-sm p-4 text-center"
          >
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Posture-aware info */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Posture-Aware Breaks
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Current posture score</p>
            <p
              className={`text-2xl font-bold mt-0.5 ${getScoreColor(liveData.posture_score)}`}
            >
              {liveData.posture_score}
            </p>
          </div>
          <div className="text-right max-w-xs">
            {liveData.posture_score < 65 ? (
              <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5">
                <p className="text-xs font-semibold text-orange-600">
                  Poor posture detected
                </p>
                <p className="text-xs text-orange-500 mt-0.5">
                  Break extended to {POMODORO_DEFAULTS.EXTENDED_BREAK_MINUTES}{" "}
                  min
                </p>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-2.5">
                <p className="text-xs font-semibold text-green-600">
                  Good posture!
                </p>
                <p className="text-xs text-green-500 mt-0.5">
                  Standard {POMODORO_DEFAULTS.BREAK_MINUTES} min break applies
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Active issue warnings */}
        {(liveData.neck_bad ||
          liveData.spine_bad ||
          liveData.leaning ||
          liveData.head_tilt) && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2">
              Active issues
            </p>
            <div className="flex flex-wrap gap-2">
              {liveData.neck_bad && (
                <span className="text-xs bg-red-50 text-red-500 border border-red-100 px-2.5 py-1 rounded-full">
                  Neck Forward
                </span>
              )}
              {liveData.spine_bad && (
                <span className="text-xs bg-red-50 text-red-500 border border-red-100 px-2.5 py-1 rounded-full">
                  Spine Misaligned
                </span>
              )}
              {liveData.leaning && (
                <span className="text-xs bg-red-50 text-red-500 border border-red-100 px-2.5 py-1 rounded-full">
                  Leaning {liveData.leaning_direction}
                </span>
              )}
              {liveData.head_tilt && (
                <span className="text-xs bg-orange-50 text-orange-500 border border-orange-100 px-2.5 py-1 rounded-full">
                  Head Tilted
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
