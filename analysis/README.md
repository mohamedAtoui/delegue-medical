# Handson — Data analysis pipeline

Reads CSV exports from `data/` (Supabase `v_*` views) and writes a Markdown
report to `data/ANALYSIS.md` with embedded charts in `data/charts/`.

## Setup (once)

```bash
pip3 install -r analysis/requirements.txt
```

## Refreshing the data

1. Run [the analysis SQL views](../supabase/migrations/) in Supabase to
   ensure the `v_*` views exist (one-time).
2. In Supabase → Table Editor → Views, click each view in turn and export as
   CSV. Save into `data/` with the file name Supabase suggests
   (`v_visits_full_rows.csv`, etc.).
3. Run the script:

```bash
python3 analysis/analyze.py
```

The report is overwritten in place. Open `data/ANALYSIS.md` in VS Code's
markdown preview to read it with chart images inline.

## What's in the report

Eight sections covering activity headlines, délégué scorecards, doctor
coverage, conversion funnel, pharmacien stock & orders, time patterns,
comments mining, and planning effectiveness. See the script source for the
exact computations behind each metric.

## What's gitignored

Both `data/` (the CSV inputs + generated outputs) and `analysis/__pycache__/`
are gitignored. Only the analysis script + requirements + this README are
committed.
