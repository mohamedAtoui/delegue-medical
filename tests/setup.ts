/**
 * Global test setup. Runs before each test file.
 * - Force-reset env vars per test
 * - Stub web APIs that aren't present in node by default
 */
import { beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});
