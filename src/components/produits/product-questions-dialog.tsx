"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
  Product,
  ProductQuestion,
  QuestionInputType,
  QuestionTargetRole,
  VisibleWhenRule,
} from "@/types";

interface ProductQuestionsDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INPUT_TYPE_LABELS: Record<QuestionInputType, string> = {
  yes_no: "Oui/Non",
  short_text: "Texte court",
  textarea: "Texte long",
  number: "Nombre",
};

const TABS: { value: QuestionTargetRole; label: string }[] = [
  { value: "medecin", label: "Médecin" },
  { value: "pharmacien", label: "Pharmacien" },
];

interface DraftRow {
  label: string;
  input_type: QuestionInputType;
  required: boolean;
  visible_when: VisibleWhenRule | null;
}

const emptyDraft: DraftRow = {
  label: "",
  input_type: "yes_no",
  required: false,
  visible_when: null,
};

export function ProductQuestionsDialog({
  product,
  open,
  onOpenChange,
}: ProductQuestionsDialogProps) {
  const [tab, setTab] = useState<QuestionTargetRole>("medecin");
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftRow>(emptyDraft);
  const [addingDraft, setAddingDraft] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const reload = useCallback(async () => {
    if (!product) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${product.id}/questions`);
      const data = await res.json();
      setQuestions(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [product]);

  useEffect(() => {
    if (open && product) {
      setTab("medecin");
      setDraft(emptyDraft);
      setAddingDraft(false);
      reload();
    }
  }, [open, product, reload]);

  const byRole = useMemo(() => {
    const map: Record<QuestionTargetRole, ProductQuestion[]> = {
      medecin: [],
      pharmacien: [],
    };
    for (const q of questions) {
      map[q.target_role].push(q);
    }
    map.medecin.sort((a, b) => a.display_order - b.display_order);
    map.pharmacien.sort((a, b) => a.display_order - b.display_order);
    return map;
  }, [questions]);

  const currentList = byRole[tab];

  const patch = async (id: string, update: Partial<ProductQuestion>) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/product-questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }
      const saved = (await res.json()) as ProductQuestion;
      setQuestions((prev) => prev.map((q) => (q.id === id ? saved : q)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      reload();
    } finally {
      setBusyId(null);
    }
  };

  const move = async (id: string, direction: -1 | 1) => {
    if (!product) return;
    const list = byRole[tab];
    const idx = list.findIndex((q) => q.id === id);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= list.length) return;

    const reordered = [...list];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];

    // Optimistic update
    const ids = reordered.map((q) => q.id);
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.target_role !== tab) return q;
        const newIndex = ids.indexOf(q.id);
        return newIndex >= 0 ? { ...q, display_order: newIndex } : q;
      })
    );

    setBusyId(id);
    try {
      const res = await fetch(
        `/api/products/${product.id}/questions/reorder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ordered_ids: ids }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      reload();
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setBusyId(deleteId);
    try {
      const res = await fetch(`/api/product-questions/${deleteId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }
      toast.success("Question supprimée");
      setQuestions((prev) => prev.filter((q) => q.id !== deleteId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusyId(null);
      setDeleteId(null);
    }
  };

  const addDraft = async () => {
    if (!product) return;
    const label = draft.label.trim();
    if (!label) {
      toast.error("Le libellé est requis");
      return;
    }
    setSavingDraft(true);
    try {
      const res = await fetch(`/api/products/${product.id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          input_type: draft.input_type,
          required: draft.required,
          target_role: tab,
          visible_when: draft.visible_when,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }
      const created = (await res.json()) as ProductQuestion;
      setQuestions((prev) => [...prev, created]);
      setDraft(emptyDraft);
      setAddingDraft(false);
      toast.success("Question ajoutée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingDraft(false);
    }
  };

  if (!product) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Questions — {product.name}</DialogTitle>
          </DialogHeader>

          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as QuestionTargetRole);
              setDraft(emptyDraft);
              setAddingDraft(false);
            }}
          >
            <TabsList className="w-full">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="flex-1">
                  {t.label}
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {byRole[t.value].length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {TABS.map((t) => (
              <TabsContent key={t.value} value={t.value} className="pt-3">
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-16 rounded-lg bg-muted/40 animate-pulse"
                      />
                    ))}
                  </div>
                ) : currentList.length === 0 && !addingDraft ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Aucune question pour ce type de visite.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentList.map((q, idx) => (
                      <QuestionRow
                        key={q.id}
                        question={q}
                        index={idx}
                        total={currentList.length}
                        siblings={currentList}
                        busy={busyId === q.id}
                        onPatch={patch}
                        onMove={move}
                        onDelete={() => setDeleteId(q.id)}
                      />
                    ))}
                  </div>
                )}

                {addingDraft ? (
                  <div className="mt-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Libellé *</Label>
                      <Input
                        value={draft.label}
                        onChange={(e) =>
                          setDraft({ ...draft, label: e.target.value })
                        }
                        placeholder="Posez votre question..."
                        autoFocus
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={draft.input_type}
                          onValueChange={(v) =>
                            setDraft({
                              ...draft,
                              input_type: v as QuestionInputType,
                            })
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(INPUT_TYPE_LABELS).map(
                              ([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs mt-5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draft.required}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              required: e.target.checked,
                            })
                          }
                          className="h-3.5 w-3.5 cursor-pointer"
                        />
                        Obligatoire
                      </label>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDraft(emptyDraft);
                          setAddingDraft(false);
                        }}
                        disabled={savingDraft}
                        className="cursor-pointer"
                      >
                        Annuler
                      </Button>
                      <Button
                        size="sm"
                        onClick={addDraft}
                        disabled={savingDraft}
                        className="cursor-pointer"
                      >
                        {savingDraft ? "..." : "Ajouter"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setAddingDraft(true)}
                    className="mt-3 cursor-pointer w-full"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter une question
                  </Button>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette question ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les réponses déjà enregistrées pour d&apos;anciennes visites restent
              visibles. La question n&apos;apparaîtra plus dans le formulaire.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 cursor-pointer"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface QuestionRowProps {
  question: ProductQuestion;
  index: number;
  total: number;
  siblings: ProductQuestion[];
  busy: boolean;
  onPatch: (id: string, update: Partial<ProductQuestion>) => Promise<void>;
  onMove: (id: string, direction: -1 | 1) => Promise<void>;
  onDelete: () => void;
}

