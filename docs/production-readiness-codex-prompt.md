You are implementing the Platinum Bleu dashboard production-readiness runbook.

Repository: `C:\dev\Platinum Bleu\platinum-bleu-dashboard`.
Read `docs/production-readiness-runbook.md`, `docs/production-readiness/evidence-index.md`, `docs/production-readiness/baseline-controls.md`, the workspace `AGENTS.md`, and applicable repository instructions. Report `git status --short --branch`. Preserve existing user work. The workspace root is not a Git repository; the website repository is out of scope.

The owner's September 18 request authorizes synchronization of this prompt, Phase 2 controls, and a locally signed baseline after verification. The superseded prompt's request for stage approval is not a new gate for this authorized baseline. Other phases and live mutations retain their specific authorization requirements.

Follow the GitHub Free interim control profile:

- Private origin: `https://github.com/kirkseyhouse/platinumbleutls.git`.
- CODEOWNERS, pull requests, and GitHub CI are advisory review evidence. Private rulesets, required reviewers, and push protection are unavailable on this plan. Never claim those gates are enforced.
- GitHub Actions uses read-only permissions and full-SHA action pins. It has no production credentials, OIDC/WIF grants, service-account impersonation, or Cloud Run deployment rights.
- Run `npm ci`, `npm test`, `npm run check`, `npm run security:scan`, `python -m unittest discover -s tests -p '*_test.py'`, and `python scripts/render-cloud-build.py --check`. Gitleaks is pinned by version and archive SHA-256 in `deploy/tool-pins.json`. Scan eligible working files and all available Git history. Reject shallow history. Scan again after the initial commit. Investigate findings without blanket allowlists.
- Review the baseline inventory, locked dependencies, Docker context, scripts, IAM definitions, and inline promotion configuration. Sign with the repository signing identity and retain the public fingerprint and `git verify-commit HEAD` result. Keep private signing material outside source/evidence. Local signature validity, a GitHub Verified badge, and independent review are separate claims.
- `cloudbuild.yaml` runs as `pb-dashboard-builder`. It repeats checks and scans, builds and publishes an image, waits for completed Artifact Analysis, rejects high/critical/unknown findings, and records its immutable digest. The builder cannot deploy.
- `cloudbuild-promote.yaml` is generated from reviewed `scripts/promotion.py`. Use `--inline-config` and `--require-approval` for the controlled manual trigger. Never execute promotion scripts from fetched repository content. Set administrative trigger trust anchors after approved provisioning, regenerate, and record the configuration hash. Trust anchors are never caller substitutions.
- Promotion requires the approved trigger, named owner approval, successful builder identity/trigger, resolved commit provenance, exact published digest, and a fresh completed scan. Missing inputs fail closed. Update only the existing service image, with traffic unchanged for revision verification. Traffic migration needs explicit final authorization.
- Apply `deploy/iam/` only after review of a concrete Terraform plan and authorization for its exact IAM changes. Definitions are additive and resource scoped. Neither build identity may approve builds, edit triggers, administer IAM, or read runtime secrets. No service-account keys or GitHub principals.
- Record single-operator owner approval accurately. Retain MFA, audit logs, alerting and approval evidence. The lack of independent review and direct-push prevention remains a residual risk.

Before live cloud changes, prove account `catherine@platinumbleutls.com`, project `platinum-bleu-drive`, number `531881403960`, active lifecycle and active billing on an open account. Use `--configuration=platinum-bleu` and explicit project/billing flags. The evidence index records previous Phase 1 success; revalidate drift-prone state rather than relying on the older runbook snapshot. Never use `khproject88`.

Repository-only Phase 2 preparation can proceed without creating cloud resources. Do not enable paid resources, apply IAM, change OAuth, connect live providers, modify DNS, deploy, shift traffic, or delete resources without the specific runbook authorization. Do not push unless authorized. Give sensitive credential entry to the owner securely.

Keep `OPERATIONAL_MODE=hcp_coexistence`. HCP remains operational source, QBO accounting authority, and Notion operating record. Verify Notion identity before Notion operations. Put implementation status/evidence on the canonical Intake record or handoff, never loose HQ notes.

The remaining production path is live activation and proof for Cloud Run in `us-central1`, private IAM-authenticated Cloud SQL, Direct VPC/firewall behavior, per-secret IAM, HA/PITR, `us-east1` recovery, audit logs, VPC Service Controls dry-run, and bounded read-only provider validation. The repository implements passwordless IAM database access, bounded pooling, bootstrap/runtime grants, and deployment-template promotion checks, but local validation is not live production evidence. This signed implementation baseline is not deployed or production-authorized.

For each phase, inspect state, make authorized changes, verify actual outcomes, retain redacted evidence, and label verified, failed, blocked, or owner-decision required. Local tests, config syntax and signature checks do not prove live enforcement.

Close with what changed, files changed, verification performed, remaining risks, exact Git state, external-system changes, production verification status, and recommended model/effort for the next task.
