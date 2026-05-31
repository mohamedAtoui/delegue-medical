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

    # Visits/day chart — color-coded: green if goal met, amber if worked but missed, gray if zero
    fig, ax = plt.subplots(figsize=(11, 3.8))
    colors = [
        "#e5e7eb" if c == 0
        else GREEN if (goal > 0 and c >= goal)
        else ACCENT
        for c in per_day.values
    ]
    bars = ax.bar(per_day.index, per_day.values, color=colors, edgecolor="white", linewidth=0.5)
    if goal > 0:
        ax.axhline(goal, color=DANGER, linestyle="--", linewidth=1.5)
        ax.text(
            per_day.index[-1], goal + 0.5,
            f"Objectif quotidien: {goal}",
            ha="right", va="bottom", fontsize=9, color=DANGER, fontweight="bold",
        )
    # Annotate the bars where goal was met
    if goal > 0:
        for bar, val in zip(bars, per_day.values):
            if val >= goal:
                ax.text(bar.get_x() + bar.get_width() / 2, val + 0.3,
                        str(int(val)), ha="center", va="bottom", fontsize=8, color=GREEN, fontweight="bold")
    ax.set_title(f"{name} — visites par jour (vert = objectif atteint, orange = travaillé sous objectif, gris = sans visite)", fontsize=10)
    ax.set_ylabel("Visites")
    ax.set_ylim(0, max(per_day.max() + 2, goal + 3 if goal else 5))
    fig.autofmt_xdate()
    chart = save_chart("daily_visits")

    # Weekly trend with trendline
    mine["week"] = mine["visit_date"].dt.tz_convert(None).dt.to_period("W").apply(lambda r: r.start_time.date())
    week_counts = mine.groupby("week").size().reset_index(name="Visites")
    week_counts.columns = ["Semaine du", "Visites"]

    weekly_chart = ""
    if len(week_counts) >= 3:
        fig, ax = plt.subplots(figsize=(9, 3.5))
        x_pos = range(len(week_counts))
        ax.bar(x_pos, week_counts["Visites"], color=PRIMARY, alpha=0.85)
        # Linear trendline
        import numpy as np
        z = np.polyfit(x_pos, week_counts["Visites"], 1)
        trend = np.poly1d(z)
        ax.plot(x_pos, trend(x_pos), color=DANGER, linewidth=2, label=f"Tendance: {z[0]:+.1f} visites/semaine")
        ax.set_xticks(x_pos)
        ax.set_xticklabels([str(w) for w in week_counts["Semaine du"]], rotation=30, ha="right")
        ax.set_ylabel("Visites/semaine")
        direction = "en baisse" if z[0] < -1 else "en hausse" if z[0] > 1 else "stable"
        ax.set_title(f"Cadence hebdomadaire — tendance {direction}", fontsize=10)
        ax.legend(loc="upper right", fontsize=9)
        # Annotate each bar with its value
        for i, v in enumerate(week_counts["Visites"]):
            ax.text(i, v + 1, str(v), ha="center", va="bottom", fontsize=9, fontweight="bold")
        weekly_chart = save_chart("weekly_trend")

    week_counts["Semaine du"] = week_counts["Semaine du"].astype(str)

    last_visit = mine["visit_date"].max()
    days_since = (now_utc() - last_visit).days

    headline = (
        f"**{int(rep['visits_total'])} visites** couvrant **{int(rep['doctors_covered'])} médecins/pharmaciens** distincts. "
        f"Dernière visite : {last_visit.strftime('%d %b %Y')} (il y a {days_since} j). "
        f"Plans de visite complétés : **{rep['completion_rate_pct']}%** "
        f"({int(rep['assignments_completed'])} sur {int(rep['assignments_total'])})."
    )

    weekly_md = f"\n![Tendance hebdomadaire]({weekly_chart})\n" if weekly_chart else ""

    return f"""## 2. Scorecard — {name}

{headline}

![Visites par jour]({chart})
{goal_md}
### Cadence hebdomadaire
{md_table(week_counts)}
{weekly_md}"""


