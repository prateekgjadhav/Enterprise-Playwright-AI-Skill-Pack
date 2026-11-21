---
name: multi-role-auth
description: >-
  Generates a role-by-action matrix of allow and deny tests across the configured roles, asserting
  both that the UI hides what a role may not do and that the API refuses it. Use whenever a feature
  has permissions, roles or ownership rules, or someone asks who can do what, or someone asks to test
  that only admins or certain roles can do something, or for a permission matrix. Not for signing in
  and storing state (auth-setup-project), attacking authorisation with tampered requests
  (authz-session-testing), or designing scenarios (scenario-design).
allowed-tools: Read Grep Glob Edit(tests/**) Write(tests/**) Bash(npx tsc --noEmit)
---

# Multi-role authorisation tests

Every cell of the permission matrix is a test.

## Non-negotiables
- Use only roles in `framework.roles` with synthetic accounts.
- Assert denial on both the UI and the API (403/404 as the product defines).
- Never escalate roles at run time.

## Inputs and outputs
- **In:** the permission model; the roles
- **Out:** a parameterised spec covering every role and action

## Procedure
1. Build the matrix from the requirement.
2. Use one project per role (storage state) or `browser.newContext({ storageState })` per role.
3. Write allow and deny assertions per cell.
4. Typecheck and list.

## Verify
- cells tested = roles × actions

## Evidence
Add to the evidence block: matrix coverage. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Every role and action combination is asserted.