function QuestionRow({
  question,
  index,
  total,
  siblings,
  busy,
  onPatch,
  onMove,
  onDelete,
}: QuestionRowProps) {
  // Local editable copy that resyncs when the server returns a new label
  // (e.g. after a PATCH). The "adjust state during render" pattern avoids
  // the cascading-render penalty of doing this inside useEffect.
  const [label, setLabel] = useState(question.label);
  const [lastSynced, setLastSynced] = useState(question.label);
  if (lastSynced !== question.label) {
    setLastSynced(question.label);
    setLabel(question.label);
  }

  const yesNoParents = siblings.filter(
    (s) =>
      s.id !== question.id &&
      s.input_type === "yes_no" &&
      s.display_order < question.display_order
  );

  const currentParentId =
    question.visible_when?.op === "eq"
      ? question.visible_when.question_id
      : "";
  const currentValue =
    question.visible_when?.op === "eq" && typeof question.visible_when.value === "boolean"
      ? question.visible_when.value
      : null;

  const commitLabel = () => {
    const trimmed = label.trim();
    if (!trimmed || trimmed === question.label) {
      setLabel(question.label);
      return;
    }
    onPatch(question.id, { label: trimmed });
  };

  const setVisibleWhen = (parentId: string, value: boolean | null) => {
    const rule: VisibleWhenRule | null =
      parentId && value !== null
        ? { op: "eq", question_id: parentId, value }
        : null;
    onPatch(question.id, { visible_when: rule });
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-background p-3 space-y-2",
        busy && "opacity-60"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-0.5 pt-0.5">
          <button
            type="button"
            onClick={() => onMove(question.id, -1)}
            disabled={busy || index === 0}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Monter"
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onMove(question.id, 1)}
            disabled={busy || index === total - 1}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Descendre"
          >
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitLabel();
          }}
          disabled={busy}
          className="flex-1"
        />
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Supprimer"
          title="Supprimer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap pl-5 text-xs">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select
            value={question.input_type}
            onValueChange={(v) =>
              onPatch(question.id, {
                input_type: v as QuestionInputType,
              })
            }
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(INPUT_TYPE_LABELS).map(([value, lbl]) => (
                <SelectItem key={value} value={value}>
                  {lbl}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={question.required}
            onChange={(e) =>
              onPatch(question.id, { required: e.target.checked })
            }
            disabled={busy}
            className="h-3.5 w-3.5 cursor-pointer"
          />
          Obligatoire
        </label>

        {yesNoParents.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Affichée si
            </Label>
            <Select
              value={currentParentId || "__none__"}
              onValueChange={(v) => {
                if (!v || v === "__none__") {
                  setVisibleWhen("", null);
                } else {
                  // Default to "Oui" when picking a parent for the first
                  // time; user can flip below.
                  setVisibleWhen(v, currentValue ?? true);
                }
              }}
            >
              <SelectTrigger className="h-7 text-xs max-w-52">
                <SelectValue placeholder="Toujours" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Toujours afficher</SelectItem>
                {yesNoParents.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label.length > 40
                      ? p.label.slice(0, 40) + "…"
                      : p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentParentId && (
              <Select
                value={currentValue === false ? "false" : "true"}
                onValueChange={(v) =>
                  setVisibleWhen(currentParentId, v === "true")
                }
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">= Oui</SelectItem>
                  <SelectItem value="false">= Non</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
