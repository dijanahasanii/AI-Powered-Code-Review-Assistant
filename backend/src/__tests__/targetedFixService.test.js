const { applyIssueFix, applyFixesToFiles } = require('../services/targetedFixService');

describe('targetedFixService', () => {
  it('comments console.log on the reported line', () => {
    const content = 'function x() {\n  console.log("hi");\n}\n';
    const result = applyIssueFix(content, {
      line_number: 2,
      title: 'Console log',
      matched_rule: 'console.log',
      suggestion: 'Remove console.log',
    });
    expect(result.applied).toBe(true);
    expect(result.content).toContain('// [ai-fix]');
  });

  it('applies fixes per file without rewriting unrelated files', () => {
    const files = new Map([
      ['a.js', 'const x = 1;\nconsole.log(x);\n'],
      ['b.js', 'export default {};\n'],
    ]);
    const { files: out, applied } = applyFixesToFiles(files, [
      {
        file_path: 'a.js',
        line_number: 2,
        title: 'Console',
        matched_rule: 'console',
        suggestion: 'remove',
      },
    ]);
    expect(applied.length).toBeGreaterThan(0);
    expect(out.get('a.js')).not.toBe(files.get('a.js'));
    expect(out.get('b.js')).toBe(files.get('b.js'));
  });

  it('wraps async handler in try/catch for async_flow_no_catch style issues', () => {
    const content = `document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('/api');
  console.log(res);
});
`;
    const result = applyIssueFix(content, {
      line_number: 1,
      title: 'Missing error handling around async code',
      category: 'async',
      matched_rule: 'async/await but has no catch',
      suggestion: 'Wrap the awaited code in try { … } catch',
    });
    expect(result.applied).toBe(true);
    expect(result.content).toContain('try {');
    expect(result.content).toContain('catch (error)');
  });
});
