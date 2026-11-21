package qa_test

import rego.v1

import data.qa

base := {
	"now": "2026-11-19T00:00:00Z",
	"config": {
		"environments": [{"name": "staging", "owner": "team:qa", "ticket": "QA-1", "dataClass": "internal", "hosts": ["staging.shop.example.test"], "reviewBy": "2026-12-31"}],
		"skills": {"enabled": []},
		"gates": {"knowledgeWrite": "ask"},
		"telemetry": {"captureContent": false},
	},
	"catalog": {"flake-quarantine": {"tier": "T3", "default": "off", "category": "Exec"}},
	"waivers": [],
	"quarantine": [],
	"approvals": [{"file": "governance/approvals/A-1.json", "bundle": true, "id": "A-1", "action": "enable-skill", "subject": "flake-quarantine", "requester": "a", "approver": "b", "expires": "2027-01-01T00:00:00Z"}],
}

waiver := {"id": "WV-1", "rule": "qa/no-hard-wait", "path": "tests/e2e/x.spec.ts", "reason": "vendor widget", "ticket": "QA-2", "owner": "a", "approver": "b", "created": "2026-11-01T00:00:00Z", "expires": "2027-01-01T00:00:00Z", "attestation": "governance/approvals/A-1.sigstore.json"}

with_env(e) := object.union(base, {"config": object.union(base.config, {"environments": [object.union(base.config.environments[0], e)]})})

denied(inp, fragment) if {
	d := qa.deny with input as inp
	some m in d
	contains(m, fragment)
}

test_clean_input_complies if {
	d := qa.deny with input as base
	count(d) == 0
}

test_production_host_denied if denied(with_env({"hosts": ["prod.shop.example.test"]}), "production")

test_missing_owner_denied if denied(with_env({"owner": ""}), "owner is missing")

test_past_review_denied if denied(with_env({"reviewBy": "2026-01-01"}), "has passed")

test_valid_waiver_complies if {
	d := qa.deny with input as object.union(base, {"waivers": [waiver]})
	count(d) == 0
}

test_self_approved_waiver_denied if denied(object.union(base, {"waivers": [object.union(waiver, {"approver": "a"})]}), "self-approved")

test_long_waiver_denied if denied(object.union(base, {"waivers": [object.union(waiver, {"expires": "2027-06-01T00:00:00Z"})]}), "more than 90 days")

test_unattested_waiver_denied if denied(object.union(base, {"waivers": [object.union(waiver, {"attestation": "governance/approvals/NOPE.sigstore.json"})]}), "no signed approval")

test_p0_quarantine_denied if denied(object.union(base, {"quarantine": [{"id": "Q-1", "test": "login @P0", "tags": ["@P0"], "owner": "a", "ticket": "T", "added": "2026-11-15T00:00:00Z", "expires": "2026-11-20T00:00:00Z", "attestation": "governance/approvals/A-1.sigstore.json"}]}), "@P0")

test_long_quarantine_denied if denied(object.union(base, {"quarantine": [{"id": "Q-2", "test": "x @P1", "tags": ["@P1"], "owner": "a", "ticket": "T", "added": "2026-11-01T00:00:00Z", "expires": "2026-12-01T00:00:00Z", "attestation": "governance/approvals/A-1.sigstore.json"}]}), "more than 14 days")

test_enabled_skill_with_approval_complies if {
	inp := object.union(base, {"config": object.union(base.config, {"skills": {"enabled": [{"name": "flake-quarantine", "attestation": "governance/approvals/A-1.sigstore.json"}]}})})
	d := qa.deny with input as inp
	count(d) == 0
}

test_enabled_skill_without_approval_denied if denied(object.union(base, {"config": object.union(base.config, {"skills": {"enabled": [{"name": "flake-quarantine", "attestation": "governance/approvals/X.sigstore.json"}]}})}), "without a current")

test_direct_knowledge_write_denied if denied(object.union(base, {"config": object.union(base.config, {"gates": {"knowledgeWrite": "allow"}})}), "knowledgeWrite")
