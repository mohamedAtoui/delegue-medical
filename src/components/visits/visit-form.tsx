"use client";

import { useCallback, useEffect, useState } from "react";
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
import { ProductSelect } from "@/components/shared/product-select";
import { toast } from "sonner";
import { Send, Stethoscope, Pill, CalendarCheck, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  Doctor,
  ProductQuestion,
  VisitType,
  VisibleWhenRule,
} from "@/types";

interface VisitFormProps {
  onSuccess: () => void;
}

/** Answer keyed by question_id. Only one of the three value slots is set. */
type AnswerValue = {
  value_boolean?: boolean | null;
  value_text?: string;
  value_number?: string; // kept as string while typing
};

type AnswersMap = Record<string, AnswerValue>;

/**
 * Evaluate a question's visibility rule against the current answers.
 * Unknown rule shapes fail open so future server-side rule changes don't
 * silently hide questions in old clients.
 */
function isVisible(
  rule: VisibleWhenRule | null,
  answers: AnswersMap,
  questionsById: Map<string, ProductQuestion>
): boolean {
  if (!rule) return true;
  if (rule.op === "eq") {
    const parent = questionsById.get(rule.question_id);
    if (!parent) return true;
    const a = answers[rule.question_id];
    if (!a) return false;
    if (parent.input_type === "yes_no") {
      return a.value_boolean === rule.value;
    }
    if (parent.input_type === "number") {
      const n = a.value_number ? Number(a.value_number) : null;
      return n === rule.value;
    }
    return (a.value_text ?? null) === rule.value;
  }
  return true;
}

