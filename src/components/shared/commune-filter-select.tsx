"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CommuneFilterSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Scope the options to a wilaya (optional). */
  wilaya?: string;
  placeholder?: string;
}

/**
 * Searchable commune filter. Options come from the communes that actually have
 * contacts (optionally scoped to a wilaya), so the filter never offers a
 * commune that would return zero visits.
 */
export function CommuneFilterSelect({
  value,
  onValueChange,
  wilaya,
  placeholder = "Toutes les communes",
}: CommuneFilterSelectProps) {
  const [communes, setCommunes] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

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

  // Close on outside click.
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
    if (!q) return communes;
    return communes.filter((c) => c.toLowerCase().includes(q));
  }, [communes, search]);

  return (
    <div className="relative w-full" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors cursor-pointer",
          "hover:border-primary/40"
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

      {open && (
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
            <button
              type="button"
              onClick={() => {
                onValueChange("");
                setOpen(false);
                setSearch("");
              }}
              className="w-full px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/10 cursor-pointer"
            >
              {placeholder}
            </button>

            {loading ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Chargement…
              </div>
            ) : filtered.length === 0 ? (
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