def section_synthese(d: dict[str, pd.DataFrame]) -> str:
    """Executive summary — 5-6 bullet findings at the very top of the report."""
    v = d["visits"]
    docs = d["doctors"]
    deleg = d["delegues"]
    if v.empty:
        return "## 0. Synthèse exécutive\n\n_Pas de données._\n"

    findings: list[str] = []

    # Activity headline
    days_span = max(1, (v["visit_date"].max() - v["visit_date"].min()).days)
    avg_per_day = len(v) / days_span
    rep_count = len(deleg)
    findings.append(
        f"**Activité.** {rep_count} délégué(s) actif(s) — **{len(v)} visites sur {days_span} jours** "
        f"({avg_per_day:.1f}/j en moyenne)."
    )

    # Goal hit rate
    if not deleg.empty:
        rep = deleg.iloc[0]
        goal = int(rep["daily_visit_goal"] or 0)
        if goal > 0:
            mine = v[v["delegue_id"] == rep["delegue_id"]]
            per_day = mine.groupby(mine["visit_date"].dt.date).size()
            worked = per_day[per_day > 0]
            if not worked.empty:
                hit_pct = round(100 * (worked >= goal).sum() / len(worked), 1)
                findings.append(
                    f"**Objectif quotidien.** Atteint **{hit_pct}%** des jours travaillés "
                    f"(objectif: {goal}/j, moyenne réelle: {worked.mean():.1f}/j)."
                )

    # Coverage by potentiel A — the priority list
    now = now_utc()
    docs_with_days = docs.copy()
    docs_with_days["days_since"] = docs_with_days["last_visit_at"].apply(
        lambda t: days_between(now, t) if pd.notna(t) else None
    )
    a_total = int((docs_with_days["potentiel"] == "A").sum())
    a_stale = int(((docs_with_days["potentiel"] == "A") & (docs_with_days["days_since"].fillna(9999) > 30)).sum())
    if a_total > 0:
        findings.append(
            f"**Médecins prioritaires (A).** {a_total} dans le répertoire, "
            f"**{a_stale} non visités depuis +30j** — voir liste de relance section Médecins."
        )

    # Top specialty + coverage
    med = v[v["visit_type"] == "medecin"]
    if not med.empty:
        spec_counts = med.dropna(subset=["specialty"]).groupby("specialty").size()
        if not spec_counts.empty:
            top_spec = spec_counts.idxmax()
            top_spec_n = int(spec_counts.max())
            findings.append(
                f"**Spécialités.** La plus visitée: **{top_spec}** ({top_spec_n} visites, "
                f"{round(100 * top_spec_n / len(med), 1)}% du total médecins)."
            )

    # Pharma order acceptance
    pharm = v[v["visit_type"] == "pharmacien"]
    if not pharm.empty:
        answered = pharm.dropna(subset=["accepted_order"])
        if not answered.empty:
            acc = int((answered["accepted_order"] == True).sum())  # noqa: E712
            ref = int((answered["accepted_order"] == False).sum())  # noqa: E712
            findings.append(
                f"**Pharmaciens.** {len(pharm)} visites — sur {len(answered)} où le champ commande a été rempli: "
                f"**{acc} acceptées, {ref} refusées**. {len(pharm) - len(answered)} visites avec champ vide."
            )

    return "## 0. Synthèse exécutive\n\n" + "\n".join(f"- {f}" for f in findings) + "\n"



