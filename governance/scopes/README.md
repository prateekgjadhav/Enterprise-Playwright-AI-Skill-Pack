# Security testing scopes

A T4 security skill runs only under a scope in this folder that a security approver signed. Agents never create
or edit scopes (managed deny rule). The `verify-scope` hook checks the signature against the security-approver
identity in `/opt/qa-pack/trust.json`, the time window and that every target is in `environments[].hosts`.

Sign a scope: `cosign sign-blob <id>.json --bundle <id>.json.sigstore.json --yes` (keyless, your OIDC identity).
See `scope.example.json` for the fields.
