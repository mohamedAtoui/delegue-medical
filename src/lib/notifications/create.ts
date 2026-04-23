import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationType } from "@/types";

interface CreateNotificationInput {
  user_id: string;
  type: NotificationType;
  title: string;
  message?: string | null;
  link?: string | null;
  entity_id?: string | null;
  entity_type?: string | null;
}

/**
 * Insert one or more notification rows. Silently logs errors and
 * does NOT throw — notification failures should never break the
 * main flow (e.g. saving a comment, creating an assignment).
 */
export async function createNotifications(
  supabase: SupabaseClient,
  notifs: CreateNotificationInput[]
): Promise<void> {
  if (notifs.length === 0) return;
  const rows = notifs.map((n) => ({
    user_id: n.user_id,
    type: n.type,
    title: n.title,
    message: n.message ?? null,
    link: n.link ?? null,
    entity_id: n.entity_id ?? null,
    entity_type: n.entity_type ?? null,
    read: false,
  }));
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) {
    console.error("Failed to create notifications:", error.message);
  }
}

/**
 * Insert a notification only if no existing notification with the same
 * (user_id, type, entity_id) tuple exists. Used for deadline reminders
 * to avoid spamming the user.
 */
export async function createNotificationIfMissing(
  supabase: SupabaseClient,
  notif: CreateNotificationInput
): Promise<void> {
  if (!notif.entity_id) {
    await createNotifications(supabase, [notif]);
    return;
  }
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", notif.user_id)
    .eq("type", notif.type)
    .eq("entity_id", notif.entity_id)
    .maybeSingle();
  if (existing) return;
  await createNotifications(supabase, [notif]);
}
