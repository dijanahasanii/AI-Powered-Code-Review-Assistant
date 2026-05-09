'use strict';

/**
 * Walk unified diff — one entry per added line with approximate new-file line number.
 * @returns {{ filePath: string, lineNumber: number, text: string }[]}
 */
function iterateAddedLines(diffText) {
  const out = [];
  const blocks = String(diffText || '').split(/\n(?=diff --git )/);

  for (let b = 0; b < blocks.length; b += 1) {
    let block = blocks[b];
    if (b > 0) block = `diff --git ${block}`;

    const head = block.match(/^diff --git (?:a\/[^\s]+\s+)?b\/([^\n]+)/m);
    if (!head) continue;
    const filePath = head[1].split('\t')[0].trim();

    const lines = block.split('\n');
    let newLineCursor = null;

    for (let i = 0; i < lines.length; i += 1) {
      const row = lines[i];
      const at = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(row);
      if (at) {
        newLineCursor = Number(at[1]);
        continue;
      }
      if (newLineCursor == null) continue;

      if (row.startsWith('+') && !row.startsWith('+++')) {
        out.push({
          filePath,
          lineNumber: newLineCursor,
          text: row.slice(1),
        });
        newLineCursor += 1;
      } else if (row.startsWith(' ')) {
        newLineCursor += 1;
      }
    }
  }

  return out;
}

function clipSnippet(text, maxLen = 420) {
  const s = String(text || '')
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n ')
    .trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 3)}...`;
}

module.exports = { iterateAddedLines, clipSnippet };
