---
name: aria-snapshot-testing
description: >-
  Asserts page and component structure with toMatchAriaSnapshot — roles, names, hierarchy — where
  layout pixels do not matter, using partial matching and regular expressions for dynamic text. Use
  whenever structure, headings, landmarks or menu contents must be locked down, or a visual test is
  too brittle for what it checks. Not for pixel comparisons (visual-snapshot-authoring), WCAG rule
  audits (accessibility-audit), or locator choice (locator-selection).
allowed-tools: Read Grep Glob Edit(tests/**) Bash(npx tsc --noEmit)
---

# ARIA snapshot testing

Lock the structure the user and assistive technology rely on, not the pixels.

## Non-negotiables
- Snapshot meaningful regions, never whole pages with volatile content.
- Never include personal data in a snapshot; use regular expressions for dynamic values.

## Inputs and outputs
- **In:** the region locator
- **Out:** ARIA snapshot assertions

## Procedure
1. Capture the region's snapshot from a passing run.
2. Trim it to the stable structure; replace dynamic text with `/regex/`.
3. Assert with `await expect(region).toMatchAriaSnapshot(...)`.

## Verify
- passes in Chromium, Firefox and WebKit

## Evidence
Add to the evidence block: regions asserted. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Structure is locked and stable across the three engines.
