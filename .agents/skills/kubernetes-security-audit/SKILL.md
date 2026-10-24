---
name: kubernetes-security-audit
description: >-
  Read-only Kubernetes security audit for clusters and manifests the team owns: RBAC least
  privilege, Pod Security Standards (no privileged/root, dropped capabilities, read-only root FS),
  network policies, secrets handling, resource limits, and image provenance, evaluated against the
  CIS Kubernetes Benchmark and Pod Security Standards with read-only tooling (kube-bench, kubescape,
  Trivy, `kubectl get`). Use whenever the user asks for a Kubernetes or k8s security audit, manifest
  or RBAC review, Pod Security Standards/admission checks, network-policy review, or CIS Kubernetes
  benchmarking. Not for the container image build (docker-security-review), cloud control plane
  (cloud-security-review / aws / azure), or app-layer checks. It reviews manifests and read-only
  cluster state; it makes no changes and exploits nothing.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Kubernetes security audit

Audit the cluster's workloads and policies against the CIS Kubernetes Benchmark and Pod Security
Standards — statically on manifests and read-only against the live cluster — and report gaps with
fixes.

## Non-negotiables
- Authorised clusters only; read-only access (`get`/`list`, `kubectl auth can-i --list` to confirm scope). Make no changes; deploy nothing.
- Never print Secret values or kubeconfig credentials; reference Secrets by name. Findings get restricted visibility.
- A finding maps to a CIS control or a Pod Security Standard; cite it. Do not attempt container escape, lateral movement, or privilege escalation to "prove" it.
- Prefer scanning manifests in CI (shift left) over only auditing the running cluster.

## Review areas
| Area | Check | Good state |
|---|---|---|
| Pod Security | `privileged`, `runAsNonRoot`, `allowPrivilegeEscalation`, dropped capabilities, read-only root FS, `hostPID/hostNetwork` | restricted PSS; no privileged/root; caps dropped |
| RBAC | wildcard verbs/resources; cluster-admin bindings; default SA token automounting | least privilege; few cluster-admins; automount off where unused |
| Network | default-deny NetworkPolicies; namespace isolation | explicit allow-lists; isolated namespaces |
| Secrets | plaintext in manifests/env; encryption at rest; external secret store | no inline secrets; encrypted; vaulted |
| Resources | CPU/memory requests & limits; quotas | set per workload; quotas enforced |
| Images | pinned by digest; trusted registries; scanned | digest-pinned; signed/scanned |
| Control plane (managed) | API server exposure; audit logging | restricted; audit on |

## Templates
```bash
# @skill-example: fragment — read-only audits (authorised cluster)
kube-bench run --targets node,policies                     # CIS Kubernetes Benchmark
kubescape scan framework nsa,cis --format json --output ./security/k8s/kubescape.json
kubectl auth can-i --list                                  # confirm read-only scope
```
```yaml
# @skill-example: fragment — hardened workload (target state)
securityContext:                                           # pod/container hardening
  runAsNonRoot: true
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities: { drop: ["ALL"] }
```

## Procedure
1. Confirm authorisation and read-only scope; record the cluster/namespaces in scope.
2. Scan manifests and the live cluster with CIS/PSS tooling; collect failing controls with ids and workloads.
3. Spot-check RBAC bindings, NetworkPolicies, Secret handling, and image pinning.
4. Rate by blast radius (namespace vs cluster); write object → control → remediation (hardened `securityContext`, scoped RBAC, default-deny policies).
5. Add manifest scanning to CI; store results restricted.

## Definition of Done
- Read-only access used; no changes made; scope recorded.
- Findings cite CIS/PSS controls with remediation; RBAC, network, secrets, images covered.
- Manifest scanning recommended/added for CI; Secret values redacted; results restricted.
