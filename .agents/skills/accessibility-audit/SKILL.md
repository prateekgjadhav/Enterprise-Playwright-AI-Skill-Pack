---
name: accessibility-audit
description: >-
  Runs axe-core WCAG 2.2 AA checks through @axe-core/playwright on allowlisted pages and flows, fails
  on serious and critical violations and reports each by rule, impact and element. Use whenever
  someone asks for accessibility, WCAG, screen reader or keyboard checks, or an accessibility
  regression must be caught in CI. Not for structural snapshots (aria-snapshot-testing), visual
  comparisons (visual-snapshot-authoring), or manual usability review.
allowed-tools: Read Grep Glob Edit(tests/a11y/**) Write(tests/a11y/**) Bash(npx playwright test --grep @a11y:*)
---

# Accessibility audit

Automated checks catch a share of issues reliably; report them precisely and never hide one.

## Non-negotiables
- Never disable an axe rule globally; a known issue needs a waiver with a ticket and expiry.
- Run only against allowlisted environments.

## Inputs and outputs
- **In:** pages and flows
- **Out:** a11y specs tagged `@a11y` and a violations report

## Procedure
1. Scan each page and each meaningful state (dialogs open, menus expanded) with `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa'])`.
2. Fail on `serious` and `critical`; report `moderate` and `minor`.
3. Attach the JSON result to the test; summarise by rule.

## Verify
- `npx playwright test --grep @a11y` exits 0 or reports violations with elements

## Evidence
Add to the evidence block: violations by impact. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- No serious or critical violation without a registered waiver.
