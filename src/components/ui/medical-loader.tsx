"use client";

import { BrainCircuit } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Variant = "inline" | "fullscreen" | "overlay";

interface MedicalLoaderProps {
  variant?: Variant;
  label?: string;
  /** Don't render until this many ms have elapsed — avoids flicker on fast loads. */
  delayMs?: number;
  className?: string;
}

export function MedicalLoader({
  variant = "inline",
  label = "Chargement…",
  delayMs = 150,
  className,
}: MedicalLoaderProps) {
  const [visible, setVisible] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs === 0) return;
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  if (!visible) return null;

  const wrapperByVariant: Record<Variant, string> = {
    inline:
      "flex min-h-[40vh] w-full flex-col items-center justify-center gap-4",
    fullscreen:
      "fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 pointer-events-none",
    // No backdrop / blur — just the icon hovering centered over the existing
    // data. Keeps the underlying content fully visible and avoids the double
    // "shadow" effect during refetches.
    overlay:
      "absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 pointer-events-none",
  };

  return (
    <div
      className={cn(wrapperByVariant[variant], className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="relative h-16 w-16">
        {/* soft halo */}
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />

        {/* outer ring (green) */}
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-primary/40 animate-spin"
          style={{ animationDuration: "1.2s" }}
        />

        {/* inner ring (orange, reverse) */}
        <div
          className="absolute inset-1.5 rounded-full border-2 border-transparent border-b-accent border-l-accent/40 animate-spin"
          style={{ animationDuration: "1.6s", animationDirection: "reverse" }}
        />

        {/* center icon — white brain-activity, breathing in & out */}
        <div className="absolute inset-0 flex items-center justify-center">
          <BrainCircuit
            className="h-[26px] w-[26px] text-white animate-brain-breathe"
            strokeWidth={1.75}
            style={{
              filter:
                "drop-shadow(0 0 1px rgba(0,0,0,0.5)) drop-shadow(0 1px 2px rgba(0,0,0,0.18))",
            }}
            aria-hidden
          />
        </div>
      </div>

      <span className="text-sm text-muted-foreground animate-in fade-in duration-300">
        {label}
      </span>
    </div>
  );
}
