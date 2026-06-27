import { Pool } from "pg";

/**
 * Read-only Postgres access for the AI assistant.
 *
 * supabase-js can't run free-form SQL, and the service-role key is far too
 * privileged to drive from an LLM. So we connect with a dedicated least-
 * privilege role (`ai_ro`, see migration 017) over a plain pg pool and add
 * several independent safety layers on top:
 *
 *   1. The role itself can only SELECT (no DML/DDL grants).
 *   2. Every query runs inside a READ ONLY transaction (rolled back).
 *   3. A 10s statement timeout kills runaway queries.
 *   4. The app-layer guard below rejects anything that isn't a single SELECT.
 *   5. Results are capped at MAX_ROWS so a huge query can't exhaust memory.
 *
 * Even if the model is prompt-injected into emitting destructive SQL, none of
 * it can mutate the database.
 */

const MAX_ROWS = 500;
const STATEMENT_TIMEOUT_MS = 10_000;

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL_READONLY;
    if (!connectionString) {
      throw new Error("DATABASE_URL_READONLY non configuré");
    }
    pool = new Pool({
      connectionString,
      max: 4,
      // Supabase requires TLS; the pooler cert is not in the local trust store.
      ssl: { rejectUnauthorized: false },
      // Hard ceiling on connection acquisition so a stuck pool fails fast.
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

/** Strip SQL comments so they can't smuggle forbidden keywords past the guard. */
function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ") // /* block */
    .replace(/--[^\n]*/g, " "); // -- line
}

const FORBIDDEN =
  /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|merge|call|do|vacuum|analyze|comment|reindex|cluster|refresh|lock|set|reset|begin|commit|rollback|savepoint|listen|notify|prepare|execute|deallocate)\b/i;

export class UnsafeSqlError extends Error {}

/**
 * Validate that `sql` is a single read-only SELECT and normalise it. Throws
 * UnsafeSqlError otherwise. Returns the cleaned single statement (no trailing
 * semicolon).
 */
export function assertReadOnlySelect(sql: string): string {
  const stripped = stripComments(sql).trim();
  if (!stripped) throw new UnsafeSqlError("Requête vide.");

  // Single statement only: allow exactly one optional trailing semicolon.
  const withoutTrailing = stripped.replace(/;\s*$/, "");
  if (withoutTrailing.includes(";")) {
    throw new UnsafeSqlError("Une seule requête SELECT est autorisée.");
  }

  // Must be a plain query: SELECT ... or WITH ... SELECT ...
  if (!/^(select|with)\b/i.test(withoutTrailing)) {
    throw new UnsafeSqlError("Seules les requêtes SELECT sont autorisées.");
  }

  if (FORBIDDEN.test(withoutTrailing)) {
    throw new UnsafeSqlError("Mot-clé non autorisé détecté (lecture seule).");
  }

  return withoutTrailing;
}

export interface SqlResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
}

/**
 * Run a single read-only SELECT and return up to MAX_ROWS rows. The query is
 * wrapped in a capped subquery and executed inside a rolled-back READ ONLY
 * transaction with a statement timeout.
 */
export async function runReadOnlySql(sql: string): Promise<SqlResult> {
  const safe = assertReadOnlySelect(sql);
  // Cap rows at the database level so a query returning millions of rows can't
  // be pulled into memory. Wrapping a `WITH ... SELECT` in a subquery is valid.
  const capped = `select * from (\n${safe}\n) as _capped limit ${MAX_ROWS + 1}`;

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set transaction read only");
    await client.query(`set local statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    const res = await client.query(capped);
    await client.query("rollback");

    const truncated = res.rows.length > MAX_ROWS;
    const rows = truncated ? res.rows.slice(0, MAX_ROWS) : res.rows;
    return { rows, rowCount: rows.length, truncated };
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      /* ignore rollback failure */
    }
    throw err;
  } finally {
    client.release();
  }
}
