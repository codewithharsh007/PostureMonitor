import { cn } from "@/lib/utils";

const icons: Record<string, string> = {
  neck: "🧍",
  spine: "🦴",
  shoulder: "🏋️",
  head: "🙂",
};

export default function PostureMetricCard({
  title,
  status,
  isGood,
  icon,
}: {
  title: string;
  status: string;
  isGood: boolean;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">{title}</h3>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icons[icon]}</span>
        <div>
          <p
            className={cn(
              "text-sm font-semibold",
              isGood ? "text-green-500" : "text-red-500",
            )}
          >
            {status}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {isGood ? "No issues detected" : "Needs correction"}
          </p>
        </div>
      </div>
    </div>
  );
}
