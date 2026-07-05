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
import { EngagementStars } from "@/components/shared/engagement-stars";
import {
  GrossisteMultiSelect,
  expandGrossisteSelection,
  type SelectedGrossiste,
} from "@/components/doctors/grossiste-combobox";
import { toast } from "sonner";
import { Send, Stethoscope, Pill, Truck, CalendarCheck, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  Doctor,
  ProductQuestion,
  VisitType,
  VisibleWhenRule,
} from "@/types";

/** Pharmacien path joins the parent product so we can group by product name. */
type ProductQuestionWithProduct = ProductQuestion & {
  product?: { id: string; name: string; active: boolean } | null;
};

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
  const [engagement, setEngagement] = useState<number | null>(null);
  const [grossistes, setGrossistes] = useState<SelectedGrossiste[]>([]);
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [questions, setQuestions] = useState<ProductQuestionWithProduct[]>([]);
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
    setProductId("");
    setEngagement(null);
    setGrossistes([]);
  };

  // Reload questions when type or product changes.
  // Médecin: questions for the selected product only.
  // Pharmacien: questions across ALL active products (whole portfolio).
  const loadQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    try {
      let url: string;
      if (visitType === "pharmacien") {
        url = `/api/products/questions?target_role=pharmacien`;
      } else {
        if (!productId) {
          setQuestions([]);
          return;
        }
        url = `/api/products/${productId}/questions?target_role=medecin`;
      }
      const res = await fetch(url);
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

    if (visitType === "medecin" && !productId) {
      toast.error("Veuillez sélectionner un produit");
      return;
    }
    if (!doctor) {
      const who =
        visitType === "pharmacien"
          ? "pharmacien"
          : visitType === "grossiste"
          ? "grossiste"
          : "médecin";
      toast.error(`Veuillez sélectionner un ${who}`);
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

      // Grossistes recorded at a pharmacy visit (one row per category; a
      // "both"-category grossiste expands to two rows).
      const grossistesPayload =
        visitType === "pharmacien" ? expandGrossisteSelection(grossistes) : [];

      const payload = {
        doctor_id: doctor.id,
        product_id: visitType === "medecin" ? productId : null,
        visit_type: visitType,
        objective: visitType === "medecin" ? objective.trim() : null,
        compte_rendu: compteRendu.trim(),
        // Engagement applies to prescribers/pharmacies, not grossistes.
        engagement: visitType === "grossiste" ? null : engagement,
        answers: answersPayload,
        grossistes: grossistesPayload,
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
      setEngagement(null);
      setGrossistes([]);
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
        {/* Type selector — drives whether a product picker is needed */}
        <div className="space-y-2">
          <Label>Type de visite *</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
            <button
              type="button"
              onClick={() => switchType("grossiste")}
              className={cn(
                "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer",
                visitType === "grossiste"
                  ? "border-accent bg-accent/5 text-accent font-semibold"
                  : "border-border text-muted-foreground hover:border-accent/40"
              )}
            >
              <Truck className="h-5 w-5" />
              Grossiste
            </button>
          </div>
        </div>

        {/* Product picker — médecin only (pharmacien visits cover all products) */}
        {visitType === "medecin" && (
          <div className="space-y-2">
            <Label>Produit *</Label>
            <ProductSelect value={productId} onValueChange={setProductId} />
          </div>
        )}

        {/* Doctor search */}
        <div className="space-y-2">
          <Label>
            {visitType === "pharmacien"
              ? "Pharmacien *"
              : visitType === "grossiste"
              ? "Grossiste *"
              : "Médecin *"}
          </Label>
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

        {/* Engagement — médecin & pharmacien (not grossiste) */}
        {visitType !== "grossiste" && (
          <div className="space-y-2">
            <Label>
              Engagement {visitType === "pharmacien" ? "du pharmacien" : "du médecin"}
            </Label>
            <div className="flex items-center gap-3">
              <EngagementStars
                value={engagement}
                onChange={setEngagement}
                size="lg"
              />
              {engagement != null && (
                <button
                  type="button"
                  onClick={() => setEngagement(null)}
                  className="text-xs text-muted-foreground underline hover:text-foreground cursor-pointer"
                >
                  Effacer
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Facultatif. La moyenne des engagements saisis définit
              l&apos;engagement final.
            </p>
          </div>
        )}

        {/* Grossistes — pharmacien only, one per case, from a pre-set list */}
        {visitType === "pharmacien" && (
          <Card className="bg-muted/20">
            <CardContent className="p-4">
              <GrossisteMultiSelect
                label="Grossistes"
                value={grossistes}
                onChange={setGrossistes}
              />
            </CardContent>
          </Card>
        )}

        {/* Dynamic per-product questions */}
        {(visitType === "pharmacien" || productId) && (
          <Card className="bg-muted/20">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground/90">
                {visitType === "medecin" ? "Évaluation" : "Relevé par produit"}
              </p>
              {loadingQuestions ? (
                <p className="text-xs text-muted-foreground">Chargement…</p>
              ) : visibleQuestions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {visitType === "pharmacien"
                    ? "Aucune question configurée pour les pharmaciens. Le superviseur peut en ajouter depuis la page Produits."
                    : "Aucune question configurée pour ce produit. Le superviseur peut en ajouter depuis la page Produits."}
                </p>
              ) : visitType === "pharmacien" ? (
                // Group by product for pharmacien visits
                Array.from(
                  visibleQuestions.reduce((map, q) => {
                    const key = q.product_id;
                    if (!map.has(key)) {
                      map.set(key, {
                        productName: q.product?.name || "Produit",
                        questions: [],
                      });
                    }
                    map.get(key)!.questions.push(q);
                    return map;
                  }, new Map<string, { productName: string; questions: ProductQuestionWithProduct[] }>())
                ).map(([groupProductId, group]) => (
                  <div key={groupProductId} className="space-y-2 pt-2 first:pt-0">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-primary/80 border-b border-border/40 pb-1">
                      {group.productName}
                    </h4>
                    {group.questions.map((q) => (
                      <QuestionInput
                        key={q.id}
                        question={q}
                        answer={answers[q.id]}
                        onChange={(update) => setAnswer(q.id, update)}
                      />
                    ))}
                  </div>
                ))
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

        <div className="sticky bottom-0 -mx-2 bg-background/95 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
          <Button
            type="submit"
            disabled={loading || !doctor || (visitType === "medecin" && !productId) || (planNext && !nextDeadline)}
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
        </div>
      </form>

      <Dialog open={showDoctorForm} onOpenChange={setShowDoctorForm}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Ajouter un nouveau{" "}
              {visitType === "pharmacien"
                ? "pharmacien"
                : visitType === "grossiste"
                ? "grossiste"
                : "médecin"}
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
