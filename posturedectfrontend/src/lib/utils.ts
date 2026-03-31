import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// cn() merges Tailwind classes safely — resolves conflicts like
// "px-2 px-4" → "px-4" instead of keeping both
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Posture Score Helpers ─────────────────────────────────────────
// Used across dashboard, camera, analytics for consistent color coding
// Good ≥ 80 (green) | Warning ≥ 65 (orange) | Bad < 65 (red)

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 65) return "text-orange-500";
  return "text-red-500";
}

export function getScoreHex(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 65) return "#f97316";
  return "#ef4444";
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return "Optimal Position";
  if (score >= 65) return "Needs Attention";
  return "Poor Posture";
}

export function getScoreBg(score: number): string {
  if (score >= 80) return "bg-green-50 text-green-600 border-green-100";
  if (score >= 65) return "bg-orange-50 text-orange-600 border-orange-100";
  return "bg-red-50 text-red-600 border-red-100";
}

export function getScoreRing(score: number): string {
  if (score >= 80) return "ring-green-400";
  if (score >= 65) return "ring-orange-400";
  return "ring-red-400";
}

// ── Time & Date Helpers ───────────────────────────────────────────

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Issue Label Helpers ───────────────────────────────────────────
// Returns human-readable label for each posture issue

export function getIssueLabel(
  key: "neck_bad" | "spine_bad" | "leaning" | "head_tilt",
  direction?: string | null,
): string {
  switch (key) {
    case "neck_bad":
      return "Neck Forward";
    case "spine_bad":
      return "Spine Misaligned";
    case "leaning":
      return direction ? `Leaning ${direction}` : "Leaning";
    case "head_tilt":
      return "Head Tilted";
    default:
      return key;
  }
}

// ── Score Percentage for circular progress ────────────────────────
// Maps 0–100 score to a CSS conic-gradient percentage string
export function scoreToGradient(score: number): string {
  const pct = Math.max(0, Math.min(100, score));
  const hex = getScoreHex(score);
  return `conic-gradient(${hex} ${pct}%, #e5e7eb ${pct}%)`;
}
