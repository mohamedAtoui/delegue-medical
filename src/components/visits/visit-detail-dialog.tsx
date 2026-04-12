"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  CornerDownRight,
  ChevronDown,
} from "lucide-react";
import { DoctorVisitTimeline } from "@/components/visits/doctor-visit-timeline";
import type { VisitWithDetails, VisitComment } from "@/types";
import { cn } from "@/lib/utils";

interface VisitDetailDialogProps {
  visit: VisitWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ThreadedComment extends VisitComment {
  replies: VisitComment[];
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

interface CommentBubbleProps {
  comment: VisitComment;
  isAuthor: boolean;
  isReply?: boolean;
  onReply?: () => void;
  replyingActive?: boolean;
}

function CommentBubble({
  comment,
  isAuthor,
  isReply = false,
  onReply,
  replyingActive,
}: CommentBubbleProps) {
  return (
    <div className="group flex gap-2.5">
      <div className="shrink-0">
        <UserAvatar
          firstName={comment.user?.first_name}
          lastName={comment.user?.last_name}
          imageUrl={comment.user?.avatar_url}
          size="sm"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "text-xs font-bold tracking-tight",
              isAuthor ? "text-green-800" : "text-foreground"
            )}
          >
            {comment.user?.first_name} {comment.user?.last_name}
          </span>
          {isAuthor && (
            <span className="text-[9px] uppercase tracking-wider text-green-700/80 font-semibold px-1.5 py-0.5 rounded bg-green-100/70">
              auteur
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/70">
            {format(new Date(comment.created_at), "d MMM · HH:mm", {
              locale: fr,
            })}
          </span>
        </div>
        <div
          className={cn(
            "mt-1 rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap leading-relaxed shadow-sm",
            isAuthor
              ? "bg-gradient-to-br from-green-50 to-green-50/60 border border-green-200/80 text-green-950 rounded-tl-sm"
              : "bg-muted/60 border border-border/50 text-foreground/90 rounded-tl-sm"
          )}
        >
          {comment.content}
        </div>
        {!isReply && onReply && (
          <button
            type="button"
            onClick={onReply}
            className={cn(
              "mt-1 ml-1 flex items-center gap-1 text-[11px] font-medium transition-all cursor-pointer",
              replyingActive
                ? "text-primary"
                : "text-muted-foreground/60 hover:text-primary opacity-0 group-hover:opacity-100 focus:opacity-100"
            )}
          >
            <CornerDownRight className="h-3 w-3" />
            {replyingActive ? "Annuler" : "Répondre"}
          </button>
        )}
      </div>
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
  const [replyTo, setReplyTo] = useState<VisitComment | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [evalOpen, setEvalOpen] = useState(false);
  const [compteRenduOpen, setCompteRenduOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

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
      setReplyTo(null);
      setReplyText("");
      fetchComments();
    }
  }, [open, visit, fetchComments]);

  useEffect(() => {
    if (endRef.current && !replyTo) {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [comments, replyTo]);

  useEffect(() => {
    if (replyTo && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [replyTo]);

  // Group comments into threads (1 level)
  const threaded: ThreadedComment[] = useMemo(() => {
    const roots: ThreadedComment[] = [];
    const byId = new Map<string, ThreadedComment>();

    // Pass 1 — create roots
    comments.forEach((c) => {
      if (!c.parent_id) {
        const t: ThreadedComment = { ...c, replies: [] };
        byId.set(c.id, t);
        roots.push(t);
      }
    });
    // Pass 2 — attach replies (flatten nested to closest root)
    comments.forEach((c) => {
      if (c.parent_id) {
        let parent = byId.get(c.parent_id);
        if (!parent) {
          // orphan — find via original list
          const anc = comments.find((x) => x.id === c.parent_id);
          if (anc && anc.parent_id) parent = byId.get(anc.parent_id);
        }
        if (parent) {
          parent.replies.push(c);
        } else {
          // fallback: treat as root
          roots.push({ ...c, replies: [] });
        }
      }
    });

    return roots;
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

  const submitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visit || !replyTo || !replyText.trim()) return;

    setSendingReply(true);
    try {
      const res = await fetch(`/api/visits/${visit.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: replyText.trim(),
          parent_id: replyTo.id,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const created: VisitComment = await res.json();
      setComments((prev) => [...prev, created]);
      setReplyText("");
      setReplyTo(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi");
    } finally {
      setSendingReply(false);
    }
  };

  if (!visit) return null;

  const isPharm = visit.visit_type === "pharmacien";
  const Icon = isPharm ? Pill : Stethoscope;
  const iconColor = isPharm ? "text-accent" : "text-primary";
  const iconBg = isPharm ? "bg-accent/10" : "bg-primary/10";

  const totalComments = comments.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}
            >
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
                {format(new Date(visit.created_at), "d MMM yyyy à HH:mm", {
                  locale: fr,
                })}
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

          {/* Historique — all visits to this doctor */}
          <DoctorVisitTimeline
            doctorId={visit.doctor_id}
            excludeVisitId={visit.id}
          />

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

          {/* Compte rendu / Commentaire — collapsible if long */}
          {visit.compte_rendu && (
            <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
              {visit.compte_rendu.length > 120 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setCompteRenduOpen((v) => !v)}
                    className="w-full flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold text-foreground/80">
                      <FileText className="h-3.5 w-3.5" />
                      {isPharm ? "Commentaire" : "Compte rendu"}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        compteRenduOpen && "rotate-180"
                      )}
                    />
                  </button>
                  {!compteRenduOpen && (
                    <p className="px-3 pb-3 text-sm text-foreground/80 line-clamp-1">
                      {visit.compte_rendu}
                    </p>
                  )}
                  {compteRenduOpen && (
                    <p className="px-3 pb-3 text-sm whitespace-pre-wrap border-t border-border/50 pt-2">
                      {visit.compte_rendu}
                    </p>
                  )}
                </>
              ) : (
                <div className="p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground/80 mb-1">
                    <FileText className="h-3.5 w-3.5" />
                    {isPharm ? "Commentaire" : "Compte rendu"}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{visit.compte_rendu}</p>
                </div>
              )}
            </div>
          )}

          {/* Médecin checklist — collapsible */}
          {!isPharm && (
            <div className="rounded-lg border border-border bg-muted/10 overflow-hidden">
              <button
                type="button"
                onClick={() => setEvalOpen((v) => !v)}
                className="w-full flex items-center justify-between p-3 cursor-pointer hover:bg-muted/20 transition-colors"
              >
                <span className="text-xs font-semibold text-foreground/80">
                  Évaluation
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    evalOpen && "rotate-180"
                  )}
                />
              </button>
              {evalOpen && (
                <div className="px-3 pb-3 space-y-0.5 border-t border-border/50 pt-2">
                  <YesNoBadge
                    value={visit.synapgen_solves}
                    label="Synapgen répond-il aux besoins ?"
                  />
                  <YesNoBadge
                    value={visit.already_prescribed}
                    label="A-t-il déjà prescrit ?"
                  />
                  <YesNoBadge
                    value={visit.promised_to_suggest}
                    label="A-t-il promis de le suggérer ?"
                  />
                  <YesNoBadge value={visit.price_objection} label="Objection prix" />
                  <YesNoBadge
                    value={visit.prescribes_magnesium}
                    label="Prescrit beaucoup de magnésium"
                  />
                  {visit.magnesium_brand && (
                    <div className="text-xs text-muted-foreground pl-2 italic">
                      Marque : {visit.magnesium_brand}
                    </div>
                  )}
                  <YesNoBadge
                    value={visit.fears_side_effects}
                    label="Crainte d'effets secondaires"
                  />
                  <YesNoBadge value={visit.patient_feedback} label="Retour patients" />
                  {visit.patient_feedback_comment && (
                    <div className="text-xs text-muted-foreground pl-2 italic">
                      « {visit.patient_feedback_comment} »
                    </div>
                  )}
                  <YesNoBadge
                    value={visit.ordonnance_return}
                    label="Retour d'ordonnance"
                  />
                  <YesNoBadge
                    value={visit.free_sample}
                    label="Échantillon gratuit donné"
                  />
                </div>
              )}
            </div>
          )}

          {/* Pharmacien data */}
          {isPharm && (
            <div className="rounded-lg border border-border p-3 bg-muted/10">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {visit.synapgen_count != null && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Synapgen en stock
                    </p>
                    <p className="font-semibold">{visit.synapgen_count}</p>
                  </div>
                )}
                {visit.prescriptions_received != null && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Prescriptions reçues
                    </p>
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
                <YesNoBadge
                  value={visit.accepted_order}
                  label="A accepté une commande"
                />
              </div>
            </div>
          )}

          {/* Comment thread */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground/80 mb-2">
              <MessageSquare className="h-3.5 w-3.5" />
              Discussion
              <span className="text-muted-foreground font-normal">
                · {totalComments} {totalComments > 1 ? "messages" : "message"}
              </span>
            </div>
            <div className="space-y-4 max-h-[320px] overflow-y-auto rounded-xl border border-border/60 p-4 bg-gradient-to-b from-muted/10 to-transparent">
              {loadingComments ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Chargement…
                </p>
              ) : threaded.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-7 w-7 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Aucun message. Soyez le premier à commenter.
                  </p>
                </div>
              ) : (
                threaded.map((c) => {
                  const isAuthor = c.user_id === visit.user_id;
                  const isReplying = replyTo?.id === c.id;
                  return (
                    <div key={c.id} className="space-y-2">
                      <CommentBubble
                        comment={c}
                        isAuthor={isAuthor}
                        onReply={() =>
                          setReplyTo(isReplying ? null : c)
                        }
                        replyingActive={isReplying}
                      />

                      {/* Replies thread */}
                      {(c.replies.length > 0 || isReplying) && (
                        <div className="ml-5 pl-4 border-l-2 border-border/50 space-y-3">
                          {c.replies.map((r) => {
                            const rIsAuthor = r.user_id === visit.user_id;
                            return (
                              <CommentBubble
                                key={r.id}
                                comment={r}
                                isAuthor={rIsAuthor}
                                isReply
                              />
                            );
                          })}

                          {isReplying && (
                            <form
                              onSubmit={submitReply}
                              className="flex gap-2 pt-1"
                            >
                              <Textarea
                                ref={replyInputRef}
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder={`Répondre à ${c.user?.first_name}…`}
                                className="flex-1 min-h-[44px] resize-none text-sm"
                                disabled={sendingReply}
                                onKeyDown={(e) => {
                                  if (
                                    e.key === "Enter" &&
                                    (e.metaKey || e.ctrlKey)
                                  ) {
                                    submitReply(e);
                                  }
                                  if (e.key === "Escape") {
                                    setReplyTo(null);
                                    setReplyText("");
                                  }
                                }}
                              />
                              <Button
                                type="submit"
                                disabled={sendingReply || !replyText.trim()}
                                size="sm"
                                className="cursor-pointer shrink-0 self-end"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                            </form>
                          )}
                        </div>
                      )}
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
              placeholder="Écrire un commentaire… (Ctrl+Entrée pour envoyer)"
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
              className="cursor-pointer shrink-0 self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