def section_medecins(d: dict[str, pd.DataFrame]) -> str:
    """Comprehensive médecins section — specialty stats, coverage, conversion."""
    v = d["visits"]
    docs = d["doctors"]
    med = v[v["visit_type"] == "medecin"].copy()
    med_docs = docs[docs["doctor_type"] == "medecin"].copy()

    if med.empty:
        return "## 3. Médecins\n\n_Aucune visite médecin._\n"

    now = now_utc()
    med_docs["days_since"] = med_docs["last_visit_at"].apply(
        lambda t: days_between(now, t) if pd.notna(t) else None
    )

    # ── Headline metrics ──────────────────────────────────────────────
    total_med_visits = len(med)
    total_med_docs = len(med_docs)
    visited_docs = int((med_docs["visits_total"] > 0).sum())
    visit_rate = round(100 * visited_docs / total_med_docs, 1) if total_med_docs else 0
    avg_visits = round(med_docs["visits_total"].mean(), 1)

    # ── Specialty breakdown ───────────────────────────────────────────
    spec = (
        med.dropna(subset=["specialty"])
        .groupby("specialty")
        .agg(
            visites=("visit_id", "count"),
            doctors_distinct=("doctor_id", "nunique"),
            promised=("promised_to_suggest", lambda x: int((x == True).sum())),  # noqa: E712
            prescribed=("already_prescribed", lambda x: int((x == True).sum())),  # noqa: E712
            price_ok=("price_reasonable", lambda x: int((x == True).sum())),  # noqa: E712
            free_sample=("free_sample", lambda x: int((x == True).sum())),  # noqa: E712
        )
        .sort_values("visites", ascending=False)
        .reset_index()
    )
    spec["conversion_%"] = spec.apply(
        lambda r: round(100 * r["prescribed"] / r["visites"], 1) if r["visites"] else 0,
        axis=1,
    )
    spec_table = spec.rename(
        columns={
            "specialty": "Spécialité",
            "visites": "Visites",
            "doctors_distinct": "Médecins distincts",
            "promised": "Promis suggérer",
            "prescribed": "Déjà prescrit",
            "price_ok": "Prix accepté",
            "free_sample": "Échantillons",
            "conversion_%": "% prescrit",
        }
    )

    # Chart: top specialties by visits, with prescription rate as a second metric
    spec_chart = ""
    if not spec.empty:
        top = spec.head(10).iloc[::-1]  # reverse for horizontal bar (largest on top)
        fig, ax = plt.subplots(figsize=(10, max(3.5, 0.45 * len(top))))
        y_pos = range(len(top))
        ax.barh(y_pos, top["visites"], color=PRIMARY, label="Visites")
        ax.barh(y_pos, top["prescribed"], color=GREEN, label="… ayant déjà prescrit")
        ax.set_yticks(list(y_pos))
        ax.set_yticklabels(top["specialty"])
        ax.set_xlabel("Nombre de visites")
        ax.set_title("Spécialités par volume — vert = conversion (déjà prescrit)", fontsize=10)
        ax.legend(loc="lower right")
        # Annotate the conversion rate
        for i, (v_count, p_count) in enumerate(zip(top["visites"], top["prescribed"])):
            pct = round(100 * p_count / v_count, 0) if v_count else 0
            ax.text(v_count + 0.5, i, f" {int(pct)}%", va="center", fontsize=9, color="#475569")
        spec_chart = save_chart("specialties_funnel")

    # ── Coverage by potentiel ─────────────────────────────────────────
    pot_table = ""
    pot_chart = ""
    pot = med_docs[med_docs["potentiel"].isin(["A", "B", "C"])]
    if not pot.empty:
        summary = pot.groupby("potentiel").apply(
            lambda g: pd.Series({
                "total": len(g),
                "visited_30d": int((g["days_since"].fillna(9999) <= 30).sum()),
                "stale": int(((g["days_since"].fillna(9999) > 30) & (g["visits_total"] > 0)).sum()),
                "never": int((g["visits_total"] == 0).sum()),
            }),
            include_groups=False,
        ).reindex(["A", "B", "C"]).fillna(0)

        fig, ax = plt.subplots(figsize=(8, 3.5))
        x = range(len(summary))
        visited = summary["visited_30d"].values
        stale = summary["stale"].values
        never = summary["never"].values
        ax.bar(x, visited, color=GREEN, label="Visité ≤ 30j")
        ax.bar(x, stale, bottom=visited, color=ACCENT, label="À relancer (+30j)")
        ax.bar(x, never, bottom=visited + stale, color="#cbd5e1", label="Jamais visité")
        ax.set_xticks(list(x))
        ax.set_xticklabels([f"Potentiel {p}\n({int(summary.loc[p, 'total'])} médecins)" for p in summary.index])
        ax.set_ylabel("Nombre de médecins")
        ax.set_title("Couverture par potentiel — la zone orange est la priorité de relance", fontsize=10)
        ax.legend(loc="upper right", fontsize=8)
        for i, p in enumerate(summary.index):
            ax.text(i, summary.loc[p, "total"] + 1,
                    f"{int(summary.loc[p, 'total'])}", ha="center", va="bottom", fontweight="bold")
        pot_chart = save_chart("medecin_coverage_potentiel")
        pot_table = md_table(summary.reset_index().rename(columns={
            "potentiel": "Potentiel",
            "total": "Total",
            "visited_30d": "Visité (30j)",
            "stale": "À relancer (+30j)",
            "never": "Jamais visité",
        }))

    # ── Stale A-priority list (action items) ──────────────────────────
    stale_a = med_docs[
        (med_docs["potentiel"] == "A")
        & (med_docs["days_since"].fillna(9999) > 30)
    ].sort_values("days_since", ascending=False)[
        ["doctor_name", "specialty", "wilaya", "days_since", "visits_total"]
    ].rename(
        columns={
            "doctor_name": "Médecin",
            "specialty": "Spécialité",
            "wilaya": "Wilaya",
            "days_since": "Jours sans visite",
            "visits_total": "Total visites",
        }
    )
    stale_a["Jours sans visite"] = (
        stale_a["Jours sans visite"].astype("Float64").astype("Int64")
    )

    # ── Conversion narrative ──────────────────────────────────────────
    # For each doctor visited >1x, did they go from "promised" → "already_prescribed"?
    converted, still_promised, refused, no_progress = 0, 0, 0, 0
    convert_days = []
    for doc_id, group in med.sort_values("visit_date").groupby("doctor_id"):
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

    # ── Top 20 most visited médecins ──────────────────────────────────
    top20 = med_docs.sort_values("visits_total", ascending=False).head(20)[
        ["doctor_name", "specialty", "wilaya", "potentiel", "visits_total", "last_visit_at"]
    ].rename(
        columns={
            "doctor_name": "Médecin",
            "specialty": "Spécialité",
            "wilaya": "Wilaya",
            "potentiel": "Pot.",
            "visits_total": "Visites",
            "last_visit_at": "Dernière",
        }
    )
    top20["Dernière"] = top20["Dernière"].dt.strftime("%d %b %Y")

    stale_md = (
        "_Aucun médecin A-prioritaire à relancer._"
        if stale_a.empty
        else md_table(stale_a, max_rows=20)
    )
    spec_chart_md = f"\n![Spécialités]({spec_chart})\n" if spec_chart else ""
    pot_chart_md = f"\n![Couverture par potentiel]({pot_chart})\n" if pot_chart else ""

    return f"""## 3. Médecins

**{total_med_visits} visites** auprès de **{visited_docs} médecins distincts** sur {total_med_docs} du répertoire ({visit_rate}% de couverture). Moyenne: {avg_visits} visite(s) par médecin.

### 3.1 Par spécialité
{md_table(spec_table)}
{spec_chart_md}

### 3.2 Couverture par niveau de potentiel
{pot_table}
{pot_chart_md}

### 3.3 Tunnel de conversion (médecins visités plusieurs fois)

Sur **{total_multi}** médecins visités au moins 2 fois:

| État | Médecins | % |
|---|---:|---:|
| Promis puis prescrit (conversion réussie) | {converted} | {round(100 * converted / total_multi, 1) if total_multi else 0}% |
| Promis mais pas encore prescrit | {still_promised} | {round(100 * still_promised / total_multi, 1) if total_multi else 0}% |
| Prix jugé non raisonnable | {refused} | {round(100 * refused / total_multi, 1) if total_multi else 0}% |
| Aucune progression mesurable | {no_progress} | {round(100 * no_progress / total_multi, 1) if total_multi else 0}% |

**Délai moyen "promis → prescrit" :** {avg_days} jours

### 3.4 Liste de relance — médecins de potentiel A non visités depuis +30j
{stale_md}

### 3.5 Top 20 des médecins les plus visités
{md_table(top20)}
"""


