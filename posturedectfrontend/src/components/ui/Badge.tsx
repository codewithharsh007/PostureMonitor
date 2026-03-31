import { cn } from "@/lib/utils";

interface BadgeProps {
  label: string;
  variant?: "good" | "warning" | "bad" | "neutral";
}

const variants = {
  good: "bg-green-100 text-green-700",
  warning: "bg-orange-100 text-orange-700",
  bad: "bg-red-100 text-red-700",
  neutral: "bg-gray-100 text-gray-700",
};

export default function Badge({ label, variant = "neutral" }: BadgeProps) {
  return (
    <span
      className={cn(
        "text-xs font-medium px-2.5 py-1 rounded-full",
        variants[variant],
      )}
    >
      {label}
    </span>
  );
}
