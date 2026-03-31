"use client";
import { AlertTriangle } from "lucide-react";
import { formatDuration } from "@/lib/utils";

export default function BadPostureAlert({
  duration,
  visible,
}: {
  duration: number;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 bg-red-500 text-white px-5 py-4 rounded-2xl shadow-lg flex items-center gap-3 z-50 animate-bounce">
      <AlertTriangle size={20} />
      <div>
        <p className="text-sm font-semibold">Bad Posture Detected!</p>
        <p className="text-xs opacity-90">
          Duration: {formatDuration(duration)}
        </p>
      </div>
    </div>
  );
}
