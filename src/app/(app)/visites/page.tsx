"use client";

import { useState } from "react";
import { Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VisitForm } from "@/components/visits/visit-form";
import { VisitHistory } from "@/components/visits/visit-history";

export default function VisitesPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showForm, setShowForm] = useState(false);

  if (showForm) {
    return (
      <div className="flex flex-col items-center justify-start min-h-[60vh]">
        <div className="w-full max-w-2xl">
          <Button
            variant="ghost"
            onClick={() => setShowForm(false)}
            className="mb-4"
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
            Enregistrez et consultez vos visites médicales
          </p>
        </div>

        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Nouvelle visite</span>
          <span className="sm:hidden">Nouveau</span>
        </Button>
      </div>

      {/* Visit history */}
      <VisitHistory refreshKey={refreshKey} />
    </div>
  );
}
