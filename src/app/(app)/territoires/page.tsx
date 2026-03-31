"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WILAYAS } from "@/lib/constants/wilayas";
import { toast } from "sonner";
import { MapPin, Save, User } from "lucide-react";
import type { User as UserType } from "@/types";

export default function TerritoiresPage() {
  const [reps, setReps] = useState<UserType[]>([]);
  const [selectedRep, setSelectedRep] = useState<UserType | null>(null);
  const [assignedWilayas, setAssignedWilayas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/users?role=delegue")
      .then((res) => res.json())
      .then((data) => setReps(Array.isArray(data) ? data : data.data || []))
      .catch(() => setReps([]));
  }, []);

  useEffect(() => {
    if (!selectedRep) return;

    fetch(`/api/territories?user_id=${selectedRep.id}`)
      .then((res) => res.json())
      .then((data) => {
        setAssignedWilayas(
          (data || []).map((t: { wilaya: string }) => t.wilaya)
        );
      });
  }, [selectedRep]);

  const toggleWilaya = (wilaya: string) => {
    setAssignedWilayas((prev) =>
      prev.includes(wilaya)
        ? prev.filter((w) => w !== wilaya)
        : [...prev, wilaya]
    );
  };

  const saveAssignments = async () => {
    if (!selectedRep) return;
    setLoading(true);

    try {
      const res = await fetch("/api/territories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedRep.id,
          wilayas: assignedWilayas,
        }),
      });

      if (!res.ok) throw new Error("Erreur");
      toast.success("Territoires mis à jour");
    } catch {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Territoires</h1>
        <p className="text-sm text-muted-foreground">
          Assigner des wilayas aux délégués
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Rep list */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Délégués</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[600px] overflow-y-auto">
            {reps.map((rep) => (
              <button
                key={rep.id}
                onClick={() => setSelectedRep(rep)}
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

        {/* Wilaya assignment */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {selectedRep
                ? `Wilayas de ${selectedRep.first_name} ${selectedRep.last_name}`
                : "Sélectionner un délégué"}
            </CardTitle>
            {selectedRep && (
              <Button onClick={saveAssignments} disabled={loading} size="sm">
                <Save className="mr-2 h-4 w-4" />
                {loading ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {selectedRep ? (
              <div className="flex flex-wrap gap-2">
                {WILAYAS.map((wilaya) => {
                  const isAssigned = assignedWilayas.includes(wilaya.name);
                  return (
                    <Badge
                      key={wilaya.code}
                      variant={isAssigned ? "default" : "outline"}
                      className="cursor-pointer select-none transition-all hover:scale-105"
                      onClick={() => toggleWilaya(wilaya.name)}
                    >
                      <MapPin className="mr-1 h-3 w-3" />
                      {wilaya.code} - {wilaya.name}
                    </Badge>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                Sélectionnez un délégué pour gérer ses territoires
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
