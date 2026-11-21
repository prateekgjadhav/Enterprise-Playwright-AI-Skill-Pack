// The pack's governance rules as AST rules (not regular expressions over text). Exceptions are honoured only for
// approved, unexpired entries in governance/waivers.yaml (rule + exact path, approver different from owner, with an
// attestation); inline eslint-disable comments are switched off in eslint.config.mjs.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseYaml } from '../scripts/lib/yaml-lite.mjs';

const ROOT = process.cwd();
const rel = (f) => relative(ROOT, f).replace(/\\/g, '/');
let WAIVERS = null;
export function waivers() {
  if (WAIVERS) return WAIVERS;
  const p = join(ROOT, 'governance/waivers.yaml');
  const list = existsSync(p) ? parseYaml(readFileSync(p, 'utf8')).waivers ?? [] : [];
  const now = Date.now();
  WAIVERS = list.filter((w) => w.rule && w.path && w.attestation && w.owner && w.approver && w.owner !== w.approver && Date.parse(w.expires) > now);
  return WAIVERS;
}
export const resetWaivers = () => { WAIVERS = null; };
const waived = (ruleId, file) => waivers().some((w) => w.rule === `qa/${ruleId}` && w.path === rel(file));

const str = (n) => (n?.type === 'Literal' && typeof n.value === 'string' ? n.value : n?.type === 'TemplateLiteral' && n.expressions.length === 0 ? n.quasis[0].value.cooked : null);
const calleeName = (n) => (n.callee?.type === 'MemberExpression' && n.callee.property?.type === 'Identifier' ? n.callee.property.name : n.callee?.type === 'Identifier' ? n.callee.name : '');
const isSpec = (f) => /\.(spec|test)\.[cm]?[jt]sx?$/.test(f);

function rule(id, description, create) {
  return {
    meta: { type: 'problem', docs: { description }, schema: [] },
    create(ctx) {
      const file = ctx.filename ?? ctx.getFilename();
      if (waived(id, file)) return {};
      return create({ report: (node, message) => ctx.report({ node, message }), file, source: ctx.sourceCode ?? ctx.getSourceCode() });
    },
  };
}

