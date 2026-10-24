---
name: secrets-detection
description: >-
  Detects hard-coded secrets (API keys, tokens, passwords, private keys, connection strings) in the
  repository and its git history and wires prevention into pre-commit and CI, for code the team
  owns: scanning with gitleaks / detect-secrets / trufflehog, reporting findings by location and
  type without ever printing the secret value, maintaining a reviewed baseline, and guiding
  rotation. Covers OWASP A05 and the leakage side of A02. Use whenever the user asks to find or
  scan for secrets, hard-coded credentials, leaked keys, pre-commit secret hooks, or history
  cleanup. Not for dependency CVEs (dependency-vulnerability-audit), runtime headers
  (security-headers-review), or cloud key policy (cloud-security-review). Never reads `.env*` to
  print its contents and never echoes a detected value.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Secrets detection

Keep credentials out of the codebase, and out of its history. The whole skill operates on
*presence and location* — it flags that a secret exists and where, never what it is.

## Non-negotiables
- Operate only on repositories the team owns.
- **Never print, log or store a detected secret value**, in output, tickets or evidence. Report `path:line`, the rule/type, and a short redacted fingerprint only. This matches the repo rule: never read `.env*`, never print credentials.
- A detected real secret is an incident: report it with restricted visibility and treat it as compromised — rotation is required even after removal, because history and logs persist.
- Prevention (pre-commit + CI) ships alongside detection; a scan without a gate just finds the next leak later.

## What to scan and how
| Scope | Tool / method | Note |
|---|---|---|
| Working tree | `gitleaks detect --no-git` or `detect-secrets scan` | fast local pass |
| Full history | `gitleaks detect` (walks commits) | leaks often live in old commits |
| Pre-commit | `gitleaks protect --staged` via a hook | blocks the leak before it lands |
| CI | scan job on every PR, fail on new findings vs the baseline | the enforcement point |
| High-risk patterns | private keys, cloud keys, bearer tokens, `postgres://user:pass@…`, `.pem`, `.pfx` | tune rules to the stack |

## Templates
```yaml
# @skill-example: fragment — .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.21.2
    hooks:
      - id: gitleaks            # runs `gitleaks protect --staged`; blocks commits containing secrets
```
```yaml
# @skill-example: fragment — .github/workflows security job (add to the existing Security stage)
secrets-scan:
  runs-on: ubuntu-latest
  permissions: { contents: read }
  steps:
    - uses: actions/checkout@v5
      with: { fetch-depth: 0 }                 # full history for a complete scan
    - uses: gitleaks/gitleaks-action@v2        # pin to a SHA per ci-cd-pipeline-config
      env: { GITLEAKS_ENABLE_UPLOAD_ARTIFACT: "false" }   # do not upload anything containing matches
```

## Procedure
1. Run a working-tree scan, then a full-history scan; collect findings as `path:line` + rule + redacted fingerprint.
2. Triage each: true positive (rotate + remove), test/sample value (allowlist with a reason in the baseline), or false positive (tune the rule).
3. For true positives: rotate the credential at its source first, then remove from the tree; note that history rewrite (`git filter-repo`) is a separate, coordinated action — flag it, do not run it unprompted.
4. Install the pre-commit hook and the CI job; fail CI on new findings vs the reviewed baseline.
5. Record findings (redacted) with restricted visibility; recommend moving secrets to the CI/secret store or a vault, referenced by name only.

## Definition of Done
- Working-tree and history scanned; findings listed by location and type, values redacted.
- Pre-commit hook and CI gate in place with a reviewed baseline.
- Every true positive has a rotation action; nothing sensitive printed or uploaded.
