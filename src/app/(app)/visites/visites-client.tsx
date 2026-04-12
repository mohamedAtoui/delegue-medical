"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  ArrowLeft,
  Stethoscope,
  Pill,
  Users,
  Search,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WilayaSelect } from "@/components/shared/wilaya-select";
import { VisitForm } from "@/components/visits/visit-form";
import { VisitHistory } from "@/components/visits/visit-history";
import { cn } from "@/lib/utils";
import type { DoctorType, User, UserRole } from "@/types";

type TypeFilter = "" | DoctorType;
type DateRange = "" | "today" | "week" | "month";

interface VisitesClientProps {
  role: UserRole;
}

export function VisitesClient({ role }: VisitesClientProps) {
  const isSupervisor = role === "superviseur";
  const [refreshKey, setRefreshKey] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("");
  const [dateRange, setDateRange] = useState<DateRange>("");
  const [wilayaFilter, setWilayaFilter] = useState("");
  const [delegueFilter, setDelegueFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [reps, setReps] = useState<User[]>([]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Load delegue list for supervisor
  useEffect(() => {
    if (!isSupervisor) return;
    fetch("/api/users?role=delegue")
      .then((res) => res.json())
      .then((data) => setReps(Array.isArray(data) ? data : []))
      .catch(() => setReps([]));
  }, [isSupervisor]);

  const getFrom = (): string | undefined => {
    if (!dateRange) return undefined;
    const from = new Date();
    if (dateRange === "today") from.setHours(0, 0, 0, 0);
    else if (dateRange === "week") from.setDate(from.getDate() - 7);
    else if (dateRange === "month") from.setMonth(from.getMonth() - 1);
    return from.toISOString();
  };

  const activeFilterCount =
    (typeFilter ? 1 : 0) +
    (dateRange ? 1 : 0) +
    (wilayaFilter ? 1 : 0) +
    (delegueFilter ? 1 : 0) +
    (search ? 1 : 0);

  const resetFilters = () => {
    setTypeFilter("");
    setDateRange("");
    setWilayaFilter("");
    setDelegueFilter("");
    setSearchInput("");
  };

  if (showForm) {
    return (
      <div className="flex flex-col items-center justify-start min-h-[60vh]">
        <div className="w-full max-w-2xl">
          <Button
            variant="ghost"
            onClick={() => setShowForm(false)}
            className="mb-4 cursor-pointer"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux visites
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Nouvelle visite</CardTitle>
            </CardHeader>
            <CardContent>
              <VisitForm
                onSuccess={() => {
                  setRefreshKey((k) => k + 1);
                  setShowForm(false);
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {isSupervisor ? "Visites" : "Mes visites"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSupervisor
              ? "Toutes les visites de l'équipe"
              : "Enregistrez et consultez vos visites"}
          </p>
        </div>

        <Button onClick={() => setShowForm(true)} className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Nouvelle visite</span>
          <span className="sm:hidden">Nouveau</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Type tabs */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-muted/40 rounded-lg">
          {(
            [
              { key: "", label: "Toutes", icon: Users },
              { key: "medecin", label: "Médecins", icon: Stethoscope },
              { key: "pharmacien", label: "Pharmaciens", icon: Pill },
            ] as { key: TypeFilter; label: string; icon: typeof Users }[]
          ).map((tab) => {
            const Icon = tab.icon;
            const active = typeFilter === tab.key;
            return (
              <button
                key={tab.key || "all"}
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

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Rechercher par nom du médecin ou pharmacien…"
            className="pl-9 pr-9"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter row */}
        <div
          className={cn(
            "grid gap-2",
            isSupervisor
              ? "grid-cols-1 sm:grid-cols-3"
              : "grid-cols-1"
          )}
        >
          <Select
            value={dateRange}
            onValueChange={(v) => setDateRange(v as DateRange)}
          >
            <SelectTrigger>
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground mr-1" />
              <SelectValue placeholder="Toutes les dates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Aujourd&apos;hui</SelectItem>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="month">Ce mois-ci</SelectItem>
            </SelectContent>
          </Select>

          {isSupervisor && (
            <>
              <WilayaSelect
                value={wilayaFilter}
                onValueChange={setWilayaFilter}
                placeholder="Toutes les wilayas"
                showAll
              />

              <Select
                value={delegueFilter}
                onValueChange={(v) => setDelegueFilter(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous les délégués" />
                </SelectTrigger>
                <SelectContent>
                  {reps.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.first_name} {r.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>

        {activeFilterCount > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
            <span>
              {activeFilterCount} filtre{activeFilterCount > 1 ? "s" : ""} actif
              {activeFilterCount > 1 ? "s" : ""}
            </span>
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-primary hover:underline cursor-pointer font-medium"
            >
              <X className="h-3 w-3" />
              Réinitialiser
            </button>
          </div>
        )}
      </div>

      {/* Visit history */}
      <VisitHistory
        refreshKey={refreshKey}
        showUser={isSupervisor}
        typeFilter={typeFilter || "all"}
        from={getFrom()}
        wilaya={wilayaFilter || undefined}
        userId={delegueFilter || undefined}
        search={search || undefined}
      />
    </div>
  );
}
