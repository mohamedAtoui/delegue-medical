import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockCurrentUser = vi.fn();
const mockCreateClient = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
  currentUser: () => mockCurrentUser(),
}));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

beforeEach(() => {
  vi.resetModules();
  mockAuth.mockReset();
  mockCurrentUser.mockReset();
  mockCreateClient.mockReset();
  process.env.SUPERVISOR_EMAILS = "boss@example.com";
});

import { makeSupabase } from "../../../tests/helpers/supabase-mock";

async function loadSyncUser() {
  return await import("./sync-user");
}

describe("getOrCreateUser", () => {
  it("returns null when no Clerk session", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { getOrCreateUser } = await loadSyncUser();
    expect(await getOrCreateUser()).toBeNull();
  });

  it("returns existing user without re-fetching from Clerk if avatar matches", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_x" });
    const existingUser = {
      id: "u1",
      clerk_id: "clerk_x",
      avatar_url: "https://img/a.png",
      role: "delegue",
    };
    mockCurrentUser.mockResolvedValue({
      imageUrl: "https://img/a.png",
      emailAddresses: [{ emailAddress: "x@y.com" }],
    });
    mockCreateClient.mockResolvedValue(
      makeSupabase({
        users: { data: existingUser, error: null },
      })
    );
    const { getOrCreateUser } = await loadSyncUser();
    expect(await getOrCreateUser()).toEqual(existingUser);
  });

  it("creates a new user as superviseur when email is in SUPERVISOR_EMAILS", async () => {
    process.env.SUPERVISOR_EMAILS = "boss@example.com";
    mockAuth.mockResolvedValue({ userId: "clerk_new" });
    mockCurrentUser.mockResolvedValue({
      firstName: "Boss",
      lastName: "Person",
      imageUrl: null,
      emailAddresses: [{ emailAddress: "boss@example.com" }],
    });
    const insertedUser = {
      id: "u_boss",
      clerk_id: "clerk_new",
      email: "boss@example.com",
      role: "superviseur",
    };
    const supabase = makeSupabase({
      users: [
        { data: null, error: null }, // existing user lookup → none
        { data: insertedUser, error: null }, // insert
      ],
    });
    mockCreateClient.mockResolvedValue(supabase);
    const { getOrCreateUser } = await loadSyncUser();
    const result = await getOrCreateUser();
    expect(result).toEqual(insertedUser);
  });

  it("blocks sign-up when email is neither supervisor nor in invited_users", async () => {
    process.env.SUPERVISOR_EMAILS = "boss@example.com";
    mockAuth.mockResolvedValue({ userId: "clerk_new" });
    mockCurrentUser.mockResolvedValue({
      firstName: "Random",
      lastName: "Stranger",
      imageUrl: null,
      emailAddresses: [{ emailAddress: "random@gmail.com" }],
    });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              })),
            })),
          };
        }
        if (table === "invited_users") {
          return {
            select: vi.fn(() => ({
              ilike: vi.fn(() => ({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: null, error: null }),
              })),
            })),
          };
        }
        return {};
      }),
    };
    mockCreateClient.mockResolvedValue(supabase);
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getOrCreateUser } = await loadSyncUser();
    expect(await getOrCreateUser()).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("creates delegue when email is in invited_users", async () => {
    process.env.SUPERVISOR_EMAILS = "boss@example.com";
    mockAuth.mockResolvedValue({ userId: "clerk_invited" });
    mockCurrentUser.mockResolvedValue({
      firstName: "Invited",
      lastName: "User",
      imageUrl: null,
      emailAddresses: [{ emailAddress: "invited@x.com" }],
    });
    const insertedUser = {
      id: "u_invited",
      clerk_id: "clerk_invited",
      email: "invited@x.com",
      role: "delegue",
    };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "users") {
          // First call: existing user lookup
          // Second call: insert
          if (!supabase.usersCallCount) {
            supabase.usersCallCount = 1;
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({ data: null, error: null }),
                })),
              })),
            };
          }
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: insertedUser,
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "invited_users") {
          return {
            select: vi.fn(() => ({
              ilike: vi.fn(() => ({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: { id: "inv1" }, error: null }),
              })),
            })),
          };
        }
        return {};
      }),
      usersCallCount: 0,
    } as unknown as { from: ReturnType<typeof vi.fn>; usersCallCount: number };
    mockCreateClient.mockResolvedValue(supabase);
    const { getOrCreateUser } = await loadSyncUser();
    const result = await getOrCreateUser();
    expect(result).toEqual(insertedUser);
  });
});
