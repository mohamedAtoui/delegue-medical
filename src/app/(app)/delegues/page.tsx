"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DoctorVisitGroup } from "@/components/visits/visit-card";
import { User, ClipboardList, MapPin } from "lucide-react";
import type { User as UserType, VisitWithDetails } from "@/types";

export default function DeleguesPage() {
  const [reps, setReps] = useState<UserType[]>([]);
  const [selectedRep, setSelectedRep] = useState<UserType | null>(null);
  const [visits, setVisits] = useState<VisitWithDetails[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);

  useEffect(() => {
    fetch("/api/users?role=delegue")
      .then((res) => res.json())
      .then((data) => setReps(Array.isArray(data) ? data : data.data || []))
      .catch(() => setReps([]));
  }, []);

  const fetchVisits = useCallback(async (userId: string) => {
    setLoadingVisits(true);
    try {
      const res = await fetch(`/api/visits?user_id=${userId}&all=true&limit=100`);
      const data = await res.json();
      setVisits(data.data || []);
    } finally {
      setLoadingVisits(false);
    }
  }, []);

  const selectRep = (rep: UserType) => {
    setSelectedRep(rep);
    fetchVisits(rep.id);
  };

  // Group visits by doctor
  const groupedVisits = visits.reduce((acc, visit) => {
    const doctorId = visit.doctor_id;
    if (!acc.has(doctorId)) {
      acc.set(doctorId, {
        doctorName: `Dr. ${visit.doctor?.first_name || ""} ${visit.doctor?.last_name || ""}`,
        specialty: visit.doctor?.specialty || null,
        wilaya: visit.doctor?.wilaya || "",
        visits: [],
      });
    }
    acc.get(doctorId)!.visits.push(visit);
    return acc;
  }, new Map<string, { doctorName: string; specialty: string | null; wilaya: string; visits: VisitWithDetails[] }>());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Délégués</h1>
        <p className="text-sm text-muted-foreground">
          Consulter les visites de chaque délégué
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Rep list */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Équipe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[600px] overflow-y-auto">
            {reps.map((rep) => (
              <button
                key={rep.id}
                onClick={() => selectRep(rep)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                  selectedRep?.id === rep.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted"
                }`}
              >
                <User className="h-4 w-4 shrink-0" />
                <span>
                  {rep.first_name} {rep.last_name}
                </span>
              </button>
            ))}
            {reps.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun délégué
              </p>
            )}
          </CardContent>
        </Card>

        {/* Visits for selected rep */}
        <div className="lg:col-span-3 space-y-4">
          {selectedRep ? (
            <>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">
                  Visites de {selectedRep.first_name} {selectedRep.last_name}
                </h2>
                <Badge variant="secondary">
                  <ClipboardList className="mr-1 h-3 w-3" />
                  {visits.length} visite{visits.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              {loadingVisits ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 rounded-lg bg-muted/50 animate-pulse" />
                  ))}
                </div>
              ) : visits.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Aucune visite enregistrée</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.from(groupedVisits.entries()).map(([doctorId, group]) => (
                    <DoctorVisitGroup
                      key={doctorId}
                      doctorName={group.doctorName}
                      specialty={group.specialty}
                      wilaya={group.wilaya}
                      visits={group.visits}
                      showUser={false}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20">
              <User className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">
                Sélectionnez un délégué pour voir ses visites
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
