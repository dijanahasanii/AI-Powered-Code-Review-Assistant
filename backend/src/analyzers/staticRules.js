'use strict';

const { clipSnippet } = require('../lib/diffParseUtils');
const { SECRET_SHAPE } = require('../lib/secretRegex');
const { isRemediationNoiseLine } = require('../lib/remediationMarkers');
const JWT_ASSIGN =
  /\b[A-Z][A-Z0-9]*_(?:SECRET|KEY|TOKEN|PASSWORD)\s*=\s*['"][^'"\\]{3,512}['"]/i;
const ADMIN_PASS_ASSIGN = /ADMIN_(PASS|PASSWORD)\s*=\s*['"][^'"]{4,}['"]/i;

function isTestPath(p) {
  return /(\.test\.|\.spec\.|__tests__|[/\\]tests?[/\\])/i.test(p);
}

function isReactPath(p) {
  return /\.(jsx|tsx)$/i.test(p);
}

function isLikelyServerPath(p) {
  return /(server|app|routes|router|middleware|controller|handlers|express|nestjs|worker)/i.test(p);
}

function lineAtIndex(content, idx) {
  return content.slice(0, idx).split(/\r?\n/).length;
}

function mkIssue(slug, filePath, lineNumber, snippet, severity, category, title, description, suggestion, matchedRule) {
  return {
    matchedRuleSlug: slug,
    filePath,
    lineNumber,
    codeSnippet: clipSnippet(snippet),
    severity,
    category,
    title,
    description,
    suggestion,
    matchedRule,
  };
}

const LINE_CHECKS = [];

function registerLine(meta, testFn) {
  LINE_CHECKS.push({
    slug: meta.slug,
    severity: meta.severity,
    category: meta.category,
    title: meta.title,
    description: meta.description,
    suggestion: meta.suggestion,
    matchedRule: meta.matchedRule,
    skipTestFiles: meta.skipTestFiles !== false,
    reactOnly: Boolean(meta.reactOnly),
    serverOnly: Boolean(meta.serverOnly),
    test: testFn,
  });
}

registerLine(
  {
    slug: 'secret_material',
    severity: 'critical',
    category: 'security',
    title: 'Possible password or secret in the code',
    description:
      'This line looks like a real API key, token, private key block, JWT-style secret, or admin password typed into the source. That is unsafe in git.',
    suggestion:
      'If it is real: remove it from the repo, put it in environment variables or a secret store, and rotate the key. If it is fake: use a clear placeholder instead.',
    matchedRule:
      'Looks like a key/token/password pattern (API keys, AWS keys, GitHub tokens, PEM blocks, JWT_SECRET=…, etc.)',
  },
  (line) => SECRET_SHAPE.test(line) || JWT_ASSIGN.test(line) || ADMIN_PASS_ASSIGN.test(line)
);

