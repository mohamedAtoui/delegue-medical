"use client";

import { useState } from "react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

interface DeadlineSelectProps {
  value: string;
  onChange: (isoDate: string) => void;
}

const PRESETS = [
  { label: "1 semaine", days: 7 },
  { label: "10 jours", days: 10 },
  { label: "20 jours", days: 20 },
  { label: "30 jours", days: 30 },
];

export function DeadlineSelect({ value, onChange }: DeadlineSelectProps) {
  const [customMode, setCustomMode] = useState(false);

  const selectedDate = value ? new Date(value) : null;

  const handlePreset = (days: number) => {
    setCustomMode(false);
    const date = addDays(new Date(), days);
    date.setHours(23, 59, 59, 0);
    onChange(date.toISOString());
  };

  const handleCustom = (dateStr: string) => {
    if (!dateStr) return;
    const date = new Date(dateStr);
    date.setHours(23, 59, 59, 0);
    onChange(date.toISOString());
  };

  const isPresetSelected = (days: number) => {
    if (!selectedDate || customMode) return false;
    const target = addDays(new Date(), days);
    return (
      selectedDate.getFullYear() === target.getFullYear() &&
      selectedDate.getMonth() === target.getMonth() &&
      selectedDate.getDate() === target.getDate()
    );
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5" />
        Date limite
      </label>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.days}
            type="button"
            onClick={() => handlePreset(preset.days)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border",
              isPresetSelected(preset.days)
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-muted/40 text-foreground/70 border-border/50 hover:bg-muted hover:border-border"
            )}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustomMode(true)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border",
            customMode
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-muted/40 text-foreground/70 border-border/50 hover:bg-muted hover:border-border"
          )}
        >
          Personnalisé
        </button>
      </div>
      {customMode && (
        <input
          type="date"
          min={format(new Date(), "yyyy-MM-dd")}
          value={selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""}
          onChange={(e) => handleCustom(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      )}
      {selectedDate && (
        <p className="text-[11px] text-muted-foreground">
          Échéance : {format(selectedDate, "EEEE d MMMM yyyy", { locale: undefined })}
        </p>
      )}
    </div>
  );
}
