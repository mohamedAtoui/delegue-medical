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
import { toast } from "sonner";
import type { Doctor } from "@/types";

export type GrossisteOption = Pick<Doctor, "id" | "last_name" | "wilaya">;

interface GrossisteMultiSelectProps {
  label: string;
  value: GrossisteOption[];
  onChange: (next: GrossisteOption[]) => void;
}

/**
 * "One grossiste per row" picker over the grossiste directory
 * (doctor_type='grossiste'), with an inline quick-add for a brand-new
 * grossiste (name + wilaya). Used in the pharmacy visit form and the doctor
 * form. Selecting a grossiste that isn't in the list yet is a two-step: type
 * the name, then "Créer".
 */
export function GrossisteMultiSelect({
  label,
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

  const add = (g: GrossisteOption) => {
    if (!selectedIds.has(g.id)) onChange([...value, g]);
    setSearch("");
    setOpen(false);
    setResults([]);
  };
  const remove = (id: string) => onChange(value.filter((g) => g.id !== id));

  const openCreate = () => {
    setNewName(search.trim());
    setNewWilaya("");
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
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error);
      }
      const created: Doctor = await res.json();
      add({ id: created.id, last_name: created.last_name, wilaya: created.wilaya });
      toast.success("Grossiste ajouté");
      setShowCreate(false);
      setNewName("");
      setNewWilaya("");
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

      {/* Selected grossistes — one per row */}
      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
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
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg">
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
              <WilayaSelect value={newWilaya} onValueChange={setNewWilaya} />
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
