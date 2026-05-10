"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
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
  ImagePlus,
  CalendarPlus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { DeadlineSelect } from "@/components/assignments/deadline-select";
import { UserAvatar } from "@/components/shared/user-avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { VisitWithDetails, VisitComment, VisitAnswer } from "@/types";

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

/* ─── Compact renderer for a single dynamic answer ─── */
function DynamicAnswerChip({ answer }: { answer: VisitAnswer }) {
  const label = answer.question?.label ?? "Question supprimée";
  if (answer.value_boolean !== null && answer.value_boolean !== undefined) {
    return <MiniYesNo value={answer.value_boolean} label={label} />;
  }
  const value =
    answer.value_text ??
    (answer.value_number !== null && answer.value_number !== undefined
      ? String(answer.value_number)
      : null);
  if (!value) return null;
  return (
    <span className="text-[11px] text-foreground/70">
      <span className="font-semibold">{label} :</span> {value}
    </span>
  );
}

/* ─── Inline comments (threaded) + comment input ─── */
export function InlineComments({
  visitId,
  visitAuthorId,
  doctorId,
  doctorName,
  doctorIsPharmacien,
}: {
  visitId: string;
  visitAuthorId: string;
  doctorId?: string;
  doctorName?: string;
  doctorIsPharmacien?: boolean;
}) {
  const [comments, setComments] = useState<VisitComment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Plan-next-visit popover state
  const [planOpen, setPlanOpen] = useState(false);
  const [planDeadline, setPlanDeadline] = useState("");
  const [planNote, setPlanNote] = useState("");
  const [planSaving, setPlanSaving] = useState(false);

  const submitPlan = async () => {
    if (!doctorId || !planDeadline) return;
    setPlanSaving(true);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignee_id: visitAuthorId,
          doctor_id: doctorId,
          deadline: planDeadline,
          note: planNote || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }
      toast.success("Prochaine visite planifiée");
      setPlanOpen(false);
      setPlanDeadline("");
      setPlanNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setPlanSaving(false);
    }
  };

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  const pickImage = (file: File | null) => {
    if (!file) {
      setNewImage(null);
      setNewImagePreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez choisir une image");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("L'image dépasse 5 Mo");
      return;
    }
    setNewImage(file);
    setNewImagePreview(URL.createObjectURL(file));
  };

  useEffect(() => {
    return () => {
      if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    };
  }, [newImagePreview]);

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
    if (!newComment.trim() && !newImage) return;
    setSending(true);
    try {
      const fd = new FormData();
      if (newComment.trim()) fd.append("content", newComment.trim());
      if (newImage) fd.append("image", newImage);
      const res = await fetch(`/api/visits/${visitId}/comments`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }
      const created = await res.json();
      setComments((prev) => [...prev, created]);
      setNewComment("");
      setNewImage(null);
      if (newImagePreview) URL.revokeObjectURL(newImagePreview);
      setNewImagePreview(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi");
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
                {c.content && (
                  <p
                    className={cn(
                      "text-xs leading-relaxed mt-0.5",
                      isAuthor ? "text-green-800/80" : "text-foreground/70"
                    )}
                  >
                    {c.content}
                  </p>
                )}
                {c.image_url && (
                  <a
                    href={c.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-1"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.image_url}
                      alt="Pièce jointe"
                      className="max-h-32 w-auto rounded-md border border-border/50 object-contain"
                    />
                  </a>
                )}
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
                    {r.content && (
                      <p
                        className={cn(
                          "text-xs leading-relaxed mt-0.5",
                          rIsAuthor ? "text-green-800/80" : "text-foreground/70"
                        )}
                      >
                        {r.content}
                      </p>
                    )}
                    {r.image_url && (
                      <a
                        href={r.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-1"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.image_url}
                          alt="Pièce jointe"
                          className="max-h-28 w-auto rounded-md border border-border/50 object-contain"
                        />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Inline comment input */}
      <form onSubmit={submitComment} className="flex flex-col gap-1.5 pt-1">
        {newImagePreview && (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={newImagePreview}
              alt="Aperçu"
              className="max-h-28 w-auto rounded-md border border-border/50 object-contain"
            />
            <button
              type="button"
              onClick={() => {
                if (newImagePreview) URL.revokeObjectURL(newImagePreview);
                setNewImage(null);
                setNewImagePreview(null);
                if (imageInputRef.current) imageInputRef.current.value = "";
              }}
              className="absolute -top-1.5 -right-1.5 bg-background border border-border rounded-full p-0.5 shadow cursor-pointer hover:bg-muted"
              aria-label="Retirer l'image"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="flex gap-1.5">
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
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickImage(e.target.files?.[0] || null)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={sending}
            onClick={() => imageInputRef.current?.click()}
            className="cursor-pointer shrink-0 self-end h-8 w-8 p-0"
            aria-label="Ajouter une image"
          >
            <ImagePlus className="h-3 w-3" />
          </Button>
          {doctorId && (
            <Popover open={planOpen} onOpenChange={setPlanOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer shrink-0 self-end h-8 w-8 p-0"
                    aria-label="Planifier la prochaine visite"
                    title="Planifier la prochaine visite"
                  >
                    <CalendarPlus className="h-3 w-3" />
                  </Button>
                }
              />
              <PopoverContent
                className="w-80 p-3 space-y-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">
                    Planifier la prochaine visite
                  </p>
                  {doctorName && (
                    <p className="text-[11px] text-muted-foreground">
                      {doctorIsPharmacien ? "" : "Dr. "}
                      {doctorName}
                    </p>
                  )}
                </div>
                <DeadlineSelect
                  value={planDeadline}
                  onChange={setPlanDeadline}
                />
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-foreground/80">
                    Note (optionnel)
                  </label>
                  <Textarea
                    value={planNote}
                    onChange={(e) => setPlanNote(e.target.value)}
                    placeholder="Rappel ou objectif..."
                    className="min-h-[50px] resize-none text-xs"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPlanOpen(false)}
                    className="cursor-pointer h-8"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={planSaving || !planDeadline}
                    onClick={submitPlan}
                    className="cursor-pointer h-8"
                  >
                    <CalendarPlus className="h-3 w-3 mr-1" />
                    {planSaving ? "..." : "Planifier"}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={sending || (!newComment.trim() && !newImage)}
            className="cursor-pointer shrink-0 self-end h-8 w-8 p-0"
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
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
  /** Current user role — when "superviseur", show danger zone */
  userRole?: string;
  /** Called after the visit is successfully deleted */
  onDelete?: (visitId: string) => void;
  /** When this id matches visit.id, auto-open + scroll into view + ring */
  highlightVisitId?: string;
}

export function VisitEntry({
  visit,
  showUser = true,
  showDoctor = false,
  highlightUserId,
  onClick,
  userRole,
  onDelete,
  highlightVisitId,
}: VisitEntryProps) {
  const isHighlightTarget = highlightVisitId === visit.id;
  const [open, setOpen] = useState<boolean>(isHighlightTarget);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Scroll the highlighted visit into view on mount (open state already set above)
  useEffect(() => {
    if (!isHighlightTarget) return;
    const t = setTimeout(() => {
      wrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return () => clearTimeout(t);
  }, [isHighlightTarget]);
  const isPharm = visit.visit_type === "pharmacien";
  const isHighlighted =
    !highlightUserId || visit.user_id === highlightUserId;

  const dynamicAnswers = visit.visit_answers ?? [];
  const hasDynamicAnswers = dynamicAnswers.length > 0;
  const sortedAnswers = hasDynamicAnswers
    ? [...dynamicAnswers].sort(
        (a, b) =>
          (a.question?.display_order ?? 0) - (b.question?.display_order ?? 0)
      )
    : [];

  // Counts for the compact "X/Y oui" badge. Dynamic path counts yes_no
  // answers across both médecin and pharmacien flows; legacy path keeps the
  // médecin-only behaviour.
  const yesNoAnswers = hasDynamicAnswers
    ? sortedAnswers.filter(
        (a) =>
          a.question?.input_type === "yes_no" &&
          a.value_boolean !== null &&
          a.value_boolean !== undefined
      )
    : [];
  const legacyEvalFields = [
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
  const answeredCount = hasDynamicAnswers
    ? yesNoAnswers.length
    : legacyEvalFields.filter((v) => v !== null && v !== undefined).length;
  const yesCount = hasDynamicAnswers
    ? yesNoAnswers.filter((a) => a.value_boolean === true).length
    : legacyEvalFields.filter((v) => v === true).length;

  const handleClick = () => {
    if (onClick) {
      onClick(visit);
    } else {
      setOpen((v) => !v);
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "rounded-xl border overflow-hidden transition-shadow hover:shadow-sm",
        isHighlighted
          ? "border-border/60 bg-background/80"
          : "border-border/30 bg-muted/10",
        isHighlightTarget && "ring-2 ring-primary/60 ring-offset-2 shadow-md"
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
              <Link
                href={`/medecins/${visit.doctor_id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-semibold truncate hover:underline cursor-pointer"
              >
                {isPharm ? "" : "Dr. "}
                {visit.doctor.last_name} {visit.doctor.first_name}
              </Link>
              {visit.doctor.specialty && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                >
                  {visit.doctor.specialty}
                </Badge>
              )}
              {visit.doctor.wilaya && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground min-w-0">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">
                    {visit.doctor.wilaya}
                    {visit.doctor.commune ? `, ${visit.doctor.commune}` : ""}
                    {visit.doctor.address ? ` — ${visit.doctor.address}` : ""}
                  </span>
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
            {answeredCount > 0 && (hasDynamicAnswers || !isPharm) && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-normal"
              >
                {yesCount}/{answeredCount} oui
              </Badge>
            )}
            {!hasDynamicAnswers && isPharm && visit.synapgen_count != null && (
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

          {/* Dynamic answers (new visits). For pharmacien visits whose answers
              span multiple products, group by product so each product's
              numbers stay readable. */}
          {hasDynamicAnswers && sortedAnswers.length > 0 && (() => {
            const productIds = new Set(
              sortedAnswers
                .map((a) => a.question?.product_id)
                .filter((p): p is string => !!p)
            );
            const showGrouped = isPharm && productIds.size > 1;
            if (!showGrouped) {
              return (
                <div className="flex flex-wrap gap-x-3 gap-y-1 pl-4 pt-1">
                  {sortedAnswers.map((a) => (
                    <DynamicAnswerChip key={a.id} answer={a} />
                  ))}
                </div>
              );
            }
            // Group answers by product_id (preserving sort order)
            const groups = new Map<
              string,
              { name: string; answers: typeof sortedAnswers }
            >();
            for (const a of sortedAnswers) {
              const pid = a.question?.product_id || "unknown";
              if (!groups.has(pid)) {
                groups.set(pid, {
                  name:
                    (a.question as { product?: { name?: string } } | undefined)
                      ?.product?.name || "Produit",
                  answers: [],
                });
              }
              groups.get(pid)!.answers.push(a);
            }
            return (
              <div className="space-y-2 pl-4 pt-1">
                {Array.from(groups.entries()).map(([pid, group]) => (
                  <div key={pid}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-primary/70 mb-0.5">
                      {group.name}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {group.answers.map((a) => (
                        <DynamicAnswerChip key={a.id} answer={a} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Legacy médecin evaluation summary (pre-migration visits) */}
          {!hasDynamicAnswers && !isPharm && answeredCount > 0 && (
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

          {/* Legacy pharmacien details (pre-migration visits) */}
          {!hasDynamicAnswers && isPharm && (
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
          <InlineComments
            visitId={visit.id}
            visitAuthorId={visit.user_id}
            doctorId={visit.doctor_id}
            doctorName={
              visit.doctor
                ? `${visit.doctor.last_name} ${visit.doctor.first_name}`.trim()
                : undefined
            }
            doctorIsPharmacien={isPharm}
          />

          {/* Bin button — supervisor only */}
          {userRole === "superviseur" && visit.doctor && (
            <>
              <div
                className="flex justify-end pt-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setShowDeleteDialog(true)}
                  className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors cursor-pointer"
                  title="Supprimer cette visite"
                  aria-label="Supprimer cette visite"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <AlertDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
              >
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Supprimer cette visite ?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Visite du{" "}
                      {format(new Date(visit.created_at), "d MMM yyyy", {
                        locale: fr,
                      })}{" "}
                      chez {isPharm ? "" : "Dr. "}
                      {visit.doctor.last_name} {visit.doctor.first_name}.
                      Cette action est irréversible. Les commentaires seront
                      supprimés et toute planification liée sera remise en
                      attente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="cursor-pointer">
                      Annuler
                    </AlertDialogCancel>
                    <AlertDialogAction
                      disabled={deleting}
                      onClick={async (e) => {
                        e.preventDefault();
                        setDeleting(true);
                        try {
                          const res = await fetch(`/api/visits/${visit.id}`, {
                            method: "DELETE",
                          });
                          if (!res.ok) {
                            const err = await res.json();
                            throw new Error(err.error);
                          }
                          toast.success("Visite supprimée");
                          setShowDeleteDialog(false);
                          onDelete?.(visit.id);
                        } catch (err) {
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : "Erreur lors de la suppression"
                          );
                        } finally {
                          setDeleting(false);
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700 cursor-pointer"
                    >
                      {deleting ? "Suppression..." : "Supprimer"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      )}
    </div>
  );
}
