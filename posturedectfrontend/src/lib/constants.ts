export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/backend";
export const WS_URL = (
  process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"
).replace(/\/$/, "");

export const POSTURE_THRESHOLDS = { GOOD: 80, WARNING: 65 };

export const POMODORO_DEFAULTS = {
  STUDY_MINUTES: 50,
  BREAK_MINUTES: 10,
  EXTENDED_BREAK_MINUTES: 15,
};
