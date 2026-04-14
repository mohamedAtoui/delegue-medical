"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DoctorSearch } from "@/components/doctors/doctor-search";
import { DoctorForm } from "@/components/doctors/doctor-form";
import { DoctorVisitTimeline } from "@/components/visits/doctor-visit-timeline";
import { DeadlineSelect } from "@/components/assignments/deadline-select";
import { YesNoToggle } from "@/components/visits/yes-no-toggle";
import { toast } from "sonner";
import { Send, Stethoscope, Pill, CalendarCheck, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doctor, VisitType } from "@/types";

interface VisitFormProps {
  onSuccess: () => void;
}

type MedecinForm = {
  objective: string;
  compte_rendu: string;
  synapgen_solves: boolean | null;
  already_prescribed: boolean | null;
  promised_to_suggest: boolean | null;
  price_objection: boolean | null;
  prescribes_magnesium: boolean | null;
  magnesium_brand: string;
  fears_side_effects: boolean | null;
  patient_feedback: boolean | null;
  patient_feedback_comment: string;
  ordonnance_return: boolean | null;
  free_sample: boolean | null;
};

type PharmacienForm = {
  compte_rendu: string;
  synapgen_count: string;
  prescriptions_received: string;
  prescribing_doctor: string;
  accepted_order: boolean | null;
};

const emptyMedecin: MedecinForm = {
  objective: "",
  compte_rendu: "",
  synapgen_solves: null,
  already_prescribed: null,
  promised_to_suggest: null,
  price_objection: null,
  prescribes_magnesium: null,
  magnesium_brand: "",
  fears_side_effects: null,
  patient_feedback: null,
  patient_feedback_comment: "",
  ordonnance_return: null,
  free_sample: null,
};

const emptyPharmacien: PharmacienForm = {
  compte_rendu: "",
  synapgen_count: "",
  prescriptions_received: "",
  prescribing_doctor: "",
  accepted_order: null,
};

