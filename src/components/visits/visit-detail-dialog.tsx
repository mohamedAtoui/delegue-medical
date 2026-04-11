"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { toast } from "sonner";
import {
  Stethoscope,
  Pill,
  Send,
  Clock,
  MapPin,
  Check,
  X,
  MessageSquare,
  Target,
  FileText,
} from "lucide-react";
import type { VisitWithDetails, VisitComment } from "@/types";
import { cn } from "@/lib/utils";

interface VisitDetailDialogProps {
  visit: VisitWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function YesNoBadge({ value, label }: { value: boolean | null; label: string }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-xs text-foreground/80 flex-1">{label}</span>
      <Badge
        variant="outline"
        className={cn(
          "text-xs shrink-0",
          value
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-red-50 text-red-700 border-red-200"
        )}
      >
        {value ? (
          <>
            <Check className="h-3 w-3 mr-1" />
            Oui
          </>
        ) : (
          <>
            <X className="h-3 w-3 mr-1" />
            Non
          </>
        )}
      </Badge>
    </div>
  );
}

export function VisitDetailDialog({
  visit,
  open,
  onOpenChange,
}: VisitDetailDialogProps) {
  const [comments, setComments] = useState<VisitComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async () => {
    if (!visit) return;
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/visits/${visit.id}/comments`);
      const json = await res.json();
      setComments(json.data || []);
    } finally {
      setLoadingComments(false);
    }
  }, [visit]);

  useEffect(() => {
    if (open && visit) {
      setNewComment("");
      fetchComments();
    }
  }, [open, visit, fetchComments]);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [comments]);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visit || !newComment.trim()) return;

    setSending(true);
    try {
      const res = await fetch(`/api/visits/${visit.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const created: VisitComment = await res.json();
      setComments((prev) => [...prev, created]);
      setNewComment("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  if (!visit) return null;

  const isPharm = visit.visit_type === "pharmacien";
  const Icon = isPharm ? Pill : Stethoscope;
  const iconColor = isPharm ? "text-accent" : "text-primary";
  const iconBg = isPharm ? "bg-accent/10" : "bg-primary/10";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-base">
                {isPharm ? "" : "Dr. "}
                {visit.doctor.last_name} {visit.doctor.first_name}
              </div>
              <div className="text-xs font-normal text-muted-foreground flex items-center gap-2 mt-0.5">
                <MapPin className="h-3 w-3" />
                {visit.doctor.wilaya}
                <span>·</span>
                <Clock className="h-3 w-3" />
                {format(new Date(visit.created_at), "d MMM yyyy à HH:mm", { locale: fr })}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Author */}
          <div className="flex items-center gap-2 text-sm">
            <UserAvatar
              firstName={visit.user?.first_name}
              lastName={visit.user?.last_name}
              imageUrl={visit.user?.avatar_url}
              size="sm"
            />
            <span className="text-muted-foreground">Visite par</span>
            <span className="font-bold">
              {visit.user?.first_name} {visit.user?.last_name}
            </span>
          </div>

          {/* Objective (médecin) */}
          {visit.objective && (
            <div className="rounded-lg border border-border p-3 bg-muted/20">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground/80 mb-1">
                <Target className="h-3.5 w-3.5" />
                Objectif de la visite
              </div>
              <p className="text-sm">{visit.objective}</p>
            </div>
          )}

          {/* Compte rendu / Commentaire */}
          {visit.compte_rendu && (
            <div className="rounded-lg border border-border p-3 bg-muted/20">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground/80 mb-1">
                <FileText className="h-3.5 w-3.5" />
                {isPharm ? "Commentaire" : "Compte rendu"}
              </div>
              <p className="text-sm whitespace-pre-wrap">{visit.compte_rendu}</p>
            </div>
          )}

          {/* Médecin checklist */}
          {!isPharm && (
            <div className="rounded-lg border border-border p-3 bg-muted/10">
              <p className="text-xs font-semibold text-foreground/80 mb-2">Évaluation</p>
              <div className="space-y-0.5">
                <YesNoBadge value={visit.synapgen_solves} label="Synapgen répond-il aux besoins ?" />
                <YesNoBadge value={visit.already_prescribed} label="A-t-il déjà prescrit ?" />
                <YesNoBadge value={visit.promised_to_suggest} label="A-t-il promis de le suggérer ?" />
                <YesNoBadge value={visit.price_objection} label="Objection prix" />
                <YesNoBadge value={visit.prescribes_magnesium} label="Prescrit beaucoup de magnésium" />
                {visit.magnesium_brand && (
                  <div className="text-xs text-muted-foreground pl-2 italic">
                    Marque : {visit.magnesium_brand}
                  </div>
                )}
                <YesNoBadge value={visit.fears_side_effects} label="Crainte d'effets secondaires" />
                <YesNoBadge value={visit.patient_feedback} label="Retour patients" />
                {visit.patient_feedback_comment && (
                  <div className="text-xs text-muted-foreground pl-2 italic">
                    « {visit.patient_feedback_comment} »
                  </div>
                )}
                <YesNoBadge value={visit.ordonnance_return} label="Retour d'ordonnance" />
                <YesNoBadge value={visit.free_sample} label="Échantillon gratuit donné" />
              </div>
            </div>
          )}

          {/* Pharmacien data */}
          {isPharm && (
            <div className="rounded-lg border border-border p-3 bg-muted/10">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {visit.synapgen_count != null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Synapgen en stock</p>
                    <p className="font-semibold">{visit.synapgen_count}</p>
                  </div>
                )}
                {visit.prescriptions_received != null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Prescriptions reçues</p>
                    <p className="font-semibold">{visit.prescriptions_received}</p>
                  </div>
                )}
                {visit.prescribing_doctor && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Prescripteur</p>
                    <p className="font-semibold">{visit.prescribing_doctor}</p>
                  </div>
                )}
              </div>
              <div className="mt-2">
                <YesNoBadge value={visit.accepted_order} label="A accepté une commande" />
              </div>
            </div>
          )}

          {/* Comment thread */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground/80 mb-2">
              <MessageSquare className="h-3.5 w-3.5" />
              Commentaires ({comments.length})
            </div>
            <div className="space-y-2 max-h-[280px] overflow-y-auto rounded-lg border border-border/50 p-3 bg-muted/5">
              {loadingComments ? (
                <p className="text-xs text-muted-foreground text-center py-4">Chargement...</p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Aucun commentaire pour le moment
                </p>
              ) : (
                comments.map((c) => {
                  const isAuthor = c.user_id === visit.user_id;
                  return (
                    <div key={c.id} className="flex gap-2">
                      <UserAvatar
                        firstName={c.user?.first_name}
                        lastName={c.user?.last_name}
                        imageUrl={c.user?.avatar_url}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className={cn(
                            "text-xs font-bold",
                            isAuthor ? "text-green-700" : "text-foreground"
                          )}>
                            {c.user?.first_name} {c.user?.last_name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(c.created_at), "d MMM · HH:mm", { locale: fr })}
                          </span>
                        </div>
                        <div className={cn(
                          "mt-1 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                          isAuthor
                            ? "bg-green-50 border border-green-200 text-green-900"
                            : "bg-muted/50 text-foreground/85"
                        )}>
                          {c.content}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={endRef} />
            </div>
          </div>

          {/* Comment input */}
          <form onSubmit={submitComment} className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Écrire un commentaire..."
              className="flex-1 min-h-[60px] resize-none"
              disabled={sending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  submitComment(e);
                }
              }}
            />
            <Button
              type="submit"
              disabled={sending || !newComment.trim()}
              className="cursor-pointer shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
