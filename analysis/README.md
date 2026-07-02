# Handson — Data analysis pipeline

Reads CSV exports from `data/` (Supabase `v_*` views) and writes:
- **`data/ANALYSIS.md`** — Markdown report (read in VS Code / GitHub)
- **`data/ANALYSIS.pdf`** — printable PDF version with charts embedded
- **`data/charts/`** — chart PNGs (one per chart)

## Setup (once)

```bash
pip3 install -r analysis/requirements.txt
```

For PDF output, you also need pandoc + xelatex:

```bash
brew install pandoc
brew install --cask mactex   # ~4 GB. For a lighter install: basictex
```

(Markdown output works without these — PDF is just skipped.)

## Refreshing the data

1. Run [the analysis SQL views](../supabase/migrations/) in Supabase to
   ensure the `v_*` views exist (one-time).
2. In Supabase → Table Editor → Views, click each view in turn and export
   as CSV. Save into `data/` with the file name Supabase suggests
   (`v_visits_full_rows.csv`, etc.).
3. Run the script:

```bash
python3 analysis/analyze.py
```

Both the markdown and PDF are overwritten in place.

## What's in the report

Eight sections, each answering a concrete business question:

| # | Section | Answers |
|---|---|---|
| 0 | Synthèse exécutive | 5-bullet headline view |
| 1 | Vue d'ensemble | Activity totals + period covered |
| 2 | Scorecard du délégué | Daily visits vs goal, weekly trend |
| 3 | Médecins | By specialty, coverage, conversion, relance list |
| 4 | Pharmaciens | Order acceptance (with reasons), stock, prescribers |
| 5 | Cadence + qualité | Visit timing + data-hygiene flags |
| 6 | Voix du terrain | Themed comments + conversation threads |
| 7 | Planification | Assignment completion stats |

## Gitignored

- `data/` (CSV inputs, generated MD/PDF, charts)
- `analysis/.venv/`
- `analysis/__pycache__/`

Only the analysis script + requirements + this README are committed.