def section_pharmaciens(d: dict[str, pd.DataFrame]) -> str:
    """Comprehensive pharmaciens section — stock, orders with reasons, prescribers."""
    v = d["visits"]
    docs = d["doctors"]
    comments = d["comments"]
    pharm = v[v["visit_type"] == "pharmacien"].copy()
    pharm_docs = docs[docs["doctor_type"] == "pharmacien"].copy()

    if pharm.empty:
        return "## 4. Pharmaciens\n\n_Aucune visite pharmacien._\n"

    now = now_utc()
    pharm_docs["days_since"] = pharm_docs["last_visit_at"].apply(
        lambda t: days_between(now, t) if pd.notna(t) else None
    )

    # Headline metrics
    total_visits = len(pharm)
    total_pharms = len(pharm_docs)
    visited = int((pharm_docs["visits_total"] > 0).sum())
    visit_rate = round(100 * visited / total_pharms, 1) if total_pharms else 0

    # ── Order acceptance with reasons ─────────────────────────────────
    accepted_mask = pharm["accepted_order"] == True   # noqa: E712
    refused_mask = pharm["accepted_order"] == False    # noqa: E712
    unset_count = int(pharm["accepted_order"].isna().sum())
    accepted_n = int(accepted_mask.sum())
    refused_n = int(refused_mask.sum())
    answered_n = accepted_n + refused_n
    acceptance_rate = (
        f"{round(100 * accepted_n / answered_n, 1)}%" if answered_n else "—"
    )

    def trim(text, n: int = 220) -> str:
        if not text or pd.isna(text):
            return ""
        text = str(text).strip().replace("\n", " ")
        return text if len(text) <= n else text[:n] + "…"

    def comments_for(visit_id: str) -> str:
        rel = comments[comments["visit_id"] == visit_id]
        if rel.empty:
            return ""
        snippets = [
            f"    ↳ _{r['comment_author']}_ : « {trim(r['content'], 140)} »"
            for _, r in rel.iterrows()
            if pd.notna(r["content"]) and str(r["content"]).strip()
        ]
        return ("\n" + "\n".join(snippets)) if snippets else ""

    def order_block(rows: pd.DataFrame, header: str) -> str:
        if rows.empty:
            return f"#### {header}\n_(aucune visite)_\n"
        lines = [f"#### {header}"]
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

    accepted_md = order_block(pharm[accepted_mask], "Commandes acceptées")
    refused_md = order_block(pharm[refused_mask], "Commandes refusées")

    # Order state chart
    state_chart = ""
    if total_visits > 0:
        fig, ax = plt.subplots(figsize=(8, 2.5))
        states = ["Acceptée", "Refusée", "Champ vide"]
        counts = [accepted_n, refused_n, unset_count]
        colors = [GREEN, DANGER, "#cbd5e1"]
        bars = ax.barh(states, counts, color=colors)
        for bar, c in zip(bars, counts):
            pct = round(100 * c / total_visits, 1)
            ax.text(c + 0.5, bar.get_y() + bar.get_height() / 2,
                    f" {c} ({pct}%)", va="center", fontsize=10, fontweight="bold")
        ax.set_xlim(0, max(counts) * 1.25)
        ax.set_xlabel("Visites pharmacien")
        ax.set_title("État du champ « commande acceptée » sur les visites pharmacien", fontsize=10)
        state_chart = save_chart("pharm_order_state")

    # ── Stock snapshot per pharmacy ───────────────────────────────────
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
    healthy_stock = latest_stock[latest_stock["synapgen_count"] >= 5]

    stock_table_data = pd.DataFrame({
        "Statut": ["Rupture (0)", "Stock faible (1-4)", "Stock OK (≥5)", "Stock non relevé"],
        "Pharmacies": [
            len(zero_stock),
            len(low_stock),
            len(healthy_stock),
            int((pharm_docs["visits_total"] > 0).sum()) - len(latest_stock),
        ],
    })

    zero_md = (
        "_Aucune pharmacie en rupture sur la dernière visite._"
        if zero_stock.empty
        else "\n".join(
            f"- **{r['doctor_name']}** — {r['wilaya']} (dernière visite: {r['visit_date'].strftime('%d %b %Y')})"
            for _, r in zero_stock.iterrows()
        )
    )
    low_md = (
        "_Aucune pharmacie en stock faible._"
        if low_stock.empty
        else "\n".join(
            f"- **{r['doctor_name']}** — {r['wilaya']} — stock: {int(r['synapgen_count'])}"
            for _, r in low_stock.iterrows()
        )
    )

    # ── Top prescribers ───────────────────────────────────────────────
    top_rx = (
        pharm.dropna(subset=["prescriptions_received"])
        .groupby(["doctor_name", "wilaya"])["prescriptions_received"]
        .sum()
        .sort_values(ascending=False)
        .head(10)
        .reset_index()
        .rename(
            columns={
                "doctor_name": "Pharmacie",
                "wilaya": "Wilaya",
                "prescriptions_received": "Prescriptions cumulées",
            }
        )
    )

    # ── Top prescriber doctors (mentioned in pharma visits) ───────────
    top_rx_doctors = (
        pharm.dropna(subset=["prescribing_doctor"])
        .assign(prescribing_doctor=lambda x: x["prescribing_doctor"].str.strip())
        .groupby("prescribing_doctor")
        .size()
        .sort_values(ascending=False)
        .head(10)
        .reset_index(name="Mentions en pharmacie")
        .rename(columns={"prescribing_doctor": "Médecin prescripteur"})
    )

    unset_warning = (
        f"\n> ⚠️  **Champ « commande » non renseigné pour {unset_count} visites sur {total_visits}** "
        f"({round(100 * unset_count / total_visits, 1)}%). "
        "Le taux d'acceptation est calculé uniquement sur les visites où le délégué a rempli ce champ.\n"
        if unset_count > 0
        else ""
    )

    state_chart_md = f"\n![État commande]({state_chart})\n" if state_chart else ""

    return f"""## 4. Pharmaciens

**{total_visits} visites** auprès de **{visited} pharmacies distinctes** sur {total_pharms} du répertoire ({visit_rate}% de couverture).

### 4.1 État des commandes
| Métrique | Valeur |
|---|---:|
| Visites pharmacien | {total_visits} |
| Champ « commande » renseigné | {answered_n} ({round(100 * answered_n / total_visits, 1) if total_visits else 0}%) |
| Commandes acceptées | {accepted_n} |
| Commandes refusées | {refused_n} |
| **Taux d'acceptation** (sur visites renseignées) | **{acceptance_rate}** |
{unset_warning}{state_chart_md}

### 4.2 Pourquoi les commandes sont acceptées
{accepted_md}

### 4.3 Pourquoi les commandes sont refusées
{refused_md}

### 4.4 Stock Synapgen — dernière visite par pharmacie
{md_table(stock_table_data)}

#### Pharmacies en rupture (stock = 0)
{zero_md}

#### Pharmacies en stock faible (1-4)
{low_md}

### 4.5 Top pharmacies par prescriptions reçues
{md_table(top_rx) if not top_rx.empty else "_(aucune prescription remontée)_"}

### 4.6 Médecins les plus cités comme prescripteurs (vu en pharmacie)
{md_table(top_rx_doctors) if not top_rx_doctors.empty else "_(aucun médecin cité)_"}
"""


