/**
 * Historical filename — validates the zero-budget analysis pipeline (snapshot + fallback).
 */
const { analyzeCode, getReviewAiRuntimeInfo } = require('../services/openaiService');

const sampleUnifiedDiff = `diff --git a/src/app.js b/src/app.js
index 111..222 100644
--- a/src/app.js
+++ b/src/app.js
@@ -1,6 +1,8 @@
 const x = 1;
+console.log('debug');
 export async function run() {
   await fetch('/x');
+  // FIXME: hack
 }

`;

describe('Review analysis wrapper', () => {
  it('reports OpenAI-independent runtime info', () => {
    const info = getReviewAiRuntimeInfo();
    expect(info.mode).toBe('repository_snapshot_rules');
    expect(info.usesOpenAiApi).toBe(false);
    expect(info.hint).toMatch(/snapshot|tree|blob|diff/i);
  });

  it('fallback (diff-only) returns structured analysis when snapshot context missing', async () => {
    const result = await analyzeCode(sampleUnifiedDiff, { repoName: 'owner/repo' });
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('overallScore');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('positives');
    expect(Array.isArray(result.issues)).toBe(true);
    expect(typeof result.overallScore).toMatch(/number/);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('fallback flags console.log and FIXME with snippet and rule metadata', async () => {
    const result = await analyzeCode(sampleUnifiedDiff, { repoName: 't/r' });
    const blob = result.issues.map((i) => `${i.title} ${i.description}`).join(' ');
    expect(blob.toLowerCase()).toMatch(/console|fixme|todo/);
    const consoleIssue = result.issues.find((i) =>
      String(i.title + i.matchedRule).toLowerCase().includes('console')
    );
    expect(consoleIssue).toBeTruthy();
    expect(consoleIssue.codeSnippet).toMatch(/console\.log/i);
    expect(consoleIssue.lineNumber).toBeGreaterThanOrEqual(1);
    expect(consoleIssue.matchedRule).toMatch(/console/i);
  });

  it('handles empty diff when snapshot unavailable (explicit null score messaging)', async () => {
    const result = await analyzeCode('', { repoName: 't/r' });
    expect(result.overallScore).toBeNull();
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.summary).toMatch(/snapshot|GitHub|\[analysis\]/i);
  });
});