function pagePaths() {
  const dir = join(ROOT, 'src/pages'); const out = new Map();
  const visit = (d) => { if (!existsSync(d)) return; for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) visit(p); else if (/\.ts$/.test(n)) for (const m of readFileSync(p, 'utf8').matchAll(/readonly\s+path\s*(?::\s*\w+\s*)?=\s*['"`]([^'"`]+)['"`]/g)) out.set(m[1], [...(out.get(m[1]) ?? []), rel(p)]); } };
  visit(dir); return out;
}

const SENSITIVE_KEY = /^(pass(word)?|pwd|secret|token|api[-_]?key|client[-_]?secret|auth)$/i;
const SENSITIVE_VALUE = /^(eyJ[\w-]+\.[\w-]+\.[\w-]+|(?:\d[ -]?){13,19}|[^\s@]+@(?!example\.(com|org|net|test)\b)[^\s@]+\.[a-z]{2,})$/i;

export const rules = {
  'no-xpath': rule('no-xpath', 'XPath locators are forbidden', ({ report }) => ({
    CallExpression(n) {
      const s = str(n.arguments?.[0]);
      if (['locator', '$', '$$', 'waitForSelector'].includes(calleeName(n)) && s && /^\s*(xpath=|\/\/|\(\/\/|\.\.\/)/.test(s)) report(n, 'XPath locators are forbidden: use getByRole, getByLabel or getByTestId (locator-selection).');
    } })),
  'no-hard-wait': rule('no-hard-wait', 'No fixed waits or networkidle', ({ report }) => ({
    CallExpression(n) { if (calleeName(n) === 'waitForTimeout') report(n, 'Hard waits are forbidden: use a web-first assertion, or page.clock for time.'); },
    Literal(n) { if (n.value === 'networkidle') report(n, "'networkidle' is forbidden: assert on what the user sees."); },
  })),
  'no-new-page-object-in-spec': rule('no-new-page-object-in-spec', 'Page objects come from @fixtures', ({ report, file }) => ({
    NewExpression(n) { if (isSpec(file) && n.callee?.type === 'Identifier' && /(Page|Module|Component)$/.test(n.callee.name)) report(n, `Inject ${n.callee.name} through @fixtures instead of constructing it in a spec.`); },
  })),
  'no-absolute-url': rule('no-absolute-url', 'Navigation is baseURL-relative', ({ report }) => ({
    CallExpression(n) {
      const s = str(n.arguments?.[0]);
      if (['goto', 'get', 'post', 'put', 'patch', 'delete', 'fetch', 'head', 'waitForURL'].includes(calleeName(n)) && s && /^https?:\/\//i.test(s)) report(n, 'Absolute URLs are forbidden: use a path relative to baseURL (the allowlist decides the host).');
    } })),
  'no-hardcoded-sensitive': rule('no-hardcoded-sensitive', 'No literal credentials or personal data', ({ report, source }) => ({
    Property(n) {
      const k = n.key?.type === 'Identifier' ? n.key.name : str(n.key);
      const v = str(n.value);
      if (k && v && SENSITIVE_KEY.test(k)) report(n, `"${k}" holds a literal: use secretProvider.get('<ref>').`);
      else if (v && SENSITIVE_VALUE.test(v.trim())) report(n, 'A literal token, card number or real e-mail address: use a data factory or the secret provider.');
    },
    CallExpression(n) {
      const v = str(n.arguments?.[1]);
      if (['fill', 'type', 'pressSequentially'].includes(calleeName(n)) && v && /pass|secret|token|pin\b|otp/i.test(source.getText(n.arguments[0]))) report(n, 'A sensitive field is filled with a literal: use secretProvider.get().');
    },
  })),
  'require-tags': rule('require-tags', 'Exactly one priority tag per test', ({ report, file, source }) => ({
    CallExpression(n) {
      if (!isSpec(file) || n.callee?.type !== 'Identifier' || n.callee.name !== 'test') return;
      if (n.arguments.length < 2) return;
      const opts = n.arguments.find((a) => a.type === 'ObjectExpression');
      const tag = opts?.properties?.find((p) => p.key?.name === 'tag');
      const text = `${str(n.arguments[0]) ?? ''} ${tag ? source.getText(tag.value) : ''}`;
      const pri = (text.match(/@P[012]\b/g) ?? []).length;
      if (pri !== 1) report(n, `A test needs exactly one of @P0, @P1, @P2 (found ${pri}).`);
    } })),
  'no-focused-or-skipped': rule('no-focused-or-skipped', 'No only, skip or fixme without a waiver', ({ report }) => ({
    CallExpression(n) {
      const c = n.callee;
      if (c?.type === 'MemberExpression' && ['only', 'skip', 'fixme'].includes(c.property?.name)) {
        const obj = c.object?.type === 'Identifier' ? c.object.name : c.object?.type === 'MemberExpression' ? c.object.object?.name : '';
        if (obj === 'test' || obj === 'describe') report(n, `test.${c.property.name} needs an approved waiver in governance/waivers.yaml.`);
      }
    } })),
  'unique-route': rule('unique-route', 'One page object per route', ({ report, file }) => ({
    PropertyDefinition(n) {
      if (n.key?.name !== 'path' || !str(n.value) || !rel(file).startsWith('src/pages/')) return;
      const owners = pagePaths().get(str(n.value)) ?? [];
      if (owners.length > 1) report(n, `Route "${str(n.value)}" has more than one page object: ${owners.join(', ')}.`);
    } })),
  'unique-mock-route': rule('unique-mock-route', 'One handler per route pattern per file', ({ report }) => {
    const seen = new Set();
    return { CallExpression(n) { const s = str(n.arguments?.[0]); if (calleeName(n) === 'route' && s) { if (seen.has(s)) report(n, `Duplicate route handler for ${s}.`); seen.add(s); } } };
  }),
  'no-page-field-initialiser': rule('no-page-field-initialiser', 'Initialise locators in the constructor', ({ report }) => ({
    PropertyDefinition(n) {
      let hit = false;
      const walk = (x) => { if (!x || typeof x !== 'object' || hit) return; if (x.type === 'MemberExpression' && x.object?.type === 'ThisExpression') { hit = true; return; } for (const [k, v] of Object.entries(x)) if (k !== 'parent') Array.isArray(v) ? v.forEach(walk) : walk(v); };
      walk(n.value);
      if (hit) report(n, 'A field initialiser reads `this.…`: with useDefineForClassFields it runs before the constructor parameter is assigned. Assign it in the constructor.');
    } })),
};

export default { meta: { name: 'qa' }, rules };
