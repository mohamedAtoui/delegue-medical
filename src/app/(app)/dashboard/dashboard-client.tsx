"use client";

import { useEffect, useRef, useState } from "react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { Charts } from "@/components/dashboard/charts";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { AISummaryPanel } from "@/components/dashboard/ai-summary-panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MedicalLoader } from "@/components/ui/medical-loader";
import { Download } from "lucide-react";
import type { DashboardStats } from "@/lib/queries/stats";
import type { VisitWithDetails } from "@/types";

interface DashboardClientProps {
  initialStats: DashboardStats;
  initialVisits: VisitWithDetails[];
}

export function DashboardClient({
  initialStats,
  initialVisits,
}: DashboardClientProps) {
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const [refetching, setRefetching] = useState(false);
  const skipNext = useRef(true);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const ctrl = new AbortController();
    const now = new Date();
    const from = new Date();
    if (period === "today") from.setHours(0, 0, 0, 0);
    else if (period === "week") from.setDate(now.getDate() - 7);
    else from.setMonth(now.getMonth() - 1);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: show loader before fetch starts
    setRefetching(true);
    fetch(`/api/stats?from=${from.toISOString()}&to=${now.toISOString()}`, {
      signal: ctrl.signal,
    })
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((err) => {
        if (err?.name !== "AbortError") throw err;
      })
      .finally(() => setRefetching(false));

    return () => ctrl.abort();
  }, [period]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">
            Vue d&apos;ensemble de l&apos;activité
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Tabs
            value={period}
            onValueChange={(v) => setPeriod(v as typeof period)}
          >
            <TabsList>
              <TabsTrigger value="today">Aujourd&apos;hui</TabsTrigger>
              <TabsTrigger value="week">Semaine</TabsTrigger>
              <TabsTrigger value="month">Mois</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => {
              window.open("/api/export", "_blank");
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Exporter Excel
          </Button>
        </div>
      </div>

      <div className="relative">
        {refetching && <MedicalLoader variant="overlay" />}

        {/* KPIs */}
        <StatsCards
          totalVisits={stats.totalVisits}
          activeReps={stats.activeReps}
          doctorsVisited={stats.doctorsVisited}
        />

        {/* Charts */}
        <div className="mt-6">
          <Charts byRep={stats.byRep} byWilaya={stats.byWilaya} />
        </div>
      </div>

      {/* Bottom section: Activity + AI */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ActivityFeed initialVisits={initialVisits} />
        <AISummaryPanel />
      </div>
    </div>
  );
}
