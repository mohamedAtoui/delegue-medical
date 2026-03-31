"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WilayaSelect } from "@/components/shared/wilaya-select";
import { Sparkles, Loader2 } from "lucide-react";

export function AISummaryPanel() {
  const [wilaya, setWilaya] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  const generateSummary = async () => {
    setLoading(true);
    setSummary("");
    try {
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wilaya: wilaya || undefined }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      setSummary(
        err instanceof Error
          ? `Erreur: ${err.message}`
          : "Erreur lors de la generation"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-accent" />
          Résumé IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <WilayaSelect
              value={wilaya}
              onValueChange={setWilaya}
              placeholder="Toutes les wilayas"
            />
          </div>
          <Button onClick={generateSummary} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Générer le résumé
              </>
            )}
          </Button>
        </div>

        {summary && (
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
