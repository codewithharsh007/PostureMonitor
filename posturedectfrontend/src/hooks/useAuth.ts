"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser, clearUser } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    const u = getUser();
    if (!u) router.replace("/login");
    else setUser(u);
  }, []);

  function logout() {
    clearUser();
    router.replace("/login");
  }

  return { user, logout };
}
