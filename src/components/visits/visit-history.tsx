"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DoctorVisitGroup } from "./visit-card";
import { Button } from "@/components/ui/button";
import { MedicalLoader } from "@/components/ui/medical-loader";
import type { VisitWithDetails, DoctorType } from "@/types";

interface VisitHistoryProps {
  refreshKey?: number;
  showUser?: boolean;
  fetchUrl?: string;
  typeFilter?: "all" | DoctorType;
  from?: string;
  to?: string;
  wilaya?: string;
  userId?: string;
  search?: string;
  initialVisits?: VisitWithDetails[];
  initialTotal?: number;
}

interface DoctorGroup {
  doctorId: string;
  doctorName: string;
  specialty: string | null;
  wilaya: string;
  doctorType: DoctorType;
  visits: VisitWithDetails[];
}

function groupByDoctor(visits: VisitWithDetails[]): DoctorGroup[] {
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
  return Array.from(groupMap.values()).sort(
    (a, b) =>
      new Date(b.visits[0].created_at).getTime() -
      new Date(a.visits[0].created_at).getTime()
  );
}

export function VisitHistory({
  refreshKey = 0,
  showUser = false,
  fetchUrl = "/api/visits",
  typeFilter = "all",
  from,
  to,
  wilaya,
  userId,
  search,
  initialVisits,
  initialTotal,
}: VisitHistoryProps) {
  const hasInitial = initialVisits !== undefined;
  const [groups, setGroups] = useState<DoctorGroup[]>(() =>
    hasInitial ? groupByDoctor(initialVisits!) : []
  );
  const [loading, setLoading] = useState(!hasInitial);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initialTotal ?? 0);

  // Skip the very first fetch when initial data was provided server-side.
  const skipNext = useRef(hasInitial);

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(fetchUrl, window.location.origin);
      url.searchParams.set("page", "1");
      url.searchParams.set("limit", String(page * 50));
      if (showUser) url.searchParams.set("all", "true");
      if (typeFilter !== "all") url.searchParams.set("type", typeFilter);
      if (from) url.searchParams.set("from", from);
      if (to) url.searchParams.set("to", to);
      if (wilaya) url.searchParams.set("wilaya", wilaya);
      if (userId) url.searchParams.set("user_id", userId);
      if (search) url.searchParams.set("search", search);

      const res = await fetch(url.toString());
      const data = await res.json();
      const visits: VisitWithDetails[] = data.data || [];
      setTotal(data.count || 0);
      setGroups(groupByDoctor(visits));
    } finally {
      setLoading(false);
    }
  }, [fetchUrl, showUser, page, typeFilter, from, to, wilaya, userId, search]);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    fetchVisits();
  }, [fetchVisits, refreshKey]);

  if (loading && groups.length === 0) {
    return <MedicalLoader variant="inline" />;
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Aucune visite enregistrée</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-3">
      {loading && <MedicalLoader variant="overlay" />}

      {groups.map((group) => (
        <DoctorVisitGroup
          key={group.doctorId}
          doctorName={group.doctorName}
          specialty={group.specialty}
          wilaya={group.wilaya}
          visits={group.visits}
          doctorType={group.doctorType}
          showUser={showUser}
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
  );
}
