// Vendor-neutral secret providers. Each resolves a reference (never a value) at run time through the store's own
// CLI or the CI environment, with no shell (execFile), so no SDK is bundled and no value is ever written to disk.
// CI authenticates to the store through OIDC federation before the tests start (see .github/workflows/ci.yml).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
export interface SecretProvider { get(ref: string): Promise<string> }
type Adapter = (ref: string) => Promise<string>;

const cli = (cmd: string, args: (ref: string) => string[]): Adapter => async (ref) => {
  const { stdout } = await run(cmd, args(ref), { timeout: 15000, maxBuffer: 1 << 20 });
  return stdout.replace(/\r?\n$/, '');
};

export const ADAPTERS: Record<string, Adapter> = {
  'ci-env': async (ref) => process.env[ref] ?? '',
  vault: cli('vault', (ref) => ['kv', 'get', '-field=value', ref]),
  'aws-sm': cli('aws', (ref) => ['secretsmanager', 'get-secret-value', '--secret-id', ref, '--query', 'SecretString', '--output', 'text']),
  'gcp-sm': cli('gcloud', (ref) => ['secrets', 'versions', 'access', 'latest', `--secret=${ref}`]),
  'azure-kv': cli('az', (ref) => { const [vault, name] = ref.split('/'); return ['keyvault', 'secret', 'show', '--vault-name', vault, '--name', name, '--query', 'value', '-o', 'tsv']; }),
  '1password': cli('op', (ref) => ['read', ref]),
};

export function createSecretProvider(kind: string, refs: Record<string, string>): SecretProvider {
  const adapter = ADAPTERS[kind];
  if (!adapter) throw new Error(`unknown secrets.provider "${kind}"`);
  return {
    async get(name) {
      const ref = refs[name];
      if (!ref) throw new Error(`secrets.refs.${name} is not configured`);
      return adapter(ref);
    },
  };
}
