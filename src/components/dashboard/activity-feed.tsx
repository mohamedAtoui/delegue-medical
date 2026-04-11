"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Stethoscope, Pill, User, Clock, MessageSquare } from "lucide-react";
import { VisitDetailDialog } from "@/components/visits/visit-detail-dialog";
import type { VisitWithDetails } from "@/types";

function FeedItem({
  visit,
  onClick,
}: {
  visit: VisitWithDetails;
  onClick: () => void;
}) {
  const isPharm = visit.visit_type === "pharmacien";
  const Icon = isPharm ? Pill : Stethoscope;
  const iconColor = isPharm ? "text-accent" : "text-primary";
  const iconBg = isPharm ? "bg-accent/10" : "bg-primary/10";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex gap-3 py-2.5 px-2 -mx-2 rounded-lg border-b border-border/30 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">
            {isPharm ? "" : "Dr. "}
            {visit.doctor?.first_name} {visit.doctor?.last_name}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Clock className="h-3 w-3" />
            {format(new Date(visit.created_at), "HH:mm", { locale: fr })}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
          <User className="h-3 w-3" />
          {visit.user?.first_name} {visit.user?.last_name}
          {visit.comment_count != null && visit.comment_count > 0 && (
            <span className="ml-1 inline-flex items-center gap-0.5 text-primary/80">
              · <MessageSquare className="h-3 w-3" />
              {visit.comment_count}
            </span>
          )}
        </div>
        {visit.compte_rendu && (
          <p className="text-xs text-foreground/70 mt-1 line-clamp-2">
            {visit.compte_rendu}
          </p>
        )}
      </div>
    </button>
  );
}

export function ActivityFeed() {
  const [visits, setVisits] = useState<VisitWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<VisitWithDetails | null>(null);

  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/visits?all=true&limit=20");
      const data = await res.json();
      setVisits(data.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecent();

    const supabase = createClient();
    const channel = supabase
      .channel("visits-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "visits" },
        () => {
          fetchRecent();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRecent]);

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setSelected(null);
      fetchRecent();
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Activité en temps réel
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-[500px] overflow-y-auto">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : visits.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune activité récente
            </p>
          ) : (
            visits.map((visit) => (
              <FeedItem
                key={visit.id}
                visit={visit}
                onClick={() => setSelected(visit)}
              />
            ))
          )}
        </CardContent>
      </Card>

      <VisitDetailDialog
        visit={selected}
        open={!!selected}
        onOpenChange={handleDialogClose}
      />
    </>
  );
}
