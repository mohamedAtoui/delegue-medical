import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { createClient } from "@/utils/supabase/server";
import { getOrCreateUser } from "@/lib/clerk/sync-user";
import { askAboutVisits } from "@/lib/mistral";

/* ─── Tunables ───────────────────────────────────────────────────────── */
const SAMPLE_SIZE = 60;             // visits with full detail
const FALLBACK_WINDOW_DAYS = 21;    // when no date filter, default to last 3 weeks
const TOP_DOCTORS = 20;             // doctors snapshot in RÉPERTOIRE
const TOP_DELEGUES = 10;             // top reps in AGRÉGATS
const COMMENTS_PER_VISIT = 3;
const COMMENT_MAX_CHARS = 200;
const CONTEXT_BUDGET_CHARS = 90_000; // ~22K tokens — leaves room for response

/* ─── Helpers ────────────────────────────────────────────────────────── */
function yn(v: boolean | null | undefined): string {
  if (v === true) return "Oui";
  if (v === false) return "Non";
  return "—";
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return format(new Date(iso), "d MMM yyyy", { locale: fr });
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  return format(new Date(iso), "d MMM", { locale: fr });
}

interface DynamicAnswer {
  value_boolean: boolean | null;
  value_text: string | null;
  value_number: number | null;
  question: { label: string; product?: { name: string } | null } | null;
}

function formatDynamicAnswer(a: DynamicAnswer): string | null {
  const label = a.question?.label;
  if (!label) return null;
  const product = a.question?.product?.name ? ` [${a.question.product.name}]` : "";
  if (a.value_boolean !== null && a.value_boolean !== undefined) {
    return `${label}${product}: ${a.value_boolean ? "Oui" : "Non"}`;
  }
  if (a.value_number !== null && a.value_number !== undefined) {
    return `${label}${product}: ${a.value_number}`;
  }
  if (a.value_text) {
    return `${label}${product}: ${a.value_text}`;
  }
  return null;
}

interface CommentRow {
  content: string | null;
  image_url: string | null;
  created_at: string;
  parent_id: string | null;
  user: { first_name: string | null; last_name: string | null } | null;
}

function formatComment(c: CommentRow): string {
  const author = `${c.user?.first_name ?? ""} ${c.user?.last_name ?? ""}`.trim() || "Quelqu'un";
  const date = fmtDateShort(c.created_at);
  if (!c.content && c.image_url) return `[${author} — ${date}]: [image jointe]`;
  const text = (c.content ?? "").length > COMMENT_MAX_CHARS
    ? (c.content ?? "").slice(0, COMMENT_MAX_CHARS) + "…"
    : c.content;
  return `[${author} — ${date}]: ${text}${c.image_url ? " [image jointe]" : ""}`;
}

function relativeFromNow(deadlineIso: string): string {
  const ms = new Date(deadlineIso).getTime() - Date.now();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return `EN RETARD de ${Math.abs(days)} jour(s)`;
  if (days === 0) return "échéance aujourd'hui";
  return `échéance dans ${days} jour(s)`;
}

/* ─── Filter typing ──────────────────────────────────────────────────── */
interface SummaryFilters {
  user_id?: string | null;
  from?: string | null;
  to?: string | null;
  type?: "medecin" | "pharmacien" | null;
  wilaya?: string | null;
}

