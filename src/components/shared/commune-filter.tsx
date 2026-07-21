"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, Check, ChevronDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CommuneFilterProps {
  value: string;
  onChange: (value: string) => void;
  /** Optional wilaya scope — narrows the options to that wilaya. */
  wilaya?: string;
  placeholder?: string;
}

/**
 * Commune filter for list pages.
 *
 * Unlike CommuneCombobox (data entry, driven by the official COMMUNES_BY_WILAYA
 * list), this one loads the communes that actually have contacts, so the filter
 * never offers a commune that would return zero results. Territory scoping is
 * applied server-side for délégués.
 */
export function CommuneFilter({
  value,
  onChange,
  wilaya,
  placeholder = "Toutes les communes",
}: CommuneFilterProps) {
  const [communes, setCommunes] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (wilaya) params.set("wilaya", wilaya);
    fetch(`/api/doctors/communes?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setCommunes(Array.isArray(d.data) ? d.data : []);
      })
      .catch(() => {
        if (!cancelled) setCommunes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wilaya]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return communes;
    return communes.filter((c) => c.toLowerCase().includes(q));
  }, [communes, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!wrapRef.current?.contains(e.relatedTarget as Node)) close();
  };

  return (
    <div ref={wrapRef} className="relative" onBlur={handleBlur}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "cursor-pointer"
        )}
      >
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span
          className={cn(
            "flex-1 truncate text-left",
            !value && "text-muted-foreground"
          )}
        >
          {value || placeholder}
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Effacer la commune"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="cursor-pointer rounded text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 shrink-0" />
          </span>
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
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

          <div className="max-h-52 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange("");
                close();
              }}
              className="flex w-full items-center px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/10 cursor-pointer"
            >
              {placeholder}
            </button>

            {loading ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                Chargement…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                Aucune commune trouvée
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    onChange(c);
                    close();
                  }}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-accent/10 cursor-pointer"
                >
                  <span className="truncate">{c}</span>
                  {value === c && (
                    <Check className="h-4 w-4 shrink-0 text-accent" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
