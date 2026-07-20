"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { COMMUNES_BY_WILAYA } from "@/lib/constants/communes";
import { cn } from "@/lib/utils";

interface CommuneSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Communes are scoped to this wilaya. */
  wilaya: string;
  placeholder?: string;
}

/**
 * Data-entry commune picker: a searchable list of the official communes of the
 * selected wilaya, so contacts can't be saved with free-text spellings
 * ("BBA" / "Bba" / "Bordj Bou Arreridj" for the same place).
 *
 * An existing value that isn't in the official list is preserved and shown at
 * the top as "(actuel)" so editing a legacy contact never silently drops it.
 */
export function CommuneSelect({
  value,
  onValueChange,
  wilaya,
  placeholder = "Sélectionner une commune",
}: CommuneSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const options = useMemo(
    () => (wilaya ? COMMUNES_BY_WILAYA[wilaya] ?? [] : []),
    [wilaya]
  );

  // A legacy/free-text value that isn't part of the official list.
  const isCustom = !!value && !options.includes(value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((c) => c.toLowerCase().includes(q));
  }, [options, search]);

  const disabled = !wilaya;

  return (
    <div className="relative w-full" ref={boxRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors",
          disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:border-primary/40"
        )}
      >
        <span
          className={cn(
            "flex-1 truncate text-left",
            !value && "text-muted-foreground"
          )}
        >
          {value || (disabled ? "Sélectionnez d'abord une wilaya" : placeholder)}
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Effacer la commune"
            onClick={(e) => {
              e.stopPropagation();
              onValueChange("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onValueChange("");
              }
            }}
            className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {isCustom && (
        <p className="mt-1 text-xs text-amber-600">
          «{value}» ne fait pas partie de la liste officielle — choisissez la
          commune correspondante pour normaliser.
        </p>
      )}

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg">
          <div className="relative border-b border-border p-2">
            <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une commune..."
              className="h-8 pl-7 text-sm"
            />
          </div>

          <div className="max-h-56 overflow-y-auto">
            {isCustom && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full bg-amber-50 px-3 py-2 text-left text-sm text-amber-700 cursor-pointer"
              >
                {value} <span className="text-xs">(actuel)</span>
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Aucune commune
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    onValueChange(c);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent/10 cursor-pointer",
                    c === value && "bg-accent/10 font-medium text-accent"
                  )}
                >
                  {c}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