export function VisitForm({ onSuccess }: VisitFormProps) {
  const [visitType, setVisitType] = useState<VisitType>("medecin");
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [medecinForm, setMedecinForm] = useState<MedecinForm>(emptyMedecin);
  const [pharmacienForm, setPharmacienForm] = useState<PharmacienForm>(emptyPharmacien);
  const [loading, setLoading] = useState(false);
  const [showDoctorForm, setShowDoctorForm] = useState(false);

  // Next visit planning (shown after successful submit)
  const [showNextPlan, setShowNextPlan] = useState(false);
  const [nextPlanDoctor, setNextPlanDoctor] = useState<Doctor | null>(null);
  const [nextDeadline, setNextDeadline] = useState("");
  const [nextNote, setNextNote] = useState("");
  const [savingNext, setSavingNext] = useState(false);

  const switchType = (t: VisitType) => {
    if (t === visitType) return;
    setVisitType(t);
    setDoctor(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!doctor) {
      toast.error(`Veuillez sélectionner un ${visitType === "pharmacien" ? "pharmacien" : "médecin"}`);
      return;
    }

    if (visitType === "medecin") {
      if (!medecinForm.objective.trim()) {
        toast.error("L'objectif de la visite est requis");
        return;
      }
      if (!medecinForm.compte_rendu.trim()) {
        toast.error("Le compte rendu est requis");
        return;
      }
    } else {
      if (!pharmacienForm.compte_rendu.trim()) {
        toast.error("Le commentaire est requis");
        return;
      }
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        doctor_id: doctor.id,
        visit_type: visitType,
      };

      if (visitType === "medecin") {
        Object.assign(payload, {
          objective: medecinForm.objective.trim(),
          compte_rendu: medecinForm.compte_rendu.trim(),
          synapgen_solves: medecinForm.synapgen_solves,
          already_prescribed: medecinForm.already_prescribed,
          promised_to_suggest: medecinForm.promised_to_suggest,
          price_objection: medecinForm.price_objection,
          prescribes_magnesium: medecinForm.prescribes_magnesium,
          magnesium_brand:
            medecinForm.prescribes_magnesium === true
              ? medecinForm.magnesium_brand.trim() || null
              : null,
          fears_side_effects: medecinForm.fears_side_effects,
          patient_feedback: medecinForm.patient_feedback,
          patient_feedback_comment:
            medecinForm.patient_feedback === true
              ? medecinForm.patient_feedback_comment.trim() || null
              : null,
          ordonnance_return: medecinForm.ordonnance_return,
          free_sample: medecinForm.free_sample,
        });
      } else {
        Object.assign(payload, {
          compte_rendu: pharmacienForm.compte_rendu.trim(),
          synapgen_count: pharmacienForm.synapgen_count
            ? parseInt(pharmacienForm.synapgen_count, 10)
            : null,
          prescriptions_received: pharmacienForm.prescriptions_received
            ? parseInt(pharmacienForm.prescriptions_received, 10)
            : null,
          prescribing_doctor: pharmacienForm.prescribing_doctor.trim() || null,
          accepted_order: pharmacienForm.accepted_order,
        });
      }

      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      toast.success("Visite enregistrée");
      // Save doctor ref for next-visit planning, then reset form
      const savedDoctor = doctor;
      setDoctor(null);
      setMedecinForm(emptyMedecin);
      setPharmacienForm(emptyPharmacien);
      // Show next visit planner
      setNextPlanDoctor(savedDoctor);
      setNextDeadline("");
      setNextNote("");
      setShowNextPlan(true);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Type selector */}
        <div className="space-y-2">
          <Label>Type de visite *</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => switchType("medecin")}
              className={cn(
                "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer",
                visitType === "medecin"
                  ? "border-primary bg-primary/5 text-primary font-semibold"
                  : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              <Stethoscope className="h-5 w-5" />
              Médecin
            </button>
            <button
              type="button"
              onClick={() => switchType("pharmacien")}
              className={cn(
                "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer",
                visitType === "pharmacien"
                  ? "border-accent bg-accent/5 text-accent font-semibold"
                  : "border-border text-muted-foreground hover:border-accent/40"
              )}
            >
              <Pill className="h-5 w-5" />
              Pharmacien
            </button>
          </div>
        </div>

        {/* Doctor search */}
        <div className="space-y-2">
          <Label>{visitType === "pharmacien" ? "Pharmacien *" : "Médecin *"}</Label>
          <DoctorSearch
            selectedDoctor={doctor}
            onSelect={setDoctor}
            onCreateNew={() => setShowDoctorForm(true)}
            type={visitType}
          />
        </div>

        {/* Doctor visit history preview */}
        {doctor && (
          <>
            <Separator />
            <DoctorVisitTimeline doctorId={doctor.id} />
            <Separator />
          </>
        )}

        {/* Médecin form */}
        {visitType === "medecin" && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="objective">Objectif de la visite *</Label>
              <Input
                id="objective"
                value={medecinForm.objective}
                onChange={(e) =>
                  setMedecinForm({ ...medecinForm, objective: e.target.value })
                }
                placeholder="Présenter Synapgen, suivre un retour, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="compte_rendu">Compte rendu de la visite *</Label>
              <Textarea
                id="compte_rendu"
                value={medecinForm.compte_rendu}
                onChange={(e) =>
                  setMedecinForm({ ...medecinForm, compte_rendu: e.target.value })
                }
                placeholder="Décrivez le déroulement de la visite..."
                className="min-h-[120px] resize-none"
              />
            </div>

            {/* Checklist */}
            <Card className="bg-muted/20">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground/90">Évaluation</p>

                <YesNoToggle
                  label="Synapgen répond-il aux besoins de ses patients ?"
                  value={medecinForm.synapgen_solves}
                  onChange={(v) => setMedecinForm({ ...medecinForm, synapgen_solves: v })}
                />
                <YesNoToggle
                  label="A-t-il déjà prescrit le produit ?"
                  value={medecinForm.already_prescribed}
                  onChange={(v) => setMedecinForm({ ...medecinForm, already_prescribed: v })}
                />
                <YesNoToggle
                  label="A-t-il promis de le suggérer ?"
                  value={medecinForm.promised_to_suggest}
                  onChange={(v) => setMedecinForm({ ...medecinForm, promised_to_suggest: v })}
                />
                <YesNoToggle
                  label="Objection prix ?"
                  value={medecinForm.price_objection}
                  onChange={(v) => setMedecinForm({ ...medecinForm, price_objection: v })}
                />
                <YesNoToggle
                  label="Prescrit-il beaucoup de magnésium ?"
                  value={medecinForm.prescribes_magnesium}
                  onChange={(v) =>
                    setMedecinForm({ ...medecinForm, prescribes_magnesium: v })
                  }
                />
                {medecinForm.prescribes_magnesium === true && (
                  <Input
                    value={medecinForm.magnesium_brand}
                    onChange={(e) =>
                      setMedecinForm({ ...medecinForm, magnesium_brand: e.target.value })
                    }
                    placeholder="Quelle marque ?"
                    className="ml-2"
                  />
                )}
                <YesNoToggle
                  label="Crainte d'effets secondaires ?"
                  value={medecinForm.fears_side_effects}
                  onChange={(v) => setMedecinForm({ ...medecinForm, fears_side_effects: v })}
                />
                <YesNoToggle
                  label="Retours de patients reçus ?"
                  value={medecinForm.patient_feedback}
                  onChange={(v) => setMedecinForm({ ...medecinForm, patient_feedback: v })}
                />
                {medecinForm.patient_feedback === true && (
                  <Textarea
                    value={medecinForm.patient_feedback_comment}
                    onChange={(e) =>
                      setMedecinForm({
                        ...medecinForm,
                        patient_feedback_comment: e.target.value,
                      })
                    }
                    placeholder="Détails des retours patients..."
                    className="ml-2 min-h-[70px] resize-none"
                  />
                )}
                <YesNoToggle
                  label="A-t-il reçu un retour d'ordonnance ?"
                  value={medecinForm.ordonnance_return}
                  onChange={(v) => setMedecinForm({ ...medecinForm, ordonnance_return: v })}
                />
                <YesNoToggle
                  label="Échantillon gratuit donné pendant cette visite ?"
                  value={medecinForm.free_sample}
                  onChange={(v) => setMedecinForm({ ...medecinForm, free_sample: v })}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pharmacien form */}
        {visitType === "pharmacien" && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="synapgen_count">Nombre de Synapgen en stock</Label>
                <Input
                  id="synapgen_count"
                  type="number"
                  min="0"
                  value={pharmacienForm.synapgen_count}
                  onChange={(e) =>
                    setPharmacienForm({ ...pharmacienForm, synapgen_count: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prescriptions_received">Nombre de prescriptions reçues</Label>
                <Input
                  id="prescriptions_received"
                  type="number"
                  min="0"
                  value={pharmacienForm.prescriptions_received}
                  onChange={(e) =>
                    setPharmacienForm({
                      ...pharmacienForm,
                      prescriptions_received: e.target.value,
                    })
                  }
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prescribing_doctor">Prescriptions de quel médecin ?</Label>
              <Input
                id="prescribing_doctor"
                value={pharmacienForm.prescribing_doctor}
                onChange={(e) =>
                  setPharmacienForm({
                    ...pharmacienForm,
                    prescribing_doctor: e.target.value,
                  })
                }
                placeholder="Nom du médecin prescripteur"
              />
            </div>

            <Card className="bg-muted/20">
              <CardContent className="p-4">
                <YesNoToggle
                  label="A-t-il accepté de faire une commande (bon de commande) ?"
                  value={pharmacienForm.accepted_order}
                  onChange={(v) =>
                    setPharmacienForm({ ...pharmacienForm, accepted_order: v })
                  }
                />
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label htmlFor="pharma_comment">Commentaire *</Label>
              <Textarea
                id="pharma_comment"
                value={pharmacienForm.compte_rendu}
                onChange={(e) =>
                  setPharmacienForm({ ...pharmacienForm, compte_rendu: e.target.value })
                }
                placeholder="Observations, remarques..."
                className="min-h-[120px] resize-none"
              />
            </div>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading || !doctor}
          className="w-full cursor-pointer"
          size="lg"
        >
          {loading ? (
            "Enregistrement..."
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Enregistrer la visite
            </>
          )}
        </Button>
      </form>

      {/* Next visit planning prompt */}
      {showNextPlan && nextPlanDoctor && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <button
              type="button"
              onClick={() => setShowNextPlan(false)}
              className="w-full flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarCheck className="h-4 w-4 text-primary" />
                Planifier la prochaine visite pour{" "}
                {nextPlanDoctor.doctor_type === "pharmacien" ? "" : "Dr. "}
                {nextPlanDoctor.last_name} {nextPlanDoctor.first_name} ?
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                )}
              />
            </button>

            <DeadlineSelect value={nextDeadline} onChange={setNextDeadline} />

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground/80">
                Note (optionnel)
              </label>
              <Textarea
                value={nextNote}
                onChange={(e) => setNextNote(e.target.value)}
                placeholder="Rappel ou objectif pour la prochaine visite..."
                className="min-h-[50px] resize-none text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                disabled={savingNext || !nextDeadline}
                className="flex-1 cursor-pointer"
                onClick={async () => {
                  setSavingNext(true);
                  try {
                    const res = await fetch("/api/assignments", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        assignee_id: "self",
                        doctor_id: nextPlanDoctor.id,
                        deadline: nextDeadline,
                        note: nextNote || null,
                      }),
                    });
                    if (!res.ok) {
                      // If "self" doesn't work, the API needs current user ID
                      // but delegue can only assign to self so the API will handle it
                      const err = await res.json();
                      throw new Error(err.error);
                    }
                    toast.success("Prochaine visite planifiée");
                    setShowNextPlan(false);
                    setNextPlanDoctor(null);
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Erreur"
                    );
                  } finally {
                    setSavingNext(false);
                  }
                }}
              >
                <CalendarCheck className="h-4 w-4 mr-1" />
                {savingNext ? "Enregistrement..." : "Planifier"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowNextPlan(false);
                  setNextPlanDoctor(null);
                }}
                className="cursor-pointer text-muted-foreground"
              >
                Passer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDoctorForm} onOpenChange={setShowDoctorForm}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Ajouter un nouveau {visitType === "pharmacien" ? "pharmacien" : "médecin"}
            </DialogTitle>
          </DialogHeader>
          <DoctorForm
            defaultType={visitType}
            onSuccess={(newDoctor) => {
              setDoctor(newDoctor);
              setShowDoctorForm(false);
            }}
            onCancel={() => setShowDoctorForm(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
