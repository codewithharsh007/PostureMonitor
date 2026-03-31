import { getToken } from "./auth";

const BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/backend";

async function req<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export const api = {
  register: (b: object) =>
    req("/auth/register", { method: "POST", body: JSON.stringify(b) }),
  login: (b: object) =>
    req("/auth/login", { method: "POST", body: JSON.stringify(b) }),
  me: () => req("/auth/me"),
  analyzeFrame: (b: object) =>
    req("/model/analyze", { method: "POST", body: JSON.stringify(b) }),
  postureToday: () => req("/posture/today"),
  today: () => req("/posture/today"), // ← fixed, same as postureToday
  weeklyReport: () => req("/reports/weekly"),
  notifications: () => req("/notifications"),
  markRead: (id: string) =>
    req(`/notifications/${id}/read`, { method: "POST" }),
  clearNotifs: () => req("/notifications/clear", { method: "DELETE" }),
  adminStats: () => req("/admin/stats"),
  adminUsers: () => req("/admin/users"),
};
