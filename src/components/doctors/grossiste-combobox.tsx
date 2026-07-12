"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Truck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { WilayaSelect } from "@/components/shared/wilaya-select";
import { CommuneCombobox } from "@/components/shared/commune-combobox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Doctor, GrossisteCategory } from "@/types";

/**
 * A grossiste can supply a pharmacy with pharma products, para-pharm products,
 * or both. The DB stores one `(grossiste_id, category)` row per category, so
 * "both" is simply two rows. In the UI we collapse that into a single choice.
 */
export type SelectedCategory = GrossisteCategory | "both";

export interface SelectedGrossiste {
  id: string;
  last_name: string;
  wilaya: string;
  category: SelectedCategory;
}

type GrossisteOption = Pick<Doctor, "id" | "last_name" | "wilaya">;
// Kept for backward-compat imports.
export type { GrossisteOption };

const CATEGORY_OPTIONS: { value: SelectedCategory; label: string }[] = [
  { value: "pharma", label: "Pharma" },
  { value: "para_pharm", label: "Para-Pharm" },
  { value: "both", label: "Les deux" },
];

/** Expand UI selections into flat `(grossiste_id, category)` link rows. */
export function expandGrossisteSelection(
  items: SelectedGrossiste[]
): { grossiste_id: string; category: GrossisteCategory }[] {
  return items.flatMap((g) => {
    const cats: GrossisteCategory[] =
      g.category === "both" ? ["pharma", "para_pharm"] : [g.category];
    return cats.map((category) => ({ grossiste_id: g.id, category }));
  });
}

/** Collapse flat link rows (one per category) back into UI selections. */
export function collapseGrossisteLinks(
  links: {
    grossiste_id: string;
    category: GrossisteCategory;
    grossiste?: Pick<Doctor, "id" | "last_name" | "wilaya"> | null;
  }[]
): SelectedGrossiste[] {
  const byId = new Map<
    string,
    { last_name: string; wilaya: string; cats: Set<GrossisteCategory> }
  >();
  for (const l of links) {
    const entry = byId.get(l.grossiste_id) ?? {
      last_name: l.grossiste?.last_name ?? "Grossiste",
      wilaya: l.grossiste?.wilaya ?? "",
      cats: new Set<GrossisteCategory>(),
    };
    entry.cats.add(l.category);
    byId.set(l.grossiste_id, entry);
  }
  return [...byId.entries()].map(([id, e]) => ({
    id,
    last_name: e.last_name,
    wilaya: e.wilaya,
    category:
      e.cats.has("pharma") && e.cats.has("para_pharm")
        ? "both"
        : e.cats.has("pharma")
        ? "pharma"
        : "para_pharm",
  }));
}

interface GrossisteMultiSelectProps {
  /** Optional heading; defaults to "Grossistes". */
  label?: string;
  value: SelectedGrossiste[];
  onChange: (next: SelectedGrossiste[]) => void;
}

