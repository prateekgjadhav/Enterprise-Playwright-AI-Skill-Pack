// Loads .claude/qa.config.json and fills every RAG-layer setting with a safe default, so the engine runs
// on a repository whose config has no "rag" block yet. Project values live in the config, never in code.
import { join, resolve } from 'node:path';
import { readJson } from './util.mjs';
import { allowedHostsOf } from './targets.mjs';

export const DEFAULT_SOURCES = [
  { collection: 'requirements', type: 'requirement', include: ['requirements/**/*.md', 'docs/requirements/**/*.md', 'knowledge/requirements/**/*.{md,json}'] },
  { collection: 'test-plans', type: 'test-plan', include: ['knowledge/test-plans/**/*.md', 'tests/**/test-plan.md'] },
  { collection: 'test-cases', type: 'test-case', include: ['knowledge/test-cases/**/*.{md,json,jsonl}'] },
  { collection: 'tests', type: 'test', include: ['tests/**/*.spec.ts', 'tests/**/*.spec.js', 'tests/**/*.feature', 'features/**/*.feature'] },
  { collection: 'pages', type: 'page', include: ['src/pages/**/*.ts'] },
  { collection: 'modules', type: 'module', include: ['src/modules/**/*.ts'] },
  { collection: 'executions', type: 'execution', include: ['reports/results.json', 'test-results/results.json', 'knowledge/executions/**/*.json'] },
  { collection: 'defects', type: 'defect', include: ['knowledge/defects/**/*.{md,json,jsonl}'] },
  { collection: 'rca', type: 'rca', include: ['knowledge/rca/**/*.{md,json}'] },
  { collection: 'patterns', type: 'pattern', include: ['knowledge/patterns/**/*.md'] },
  { collection: 'decisions', type: 'decision', include: ['knowledge/decisions/**/*.md', 'docs/adr/**/*.md'] },
  { collection: 'security-findings', type: 'finding', include: ['security/findings/**/*.{json,jsonl}'] },
  { collection: 'pipelines', type: 'pipeline', include: ['.github/workflows/*.{yml,yaml}', '.gitlab-ci.yml', 'azure-pipelines.yml'],
    exclude: ['.github/workflows/{ci,release,approve,knowledge-reindex,update-baselines}.yml'] },   // the pack's own workflows are not project knowledge
];

export const DEFAULTS = {
  strategy: 'hybrid',                     // hybrid | vector | bm25
  indexDir: '.claude/rag-index',
  sources: DEFAULT_SOURCES,
  exclude: ['**/*.min.js', '**/node_modules/**'],
  chunking: { strategy: 'semantic', maxTokens: 350, overlapTokens: 40, parentChild: true },
  embeddings: { provider: 'local-hash', model: 'local-hash', dim: 384, endpoint: null, apiKeyEnv: null, batchSize: 64 },
  vectorStore: { provider: 'local', url: null, collection: 'qa-knowledge', apiKeyEnv: null },
  retrieval: { k: 8, candidates: 40, weights: { bm25: 1.0, vector: 1.0, graph: 0.8 }, rrfK: 60, multiHop: true, maxHops: 3 },
  reranker: { provider: 'lexical-cross', model: null, endpoint: null, apiKeyEnv: null, topN: 8 },
  compression: { enabled: true, budgetTokens: 2400, sentenceKeepRatio: 0.6, dedupeThreshold: 0.8 },
  graph: { enabled: true },
  memory: { enabled: true, dir: '.claude/memory', staleAfterDays: 180 },
  security: {
    redactPII: true, allowDomains: ['example.com', 'example.org', 'example.net', 'test'],
    injectionScan: true, quarantineFlagged: true, minTrust: 0.35, freshnessHalfLifeDays: 365,
    encryption: { enabled: false, keyEnv: 'QA_RAG_INDEX_KEY' },
    acl: { defaultPrincipals: ['*'], principalsEnv: 'QA_RAG_PRINCIPALS', rules: [] },
  },
  telemetry: { enabled: true, aiOpsLog: '.claude/telemetry/ai-ops.jsonl', maxBytes: 10485760, costPer1kTokensUsd: 0.003 },
};

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
export function deepMerge(base, over) {
  if (!isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base?.[k]) ? deepMerge(base[k], v) : v;
  return out;
}

/** The full effective config. `root` is the repository root (the folder holding .claude/). */
export function loadConfig(root = process.cwd()) {
  const abs = resolve(root);
  const qa = readJson(join(abs, '.claude/qa.config.json'), {}) ?? {};
  const rag = deepMerge(DEFAULTS, qa.rag ?? {});
  return {
    root: abs,
    qa,
    rag,
    gates: { knowledgeWrite: 'ask', ...(qa.gates ?? {}) },
    aiGates: qa.aiGates ?? {},
    productionHosts: qa.productionHosts ?? [],
    allowedHosts: allowedHostsOf(qa),
    paths: {
      index: join(abs, rag.indexDir, 'index.json'),
      indexEnc: join(abs, rag.indexDir, 'index.json.enc'),
      embedCache: join(abs, rag.indexDir, 'embedding-cache.json'),
      memory: join(abs, rag.memory.dir),
      aiOps: rag.telemetry.aiOpsLog ? join(abs, rag.telemetry.aiOpsLog) : null,
    },
  };
}
