import { createMistral } from "@ai-sdk/mistral";
import { tool } from "ai";
import { z } from "zod";
import { runReadOnlySql, UnsafeSqlError } from "./db";
import { getLiveSchema } from "./schema";

/**
 * The Mistral text-to-SQL agent powering the Assistant IA.
 *
 * The model writes read-only SQL (runSql tool) against the live database and
 * may draw charts from the results (renderChart tool). We reuse the existing
 * MISTRAL_API_KEY — no new AI vendor. mistral-large gives the best SQL
 * accuracy; switch the constant to mistral-small-latest to trade accuracy for
 * cost.
 */

export const MODEL = "mistral-large-latest";

function getModel() {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("MISTRAL_API_KEY non configuré");
  return createMistral({ apiKey })(MODEL);
}

/**
 * Schema the model reasons over. Hand-written from supabase/migrations/ plus
 * the v_* reporting views. Keep in sync when migrations change the schema.
 */
export function getSchemaContext(): string {
  return `BASE DE DONNÉES (PostgreSQL, schéma public). Plateforme de délégués médicaux "Handson".

TABLES PRINCIPALES
- users(id uuid, clerk_id, email, first_name, last_name, phone, avatar_url,
    role text['delegue'|'superviseur'], daily_visit_goal int, created_at, updated_at)
- doctors(id uuid, first_name, last_name, doctor_type text['medecin'|'pharmacien'|'grossiste'],
    specialty, address, wilaya, commune, phone, phone_fixe, phone_mobile, email,
    grossiste_pharma, grossiste_para_pharm (texte hérité, gelé), potentiel text['A'|'B'|'C'|null],
    engagement numeric (MOYENNE des engagements de visite), latitude, longitude,
    created_by uuid->users.id, created_at, updated_at)
    -- les grossistes sont des contacts doctor_type='grossiste' (nom dans last_name).
- products(id uuid, name, description, active bool, reference, laboratory,
    quantity int, price numeric, notes, created_at, updated_at)
- visits(id uuid, user_id uuid->users.id, doctor_id uuid->doctors.id,
    product_id uuid->products.id (null pour pharmacien/grossiste),
    visit_type text['medecin'|'pharmacien'|'grossiste'],
    objective text, compte_rendu text, engagement int[1..5|null] (saisi par visite), created_at)
    -- colonnes héritées (anciennes visites): accepted_order bool, synapgen_count int,
    --   prescriptions_received int, prescribing_doctor text, etc. Préférer visit_answers.
- doctor_grossistes(doctor_id->doctors.id (pharmacie), grossiste_id->doctors.id,
    category text['pharma'|'para_pharm']) -- grossistes actuels d'une pharmacie.
- visit_grossistes(visit_id->visits.id, grossiste_id->doctors.id,
    category text['pharma'|'para_pharm']) -- grossistes relevés lors d'une visite pharmacie.
- visit_answers(id, visit_id->visits.id, question_id->product_questions.id,
    value_boolean bool, value_text text, value_number numeric, created_at)
    -- une seule des trois valeurs est non-nulle par ligne.
- product_questions(id, product_id->products.id, target_role text['medecin'|'pharmacien'],
    label text, input_type text['yes_no'|'short_text'|'textarea'|'number'],
    required bool, display_order int, deleted_at, created_at, updated_at)
- visit_comments(id, visit_id->visits.id, user_id->users.id, parent_id->visit_comments.id,
    content text, image_url text, created_at)
- visit_assignments(id, assignee_id->users.id, doctor_id->doctors.id, assigned_by->users.id,
    status text['pending'|'completed'|'overdue'], deadline timestamptz, note text,
    completed_at, visit_id->visits.id, created_at, updated_at)
- territory_assignments(id, user_id->users.id, wilaya, assigned_by, created_at)
- notifications(id, user_id->users.id, type, title, message, link, entity_id, entity_type,
    read bool, created_at)
- invited_users(id, email, invited_by, created_at)

VUES (agrégats prêts à l'emploi)
- v_visits_full_rows — visites enrichies (médecin, délégué, produit, réponses).
- v_doctors_with_stats_rows — répertoire médecins/pharmaciens avec statistiques.
- v_delegue_performance_rows — performance par délégué.
- v_dynamic_answers_long_rows — réponses de formulaire au format long.
- v_comments_full_rows — commentaires enrichis.
- v_assignments_outcomes_rows — planifications et leur issue.
- v_visit_grossistes_rows — grossistes relevés par visite (pharmacie, grossiste, catégorie).
- v_doctor_grossistes_rows — grossistes actuels par pharmacie.

NOTES
- Les dates sont en UTC (timestamptz). Pour "cette semaine" utilise date_trunc('week', now()).
- doctor_type='pharmacien'/'grossiste' => visites sans product_id; 'medecin' => product_id requis.
- Le nombre de visites d'un médecin = count(*) sur visits (PAS le nombre de commentaires).
- engagement du médecin = doctors.engagement = moyenne de coalesce(visits.engagement, 0) sur les visites non-grossiste (une visite sans engagement compte comme 0).
- Joins fréquents: visits.user_id=users.id, visits.doctor_id=doctors.id.`;
}

