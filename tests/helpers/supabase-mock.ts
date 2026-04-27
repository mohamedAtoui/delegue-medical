/**
 * Lightweight Supabase mock for API route tests.
 *
 * Each test sets up `mockTables({ users: { data: [...] }, doctors: { data: ... } })`
 * — every `.from(table)` call returns a chainable builder that resolves
 * (or .single() / .maybeSingle()) to the configured result.
 *
 * For multi-call scenarios (insert THEN select), pass an array of results
 * keyed by call index, or use `mockSupabaseQueue([...])`.
 */
import { vi } from "vitest";

export type QueryResult<T = unknown> = {
  data?: T;
  error?: { message: string } | null;
  count?: number;
};

/** Build a chainable builder that resolves to the given result. */
export function makeBuilder<T = unknown>(result: QueryResult<T>) {
  const builder: Record<string, unknown> = {};
  const chainable = [
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "neq",
    "in",
    "is",
    "ilike",
    "like",
    "match",
    "gte",
    "lte",
    "lt",
    "gt",
    "or",
    "and",
    "not",
    "filter",
    "order",
    "limit",
    "range",
    "returns",
  ];
  for (const m of chainable) {
    builder[m] = vi.fn(() => builder);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  // Make the builder itself thenable so `await builder` resolves.
  builder.then = (
    onFulfilled: (v: QueryResult<T>) => unknown,
    onRejected?: (e: unknown) => unknown
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

export type TableMap = Record<string, QueryResult | QueryResult[]>;

/**
 * Returns a fake Supabase client.
 * `tables` maps table name → result (or array of results, consumed in order
 * across successive `.from(table)` calls).
 */
export function makeSupabase(tables: TableMap = {}) {
  const callCounts: Record<string, number> = {};
  const fromMock = vi.fn((table: string) => {
    const entry = tables[table];
    let result: QueryResult = { data: null, error: null };
    if (Array.isArray(entry)) {
      const i = callCounts[table] ?? 0;
      result = entry[i] ?? entry[entry.length - 1] ?? result;
      callCounts[table] = i + 1;
    } else if (entry) {
      result = entry;
    }
    return makeBuilder(result);
  });
  return {
    from: fromMock,
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: "x" }, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: "https://example.com/img.png" },
        }),
      })),
    },
    auth: {
      getUser: vi.fn(),
    },
    _fromMock: fromMock,
  };
}

/** Build a NextRequest for handler tests. */
export function makeRequest(
  url: string,
  init: RequestInit & { json?: unknown } = {}
): Request {
  const { json, ...rest } = init;
  return new Request(url, {
    ...rest,
    body: json !== undefined ? JSON.stringify(json) : (rest.body as BodyInit),
    headers: {
      "content-type": "application/json",
      ...(rest.headers || {}),
    },
  });
}

/** Build the route-context object Next.js passes for dynamic params. */
export function makeContext(params: Record<string, string>) {
  return { params: Promise.resolve(params) };
}
