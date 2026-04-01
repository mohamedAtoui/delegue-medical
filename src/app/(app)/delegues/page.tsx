"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DoctorVisitGroup } from "@/components/visits/visit-card";
import { WILAYAS } from "@/lib/constants/wilayas";
import { toast } from "sonner";
import {
  User,
  ClipboardList,
  MapPin,
  Phone,
  Search,
  Calendar,
  Stethoscope,
  Clock,
  Save,
  Pencil,
} from "lucide-react";
import type { User as UserType, VisitWithDetails } from "@/types";

type GroupBy = "doctor" | "date" | "wilaya";
type DateRange = "today" | "week" | "month" | "all";

export default function DeleguesPage() {
  const [reps, setReps] = useState<UserType[]>([]);
  const [selectedRep, setSelectedRep] = useState<UserType | null>(null);
  const [visits, setVisits] = useState<VisitWithDetails[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);

  // Filters
  const [groupBy, setGroupBy] = useState<GroupBy>("doctor");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [searchDoctor, setSearchDoctor] = useState("");

  // Wilaya editing
  const [editingWilayas, setEditingWilayas] = useState(false);
  const [editWilayas, setEditWilayas] = useState<string[]>([]);
  const [savingWilayas, setSavingWilayas] = useState(false);

  useEffect(() => {
    fetch("/api/users?role=delegue")
      .then((res) => res.json())
      .then((data) => setReps(Array.isArray(data) ? data : []))
      .catch(() => setReps([]));
  }, []);

  const fetchVisits = useCallback(async (userId: string) => {
    setLoadingVisits(true);
    try {
      const res = await fetch(`/api/visits?user_id=${userId}&all=true&limit=200`);
      const data = await res.json();
      setVisits(data.data || []);
    } finally {
      setLoadingVisits(false);
    }
  }, []);

  const selectRep = (rep: UserType) => {
    setSelectedRep(rep);
    setSearchDoctor("");
    setDateRange("all");
    fetchVisits(rep.id);
  };

  // Filter visits
  const filteredVisits = useMemo(() => {
    let result = visits;

    // Date filter
    if (dateRange !== "all") {
      const now = new Date();
      const from = new Date();
      if (dateRange === "today") from.setHours(0, 0, 0, 0);
      else if (dateRange === "week") from.setDate(now.getDate() - 7);
      else if (dateRange === "month") from.setMonth(now.getMonth() - 1);
      result = result.filter((v) => new Date(v.created_at) >= from);
    }

    // Doctor search
    if (searchDoctor) {
      const s = searchDoctor.toLowerCase();
      result = result.filter(
        (v) =>
          v.doctor?.first_name?.toLowerCase().includes(s) ||
          v.doctor?.last_name?.toLowerCase().includes(s)
      );
    }

    return result;
  }, [visits, dateRange, searchDoctor]);

  // Group visits
  const groupedContent = useMemo(() => {
    if (groupBy === "doctor") {
      const map = new Map<string, { doctorName: string; specialty: string | null; wilaya: string; visits: VisitWithDetails[] }>();
      for (const v of filteredVisits) {
        const id = v.doctor_id;
        if (!map.has(id)) {
          map.set(id, {
            doctorName: `Dr. ${v.doctor?.first_name || ""} ${v.doctor?.last_name || ""}`,
            specialty: v.doctor?.specialty || null,
            wilaya: v.doctor?.wilaya || "",
            visits: [],
          });
        }
        map.get(id)!.visits.push(v);
      }
      return { type: "doctor" as const, groups: Array.from(map.values()) };
    }

    if (groupBy === "date") {
      const map = new Map<string, VisitWithDetails[]>();
      for (const v of filteredVisits) {
        const day = format(new Date(v.created_at), "yyyy-MM-dd");
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push(v);
      }
      return { type: "date" as const, groups: Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])) };
    }

    // Group by wilaya
    const map = new Map<string, VisitWithDetails[]>();
    for (const v of filteredVisits) {
      const w = v.doctor?.wilaya || "Inconnu";
      if (!map.has(w)) map.set(w, []);
      map.get(w)!.push(v);
    }
    return { type: "wilaya" as const, groups: Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])) };
  }, [filteredVisits, groupBy]);

  // Stats
  const stats = useMemo(() => {
    const uniqueDoctors = new Set(filteredVisits.map((v) => v.doctor_id)).size;
    const lastActivity = filteredVisits[0]?.created_at;
    return { total: filteredVisits.length, uniqueDoctors, lastActivity };
  }, [filteredVisits]);

  const saveWilayas = async () => {
    if (!selectedRep) return;
    setSavingWilayas(true);
    try {
      await fetch("/api/territories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedRep.id, wilayas: editWilayas }),
      });
      setReps((prev) =>
        prev.map((r) => (r.id === selectedRep.id ? { ...r, wilayas: editWilayas } : r))
      );
      setSelectedRep((prev) => prev ? { ...prev, wilayas: editWilayas } : prev);
      toast.success("Wilayas mises à jour");
      setEditingWilayas(false);
    } catch {
      toast.error("Erreur");
    } finally {
      setSavingWilayas(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Délégués</h1>
        <p className="text-sm text-muted-foreground">
          Consulter et analyser les visites de chaque délégué
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Rep list */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Équipe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {reps.map((rep) => (
              <button
                key={rep.id}
                onClick={() => selectRep(rep)}
                className={`w-full rounded-lg px-3 py-3 text-left text-sm transition-colors cursor-pointer ${
                  selectedRep?.id === rep.id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">
                    {rep.first_name} {rep.last_name}
                  </span>
                </div>
                {rep.phone && (
                  <div className="flex items-center gap-1 mt-1 ml-6 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {rep.phone}
                  </div>
                )}
                {rep.wilayas && rep.wilayas.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5 ml-6">
                    {rep.wilayas.map((w) => (
                      <Badge key={w} variant="outline" className="text-[10px] px-1.5 py-0">
                        {w}
                      </Badge>
                    ))}
                  </div>
                )}
              </button>
            ))}
            {reps.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun délégué
              </p>
            )}
          </CardContent>
        </Card>

        {/* Right panel */}
        <div className="lg:col-span-3 space-y-4">
          {selectedRep ? (
            <>
              {/* Rep header + stats */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {selectedRep.first_name} {selectedRep.last_name}
                      </h2>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {selectedRep.wilayas?.map((w) => (
                          <Badge key={w} variant="secondary" className="text-xs">
                            <MapPin className="mr-1 h-3 w-3" />
                            {w}
                          </Badge>
                        ))}
                        <button
                          onClick={() => {
                            setEditWilayas(selectedRep.wilayas || []);
                            setEditingWilayas(true);
                          }}
                          className="text-xs text-primary hover:underline cursor-pointer"
                        >
                          <Pencil className="inline h-3 w-3 mr-1" />
                          Modifier
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-primary">{stats.total}</p>
                        <p className="text-xs text-muted-foreground">Visites</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-primary">{stats.uniqueDoctors}</p>
                        <p className="text-xs text-muted-foreground">Médecins</p>
                      </div>
                      {stats.lastActivity && (
                        <div>
                          <p className="text-sm font-medium">
                            {format(new Date(stats.lastActivity), "d MMM", { locale: fr })}
                          </p>
                          <p className="text-xs text-muted-foreground">Dernière activité</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Filter bar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Select value={groupBy} onValueChange={(v) => setGroupBy((v as GroupBy) || "doctor")}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doctor">
                      <span className="flex items-center gap-2"><Stethoscope className="h-3 w-3" /> Par médecin</span>
                    </SelectItem>
                    <SelectItem value="date">
                      <span className="flex items-center gap-2"><Calendar className="h-3 w-3" /> Par date</span>
                    </SelectItem>
                    <SelectItem value="wilaya">
                      <span className="flex items-center gap-2"><MapPin className="h-3 w-3" /> Par wilaya</span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select value={dateRange} onValueChange={(v) => setDateRange((v as DateRange) || "all")}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Aujourd&apos;hui</SelectItem>
                    <SelectItem value="week">Cette semaine</SelectItem>
                    <SelectItem value="month">Ce mois</SelectItem>
                    <SelectItem value="all">Tout</SelectItem>
                  </SelectContent>
                </Select>

                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Chercher un médecin..."
                    value={searchDoctor}
                    onChange={(e) => setSearchDoctor(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Results */}
              {loadingVisits ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 rounded-lg bg-muted/50 animate-pulse" />
                  ))}
                </div>
              ) : filteredVisits.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground">Aucune visite trouvée</p>
                </div>
              ) : groupedContent.type === "doctor" ? (
                <div className="space-y-3">
                  {groupedContent.groups.map((group, i) => (
                    <DoctorVisitGroup
                      key={i}
                      doctorName={group.doctorName}
                      specialty={group.specialty}
                      wilaya={group.wilaya}
                      visits={group.visits}
                      showUser
                      highlightUserId={selectedRep?.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedContent.groups.map(([key, groupVisits]) => (
                    <div key={key}>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                        {groupedContent.type === "date" ? (
                          <>
                            <Clock className="h-4 w-4" />
                            {format(new Date(key), "EEEE d MMMM yyyy", { locale: fr })}
                          </>
                        ) : (
                          <>
                            <MapPin className="h-4 w-4" />
                            {key}
                          </>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {groupVisits.length}
                        </Badge>
                      </h3>
                      <div className="space-y-2 ml-6">
                        {groupVisits.map((v) => (
                          <Card key={v.id} className="p-3">
                            <div className="flex items-center justify-between text-sm">
                              <div>
                                <span className="font-medium">
                                  Dr. {v.doctor?.first_name} {v.doctor?.last_name}
                                </span>
                                {v.doctor?.specialty && (
                                  <Badge variant="secondary" className="ml-2 text-xs">{v.doctor.specialty}</Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(v.created_at), "HH:mm", { locale: fr })}
                              </span>
                            </div>
                            {v.notes && (
                              <p className="text-sm text-foreground/80 mt-2 bg-muted/30 rounded p-2">
                                {v.notes}
                              </p>
                            )}
                          </Card>
                        ))}
                      </div>
                    </div>
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

      {/* Wilaya edit dialog */}
      <Dialog open={editingWilayas} onOpenChange={setEditingWilayas}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Wilayas de {selectedRep?.first_name} {selectedRep?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 py-4">
            {WILAYAS.map((w) => {
              const selected = editWilayas.includes(w.name);
              return (
                <Badge
                  key={w.code}
                  variant={selected ? "default" : "outline"}
                  className="cursor-pointer select-none transition-all hover:scale-105"
                  onClick={() =>
                    setEditWilayas((prev) =>
                      selected ? prev.filter((x) => x !== w.name) : [...prev, w.name]
                    )
                  }
                >
                  <MapPin className="mr-1 h-3 w-3" />
                  {w.code} - {w.name}
                </Badge>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button onClick={saveWilayas} disabled={savingWilayas} className="cursor-pointer">
              <Save className="mr-2 h-4 w-4" />
              {savingWilayas ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
