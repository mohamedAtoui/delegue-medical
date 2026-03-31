"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, Users, Stethoscope, TrendingUp } from "lucide-react";

interface StatsCardsProps {
  totalVisits: number;
  activeReps: number;
  doctorsVisited: number;
}

export function StatsCards({ totalVisits, activeReps, doctorsVisited }: StatsCardsProps) {
  const stats = [
    {
      label: "Visites",
      value: totalVisits,
      icon: ClipboardList,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Délégués actifs",
      value: activeReps,
      icon: Users,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      label: "Médecins visités",
      value: doctorsVisited,
      icon: Stethoscope,
      color: "text-chart-5",
      bg: "bg-chart-5/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg}`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
