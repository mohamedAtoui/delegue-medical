"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Bell,
  MessageSquare,
  CalendarPlus,
  AlertTriangle,
  Clock,
  Check,
  Trash2,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Notification, NotificationType } from "@/types";

const REFRESH_INTERVAL = 60_000; // 60 s

function iconFor(type: NotificationType) {
  switch (type) {
    case "comment":
    case "comment_reply":
      return MessageSquare;
    case "assignment_new":
      return CalendarPlus;
    case "assignment_due_soon":
      return Clock;
    case "assignment_overdue":
      return AlertTriangle;
  }
}

function colorFor(type: NotificationType) {
  switch (type) {
    case "comment":
    case "comment_reply":
      return "text-primary";
    case "assignment_new":
      return "text-primary";
    case "assignment_due_soon":
      return "text-amber-600";
    case "assignment_overdue":
      return "text-red-600";
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const json = await res.json();
      setNotifications(json.data || []);
      setUnreadCount(json.unread_count || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Refetch on open (so user sees fresh state when clicking the bell)
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const markRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
  };

  const deleteOne = async (id: string) => {
    const wasUnread = !notifications.find((n) => n.id === id)?.read;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="relative inline-flex items-center justify-center rounded-full h-9 w-9 hover:bg-muted transition-colors cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 text-foreground/80" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        }
      />
      <PopoverContent
        align="end"
        className="w-[360px] p-0 max-h-[480px] flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs text-muted-foreground">
                ({unreadCount} non lue{unreadCount > 1 ? "s" : ""})
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllRead}
              className="cursor-pointer h-7 text-xs"
            >
              <Check className="h-3 w-3 mr-1" />
              Tout lu
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Chargement…
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Aucune notification
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {notifications.map((n) => {
                const Icon = iconFor(n.type);
                const color = colorFor(n.type);
                const content = (
                  <div className="flex items-start gap-3 px-4 py-3 group">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        n.read ? "bg-muted/50" : "bg-primary/10"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm leading-tight",
                          n.read ? "text-foreground/70" : "text-foreground font-medium"
                        )}
                      >
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), {
                          locale: fr,
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteOne(n.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted shrink-0"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                );

                return (
                  <li
                    key={n.id}
                    className={cn(
                      "transition-colors",
                      !n.read && "bg-primary/[0.02]"
                    )}
                  >
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => {
                          if (!n.read) markRead(n.id);
                          setOpen(false);
                        }}
                        className="block hover:bg-muted/50 cursor-pointer"
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => !n.read && markRead(n.id)}
                        className="w-full text-left hover:bg-muted/50 cursor-pointer"
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
