"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search, Calendar, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import Image from "next/image";

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <nav className="bg-white shadow-sm px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <Image
          src="/logo.png"
          alt="Posture Monitor"
          width={40}
          height={40}
          className="rounded-lg w-auto h-auto"
          priority
        />
        <span className="text-xl font-bold text-gray-800">Posture Monitor</span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-4 py-2">
          <Search size={16} className="text-gray-400" />
          <input
            placeholder="Search"
            className="bg-transparent text-sm outline-none w-40 text-gray-600 placeholder:text-gray-400"
          />
        </div>

        {/* Date */}
        <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600">
          <Calendar size={15} className="text-gray-400" />
          <span>Today, {today}</span>
        </div>

        {/* Live Camera button */}
        {/* <Link
          href="/camera"
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition border",
            pathname === "/camera"
              ? "bg-green-500 text-white border-green-500"
              : "border-gray-200 text-gray-600 hover:bg-green-50 hover:text-green-600 hover:border-green-200",
          )}
        >
          <Camera size={15} />
          <span className="hidden md:block">Live Camera</span>
        </Link> */}

        {/* Notifications bell */}
        <Link
          href="/notifications"
          className={cn(
            "relative p-2 rounded-xl transition border",
            pathname === "/notifications"
              ? "bg-green-50 text-green-600 border-green-200"
              : "border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-800",
          )}
        >
          <Bell size={18} />
          {/* Unread dot */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </Link>

        {/* User info + logout */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-gray-100">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-700 font-semibold text-xs uppercase">
                {user.username[0]}
              </span>
            </div>
            <span className="text-sm text-gray-600 hidden md:block">
              {user.username}
            </span>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition cursor-pointer"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
