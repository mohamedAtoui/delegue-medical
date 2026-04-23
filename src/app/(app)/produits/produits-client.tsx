"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Search,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

interface ProductForm {
  name: string;
  description: string;
  reference: string;
  laboratory: string;
  quantity: string;
  price: string;
  notes: string;
  active: boolean;
}

const emptyForm: ProductForm = {
  name: "",
  description: "",
  reference: "",
  laboratory: "",
  quantity: "",
  price: "",
  notes: "",
  active: true,
};

export function ProduitsClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products?include_inactive=true");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name || "",
      description: p.description || "",
      reference: p.reference || "",
      laboratory: p.laboratory || "",
      quantity: p.quantity != null ? String(p.quantity) : "",
      price: p.price != null ? String(p.price) : "",
      notes: p.notes || "",
      active: p.active,
    });
    setFormOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/products/${editing.id}` : "/api/products";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.success(editing ? "Produit modifié" : "Produit ajouté");
      setFormOpen(false);
      fetchProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/products/${deleteId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.success("Produit supprimé");
      fetchProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setDeleteId(null);
    }
  };

  const filtered = products.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.reference?.toLowerCase().includes(q) ?? false) ||
      (p.laboratory?.toLowerCase().includes(q) ?? false)
    );
  });

  const totalActive = products.filter((p) => p.active).length;
  const lowStock = products.filter(
    (p) => p.active && p.quantity != null && p.quantity > 0 && p.quantity < 10
  ).length;
  const outOfStock = products.filter(
    (p) => p.active && p.quantity != null && p.quantity === 0
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produits</h1>
          <p className="text-sm text-muted-foreground">
            Gérer le catalogue de produits et le stock
          </p>
        </div>
        <Button onClick={openCreate} className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un produit
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalActive}</p>
                <p className="text-xs text-muted-foreground">Produits actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{lowStock}</p>
                <p className="text-xs text-muted-foreground">Stock faible (&lt; 10)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{outOfStock}</p>
                <p className="text-xs text-muted-foreground">En rupture</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, référence, laboratoire…"
          className="pl-9"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              {search ? "Aucun résultat" : "Aucun produit. Ajoutez le premier !"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const stockStatus =
              p.quantity == null
                ? null
                : p.quantity === 0
                ? "out"
                : p.quantity < 10
                ? "low"
                : "ok";
            return (
              <Card
                key={p.id}
                className={cn(
                  "transition-colors",
                  !p.active && "opacity-60"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{p.name}</span>
                          {p.reference && (
                            <Badge variant="outline" className="text-[10px]">
                              {p.reference}
                            </Badge>
                          )}
                          {p.laboratory && (
                            <Badge variant="secondary" className="text-[10px]">
                              {p.laboratory}
                            </Badge>
                          )}
                          {!p.active && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Inactif
                            </Badge>
                          )}
                        </div>
                        {p.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {p.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                          {p.quantity != null && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 font-medium",
                                stockStatus === "out"
                                  ? "text-red-600"
                                  : stockStatus === "low"
                                  ? "text-amber-600"
                                  : "text-green-700"
                              )}
                            >
                              {stockStatus === "ok" ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <AlertTriangle className="h-3 w-3" />
                              )}
                              Stock : {p.quantity}
                            </span>
                          )}
                          {p.price != null && (
                            <span className="text-foreground/70">
                              Prix : {p.price.toLocaleString("fr-FR")} DA
                            </span>
                          )}
                        </div>
                        {p.notes && (
                          <p className="text-[11px] text-muted-foreground mt-1.5 italic">
                            {p.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(p.id)}
                        className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors cursor-pointer"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier le produit" : "Nouveau produit"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="p-name">Nom *</Label>
                <Input
                  id="p-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Synapgen 500mg"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-ref">Référence / Code</Label>
                <Input
                  id="p-ref"
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  placeholder="REF-001"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-lab">Laboratoire</Label>
                <Input
                  id="p-lab"
                  value={form.laboratory}
                  onChange={(e) => setForm({ ...form, laboratory: e.target.value })}
                  placeholder="Ex: Handson"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-qty">Quantité en stock</Label>
                <Input
                  id="p-qty"
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-price">Prix unitaire (DA)</Label>
                <Input
                  id="p-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="p-desc">Description</Label>
                <Textarea
                  id="p-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Indication, dosage, présentation..."
                  className="min-h-[70px]"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="p-notes">Notes internes</Label>
                <Textarea
                  id="p-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Remarques pour l'équipe..."
                  className="min-h-[60px]"
                />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  id="p-active"
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 rounded border-border cursor-pointer"
                />
                <Label htmlFor="p-active" className="cursor-pointer">
                  Produit actif (visible pour les délégués)
                </Label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              className="cursor-pointer"
            >
              Annuler
            </Button>
            <Button onClick={submit} disabled={saving} className="cursor-pointer">
              {saving ? "Sauvegarde..." : editing ? "Enregistrer" : "Ajouter"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le produit sera définitivement supprimé du catalogue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 cursor-pointer"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
