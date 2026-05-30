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
    doctors = d["doctors"]

    total_visits = len(v)
    total_doctors = len(doctors)
    total_delegues = len(deleg)
    active_delegues = int((deleg["visits_total"] > 0).sum())

    now = now_utc()
    last_7d = int((v["visit_date"] >= now - pd.Timedelta(days=7)).sum())
    last_30d = int((v["visit_date"] >= now - pd.Timedelta(days=30)).sum())
    last_90d = int((v["visit_date"] >= now - pd.Timedelta(days=90)).sum())

    # Avg visits/day for the active delegue(s) over the period they've been
    # active (first → last visit)
    active = deleg[deleg["visits_total"] > 0]
    avg_per_active_per_day = None
    if not active.empty:
        spans = []
        for _, row in active.iterrows():
            mine = v[v["delegue_id"] == row["delegue_id"]]
            if len(mine) > 1:
                span_days = max(
                    1,
                    (mine["visit_date"].max() - mine["visit_date"].min()).days,
                )
                spans.append(len(mine) / span_days)
        if spans:
            avg_per_active_per_day = sum(spans) / len(spans)

    return f"""## 1. Vue d'ensemble

| Métrique | Valeur |
|---|---:|
| Visites totales | **{total_visits}** |
| Médecins / pharmaciens dans le répertoire | **{total_doctors}** |
| Délégués inscrits | **{total_delegues}** |
| Délégués actifs (≥1 visite) | **{active_delegues}** / {total_delegues} |
| Visites — 7 derniers jours | {last_7d} |
| Visites — 30 derniers jours | {last_30d} |
| Visites — 90 derniers jours | {last_90d} |
| Moyenne visites/jour (délégué actif) | {f"{avg_per_active_per_day:.1f}" if avg_per_active_per_day else "—"} |
"""


def section_delegue_scorecard(d: dict[str, pd.DataFrame]) -> str:
    deleg = d["delegues"].copy()
    v = d["visits"]

    # Add days_since_last_visit
    now = now_utc()
    deleg["days_since_last_visit"] = deleg["last_visit_at"].apply(
        lambda t: days_between(now, t) if pd.notna(t) else None
    )

    # Goal-hit-rate: % of (delegue, day) pairs where visits>=goal, only counting
    # délégués with a goal set
    goal_hit_lines = []
    for _, dlg in deleg[deleg["daily_visit_goal"] > 0].iterrows():
        mine = v[v["delegue_id"] == dlg["delegue_id"]]
        if mine.empty:
            continue
        per_day = (
            mine.groupby(mine["visit_date"].dt.date).size().reset_index(name="count")
        )
        per_day["goal_met"] = per_day["count"] >= dlg["daily_visit_goal"]
        days_total = len(per_day)
        days_met = int(per_day["goal_met"].sum())
        pct = round(100 * days_met / days_total, 1) if days_total else 0
        goal_hit_lines.append(
            f"- **{dlg['delegue_name']}** — objectif {int(dlg['daily_visit_goal'])}/jour : "
            f"atteint {days_met}/{days_total} jours travaillés ({pct}%)"
        )

    # Inactive flags
    inactive = deleg[
        (deleg["visits_total"] == 0)
        | (deleg["days_since_last_visit"].fillna(999) >= 14)
    ]

    # Table
    cols = [
        "delegue_name",
        "visits_total",
        "visits_last_30d",
        "doctors_covered",
        "daily_visit_goal",
        "completion_rate_pct",
        "days_since_last_visit",
    ]
    deleg_view = deleg[cols].rename(
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

    # Chart: visits per delegue
    if not deleg[deleg["visits_total"] > 0].empty:
        fig, ax = plt.subplots(figsize=(7, max(2.5, 0.5 * len(deleg))))
        plot_data = deleg.sort_values("visits_total", ascending=True)
        colors = [
            GREEN if x >= 200 else PRIMARY if x > 0 else "#cbd5e1"
            for x in plot_data["visits_total"]
        ]
        ax.barh(plot_data["delegue_name"], plot_data["visits_total"], color=colors)
        ax.set_xlabel("Nombre de visites")
        ax.set_title("Visites par délégué (cumul)")
        chart_path = save_chart("visits_per_delegue")
    else:
        chart_path = None

    inactive_md = ""
    if not inactive.empty:
        inactive_md = "\n### ⚠️ Délégués inactifs\n" + "\n".join(
            f"- **{r['delegue_name']}** — "
            + (
                "aucune visite"
                if r["visits_total"] == 0
                else f"dernière visite il y a {int(r['days_since_last_visit'])} jours"
            )
            for _, r in inactive.iterrows()
        )

    return f"""## 2. Scorecard des délégués

{md_table(deleg_view)}

{f'![Visites par délégué]({chart_path})' if chart_path else ''}

### Atteinte de l'objectif quotidien
{chr(10).join(goal_hit_lines) if goal_hit_lines else "_Aucun délégué avec objectif défini._"}
{inactive_md}
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
    pharm = v[v["visit_type"] == "pharmacien"].copy()
    if pharm.empty:
        return "## 5. Stock & commandes (pharmaciens)\n\n_Aucune visite pharmacien._\n"

    # Order acceptance
    total_pharm = len(pharm)
    accepted = int((pharm["accepted_order"] == True).sum())  # noqa: E712
    refused = int((pharm["accepted_order"] == False).sum())  # noqa: E712
    pct = round(100 * accepted / total_pharm, 1) if total_pharm else 0

    # Latest synapgen_count per pharmacy
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

    # Top pharmacies by prescriptions_received
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

    zero_md = (
        "_Aucune pharmacie en rupture sur la dernière visite._"
        if zero_stock.empty
        else "\n".join(f"- {r['doctor_name']} — {r['wilaya']}" for _, r in zero_stock.iterrows())
    )
    low_md = (
        "_Aucune pharmacie en stock faible._"
        if low_stock.empty
        else "\n".join(
            f"- {r['doctor_name']} — {r['wilaya']} — stock: {int(r['synapgen_count'])}"
            for _, r in low_stock.iterrows()
        )
    )

    return f"""## 5. Stock & commandes (pharmaciens)

| Métrique | Valeur |
|---|---:|
| Visites pharmacien | {total_pharm} |
| Commandes acceptées | {accepted} ({pct}%) |
| Commandes refusées | {refused} |

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
