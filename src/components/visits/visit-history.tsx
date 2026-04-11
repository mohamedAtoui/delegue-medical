"use client";

import { useState, useEffect, useCallback } from "react";
import { DoctorVisitGroup } from "./visit-card";
import { VisitDetailDialog } from "./visit-detail-dialog";
import { Button } from "@/components/ui/button";
import type { VisitWithDetails, DoctorType } from "@/types";

interface VisitHistoryProps {
  refreshKey?: number;
  showUser?: boolean;
  fetchUrl?: string;
  typeFilter?: "all" | DoctorType;
  from?: string;
  wilaya?: string;
  userId?: string;
  search?: string;
}

interface DoctorGroup {
  doctorId: string;
  doctorName: string;
  specialty: string | null;
  wilaya: string;
  doctorType: DoctorType;
  visits: VisitWithDetails[];
}

export function VisitHistory({
  refreshKey = 0,
  showUser = false,
  fetchUrl = "/api/visits",
  typeFilter = "all",
  from,
  wilaya,
  userId,
  search,
}: VisitHistoryProps) {
  const [groups, setGroups] = useState<DoctorGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedVisit, setSelectedVisit] = useState<VisitWithDetails | null>(null);

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(fetchUrl, window.location.origin);
      url.searchParams.set("page", "1");
      url.searchParams.set("limit", String(page * 50));
      if (showUser) url.searchParams.set("all", "true");
      if (typeFilter !== "all") url.searchParams.set("type", typeFilter);
      if (from) url.searchParams.set("from", from);
      if (wilaya) url.searchParams.set("wilaya", wilaya);
      if (userId) url.searchParams.set("user_id", userId);
      if (search) url.searchParams.set("search", search);

      const res = await fetch(url.toString());
      const data = await res.json();
      const visits: VisitWithDetails[] = data.data || [];
      setTotal(data.count || 0);

      const groupMap = new Map<string, DoctorGroup>();
      for (const visit of visits) {
        const doctorId = visit.doctor_id;
        if (!groupMap.has(doctorId)) {
          const isPharm = visit.doctor?.doctor_type === "pharmacien";
          groupMap.set(doctorId, {
            doctorId,
            doctorName: `${isPharm ? "" : "Dr. "}${visit.doctor?.last_name || ""} ${visit.doctor?.first_name || ""}`.trim(),
            specialty: visit.doctor?.specialty || null,
            wilaya: visit.doctor?.wilaya || "",
            doctorType: (visit.doctor?.doctor_type || "medecin") as DoctorType,
            visits: [],
          });
        }
        groupMap.get(doctorId)!.visits.push(visit);
      }

      const sorted = Array.from(groupMap.values()).sort(
        (a, b) =>
          new Date(b.visits[0].created_at).getTime() -
          new Date(a.visits[0].created_at).getTime()
      );

      setGroups(sorted);
    } finally {
      setLoading(false);
    }
  }, [fetchUrl, showUser, page, typeFilter, from, wilaya, userId, search]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits, refreshKey]);

  const handleVisitClick = async (visit: VisitWithDetails) => {
    setSelectedVisit(visit);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setSelectedVisit(null);
      // refresh to update comment counts
      fetchVisits();
    }
  };

  if (loading && groups.length === 0) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Aucune visite enregistrée</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {groups.map((group) => (
          <DoctorVisitGroup
            key={group.doctorId}
            doctorName={group.doctorName}
            specialty={group.specialty}
            wilaya={group.wilaya}
            visits={group.visits}
            doctorType={group.doctorType}
            showUser={showUser}
            onVisitClick={handleVisitClick}
          />
        ))}

        {total > page * 50 && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              className="cursor-pointer"
            >
              Voir plus
            </Button>
          </div>
        )}
      </div>

      <VisitDetailDialog
        visit={selectedVisit}
        open={!!selectedVisit}
        onOpenChange={handleDialogClose}
      />
    </>
  );
}
