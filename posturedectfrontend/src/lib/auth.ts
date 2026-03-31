const KEY = "posture_auth";

export interface AuthUser {
  username: string;
  role: "admin" | "user";
  token: string;
}

export const saveUser = (u: AuthUser) =>
  localStorage.setItem(KEY, JSON.stringify(u));
export const clearUser = () => localStorage.removeItem(KEY);
export const getToken = () => getUser()?.token ?? null;

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}
