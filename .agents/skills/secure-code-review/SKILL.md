---
name: secure-code-review
description: >-
  Source-level security review of code the team owns: spot vulnerable patterns across the OWASP /
  CWE classes (injection, XSS, access control, SSRF, deserialisation, secrets, crypto misuse) and
  give the concrete fix, backed by SAST (CodeQL / Semgrep) wired into CI. Use whenever the user
  asks for a secure code review, to review a diff or module for security, to find insecure patterns
  or anti-patterns, to add SAST/static security analysis, or for remediation guidance on a
  vulnerability class. Not for runtime behaviour checks (the focused *-review skills), dependency
  CVEs (dependency-vulnerability-audit), or design-level review (security-architecture-review). It
  identifies and fixes weaknesses in the team's own code; it does not produce exploits.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Secure code review

Find the root cause the runtime checks only hint at, and fix it in the source. The review is
pattern-and-remediation focused: what the weakness looks like, why it is unsafe, and the safe
replacement — never a working exploit.

## Non-negotiables
- Review only code the team owns; keep findings and any sensitive snippets at restricted visibility.
- Describe the *vulnerable pattern* and its *fix*; do not write payloads, exploit chains, or proof-of-concept attacks. Pair with SAST so rules catch regressions, not memory.
- Each finding cites the class (OWASP/CWE), the location, the risk, and a specific remediation; prefer safe-by-default APIs over hand-rolled checks.
- Confirm fixes with a test: route runtime verification to the matching `*-review` skill.

## What to look for → fix
| Class (OWASP/CWE) | Smell in code | Fix |
|---|---|---|
| Injection (CWE-89/78) | string-built SQL/queries/commands from input | parameterised queries / safe APIs; never concatenate input |
| XSS (CWE-79) | unescaped interpolation into HTML; `dangerouslySetInnerHTML`/`innerHTML` with input | context-aware output encoding; auto-escaping templates; CSP |
| Broken access control (CWE-285/639) | authz decided client-side; object id trusted from request | server-side authz on every request; ownership checks |
| SSRF (CWE-918) | server fetches a user-supplied URL unvalidated | allow-list destinations; block internal ranges + metadata IP |
| Deserialisation / integrity (CWE-502) | untrusted data deserialised; unverified updates | avoid native deser of untrusted input; verify signatures |
| Secrets (CWE-798) | keys/passwords/connection strings in code | externalise to a secret store; rotate exposed values |
| Crypto misuse (CWE-327/330) | weak/legacy algorithms; predictable randomness; home-grown crypto | current standard algorithms; CSPRNG; vetted libraries |
| Error handling (CWE-209) | stack traces / driver names returned to users | generic errors to clients; detail only in server logs |

## Templates
```yaml
# @skill-example: fragment — add to the Security stage (ci-cd-pipeline-config)
sast:
  runs-on: ubuntu-latest
  permissions: { contents: read, security-events: write }
  steps:
    - uses: actions/checkout@v5
    - run: semgrep ci --config p/owasp-top-ten --error        # or CodeQL; fail on new findings
```
```markdown
# @skill-example: fragment — security/review/finding.md
Finding: <class, CWE-xxx>   Location: <path:line>   Severity: <CVSS>
Why unsafe: <one line, no payload>
Fix: <specific change / safe API>   Verified by: <matching *-review skill>
```

## Procedure
1. Scope the review (a diff `git diff origin/main...`, a module, or a flagged area from a runtime finding).
2. Read against the table; record each weakness as class → location → risk → fix, without payloads.
3. Add or tune SAST (CodeQL/Semgrep) so the pattern is caught automatically; gate new findings in CI.
4. Propose the safe-by-default change; open a verifying test via the matching `*-review` skill.
5. Deliver a findings table; keep sensitive detail restricted.

## Definition of Done
- Changed/targeted code reviewed against the class table; findings cite OWASP/CWE, location and fix.
- SAST wired and gating new findings; no payloads or exploits produced.
- Each confirmed issue has a remediation and a verifying test; review table delivered.
