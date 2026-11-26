# The pack's policy, evaluated in CI and by the governance-check hook on the input built by scripts/policy-input.mjs:
#   opa eval --format raw --data policy --input .claude/out/policy-input.json 'data.qa.deny'
# Every rule adds a message to deny; an empty set means the repository complies. Unparsable dates deny too.
package qa

import rego.v1

ns_per_day := 86400000000000

now := time.parse_rfc3339_ns(input.now)

production_like(h) if regex.match(`(^|[.-])(prod|production|live)([.-]|$)|^www\.`, h)

valid_time(t) if time.parse_rfc3339_ns(t)

valid_date(d) if time.parse_ns("2006-01-02", d)

bundle_of(file) := concat("", [trim_suffix(file, ".json"), ".sigstore.json"])

attested(bundle) if {
	some a in input.approvals
	a.bundle == true
	bundle_of(a.file) == bundle
}

# ---------- environments: the allowlist ----------
deny contains msg if {
	some e in input.config.environments
	some h in e.hosts
	production_like(h)
	msg := sprintf("environment %v: %v looks like a production host", [e.name, h])
}

deny contains msg if {
	some e in input.config.environments
	some k in ["name", "owner", "ticket", "dataClass", "reviewBy"]
	object.get(e, k, "") == ""
	msg := sprintf("environment %v: %v is missing", [object.get(e, "name", "?"), k])
}

deny contains msg if {
	some e in input.config.environments
	count(object.get(e, "hosts", [])) == 0
	msg := sprintf("environment %v: no hosts", [object.get(e, "name", "?")])
}

deny contains msg if {
	some e in input.config.environments
	not valid_date(object.get(e, "reviewBy", ""))
	msg := sprintf("environment %v: reviewBy is not a YYYY-MM-DD date", [object.get(e, "name", "?")])
}

deny contains msg if {
	some e in input.config.environments
	time.parse_ns("2006-01-02", e.reviewBy) < now
	msg := sprintf("environment %v: reviewBy %v has passed", [e.name, e.reviewBy])
}

deny contains msg if {
	some e in input.config.environments
	time.parse_ns("2006-01-02", e.reviewBy) - now > 90 * ns_per_day
	msg := sprintf("environment %v: reviewBy %v is more than 90 days ahead", [e.name, e.reviewBy])
}

# ---------- waivers ----------
waiver_fields := ["id", "rule", "path", "reason", "ticket", "owner", "approver", "created", "expires", "attestation"]

deny contains msg if {
	some w in input.waivers
	some k in waiver_fields
	object.get(w, k, "") == ""
	msg := sprintf("waiver %v: %v is missing", [object.get(w, "id", "?"), k])
}

deny contains msg if {
	some w in input.waivers
	some k in ["created", "expires"]
	not valid_time(object.get(w, k, ""))
	msg := sprintf("waiver %v: %v is not an RFC 3339 time", [object.get(w, "id", "?"), k])
}

deny contains msg if {
	some w in input.waivers
	regex.match(`[*?]`, w.path)
	msg := sprintf("waiver %v: wildcard paths are not allowed", [w.id])
}

deny contains msg if {
	some w in input.waivers
	time.parse_rfc3339_ns(w.expires) < now
	msg := sprintf("waiver %v expired at %v", [w.id, w.expires])
}

deny contains msg if {
	some w in input.waivers
	time.parse_rfc3339_ns(w.expires) - time.parse_rfc3339_ns(w.created) > 90 * ns_per_day
	msg := sprintf("waiver %v lasts more than 90 days", [w.id])
}

deny contains msg if {
	some w in input.waivers
	w.owner == w.approver
	msg := sprintf("waiver %v is self-approved", [w.id])
}

deny contains msg if {
	some w in input.waivers
	object.get(w, "attestation", "") != ""
	not attested(w.attestation)
	msg := sprintf("waiver %v: %v has no signed approval statement", [w.id, w.attestation])
}

# ---------- quarantine ----------
quarantine_fields := ["id", "test", "owner", "ticket", "added", "expires", "attestation"]

deny contains msg if {
	some q in input.quarantine
	some k in quarantine_fields
	object.get(q, k, "") == ""
	msg := sprintf("quarantine %v: %v is missing", [object.get(q, "id", "?"), k])
}

deny contains msg if {
	some q in input.quarantine
	some k in ["added", "expires"]
	not valid_time(object.get(q, k, ""))
	msg := sprintf("quarantine %v: %v is not an RFC 3339 time", [object.get(q, "id", "?"), k])
}

deny contains msg if {
	some q in input.quarantine
	p0(q)
	msg := sprintf("quarantine %v: @P0 tests are never quarantined", [q.id])
}

p0(q) if "@P0" in object.get(q, "tags", [])

p0(q) if contains(object.get(q, "test", ""), "@P0")

deny contains msg if {
	some q in input.quarantine
	time.parse_rfc3339_ns(q.expires) - time.parse_rfc3339_ns(q.added) > 14 * ns_per_day
	msg := sprintf("quarantine %v lasts more than 14 days", [q.id])
}

deny contains msg if {
	some q in input.quarantine
	time.parse_rfc3339_ns(q.expires) < now
	msg := sprintf("quarantine %v expired at %v: fix the test or triage again", [q.id, q.expires])
}

deny contains msg if {
	some q in input.quarantine
	object.get(q, "attestation", "") != ""
	not attested(q.attestation)
	msg := sprintf("quarantine %v: %v has no signed approval statement", [q.id, q.attestation])
}

# ---------- optional skills ----------
enabled := object.get(input.config, ["skills", "enabled"], [])

deny contains msg if {
	some s in enabled
	not input.catalog[s.name]
	msg := sprintf("skills.enabled names %v, which is not in the catalogue", [s.name])
}

deny contains msg if {
	some s in enabled
	not enable_approved(s)
	msg := sprintf("skill %v is enabled without a current, signed enable-skill approval", [s.name])
}

enable_approved(s) if {
	some a in input.approvals
	a.action == "enable-skill"
	a.subject == s.name
	a.bundle == true
	bundle_of(a.file) == s.attestation
	time.parse_rfc3339_ns(a.expires) > now
}

# ---------- approvals and gates ----------
deny contains msg if {
	some a in input.approvals
	a.requester == a.approver
	msg := sprintf("approval %v is self-approved", [object.get(a, "id", a.file)])
}

deny contains msg if {
	some a in input.approvals
	not a.bundle
	msg := sprintf("approval %v has no signature bundle", [a.file])
}

deny contains "gates.knowledgeWrite must not be allow: knowledge is always staged for signed promotion" if {
	input.config.gates.knowledgeWrite == "allow"
}

deny contains "telemetry.captureContent must be false" if {
	input.config.telemetry.captureContent != false
}
