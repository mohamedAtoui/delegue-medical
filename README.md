# Handson Délégué Médical

Pharmaceutical sales rep platform — French-only — for **Handson** (Algeria).
Built on Next.js 15 (App Router) + Clerk + Supabase.

| Stack | Service |
|---|---|
| Frontend | Next.js 15 (App Router, Server Components) |
| Auth | Clerk (Google sign-in) |
| Database | Supabase (Postgres) |
| Hosting | Vercel |
| Styling | Tailwind v4 + shadcn/ui (base-ui) |
| AI | Mistral (visit summaries) |

---

## Two roles

| Role | Capabilities |
|---|---|
| **Délégué** | Log visits, schedule own follow-ups, see daily-goal progress, comment on visits |
| **Superviseur** | Everything above + manage delegues, assign visits, manage products + questions, edit/delete doctors and visits, view team dashboard, invite new delegues |

A user becomes a `superviseur` if their email is in `SUPERVISOR_EMAILS` (env var).
Other emails must be added to `invited_users` by a supervisor before they can sign up — see *Sign-up allowlist* below.

---

## Getting started (local dev)

### 1. Install
```bash
npm install
```

### 2. Environment variables (`.env.local`)
```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJ...   # anon key
SUPABASE_SERVICE_ROLE_KEY=eyJ...                       # service role (server only)

# App config
SUPERVISOR_EMAILS=you@example.com,boss@example.com    # comma-separated; becomes superviseurs on first sign-in

# Mistral (optional, for AI summaries on dashboard)
MISTRAL_API_KEY=...
```

### 3. Apply database migrations
Migrations live in `supabase/migrations/` and are numbered. Apply them in order through the Supabase SQL editor (or `supabase db push` if you've set up the Supabase CLI).

All migrations are **idempotent** — re-running on an existing DB is safe.

```
001_initial_schema.sql           ← baseline (all core tables)
008_product_questions.sql        ← dynamic per-product question system
009_visit_assignments.sql        ← planning / assignments
010_doctor_cascade.sql           ← cascade FKs from doctors
011_invited_users.sql            ← sign-up allowlist
012_user_daily_goal.sql          ← daily visit target
013_notifications.sql            ← notification system
014_doctor_commune.sql           ← optional commune field
015_product_extensions.sql       ← product stock/price/lab fields
016_visits_product_id_nullable.sql  ← pharmacien visits cover all products
017_ai_readonly_role.sql         ← least-privilege role for the Assistant IA
018_ai_conversations.sql         ← Assistant IA chat history
019_visit_engagement.sql         ← per-visit engagement + doctor average (trigger)
020_grossistes.sql               ← grossiste contacts + pharmacy↔grossiste links
021_reporting_views.sql          ← additive grossiste views for the Assistant IA
022_grossistes_cleanup.sql       ← reset grossiste directory to canonical list + relink
```

> **Note:** there's a numbering gap (002–007) — those changes were applied ad-hoc during early development and are consolidated into `001_initial_schema.sql`.

### 4. Storage bucket (one-time, in Supabase dashboard)
Create a public bucket named `comment-images` for visit-comment image attachments.

### 5. Run
```bash
npm run dev
```
Open http://localhost:3000.

---

## Branching workflow

We use a two-branch flow with Vercel automatic preview deployments.

| Branch | Purpose | Vercel deploys to |
|---|---|---|
| `main` | Production | Production domain |
| `dev` | Active development / staging | Preview URL (per push) |

```
feature work → dev → preview deploy → review on preview URL → merge dev → main → production
```

### Day-to-day commands

```bash
# Get latest dev
git checkout dev && git pull

# ... make changes ...
git add . && git commit -m "..." && git push origin dev

# When dev is verified and you want to ship to production:
git checkout main && git pull
git merge dev --ff-only && git push origin main
```

### Migrations + branching

We share **one Supabase project** between dev and prod. To stay safe:

- **Additive SQL** (add column / table / index / policy): run it in Supabase **as soon as you push the dev code** that needs it. Both dev and main keep working because the new column is just unused by main.
- **Destructive SQL** (drop column, NOT NULL constraint, rename): run it **only at the moment you merge dev → main**. Prod code becomes consistent with the new schema in the same window.

Every new feature should add a numbered migration file under `supabase/migrations/`.

---

## Project layout

```
src/
├── app/
│   ├── (app)/                ← authenticated app routes (sidebar layout)
│   │   ├── visites/          ← log + browse visits
│   │   ├── medecins/         ← doctor / pharmacien directory
│   │   ├── delegues/         ← supervisor: rep management
│   │   ├── planification/    ← upcoming visit assignments
│   │   ├── produits/         ← supervisor: product catalog
│   │   └── dashboard/        ← supervisor: KPIs + AI summary
│   ├── api/                  ← Route handlers
│   ├── sign-in / sign-up     ← Clerk pages
│   └── non-autorise/         ← public landing for blocked sign-ups
├── components/
│   ├── visits/               ← VisitForm, VisitEntry, DoctorVisitGroup, …
│   ├── doctors/              ← DoctorForm, DoctorSearch
│   ├── assignments/          ← AssignmentList, AssignmentCard, …
│   ├── notifications/        ← NotificationBell
│   ├── produits/             ← ProductQuestionsDialog
│   ├── dashboard/            ← StatsCards, ActivityFeed, AISummaryPanel
│   ├── shared/               ← WilayaSelect, DateRangeFilter, …
│   ├── layout/               ← Sidebar, MobileNav, AppShell
│   └── ui/                   ← shadcn primitives
├── lib/
│   ├── clerk/sync-user.ts    ← Clerk → Supabase user sync + allowlist
│   ├── config.ts             ← SUPERVISOR_EMAILS + helpers
│   ├── notifications/        ← notification creation helpers
│   ├── queries/              ← shared Supabase queries (visits, doctors, …)
│   └── constants/            ← wilayas, specialties
└── utils/supabase/           ← server + admin Supabase clients
```

---

## Sign-up allowlist

Anyone trying to sign in with Google goes through this gate:

1. Clerk authenticates them
2. `getOrCreateUser` (in `src/lib/clerk/sync-user.ts`) checks:
   - if email is in `SUPERVISOR_EMAILS` → role: `superviseur`, account created
   - else if email is in `invited_users` → role: `delegue`, account created
   - else → returns `null`; layout redirects to `/non-autorise`

A supervisor can manage invitations from the **Délégués** page → **Inviter un délégué** section.

---

## Common operations

| Task | Where |
|---|---|
| Add a supervisor | Edit `SUPERVISOR_EMAILS` env var in Vercel (Production + Preview) |
| Invite a delegue | `/delegues` page → "Inviter un délégué" → enter email |
| Add a product | `/produits` (supervisor only) |
| Add product questions | `/produits` → click product → "Gérer les questions" |
| Set a daily visit goal | `/delegues` → select rep → "Modifier" next to "Objectif du jour" |
| Plan a visit for someone | `/delegues` → select rep → Planification tab → Assigner |
| Plan a visit for yourself | `/planification` page (delegue) — or directly from a visit's comment toolbar |

---

## Notes

- App is **French-only** by design (no i18n)
- All Supabase tables have RLS enabled with permissive policies; auth is enforced in the API layer (Clerk + role checks). Tightening RLS would be a hardening pass.
- `visit_comments.image_url` points at the public `comment-images` Supabase bucket.
- Real-time push isn't wired; the notification bell polls `/api/notifications` every 60s.
