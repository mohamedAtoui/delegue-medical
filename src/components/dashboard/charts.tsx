"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChartsProps {
  byRep: Array<{ name: string; count: number }>;
  byWilaya: Array<{ wilaya: string; count: number }>;
}

export function Charts({ byRep, byWilaya }: ChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Visits per rep */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visites par délégué</CardTitle>
        </CardHeader>
        <CardContent>
          {byRep.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Aucune donnée
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byRep.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="oklch(0.52 0.15 145)"
                  radius={[0, 4, 4, 0]}
                  name="Visites"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Visits per wilaya */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visites par wilaya</CardTitle>
        </CardHeader>
        <CardContent>
          {byWilaya.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Aucune donnée
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byWilaya.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="wilaya"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="oklch(0.70 0.16 55)"
                  radius={[4, 4, 0, 0]}
                  name="Visites"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
