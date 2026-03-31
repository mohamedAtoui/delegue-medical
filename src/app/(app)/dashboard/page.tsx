"use client";

import { useState, useEffect } from "react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { Charts } from "@/components/dashboard/charts";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { AISummaryPanel } from "@/components/dashboard/ai-summary-panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface Stats {
  totalVisits: number;
  activeReps: number;
  doctorsVisited: number;
  byRep: Array<{ name: string; count: number }>;
  byWilaya: Array<{ wilaya: string; count: number }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [period, setPeriod] = useState("today");

  const getDateRange = (p: string) => {
    const now = new Date();
    const from = new Date();

    switch (p) {
      case "today":
        from.setHours(0, 0, 0, 0);
        break;
      case "week":
        from.setDate(now.getDate() - 7);
        break;
      case "month":
        from.setMonth(now.getMonth() - 1);
        break;
    }

    return { from: from.toISOString(), to: now.toISOString() };
  };

  useEffect(() => {
    const { from, to } = getDateRange(period);
    fetch(`/api/stats?from=${from}&to=${to}`)
      .then((res) => res.json())
      .then(setStats);
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
          <Tabs value={period} onValueChange={setPeriod}>
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

      {/* KPIs */}
      <StatsCards
        totalVisits={stats?.totalVisits || 0}
        activeReps={stats?.activeReps || 0}
        doctorsVisited={stats?.doctorsVisited || 0}
      />

      {/* Charts */}
      <Charts
        byRep={stats?.byRep || []}
        byWilaya={stats?.byWilaya || []}
      />

      {/* Bottom section: Activity + AI */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ActivityFeed />
        <AISummaryPanel />
      </div>
    </div>
  );
}