def section_time_cadence(d: dict[str, pd.DataFrame]) -> str:
    v = d["visits"].copy()
    if v.empty:
        return "## 5. Cadence horaire & qualité de saisie\n\n_Pas de données._\n"

    v["dow"] = v["visit_date"].dt.dayofweek  # 0=Mon
    v["hour"] = v["visit_date"].dt.hour

    # Day-of-week bars (more readable than a heatmap)
    dow_labels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
    dow_counts = v.groupby("dow").size().reindex(range(7), fill_value=0)
    fig, ax = plt.subplots(figsize=(8, 3))
    colors = [PRIMARY] * 6 + ["#cbd5e1"]  # gray-out Sunday
    bars = ax.bar(dow_labels, dow_counts.values, color=colors)
    for b, v_ in zip(bars, dow_counts.values):
        ax.text(b.get_x() + b.get_width() / 2, v_ + 1, str(int(v_)),
                ha="center", va="bottom", fontsize=9, fontweight="bold")
    ax.set_ylabel("Visites")
    ax.set_title("Visites par jour de la semaine", fontsize=10)
    dow_chart = save_chart("visits_by_dow")

    # Hour-of-day bars
    hour_counts = v.groupby("hour").size().reindex(range(24), fill_value=0)
    fig, ax = plt.subplots(figsize=(10, 3))
    colors = [
        DANGER if h < 8 or h >= 19 else PRIMARY
        for h in hour_counts.index
    ]
    ax.bar(hour_counts.index, hour_counts.values, color=colors)
    ax.axvspan(-0.5, 7.5, alpha=0.08, color="red")
    ax.axvspan(18.5, 23.5, alpha=0.08, color="red")
    ax.set_xticks(range(0, 24, 2))
    ax.set_xticklabels([f"{h}h" for h in range(0, 24, 2)])
    ax.set_xlabel("Heure de la saisie")
    ax.set_ylabel("Visites")
    ax.set_title("Visites par heure — zone rouge = hors heures de bureau (avant 8h ou ≥19h)", fontsize=10)
    hour_chart = save_chart("visits_by_hour")

    off_hours = v[(v["hour"] < 8) | (v["hour"] >= 19)]
    off_pct = round(100 * len(off_hours) / len(v), 1)

    # Data hygiene: count missing fields
    hygiene = []
    if "compte_rendu" in v.columns:
        empty_cr = int(v["compte_rendu"].isna().sum() + (v["compte_rendu"] == "").sum())
        if empty_cr:
            hygiene.append(f"- **{empty_cr} visites sans compte-rendu** ({round(100 * empty_cr / len(v), 1)}%)")
    pharm = v[v["visit_type"] == "pharmacien"]
    if not pharm.empty:
        empty_order = int(pharm["accepted_order"].isna().sum())
        if empty_order:
            hygiene.append(
                f"- **{empty_order} visites pharmacien sans réponse au champ « commande acceptée »** "
                f"({round(100 * empty_order / len(pharm), 1)}% des visites pharmacien)"
            )

    return f"""## 5. Cadence horaire & qualité de saisie

![Visites par jour de la semaine]({dow_chart})

![Visites par heure]({hour_chart})

**{len(off_hours)} visite(s) saisies hors heures de bureau** ({off_pct}%) — souvent un signe de saisie en différé plutôt que de visites réelles à ces heures.

### Qualité de saisie
{chr(10).join(hygiene) if hygiene else "_Aucune anomalie majeure détectée._"}
"""