registerLine(
  {
    slug: 'eval_usage',
    severity: 'critical',
    category: 'security',
    title: 'eval() runs code from text',
    description:
      'eval lets any string run as code. Attackers who can feed text into eval can take over the app.',
    suggestion: 'Delete eval. Use JSON.parse with checks, config files, or other safe options.',
    matchedRule: 'The line contains eval(',
  },
  (line) => /\beval\s*\(/.test(line)
);

registerLine(
  {
    slug: 'function_constructor',
    severity: 'critical',
    category: 'security',
    title: 'new Function() builds code from a string',
    description: 'This is very close to eval: it turns text into running code.',
    suggestion: 'Avoid building code from strings. Use normal functions and clear data instead.',
    matchedRule: 'The line contains new Function(',
  },
  (line) => /\bnew\s+Function\s*\(/.test(line)
);

registerLine(
  {
    slug: 'dangerously_inner_html_react',
    severity: 'critical',
    category: 'security',
    title: 'Raw HTML injected into the page (React)',
    description:
      'dangerouslySetInnerHTML drops HTML straight into the page. If that HTML comes from users or the network, someone can slip in scripts.',
    suggestion: 'Do not use raw HTML unless you trust the source 100%. If you must, sanitize first (e.g. DOMPurify).',
    matchedRule: 'Uses React’s dangerouslySetInnerHTML',
    reactOnly: true,
  },
  (line) => /dangerouslySetInnerHTML\s*:/.test(line)
);

registerLine(
  {
    slug: 'dom_inner_html',
    severity: 'warning',
    category: 'security',
    title: 'Setting innerHTML',
    description:
      'Putting strings into .innerHTML can run scripts if the string is not safe. Same class of problem as raw HTML in React.',
    suggestion: 'Prefer textContent, safe components, or sanitized HTML only.',
    matchedRule: 'The line assigns to .innerHTML',
  },
  (line, path) =>
    /\.(jsx?|tsx?)$/i.test(path) && /\.innerHTML\s*=/i.test(line)
);

registerLine(
  {
    slug: 'document_write',
    severity: 'warning',
    category: 'bad-practice',
    title: 'document.write(…)',
    description: 'Old API; can break modern pages and is easy to misuse.',
    suggestion: 'Update the DOM in the normal way (create elements, set text, etc.).',
    matchedRule: 'The line calls document.write(',
  },
  (line) => /document\.write\s*\(/i.test(line)
);

registerLine(
  {
    slug: 'child_process_exec_sync',
    severity: 'critical',
    category: 'express',
    title: 'execSync freezes the server',
    description:
      'execSync stops everything until the command finishes and often runs a shell. Slow and risky if any input comes from users.',
    suggestion: 'Use the async versions, or run one program with a fixed argument list (no shell).',
    matchedRule: 'The line calls execSync(',
    serverOnly: true,
  },
  (line, path) => isLikelyServerPath(path) && /\bexecSync\s*\(/.test(line)
);

registerLine(
  {
    slug: 'spawn_shell_literal',
    severity: 'warning',
    category: 'express',
    title: 'Starting a shell (sh / bash / cmd)',
    description:
      'Spawning sh, bash, or cmd makes it easier for bad input to turn into a full shell command.',
    suggestion: 'Call one program directly with a list of arguments, without going through a shell.',
    matchedRule: 'spawn(…) with sh, bash, or cmd in the line',
    serverOnly: true,
  },
  (line, path) =>
    isLikelyServerPath(path) &&
    /spawn(?:Sync)?\s*\(\s*['"](?:\/bin\/sh|\/bin\/bash|sh|bash|cmd(?:\.exe)?)['"]/i.test(line)
);

registerLine(
  {
    slug: 'cors_wide_open',
    severity: 'warning',
    category: 'express',
    title: 'CORS allows any site (or is very loose)',
    description:
      'Letting every website call your API from the browser is often too open, especially with cookies or logins.',
    suggestion: 'List only the front-end URLs you trust. Avoid origin: "*" with logged-in users.',
    matchedRule: 'cors(…) with origin * or origin: true',
    serverOnly: true,
  },
  (line, path) =>
    isLikelyServerPath(path) &&
    /\bcors\s*\(/.test(line) &&
    (/origin\s*:\s*['"]\*['"]/.test(line) || /origin\s*:\s*true\b/.test(line))
);

registerLine(
  {
    slug: 'sql_concat',
    severity: 'critical',
    category: 'security',
    title: 'SQL built by gluing strings together',
    description:
      'If any part of that string comes from a user, they can change the query and read or delete data (SQL injection).',
    suggestion: 'Use placeholders / parameters from your database library — never paste user text into the SQL string.',
    matchedRule: 'SELECT … with + and user/login-style words on the same line',
    serverOnly: true,
  },
  (line, path) =>
    isLikelyServerPath(path) &&
    /\bSELECT\b/i.test(line) &&
    /\+/.test(line) &&
    /login|username|password|userId|email|account/i.test(line)
);

registerLine(
  {
    slug: 'sync_fs',
    severity: 'warning',
    category: 'performance',
    title: 'Reading files in a blocking way',
    description:
      'readFileSync and similar *Sync calls pause the whole Node process until the disk answers. Under load, that slows every request.',
    suggestion: 'Use the async fs methods (fs.promises) or a small queue so the server stays responsive.',
    matchedRule: 'Line uses readFileSync, writeFileSync, readdirSync, or existsSync',
    serverOnly: true,
  },
  (line, path) => isLikelyServerPath(path) && /\b(readFileSync|readdirSync|writeFileSync|existsSync)\s*\(/.test(line)
);

registerLine(
  {
    slug: 'foreach_async',
    severity: 'warning',
    category: 'async',
    title: 'forEach with async inside',
    description:
      'forEach does not wait for async work. Your awaits may finish in the wrong order or errors may be ignored.',
    suggestion: 'Use a normal for loop with await, or Promise.all on an array.',
    matchedRule: 'Line has .forEach(async …)',
  },
  (line) => /\.forEach\s*\(\s*async\b/.test(line)
);

registerLine(
  {
    slug: 'console_debug',
    severity: 'suggestion',
    category: 'bad-practice',
    title: 'console.log (or debug / info)',
    description: 'Fine while developing; often forgotten before release and can leak data in production.',
    suggestion: 'Remove or switch to real logging that you can turn off in production.',
    matchedRule: 'Line calls console.log, console.debug, or console.info',
    skipTestFiles: false,
  },
  (line, path) => !isTestPath(path) && /console\.(log|debug|info)\s*\(/i.test(line)
);

registerLine(
  {
    slug: 'debugger_stmt',
    severity: 'warning',
    category: 'bad-practice',
    title: 'debugger left in the code',
    description: 'The page or server can freeze here when dev tools are open.',
    suggestion: 'Delete debugger before you ship.',
    matchedRule: 'The line contains the word debugger',
    skipTestFiles: false,
  },
  (line) => /\bdebugger\b/.test(line)
);

registerLine(
  {
    slug: 'todo_marker',
    severity: 'suggestion',
    category: 'maintainability',
    title: 'TODO / FIXME / HACK note',
    description: 'A reminder that work is unfinished.',
    suggestion: 'Turn it into a ticket or finish the work before an important release.',
    matchedRule: 'Line contains TODO, FIXME, HACK, or XXX',
    skipTestFiles: false,
  },
  (line) => /\b(TODO|FIXME|HACK|XXX)\b/i.test(line)
);

registerLine(
  {
    slug: 'var_keyword',
    severity: 'info',
    category: 'code-quality',
    title: 'Uses var',
    description: 'var works differently from let/const and is easy to misuse.',
    suggestion: 'Prefer const (default) or let when the value changes.',
    matchedRule: 'Line declares a variable with var',
  },
  (line) => /^\s*var\s+\w+/m.test(line) && /\bvar\s+/.test(line)
);

registerLine(
  {
    slug: 'eslint_disable',
    severity: 'suggestion',
    category: 'code-quality',
    title: 'ESLint turned off for this line/file',
    description: 'You told the linter to ignore problems here.',
    suggestion: 'Only disable the one rule you need, and say why in a short comment.',
    matchedRule: 'Line contains eslint-disable',
    skipTestFiles: false,
  },
  (line) => /eslint-disable/.test(line)
);

registerLine(
  {
    slug: 'ts_ignore',
    severity: 'suggestion',
    category: 'code-quality',
    title: 'TypeScript error hidden (@ts-ignore)',
    description: 'The compiler will not warn you about the next line even if it is wrong.',
    suggestion: 'Fix the types, or use @ts-expect-error with a reason if you must.',
    matchedRule: 'Line contains @ts-ignore',
  },
  (line) => /@ts-ignore\b/.test(line)
);

registerLine(
  {
    slug: 'react_key_index',
    severity: 'warning',
    category: 'react',
    title: 'List item key is just the loop index',
    description:
      'React uses key to know which row is which. If the list order changes, using 0,1,2… can mix up state and UI.',
    suggestion: 'Use a stable id from your data (user id, row id, etc.), not the array index.',
    matchedRule: 'JSX has key={i} or key={index}',
    reactOnly: true,
  },
  (line, path) => isReactPath(path) && /\bkey\s*=\s*\{[^}]*(i|index)\s*\}/i.test(line)
);

registerLine(
  {
    slug: 'json_parse_unsafe',
    severity: 'info',
    category: 'error-handling',
    title: 'JSON.parse with no try/catch nearby',
    description: 'Bad JSON throws and can crash the flow if nothing catches it.',
    suggestion: 'Wrap in try { … } catch and show a friendly error, or validate first.',
    matchedRule: 'Line calls JSON.parse(',
  },
  (line) => /\bJSON\.parse\s*\(/.test(line)
);

registerLine(
  {
    slug: 'any_cast',
    severity: 'suggestion',
    category: 'code-quality',
    title: 'TypeScript “as any”',
    description: 'This tells TypeScript “trust me” and turns off checks for that spot.',
    suggestion: 'Tighten the type, or use unknown and narrow step by step.',
    matchedRule: 'Line uses as any',
  },
  (line) => /\bas\s+any\b/.test(line)
);

registerLine(
  {
    slug: 'open_redirect_pattern',
    severity: 'warning',
    category: 'security',
    title: 'Redirect URL built from pieces',
    description:
      'If part of the URL comes from a user (query string, form, etc.), they can send visitors to a fake site.',
    suggestion: 'Only allow redirects to URLs you trust (allow-list), not arbitrary links.',
    matchedRule: 'redirect / next + string building (+ or template)',
    serverOnly: false,
  },
  (line) =>
    (/\bnext\b/i.test(line) || /\bredirect/i.test(line)) &&
    (/\+/.test(line) || /\$\{/.test(line) || /\.concat\s*\(/.test(line))
);

function analyzeFullFileIssues(filePath, content) {
  const issues = [];
  if (!/\.(jsx?|mjs|cjs|tsx?|ts|vue)$/i.test(filePath)) return issues;

  const emptyCatchRe = /catch\s*\([^)]*\)\s*\{\s*\}/gs;
  let m;
  while ((m = emptyCatchRe.exec(content)) !== null) {
    issues.push(
      mkIssue(
        'empty_catch_block',
        filePath,
        lineAtIndex(content, m.index),
        '} // empty catch',
        'warning',
        'error-handling',
        'Empty catch { }',
        'Something went wrong but the code ignores it. Bugs and broken data can hide for a long time.',
        'At least log the error, or show the user a clear message, or rethrow if you cannot handle it.',
        'We found catch (…) { } with nothing inside the braces'
      )
    );
  }

  const hasAsyncFn = /\basync\b/.test(content);
  const hasAwait = /\bawait\b/.test(content);
  const hasCatchChain = /\bcatch\s*\(/.test(content) || /\.catch\s*\(/.test(content);

  const shouldFlagAsyncLeak = /\.(jsx?|mjs|cjs|tsx?|ts)$/i.test(filePath) && !isTestPath(filePath);

  if (  shouldFlagAsyncLeak && hasAsyncFn && hasAwait && !hasCatchChain && content.length < 280_000) {
    const lineArr = content.split(/\r?\n/);
    let asyncIdx = lineArr.findIndex((l, idx) => {
      const window = lineArr.slice(idx, Math.min(idx + 16, lineArr.length)).join('\n');
      return /\basync\b/.test(l) && /\bawait\b/.test(window);
    });
    if (asyncIdx < 0) asyncIdx = lineArr.findIndex((l) => /\basync\b/.test(l));
    const ln = asyncIdx >= 0 ? asyncIdx + 1 : 1;
    const lineSnippet = lineArr[ln - 1] || 'async …';
    issues.push(
      mkIssue(
        'async_flow_no_catch',
        filePath,
        ln || 1,
        lineSnippet,
        'warning',
        'async',
        'Missing error handling around async code',
        'This file uses async/await but never uses try/catch or .catch(…). If a promise fails, the error may bubble up unstopped.',
        'Wrap the awaited code in try { … } catch (e) { … }, or chain .catch(…) on promises so failures are handled on purpose.',
        'We scanned the whole file: it uses async/await but has no catch or .catch anywhere'
      )
    );
  }

  const setsInnerHtmlVue = /\.(vue)$/i.test(filePath) && /v-html\s*=/.test(content);
  if (setsInnerHtmlVue) {
    const ln = Math.max(
      1,
      content.split(/\r?\n/).findIndex((l) => /v-html\s*=/.test(l)) + 1
    );
    issues.push(
      mkIssue(
        'vue_raw_html_vhtml',
        filePath,
        ln,
        'v-html directive',
        'warning',
        'vue',
        'Vue v-html inserts raw HTML',
        'Same idea as dumping HTML strings into the DOM: risky if that HTML ever comes from a user or URL.',
        'Avoid v-html, or sanitize the HTML first with a trusted library.',
        'Vue template uses the v-html attribute'
      )
    );
  }

  return issues;
}

function dedupeIssues(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = `${it.filePath}:${it.lineNumber}:${it.matchedRuleSlug}:${it.title}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function runStaticRulesOnFiles(files) {
  const issues = [];

  for (const { path, content } of files) {
    if (!path || typeof content !== 'string') continue;
    issues.push(...analyzeFullFileIssues(path, content));

    const lines = content.split(/\r?\n/);
    const reactFile = isReactPath(path);
    const serverHeavy = isLikelyServerPath(path);
    const testFile = isTestPath(path);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const ln = i + 1;

      if (isRemediationNoiseLine(line)) continue;

      for (const rule of LINE_CHECKS) {
        if (rule.skipTestFiles && testFile) continue;
        if (rule.reactOnly && !reactFile) continue;
        if (rule.serverOnly && !serverHeavy && !/(server|routes)/i.test(path)) continue;

        try {
          if (!rule.test(line, path)) continue;
          issues.push(
            mkIssue(
              rule.slug,
              path,
              ln,
              line,
              rule.severity,
              rule.category,
              rule.title,
              rule.description,
              rule.suggestion,
              typeof rule.matchedRule === 'string' ? rule.matchedRule : String(rule.matchedRule)
            )
          );
        } catch {
          /* ignore rule failure */
        }
      }
    }
  }

  return dedupeIssues(issues);
}

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2, suggestion: 3 };
const ISSUE_HARD_CAP = 260;

function capAndSortIssues(issues) {
  return [...issues]
    .sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) ||
        (b.matchedRuleSlug || '').localeCompare(a.matchedRuleSlug || '')
    )
    .slice(0, ISSUE_HARD_CAP);
}

module.exports = {
  runStaticRulesOnFiles,
  capAndSortIssues,
  dedupeIssues,
};
