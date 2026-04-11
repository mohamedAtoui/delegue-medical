"use client";

import { useState } from "react";
import { Plus, ArrowLeft, Stethoscope, Pill, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VisitForm } from "@/components/visits/visit-form";
import { VisitHistory } from "@/components/visits/visit-history";
import { cn } from "@/lib/utils";
import type { DoctorType } from "@/types";

type TypeFilter = "all" | DoctorType;
type DateRange = "today" | "week" | "month" | "all";

export default function VisitesPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");

  const getFrom = (): string | undefined => {
    if (dateRange === "all") return undefined;
    const from = new Date();
    if (dateRange === "today") from.setHours(0, 0, 0, 0);
    else if (dateRange === "week") from.setDate(from.getDate() - 7);
    else if (dateRange === "month") from.setMonth(from.getMonth() - 1);
    return from.toISOString();
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
          <h1 className="text-2xl font-bold text-foreground">Mes visites</h1>
          <p className="text-sm text-muted-foreground">
            Enregistrez et consultez vos visites
          </p>
        </div>

        <Button onClick={() => setShowForm(true)} className="cursor-pointer">
          <Plus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Nouvelle visite</span>
          <span className="sm:hidden">Nouveau</span>
        </Button>
      </div>

      {/* Type tabs + date filter */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 p-1 bg-muted/40 rounded-lg">
          {([
            { key: "all", label: "Toutes", icon: Users },
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

        <div className="flex">
          <Select value={dateRange} onValueChange={(v) => setDateRange((v as DateRange) ?? "all")}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les dates</SelectItem>
              <SelectItem value="today">Aujourd&apos;hui</SelectItem>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Visit history */}
      <VisitHistory
        refreshKey={refreshKey}
        typeFilter={typeFilter}
        from={getFrom()}
      />
    </div>
  );
}
