"use client";

import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

interface YesNoToggleProps {
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  label?: string;
  className?: string;
}

export function YesNoToggle({ value, onChange, label, className }: YesNoToggleProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      {label && (
        <span className="text-sm text-foreground/90 flex-1">{label}</span>
      )}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
        <button
          type="button"
          onClick={() => onChange(value === true ? null : true)}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
            value === true
              ? "bg-green-100 text-green-700 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Check className="h-3 w-3" />
          Oui
        </button>
        <button
          type="button"
          onClick={() => onChange(value === false ? null : false)}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
            value === false
              ? "bg-red-100 text-red-700 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <X className="h-3 w-3" />
          Non
        </button>
      </div>
    </div>
  );
}
