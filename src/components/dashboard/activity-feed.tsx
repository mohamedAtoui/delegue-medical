"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { VisitEntry } from "@/components/visits/visit-entry";
import type { VisitWithDetails } from "@/types";

export function ActivityFeed() {
  const [visits, setVisits] = useState<VisitWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
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
            <div className="space-y-2">
              {visits.map((visit) => (
                <VisitEntry
                  key={visit.id}
                  visit={visit}
                  showUser
                  showDoctor
                />
              ))}
            </div>
          )}
        </CardContent>
    </Card>
  );
}