export function VisitForm({ onSuccess }: VisitFormProps) {
  const [visitType, setVisitType] = useState<VisitType>("medecin");
  const [productId, setProductId] = useState<string>("");
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [objective, setObjective] = useState("");
  const [compteRendu, setCompteRendu] = useState("");
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDoctorForm, setShowDoctorForm] = useState(false);

  // Next visit planning (optional, inside form before submit)
  const [planNext, setPlanNext] = useState(false);
  const [nextDeadline, setNextDeadline] = useState("");
  const [nextNote, setNextNote] = useState("");

  const switchType = (t: VisitType) => {
    if (t === visitType) return;
    setVisitType(t);
    setDoctor(null);
    setAnswers({});
  };

  // Reload questions whenever product or visit type changes.
  const loadQuestions = useCallback(async () => {
    if (!productId) {
      setQuestions([]);
      return;
    }
    setLoadingQuestions(true);
    try {
      const res = await fetch(
        `/api/products/${productId}/questions?target_role=${visitType}`
      );
      const data = await res.json();
      setQuestions(Array.isArray(data) ? data : []);
    } catch {
      setQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  }, [productId, visitType]);

  useEffect(() => {
    loadQuestions();
    setAnswers({});
  }, [loadQuestions]);

  const questionsById = new Map(questions.map((q) => [q.id, q]));

  const setAnswer = (id: string, update: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [id]: update }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productId) {
      toast.error("Veuillez sélectionner un produit");
      return;
    }
    if (!doctor) {
      toast.error(
        `Veuillez sélectionner un ${visitType === "pharmacien" ? "pharmacien" : "médecin"}`
      );
      return;
    }
    if (visitType === "medecin") {
      if (!objective.trim()) {
        toast.error("L'objectif de la visite est requis");
        return;
      }
      if (!compteRendu.trim()) {
        toast.error("Le compte rendu est requis");
        return;
      }
    } else if (!compteRendu.trim()) {
      toast.error("Le commentaire est requis");
      return;
    }

    // Required-question validation, skipping questions hidden by rules.
    for (const q of questions) {
      if (!q.required) continue;
      if (!isVisible(q.visible_when, answers, questionsById)) continue;
      const a = answers[q.id];
      const filled =
        a &&
        ((q.input_type === "yes_no" && a.value_boolean !== null && a.value_boolean !== undefined) ||
          (q.input_type === "short_text" && !!a.value_text?.trim()) ||
          (q.input_type === "textarea" && !!a.value_text?.trim()) ||
          (q.input_type === "number" && a.value_number !== undefined && a.value_number !== ""));
      if (!filled) {
        toast.error(`Question obligatoire : ${q.label}`);
        return;
      }
    }

    setLoading(true);
    try {
      // Build answers[] payload, including only visible + filled rows.
      const answersPayload = questions
        .filter((q) => isVisible(q.visible_when, answers, questionsById))
        .map((q) => {
          const a = answers[q.id];
          if (!a) return null;
          if (q.input_type === "yes_no") {
            if (a.value_boolean === null || a.value_boolean === undefined) return null;
            return { question_id: q.id, value_boolean: a.value_boolean };
          }
          if (q.input_type === "number") {
            if (a.value_number === undefined || a.value_number === "") return null;
            const n = Number(a.value_number);
            if (Number.isNaN(n)) return null;
            return { question_id: q.id, value_number: n };
          }
          const text = a.value_text?.trim();
          if (!text) return null;
          return { question_id: q.id, value_text: text };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      const payload = {
        doctor_id: doctor.id,
        product_id: productId,
        visit_type: visitType,
        objective: visitType === "medecin" ? objective.trim() : null,
        compte_rendu: compteRendu.trim(),
        answers: answersPayload,
      };

      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      // If next visit is planned, create assignment too
      if (planNext && nextDeadline && doctor) {
        try {
          const assignRes = await fetch("/api/assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assignee_id: "self",
              doctor_id: doctor.id,
              deadline: nextDeadline,
              note: nextNote || null,
            }),
          });
          if (assignRes.ok) {
            toast.success("Visite enregistrée + prochaine visite planifiée");
          } else {
            toast.success("Visite enregistrée");
            toast.error("Erreur lors de la planification de la prochaine visite");
          }
        } catch {
          toast.success("Visite enregistrée");
          toast.error("Erreur lors de la planification de la prochaine visite");
        }
      } else {
        toast.success("Visite enregistrée");
      }

      // Reset form
      setDoctor(null);
      setObjective("");
      setCompteRendu("");
      setAnswers({});
      setPlanNext(false);
      setNextDeadline("");
      setNextNote("");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  const visibleQuestions = questions.filter((q) =>
    isVisible(q.visible_when, answers, questionsById)
  );

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Product picker */}
        <div className="space-y-2">
          <Label>Produit *</Label>
          <ProductSelect value={productId} onValueChange={setProductId} />
        </div>

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

        {/* Objective (médecin only) */}
        {visitType === "medecin" && (
          <div className="space-y-2">
            <Label htmlFor="objective">Objectif de la visite *</Label>
            <Input
              id="objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Présenter le produit, suivre un retour, etc."
            />
          </div>
        )}

        {/* Compte rendu */}
        <div className="space-y-2">
          <Label htmlFor="compte_rendu">
            {visitType === "medecin" ? "Compte rendu de la visite *" : "Commentaire *"}
          </Label>
          <Textarea
            id="compte_rendu"
            value={compteRendu}
            onChange={(e) => setCompteRendu(e.target.value)}
            placeholder={
              visitType === "medecin"
                ? "Décrivez le déroulement de la visite..."
                : "Observations, remarques..."
            }
            className="min-h-[120px] resize-none"
          />
        </div>

        {/* Dynamic per-product questions */}
        {productId && (
          <Card className="bg-muted/20">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground/90">
                {visitType === "medecin" ? "Évaluation" : "Relevé"}
              </p>
              {loadingQuestions ? (
                <p className="text-xs text-muted-foreground">Chargement…</p>
              ) : visibleQuestions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucune question configurée pour ce produit. Le superviseur
                  peut en ajouter depuis la page Produits.
                </p>
              ) : (
                visibleQuestions.map((q) => (
                  <QuestionInput
                    key={q.id}
                    question={q}
                    answer={answers[q.id]}
                    onChange={(update) => setAnswer(q.id, update)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* Optional: Plan next visit (only shows when doctor is selected) */}
        {doctor && (
          <>
            <Separator />
            <Card className={cn(
              "transition-all",
              planNext ? "border-primary/30 bg-primary/5" : "border-border"
            )}>
              <CardContent className="p-4 space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setPlanNext(!planNext);
                    if (!planNext) {
                      setNextDeadline("");
                      setNextNote("");
                    }
                  }}
                  className="w-full flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CalendarCheck className={cn("h-4 w-4", planNext ? "text-primary" : "text-muted-foreground")} />
                    Planifier la prochaine visite pour{" "}
                    {doctor.doctor_type === "pharmacien" ? "" : "Dr. "}
                    {doctor.last_name} {doctor.first_name}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      planNext && "rotate-180"
                    )}
                  />
                </button>

                {planNext && (
                  <div className="space-y-3 pt-1">
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
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <Button
          type="submit"
          disabled={loading || !doctor || !productId || (planNext && !nextDeadline)}
          className="w-full cursor-pointer"
          size="lg"
        >
          {loading ? (
            "Enregistrement..."
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              {planNext ? "Enregistrer la visite + planifier la prochaine" : "Enregistrer la visite"}
            </>
          )}
        </Button>
      </form>

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

interface QuestionInputProps {
  question: ProductQuestion;
  answer: AnswerValue | undefined;
  onChange: (update: AnswerValue) => void;
}

function QuestionInput({ question, answer, onChange }: QuestionInputProps) {
  if (question.input_type === "yes_no") {
    return (
      <YesNoToggle
        label={question.label + (question.required ? " *" : "")}
        value={answer?.value_boolean ?? null}
        onChange={(v) => onChange({ value_boolean: v })}
      />
    );
  }
  if (question.input_type === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">
          {question.label}
          {question.required && " *"}
        </Label>
        <Textarea
          value={answer?.value_text ?? ""}
          onChange={(e) => onChange({ value_text: e.target.value })}
          className="min-h-[70px] resize-none"
        />
      </div>
    );
  }
  if (question.input_type === "number") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">
          {question.label}
          {question.required && " *"}
        </Label>
        <Input
          type="number"
          min="0"
          value={answer?.value_number ?? ""}
          onChange={(e) => onChange({ value_number: e.target.value })}
          placeholder="0"
        />
      </div>
    );
  }
  // short_text
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {question.label}
        {question.required && " *"}
      </Label>
      <Input
        value={answer?.value_text ?? ""}
        onChange={(e) => onChange({ value_text: e.target.value })}
      />
    </div>
  );
}
