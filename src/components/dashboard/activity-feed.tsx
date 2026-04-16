"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { DoctorVisitGroup } from "@/components/visits/visit-card";
import { MedicalLoader } from "@/components/ui/medical-loader";
import type { VisitWithDetails, DoctorType } from "@/types";

interface DoctorGroup {
  doctorId: string;
  doctorName: string;
  specialty: string | null;
  wilaya: string;
  doctorType: DoctorType;
  visits: VisitWithDetails[];
}

interface ActivityFeedProps {
  initialVisits?: VisitWithDetails[];
}

export function ActivityFeed({ initialVisits }: ActivityFeedProps = {}) {
  const hasInitial = initialVisits !== undefined;
  const [visits, setVisits] = useState<VisitWithDetails[]>(initialVisits || []);
  const [loading, setLoading] = useState(!hasInitial);

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
    // If we have server-rendered initial data, skip the immediate fetch but
    // still subscribe to realtime updates so new visits stream in.
    if (!hasInitial) {
      fetchRecent();
    }

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
  }, [fetchRecent, hasInitial]);

  const groups = useMemo(() => {
    const map = new Map<string, DoctorGroup>();
    for (const visit of visits) {
      const id = visit.doctor_id;
      const isPharm = visit.doctor?.doctor_type === "pharmacien";
      if (!map.has(id)) {
        map.set(id, {
          doctorId: id,
          doctorName: `${isPharm ? "" : "Dr. "}${visit.doctor?.last_name || ""} ${visit.doctor?.first_name || ""}`.trim(),
          specialty: visit.doctor?.specialty || null,
          wilaya: visit.doctor?.wilaya || "",
          doctorType: (visit.doctor?.doctor_type || "medecin") as DoctorType,
          visits: [],
        });
      }
      map.get(id)!.visits.push(visit);
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.visits[0].created_at).getTime() -
        new Date(a.visits[0].created_at).getTime()
    );
  }, [visits]);

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
          <MedicalLoader variant="inline" className="min-h-[200px]" />
        ) : visits.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucune activité récente
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <DoctorVisitGroup
                key={group.doctorId}
                doctorName={group.doctorName}
                specialty={group.specialty}
                wilaya={group.wilaya}
                visits={group.visits}
                doctorType={group.doctorType}
                showUser
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
