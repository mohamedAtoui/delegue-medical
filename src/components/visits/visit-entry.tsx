"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Clock,
  FileText,
  ChevronDown,
  Check,
  X,
  Target,
  MessageSquare,
  CornerDownRight,
  Stethoscope,
  Pill,
  MapPin,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/user-avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { VisitWithDetails, VisitComment } from "@/types";

/* ─── Compact yes/no icon ─── */
function MiniYesNo({ value, label }: { value: boolean | null; label: string }) {
  if (value === null || value === undefined) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px]">
      {value ? (
        <Check className="h-3 w-3 text-green-600" />
      ) : (
        <X className="h-3 w-3 text-red-500" />
      )}
      <span className="text-foreground/70">{label}</span>
    </span>
  );
}

/* ─── Inline comments (threaded) + comment input ─── */
export function InlineComments({
  visitId,
  visitAuthorId,
}: {
  visitId: string;
  visitAuthorId: string;
}) {
  const [comments, setComments] = useState<VisitComment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/visits/${visitId}/comments`);
      const json = await res.json();
      setComments(json.data || []);
    } catch {
      setComments([]);
    } finally {
      setLoaded(true);
    }
  }, [visitId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/visits/${visitId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (!res.ok) throw new Error("Erreur");
      const created = await res.json();
      setComments((prev) => [...prev, created]);
      setNewComment("");
    } catch {
      toast.error("Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  if (!loaded) return null;

  const roots = comments.filter((c) => !c.parent_id);
  const replyMap = new Map<string, VisitComment[]>();
  comments.forEach((c) => {
    if (c.parent_id) {
      if (!replyMap.has(c.parent_id)) replyMap.set(c.parent_id, []);
      replyMap.get(c.parent_id)!.push(c);
    }
  });

  const shown = showAll ? roots : roots.slice(-3);

  return (
    <div className="mt-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
      {/* Show all toggle */}
      {!showAll && roots.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-[10px] text-primary/70 hover:text-primary ml-1 cursor-pointer"
        >
          Voir les {roots.length - 3} commentaire
          {roots.length - 3 > 1 ? "s" : ""} précédent
          {roots.length - 3 > 1 ? "s" : ""}
        </button>
      )}

      {/* Comments */}
      {shown.map((c) => {
        const isAuthor = c.user_id === visitAuthorId;
        const replies = replyMap.get(c.id) || [];
        return (
          <div key={c.id}>
            <div className="flex items-start gap-1.5">
              <UserAvatar
                firstName={c.user?.first_name}
                lastName={c.user?.last_name}
                imageUrl={c.user?.avatar_url}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      "text-[11px] font-bold",
                      isAuthor ? "text-green-700" : "text-foreground/80"
                    )}
                  >
                    {c.user?.first_name} {c.user?.last_name}
                  </span>
                  <span className="text-[9px] text-muted-foreground/60">
                    {format(new Date(c.created_at), "d MMM · HH:mm", {
                      locale: fr,
                    })}
                  </span>
                </div>
                <p
                  className={cn(
                    "text-xs leading-relaxed mt-0.5",
                    isAuthor ? "text-green-800/80" : "text-foreground/70"
                  )}
                >
                  {c.content}
                </p>
              </div>
            </div>
            {replies.map((r) => {
              const rIsAuthor = r.user_id === visitAuthorId;
              return (
                <div
                  key={r.id}
                  className="flex items-start gap-1.5 ml-6 mt-1"
                >
                  <CornerDownRight className="h-3 w-3 text-muted-foreground/40 mt-0.5 shrink-0" />
                  <UserAvatar
                    firstName={r.user?.first_name}
                    lastName={r.user?.last_name}
                    imageUrl={r.user?.avatar_url}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={cn(
                          "text-[11px] font-bold",
                          rIsAuthor ? "text-green-700" : "text-foreground/80"
                        )}
                      >
                        {r.user?.first_name} {r.user?.last_name}
                      </span>
                      <span className="text-[9px] text-muted-foreground/60">
                        {format(new Date(r.created_at), "d MMM · HH:mm", {
                          locale: fr,
                        })}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-xs leading-relaxed mt-0.5",
                        rIsAuthor ? "text-green-800/80" : "text-foreground/70"
                      )}
                    >
                      {r.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Inline comment input */}
      <form onSubmit={submitComment} className="flex gap-1.5 pt-1">
        <Textarea
          ref={inputRef}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Commenter..."
          disabled={sending}
          className="flex-1 min-h-[32px] max-h-[80px] resize-none text-xs py-1.5 px-2.5"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              submitComment(e);
            }
          }}
        />
        <Button
          type="submit"
          size="sm"
          disabled={sending || !newComment.trim()}
          className="cursor-pointer shrink-0 self-end h-8 w-8 p-0"
        >
          <Send className="h-3 w-3" />
        </Button>
      </form>
    </div>
  );
}

/* ─── Single visit entry (unified display) ─── */
export interface VisitEntryProps {
  visit: VisitWithDetails;
  /** Show the author avatar + name */
  showUser?: boolean;
  /** Show doctor/pharmacien name + type icon in header */
  showDoctor?: boolean;
  /** Highlight visits by this user (green) */
  highlightUserId?: string;
  /** Called when the user clicks the entry (overrides inline expand) */
  onClick?: (visit: VisitWithDetails) => void;
}

export function VisitEntry({
  visit,
  showUser = true,
  showDoctor = false,
  highlightUserId,
  onClick,
}: VisitEntryProps) {
  const [open, setOpen] = useState(false);
  const isPharm = visit.visit_type === "pharmacien";
  const isHighlighted =
    !highlightUserId || visit.user_id === highlightUserId;

  const evalFields = [
    visit.synapgen_solves,
    visit.already_prescribed,
    visit.promised_to_suggest,
    visit.price_objection,
    visit.prescribes_magnesium,
    visit.fears_side_effects,
    visit.patient_feedback,
    visit.ordonnance_return,
    visit.free_sample,
  ];
  const answeredCount = evalFields.filter(
    (v) => v !== null && v !== undefined
  ).length;
  const yesCount = evalFields.filter((v) => v === true).length;

  const handleClick = () => {
    if (onClick) {
      onClick(visit);
    } else {
      setOpen((v) => !v);
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden transition-shadow hover:shadow-sm",
        isHighlighted
          ? "border-border/60 bg-background/80"
          : "border-border/30 bg-muted/10"
      )}
    >
      {/* Header — always visible */}
      <button
        type="button"
        onClick={handleClick}
        className="w-full flex items-start gap-3 p-3 text-left cursor-pointer hover:bg-muted/20 transition-colors"
      >
        {showDoctor && !showUser && (
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5",
              isPharm ? "bg-accent/10" : "bg-primary/10"
            )}
          >
            {isPharm ? (
              <Pill className="h-4 w-4 text-accent" />
            ) : (
              <Stethoscope className="h-4 w-4 text-primary" />
            )}
          </div>
        )}
        {showUser && (
          <UserAvatar
            firstName={visit.user?.first_name}
            lastName={visit.user?.last_name}
            imageUrl={visit.user?.avatar_url}
            size="sm"
          />
        )}
        <div className="flex-1 min-w-0">
          {/* Doctor info line */}
          {showDoctor && visit.doctor && (
            <div className="flex items-center gap-2 mb-0.5">
              {showUser && (
                <div
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    isPharm ? "bg-accent/10" : "bg-primary/10"
                  )}
                >
                  {isPharm ? (
                    <Pill className="h-3 w-3 text-accent" />
                  ) : (
                    <Stethoscope className="h-3 w-3 text-primary" />
                  )}
                </div>
              )}
              <span className="text-sm font-semibold truncate">
                {isPharm ? "" : "Dr. "}
                {visit.doctor.last_name} {visit.doctor.first_name}
              </span>
              {visit.doctor.specialty && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                >
                  {visit.doctor.specialty}
                </Badge>
              )}
              {visit.doctor.wilaya && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                  <MapPin className="h-2.5 w-2.5" />
                  {visit.doctor.wilaya}
                </span>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            {showUser && (
              <span
                className={cn(
                  "text-xs font-bold",
                  isHighlighted ? "text-foreground/85" : "text-foreground/60"
                )}
              >
                {visit.user?.first_name} {visit.user?.last_name}
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
              <Clock className="h-3 w-3" />
              {format(new Date(visit.created_at), "d MMM yyyy · HH:mm", {
                locale: fr,
              })}
            </span>
          </div>

          {/* One-line preview when closed */}
          {!open && (
            <p
              className={cn(
                "text-xs mt-0.5 line-clamp-1",
                isHighlighted ? "text-foreground/60" : "text-foreground/45"
              )}
            >
              {visit.objective ||
                visit.compte_rendu ||
                (isPharm ? "Visite pharmacien" : "Visite médecin")}
            </p>
          )}

          {/* Badges row */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {(visit.comment_count ?? 0) > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-normal"
              >
                <MessageSquare className="h-2.5 w-2.5" />
                {visit.comment_count}
              </Badge>
            )}
            {!isPharm && answeredCount > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-normal"
              >
                {yesCount}/{answeredCount} oui
              </Badge>
            )}
            {isPharm && visit.synapgen_count != null && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-normal"
              >
                Stock: {visit.synapgen_count}
              </Badge>
            )}
          </div>
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-border/40 pt-2.5">
          {/* Objective */}
          {visit.objective && (
            <div className="flex items-start gap-1.5">
              <Target className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-foreground/70">
                <span className="font-semibold text-foreground/80">
                  Objectif :{" "}
                </span>
                {visit.objective}
              </p>
            </div>
          )}

          {/* Compte rendu */}
          {visit.compte_rendu && (
            <div className="flex items-start gap-1.5">
              <FileText className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                {visit.compte_rendu}
              </p>
            </div>
          )}

          {/* Médecin evaluation summary */}
          {!isPharm && answeredCount > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 pl-4 pt-1">
              <MiniYesNo value={visit.synapgen_solves} label="Synapgen résout" />
              <MiniYesNo
                value={visit.already_prescribed}
                label="Déjà prescrit"
              />
              <MiniYesNo
                value={visit.promised_to_suggest}
                label="Promis suggérer"
              />
              <MiniYesNo value={visit.price_objection} label="Objection prix" />
              <MiniYesNo
                value={visit.prescribes_magnesium}
                label="Magnésium"
              />
              <MiniYesNo
                value={visit.fears_side_effects}
                label="Effets sec."
              />
              <MiniYesNo
                value={visit.patient_feedback}
                label="Retour patients"
              />
              <MiniYesNo
                value={visit.ordonnance_return}
                label="Retour ordonnance"
              />
              <MiniYesNo value={visit.free_sample} label="Échantillon" />
              {visit.magnesium_brand && (
                <span className="text-[11px] text-foreground/60 italic">
                  Marque : {visit.magnesium_brand}
                </span>
              )}
              {visit.patient_feedback_comment && (
                <span className="text-[11px] text-foreground/60 italic">
                  « {visit.patient_feedback_comment} »
                </span>
              )}
            </div>
          )}

          {/* Pharmacien details */}
          {isPharm && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 pl-4 pt-1 text-[11px]">
              {visit.synapgen_count != null && (
                <span className="text-foreground/70">
                  <span className="font-semibold">Stock :</span>{" "}
                  {visit.synapgen_count}
                </span>
              )}
              {visit.prescriptions_received != null && (
                <span className="text-foreground/70">
                  <span className="font-semibold">Prescriptions :</span>{" "}
                  {visit.prescriptions_received}
                </span>
              )}
              {visit.prescribing_doctor && (
                <span className="text-foreground/70">
                  <span className="font-semibold">Prescripteur :</span>{" "}
                  {visit.prescribing_doctor}
                </span>
              )}
              {visit.accepted_order != null && (
                <MiniYesNo
                  value={visit.accepted_order}
                  label="Commande acceptée"
                />
              )}
            </div>
          )}

          {/* Comments with inline input */}
          <InlineComments visitId={visit.id} visitAuthorId={visit.user_id} />
        </div>
      )}
    </div>
  );
}
