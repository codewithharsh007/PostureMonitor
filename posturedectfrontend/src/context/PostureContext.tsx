"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { PostureData, defaultPostureData } from "@/types/posture";
import { getToken } from "@/lib/auth";
import { api } from "@/lib/api";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000";
const CAMERA_RUNNING_KEY = "camera_was_running";

interface PostureContextType {
  liveData: PostureData;
  connected: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  setVideoRef: (el: HTMLVideoElement | null) => void;
  setCanvasRef: (el: HTMLCanvasElement | null) => void;
  cameraData: PostureData;
  running: boolean;
  loading: boolean;
  camError: string;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
}

const PostureContext = createContext<PostureContextType | null>(null);

export function PostureProvider({ children }: { children: React.ReactNode }) {
  // ── WebSocket ─────────────────────────────────────────────────
  const [liveData, setLiveData] = useState<PostureData>(defaultPostureData);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Camera state ──────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // ✅ Offscreen canvas lives in context — works on ANY page
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = useRef(false);

  const [cameraData, setCameraData] = useState<PostureData>(defaultPostureData);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [camError, setCamError] = useState("");

  // ── Keep runningRef in sync ───────────────────────────────────
  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  // ── Create offscreen canvas once on mount ────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    offscreenRef.current = canvas;
  }, []);

  // ── Callback refs for /camera page video element ──────────────
  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  const setCanvasRef = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
  }, []);

  // ── Notification permission ───────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default")
        Notification.requestPermission();
    }
  }, []);

  // ── WebSocket ─────────────────────────────────────────────────
  useEffect(() => {
    function clearTimers() {
      if (retryRef.current) clearTimeout(retryRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
    }

    function connect() {
      clearTimers();
      const token = getToken();
      if (!token) return;
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      try {
        const ws = new WebSocket(`${WS_BASE}/ws/posture?token=${token}`);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          pingRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send("ping");
          }, 20000);
        };

        ws.onclose = () => {
          setConnected(false);
          clearTimers();
          retryRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = () => ws.close();

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.ping) return;
            if (parsed.type === "POSTURE_ALERT") {
              // ✅ Notifications fire regardless of which page you're on
              if (Notification.permission === "granted") {
                new Notification(parsed.title || "Posture Alert", {
                  body: parsed.message,
                });
              }
              return;
            }
            // Only update from WS when camera is NOT running
            if (!runningRef.current) {
              setLiveData(parsed as PostureData);
            }
          } catch {}
        };
      } catch {
        retryRef.current = setTimeout(connect, 3000);
      }
    }

    connect();
    return () => {
      clearTimers();
      wsRef.current?.close();
    };
  }, []);

  // ── Frame analysis loop — runs in context, works on ANY page ──
  const startAnalysisLoop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(async () => {
      // Use visible video if on /camera, else use stream directly via offscreen
      const video = videoRef.current;
      const canvas = offscreenRef.current;
      if (!canvas || !streamRef.current) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // If visible video is available and playing — use it
      // Otherwise draw from stream track via ImageCapture API
      if (video && video.readyState >= 2 && !video.paused) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } else {
        // ✅ On other pages — grab frame directly from stream track
        const track = streamRef.current.getVideoTracks()[0];
        if (!track || track.readyState !== "live") return;
        try {
          // @ts-ignore — ImageCapture is not in all TS types
          const imageCapture = new ImageCapture(track);
          const bitmap = await imageCapture.grabFrame();
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          ctx.drawImage(bitmap, 0, 0);
          bitmap.close();
        } catch {
          return;
        }
      }

      const base64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
      try {
        const result = await api.analyzeFrame({ frame: base64 });
        if (result?.posture_score !== undefined) {
          const postureResult = result as PostureData;
          setCameraData(postureResult);
          setLiveData(postureResult); // ✅ always updates regardless of page
        }
      } catch {}
    }, 500);
  }, []);

  // ── Camera controls ───────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current)
      streamRef.current.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    streamRef.current = null;
    timerRef.current = null;
    runningRef.current = false;
    sessionStorage.removeItem(CAMERA_RUNNING_KEY);
    setRunning(false);
    setCameraData(defaultPostureData);
  }, []);

  const startCamera = useCallback(async () => {
    setLoading(true);
    setCamError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      streamRef.current = stream;

      // Attach to visible video element if on /camera page
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      sessionStorage.setItem(CAMERA_RUNNING_KEY, "1");
      runningRef.current = true;
      setRunning(true);
      setLoading(false);

      // ✅ Start loop — works on any page via offscreen canvas
      startAnalysisLoop();
    } catch (err: any) {
      setCamError(
        err.message === "Permission denied"
          ? "Camera permission denied. Please allow camera access."
          : err.message || "Could not start camera",
      );
      setLoading(false);
    }
  }, [startAnalysisLoop]);

  // ── Auto-restart camera after page refresh ────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const wasRunning = sessionStorage.getItem(CAMERA_RUNNING_KEY);
    if (wasRunning === "1") setTimeout(startCamera, 0);
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────
  useEffect(() => () => stopCamera(), []);

  return (
    <PostureContext.Provider
      value={{
        liveData,
        connected,
        videoRef,
        canvasRef,
        setVideoRef,
        setCanvasRef,
        cameraData,
        running,
        loading,
        camError,
        startCamera,
        stopCamera,
      }}
    >
      {children}
    </PostureContext.Provider>
  );
}

export function usePosture() {
  const ctx = useContext(PostureContext);
  if (!ctx) throw new Error("usePosture must be used inside PostureProvider");
  return ctx;
}
