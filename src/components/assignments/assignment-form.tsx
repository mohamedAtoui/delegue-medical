"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DeadlineSelect } from "./deadline-select";
import { toast } from "sonner";
import {
  Search,
  Stethoscope,
  Pill,
  MapPin,
  Loader2,
  CalendarCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doctor, VisitAssignmentWithDetails } from "@/types";

interface AssignmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assigneeId: string;
  /** If provided, edit mode */
  assignment?: VisitAssignmentWithDetails | null;
  onSuccess: () => void;
}

export function AssignmentForm({
  open,
  onOpenChange,
  assigneeId,
  assignment,
  onSuccess,
}: AssignmentFormProps) {
  const isEdit = !!assignment;

  const [search, setSearch] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [deadline, setDeadline] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill in edit mode
  useEffect(() => {
    if (open && assignment) {
      setSelectedDoctor(assignment.doctor);
      setDeadline(assignment.deadline);
      setNote(assignment.note || "");
      setSearch("");
      setDoctors([]);
    } else if (open) {
      setSelectedDoctor(null);
      setDeadline("");
      setNote("");
      setSearch("");
      setDoctors([]);
    }
  }, [open, assignment]);

  // Doctor search
  const searchDoctors = useCallback(async (q: string) => {
    if (!q.trim()) {
      setDoctors([]);
      return;
    }
    setLoadingDoctors(true);
    try {
      const res = await fetch(`/api/doctors?search=${encodeURIComponent(q)}&limit=8`);
      const data = await res.json();
      setDoctors(data.data || []);
    } finally {
      setLoadingDoctors(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchDoctors(search), 300);
    return () => clearTimeout(t);
  }, [search, searchDoctors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDoctor) {
      toast.error("Sélectionnez un médecin ou pharmacien");
      return;
    }
    if (!deadline) {
      toast.error("Sélectionnez une date limite");
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit && assignment) {
        const res = await fetch(`/api/assignments/${assignment.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            doctor_id: selectedDoctor.id,
            deadline,
            note: note || null,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error);
        }
        toast.success("Planification mise à jour");
      } else {
        const res = await fetch("/api/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignee_id: assigneeId,
            doctor_id: selectedDoctor.id,
            deadline,
            note: note || null,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error);
        }
        toast.success("Visite planifiée");
      }
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de la sauvegarde"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            {isEdit ? "Modifier la planification" : "Planifier une visite"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Doctor selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground/80">
              Médecin / Pharmacien
            </label>

            {selectedDoctor ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    selectedDoctor.doctor_type === "pharmacien"
                      ? "bg-accent/10"
                      : "bg-primary/10"
                  )}
                >
                  {selectedDoctor.doctor_type === "pharmacien" ? (
                    <Pill className="h-4 w-4 text-accent" />
                  ) : (
                    <Stethoscope className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {selectedDoctor.doctor_type === "pharmacien" ? "" : "Dr. "}
                    {selectedDoctor.last_name} {selectedDoctor.first_name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {selectedDoctor.specialty && (
                      <span>{selectedDoctor.specialty}</span>
                    )}
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" />
                      {selectedDoctor.wilaya}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDoctor(null)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher par nom..."
                    className="pl-9"
                    autoFocus
                  />
                </div>
                {loadingDoctors && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!loadingDoctors && doctors.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-border/50 divide-y divide-border/30">
                    {doctors.map((doc) => {
                      const isPharm = doc.doctor_type === "pharmacien";
                      return (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => {
                            setSelectedDoctor(doc);
                            setSearch("");
                            setDoctors([]);
                          }}
                          className="w-full flex items-center gap-3 p-2.5 hover:bg-muted/40 transition-colors cursor-pointer text-left"
                        >
                          <div
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                              isPharm ? "bg-accent/10" : "bg-primary/10"
                            )}
                          >
                            {isPharm ? (
                              <Pill className="h-3.5 w-3.5 text-accent" />
                            ) : (
                              <Stethoscope className="h-3.5 w-3.5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {isPharm ? "" : "Dr. "}
                              {doc.last_name} {doc.first_name}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              {doc.specialty && <span>{doc.specialty}</span>}
                              <span className="flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" />
                                {doc.wilaya}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {!loadingDoctors && search.length > 1 && doctors.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Aucun résultat
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Deadline */}
          <DeadlineSelect value={deadline} onChange={setDeadline} />

          {/* Note */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground/80">
              Note (optionnel)
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Instructions ou contexte pour la visite..."
              className="min-h-[70px] resize-none"
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={submitting || !selectedDoctor || !deadline}
            className="w-full cursor-pointer"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CalendarCheck className="h-4 w-4 mr-2" />
            )}
            {isEdit ? "Mettre à jour" : "Planifier la visite"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