/* ─── Route handler ──────────────────────────────────────────────────── */
export async function POST(request: NextRequest) {
  // Auth + role check (supervisor only)
  const currentUser = await getOrCreateUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (currentUser.role !== "superviseur") {
    return NextResponse.json(
      { error: "Réservé au superviseur" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { wilaya, user_id, from: fromInput, to: toInput, type, prompt } = body;

  // Apply 3-week fallback window when neither date filter is set
  let from: string | null = fromInput || null;
  const to: string | null = toInput || null;
  let usedFallback = false;
  if (!from && !to) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() - FALLBACK_WINDOW_DAYS);
    from = fallback.toISOString();
    usedFallback = true;
  }

  const filters: SummaryFilters = {
    user_id: user_id && user_id !== "all" ? user_id : null,
    from,
    to,
    type: type === "medecin" || type === "pharmacien" ? type : null,
    wilaya: wilaya || null,
  };

  const supabase = await createClient();

  // Helper: apply common filters to a visits query builder
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilters = (q: any) => {
    if (filters.user_id) q = q.eq("user_id", filters.user_id);
    if (filters.from) q = q.gte("created_at", filters.from);
    if (filters.to) q = q.lte("created_at", filters.to);
    if (filters.type) q = q.eq("visit_type", filters.type);
    if (filters.wilaya) q = q.eq("doctor.wilaya", filters.wilaya);
    return q;
  };

  // Doctor join shape — !inner forces wilaya filter to apply on the join
  const doctorJoinFull = filters.wilaya
    ? "doctor:doctors!inner(first_name, last_name, doctor_type, specialty, wilaya, commune, address, potentiel, engagement)"
    : "doctor:doctors(first_name, last_name, doctor_type, specialty, wilaya, commune, address, potentiel, engagement)";

  const doctorJoinCompact = filters.wilaya
    ? "doctor:doctors!inner(first_name, last_name, doctor_type, specialty, wilaya, commune, potentiel)"
    : "doctor:doctors(first_name, last_name, doctor_type, specialty, wilaya, commune, potentiel)";

  /* ─── Aggregates over the FULL filter ────────────────────────────── */
  const totalCountQ = applyFilters(
    supabase.from("visits").select("*, doctor:doctors!inner(wilaya)", {
      count: "exact",
      head: true,
    })
  );
  const byTypeQ = applyFilters(
    supabase.from("visits").select(`visit_type, ${doctorJoinCompact}`).limit(2000)
  );
  const byUserQ = applyFilters(
    supabase
      .from("visits")
      .select(`user_id, user:users(first_name, last_name), ${doctorJoinCompact}`)
      .limit(2000)
  );

  const [{ count: totalCount }, byTypeRes, byUserRes] = await Promise.all([
    totalCountQ,
    byTypeQ,
    byUserQ,
  ]);

  if (!totalCount) {
    return NextResponse.json({
      summary: "Aucune visite trouvée pour les critères sélectionnés.",
    });
  }

  // Reduce byType / byUser
  const byTypeRows = (byTypeRes.data || []) as { visit_type: string }[];
  const medecinCount = byTypeRows.filter((r) => r.visit_type === "medecin").length;
  const pharmacienCount = byTypeRows.filter((r) => r.visit_type === "pharmacien").length;

  const byUserRows = (byUserRes.data || []) as Array<{
    user_id: string;
    user: { first_name: string | null; last_name: string | null } | null;
  }>;
  const delegueCounts = new Map<string, { name: string; count: number }>();
  for (const row of byUserRows) {
    const name = `${row.user?.first_name ?? ""} ${row.user?.last_name ?? ""}`.trim() || "Inconnu";
    const cur = delegueCounts.get(row.user_id) ?? { name, count: 0 };
    cur.count++;
    delegueCounts.set(row.user_id, cur);
  }
  const topDelegues = Array.from(delegueCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_DELEGUES);

  /* ─── RÉPERTOIRE: top doctors, products catalog, open assignments ── */

  // Top doctors in filter scope (reuse byUserRows structure with doctor nested)
  // We need a separate query because byUserRows didn't fetch full doctor; do compact.
  const topDoctorsQ = applyFilters(
    supabase.from("visits").select(`doctor_id, ${doctorJoinCompact}`).limit(2000)
  );

  // Active products (no filter — supervisor sees full catalog)
  const productsQ = supabase
    .from("products")
    .select("name, laboratory, quantity, price")
    .eq("active", true)
    .order("name");

  // Open assignments — apply user filter if delegue is selected
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let assignmentsQ: any = supabase
    .from("visit_assignments")
    .select(
      `deadline, status, note,
       assignee:users!visit_assignments_assignee_id_fkey(first_name, last_name),
       doctor:doctors(first_name, last_name, doctor_type, wilaya)`
    )
    .eq("status", "pending")
    .order("deadline", { ascending: true })
    .limit(50);
  if (filters.user_id) assignmentsQ = assignmentsQ.eq("assignee_id", filters.user_id);

  const [topDoctorsRes, productsRes, assignmentsRes] = await Promise.all([
    topDoctorsQ,
    productsQ,
    assignmentsQ,
  ]);

  const topDoctorsRaw = (topDoctorsRes.data || []) as Array<{
    doctor_id: string;
    doctor: {
      first_name: string;
      last_name: string;
      doctor_type: string;
      specialty: string | null;
      wilaya: string;
      commune: string | null;
      potentiel: string | null;
    } | null;
  }>;
  const doctorCounts = new Map<
    string,
    { row: typeof topDoctorsRaw[0]["doctor"]; count: number }
  >();
  for (const r of topDoctorsRaw) {
    if (!r.doctor) continue;
    const cur = doctorCounts.get(r.doctor_id) ?? { row: r.doctor, count: 0 };
    cur.count++;
    doctorCounts.set(r.doctor_id, cur);
  }
  const topDoctors = Array.from(doctorCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_DOCTORS);

  const products = (productsRes.data || []) as Array<{
    name: string;
    laboratory: string | null;
    quantity: number | null;
    price: number | null;
  }>;

  const now = Date.now();
  const openAssignments = ((assignmentsRes.data || []) as Array<{
    deadline: string;
    status: string;
    note: string | null;
    assignee: { first_name: string | null; last_name: string | null } | null;
    doctor: {
      first_name: string;
      last_name: string;
      doctor_type: string;
      wilaya: string;
    } | null;
  }>).map((a) => ({
    ...a,
    isOverdue: new Date(a.deadline).getTime() < now,
  }));
  const overdueCount = openAssignments.filter((a) => a.isOverdue).length;
  const pendingCount = openAssignments.length - overdueCount;

  /* ─── Sample query: full detail ──────────────────────────────────── */
  const sampleQ = applyFilters(
    supabase
      .from("visits")
      .select(
        `*, ${doctorJoinFull},
         user:users(first_name, last_name),
         visit_answers(value_boolean, value_text, value_number,
           question:product_questions(label, product:products(name))),
         comments:visit_comments(content, image_url, created_at, parent_id,
           user:users(first_name, last_name))`
      )
      .order("created_at", { ascending: false })
      .limit(SAMPLE_SIZE)
  );

  const sampleRes = await sampleQ;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sample = (sampleRes.data || []) as any[];

  const sampleFrom = sample.at(-1)?.created_at;
  const sampleTo = sample[0]?.created_at;
  const samplePct = totalCount > 0 ? Math.round((sample.length / totalCount) * 100) : 0;

  /* ─── Build context ──────────────────────────────────────────────── */
  const filterLines = [
    `Période demandée: ${from ? fmtDate(from) : "—"} → ${to ? fmtDate(to) : "maintenant"}${usedFallback ? " (par défaut: 3 dernières semaines)" : ""}`,
    `Délégué: ${filters.user_id ? topDelegues.find((d) => d.name)?.name ?? "filtré" : "tous"}`,
    `Wilaya: ${filters.wilaya ?? "toutes"}`,
    `Type: ${filters.type === "medecin" ? "Médecin" : filters.type === "pharmacien" ? "Pharmacien" : "tous"}`,
  ];

  const aggregatesLines = [
    `Total: ${totalCount} visite(s)`,
    `  • Médecins: ${medecinCount}`,
    `  • Pharmaciens: ${pharmacienCount}`,
    "",
    `Top délégués (par nombre de visites):`,
    ...topDelegues.map((d, i) => `  ${i + 1}. ${d.name} — ${d.count} visite(s)`),
  ];

  const repertoireLines: string[] = [];
  if (topDoctors.length > 0) {
    repertoireLines.push(`Top ${topDoctors.length} médecins/pharmaciens dans la période:`);
    for (const { row, count } of topDoctors) {
      if (!row) continue;
      const isPharm = row.doctor_type === "pharmacien";
      const prefix = isPharm ? "" : "Dr. ";
      const spec = row.specialty ? `, ${row.specialty}` : "";
      const loc = `${row.wilaya}${row.commune ? ` (${row.commune})` : ""}`;
      const pot = row.potentiel ? ` — Potentiel ${row.potentiel}` : "";
      repertoireLines.push(`  • ${prefix}${row.last_name} ${row.first_name}${spec}, ${loc}${pot} — ${count} visite(s)`);
    }
    repertoireLines.push("");
  }

  if (products.length > 0) {
    repertoireLines.push(`Catalogue produits actifs (${products.length}):`);
    for (const p of products) {
      const lab = p.laboratory ? ` — ${p.laboratory}` : "";
      const stock = p.quantity != null ? ` — stock: ${p.quantity}` : "";
      const price = p.price != null ? ` — prix: ${p.price} DA` : "";
      repertoireLines.push(`  • ${p.name}${lab}${stock}${price}`);
    }
    repertoireLines.push("");
  }

  if (openAssignments.length > 0) {
    repertoireLines.push(`Planifications ouvertes (${pendingCount} en attente, ${overdueCount} en retard):`);
    for (const a of openAssignments.slice(0, 30)) {
      if (!a.doctor) continue;
      const isPharm = a.doctor.doctor_type === "pharmacien";
      const docName = `${isPharm ? "" : "Dr. "}${a.doctor.last_name} ${a.doctor.first_name}`;
      const repName = `${a.assignee?.first_name ?? ""} ${a.assignee?.last_name ?? ""}`.trim() || "Inconnu";
      const status = a.isOverdue ? "EN RETARD" : relativeFromNow(a.deadline);
      const noteSuffix = a.note ? ` — note: ${a.note}` : "";
      repertoireLines.push(`  • ${docName} (${a.doctor.wilaya}) — assigné à ${repName} — ${status}${noteSuffix}`);
    }
  }

  // Sample rendering
  const sampleHeader = [
    `${sample.length} visite(s) les plus récentes${sampleFrom && sampleTo ? `, du ${fmtDate(sampleFrom)} au ${fmtDate(sampleTo)}` : ""}.`,
    sample.length === totalCount
      ? "(L'échantillon couvre 100% du filtre.)"
      : `(${samplePct}% du filtre — ${totalCount - sample.length} visite(s) plus anciennes non détaillées.)`,
    "",
  ];

  const sampleLines: string[] = [];
  sample.forEach((v, i) => {
    const isPharm = v.visit_type === "pharmacien";
    const docName = `${isPharm ? "" : "Dr. "}${v.doctor?.last_name ?? ""} ${v.doctor?.first_name ?? ""}`.trim();
    const spec = v.doctor?.specialty ? `, ${v.doctor.specialty}` : "";
    const loc = `${v.doctor?.wilaya ?? ""}${v.doctor?.commune ? ` (${v.doctor.commune})` : ""}`;
    const rep = `${v.user?.first_name ?? ""} ${v.user?.last_name ?? ""}`.trim();

    sampleLines.push(
      `${i + 1}. [${isPharm ? "Pharmacien" : "Médecin"}] [${docName}${spec}, ${loc}] [Délégué: ${rep}] [${fmtDateShort(v.created_at)}]`
    );
    if (v.objective) sampleLines.push(`   Objectif: ${v.objective}`);
    if (v.compte_rendu) sampleLines.push(`   Compte rendu: ${v.compte_rendu}`);

    // Dynamic answers — preferred when present
    const dynamicAnswers = (v.visit_answers || []) as DynamicAnswer[];
    if (dynamicAnswers.length > 0) {
      const formatted = dynamicAnswers
        .map(formatDynamicAnswer)
        .filter((s): s is string => s !== null);
      if (formatted.length > 0) {
        sampleLines.push("   Réponses:");
        formatted.forEach((s) => sampleLines.push(`     • ${s}`));
      }
    } else {
      // Fallback to legacy columns for pre-008 visits
      if (isPharm) {
        if (v.synapgen_count != null) sampleLines.push(`   Stock Synapgen: ${v.synapgen_count}`);
        if (v.prescriptions_received != null)
          sampleLines.push(`   Prescriptions reçues: ${v.prescriptions_received}`);
        if (v.prescribing_doctor) sampleLines.push(`   Prescripteur: ${v.prescribing_doctor}`);
        if (v.accepted_order !== null)
          sampleLines.push(`   Commande acceptée: ${yn(v.accepted_order)}`);
      } else {
        const legacy = [
          `Synapgen résout: ${yn(v.synapgen_solves)}`,
          `Déjà prescrit: ${yn(v.already_prescribed)}`,
          `Promis suggérer: ${yn(v.promised_to_suggest)}`,
          `Objection prix: ${yn(v.price_objection)}`,
          `Magnésium: ${yn(v.prescribes_magnesium)}${v.magnesium_brand ? ` (${v.magnesium_brand})` : ""}`,
          `Effets secondaires: ${yn(v.fears_side_effects)}`,
          `Retour patients: ${yn(v.patient_feedback)}${v.patient_feedback_comment ? ` (${v.patient_feedback_comment})` : ""}`,
          `Retour ordonnance: ${yn(v.ordonnance_return)}`,
          `Échantillon donné: ${yn(v.free_sample)}`,
        ];
        sampleLines.push("   Évaluation:");
        legacy.forEach((s) => sampleLines.push(`     • ${s}`));
      }
    }

    // Comments — last N (most recent first)
    const comments = (v.comments || []) as CommentRow[];
    const recent = [...comments]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, COMMENTS_PER_VISIT);
    if (recent.length > 0) {
      sampleLines.push(`   Commentaires (${recent.length} plus récent${recent.length > 1 ? "s" : ""}):`);
      recent.forEach((c) => sampleLines.push(`     • ${formatComment(c)}`));
    }

    sampleLines.push("");
  });

  /* ─── Stitch it all together with budget guard ───────────────────── */
  function buildContext(rows: string[]): string {
    return [
      "═══ FILTRES APPLIQUÉS ═══",
      ...filterLines,
      "",
      "═══ AGRÉGATS (sur l'ensemble du filtre) ═══",
      ...aggregatesLines,
      "",
      "═══ RÉPERTOIRE ═══",
      ...repertoireLines,
      "",
      "═══ ÉCHANTILLON DÉTAILLÉ ═══",
      ...sampleHeader,
      ...rows,
    ].join("\n");
  }

  let context = buildContext(sampleLines);
  // Token-budget guard: if too big, halve the sample lines (rough but effective)
  if (context.length > CONTEXT_BUDGET_CHARS) {
    // Find the per-visit boundary by counting blank-line separators
    // and rebuild with the first half of the visit blocks
    const halfSample = Math.max(1, Math.floor(sample.length / 2));
    const blocks: string[][] = [];
    let cur: string[] = [];
    for (const line of sampleLines) {
      cur.push(line);
      if (line === "") {
        blocks.push(cur);
        cur = [];
      }
    }
    if (cur.length) blocks.push(cur);
    const trimmed = blocks.slice(0, halfSample).flat();
    trimmed.push(
      `… (${sample.length - halfSample} visite(s) supplémentaires non détaillées pour rester dans le budget de tokens)`
    );
    context = buildContext(trimmed);
  }

  /* ─── Call Mistral ───────────────────────────────────────────────── */
  try {
    const summary = await askAboutVisits(
      context,
      prompt || "Résume les points clés de ces visites."
    );
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur IA" },
      { status: 500 }
    );
  }
}
