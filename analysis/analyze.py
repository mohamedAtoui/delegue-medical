"""
Handson — Data Analysis Pipeline

Reads CSV exports from data/ (Supabase `v_*` views) and writes a Markdown
report to data/ANALYSIS.md with embedded chart PNGs in data/charts/.

Usage:
    pip3 install -r analysis/requirements.txt
    python3 analysis/analyze.py
"""

from __future__ import annotations

import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import matplotlib

matplotlib.use("Agg")  # no GUI backend; just write PNGs
import matplotlib.pyplot as plt
import pandas as pd

# ─── Paths ─────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CHARTS = DATA / "charts"
REPORT = DATA / "ANALYSIS.md"

CSV_FILES = {
    "visits": "v_visits_full_rows.csv",
    "answers": "v_dynamic_answers_long_rows.csv",
    "doctors": "v_doctors_with_stats_rows.csv",
    "delegues": "v_delegue_performance_rows.csv",
    "comments": "v_comments_full_rows.csv",
    "assignments": "v_assignments_outcomes_rows.csv",
}

# ─── Active-delegue filter ─────────────────────────────────────────────
# We treat any registered délégué with 0 visits as a TEST account and
# exclude them from the analysis. Override here if a real rep happens to
# have 0 visits for a period (rare — usually they're onboarding).
def is_test_delegue(row) -> bool:
    return int(row.get("visits_total", 0) or 0) == 0

# Chart styling — keep it consistent + readable
plt.rcParams.update(
    {
        "figure.dpi": 110,
        "savefig.dpi": 110,
        "figure.autolayout": True,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.grid": True,
        "grid.alpha": 0.25,
        "font.size": 10,
    }
)
PRIMARY = "#2563eb"  # blue
ACCENT = "#f59e0b"  # amber
DANGER = "#dc2626"  # red
GREEN = "#16a34a"


# ─── Loading ───────────────────────────────────────────────────────────
def load_csvs() -> dict[str, pd.DataFrame]:
    """Load all 6 CSVs with date parsing. Bail loudly if any are missing."""
    missing = [name for name, fname in CSV_FILES.items() if not (DATA / fname).exists()]
    if missing:
        sys.exit(
            f"Missing CSVs in {DATA}/: {', '.join(missing)}.\n"
            "Export them from Supabase Table Editor → Views first."
        )

    date_cols = {
        "visits": ["visit_date", "visit_day"],
        "answers": ["visit_date"],
        "doctors": ["last_visit_at", "first_visit_at", "doctor_added_at"],
        "delegues": ["last_visit_at", "joined_at"],
        "comments": ["created_at", "visit_date"],
        "assignments": ["assigned_at", "deadline", "completed_at"],
    }
    out = {}
    for name, fname in CSV_FILES.items():
        df = pd.read_csv(DATA / fname)
        for col in date_cols.get(name, []):
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors="coerce", utc=True)
        out[name] = df

    # Identify test délégué accounts (0 visits) and excise them everywhere
    deleg = out["delegues"]
    test_mask = deleg.apply(is_test_delegue, axis=1)
    out["test_delegues"] = deleg[test_mask].copy()
    out["delegues"] = deleg[~test_mask].copy()

    real_ids = set(out["delegues"]["delegue_id"].tolist())
    # Visits, comments, assignments authored by test accounts → drop.
    # (Doctors aren't tied to a single delegue, so we keep all of them.)
    if "delegue_id" in out["visits"].columns:
        out["visits"] = out["visits"][out["visits"]["delegue_id"].isin(real_ids)].copy()
    if "assignee_name" in out["assignments"].columns and not out["delegues"].empty:
        real_names = set(out["delegues"]["delegue_name"].tolist())
        out["assignments"] = out["assignments"][
            out["assignments"]["assignee_name"].isin(real_names)
        ].copy()
    return out


# ─── Helpers ───────────────────────────────────────────────────────────
def save_chart(name: str, fig=None) -> str:
    """Save current figure (or `fig`) into data/charts/{name}.png. Returns
    the relative path for embedding in the Markdown report."""
    CHARTS.mkdir(parents=True, exist_ok=True)
    target = CHARTS / f"{name}.png"
    (fig or plt.gcf()).savefig(target, bbox_inches="tight")
    plt.close(fig or plt.gcf())
    return f"charts/{name}.png"


