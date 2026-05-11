# Thesis evaluation harness (offline)

This folder is **not** part of the production application. It exists only for **academic evaluation**: batch-running the same **`analyzeCode`** path the worker uses when GitHub snapshot context is unavailable (diff-only fallback + diff heuristics).

## How to run

From the **repository root**:

```bash
npm run evaluate
```

This regenerates **`evaluation/results.md`** with a table of synthetic cases (issue counts and timings).

During the batch run, **per-case analyzer logs are suppressed** so Git Bash / Windows terminals do not show broken ANSI fragments (`]: …`). You still get one line: `Wrote …/evaluation/results.md (30 rows)`.

## Requirements

- Node.js 20+ (same as the rest of the repo).
- **No** running API, Redis, or Supabase required for the harness (stub env vars are set before loading backend modules).

## What is measured

- **Case id** — synthetic PR id from `fixtures/cases.js`.
- **Detected issues count** — `result.issues.length` after `openaiService.analyzeCode(diff, {})`.
- **Processing time** — wall-clock ms per case on the machine that ran the script.
- **Notes** — short thesis-oriented label from the fixture.

The harness **does not** call GitHub, enqueue webhooks, or touch the database.
