/**
 * Synthetic unified-diff fixtures for thesis evaluation only.
 * Format matches backend/src/lib/diffParseUtils.js (diff --git … @@ … + lines).
 */

function diffGit(file, hunkBody) {
  return `diff --git a/${file} b/${file}\nindex 0000000..1111111 100644\n--- a/${file}\n+++ b/${file}\n${hunkBody}`;
}

/** Decode base64 for evaluation-only secret-shaped literals (keeps scanners from matching file text). */
function ux(b64) {
  return Buffer.from(b64, 'base64').toString('utf8');
}

const longBulkBody = (() => {
  const lines = Array.from({ length: 30 }, (_, i) => `+const _bulk${i} = ${i};`);
  return `@@ -0,0 +1,30 @@\n${lines.join('\n')}\n`;
})();

/** @type {{ id: string; notes: string; diff: string }[]} */
const CASES = [
  {
    id: 'case-01',
    notes: 'console.log in new line',
    diff: diffGit(
      'src/app.js',
      `@@ -1,3 +1,4 @@
 export const x = 1;
+console.log('debug');
 export const y = 2;
`
    ),
  },
  {
    id: 'case-02',
    notes: 'FIXME marker',
    diff: diffGit(
      'lib/utils.js',
      `@@ -1,2 +1,3 @@
 function ok() {
+  // FIXME: remove hack
   return true;
`
    ),
  },
  {
    id: 'case-03',
    notes: 'TODO marker',
    diff: diffGit(
      'todo.js',
      `@@ -0,0 +1,2 @@
+// TODO: implement validation
+export const n = 1;
`
    ),
  },
  {
    id: 'case-04',
    notes: 'Possible Stripe-style secret literal',
    diff: diffGit(
      'bad.js',
      `@@ -0,0 +1,2 @@
+const k = '${ux('c2tfbGl2ZV8xMjM0NTY3ODkwYWJjZGVmZ2hpag==')}';
+export default k;
`
    ),
  },
  {
    id: 'case-05',
    notes: 'GitHub PAT-like literal',
    diff: diffGit(
      'leak.js',
      `@@ -0,0 +1,2 @@
+const t = '${ux('Z2hwX2FiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MTI=')}';
+export { t };
`
    ),
  },
  {
    id: 'case-06',
    notes: 'JWT_SECRET env-style assignment',
    diff: diffGit(
      'config.js',
      `@@ -0,0 +1,2 @@
+const x = { JWT_SECRET: 'supersecretvaluehere123' };
+module.exports = x;
`
    ),
  },
  {
    id: 'case-07',
    notes: 'async + await without catch in added lines',
    diff: diffGit(
      'api.js',
      `@@ -0,0 +1,4 @@
+export async function load() {
+  const r = await fetch('/api');
+  return r.json();
+}
`
    ),
  },
  {
    id: 'case-08',
    notes: 'Very long consecutive added block (30 lines)',
    diff: diffGit('bulk.js', longBulkBody),
  },
  {
    id: 'case-09',
    notes: 'console + TODO same hunk',
    diff: diffGit(
      'mixed.js',
      `@@ -1,1 +1,3 @@
+console.log('x');
+// TODO: clean
 const a = 1;
`
    ),
  },
  {
    id: 'case-10',
    notes: 'Substantial benign code (no strong patterns)',
    diff: diffGit(
      'clean.js',
      `@@ -0,0 +1,12 @@
+export function sum(a, b) {
+  const x = Number(a);
+  const y = Number(b);
+  return x + y;
+}
+export function mul(a, b) {
+  return a * b;
+}
+export const VERSION = '1.0.0';
+export const NAME = 'demo';
+export const DESC = 'helper module for math';
`
    ),
  },
  {
    id: 'case-11',
    notes: 'Minimal single-line addition',
    diff: diffGit(
      'tiny.js',
      `@@ -1,2 +1,3 @@
 const a = 1;
+const b = 2;
`
    ),
  },
  {
    id: 'case-12',
    notes: 'Empty diff text',
    diff: '',
  },
  {
    id: 'case-13',
    notes: 'console.debug',
    diff: diffGit(
      'dbg.js',
      `@@ -0,0 +1,2 @@
+console.debug('state', 1);
+export const z = 0;
`
    ),
  },
  {
    id: 'case-14',
    notes: 'console.info',
    diff: diffGit(
      'inf.js',
      `@@ -0,0 +1,2 @@
+console.info('ready');
+export const ok = true;
`
    ),
  },
  {
    id: 'case-15',
    notes: 'HACK marker',
    diff: diffGit(
      'hack.js',
      `@@ -0,0 +1,2 @@
+// HACK: temporary bypass
+export const f = () => 1;
`
    ),
  },
  {
    id: 'case-16',
    notes: 'XXX marker',
    diff: diffGit(
      'xxx.js',
      `@@ -0,0 +1,2 @@
+// XXX bad smell
+export const q = 1;
`
    ),
  },
  {
    id: 'case-17',
    notes: 'AWS-like key id fragment',
    diff: diffGit(
      'aws.js',
      `@@ -0,0 +1,2 @@
+const k = '${ux('QUtJQUlPU0ZPRE5ON0VYQU1QTEU=')}';
+module.exports = k;
`
    ),
  },
  {
    id: 'case-18',
    notes: 'BEGIN PRIVATE KEY block',
    diff: diffGit(
      'key.pem.js',
      `@@ -0,0 +1,3 @@
+const pem = \`${ux('LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLVxuTUlJRS4uLlxuLS0tLS1FTkQgUlNBIFBSSVZBVEUgS0VZLS0tLS0=')}\`;
`
    ),
  },
  {
    id: 'case-19',
    notes: 'Second file in one patch',
    diff: `diff --git a/a.js b/a.js
index 0000000..1111111 100644
--- a/a.js
+++ b/a.js
@@ -0,0 +1,2 @@
+console.log('a');
+export const a = 1;
diff --git a/b.js b/b.js
index 0000000..1111111 100644
--- a/b.js
+++ b/b.js
@@ -0,0 +1,2 @@
+// FIXME in b
+export const b = 2;
`,
  },
  {
    id: 'case-20',
    notes: 'Whitespace-only-looking substantial blob',
    diff: diffGit(
      'wide.js',
      `@@ -0,0 +1,15 @@
+const arr = [
+  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
+  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
+];
+export function pick(i) {
+  return arr[i % arr.length];
+}
+export const meta = { name: 'demo', size: arr.length };
+export const desc = 'deterministic demo data for evaluation harness';
+export const tag = 'thesis-eval';
+export const version = 1;
+export const ok = true;
+export const flag = false;
+export const mode = 'test';
+export const region = 'local';
+export const owner = 'eval';
`
    ),
  },
  {
    id: 'case-21',
    notes: 'Slack token-like',
    diff: diffGit(
      'slack.js',
      `@@ -0,0 +1,2 @@
+const s = '${ux('eG94Yi0xMjM0NTY3ODkwLTEyMzQ1Njc4OTAxMjMtYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4')}';
+export default s;
`
    ),
  },
  {
    id: 'case-22',
    notes: 'API_KEY literal style',
    diff: diffGit(
      'env.js',
      `@@ -0,0 +1,2 @@
+const API_KEY = '${ux('YWJjZGVmMTIzNDU2Nzg5MGFiY2RlZjEyMzQ1Njc4OTA=')}';
+export { API_KEY };
`
    ),
  },
  {
    id: 'case-23',
    notes: 'async arrow with await, no catch',
    diff: diffGit(
      'arrow.js',
      `@@ -0,0 +1,3 @@
+export const run = async () => {
+  await fetch('/x');
+};
`
    ),
  },
  {
    id: 'case-24',
    notes: 'Only context lines would be invalid — use additions only',
    diff: diffGit(
      'onlyadd.js',
      `@@ -0,0 +1,5 @@
+const u = 1;
+const v = 2;
+const w = 3;
+const x = 4;
+const y = 5;
`
    ),
  },
  {
    id: 'case-25',
    notes: 'Markdown file path (still parsed as diff)',
    diff: diffGit(
      'README.md',
      `@@ -0,0 +1,3 @@
+# Title
+console.log('in md');
+TODO: write docs
`
    ),
  },
  {
    id: 'case-26',
    notes: 'Duplicate console on two lines',
    diff: diffGit(
      'dup.js',
      `@@ -0,0 +1,3 @@
+console.log(1);
+console.log(2);
+export const z = 0;
`
    ),
  },
  {
    id: 'case-27',
    notes: 'Mixed critical + info',
    diff: diffGit(
      'mix.js',
      `@@ -0,0 +1,3 @@
+const secret = '${ux('Z2hwX2FiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MTI=')}';
+console.log(secret);
+export const oops = 1;
`
    ),
  },
  {
    id: 'case-28',
    notes: 'Antropic-style key fragment',
    diff: diffGit(
      'ant.js',
      `@@ -0,0 +1,2 @@
+const k = '${ux('c2stYW50LWFwaTAzLWFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6')}';
+export default k;
`
    ),
  },
  {
    id: 'case-29',
    notes: 'Password literal pattern',
    diff: diffGit(
      'pwd.js',
      `@@ -0,0 +1,2 @@
+const DB_PASSWORD = 'hunter2hunter2hunter2';
+export { DB_PASSWORD };
`
    ),
  },
  {
    id: 'case-30',
    notes: 'Async function with await + try/catch (should not flag async-no-catch)',
    diff: diffGit(
      'safe.js',
      `@@ -0,0 +1,6 @@
+export async function safe() {
+  try {
+    await fetch('/ok');
+  } catch (e) {
+    throw e;
+  }
+}
`
    ),
  },
];

module.exports = { CASES };
