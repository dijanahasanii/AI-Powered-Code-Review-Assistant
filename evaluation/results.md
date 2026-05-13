# Evaluation results (generated)

Run again from repo root: `npm run evaluate`

- **Generated at (UTC):** 2026-05-12T20:13:03.306Z
- **Node:** v22.22.0
- **Harness:** `evaluation/run_evaluation.js` — calls `backend/src/services/openaiService.js` `analyzeCode(diff, {})` (diff-only / snapshot-unavailable path; no GitHub, no DB).

## Summary table

| case id | detected issues count | processing time (ms) | notes |
|---------|------------------------|----------------------|-------|
| case-01 | 1 | 7 | console.log in new line |
| case-02 | 1 | 2 | FIXME marker |
| case-03 | 1 | 0 | TODO marker |
| case-04 | 1 | 1 | Possible Stripe-style secret literal |
| case-05 | 1 | 0 | GitHub PAT-like literal |
| case-06 | 1 | 1 | JWT_SECRET env-style assignment |
| case-07 | 1 | 0 | async + await without catch in added lines |
| case-08 | 1 | 0 | Very long consecutive added block (30 lines) |
| case-09 | 2 | 1 | console + TODO same hunk |
| case-10 | 1 | 0 | Substantial benign code (no strong patterns) |
| case-11 | 1 | 0 | Minimal single-line addition |
| case-12 | 0 | 0 | Empty diff text |
| case-13 | 1 | 0 | console.debug |
| case-14 | 1 | 1 | console.info |
| case-15 | 1 | 0 | HACK marker |
| case-16 | 1 | 0 | XXX marker |
| case-17 | 1 | 0 | AWS-like key id fragment |
| case-18 | 1 | 0 | BEGIN PRIVATE KEY block |
| case-19 | 1 | 0 | Second file in one patch |
| case-20 | 1 | 0 | Whitespace-only-looking substantial blob |
| case-21 | 1 | 0 | Slack token-like |
| case-22 | 1 | 1 | API_KEY literal style |
| case-23 | 1 | 0 | async arrow with await, no catch |
| case-24 | 1 | 0 | Only context lines would be invalid — use additions only |
| case-25 | 2 | 0 | Markdown file path (still parsed as diff) |
| case-26 | 2 | 0 | Duplicate console on two lines |
| case-27 | 2 | 0 | Mixed critical + info |
| case-28 | 1 | 0 | Antropic-style key fragment |
| case-29 | 1 | 1 | Password literal pattern |
| case-30 | 1 | 0 | Async function with await + try/catch (should not flag async-no-catch) |
