"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WILAYAS } from "@/lib/constants/wilayas";
import { toast } from "sonner";
import { MapPin, ArrowRight } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [wilayas, setWilayas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleWilaya = (name: string) => {
    setWilayas((prev) =>
      prev.includes(name) ? prev.filter((w) => w !== name) : [...prev, name]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || wilayas.length === 0) {
      toast.error("Veuillez saisir votre téléphone et sélectionner au moins une wilaya");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, wilayas }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("Profil complété !");
      router.push("/visites");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Bienvenue chez Handson</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Complétez votre profil pour commencer
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="phone">Numéro de téléphone *</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0555 XX XX XX"
              />
            </div>

            <div className="space-y-2">
              <Label>Vos wilayas de travail *</Label>
              <p className="text-xs text-muted-foreground">
                Sélectionnez les wilayas où vous travaillez
              </p>
              <div className="flex flex-wrap gap-2 max-h-[250px] overflow-y-auto border border-border rounded-lg p-3">
                {WILAYAS.map((w) => {
                  const selected = wilayas.includes(w.name);
                  return (
                    <Badge
                      key={w.code}
                      variant={selected ? "default" : "outline"}
                      className="cursor-pointer select-none transition-all hover:scale-105"
                      onClick={() => toggleWilaya(w.name)}
                    >
                      <MapPin className="mr-1 h-3 w-3" />
                      {w.code} - {w.name}
                    </Badge>
                  );
                })}
              </div>
              {wilayas.length > 0 && (
                <p className="text-xs text-primary">
                  {wilayas.length} wilaya{wilayas.length > 1 ? "s" : ""} sélectionnée{wilayas.length > 1 ? "s" : ""}
                </p>
              )}
            </div>

            <Button type="submit" disabled={loading} className="w-full cursor-pointer" size="lg">
              {loading ? "Sauvegarde..." : (
                <>
                  Commencer
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
