---
name: clock-time-control
description: >-
  Tests time-dependent behaviour — expiry, countdowns, schedules, time zones — with page.clock
  (install, setFixedTime, runFor, fastForward) instead of sleeps. Use whenever behaviour depends on
  the current time, a test waits for a timer, or a flaky test depends on when it runs, or a test must
  check what happens after minutes or hours pass, such as expiry after 30 minutes, at midnight or in
  another timezone. Not for mocking network calls (network-mocking), fixing flaky tests in general
  (flake-triage), or performance timing (performance-vitals).
allowed-tools: Read Grep Glob Edit(tests/**) Bash(npx tsc --noEmit)
---

# Clock and time control

Control time; never wait for it.

## Non-negotiables
- Never `waitForTimeout`; install the clock before navigation.
- Set an explicit time zone and locale for the test when they matter.

## Inputs and outputs
- **In:** the time rule
- **Out:** a spec using `page.clock`

## Procedure
1. `await page.clock.install({ time: new Date('2026-01-01T09:00:00Z') })` before `goto`.
2. Advance with `runFor` or `fastForward`, or pin with `setFixedTime`.
3. Assert the visible outcome with web-first assertions.

## Verify
- `no-hard-wait` passes
- the test passes three times

## Evidence
Add to the evidence block: clock API used. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- The test is deterministic regardless of when it runs.
