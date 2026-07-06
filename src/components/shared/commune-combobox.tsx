"use client";

import { useMemo, useRef, useState } from "react";
import { MapPin, Search, Check, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { COMMUNES_BY_WILAYA } from "@/lib/constants/communes";
import { cn } from "@/lib/utils";

interface CommuneComboboxProps {
  /** Selected wilaya name — drives which communes are selectable. */
  wilaya: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

/**
 * Deterministic commune picker driven by the chosen wilaya. The value can only
 * be one of the wilaya's official communes (COMMUNES_BY_WILAYA) — there is no
 * free-text entry — so commune data stays consistent. Searchable because some
 * wilayas have 50+ communes.
 */
export function CommuneCombobox({
  wilaya,
  value,
  onChange,
  placeholder = "Sélectionner une commune",
  id,
}: CommuneComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const communes = useMemo(
    () => (wilaya ? COMMUNES_BY_WILAYA[wilaya] ?? [] : []),
    [wilaya]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return communes;
    return communes.filter((c) => c.toLowerCase().includes(q));
  }, [communes, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  // Close when focus leaves the whole widget.
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!wrapRef.current?.contains(e.relatedTarget as Node)) close();
  };

  const select = (commune: string) => {
    onChange(commune);
    close();
  };

  return (
    <div ref={wrapRef} className="relative" onBlur={handleBlur}>
      <button
        type="button"
        id={id}
        disabled={!wilaya}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
        )}
      >
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span
          className={cn(
            "flex-1 truncate text-left",
            !value && "text-muted-foreground"
          )}
        >
          {wilaya ? value || placeholder : "Choisir d'abord une wilaya"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && wilaya && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="relative border-b border-border">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une commune..."
              className="h-9 rounded-b-none border-0 pl-9 focus-visible:ring-0"
            />
          </div>
          {filtered.length > 0 ? (
            <div className="max-h-52 overflow-y-auto py-1">
              {filtered.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => select(c)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-accent/10 cursor-pointer"
                >
                  <span className="truncate">{c}</span>
                  {value === c && (
                    <Check className="h-4 w-4 shrink-0 text-accent" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Aucune commune trouvée
            </div>
          )}
        </div>
      )}
    </div>
  );
}
