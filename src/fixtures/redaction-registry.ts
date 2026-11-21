// Every secret value a test resolves is registered for the artifact scrubber, in a per-worker file in the runner's
// temporary directory (outside every artifact path, mode 0600). scripts/scrub-artifacts.mjs reads all of them.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = process.env.QA_REDACTION_DIR || process.env.RUNNER_TEMP || tmpdir();
const file = join(dir, `qa-redaction-${process.pid}.json`);

export function registerForRedaction(value: string): void {
  if (!value || value.length < 4) return;
  const values: string[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).values : [];
  if (!values.includes(value)) values.push(value);
  writeFileSync(file, JSON.stringify({ values }), { mode: 0o600 });
}
