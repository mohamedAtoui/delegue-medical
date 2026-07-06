"use client";

import { useMemo, useRef, useState } from "react";
import { MapPin, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { COMMUNES_BY_WILAYA } from "@/lib/constants/communes";
import { cn } from "@/lib/utils";

interface CommuneComboboxProps {
  /** Selected wilaya name — drives which communes are suggested. */
  wilaya: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

/**
 * Commune picker driven by the chosen wilaya. Suggests communes from
 * COMMUNES_BY_WILAYA but is a "select or type" field: the user can always type
 * a commune that isn't in the list (or when the wilaya has no list yet), so
 * incomplete seed data never blocks entry.
 */
export function CommuneCombobox({
  wilaya,
  value,
  onChange,
  placeholder = "Commune",
  id,
}: CommuneComboboxProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const communes = useMemo(
    () => (wilaya ? COMMUNES_BY_WILAYA[wilaya] ?? [] : []),
    [wilaya]
  );

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return communes;
    return communes.filter((c) => c.toLowerCase().includes(q));
  }, [communes, value]);

  // Close when focus leaves the whole widget.
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!wrapRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
  };

  const hasSuggestions = filtered.length > 0;

  return (
    <div ref={wrapRef} className="relative" onBlur={handleBlur}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={
            wilaya ? placeholder : "Choisir d'abord une wilaya"
          }
          disabled={!wilaya}
          className="pl-9"
          autoComplete="off"
        />
      </div>

      {open && wilaya && hasSuggestions && (
        <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          {filtered.map((c) => (
            <button
              key={c}
              type="button"
              className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-accent/10 cursor-pointer"
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
            >
              <span className="truncate">{c}</span>
              {value.trim().toLowerCase() === c.toLowerCase() && (
                <Check className="h-4 w-4 shrink-0 text-accent" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
