"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import { PostureProvider } from "@/context/PostureContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!getUser()) router.replace("/login");
    else setOk(true);
  }, []);

  if (!ok)
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#f5f0eb" }}
      >
        <span className="w-8 h-8 border-2 border-gray-200 border-t-green-500 rounded-full animate-spin" />
      </div>
    );

  return (
    // PostureProvider wraps everything — WebSocket + camera persist across ALL route changes
    <PostureProvider>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main
            className="flex-1 p-6 overflow-auto"
            style={{ backgroundColor: "#f5f0eb" }}
          >
            {children}
          </main>
        </div>
      </div>
    </PostureProvider>
  );
}
