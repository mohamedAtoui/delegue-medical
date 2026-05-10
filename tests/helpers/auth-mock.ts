/**
 * Standardised mocks for Clerk + getOrCreateUser. Use inside `vi.mock(...)`
 * factories so the mock applies module-wide for the test file.
 */
import { vi } from "vitest";
import type { User } from "@/types";

export const fakeDelegue: User = {
  id: "user-delegue-1",
  clerk_id: "clerk_delegue_1",
  email: "delegue@example.com",
  first_name: "Sami",
  last_name: "Délégué",
  phone: "0555000000",
  avatar_url: null,
  role: "delegue",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  wilayas: ["Alger"],
};

export const fakeSuperviseur: User = {
  id: "user-super-1",
  clerk_id: "clerk_super_1",
  email: "super@example.com",
  first_name: "Hana",
  last_name: "Superviseure",
  phone: "0555111111",
  avatar_url: null,
  role: "superviseur",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  wilayas: [],
};

/**
 * Factory: returns mocks for `@clerk/nextjs/server` and
 * `@/lib/clerk/sync-user`. Pass `null` for `user` to simulate logged-out.
 */
export function mockAuth(user: User | null) {
  return {
    auth: vi.fn().mockResolvedValue({
      userId: user?.clerk_id ?? null,
    }),
    currentUser: vi.fn().mockResolvedValue(
      user
        ? {
            id: user.clerk_id,
            firstName: user.first_name,
            lastName: user.last_name,
            imageUrl: user.avatar_url,
            emailAddresses: [{ emailAddress: user.email }],
          }
        : null
    ),
    getOrCreateUser: vi.fn().mockResolvedValue(user),
  };
}
