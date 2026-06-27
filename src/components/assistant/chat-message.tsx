"use client";

import { Database, Sparkles } from "lucide-react";
import { ChatChart } from "./chat-chart";
import { Markdown } from "./markdown";
import type { ChartSpec } from "@/lib/insights/agent";

/**
 * A single message part. Parts come from the AI SDK (live) or from persisted
 * jsonb (history), so we type them loosely and narrow on `type`.
 */
type Part = {
  type: string;
  text?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
};

export type ChatMessageData = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: Part[];
};

function SqlStep({ part }: { part: Part }) {
  const query = (part.input as { query?: string } | undefined)?.query?.trim() ?? "";
  const output = part.output as
    | { rowCount?: number; truncated?: boolean; error?: string }
    | undefined;
  if (!query) return null;

  return (
    <details className="group my-2 overflow-hidden rounded-lg border border-border bg-muted/30 text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-muted/60">
        <Database className="h-3.5 w-3.5 shrink-0" />
        <span>SQL utilisé</span>
        <span className="text-muted-foreground/70">
          {output?.error
            ? "· erreur"
            : output?.rowCount != null
              ? `· ${output.rowCount} ligne(s)${output.truncated ? "+" : ""}`
              : ""}
        </span>
        <span className="ml-auto text-muted-foreground/60 transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <pre className="overflow-x-auto border-t border-border bg-background/50 px-3 py-2 font-mono text-[0.75rem] leading-relaxed text-foreground">
        <code>{query}</code>
      </pre>
      {output?.error && (
        <p className="border-t border-border px-3 py-2 text-destructive">{output.error}</p>
      )}
    </details>
  );
}

export function ChatMessage({ message }: { message: ChatMessageData }) {
  const isUser = message.role === "user";

  if (isUser) {
    const text = message.parts
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text)
      .join("");
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1 pt-0.5">
        {message.parts.map((part, i) => {
          if (part.type === "text" && part.text) {
            return <Markdown key={i}>{part.text}</Markdown>;
          }
          if (part.type === "tool-runSql") {
            return <SqlStep key={i} part={part} />;
          }
          if (part.type === "tool-renderChart") {
            const spec = part.input as ChartSpec | undefined;
            if (spec && Array.isArray(spec.data)) {
              return <ChatChart key={i} spec={spec} />;
            }
            return null;
          }
          return null;
        })}
      </div>
    </div>
  );
}
