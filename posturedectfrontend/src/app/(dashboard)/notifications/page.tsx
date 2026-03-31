"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { usePosture } from "@/context/PostureContext";
import { api } from "@/lib/api";
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Info,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { formatDuration, timeAgo } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────
interface DBNotification {
  id: string;
  type: "warning" | "success" | "info";
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  source: "db";
}

interface LiveNotification {
  id: string;
  type: "warning" | "success" | "info";
  title: string;
  message: string;
  read: boolean;
  time: string;
  source: "live";
}

type AppNotification = DBNotification | LiveNotification;

// ── Helpers ───────────────────────────────────────────────────────
function makeLive(
  type: "warning" | "success" | "info",
  title: string,
  message: string,
): LiveNotification {
  return {
    id: `live_${Date.now()}_${Math.random()}`,
    type,
    title,
    message,
    read: false,
    time: new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    source: "live",
  };
}

const icons = {
  warning: <AlertTriangle size={16} className="text-orange-500" />,
  success: <CheckCircle size={16} className="text-green-500" />,
  info: <Info size={16} className="text-blue-500" />,
};

const bgColors = {
  warning: "bg-orange-50 border-orange-100",
  success: "bg-green-50  border-green-100",
  info: "bg-blue-50   border-blue-100",
};

// ── Page ──────────────────────────────────────────────────────────
export default function NotificationsPage() {
  // ✅ usePosture from context — no more usePostureSocket
  const { liveData } = usePosture();

  const [dbNotifs, setDbNotifs] = useState<DBNotification[]>([]);
  const [liveNotifs, setLiveNotifs] = useState<LiveNotification[]>([]);
  const [loadingDb, setLoadingDb] = useState(true);

  const prevScoreRef = useRef(100);
  const prevBadDurRef = useRef(0);
  const lastAlertRef = useRef(0); // timestamp of last live alert to debounce

  // ── Fetch DB notifications on mount ──────────────────────────
  const fetchNotifs = useCallback(async () => {
    setLoadingDb(true);
    try {
      const data = await api.notifications();
      const mapped: DBNotification[] = (data as any[]).map((n: any) => ({
        id: n.id,
        type: n.type as "warning" | "success" | "info",
        title: n.title,
        message: n.message,
        read: n.read,
        created_at: n.created_at,
        source: "db",
      }));
      setDbNotifs(mapped);
    } catch {
      // ignore fetch error
    } finally {
      setLoadingDb(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifs();
  }, [fetchNotifs]);

  // ── Live posture alerts (local, not saved to DB) ──────────────
  useEffect(() => {
    const score = liveData.posture_score;
    const badDur = liveData.bad_posture_duration;
    const now = Date.now();

    // Bad posture alert — fires every 30s while bad posture continues
    if (badDur > 10 && now - lastAlertRef.current > 30000) {
      lastAlertRef.current = now;
      setLiveNotifs((prev) => [
        makeLive(
          "warning",
          "Bad Posture Detected",
          `Bad posture for ${formatDuration(badDur)}.${liveData.neck_bad ? " Neck forward." : ""}${liveData.spine_bad ? " Spine misaligned." : ""}${liveData.leaning ? ` Leaning ${liveData.leaning_direction}.` : ""}${liveData.head_tilt ? " Head tilted." : ""}`,
        ),
        ...prev.slice(0, 19), // keep max 20 live notifs
      ]);
    }

    // Recovery alert — was bad, now good
    if (prevScoreRef.current < 65 && score >= 80) {
      setLiveNotifs((prev) => [
        makeLive(
          "success",
          "Great Recovery!",
          "Your posture is back to optimal. Keep it up!",
        ),
        ...prev.slice(0, 19),
      ]);
    }

    prevScoreRef.current = score;
    prevBadDurRef.current = badDur;
  }, [liveData.posture_score, liveData.bad_posture_duration]);

  // ── Merge DB + live, sort by time ─────────────────────────────
  const allNotifs: AppNotification[] = [...liveNotifs, ...dbNotifs];

  const unread = allNotifs.filter((n) => !n.read).length;

  // ── Actions ───────────────────────────────────────────────────
  function markRead(n: AppNotification) {
    if (n.source === "live") {
      setLiveNotifs((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
      );
    } else {
      api.markRead(n.id).catch(() => {});
      setDbNotifs((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
      );
    }
  }

  function markAllRead() {
    setLiveNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    dbNotifs
      .filter((n) => !n.read)
      .forEach((n) => api.markRead(n.id).catch(() => {}));
    setDbNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function clearAll() {
    setLiveNotifs([]);
    await api.clearNotifs().catch(() => {});
    setDbNotifs([]);
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
          {unread > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchNotifs}
            className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-green-600 hover:text-green-700 font-medium cursor-pointer"
            >
              Mark all read
            </button>
          )}
          {allNotifs.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-red-400 hover:text-red-500 font-medium cursor-pointer flex items-center gap-1"
            >
              <Trash2 size={12} /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* Source tabs info */}
      {allNotifs.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            {liveNotifs.length} live alerts
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            {dbNotifs.length} stored alerts
          </span>
        </div>
      )}

      {/* Loading */}
      {loadingDb && dbNotifs.length === 0 && (
        <div className="flex justify-center py-10">
          <span className="w-8 h-8 border-2 border-gray-200 border-t-green-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loadingDb && allNotifs.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm flex flex-col items-center py-16 gap-3">
          <Bell size={40} className="text-gray-200" />
          <p className="text-gray-400 text-sm">No notifications yet</p>
          <p className="text-gray-300 text-xs">
            Alerts appear here when bad posture is detected
          </p>
        </div>
      )}

      {/* Notification list */}
      {allNotifs.length > 0 && (
        <div className="space-y-2">
          {allNotifs.map((n) => (
            <div
              key={n.id}
              onClick={() => markRead(n)}
              className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition hover:shadow-sm ${bgColors[n.type]} ${n.read ? "opacity-55" : ""}`}
            >
              <div className="mt-0.5 shrink-0">{icons[n.type]}</div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-800">
                    {n.title}
                  </p>
                  <span className="text-xs text-gray-400 shrink-0">
                    {n.source === "db" ? timeAgo(n.created_at) : n.time}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  {n.message}
                </p>

                {/* Source badge */}
                <span
                  className={`inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    n.source === "db"
                      ? "bg-gray-100 text-gray-400"
                      : "bg-blue-50 text-blue-400"
                  }`}
                >
                  {n.source === "db" ? "saved" : "live"}
                </span>
              </div>

              {!n.read && (
                <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
