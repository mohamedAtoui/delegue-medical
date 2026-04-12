"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WilayaSelect } from "@/components/shared/wilaya-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Send, Loader2, User, Bot } from "lucide-react";
import type { User as UserType } from "@/types";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function cleanMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^[-*]\s/gm, "• ")
    .replace(/`(.*?)`/g, "$1")
    .trim();
}

const EXAMPLE_PROMPTS = [
  "Quels médecins ont promis de prescrire Synapgen ?",
  "Combien d'objections prix ont été rencontrées ?",
  "Quelles pharmacies ont accepté une commande ?",
  "Résumer les retours patients positifs",
  "Quelles marques de magnésium reviennent le plus ?",
  "Points d'action prioritaires cette semaine",
];

export function AISummaryPanel() {
  const [wilaya, setWilaya] = useState("");
  const [delegue, setDelegue] = useState("");
  const [dateRange, setDateRange] = useState("month");
  const [typeFilter, setTypeFilter] = useState("");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [reps, setReps] = useState<UserType[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/users?role=delegue")
      .then((res) => res.json())
      .then((data) => setReps(Array.isArray(data) ? data : []))
      .catch(() => setReps([]));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getDateFrom = () => {
    const from = new Date();
    if (dateRange === "today") from.setHours(0, 0, 0, 0);
    else if (dateRange === "week") from.setDate(from.getDate() - 7);
    else if (dateRange === "month") from.setMonth(from.getMonth() - 1);
    else return undefined;
    return from.toISOString();
  };

  const askAI = async (question: string) => {
    if (!question.trim()) return;

    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wilaya: wilaya || undefined,
          user_id: delegue && delegue !== "all" ? delegue : undefined,
          from: getDateFrom(),
          type: typeFilter && typeFilter !== "all" ? typeFilter : undefined,
          prompt: question,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: cleanMarkdown(data.summary) },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err instanceof Error ? `Erreur: ${err.message}` : "Erreur lors de la génération",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    askAI(prompt);
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-accent" />
          Assistant IA
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 flex-1">
        {/* Filters */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <WilayaSelect
            value={wilaya}
            onValueChange={setWilaya}
            placeholder="Wilaya"
            showAll
            allLabel="Toutes"
          />
          <Select value={delegue} onValueChange={(v) => setDelegue(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Délégué" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les délégués</SelectItem>
              {reps.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.first_name} {r.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              <SelectItem value="medecin">Médecins</SelectItem>
              <SelectItem value="pharmacien">Pharmaciens</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v ?? "month")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Aujourd&apos;hui</SelectItem>
              <SelectItem value="week">Semaine</SelectItem>
              <SelectItem value="month">Mois</SelectItem>
              <SelectItem value="all">Tout</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-[200px] max-h-[400px] overflow-y-auto space-y-3 rounded-lg border border-border/50 p-3 bg-muted/10">
          {messages.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Posez une question sur vos données
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => askAI(p)}
                    className="text-xs bg-muted hover:bg-muted/80 rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === "user" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))
          )}
          {loading && (
            <div className="flex gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted/50 rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Posez votre question..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !prompt.trim()} size="sm" className="cursor-pointer">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
