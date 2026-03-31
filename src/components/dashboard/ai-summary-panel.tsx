"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WilayaSelect } from "@/components/shared/wilaya-select";
import { Sparkles, Loader2 } from "lucide-react";

function cleanMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, "")     // remove ## headers
    .replace(/\*\*(.*?)\*\*/g, "$1") // remove **bold**
    .replace(/\*(.*?)\*/g, "$1")     // remove *italic*
    .replace(/^[-*]\s/gm, "• ")      // convert - or * list items to bullet
    .replace(/`(.*?)`/g, "$1")       // remove `code`
    .trim();
}

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
      setSummary(cleanMarkdown(data.summary));
    } catch (err) {
      setSummary(
        err instanceof Error
          ? `Erreur: ${err.message}`
          : "Erreur lors de la génération"
      );
    } finally {
      setLoading(false);
    }
  };

  // Split summary into sections for better display
  const sections = summary.split(/\n\n+/).filter(Boolean);

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
          <Button onClick={generateSummary} disabled={loading} className="cursor-pointer">
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
          <div className="space-y-3">
            {sections.map((section, i) => {
              const lines = section.split("\n");
              const isHeader = lines[0] && lines[0] === lines[0].toUpperCase() && lines[0].length < 50;

              return (
                <div key={i} className="rounded-lg bg-muted/50 p-4">
                  {isHeader ? (
                    <>
                      <h4 className="text-sm font-semibold text-primary mb-2">
                        {lines[0]}
                      </h4>
                      <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">
                        {lines.slice(1).join("\n")}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">
                      {section}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
