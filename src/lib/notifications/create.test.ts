import { describe, it, expect, vi } from "vitest";
import { makeSupabase } from "../../../tests/helpers/supabase-mock";
import { createNotifications, createNotificationIfMissing } from "./create";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("createNotifications", () => {
  it("inserts every row passed in", async () => {
    const supabase = makeSupabase({ notifications: { data: null, error: null } });
    await createNotifications(supabase as unknown as SupabaseClient, [
      { user_id: "u1", type: "comment", title: "hi" },
      { user_id: "u2", type: "comment_reply", title: "hello" },
    ]);
    expect(supabase.from).toHaveBeenCalledWith("notifications");
    const builder = supabase.from.mock.results[0].value;
    expect(builder.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: "u1",
        type: "comment",
        title: "hi",
        read: false,
      }),
      expect.objectContaining({
        user_id: "u2",
        type: "comment_reply",
        title: "hello",
      }),
    ]);
  });

  it("no-ops on empty array", async () => {
    const supabase = makeSupabase();
    await createNotifications(supabase as unknown as SupabaseClient, []);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("swallows errors (never throws)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = makeSupabase({
      notifications: { data: null, error: { message: "boom" } },
    });
    await expect(
      createNotifications(supabase as unknown as SupabaseClient, [
        { user_id: "u1", type: "comment", title: "x" },
      ])
    ).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("createNotificationIfMissing", () => {
  it("inserts when no existing row matches (user, type, entity_id)", async () => {
    const supabase = makeSupabase({
      notifications: [
        { data: null, error: null }, // maybeSingle lookup → no existing
        { data: null, error: null }, // insert
      ],
    });
    await createNotificationIfMissing(supabase as unknown as SupabaseClient, {
      user_id: "u1",
      type: "assignment_due_soon",
      title: "x",
      entity_id: "a1",
      entity_type: "assignment",
    });
    // Two from() calls: lookup + insert
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });

  it("skips insert when an existing row matches", async () => {
    const supabase = makeSupabase({
      notifications: { data: { id: "existing" }, error: null },
    });
    await createNotificationIfMissing(supabase as unknown as SupabaseClient, {
      user_id: "u1",
      type: "assignment_due_soon",
      title: "x",
      entity_id: "a1",
      entity_type: "assignment",
    });
    // Only the lookup happens
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it("inserts directly without lookup when entity_id absent", async () => {
    const supabase = makeSupabase();
    await createNotificationIfMissing(supabase as unknown as SupabaseClient, {
      user_id: "u1",
      type: "comment",
      title: "x",
    });
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });
});
