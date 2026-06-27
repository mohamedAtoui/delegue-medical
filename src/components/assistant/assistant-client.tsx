"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage, type ChatMessageData } from "./chat-message";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts: ChatMessageData["parts"] | null;
}

const EXAMPLES = [
  "Combien de visites cette semaine, par délégué ? Affiche un graphique.",
  "Quels médecins de potentiel A n'ont jamais été visités ?",
  "Répartition des visites médecins vs pharmaciens ce mois-ci.",
  "Quelles planifications sont en retard, et pour quel délégué ?",
];

/** Convert a stored DB message into the UIMessage shape useChat expects. */
function toUIMessage(m: StoredMessage) {
  const parts =
    m.parts && m.parts.length > 0 ? m.parts : [{ type: "text", text: m.content }];
  return { id: m.id, role: m.role, parts };
}

export function AssistantClient({
  initialConversations,
}: {
  initialConversations: Conversation[];
}) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<ReturnType<typeof toUIMessage>[]>([]);
  const [booting, setBooting] = useState(true);

  // Pick the newest conversation on mount, or create one if there are none.
  useEffect(() => {
    (async () => {
      try {
        if (conversations.length > 0) {
          await selectConversation(conversations[0].id);
        } else {
          await createConversation();
        }
      } finally {
        setBooting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshConversations() {
    try {
      const res = await fetch("/api/assistant/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations);
      }
    } catch {
      /* transient — keep the current list */
    }
  }

  async function selectConversation(id: string) {
    try {
      const res = await fetch(`/api/assistant/conversations/${id}`);
      if (!res.ok) {
        toast.error("Conversation introuvable");
        return;
      }
      const data = await res.json();
      setInitialMessages((data.messages as StoredMessage[]).map(toUIMessage));
      setActiveId(id);
    } catch {
      toast.error("Connexion au serveur perdue. Rechargez la page.");
    }
  }

  async function createConversation() {
    try {
      const res = await fetch("/api/assistant/conversations", { method: "POST" });
      if (!res.ok) {
        toast.error("Création impossible");
        return;
      }
      const { conversation } = await res.json();
      setConversations((prev) => [conversation, ...prev]);
      setInitialMessages([]);
      setActiveId(conversation.id);
    } catch {
      toast.error("Connexion au serveur perdue. Rechargez la page.");
    }
  }

  // Reuse the current conversation if it's already empty, to avoid clutter.
  async function handleNewChat() {
    if (activeId && initialMessages.length === 0) return;
    await createConversation();
  }

  async function renameConversation(id: string) {
    const current = conversations.find((c) => c.id === id);
    const title = window.prompt("Renommer la conversation", current?.title ?? "");
    if (!title?.trim()) return;
    const res = await fetch(`/api/assistant/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });
    if (res.ok) {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: title.trim() } : c))
      );
    } else {
      toast.error("Renommage impossible");
    }
  }

  async function deleteConversation(id: string) {
    if (!window.confirm("Supprimer cette conversation ?")) return;
    const res = await fetch(`/api/assistant/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Suppression impossible");
      return;
    }
    const remaining = conversations.filter((c) => c.id !== id);
    setConversations(remaining);
    if (activeId === id) {
      if (remaining.length > 0) await selectConversation(remaining[0].id);
      else await createConversation();
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Conversations sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col rounded-xl border border-border bg-card md:flex">
        <div className="space-y-3 p-3">
          <div className="flex items-center gap-2 px-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Assistant IA</span>
          </div>
          <Button onClick={handleNewChat} className="w-full cursor-pointer" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle conversation
          </Button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-sm transition-colors ${
                c.id === activeId
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "hover:bg-sidebar-accent/50"
              }`}
            >
              <button
                onClick={() => selectConversation(c.id)}
                className="flex-1 cursor-pointer truncate text-left"
                title={c.title}
              >
                {c.title}
              </button>
              <button
                onClick={() => renameConversation(c.id)}
                className="cursor-pointer opacity-0 group-hover:opacity-100"
                aria-label="Renommer"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={() => deleteConversation(c.id)}
                className="cursor-pointer opacity-0 group-hover:opacity-100"
                aria-label="Supprimer"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Active chat thread (remounted per conversation) */}
      <main className="flex min-w-0 flex-1 flex-col rounded-xl border border-border bg-card">
        {booting || !activeId ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <ChatThread
            key={activeId}
            conversationId={activeId}
            initialMessages={initialMessages}
            onFinished={refreshConversations}
            onNewChat={handleNewChat}
          />
        )}
      </main>
    </div>
  );
}

function ChatThread({
  conversationId,
  initialMessages,
  onFinished,
  onNewChat,
}: {
  conversationId: string;
  initialMessages: ReturnType<typeof toUIMessage>[];
  onFinished: () => void;
  onNewChat: () => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevStatus = useRef<string>("ready");

  const { messages, sendMessage, status, stop } = useChat({
    id: conversationId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: initialMessages as any,
    transport: new DefaultChatTransport({
      api: "/api/assistant/chat",
      body: { conversationId },
    }),
  });

  const busy = status === "submitted" || status === "streaming";

  // Refresh the sidebar (auto-titles) once a response completes.
  useEffect(() => {
    if (prevStatus.current === "streaming" && status === "ready") onFinished();
    prevStatus.current = status;
  }, [status, onFinished]);

  // Keep the latest message in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function submit() {
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Assistant IA</h2>
        </div>
        <Button variant="outline" size="sm" className="cursor-pointer md:hidden" onClick={onNewChat}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Posez une question sur vos données</p>
              <p className="text-sm text-muted-foreground">
                Visites, médecins, pharmaciens, planifications… avec graphiques.
              </p>
            </div>
            <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => sendMessage({ text: ex })}
                  className="cursor-pointer rounded-xl border border-border bg-background p-3 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m as unknown as ChatMessageData} />
            ))}
            {busy && (
              <div className="flex items-center gap-2 pl-11 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyse en cours…
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-2 shadow-sm focus-within:border-primary/50">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Posez votre question…"
              rows={1}
              className="max-h-40 min-h-[36px] flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            {busy ? (
              <Button variant="outline" size="icon" className="shrink-0 cursor-pointer" onClick={stop}>
                <span className="h-3 w-3 rounded-sm bg-foreground" />
              </Button>
            ) : (
              <Button
                size="icon"
                className="shrink-0 cursor-pointer"
                onClick={submit}
                disabled={!input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
            Entrée pour envoyer · Maj+Entrée pour un saut de ligne
          </p>
        </div>
      </div>
    </>
  );
}
