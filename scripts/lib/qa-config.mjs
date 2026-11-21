// The one loader and validator for .agents/qa.config.json. Playwright (through src/config/load.ts), the
// validate-config script, the policy input builder and the managed hooks all use it, so the rules cannot drift.
// It fails closed: an unconfigured file (no environments) is an error, never a fallback to some default host.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkTarget, PRODUCTION_LIKE } from '../../rag/lib/targets.mjs';

const DATA_CLASSES = ['public', 'internal', 'confidential'];
const PROVIDERS = ['ci-env', 'vault', 'aws-sm', 'gcp-sm', 'azure-kv', '1password'];
const DAY = 86400000;

export function readQaConfig(root = process.cwd()) {
  return JSON.parse(readFileSync(join(root, '.agents', 'qa.config.json'), 'utf8'));
}

/** Every problem with the configuration, as strings. An empty list means the configuration is usable. */
export function validateQaConfig(cfg, { now = Date.now() } = {}) {
  const errors = [];
  const e = (m) => errors.push(m);
  if (!cfg || typeof cfg !== 'object') return ['qa.config.json is not an object'];
  if (!cfg.project?.name) e('project.name is empty (run repo-discovery, then config-proposal)');
  if (!Array.isArray(cfg.project?.owners) || !cfg.project.owners.length) e('project.owners is empty');
  const envs = Array.isArray(cfg.environments) ? cfg.environments : [];
  if (!envs.length) e('environments is empty: no host may be targeted until an environment is approved');
  const seen = new Set();
  for (const [i, env] of envs.entries()) {
    const id = env?.name || `environments[${i}]`;
    for (const k of ['name', 'owner', 'ticket', 'dataClass', 'reviewBy']) if (!env?.[k]) e(`${id}.${k} is missing`);
    if (env?.name && !/^[a-z0-9-]+$/.test(env.name)) e(`${id}.name must be lowercase letters, digits and hyphens`);
    if (seen.has(env?.name)) e(`${id} is listed twice`); seen.add(env?.name);
    if (env?.dataClass && !DATA_CLASSES.includes(env.dataClass)) e(`${id}.dataClass must be one of ${DATA_CLASSES.join(', ')} (restricted data is never a test target)`);
    if (!Array.isArray(env?.hosts) || !env.hosts.length) e(`${id}.hosts is empty`);
    for (const h of env?.hosts ?? []) {
      if (typeof h !== 'string' || !h.trim() || /[*/:\s]/.test(h)) e(`${id}: "${h}" is not a bare hostname (no scheme, port, path or wildcard)`);
      else if (PRODUCTION_LIKE.test(h)) e(`${id}: ${h} looks like a production host`);
      else if (/(^|\.)demoqa\.com$|(^|\.)example\.(com|org|net)$/i.test(h)) e(`${id}: ${h} is a public demo or placeholder host`);
      else if ((cfg.productionHosts ?? []).some((p) => h === p || h.endsWith('.' + p))) e(`${id}: ${h} is under a production host`);
    }
    if (env?.reviewBy) {
      const t = Date.parse(env.reviewBy);
      if (Number.isNaN(t)) e(`${id}.reviewBy is not a date`);
      else if (t < now) e(`${id}.reviewBy (${env.reviewBy}) has passed: renew it through environment-allowlist`);
      else if (t - now > 90 * DAY) e(`${id}.reviewBy is more than 90 days ahead`);
    }
  }
  if (envs.length && !envs.some((x) => x?.name === cfg.defaultEnvironment)) e('defaultEnvironment must name one of the environments');
  const fw = cfg.framework ?? {};
  if (fw.fixturesImport !== '@fixtures') e('framework.fixturesImport must be "@fixtures"');
  if (JSON.stringify(fw.priorityTags) !== JSON.stringify(['@P0', '@P1', '@P2'])) e('framework.priorityTags must be ["@P0","@P1","@P2"]');
  if (!Array.isArray(fw.roles) || !fw.roles.length) e('framework.roles is empty: list the roles the setup project signs in as');
  if (!PROVIDERS.includes(cfg.secrets?.provider)) e(`secrets.provider must be one of ${PROVIDERS.join(', ')}`);
  for (const r of fw.roles ?? []) if (!cfg.secrets?.refs?.[r]) e(`secrets.refs.${r} is missing (a reference name, never a value)`);
  for (const [k, v] of Object.entries(cfg.secrets?.refs ?? {})) if (typeof v !== 'string' || /\s/.test(v) || v.length > 200) e(`secrets.refs.${k} must be a reference name, not a value`);
  if (cfg.telemetry?.captureContent !== false) e('telemetry.captureContent must be false');
  for (const s of cfg.skills?.enabled ?? []) if (!s?.name || !s?.attestation) e('skills.enabled entries need a name and an attestation');
  return errors;
}

/** Load, validate and return the configuration with helpers. Throws with every error when it is not usable. */
export function loadQaConfig(root = process.cwd(), { envName = process.env.QA_ENV } = {}) {
  const cfg = readQaConfig(root);
  const errors = validateQaConfig(cfg);
  if (errors.length) throw new Error(`qa.config.json is not usable:\n  - ${errors.join('\n  - ')}`);
  const env = cfg.environments.find((x) => x.name === (envName || cfg.defaultEnvironment));
  if (!env) throw new Error(`QA_ENV "${envName}" is not one of the environments`);
  return {
    ...cfg,
    env,
    baseUrl: `https://${env.hosts[0]}`,
    isAllowedUrl: (url) => {
      if (/^(data|blob|about):/i.test(url)) return true;
      return checkTarget(url, cfg).ok;
    },
  };
}