/** Three-way segmented control for a grossiste's supply category. */
function CategorySelect({
  value,
  onChange,
}: {
  value: SelectedCategory;
  onChange: (next: SelectedCategory) => void;
}) {
  return (
    <div className="flex rounded-md border border-border bg-background p-0.5">
      {CATEGORY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded px-2 py-1 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap",
            value === opt.value
              ? "bg-accent/15 text-accent"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Single-box picker over the grossiste directory (doctor_type='grossiste').
 * Each selected grossiste carries a supply category — Pharma, Para-Pharm, or
 * Les deux — editable inline. Includes an inline quick-add (name + wilaya +
 * category) for a brand-new grossiste. Used in the pharmacy visit form and the
 * doctor form.
 */
export function GrossisteMultiSelect({
  label = "Grossistes",
  value,
  onChange,
}: GrossisteMultiSelectProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<GrossisteOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newWilaya, setNewWilaya] = useState("");
  const [newCommune, setNewCommune] = useState("");
  const [newCategory, setNewCategory] = useState<SelectedCategory>("both");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (search.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ type: "grossiste", search });
        const res = await fetch(`/api/doctors?${params}`);
        const data = await res.json();
        setResults(
          (data.data || []).map((d: Doctor) => ({
            id: d.id,
            last_name: d.last_name,
            wilaya: d.wilaya,
          }))
        );
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const selectedIds = new Set(value.map((g) => g.id));

  const add = (g: GrossisteOption, category: SelectedCategory = "both") => {
    if (!selectedIds.has(g.id))
      onChange([...value, { ...g, category }]);
    setSearch("");
    setOpen(false);
    setResults([]);
  };
  const remove = (id: string) => onChange(value.filter((g) => g.id !== id));
  const setCategory = (id: string, category: SelectedCategory) =>
    onChange(value.map((g) => (g.id === id ? { ...g, category } : g)));

  const openCreate = () => {
    setNewName(search.trim());
    setNewWilaya("");
    setNewCommune("");
    setNewCategory("both");
    setShowCreate(true);
    setOpen(false);
  };

  const createGrossiste = async () => {
    if (!newName.trim()) {
      toast.error("Nom du grossiste requis");
      return;
    }
    if (!newWilaya) {
      toast.error("Wilaya requise");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: "",
          last_name: newName.trim(),
          doctor_type: "grossiste",
          wilaya: newWilaya,
          commune: newCommune.trim() || null,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error);
      }
      const created: Doctor = await res.json();
      add(
        { id: created.id, last_name: created.last_name, wilaya: created.wilaya },
        newCategory
      );
      toast.success("Grossiste ajouté");
      setShowCreate(false);
      setNewName("");
      setNewWilaya("");
      setNewCommune("");
      setNewCategory("both");
      setSearch("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'ajout");
    } finally {
      setCreating(false);
    }
  };

  const visibleResults = results.filter((r) => !selectedIds.has(r.id));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {/* Selected grossistes — one per row, with a category picker each */}
      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((g) => (
            <div
              key={g.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10">
                <Truck className="h-3.5 w-3.5 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{g.last_name}</p>
                {g.wilaya && (
                  <p className="truncate text-xs text-muted-foreground">
                    {g.wilaya}
                  </p>
                )}
              </div>
              <CategorySelect
                value={g.category}
                onChange={(c) => setCategory(g.id, c)}
              />
              <button
                type="button"
                onClick={() => remove(g.id)}
                className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                aria-label="Retirer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search + add */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher ou ajouter un grossiste..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => search.length >= 2 && setOpen(true)}
            className="pl-9"
          />
        </div>

        {open && search.length >= 2 && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
            {loading ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                Recherche...
              </div>
            ) : visibleResults.length > 0 ? (
              <div className="max-h-52 overflow-y-auto">
                {visibleResults.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/10 cursor-pointer"
                    onClick={() => add(g)}
                  >
                    <Truck className="h-4 w-4 shrink-0 text-accent" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {g.last_name}
                      </p>
                      {g.wilaya && (
                        <p className="truncate text-xs text-muted-foreground">
                          {g.wilaya}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                Aucun grossiste trouvé
              </div>
            )}

            <div className="border-t border-border">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-primary transition-colors hover:bg-accent/10 cursor-pointer"
                onClick={openCreate}
              >
                <Plus className="h-4 w-4" />
                Créer le grossiste «{search.trim()}»
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Explicit add button — create a brand-new grossiste in one tap,
          without having to type in the search first. */}
      <button
        type="button"
        onClick={openCreate}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2 text-sm font-medium text-primary transition-colors hover:bg-accent/10 cursor-pointer"
      >
        <Plus className="h-4 w-4" />
        Ajouter un nouveau grossiste
      </button>

      {/* Quick-add dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau grossiste</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="grossiste-name">Nom *</Label>
              <Input
                id="grossiste-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nom du grossiste"
              />
            </div>
            <div className="space-y-2">
              <Label>Wilaya *</Label>
              <WilayaSelect
                value={newWilaya}
                onValueChange={(v) => {
                  setNewWilaya(v);
                  setNewCommune("");
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Commune</Label>
              <CommuneCombobox
                wilaya={newWilaya}
                value={newCommune}
                onChange={setNewCommune}
              />
            </div>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <CategorySelect value={newCategory} onChange={setNewCategory} />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreate(false)}
              className="cursor-pointer"
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={createGrossiste}
              disabled={creating}
              className="cursor-pointer"
            >
              {creating ? "Ajout..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
