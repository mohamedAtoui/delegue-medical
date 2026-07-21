"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface EngagementStarsProps {
  /** 0–max. Fractional values (e.g. the doctor average 2.5) are allowed. */
  value: number | null | undefined;
  /** When provided the stars become clickable (1–max). */
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  /** Show the numeric value (e.g. "2,5") next to the stars. */
  showValue?: boolean;
  /** Number of stars on the scale (engagement is a 3-star scale). */
  max?: number;
  className?: string;
}

const SIZES = { sm: "h-3 w-3", md: "h-4 w-4", lg: "h-6 w-6" } as const;

/**
 * Brand-accent (orange) engagement stars, used everywhere engagement is shown
 * or edited. In read mode a fractional average fills to the nearest star and
 * the exact value can be shown alongside; in edit mode each star is a button.
 * The scale is 3 stars (see migration 023).
 */
export function EngagementStars({
  value,
  onChange,
  size = "md",
  showValue = false,
  max = 3,
  className,
}: EngagementStarsProps) {
  // Postgres `numeric` (doctors.engagement average) comes back from PostgREST
  // as a string — coerce so comparisons and toFixed() never break during SSR.
  const v = Number(value ?? 0) || 0;
  const interactive = !!onChange;
  const threshold = interactive ? v : Math.round(v);
  const starClass = SIZES[size];

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {Array.from({ length: max }, (_, i) => i + 1).map((s) => {
        const filled = s <= threshold;
        const star = (
          <Star
            className={cn(
              starClass,
              "transition-colors",
              filled ? "fill-accent text-accent" : "text-muted-foreground/30"
            )}
          />
        );
        return interactive ? (
          <button
            key={s}
            type="button"
            onClick={() => onChange!(s)}
            className="cursor-pointer"
            aria-label={`${s} sur ${max}`}
          >
            {star}
          </button>
        ) : (
          <span key={s}>{star}</span>
        );
      })}
      {showValue && v > 0 && (
        <span className="ml-1 text-xs font-medium text-foreground/70 tabular-nums">
          {v.toFixed(1).replace(".", ",")}
        </span>
      )}
    </span>
  );
}