def section_comments(d: dict[str, pd.DataFrame]) -> str:
    c = d["comments"]
    if c.empty:
        return "## 6. Voix du terrain (commentaires)\n\n_Aucun commentaire._\n"

    c = c.copy()
    c["content"] = c["content"].fillna("").astype(str)
    # Strip accents for matching, but display original
    import unicodedata
    def strip_accents(s: str) -> str:
        return "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn").lower()
    c["norm"] = c["content"].apply(strip_accents)

    # ── Themed keyword groups — accent-insensitive, root-form matches ──
    # Each theme has alternatives covering common conjugations + variants.
    themes: dict[str, list[str]] = {
        "Prix / coût": ["prix", "cher", "cout", "tarif", "trop cher"],
        "Refus / objection": ["refus", "rejet", "pas interess", "non honor"],
        "Intérêt / engagement": ["interess", "favorable", "d'accord", "ok pour", "promis", "promet"],
        "Stock / rupture": ["rupture", "manque", "epuise", "pas dispo", "n'a pas trouv"],
        "Commande / bon de commande": ["commande", "command", "bon de"],
        "Prescription / ordonnance": ["prescri", "ordonnance", "honor", "redig", "redact"],
        "Patients (besoins, retours)": ["patient", "enfant", "examen", "stress", "anxi", "concentr"],
        "Échantillons / boîtes": ["echantillon", "boite", "boîte"],
        "Suivi / rappel": ["suivi", "rappel", "passer", "revenir", "reviendr"],
        "Conseil / suggestion": ["conseil", "suggere", "suggest", "propos"],
    }

    def matches(text_norm: str, patterns: list[str]) -> bool:
        return any(p in text_norm for p in patterns)

    theme_counts: dict[str, int] = {}
    theme_examples: dict[str, list[pd.Series]] = {}
    for theme, patterns in themes.items():
        mask = c["norm"].apply(lambda t: matches(t, patterns))
        hits = c[mask]
        theme_counts[theme] = int(len(hits))
        theme_examples[theme] = list(hits.sort_values("created_at", ascending=False).head(3).iterrows())

    def trim(text: str, n: int = 160) -> str:
        text = text.strip().replace("\n", " ")
        return text if len(text) <= n else text[:n] + "…"

    # Themes ordered by hit count (most prevalent first)
    sorted_themes = sorted(theme_counts.items(), key=lambda x: -x[1])
    theme_lines = []
    theme_lines.append("| Thème | Occurrences |")
    theme_lines.append("|---|---:|")
    for theme, count in sorted_themes:
        theme_lines.append(f"| {theme} | {count} |")

    # Example snippets for the top 5 themes that have hits
    detail_blocks: list[str] = []
    for theme, count in sorted_themes:
        if count == 0:
            continue
        examples = theme_examples[theme]
        if not examples:
            continue
        block = [f"#### {theme} ({count})"]
        for _, r in examples:
            who = r["comment_author"] or "Anonyme"
            doc = r["doctor_name"] or "(visite supprimée)"
            date = r["created_at"].strftime("%d %b") if pd.notna(r["created_at"]) else "—"
            block.append(f"- _{doc}_ — **{who}** ({date}) :")
            block.append(f"  > {trim(r['content'])}")
        detail_blocks.append("\n".join(block))

    detail_md = "\n\n".join(detail_blocks) if detail_blocks else "_Aucun thème reconnu dans les commentaires._"

    # ── Comment vs reply split ────────────────────────────────────────
    comment_n = int((c["comment_type"] == "comment").sum())
    reply_n = int((c["comment_type"] == "reply").sum())
    image_n = int(c["has_image"].sum()) if "has_image" in c.columns else 0
    avg_len = int(c["content"].str.len().mean())

    # ── Author leaderboard ────────────────────────────────────────────
    by_author = (
        c.groupby("comment_author").size().reset_index(name="Commentaires")
        .sort_values("Commentaires", ascending=False)
        .rename(columns={"comment_author": "Auteur"})
    )

    # ── Most-discussed doctors (visits with the most comments) ────────
    top_discussed = (
        c.groupby(["doctor_name"]).size().reset_index(name="Commentaires")
        .sort_values("Commentaires", ascending=False)
        .head(10)
        .rename(columns={"doctor_name": "Médecin/Pharmacien"})
    )

    # ── Conversation threads — visits with the longest back-and-forth ──
    by_visit = c.groupby("visit_id").size().sort_values(ascending=False).head(5)
    thread_blocks: list[str] = []
    for vid, n in by_visit.items():
        if n < 2:
            break
        thread_rows = c[c["visit_id"] == vid].sort_values("created_at")
        head_doc = thread_rows.iloc[0]["doctor_name"] or "(visite supprimée)"
        head = f"#### Conversation — {head_doc} ({n} messages)"
        lines = [head]
        for _, r in thread_rows.iterrows():
            arrow = "  ↳ " if r["comment_type"] == "reply" else "- "
            date = r["created_at"].strftime("%d %b") if pd.notna(r["created_at"]) else "—"
            text = trim(r["content"], 200) if r["content"] else "_(image jointe)_"
            lines.append(f"{arrow}**{r['comment_author'] or '?'}** ({date}): {text}")
        thread_blocks.append("\n".join(lines))
    threads_md = "\n\n".join(thread_blocks) if thread_blocks else "_Aucune conversation à plusieurs messages._"

    return f"""## 6. Voix du terrain (commentaires)

**{len(c)} commentaires** au total : {comment_n} commentaires racine + {reply_n} réponses. Longueur moyenne : {avg_len} caractères. {image_n} avec image jointe.

### 6.1 Thèmes détectés (recherche insensible aux accents et conjugaisons)
{chr(10).join(theme_lines)}

### 6.2 Exemples par thème
{detail_md}

### 6.3 Top 10 médecins/pharmaciens les plus commentés
{md_table(top_discussed)}

### 6.4 Auteurs des commentaires
{md_table(by_author)}

### 6.5 Conversations actives (visites avec plusieurs messages)
{threads_md}
"""


