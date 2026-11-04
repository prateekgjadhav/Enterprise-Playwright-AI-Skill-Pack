---
name: docker-security-review
description: >-
  Container image and Dockerfile security review for images the team owns: non-root user, minimal
  and pinned base images, no secrets baked into layers, reduced attack surface, healthchecks, and
  known-vulnerability scanning of the image, evaluated against the CIS Docker Benchmark and image
  best practice with tooling (Trivy/Grype, hadolint, Dockle). Use whenever the user asks for a
  Docker or container image security assessment, Dockerfile review or linting, base-image or
  non-root hardening, image vulnerability scanning, or CIS Docker benchmarking. Not for the
  orchestrator (kubernetes-security-audit), app dependencies in source
  (dependency-vulnerability-audit), cloud registries' IAM (cloud-security-review), or the
  cross-scanner CVE lifecycle (security-posture-management). It reviews build config and scans
  images; it does not attack running containers.
metadata:
  tier: "3"
  pack: "enterprise-playwright-ai-skill-pack"
---

# Docker security review

Make the image small, rootless, secret-free and scanned. The review is static (Dockerfile +
image) and read-only; it never attacks a running container.

## Non-negotiables
- Review only images/Dockerfiles the team owns.
- Never print or embed secrets; flag any secret found baked into a layer as an incident (rotate it — layers persist) and keep it redacted.
- A finding maps to a CIS Docker control or an image best practice; cite it. Scanning reports *known* image CVEs; it does not exploit them.
- Prefer failing the build on scan/lint findings over manual-only review.

## Review areas (CIS Docker-aligned)
| Area | Check | Good state |
|---|---|---|
| User | `USER` is non-root; no unnecessary setuid | runs as non-root |
| Base image | minimal (distroless/slim/alpine); pinned by digest; maintained | small, digest-pinned, patched |
| Secrets | no secrets in `ENV`/`ARG`/layers; use build secrets/mounts | none baked in |
| Attack surface | no unneeded packages, shells, or tools; multi-stage build | minimal final stage |
| Filesystem | read-only root where possible; sensible `WORKDIR`; no world-writable | least privilege |
| Metadata | `HEALTHCHECK`; pinned package versions; `.dockerignore` excludes secrets/VCS | present and sane |
| Vulnerabilities | image scanned; High/Critical addressed or waived | scanned; gate passes |

## Templates
```dockerfile
# @skill-example: fragment — hardened image (target state)
FROM node:20.18.1-bookworm-slim@sha256:<digest> AS build      # pinned, minimal base
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
FROM gcr.io/distroless/nodejs20-debian12@sha256:<digest>      # distroless runtime, non-root by default
WORKDIR /app
COPY --from=build /app /app
USER nonroot
HEALTHCHECK CMD ["node","healthcheck.js"]
```
```bash
# @skill-example: fragment — scan & lint in CI (fail on High/Critical)
hadolint Dockerfile
trivy image --severity HIGH,CRITICAL --exit-code 1 "$IMAGE"
```

## Procedure
1. Confirm ownership; read the Dockerfile and build; identify base image, user, and layers.
2. Review against the table; check for non-root, pinned minimal base, and secrets in layers/history (`docker history`).
3. Scan the image (Trivy/Grype) and lint the Dockerfile (hadolint/Dockle); collect findings with ids.
4. Rate and write change → control → remediation (multi-stage, distroless, non-root, digest pin, build secrets).
5. Gate scan/lint in CI; store results restricted; rotate any embedded secret found.

## Definition of Done
- Dockerfile and image reviewed against CIS Docker/best practice; findings cite controls with fixes.
- Image scanned and Dockerfile linted, gating High/Critical in CI.
- Non-root, pinned minimal base, and no baked-in secrets confirmed; results restricted.
