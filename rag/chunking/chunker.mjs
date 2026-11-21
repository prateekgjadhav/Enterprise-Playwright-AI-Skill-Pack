// Semantic, parent-child chunking. Children are what retrieval scores; the parent (the whole document's
// title and summary) is what the context pack adds once per document, so a hit on one acceptance criterion
// still arrives with the story it belongs to (Epic → Story → AC).
//   markdown   split at heading boundaries (requirement, business-flow, architecture sections), then paragraphs
//   specs      one child per test() block, the describe title as the heading
//   records    one child per record (defects, findings, executions)
import { estimateTokens } from '../lib/util.mjs';

const ACL_MARK = /<!--\s*acl:\s*([^>]+?)\s*-->/i;

function splitLong(text, maxTokens, overlapTokens) {
  if (estimateTokens(text) <= maxTokens) return [text];
  const paras = text.split(/\n{2,}/);
  const out = [];
  let cur = '';
  for (const p of paras) {
    if (cur && estimateTokens(cur + '\n\n' + p) > maxTokens) {
      out.push(cur);
      const tail = cur.slice(-overlapTokens * 4);
      cur = tail + '\n\n' + p;
    } else cur = cur ? cur + '\n\n' + p : p;
  }
  if (cur) out.push(cur);
  // a single paragraph that is still too long is cut at sentence boundaries
  return out.flatMap((c) => (estimateTokens(c) <= maxTokens * 1.5 ? [c] : c.match(new RegExp(`[\\s\\S]{1,${maxTokens * 4}}(?:[.!?]\\s|$)`, 'g')) ?? [c]));
}

function markdownSections(body) {
  const lines = body.split('\n');
  const sections = [];
  let cur = { heading: null, lines: [] };
  for (const line of lines) {
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h && h[1].length <= 3) {
      if (cur.lines.join('').trim()) sections.push(cur);
      cur = { heading: h[2].trim(), lines: [] };
    } else cur.lines.push(line);
  }
  if (cur.lines.join('').trim()) sections.push(cur);
  return sections.map((s) => ({ heading: s.heading, text: s.lines.join('\n').trim() }));
}

function specBlocks(src) {
  const blocks = [];
  const describe = /test\.describe(?:\.\w+)?\(\s*(['"`])(.*?)\1/.exec(src)?.[2] ?? null;
  const re = /\btest(?:\.(?:only|skip|fixme|fail|slow))?\(\s*(['"`])(.*?)\1/g;
  const starts = [...src.matchAll(re)].map((m) => ({ index: m.index, title: m[2] }));
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1].index : src.length;
    blocks.push({ heading: describe ? `${describe} › ${starts[i].title}` : starts[i].title, text: src.slice(starts[i].index, end).trim(), testTitle: starts[i].title });
  }
  return blocks.length ? blocks : [{ heading: describe, text: src }];
}

/** Chunk one normalised document into child chunks. */
export function chunkDocument(doc, opts = {}) {
  const { maxTokens = 350, overlapTokens = 40, strategy = 'semantic' } = opts;
  let pieces;
  if (doc.format === 'markdown' && strategy === 'semantic') pieces = markdownSections(doc.text);
  else if (doc.type === 'test') pieces = specBlocks(doc.text);
  else pieces = [{ heading: null, text: doc.text }];

  const chunks = [];
  for (const p of pieces) {
    const aclMark = ACL_MARK.exec(p.text);
    const chunkAcl = aclMark ? aclMark[1].split(',').map((s) => s.trim()) : null;
    const text = p.text.replace(ACL_MARK, '').trim();
    if (!text) continue;
    for (const part of splitLong(text, maxTokens, overlapTokens)) {
      const n = chunks.length;
      chunks.push({
        id: `${doc.id}#${n}`,
        docId: doc.id,
        parentId: doc.id,
        heading: p.heading,
        testTitle: p.testTitle ?? null,
        text: p.heading ? `${p.heading}\n${part}` : part,
        acl: chunkAcl ?? doc.acl,          // a chunk marker narrows the document ACL
        tokens: estimateTokens(part),
      });
    }
  }
  return chunks;
}

/** The parent context shown once per document in a context pack. */
export function parentSummary(doc, maxChars = 420) {
  const firstPara = String(doc.text).replace(/^#.*$/m, '').trim().split(/\n{2,}/)[0] ?? '';
  return `${doc.title}${doc.meta?.parent ? ` (part of ${doc.meta.parent})` : ''}: ${firstPara.slice(0, maxChars)}`;
}