def section_planning(d: dict[str, pd.DataFrame]) -> str:
    a = d["assignments"]
    if a.empty:
        return "## 7. Planification\n\n_Aucune planification._\n"

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

    return f"""## 7. Planification

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
PDF_YAML_HEADER = """---
title: "Handson — Rapport d'analyse"
subtitle: "Synthèse des visites médecins & pharmaciens"
date: "{date}"
geometry: "left=2cm,right=2cm,top=2cm,bottom=2cm"
fontsize: 10pt
documentclass: article
colorlinks: true
linkcolor: blue
urlcolor: blue
header-includes:
  - \\setlength{{\\parskip}}{{0.35em}}
---

"""


def write_report(sections: list[str]) -> None:
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now(timezone.utc).strftime("%d %B %Y — %Hh%M UTC")

    # Markdown version (for VS Code preview / GitHub) — no YAML header
    md_header = (
        f"# Analyse Handson Délégué Médical\n\n"
        f"_Généré le {generated_at}_\n\n"
        "---\n"
    )
    body = "\n\n---\n\n".join(sections)
    REPORT.write_text(md_header + body)
    print(f"✓ Markdown → {REPORT}")
    print(f"✓ Charts   → {CHARTS}/")

    # PDF version — YAML metadata header + same body, rendered by pandoc
    pdf_md_path = DATA / "_ANALYSIS_pdf.md"
    pdf_md_path.write_text(PDF_YAML_HEADER.format(date=generated_at) + body)
    generate_pdf(pdf_md_path)
    pdf_md_path.unlink(missing_ok=True)


def generate_pdf(source_md: Path) -> None:
    """Convert the markdown source to a PDF via pandoc + xelatex."""
    import shutil
    import subprocess

    pdf_out = REPORT.with_suffix(".pdf")
    if not shutil.which("pandoc"):
        print("⚠ pandoc not found — skipping PDF generation. Install: brew install pandoc")
        return
    if not shutil.which("xelatex"):
        print("⚠ xelatex not found — skipping PDF generation. Install: brew install --cask mactex")
        return

    cmd = [
        "pandoc", str(source_md),
        "-o", str(pdf_out),
        "--pdf-engine=xelatex",
        "--variable=mainfont=Helvetica Neue",
        "--variable=monofont=Menlo",
        "--toc",
        "--toc-depth=2",
        # Resolve relative chart paths (data/charts/*.png in markdown)
        f"--resource-path={DATA}",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode == 0:
            print(f"✓ PDF      → {pdf_out}")
        else:
            print(f"⚠ pandoc failed (code {result.returncode}):")
            # Show only the most relevant error line(s)
            err_lines = [l for l in result.stderr.splitlines() if l.strip()][:5]
            for line in err_lines:
                print(f"  {line}")
    except subprocess.TimeoutExpired:
        print("⚠ pandoc timed out after 2 min")
    except Exception as e:
        print(f"⚠ PDF generation error: {e}")


def clear_charts() -> None:
    """Wipe stale chart PNGs so each run produces a clean set."""
    if CHARTS.exists():
        for f in CHARTS.glob("*.png"):
            f.unlink()


def main() -> None:
    clear_charts()
    d = load_csvs()
    print(
        f"Loaded: visits={len(d['visits'])}, doctors={len(d['doctors'])}, "
        f"delegues={len(d['delegues'])}, answers={len(d['answers'])}, "
        f"comments={len(d['comments'])}, assignments={len(d['assignments'])}"
    )
    sections = [
        section_synthese(d),
        section_overview(d),
        section_delegue_scorecard(d),
        section_medecins(d),
        section_pharmaciens(d),
        section_time_cadence(d),
        section_comments(d),
        section_planning(d),
    ]
    write_report(sections)


if __name__ == "__main__":
    main()
