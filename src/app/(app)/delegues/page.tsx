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
import { VisitEntry } from "@/components/visits/visit-entry";
import { AssignmentList } from "@/components/assignments/assignment-list";
import { UserAvatar } from "@/components/shared/user-avatar";
import { WILAYAS } from "@/lib/constants/wilayas";
import {
  DateRangeFilter,
  resolveDateRange,
  type DateRangeValue,
} from "@/components/shared/date-range-filter";
import { toast } from "sonner";
import {
  User,
  ClipboardList,
  MapPin,
  Phone,
  Search,
  Calendar,
  Stethoscope,
  Pill,
  Users,
  Clock,
  Save,
  Pencil,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { User as UserType, VisitWithDetails, DoctorType } from "@/types";

type GroupBy = "doctor" | "date" | "wilaya";
type TypeFilter = "" | DoctorType;

export default function DeleguesPage() {
  const [reps, setReps] = useState<UserType[]>([]);
  const [selectedRep, setSelectedRep] = useState<UserType | null>(null);
  const [visits, setVisits] = useState<VisitWithDetails[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);

  // Filters
  const [groupBy, setGroupBy] = useState<GroupBy>("doctor");
  const [dateRange, setDateRange] = useState<DateRangeValue>({ preset: "" });
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("");
  const [searchDoctor, setSearchDoctor] = useState("");

  // Wilaya editing
  const [editingWilayas, setEditingWilayas] = useState(false);
  const [editWilayas, setEditWilayas] = useState<string[]>([]);
  const [savingWilayas, setSavingWilayas] = useState(false);

  // Goal editing
  const [editingGoal, setEditingGoal] = useState(false);
  const [editGoalValue, setEditGoalValue] = useState<string>("0");
  const [savingGoal, setSavingGoal] = useState(false);

  // Invitations
  const [invites, setInvites] = useState<import("@/types").Invitation[]>([]);
  const [showInvites, setShowInvites] = useState(false);
  const [newInviteEmail, setNewInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  // View tab (visites vs planification)
  const [viewTab, setViewTab] = useState<"visites" | "planification">("visites");

  // (dialog removed — visits expand inline now)

  const fetchReps = useCallback(() => {
    fetch("/api/users?role=delegue&with_today_count=true")
      .then((res) => res.json())
      .then((data) => setReps(Array.isArray(data) ? data : []))
      .catch(() => setReps([]));
  }, []);

  useEffect(() => {
    fetchReps();
  }, [fetchReps]);

  const fetchVisits = useCallback(async (userId: string) => {
    setLoadingVisits(true);
    try {
      // Get this rep's visits only
      const repRes = await fetch(`/api/visits?user_id=${userId}&limit=200`);
      const repData = await repRes.json();
      const repVisits: VisitWithDetails[] = repData.data || [];

      const doctorIds = [...new Set(repVisits.map((v) => v.doctor_id))];

      if (doctorIds.length > 0) {
        const allPromises = doctorIds.map((id) =>
          fetch(`/api/visits?doctor_id=${id}&all=true&limit=50`).then((r) => r.json())
        );
        const allResults = await Promise.all(allPromises);
        const allVisits: VisitWithDetails[] = allResults.flatMap((r) => r.data || []);

        const visitMap = new Map<string, VisitWithDetails>();
        for (const v of allVisits) visitMap.set(v.id, v);
        setVisits(
          Array.from(visitMap.values()).sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        );
      } else {
        setVisits([]);
      }
    } finally {
      setLoadingVisits(false);
    }
  }, []);

  const selectRep = (rep: UserType) => {
    setSelectedRep(rep);
    setSearchDoctor("");
    setDateRange({ preset: "" });
    setTypeFilter("");
    fetchVisits(rep.id);
  };

  // Filter visits
  const filteredVisits = useMemo(() => {
    if (!selectedRep) return visits;

    // Step 1: filter only this rep's visits by filters
    let repVisits = visits.filter((v) => v.user_id === selectedRep.id);

    const { from: fromIso, to: toIso } = resolveDateRange(dateRange);
    if (fromIso) {
      const fromTs = new Date(fromIso).getTime();
      repVisits = repVisits.filter(
        (v) => new Date(v.created_at).getTime() >= fromTs
      );
    }
    if (toIso) {
      const toTs = new Date(toIso).getTime();
      repVisits = repVisits.filter(
        (v) => new Date(v.created_at).getTime() <= toTs
      );
    }

    if (typeFilter) {
      repVisits = repVisits.filter((v) => {
        const t = v.doctor?.doctor_type || v.visit_type;
        return t === typeFilter;
      });
    }

    if (searchDoctor) {
      const s = searchDoctor.toLowerCase();
      repVisits = repVisits.filter(
        (v) =>
          v.doctor?.first_name?.toLowerCase().includes(s) ||
          v.doctor?.last_name?.toLowerCase().includes(s)
      );
    }

    const matchedDoctorIds = new Set(repVisits.map((v) => v.doctor_id));
    return visits.filter((v) => matchedDoctorIds.has(v.doctor_id));
  }, [visits, dateRange, searchDoctor, selectedRep, typeFilter]);

  // Group visits
  const groupedContent = useMemo(() => {
    if (groupBy === "doctor") {
      const map = new Map<
        string,
        {
          doctorId: string;
          doctorName: string;
          specialty: string | null;
          wilaya: string;
          address: string | null;
          doctorType: DoctorType;
          visits: VisitWithDetails[];
        }
      >();
      for (const v of filteredVisits) {
        const id = v.doctor_id;
        const isPharm = v.doctor?.doctor_type === "pharmacien";
        if (!map.has(id)) {
          map.set(id, {
            doctorId: id,
            doctorName: `${isPharm ? "" : "Dr. "}${v.doctor?.last_name || ""} ${v.doctor?.first_name || ""}`.trim(),
            specialty: v.doctor?.specialty || null,
            wilaya: v.doctor?.wilaya || "",
            address: v.doctor?.address || null,
            doctorType: (v.doctor?.doctor_type || "medecin") as DoctorType,
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
      return {
        type: "date" as const,
        groups: Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])),
      };
    }

    const map = new Map<string, VisitWithDetails[]>();
    for (const v of filteredVisits) {
      const w = v.doctor?.wilaya || "Inconnu";
      if (!map.has(w)) map.set(w, []);
      map.get(w)!.push(v);
    }
    return {
      type: "wilaya" as const,
      groups: Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])),
    };
  }, [filteredVisits, groupBy]);

  // Stats
  const stats = useMemo(() => {
    const repOnly = selectedRep
      ? filteredVisits.filter((v) => v.user_id === selectedRep.id)
      : filteredVisits;
    const uniqueDoctors = new Set(repOnly.map((v) => v.doctor_id)).size;
    const lastActivity = repOnly[0]?.created_at;
    const medecinCount = repOnly.filter(
      (v) => (v.doctor?.doctor_type || v.visit_type) === "medecin"
    ).length;
    const pharmCount = repOnly.filter(
      (v) => (v.doctor?.doctor_type || v.visit_type) === "pharmacien"
    ).length;
    return {
      total: repOnly.length,
      uniqueDoctors,
      lastActivity,
      medecinCount,
      pharmCount,
    };
  }, [filteredVisits, selectedRep]);

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
      setSelectedRep((prev) => (prev ? { ...prev, wilayas: editWilayas } : prev));
      toast.success("Wilayas mises à jour");
      setEditingWilayas(false);
    } catch {
      toast.error("Erreur");
    } finally {
      setSavingWilayas(false);
    }
  };

  const saveGoal = async () => {
    if (!selectedRep) return;
    const goal = parseInt(editGoalValue, 10);
    if (isNaN(goal) || goal < 0 || goal > 100) {
      toast.error("Entrez un nombre entre 0 et 100");
      return;
    }
    setSavingGoal(true);
    try {
      const res = await fetch(`/api/users/${selectedRep.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_visit_goal: goal }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setReps((prev) =>
        prev.map((r) => (r.id === selectedRep.id ? { ...r, daily_visit_goal: goal } : r))
      );
      setSelectedRep((prev) => (prev ? { ...prev, daily_visit_goal: goal } : prev));
      toast.success("Objectif mis à jour");
      setEditingGoal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingGoal(false);
    }
  };

  // Invitations
  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch("/api/invitations");
      const data = await res.json();
      setInvites(Array.isArray(data) ? data : []);
    } catch {
      setInvites([]);
    }
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const addInvite = async () => {
    const email = newInviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Email invalide");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.success("Invitation envoyée");
      setNewInviteEmail("");
      fetchInvites();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setInviting(false);
    }
  };

  const deleteInvite = async (id: string) => {
    try {
      const res = await fetch(`/api/invitations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.success("Invitation supprimée");
      fetchInvites();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
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

      {/* Invitations / allowlist manager */}
      <Card>
        <CardContent className="p-4">
          <button
            type="button"
            onClick={() => setShowInvites(!showInvites)}
            className="w-full flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">
                Inviter un délégué
              </span>
              {invites.filter((i) => !i.signed_up).length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {invites.filter((i) => !i.signed_up).length} en attente
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {showInvites ? "Réduire" : "Gérer les invitations"}
            </span>
          </button>

          {showInvites && (
            <div className="mt-4 space-y-3 pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                Seuls les emails ajoutés ici peuvent créer un compte délégué.
              </p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={newInviteEmail}
                  onChange={(e) => setNewInviteEmail(e.target.value)}
                  placeholder="email@exemple.com"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addInvite();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={addInvite}
                  disabled={inviting || !newInviteEmail.trim()}
                  className="cursor-pointer"
                >
                  {inviting ? "..." : "Inviter"}
                </Button>
              </div>

              {invites.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-2">
                  Aucune invitation
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {invites.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="truncate">{inv.email}</span>
                        {inv.signed_up ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px]">
                            Inscrit
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            En attente
                          </Badge>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteInvite(inv.id)}
                        className="text-xs text-red-600 hover:underline cursor-pointer"
                        title="Supprimer cette invitation"
                      >
                        Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
                className={cn(
                  "w-full rounded-lg px-3 py-3 text-left text-sm transition-colors cursor-pointer",
                  selectedRep?.id === rep.id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted border border-transparent"
                )}
              >
                <div className="flex items-center gap-2">
                  <UserAvatar
                    firstName={rep.first_name}
                    lastName={rep.last_name}
                    imageUrl={rep.avatar_url}
                    size="sm"
                  />
                  <span className="font-bold">
                    {rep.first_name} {rep.last_name}
                  </span>
                </div>
                {rep.phone && (
                  <div className="flex items-center gap-1 mt-1 ml-8 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {rep.phone}
                  </div>
                )}
                {rep.wilayas && rep.wilayas.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5 ml-8">
                    {rep.wilayas.slice(0, 3).map((w) => (
                      <Badge key={w} variant="outline" className="text-[10px] px-1.5 py-0">
                        {w}
                      </Badge>
                    ))}
                    {rep.wilayas.length > 3 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        +{rep.wilayas.length - 3}
                      </Badge>
                    )}
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
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        firstName={selectedRep.first_name}
                        lastName={selectedRep.last_name}
                        imageUrl={selectedRep.avatar_url}
                        size="lg"
                      />
                      <div>
                        <h2 className="text-lg font-bold">
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
                    </div>

                    <div className="flex flex-wrap gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-primary">{stats.total}</p>
                        <p className="text-xs text-muted-foreground">Visites</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-primary">
                          {stats.uniqueDoctors}
                        </p>
                        <p className="text-xs text-muted-foreground">Uniques</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-primary">
                          {stats.medecinCount}
                        </p>
                        <p className="text-xs text-muted-foreground">Médecins</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-accent">
                          {stats.pharmCount}
                        </p>
                        <p className="text-xs text-muted-foreground">Pharmaciens</p>
                      </div>
                      {stats.lastActivity && (
                        <div>
                          <p className="text-sm font-medium">
                            {format(new Date(stats.lastActivity), "d MMM", { locale: fr })}
                          </p>
                          <p className="text-xs text-muted-foreground">Dernière</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Objectif du jour */}
                  <div className="mt-4 pt-4 border-t border-border/40">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground/80">
                          Objectif du jour
                        </span>
                        {selectedRep.daily_visit_goal && selectedRep.daily_visit_goal > 0 ? (
                          <span className="text-sm text-muted-foreground">
                            {selectedRep.today_count || 0} / {selectedRep.daily_visit_goal} visites
                            {" "}
                            <span
                              className={cn(
                                "font-semibold",
                                (selectedRep.today_count || 0) >= selectedRep.daily_visit_goal
                                  ? "text-green-600"
                                  : "text-amber-600"
                              )}
                            >
                              ({Math.min(
                                100,
                                Math.round(
                                  ((selectedRep.today_count || 0) / selectedRep.daily_visit_goal) *
                                    100
                                )
                              )}
                              %)
                            </span>
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">
                            Aucun objectif défini
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setEditGoalValue(String(selectedRep.daily_visit_goal || 0));
                          setEditingGoal(true);
                        }}
                        className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Pencil className="h-3 w-3" />
                        Modifier
                      </button>
                    </div>
                    {selectedRep.daily_visit_goal && selectedRep.daily_visit_goal > 0 && (
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all",
                            (selectedRep.today_count || 0) >= selectedRep.daily_visit_goal
                              ? "bg-green-500"
                              : "bg-primary"
                          )}
                          style={{
                            width: `${Math.min(
                              100,
                              ((selectedRep.today_count || 0) / selectedRep.daily_visit_goal) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Main view toggle: Visites / Planification */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-lg">
                {([
                  { key: "visites" as const, label: "Visites", icon: ClipboardList },
                  { key: "planification" as const, label: "Planification", icon: CalendarCheck },
                ]).map((tab) => {
                  const TabIcon = tab.icon;
                  const active = viewTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setViewTab(tab.key)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium transition-all cursor-pointer",
                        active
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <TabIcon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Planification tab content */}
              {viewTab === "planification" && (
                <AssignmentList assigneeId={selectedRep.id} />
              )}

              {/* Visites tab content */}
              {viewTab === "visites" && (<>

              {/* Type tabs */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-muted/40 rounded-lg">
                {([
                  { key: "", label: "Toutes", icon: Users },
                  { key: "medecin", label: "Médecins", icon: Stethoscope },
                  { key: "pharmacien", label: "Pharmaciens", icon: Pill },
                ] as { key: TypeFilter; label: string; icon: typeof Users }[]).map((tab) => {
                  const Icon = tab.icon;
                  const active = typeFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setTypeFilter(tab.key)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all cursor-pointer",
                        active
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Filter bar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Select
                  value={groupBy}
                  onValueChange={(v) => setGroupBy((v as GroupBy) || "doctor")}
                >
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doctor">
                      <span className="flex items-center gap-2">
                        <Stethoscope className="h-3 w-3" /> Par médecin
                      </span>
                    </SelectItem>
                    <SelectItem value="date">
                      <span className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" /> Par date
                      </span>
                    </SelectItem>
                    <SelectItem value="wilaya">
                      <span className="flex items-center gap-2">
                        <MapPin className="h-3 w-3" /> Par wilaya
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <DateRangeFilter
                  value={dateRange}
                  onChange={setDateRange}
                  className="w-full sm:flex-1"
                />

                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Chercher un médecin/pharmacien..."
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
                  {groupedContent.groups.map((group) => (
                    <DoctorVisitGroup
                      key={group.doctorId}
                      doctorId={group.doctorId}
                      doctorName={group.doctorName}
                      specialty={group.specialty}
                      wilaya={group.wilaya}
                      address={group.address}
                      visits={group.visits}
                      doctorType={group.doctorType}
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
                          <VisitEntry
                            key={v.id}
                            visit={v}
                            showUser
                            highlightUserId={selectedRep?.id}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              </>)}
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
            <Button
              onClick={saveWilayas}
              disabled={savingWilayas}
              className="cursor-pointer"
            >
              <Save className="mr-2 h-4 w-4" />
              {savingWilayas ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Goal edit dialog */}
      <Dialog open={editingGoal} onOpenChange={setEditingGoal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Objectif quotidien de {selectedRep?.first_name} {selectedRep?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Nombre de visites attendues par jour. Mettez 0 pour désactiver l&apos;objectif.
            </p>
            <Input
              type="number"
              min="0"
              max="100"
              value={editGoalValue}
              onChange={(e) => setEditGoalValue(e.target.value)}
              placeholder="Ex: 8"
              className="text-lg"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setEditingGoal(false)}
              className="cursor-pointer"
            >
              Annuler
            </Button>
            <Button
              onClick={saveGoal}
              disabled={savingGoal}
              className="cursor-pointer"
            >
              <Save className="mr-2 h-4 w-4" />
              {savingGoal ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
