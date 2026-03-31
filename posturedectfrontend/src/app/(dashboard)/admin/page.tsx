"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { api } from "@/lib/api";
import Card from "@/components/ui/Card";
import { Users, Activity, BarChart2, ShieldOff } from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  const user = getUser();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.replace("/dashboard");
      return;
    }
    Promise.all([api.adminStats(), api.adminUsers()])
      .then(([s, u]) => {
        setStats(s);
        setUsers(u as any[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!user || user.role !== "admin")
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <ShieldOff size={40} className="text-gray-300" />
        <p className="text-gray-400 text-sm">Access denied</p>
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Admin Portal</h1>

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="w-10 h-10 border-2 border-gray-200 border-t-green-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: "Total Users",
                value: stats?.total_users,
                icon: Users,
                color: "bg-blue-50 text-blue-500",
              },
              {
                label: "Posture Logs",
                value: stats?.total_posture_logs,
                icon: BarChart2,
                color: "bg-green-50 text-green-500",
              },
              {
                label: "Live Connections",
                value: stats?.active_connections,
                icon: Activity,
                color: "bg-purple-50 text-purple-500",
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}
                >
                  <Icon size={22} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">
                    {value ?? 0}
                  </p>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              All Users
            </h2>
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between py-2.5 px-4 bg-gray-50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-700 text-xs font-bold uppercase">
                        {u.username[0]}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {u.username}
                      </p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${u.role === "admin" ? "bg-purple-100 text-purple-600" : "bg-green-100 text-green-600"}`}
                  >
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
