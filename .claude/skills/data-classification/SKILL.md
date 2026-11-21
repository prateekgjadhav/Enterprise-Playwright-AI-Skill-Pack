---
name: data-classification
description: >-
  Classifies a context bundle as public, internal, confidential or restricted from the environment's
  data class, path rules and personal-data detection before any model call, and picks the gateway
  route that class allows. Use whenever context is assembled for a model, a new source is added to
  retrieval, or someone asks what may be sent to which model, or someone asks whether notes can be
  sent to an external model. Not for redacting artifacts (artifact-redaction), configuring routes
  (model-gateway-config), or access control in retrieval (knowledge-retrieval).
allowed-tools: Read Grep Glob Bash(node scripts/classify-context.mjs:*)
---

# Data classification

Classify first; the class decides where the text may go.

## Non-negotiables
- Unclassified content is never sent to a model.
- Restricted content never leaves; confidential content goes only to self-hosted routes.
- A class is never lowered to make a call succeed.

## Inputs and outputs
- **In:** the context bundle; its sources
- **Out:** a class and the `x-qa-data-class` header value

## Procedure
1. `node scripts/classify-context.mjs <files…>`.
2. Take the highest class of any part.
3. Send with `x-qa-data-class` and `x-qa-skill`; the gateway enforces the route.

## Verify
- the gateway accepts the class for the chosen route

## Evidence
Add to the evidence block: class, route. Hashes, ids and counts only — never secrets, tokens, personal data or raw untrusted text.

## Definition of Done
- Every model call in the task carried a correct class.