/** Few-shot examples that anchor the model on the real schema + question style. */
function getExamples(): string {
  return `EXEMPLES (question -> SQL)
- « Nombre de visites par délégué cette semaine »
  SELECT u.first_name, u.last_name, COUNT(*) AS visites
  FROM visits v JOIN users u ON u.id = v.user_id
  WHERE v.created_at >= date_trunc('week', now())
  GROUP BY u.id, u.first_name, u.last_name
  ORDER BY visites DESC;
- « Engagement moyen des médecins par wilaya »
  SELECT wilaya, ROUND(AVG(engagement), 2) AS engagement_moyen
  FROM doctors
  WHERE doctor_type = 'medecin' AND engagement IS NOT NULL
  GROUP BY wilaya ORDER BY engagement_moyen DESC;
- « Combien de visites a le médecin X ? » (par visites, pas par commentaires)
  SELECT COUNT(*) AS nb_visites
  FROM visits v JOIN doctors d ON d.id = v.doctor_id
  WHERE d.last_name ILIKE '%X%';
- « Quelles pharmacies sont fournies par le grossiste "Y" ? »
  SELECT DISTINCT ph.last_name AS pharmacie, ph.wilaya
  FROM doctor_grossistes dg
  JOIN doctors ph ON ph.id = dg.doctor_id
  JOIN doctors g ON g.id = dg.grossiste_id
  WHERE g.doctor_type = 'grossiste' AND g.last_name ILIKE '%Y%';`;
}

export async function getSystemPrompt(): Promise<string> {
  // Prefer the live introspected schema; fall back to the hand-written one.
  const live = await getLiveSchema();
  const schema = live
    ? `${getSchemaContext()}\n\n${live}`
    : getSchemaContext();

  return `Tu es l'assistant analytique de Handson, une entreprise pharmaceutique algérienne. Tu réponds aux questions du superviseur sur les données de visites médicales en interrogeant la base en direct.

OUTILS
- runSql: exécute UNE requête SQL en LECTURE SEULE (SELECT uniquement) et renvoie les lignes. Utilise-le pour TOUTE question quantitative ou factuelle. Tu peux l'appeler plusieurs fois pour affiner.
- renderChart: affiche un graphique à partir de données DÉJÀ agrégées (pas de lignes brutes). Utilise-le quand l'utilisateur demande un graphique ou quand une visualisation aide vraiment.

RÈGLES SQL
- PostgreSQL. Uniquement des requêtes SELECT (ou WITH ... SELECT). Jamais d'écriture.
- Limite les résultats (ex: LIMIT, GROUP BY) — ne ramène pas des milliers de lignes.
- Utilise ILIKE pour les recherches de noms (insensible à la casse).

RÉCUPÉRATION D'ERREUR
- Si runSql renvoie un champ "error", NE t'excuse pas et NE renonce pas : lis le message, corrige la requête et réessaie.
- Colonne ou table inconnue ? Vérifie le SCHÉMA ci-dessous, ou interroge information_schema.columns pour trouver le bon nom, puis relance.
- Persiste jusqu'à 3 tentatives avant d'expliquer honnêtement pourquoi tu n'y arrives pas.

RÈGLES DE RÉPONSE
- Réponds en français. Le texte est affiché en markdown rendu : utilise une mise en forme propre et lisible.
  - **Gras** pour les chiffres et noms clés.
  - Listes à puces ou numérotées pour énumérer.
  - Tableaux markdown quand tu compares plusieurs lignes/colonnes.
  - PAS de titres lourds (#, ##) ni de lignes de séparation (---). Reste compact.
- Ne JAMAIS inventer un chiffre ou un nom : appuie-toi uniquement sur les résultats SQL.
- Si l'information n'existe pas dans la base, dis-le honnêtement.
- Quand tu affiches un graphique, ajoute une phrase de synthèse (ne répète pas toutes les valeurs).
- Sois concis, professionnel et actionnable.

${getExamples()}

SCHÉMA
${schema}`;
}

/** A chart spec the UI renders with recharts. */
export const chartSpecSchema = z.object({
  type: z.enum(["bar", "line", "area", "pie"]),
  title: z.string().describe("Titre court du graphique, en français."),
  data: z
    .array(z.record(z.string(), z.union([z.string(), z.number(), z.null()])))
    .describe("Données déjà agrégées. Chaque objet = un point/une barre."),
  xKey: z.string().describe("Nom du champ servant d'axe X / de catégorie."),
  series: z
    .array(
      z.object({
        key: z.string().describe("Nom du champ numérique à tracer."),
        label: z.string().describe("Libellé lisible de la série."),
      })
    )
    .describe("Une ou plusieurs séries numériques à tracer."),
});

export type ChartSpec = z.infer<typeof chartSpecSchema>;

export const tools = {
  runSql: tool({
    description:
      "Exécute une requête SQL PostgreSQL en lecture seule (SELECT uniquement) sur la base Handson et renvoie les lignes.",
    inputSchema: z.object({
      query: z.string().describe("La requête SELECT à exécuter."),
    }),
    execute: async ({ query }) => {
      try {
        const { rows, rowCount, truncated } = await runReadOnlySql(query);
        // Truncate the rows handed back to the model to protect token budget;
        // the model rarely needs more than a sample to answer or chart.
        const preview = rows.slice(0, 50);
        return {
          rowCount,
          truncated,
          previewTruncated: rows.length > preview.length,
          rows: preview,
        };
      } catch (err) {
        const message =
          err instanceof UnsafeSqlError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Erreur SQL inconnue";
        return { error: message };
      }
    },
  }),

  renderChart: tool({
    description:
      "Affiche un graphique dans le chat à partir de données déjà agrégées (issues de runSql). N'invente pas de données.",
    inputSchema: chartSpecSchema,
    // Pure validator: echo the spec back so the model knows it succeeded. The
    // UI reads this tool part to draw the chart.
    execute: async (spec) => ({ ok: true, ...spec }),
  }),
};

export { getModel };
