"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart2,
  Timer,
  ShieldCheck,
  Camera,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getUser } from "@/lib/auth";

const allLinks = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    adminOnly: false,
  },
  { href: "/camera", label: "Live Camera", icon: Camera, adminOnly: false },
  { href: "/analytics", label: "Analytics", icon: BarChart2, adminOnly: false },
  { href: "/pomodoro", label: "Pomodoro", icon: Timer, adminOnly: false },
  // {
  //   href: "/notifications",
  //   label: "Notifications",
  //   icon: Bell,
  //   adminOnly: false,
  // },
  { href: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const user = getUser();
  const isAdmin = user?.role === "admin";
  const links = allLinks.filter((l) => !l.adminOnly || isAdmin);

  return (
    <aside className="w-56 bg-white shadow-sm min-h-full py-6 px-3 flex flex-col gap-1 shrink-0">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition",
            pathname === href
              ? "bg-green-50 text-green-600"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-800",
          )}
        >
          <Icon size={18} />
          {label}
        </Link>
      ))}
    </aside>
  );
}
