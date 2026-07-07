"use client";

import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export interface FilterTabOption<T extends string> {
  value: T;
  label: string;
  icon?: ComponentType<{ className?: string }>;
}

interface FilterTabsProps<T extends string> {
  options: FilterTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

// Static Tailwind classes so the grid columns are known at build time.
const COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-3 sm:grid-cols-5",
};

/**
 * Segmented control used for the type/category filters across list pages
 * (e.g. Tous / Médecins / Pharmaciens / Grossistes). One consistent look and
 * behaviour everywhere; the page decides what each value means.
 */
export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  className,
}: FilterTabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "grid gap-2 rounded-lg bg-muted/40 p-1",
        COLS[options.length] ?? "grid-cols-2 sm:grid-cols-4",
        className
      )}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value || opt.label}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all cursor-pointer",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" />}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
