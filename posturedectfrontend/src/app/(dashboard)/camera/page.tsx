"use client";
import { usePosture } from "@/context/PostureContext";
import { Camera, CameraOff, Wifi, WifiOff } from "lucide-react";
import { getScoreHex, getScoreLabel } from "@/lib/utils";

export default function CameraPage() {
  const {
    setVideoRef,
    setCanvasRef,
    cameraData: data,
    running,
    loading,
    camError,
    startCamera,
    stopCamera,
  } = usePosture();

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Live Camera</h1>
        <div
          className={`flex items-center gap-1.5 text-xs font-medium ${running ? "text-green-500" : "text-gray-400"}`}
        >
          {running ? <Wifi size={14} /> : <WifiOff size={14} />}
          {running ? "Streaming to dashboard" : "Monitoring off"}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="relative bg-gray-900 aspect-video flex items-center justify-center">
            <video
              ref={setVideoRef}
              className="absolute inset-0 w-full h-full object-cover"
              muted
              playsInline
            />
            <canvas
              ref={setCanvasRef}
              className="absolute inset-0 w-full h-full object-cover"
            />

            {!running && (
              <div className="flex flex-col items-center gap-3 text-gray-500 z-10 relative">
                <CameraOff size={48} className="text-gray-600" />
                <p className="text-sm">Camera is off</p>
                {camError && (
                  <p className="text-xs text-red-400 bg-red-900/30 px-3 py-2 rounded-lg max-w-xs text-center">
                    {camError}
                  </p>
                )}
              </div>
            )}

            {running && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full z-10">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />{" "}
                LIVE
              </div>
            )}
            {running && (
              <div
                className="absolute top-3 right-3 text-white text-sm font-bold px-3 py-1.5 rounded-xl z-10"
                style={{
                  backgroundColor: getScoreHex(data.posture_score) + "cc",
                }}
              >
                Score: {data.posture_score}
              </div>
            )}
            {running && (
              <div className="absolute bottom-3 left-3 space-y-1 z-10">
                {data.neck_bad && (
                  <div className="bg-red-500/80 text-white text-xs px-2 py-1 rounded-lg">
                    !! NECK FORWARD
                  </div>
                )}
                {data.spine_bad && (
                  <div className="bg-red-500/80 text-white text-xs px-2 py-1 rounded-lg">
                    !! SPINE MISALIGNED
                  </div>
                )}
                {data.leaning && (
                  <div className="bg-red-500/80 text-white text-xs px-2 py-1 rounded-lg">
                    !! LEANING {data.leaning_direction}
                  </div>
                )}
                {data.head_tilt && (
                  <div className="bg-orange-500/80 text-white text-xs px-2 py-1 rounded-lg">
                    !! HEAD TILTED
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 flex items-center gap-4 bg-white">
            {!running ? (
              <button
                onClick={startCamera}
                disabled={loading}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition disabled:opacity-60 cursor-pointer"
              >
                <Camera size={16} />
                {loading ? "Starting..." : "Start Monitoring"}
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition cursor-pointer"
              >
                <CameraOff size={16} /> Stop
              </button>
            )}
            <p className="text-xs text-gray-400">
              {running
                ? "Analyzing every 500ms. Switch pages freely — monitoring continues."
                : "Click Start — camera permission asked once."}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <p className="text-sm text-gray-400 mb-2">Posture Score</p>
            <p
              className="text-6xl font-bold transition-all"
              style={{ color: getScoreHex(data.posture_score) }}
            >
              {running ? data.posture_score : "--"}
            </p>
            <p
              className="text-xs mt-2"
              style={{ color: getScoreHex(data.posture_score) }}
            >
              {running ? getScoreLabel(data.posture_score) : "Start camera"}
            </p>
          </div>

          {[
            {
              label: "Neck",
              bad: data.neck_bad,
              good: "Good",
              warn: "Forward",
            },
            {
              label: "Spine",
              bad: data.spine_bad,
              good: "Aligned",
              warn: "Misaligned",
            },
            {
              label: "Lean",
              bad: data.leaning,
              good: "Level",
              warn: `Leaning ${data.leaning_direction ?? ""}`,
            },
            {
              label: "Head",
              bad: data.head_tilt,
              good: "Centered",
              warn: "Tilted",
            },
          ].map(({ label, bad, good, warn }) => (
            <div
              key={label}
              className="bg-white rounded-2xl shadow-sm flex items-center justify-between py-3 px-5"
            >
              <span className="text-sm font-medium text-gray-600">{label}</span>
              <span
                className={`text-sm font-semibold ${!running ? "text-gray-300" : bad ? "text-red-500" : "text-green-500"}`}
              >
                {!running ? "—" : bad ? warn : good}
              </span>
            </div>
          ))}

          {running && data.bad_posture_duration > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <p className="text-xs text-red-500 font-semibold">
                Bad posture timer
              </p>
              <p className="text-2xl font-bold text-red-500 mt-1">
                {Math.floor(data.bad_posture_duration)}s
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
