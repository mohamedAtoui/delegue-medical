"use client";

import { Calendar, SlidersHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type DateRangePreset = "" | "today" | "week" | "month" | "custom";

export interface DateRangeValue {
  preset: DateRangePreset;
  /** YYYY-MM-DD string, used by the native date input. */
  customFrom?: string;
  /** YYYY-MM-DD string, used by the native date input. */
  customTo?: string;
}

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  /** Hide the "Toutes les dates" empty option. */
  required?: boolean;
  /** Hide the placeholder icon next to the Select. */
  hideIcon?: boolean;
  className?: string;
}

const EMPTY: DateRangeValue = { preset: "" };

export const ALL_DATES: DateRangeValue = EMPTY;
export const TODAY: DateRangeValue = { preset: "today" };

/**
 * Resolve a {@link DateRangeValue} to ISO `from`/`to` strings ready for the
 * API. Presets are computed against `now`; the custom range covers the full
 * day for both endpoints (00:00 → 23:59:59). If the user picks a `to` that
 * is before `from` we silently swap them so the API still gets a valid range.
 */
export function resolveDateRange(value: DateRangeValue): {
  from?: string;
  to?: string;
} {
  const { preset, customFrom, customTo } = value;
  if (!preset) return {};

  if (preset === "custom") {
    if (!customFrom && !customTo) return {};
    let f = customFrom ? new Date(`${customFrom}T00:00:00`) : undefined;
    let t = customTo ? new Date(`${customTo}T23:59:59.999`) : undefined;
    if (f && t && t < f) [f, t] = [t, f];
    return {
      from: f?.toISOString(),
      to: t?.toISOString(),
    };
  }

  const now = new Date();
  const from = new Date();
  if (preset === "today") from.setHours(0, 0, 0, 0);
  else if (preset === "week") from.setDate(now.getDate() - 7);
  else if (preset === "month") from.setMonth(now.getMonth() - 1);

  return { from: from.toISOString(), to: now.toISOString() };
}

export function DateRangeFilter({
  value,
  onChange,
  required = false,
  hideIcon = false,
  className,
}: DateRangeFilterProps) {
  const handlePresetChange = (next: string | undefined) => {
    const preset = (next ?? "") as DateRangePreset;
    if (preset !== "custom") {
      onChange({ preset });
    } else {
      onChange({
        preset: "custom",
        customFrom: value.customFrom,
        customTo: value.customTo,
      });
    }
  };

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row", className)}>
      <Select value={value.preset} onValueChange={handlePresetChange}>
        <SelectTrigger className="flex-1">
          {!hideIcon && (
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground mr-1" />
          )}
          <SelectValue
            placeholder={required ? "Période" : "Toutes les dates"}
          />
        </SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value="">Toutes les dates</SelectItem>}
          <SelectItem value="today">Aujourd&apos;hui</SelectItem>
          <SelectItem value="week">Cette semaine</SelectItem>
          <SelectItem value="month">Ce mois-ci</SelectItem>
          <SelectItem value="custom">Personnalisée…</SelectItem>
        </SelectContent>
      </Select>

      {value.preset === "custom" && (
        <div className="flex flex-1 gap-2">
          <label className="relative flex-1">
            <span className="absolute -top-4 left-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Du
            </span>
            <Calendar className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={value.customFrom ?? ""}
              onChange={(e) =>
                onChange({ ...value, customFrom: e.target.value || undefined })
              }
              className="pl-9"
              aria-label="Date de début"
            />
          </label>
          <label className="relative flex-1">
            <span className="absolute -top-4 left-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Au
            </span>
            <Calendar className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={value.customTo ?? ""}
              onChange={(e) =>
                onChange({ ...value, customTo: e.target.value || undefined })
              }
              className="pl-9"
              aria-label="Date de fin"
            />
          </label>
        </div>
      )}
    </div>
  );
}
