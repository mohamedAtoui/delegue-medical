-- Migration 017 — least-privilege read-only role for the AI assistant
--
-- The "Assistant IA" feature lets a supervisor ask questions answered by
-- live SQL the model writes. That SQL must NEVER be able to mutate data, so
-- it runs as this dedicated role instead of the service key. The role can
-- only SELECT, every session is read-only, and queries time out after 10s.
--
-- IMPORTANT: set a strong password for this role in the Supabase dashboard
-- (Database → Roles) — do not commit a real password here. Then build the
-- DATABASE_URL_READONLY connection string with this role and put it in the
-- server env (Vercel + .env.local).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ai_ro') then
    -- Password is a placeholder; rotate it in the dashboard after running.
    create role ai_ro login password 'REPLACE_IN_DASHBOARD';
  end if;
end
$$;

-- Read access to the public schema. GRANT ... ON ALL TABLES also covers
-- views, so the v_* reporting views (v_visits_full_rows, v_delegue_performance_rows,
-- v_doctors_with_stats_rows, v_dynamic_answers_long_rows, v_comments_full_rows,
-- v_assignments_outcomes_rows) are reachable too.
grant usage on schema public to ai_ro;
grant select on all tables in schema public to ai_ro;

-- Tables/views created later are automatically SELECT-able by ai_ro.
alter default privileges in schema public grant select on tables to ai_ro;

-- Belt: the role can only ever read, and slow queries are killed at 10s.
alter role ai_ro set default_transaction_read_only = on;
alter role ai_ro set statement_timeout = '10s';
