"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface DayReport {
  date: string;
  avg_score: number;
  bad_duration_mins: number;
  neck_issues: number;
  spine_issues: number;
  leaning_issues: number;
  tilt_issues: number;
  total_samples: number;
}

export interface WeeklyReport {
  days: DayReport[];
  summary: {
    avg_score: number;
    best_day: string;
    worst_day: string;
    total_bad_mins: number;
    trend: "improving" | "declining";
  } | null;
}

export function usePostureHistory() {
  const [report, setReport] = useState<WeeklyReport>({
    days: [],
    summary: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .weeklyReport()
      .then((data) => setReport(data as WeeklyReport))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { report, loading, error };
}
