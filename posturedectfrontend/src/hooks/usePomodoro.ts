"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { POMODORO_DEFAULTS } from "@/lib/constants";

export type PomodoroPhase = "idle" | "studying" | "break";

// Saved to localStorage so refresh restores state
interface PersistedState {
  phase: PomodoroPhase;
  elapsed: number;
  cycles: number;
  savedAt: number; // epoch ms when we last saved
  wasRunning: boolean;
}

const STORAGE_KEY = "pomodoro_state";

function loadState(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

function saveState(s: PersistedState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function usePomodoro(postureScore: number) {
  const studyMins = POMODORO_DEFAULTS.STUDY_MINUTES;
  const breakMins =
    postureScore < 65
      ? POMODORO_DEFAULTS.EXTENDED_BREAK_MINUTES
      : POMODORO_DEFAULTS.BREAK_MINUTES;

  const totalStudySecs = studyMins * 60;
  const totalBreakSecs = breakMins * 60;

  // ── Restore state from localStorage on mount ──────────────────
  const [phase, setPhase] = useState<PomodoroPhase>("idle");
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadState();
    if (saved) {
      let restoredElapsed = saved.elapsed;

      // If was running before refresh — add time that passed while page was closed
      if (saved.wasRunning && saved.savedAt) {
        const secondsGone = Math.floor((Date.now() - saved.savedAt) / 1000);
        restoredElapsed = saved.elapsed + secondsGone;
      }

      const totalSecs =
        saved.phase === "break" ? totalBreakSecs : totalStudySecs;

      // If timer would have expired while away — auto-advance phase
      if (saved.phase !== "idle" && restoredElapsed >= totalSecs) {
        if (saved.phase === "studying") {
          setPhase("break");
          setCycles(saved.cycles + 1);
          setElapsed(restoredElapsed - totalSecs);
        } else {
          setPhase("studying");
          setElapsed(restoredElapsed - totalBreakSecs);
          setCycles(saved.cycles);
        }
        setRunning(saved.wasRunning);
      } else {
        setPhase(saved.phase);
        setElapsed(restoredElapsed);
        setCycles(saved.cycles);
        setRunning(saved.wasRunning);
      }
    }
    setHydrated(true);
  }, []);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<PomodoroPhase>("idle");
  phaseRef.current = phase;

  const totalSecs = phase === "break" ? totalBreakSecs : totalStudySecs;
  const remaining = Math.max(totalSecs - elapsed, 0);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = totalSecs > 0 ? (elapsed / totalSecs) * 100 : 0;

  // ── Save to localStorage whenever state changes ───────────────
  useEffect(() => {
    if (!hydrated) return;
    saveState({
      phase,
      elapsed,
      cycles,
      savedAt: Date.now(),
      wasRunning: running,
    });
  }, [phase, elapsed, cycles, running, hydrated]);

  // ── Auto-advance phase ────────────────────────────────────────
  useEffect(() => {
    if (!running || remaining > 0) return;
    if (phaseRef.current === "studying") {
      setPhase("break");
      setElapsed(0);
      setCycles((c) => c + 1);
    } else if (phaseRef.current === "break") {
      setPhase("studying");
      setElapsed(0);
    }
  }, [remaining, running]);

  // ── Tick ──────────────────────────────────────────────────────
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const start = useCallback(() => {
    if (phase === "idle") setPhase("studying");
    setRunning(true);
  }, [phase]);

  const pause = useCallback(() => setRunning(false), []);

  const reset = useCallback(() => {
    setRunning(false);
    setPhase("idle");
    setElapsed(0);
    setCycles(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    phase,
    running,
    minutes,
    seconds,
    cycles,
    progress,
    start,
    pause,
    reset,
  };
}
