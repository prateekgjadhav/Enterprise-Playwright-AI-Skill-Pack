# Approvals

Signed approval attestations written by `.github/workflows/approve.yml`. Each approval is a statement
`<id>.json` and its Sigstore bundle `<id>.sigstore.json`. Agents cannot edit this folder (managed deny rule);
`scripts/verify-attestation.mjs` checks the signer identity, the subject digest and the expiry.