def now_utc() -> pd.Timestamp:
    return pd.Timestamp.now(tz="UTC")


def days_between(later: pd.Timestamp, earlier: pd.Timestamp) -> Optional[int]:
    if pd.isna(later) or pd.isna(earlier):
        return None
    return int((later - earlier).total_seconds() // 86400)


def yn(v) -> str:
    if pd.isna(v):
        return "—"
    return "Oui" if bool(v) else "Non"


def md_table(df: pd.DataFrame, max_rows: Optional[int] = None) -> str:
    if max_rows:
        df = df.head(max_rows)
    return df.to_markdown(index=False) if not df.empty else "_(aucune donnée)_"


# ─── Section builders ──────────────────────────────────────────────────
def section_overview(d: dict[str, pd.DataFrame]) -> str:
    v = d["visits"]
    deleg = d["delegues"]
    test = d["test_delegues"]
    doctors = d["doctors"]

    total_visits = len(v)
    total_doctors = len(doctors)
    n_real = len(deleg)
    n_test = len(test)

    now = now_utc()
    last_7d = int((v["visit_date"] >= now - pd.Timedelta(days=7)).sum())
    last_30d = int((v["visit_date"] >= now - pd.Timedelta(days=30)).sum())
    last_90d = int((v["visit_date"] >= now - pd.Timedelta(days=90)).sum())

    # Period span (first → last visit) + visits/day average
    span_md = "—"
    avg_md = "—"
    if not v.empty:
        first = v["visit_date"].min()
        last = v["visit_date"].max()
        days = max(1, (last - first).days)
        avg_md = f"{len(v) / days:.1f}"
        span_md = f"{first.strftime('%d %b %Y')} → {last.strftime('%d %b %Y')} ({days} j)"

    test_md = ""
    if n_test:
        test_names = ", ".join(test["delegue_name"].tolist())
        test_md = (
            f"\n> ℹ️  **{n_test} compte(s) test exclu(s)** : {test_names}.\n"
            "> _Reste du rapport calculé uniquement sur les comptes actifs._\n"
        )

    return f"""## 1. Vue d'ensemble

| Métrique | Valeur |
|---|---:|
| Délégué(s) actif(s) | **{n_real}** |
| Visites totales | **{total_visits}** |
| Période couverte | {span_md} |
| Médecins / pharmaciens dans le répertoire | **{total_doctors}** |
| Visites — 7 derniers jours | {last_7d} |
| Visites — 30 derniers jours | {last_30d} |
| Visites — 90 derniers jours | {last_90d} |
| Moyenne visites/jour (sur toute la période) | {avg_md} |
{test_md}"""


def section_delegue_scorecard(d: dict[str, pd.DataFrame]) -> str:
    deleg = d["delegues"].copy()
    v = d["visits"]

    if deleg.empty:
        return "## 2. Scorecard des délégués\n\n_Aucun délégué actif._\n"

    now = now_utc()
    deleg["days_since_last_visit"] = deleg["last_visit_at"].apply(
        lambda t: days_between(now, t) if pd.notna(t) else None
    )

    # When there's only one active rep we render a deeper single-rep view
    # rather than a one-row table.
    if len(deleg) == 1:
        return _single_rep_section(deleg.iloc[0], v)

    # ── Multi-rep view (kept for when team grows) ──────────────────────
    cols = [
        "delegue_name",
        "visits_total",
        "visits_last_30d",
        "doctors_covered",
        "daily_visit_goal",
        "completion_rate_pct",
        "days_since_last_visit",
    ]
    table = deleg[cols].rename(
        columns={
            "delegue_name": "Délégué",
            "visits_total": "Visites",
            "visits_last_30d": "30j",
            "doctors_covered": "Médecins couverts",
            "daily_visit_goal": "Objectif/jour",
            "completion_rate_pct": "Plans complétés (%)",
            "days_since_last_visit": "Jours depuis dernière visite",
        }
    ).sort_values("Visites", ascending=False)

    fig, ax = plt.subplots(figsize=(7, max(2.5, 0.5 * len(deleg))))
    plot_data = deleg.sort_values("visits_total", ascending=True)
    ax.barh(plot_data["delegue_name"], plot_data["visits_total"], color=PRIMARY)
    ax.set_xlabel("Nombre de visites")
    ax.set_title("Visites par délégué (cumul)")
    chart = save_chart("visits_per_delegue")

    return f"""## 2. Scorecard des délégués

{md_table(table)}

![Visites par délégué]({chart})
"""


def _single_rep_section(rep: pd.Series, v: pd.DataFrame) -> str:
    """Deep dive for one active rep — chart of daily visits + goal hit-rate."""
    mine = v[v["delegue_id"] == rep["delegue_id"]].copy()
    name = rep["delegue_name"]
    goal = int(rep["daily_visit_goal"] or 0)

    # Per-day visit counts across active period (no gaps)
    per_day = mine.groupby(mine["visit_date"].dt.date).size()
    if per_day.empty:
        return f"## 2. Scorecard — {name}\n\n_Aucune visite enregistrée._\n"
    full_range = pd.date_range(per_day.index.min(), per_day.index.max(), freq="D")
    per_day = per_day.reindex(full_range.date, fill_value=0)

    # Goal hit stats (only on days the rep actually worked = visits > 0)
    worked_days = per_day[per_day > 0]
    goal_md = ""
    if goal > 0 and not worked_days.empty:
        days_met = int((worked_days >= goal).sum())
        days_total = len(worked_days)
        pct = round(100 * days_met / days_total, 1)
        avg_worked = worked_days.mean()
        zeros = int((per_day == 0).sum())
        goal_md = f"""
### Objectif quotidien
- **Objectif** : {goal} visites/jour
- **Atteint** : {days_met} / {days_total} jours travaillés ({pct}%)
- **Moyenne** un jour travaillé : {avg_worked:.1f} visites
- **Jours sans aucune visite** dans la période : {zeros}
"""

    # Visits/day chart with goal line
    fig, ax = plt.subplots(figsize=(11, 3.5))
    ax.bar(per_day.index, per_day.values, color=PRIMARY, edgecolor="white")
    if goal > 0:
        ax.axhline(goal, color=DANGER, linestyle="--", linewidth=1.2, label=f"Objectif: {goal}")
        ax.legend(loc="upper right")
    ax.set_title(f"{name} — visites par jour")
    ax.set_ylabel("Visites")
    fig.autofmt_xdate()
    chart = save_chart("daily_visits")

    # Per-day type split chart (medecin vs pharmacien)
    type_by_day = (
        mine.groupby([mine["visit_date"].dt.date, "visit_type"])
        .size()
        .unstack(fill_value=0)
        .reindex(full_range.date, fill_value=0)
    )

    # Week aggregates
    mine["week"] = mine["visit_date"].dt.tz_convert(None).dt.to_period("W").apply(lambda r: r.start_time.date())
    week_counts = mine.groupby("week").size().reset_index(name="Visites")
    week_counts.columns = ["Semaine du", "Visites"]
    week_counts["Semaine du"] = week_counts["Semaine du"].astype(str)

    last_visit = mine["visit_date"].max()
    days_since = (now_utc() - last_visit).days

    headline = (
        f"**{int(rep['visits_total'])} visites** couvrant **{int(rep['doctors_covered'])} médecins/pharmaciens** distincts. "
        f"Dernière visite : {last_visit.strftime('%d %b %Y')} (il y a {days_since} j). "
        f"Plans de visite complétés : **{rep['completion_rate_pct']}%** "
        f"({int(rep['assignments_completed'])} sur {int(rep['assignments_total'])})."
    )

    return f"""## 2. Scorecard — {name}

{headline}

![Visites par jour]({chart})
{goal_md}
### Cadence hebdomadaire
{md_table(week_counts)}
"""


def section_doctor_coverage(d: dict[str, pd.DataFrame]) -> str:
    docs = d["doctors"].copy()
    v = d["visits"]

    now = now_utc()
    docs["days_since_last_visit"] = docs["last_visit_at"].apply(
        lambda t: days_between(now, t) if pd.notna(t) else None
    )

    # Top 20 most visited
    top20 = docs.sort_values("visits_total", ascending=False).head(20)[
        ["doctor_name", "doctor_type", "specialty", "wilaya", "visits_total", "last_visit_at"]
    ].rename(
        columns={
            "doctor_name": "Médecin/Pharmacien",
            "doctor_type": "Type",
            "specialty": "Spécialité",
            "wilaya": "Wilaya",
            "visits_total": "Visites",
            "last_visit_at": "Dernière",
        }
    )
    top20["Dernière"] = top20["Dernière"].dt.strftime("%d %b %Y")

    # Stale A-priority list
    stale_a = docs[
        (docs["potentiel"] == "A")
        & (docs["days_since_last_visit"].fillna(9999) > 30)
    ].sort_values("days_since_last_visit", ascending=False)[
        ["doctor_name", "specialty", "wilaya", "days_since_last_visit", "visits_total"]
    ].rename(
        columns={
            "doctor_name": "Médecin/Pharmacien",
            "specialty": "Spécialité",
            "wilaya": "Wilaya",
            "days_since_last_visit": "Jours sans visite",
            "visits_total": "Total visites",
        }
    )
    # Use pandas nullable Int64 to keep "never visited" rows as <NA>
    stale_a["Jours sans visite"] = (
        stale_a["Jours sans visite"].astype("Float64").astype("Int64")
    )

    # One-shot vs repeat
    one_shot = int((docs["visits_total"] == 1).sum())
    repeat = int((docs["visits_total"] > 1).sum())
    never = int((docs["visits_total"] == 0).sum())

    # Wilaya chart
    by_wilaya = (
        v.groupby("wilaya", dropna=True)
        .size()
        .reset_index(name="visits")
        .sort_values("visits", ascending=True)
    )
    fig, ax = plt.subplots(figsize=(7, max(2.5, 0.4 * len(by_wilaya))))
    ax.barh(by_wilaya["wilaya"], by_wilaya["visits"], color=PRIMARY)
    ax.set_xlabel("Nombre de visites")
    ax.set_title("Visites par wilaya")
    wilaya_chart = save_chart("visits_per_wilaya")

    stale_md = (
        "_Aucun médecin A-prioritaire à relancer._"
        if stale_a.empty
        else md_table(stale_a, max_rows=20)
    )
    return f"""## 3. Couverture médecins

**Répartition :** {repeat} médecins visités plusieurs fois, {one_shot} visités une seule fois, {never} jamais visités.

### 🎯 Liste de relance — médecins de potentiel A non visités depuis 30+ jours
{stale_md}

### Top 20 des plus visités
{md_table(top20)}

### Visites par wilaya
![Visites par wilaya]({wilaya_chart})
"""


def section_conversion_funnel(d: dict[str, pd.DataFrame]) -> str:
    v = d["visits"]
    med = v[v["visit_type"] == "medecin"].copy()
    if med.empty:
        return "## 4. Tunnel de conversion\n\n_Aucune visite médecin._\n"

    # For each doctor: did they go from "promised" → "already_prescribed"?
    by_doctor = med.sort_values("visit_date").groupby("doctor_id")
    converted, still_promised, refused, no_progress = 0, 0, 0, 0
    convert_days = []  # days between first "promised" and first "prescribed"

    for doc_id, group in by_doctor:
        if len(group) < 2:
            continue
        promised_dates = group[group["promised_to_suggest"] == True]["visit_date"]  # noqa: E712
        prescribed_dates = group[group["already_prescribed"] == True]["visit_date"]  # noqa: E712
        if not promised_dates.empty and not prescribed_dates.empty:
            converted += 1
            first_promise = promised_dates.min()
            first_prescribe = prescribed_dates[prescribed_dates >= first_promise]
            if not first_prescribe.empty:
                convert_days.append((first_prescribe.min() - first_promise).days)
        elif not promised_dates.empty:
            still_promised += 1
        elif (group["price_reasonable"] == False).any():  # noqa: E712
            refused += 1
        else:
            no_progress += 1

    total_multi = converted + still_promised + refused + no_progress
    avg_days = f"{sum(convert_days) / len(convert_days):.0f}" if convert_days else "—"

    return f"""## 4. Tunnel de conversion (médecins visités plusieurs fois)

| État | Médecins | % |
|---|---:|---:|
| ✅ Promis puis prescrit | {converted} | {round(100 * converted / total_multi, 1) if total_multi else 0}% |
| ⏳ Promis, pas encore prescrit | {still_promised} | {round(100 * still_promised / total_multi, 1) if total_multi else 0}% |
| 🚫 Prix jugé non raisonnable | {refused} | {round(100 * refused / total_multi, 1) if total_multi else 0}% |
| 💤 Aucune progression mesurable | {no_progress} | {round(100 * no_progress / total_multi, 1) if total_multi else 0}% |

**Délai moyen "promis → prescrit" :** {avg_days} jours
"""


def section_pharma(d: dict[str, pd.DataFrame]) -> str:
    v = d["visits"]
    comments = d["comments"]
    pharm = v[v["visit_type"] == "pharmacien"].copy()
    if pharm.empty:
        return "## 5. Stock & commandes (pharmaciens)\n\n_Aucune visite pharmacien._\n"

    # Order acceptance breakdown
    total_pharm = len(pharm)
    accepted_mask = pharm["accepted_order"] == True   # noqa: E712
    refused_mask = pharm["accepted_order"] == False    # noqa: E712
    unset_count = int(pharm["accepted_order"].isna().sum())
    accepted_n = int(accepted_mask.sum())
    refused_n = int(refused_mask.sum())
    answered_n = accepted_n + refused_n
    acceptance_rate = (
        f"{round(100 * accepted_n / answered_n, 1)}%" if answered_n else "—"
    )

    # ── Surface compte_rendu for each accepted / refused order ──────────
    # The supervisor wants to see *why*. Pull comments too as additional
    # context (a delegue might explain in a comment rather than the report).

    def trim(text: str, n: int = 220) -> str:
        if not text or pd.isna(text):
            return ""
        text = str(text).strip().replace("\n", " ")
        return text if len(text) <= n else text[:n] + "…"

    def comments_for(visit_id: str) -> str:
        rel = comments[comments["visit_id"] == visit_id]
        if rel.empty:
            return ""
        snippets = [
            f"  ↳ _{r['comment_author']}_ : « {trim(r['content'], 140)} »"
            for _, r in rel.iterrows()
            if pd.notna(r["content"]) and str(r["content"]).strip()
        ]
        return ("\n" + "\n".join(snippets)) if snippets else ""

    def order_block(rows: pd.DataFrame, header: str) -> str:
        if rows.empty:
            return f"### {header}\n_(aucune visite)_\n"
        lines = [f"### {header}"]
        for _, r in rows.sort_values("visit_date", ascending=False).iterrows():
            doc = r["doctor_name"]
            date = r["visit_date"].strftime("%d %b %Y")
            wilaya = r["wilaya"] or ""
            rendu = trim(r["compte_rendu"])
            stock = (
                f" · stock: {int(r['synapgen_count'])}"
                if pd.notna(r["synapgen_count"])
                else ""
            )
            rendu_md = f"\n  > {rendu}" if rendu else "\n  > _(compte rendu vide)_"
            lines.append(
                f"- **{doc}** — {wilaya}, {date}{stock}{rendu_md}{comments_for(r['visit_id'])}"
            )
        return "\n".join(lines) + "\n"

    accepted_md = order_block(pharm[accepted_mask], "✅ Commandes acceptées")
    refused_md = order_block(pharm[refused_mask], "🚫 Commandes refusées")

    # Latest stock snapshot
    latest_stock = (
        pharm.dropna(subset=["synapgen_count"])
        .sort_values("visit_date")
        .groupby("doctor_id")
        .tail(1)
    )
    zero_stock = latest_stock[latest_stock["synapgen_count"] == 0]
    low_stock = latest_stock[
        (latest_stock["synapgen_count"] > 0) & (latest_stock["synapgen_count"] < 5)
    ]
    zero_md = (
        "_Aucune pharmacie en rupture._"
        if zero_stock.empty
        else "\n".join(
            f"- {r['doctor_name']} — {r['wilaya']}" for _, r in zero_stock.iterrows()
        )
    )
    low_md = (
        "_Aucune pharmacie en stock faible._"
        if low_stock.empty
        else "\n".join(
            f"- {r['doctor_name']} — {r['wilaya']} — stock: {int(r['synapgen_count'])}"
            for _, r in low_stock.iterrows()
        )
    )

    # Top prescribers
    top_rx = (
        pharm.dropna(subset=["prescriptions_received"])
        .groupby("doctor_name")["prescriptions_received"]
        .sum()
        .sort_values(ascending=False)
        .head(10)
        .reset_index()
        .rename(
            columns={
                "doctor_name": "Pharmacie",
                "prescriptions_received": "Prescriptions reçues (cumul)",
            }
        )
    )

    unset_warning = (
        f"\n> ⚠️  **Champ « commande acceptée » non renseigné pour {unset_count} visites pharmacien sur {total_pharm}.** "
        "Le taux d'acceptation ci-dessus est calculé uniquement sur les visites où le délégué a rempli ce champ.\n"
        if unset_count > 0
        else ""
    )

    return f"""## 5. Stock & commandes (pharmaciens)

| Métrique | Valeur |
|---|---:|
| Visites pharmacien | {total_pharm} |
| Champ « commande » renseigné | {answered_n} ({round(100 * answered_n / total_pharm, 1) if total_pharm else 0}%) |
| Commandes acceptées | {accepted_n} |
| Commandes refusées | {refused_n} |
| **Taux d'acceptation** (sur visites renseignées) | **{acceptance_rate}** |
{unset_warning}
{accepted_md}
{refused_md}
### 🚨 Pharmacies en rupture (synapgen_count = 0 à la dernière visite)
{zero_md}

### ⚠️ Stock faible (< 5)
{low_md}

### Top 10 des pharmacies par prescriptions cumulées
{md_table(top_rx)}
"""


def section_time_cadence(d: dict[str, pd.DataFrame]) -> str:
    v = d["visits"].copy()
    if v.empty:
        return "## 6. Cadence horaire\n\n_Pas de données._\n"

    # Day-of-week × hour heatmap
    v["dow"] = v["visit_date"].dt.dayofweek  # 0=Mon
    v["hour"] = v["visit_date"].dt.hour
    pivot = v.pivot_table(
        index="dow", columns="hour", values="visit_id", aggfunc="count", fill_value=0
    )
    # Ensure full 0-23 hours present
    for h in range(24):
        if h not in pivot.columns:
            pivot[h] = 0
    pivot = pivot[sorted(pivot.columns)]

    fig, ax = plt.subplots(figsize=(10, 3.5))
    im = ax.imshow(pivot.values, aspect="auto", cmap="Blues")
    ax.set_yticks(range(7))
    ax.set_yticklabels(["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"])
    ax.set_xticks(range(0, 24, 2))
    ax.set_xticklabels([f"{h}h" for h in range(0, 24, 2)])
    ax.set_title("Visites par jour de la semaine × heure")
    plt.colorbar(im, ax=ax, label="Visites")
    chart = save_chart("heatmap_dow_hour")

    # Off-hours flag
    off_hours = v[(v["hour"] < 8) | (v["hour"] >= 19)]
    off_md = ""
    if not off_hours.empty:
        off_md = (
            f"\n**⚠️ {len(off_hours)} visite(s) hors heures de bureau (avant 8h ou après 19h)** "
            "— vérifier si c'est intentionnel ou une erreur de saisie."
        )

    return f"""## 6. Cadence horaire

![Visites jour × heure]({chart})
{off_md}
"""


def section_comments(d: dict[str, pd.DataFrame]) -> str:
    c = d["comments"]
    if c.empty:
        return "## 7. Commentaires\n\n_Aucun commentaire._\n"

    keywords = ["prix", "refuse", "intéress", "rupture", "commande", "promis"]
    pattern = "|".join(keywords)
    c = c.copy()
    c["content"] = c["content"].fillna("")
    mentions = c[c["content"].str.contains(pattern, case=False, regex=True, na=False)]

    by_kw = {kw: int(c["content"].str.contains(kw, case=False, na=False).sum()) for kw in keywords}

    top_discussed = (
        c.groupby("doctor_name").size().reset_index(name="comments").sort_values("comments", ascending=False).head(10)
    ).rename(columns={"doctor_name": "Médecin/Pharmacien", "comments": "Commentaires"})

    mentions_md = (
        "_Aucun commentaire contenant ces mots-clés._"
        if mentions.empty
        else "\n".join(
            f"- _{r['doctor_name']}_ — {r['comment_author']} ({r['created_at'].strftime('%d %b')}): "
            f"« {r['content'][:140]}{'…' if len(r['content']) > 140 else ''} »"
            for _, r in mentions.head(10).iterrows()
        )
    )

    kw_lines = "\n".join(f"- **{kw}** : {count}" for kw, count in by_kw.items())

    return f"""## 7. Commentaires

**{len(c)} commentaires au total.** Occurrences par mot-clé :
{kw_lines}

### Top 10 médecins/pharmaciens les plus commentés
{md_table(top_discussed)}

### Commentaires contenant des mots-clés (10 plus récents)
{mentions_md}
"""


def section_planning(d: dict[str, pd.DataFrame]) -> str:
    a = d["assignments"]
    if a.empty:
        return "## 8. Planification\n\n_Aucune planification._\n"

    total = len(a)
    completed = int((a["status"] == "completed").sum())
    pending = int((a["status"] == "pending").sum())
    overdue_now = int(a["is_currently_overdue"].sum())

    on_time = int(((a["status"] == "completed") & (a["days_early_or_late"] >= 0)).sum())
    late = int(((a["status"] == "completed") & (a["days_early_or_late"] < 0)).sum())

    completed_only = a[a["status"] == "completed"]
    avg_lead = (
        f"{((completed_only['deadline'] - completed_only['assigned_at']).dt.days.mean()):.1f}"
        if not completed_only.empty
        else "—"
    )

    # Histogram of days_to_complete
    dtc = a.dropna(subset=["days_to_complete"])["days_to_complete"]
    chart_md = ""
    if not dtc.empty:
        fig, ax = plt.subplots(figsize=(7, 3))
        ax.hist(dtc, bins=15, color=PRIMARY, edgecolor="white")
        ax.set_xlabel("Jours pour compléter une planification")
        ax.set_ylabel("Nombre")
        ax.set_title("Distribution du temps de complétion")
        chart = save_chart("days_to_complete")
        chart_md = f"\n![Days to complete]({chart})\n"

    # Overdue list
    overdue_list = a[a["is_currently_overdue"]].sort_values("deadline")[
        ["doctor_name", "assignee_name", "deadline", "note"]
    ].rename(
        columns={
            "doctor_name": "Médecin/Pharmacien",
            "assignee_name": "Délégué",
            "deadline": "Échéance",
            "note": "Note",
        }
    )
    if not overdue_list.empty:
        overdue_list["Échéance"] = overdue_list["Échéance"].dt.strftime("%d %b %Y")

    return f"""## 8. Planification

| Métrique | Valeur |
|---|---:|
| Total planifications | {total} |
| Complétées | {completed} ({round(100 * completed / total, 1) if total else 0}%) |
| ↳ à temps ou en avance | {on_time} |
| ↳ en retard | {late} |
| En attente | {pending} |
| **Actuellement en retard** | **{overdue_now}** |
| Délai moyen accordé (création → échéance) | {avg_lead} jours |
{chart_md}
### En retard — à traiter en priorité
{md_table(overdue_list) if not overdue_list.empty else "_Aucune planification en retard. 🎉_"}
"""


# ─── Report assembly ───────────────────────────────────────────────────
def write_report(sections: list[str]) -> None:
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now(timezone.utc).strftime("%d %B %Y — %Hh%M UTC")
    header = (
        f"# Analyse Handson Délégué Médical\n\n"
        f"_Généré le {generated_at}_\n\n"
        "Rapport automatique à partir des exports CSV Supabase. "
        "Re-générer avec `python3 analysis/analyze.py` après chaque nouvel export.\n\n"
        "---\n"
    )
    REPORT.write_text(header + "\n\n---\n\n".join(sections))
    print(f"✓ Report → {REPORT}")
    print(f"✓ Charts → {CHARTS}/")


def main() -> None:
    d = load_csvs()
    print(
        f"Loaded: visits={len(d['visits'])}, doctors={len(d['doctors'])}, "
        f"delegues={len(d['delegues'])}, answers={len(d['answers'])}, "
        f"comments={len(d['comments'])}, assignments={len(d['assignments'])}"
    )
    sections = [
        section_overview(d),
        section_delegue_scorecard(d),
        section_doctor_coverage(d),
        section_conversion_funnel(d),
        section_pharma(d),
        section_time_cadence(d),
        section_comments(d),
        section_planning(d),
    ]
    write_report(sections)


if __name__ == "__main__":
    main()
