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

| Output | Meaning |
|--------|--------|
| **Case id** | Synthetic id from `fixtures/cases.js` (each row is a unified diff fixture). |
| **Detected issues count** | `result.issues.length` after `openaiService.analyzeCode(diff, {})` — same module name as production; **not** a call to OpenAI’s HTTP API (`usesOpenAiApi === false`). |
| **Processing time (ms)** | Wall-clock latency per case on the machine that ran the script — useful for relative comparisons (same hardware, same Node version). |
| **Notes** | Short label from the fixture (what pattern the case is meant to exercise). |

## How to interpret results

- **Heuristic / static analysis only** in this configuration: counts reflect **regex and snapshot-style rules** on synthetic text, not human-level judgment and not an external LLM.
- **Latency** is **single-machine** and includes Node startup cost amortized over many cases in one process; treat absolute ms as indicative, not a formal benchmark.
- **Reproducibility**: re-running `npm run evaluate` on the same commit should yield the **same issue counts** for deterministic rules; timings will vary slightly.
- **Not measured here**: webhook delivery, queue persistence, Socket.IO, database I/O, or GitHub API rate limits — those belong to integration / manual thesis demos.

The harness **does not** call GitHub, enqueue webhooks, or touch the database.

## Relation to production

Production reviews add **GitHub tree + blob snapshot** analysis when credentials and SHAs are available; the harness forces the **diff-only** path so every case is comparable without network access. See [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for the full runtime pipeline.
