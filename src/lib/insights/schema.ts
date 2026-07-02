import { runReadOnlySql } from "./db";

/**
 * Live schema introspection for the Assistant IA.
 *
 * Instead of only trusting a hand-written schema string (which drifts every
 * time a migration runs), we read the actual columns of every table/view in
 * the public schema straight from information_schema. This keeps the model
 * aware of new columns (e.g. visits.engagement) and tables (grossiste links)
 * the moment they exist. The result is cached briefly and there is a hard
 * fallback to the hand-written schema when introspection fails.
 *
 * The introspection query is a plain SELECT over information_schema and passes
 * the same read-only guard as any model query (no forbidden keywords, single
 * statement).
 */

interface SchemaCache {
  text: string;
  at: number;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes
let cache: SchemaCache | null = null;

/** Reset the cache — used by tests. */
export function _clearSchemaCache() {
  cache = null;
}

export async function getLiveSchema(): Promise<string | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.text;

  try {
    const { rows } = await runReadOnlySql(
      `select table_name, column_name, data_type
         from information_schema.columns
        where table_schema = 'public'
        order by table_name, ordinal_position`
    );

    if (!rows.length) return null;

    const byTable = new Map<string, string[]>();
    for (const r of rows as {
      table_name: string;
      column_name: string;
      data_type: string;
    }[]) {
      if (!byTable.has(r.table_name)) byTable.set(r.table_name, []);
      byTable.get(r.table_name)!.push(`${r.column_name} ${r.data_type}`);
    }

    const lines: string[] = [];
    for (const [table, cols] of byTable) {
      lines.push(`- ${table}(${cols.join(", ")})`);
    }

    const text = `SCHÉMA LIVE (introspection information_schema, schéma public) :\n${lines.join(
      "\n"
    )}`;
    cache = { text, at: Date.now() };
    return text;
  } catch {
    // Fall back to the hand-written schema in agent.ts.
    return null;
  }
}
