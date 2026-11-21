export interface Environment { name: string; owner: string; ticket: string; dataClass: 'public' | 'internal' | 'confidential'; hosts: string[]; reviewBy: string }
export interface QaConfig {
  project: { name: string; owners: string[] };
  environments: Environment[];
  defaultEnvironment: string;
  productionHosts?: string[];
  framework: { testIdAttribute: string; fixturesImport: '@fixtures'; priorityTags: string[]; suiteTags?: string[]; roles: string[]; [k: string]: unknown };
  secrets: { provider: 'ci-env' | 'vault' | 'aws-sm' | 'gcp-sm' | 'azure-kv' | '1password'; refs: Record<string, string> };
  [k: string]: unknown;
}
export interface LoadedQaConfig extends QaConfig { env: Environment; baseUrl: string; isAllowedUrl(url: string): boolean }
export function readQaConfig(root?: string): QaConfig;
export function validateQaConfig(cfg: unknown, opts?: { now?: number }): string[];
export function loadQaConfig(root?: string, opts?: { envName?: string }): LoadedQaConfig;
