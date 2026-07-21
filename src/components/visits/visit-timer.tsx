"use client";

import { useEffect, useRef, useState } from "react";
import {
  Car,
  Hourglass,
  Stethoscope,
  Play,
  Square,
  Pencil,
  Lock,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TIMING_STAGES, STAGE_LABELS, formatDuration, formatClock, nowMs } from "@/lib/timings";
import type { TimingStage, VisitTiming } from "@/types";

const STAGE_ICON: Record<TimingStage, typeof Car> = {
  trajet: Car,
  attente: Hourglass,
  visite: Stethoscope,
};

interface VisitTimerProps {
  /** Recorded (locked) timings. */
  value: VisitTiming[];
  onChange: (timings: VisitTiming[]) => void;
  /** Bump to clear running chronometers + persisted state (e.g. after submit). */
  resetSignal?: number;
}

const LS_KEY = "handson.visitTimer.running";

type RunningMap = Partial<Record<TimingStage, number>>; // stage -> startedAt (ms epoch)

/**
 * Flexible per-stage chronometer for a médecin visit.
 *
 * Each stage (trajet / salle d'attente / visite) is independent and optional:
 * start & stop to time it automatically, or type the duration manually, or skip
 * it entirely. A duration, once recorded, is locked (no edit/delete by the
 * délégué). Running chronometers are timestamp-based (robust to the tab being
 * backgrounded) and persisted to localStorage so an accidental reload doesn't
 * lose an in-progress visit.
 */
export function VisitTimer({ value, onChange, resetSignal = 0 }: VisitTimerProps) {
  const [running, setRunning] = useState<RunningMap>({});
  const [now, setNow] = useState<number>(() => 0);
  const [manualStage, setManualStage] = useState<TimingStage | null>(null);
  const [manualMin, setManualMin] = useState("");
  const [manualSec, setManualSec] = useState("");
  const restored = useRef(false);

  const byStage = new Map(value.map((t) => [t.stage, t]));

  // Restore running chronometers on mount.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setRunning(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Persist running chronometers.
  useEffect(() => {
    try {
      if (Object.keys(running).length > 0) {
        localStorage.setItem(LS_KEY, JSON.stringify(running));
      } else {
        localStorage.removeItem(LS_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [running]);

  // Tick while any chronometer runs.
  useEffect(() => {
    if (Object.keys(running).length === 0) return;
    setNow(nowMs());
    const id = setInterval(() => setNow(nowMs()), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Parent reset (after a successful submit).
  useEffect(() => {
    if (resetSignal === 0) return;
    setRunning({});
    setManualStage(null);
    setManualMin("");
    setManualSec("");
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
  }, [resetSignal]);

  const start = (stage: TimingStage) => {
    setManualStage(null);
    setRunning((r) => ({ ...r, [stage]: nowMs() }));
  };

  const stop = (stage: TimingStage) => {
    const startedMs = running[stage];
    if (!startedMs) return;
    const endedMs = nowMs();
    const duration = Math.max(1, Math.round((endedMs - startedMs) / 1000));
    setRunning((r) => {
      const next = { ...r };
      delete next[stage];
      return next;
    });
    record({
      stage,
      started_at: new Date(startedMs).toISOString(),
      ended_at: new Date(endedMs).toISOString(),
      duration_seconds: duration,
      mode: "auto",
    });
  };

  const confirmManual = (stage: TimingStage) => {
    const min = parseInt(manualMin || "0", 10) || 0;
    const sec = parseInt(manualSec || "0", 10) || 0;
    const duration = min * 60 + sec;
    if (duration <= 0) return;
    record({
      stage,
      started_at: null,
      ended_at: null,
      duration_seconds: duration,
      mode: "manual",
    });
    setManualStage(null);
    setManualMin("");
    setManualSec("");
  };

  const record = (timing: VisitTiming) => {
    onChange([...value.filter((t) => t.stage !== timing.stage), timing]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-foreground/90">
          Chronométrage de la visite
        </p>
        <span className="text-[11px] text-muted-foreground">Facultatif</span>
      </div>

      <div className="space-y-2">
        {TIMING_STAGES.map((stage) => {
          const Icon = STAGE_ICON[stage];
          const done = byStage.get(stage);
          const startedMs = running[stage];
          const isRunning = !!startedMs;
          const elapsed = isRunning ? (now - startedMs!) / 1000 : 0;
          const isManual = manualStage === stage;

          return (
            <div
              key={stage}
              className={cn(
                "rounded-lg border p-3 transition-colors",
                done
                  ? "border-primary/30 bg-primary/5"
                  : isRunning
                  ? "border-accent bg-accent/5"
                  : "border-border"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    done ? "text-primary" : isRunning ? "text-accent" : "text-muted-foreground"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{STAGE_LABELS[stage]}</p>
                  {done ? (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="h-3 w-3" />
                      {formatDuration(done.duration_seconds)}
                      <span className="ml-1 rounded bg-muted px-1 text-[10px] uppercase tracking-wide">
                        {done.mode === "auto" ? "chrono" : "manuel"}
                      </span>
                    </p>
                  ) : isRunning ? (
                    <p className="text-xs font-semibold tabular-nums text-accent">
                      {formatClock(elapsed)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Non enregistré</p>
                  )}
                </div>

                {/* Controls — hidden once locked */}
                {!done && !isManual && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {isRunning ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => stop(stage)}
                        className="h-8 cursor-pointer"
                      >
                        <Square className="mr-1 h-3.5 w-3.5" />
                        Arrêter
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => start(stage)}
                          className="h-8 cursor-pointer"
                        >
                          <Play className="mr-1 h-3.5 w-3.5" />
                          Démarrer
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setManualStage(stage);
                            setManualMin("");
                            setManualSec("");
                          }}
                          className="h-8 cursor-pointer px-2"
                          aria-label="Saisir manuellement"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Manual entry row */}
              {isManual && (
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={manualMin}
                    onChange={(e) => setManualMin(e.target.value)}
                    placeholder="min"
                    className="h-8 w-16"
                  />
                  <span className="text-xs text-muted-foreground">min</span>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    inputMode="numeric"
                    value={manualSec}
                    onChange={(e) => setManualSec(e.target.value)}
                    placeholder="s"
                    className="h-8 w-16"
                  />
                  <span className="text-xs text-muted-foreground">s</span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => confirmManual(stage)}
                    className="h-8 cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setManualStage(null)}
                    className="h-8 cursor-pointer px-2"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Chaque étape est indépendante : démarrez/arrêtez le chrono, saisissez une
        durée, ou ignorez l&apos;étape. Une durée enregistrée ne peut plus être
        modifiée.
      </p>
    </div>
  );
}
