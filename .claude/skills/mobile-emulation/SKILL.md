---
name: mobile-emulation
description: >-
  Adds device projects from Playwright's device registry and touch interactions for responsive
  layouts, viewports, orientation and mobile-only behaviour. Use whenever someone asks for mobile,
  tablet, responsive or touch tests. Not for real-device testing claims, visual baselines
  (visual-snapshot-authoring), or performance (performance-vitals).
allowed-tools: Read Grep Glob Edit(playwright.config.ts) Edit(tests/**) Bash(npx playwright test --list)
---

# Mobile emulation

Emulation proves layout and input handling, not device hardware.

## Non-negotiables
- Never claim real-device coverage from emulation.
- Tag mobile tests `@mobile` so they run in the device projects only.

## Inputs and outputs
- **In:** the device list
- **Out:** device projects and specs

## Procedure
1. Add projects with `devices['Pixel 7']`, `devices['iPhone 15']` and so on.
2. Use `tap` and viewport-specific locators.
3. List the projects.

## Verify
- `npx playwright test --list` shows the device projects

## Evidence
Add to the evidence block: devices covered. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Responsive behaviour is asserted on the agreed devices.
