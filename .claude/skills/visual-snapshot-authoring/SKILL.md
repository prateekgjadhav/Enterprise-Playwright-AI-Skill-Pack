---
name: visual-snapshot-authoring
description: >-
  Adds toHaveScreenshot assertions for pages and components with masks for dynamic regions and
  animations disabled, with baselines generated only inside the pinned runner image so they are
  reproducible. Use whenever someone asks for visual regression tests, pixel comparisons or screenshot
  checks of a page or component. Not for accepting changed baselines (visual-baseline-approval),
  structural checks without pixels (aria-snapshot-testing), or accessibility (accessibility-audit), or
  updating snapshots after an intended change (visual-baseline-approval).
allowed-tools: Read Grep Glob Edit(tests/visual/**) Write(tests/visual/**) Bash(npx tsc --noEmit)
---

# Visual snapshot authoring

Compare pixels only where pixels are the requirement, and mask everything that is not.

## Non-negotiables
- Never run `--update-snapshots` locally or in an authoring session; baselines come from the pinned image through `visual-baseline-approval`.
- Mask dates, prices, avatars, ads and any personal data.
- Screenshots are binary: keep test data synthetic, because the scrubber cannot redact pixels.

## Inputs and outputs
- **In:** the page or component; its dynamic regions
- **Out:** visual specs under `tests/visual/`

## Procedure
1. Stabilise: fixed viewport, `animations: 'disabled'`, fonts loaded, clock installed if time shows.
2. Assert `await expect(region).toHaveScreenshot({ mask: [...] })` per meaningful region.
3. Tag `@visual`; baselines are created by the CI job in the pinned image.

## Verify
- the spec is listed
- a CI run produces a match or a diff

## Evidence
Add to the evidence block: regions and masks. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Visual checks are stable, masked and reproducible.
