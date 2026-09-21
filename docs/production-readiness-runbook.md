# Platinum Bleu dashboard production-readiness runbook

Status: execution guide, not deployment authorization

Repository: `C:\dev\Platinum Bleu\platinum-bleu-dashboard`

Project: `platinum-bleu-drive`, project number `531881403960`

Origin: `https://ops.platinumbleutls.com`

Primary region: `us-central1`; disaster-recovery region: `us-east1`

## Control rule and current evidence

Complete these phases in order and retain redacted evidence for every exit gate. This guide does not itself authorize paid resources, IAM grants, OAuth consent, provider access, DNS changes, production data, or deployment.

Keep `OPERATIONAL_MODE=hcp_coexistence`. Housecall Pro remains operational source, QuickBooks remains accounting authority, and Notion remains the operating record.

The initial September 18 inspection snapshot is historical. Current evidence and superseding results are in `docs/production-readiness/evidence-index.md`; implementation and activation instructions are in `docs/production-readiness/baseline-controls.md`. The repository now contains the private Cloud SQL IAM connector, separate workload identities, database bootstrap/runtime grants, Direct VPC Cloud Run template, and promotion validation. These are locally validated source controls only. No live Cloud SQL, OAuth, provider, backup, or deployed production behavior is proven.

Fixed names: VPC `pb-prod-vpc`; subnet `pb-prod-us-central1`; private range `pb-sql-private-range`; primary SQL `pb-prod-sql`; replica `pb-prod-sql-dr`; database `platinum_bleu`; Artifact Registry `pb-dashboard`; Cloud Run service `pb-dashboard`; worker job `pb-dashboard-worker`; service accounts `pb-dashboard-runtime`, `pb-dashboard-worker`, `pb-dashboard-migrate`, `pb-dashboard-builder`, and `pb-dashboard-deployer`.

## 1. Reauthenticate and prove cloud context

**Risk:** stale credentials or the wrong quota project can deploy or charge the wrong environment.

Run interactively in the user's normal PowerShell:

```powershell
gcloud auth login catherine@platinumbleutls.com
gcloud auth application-default login catherine@platinumbleutls.com
gcloud auth application-default set-quota-project platinum-bleu-drive
gcloud config configurations create platinum-bleu
gcloud config configurations activate platinum-bleu
gcloud config set account catherine@platinumbleutls.com
gcloud config set project platinum-bleu-drive
gcloud config set billing/quota_project platinum-bleu-drive
```

If the named configuration already exists, activate it instead of creating a duplicate. Use explicit project flags even inside this configuration.

```powershell
gcloud auth list --filter="status:ACTIVE" --format="value(account)"
gcloud config list --format=json
gcloud projects describe platinum-bleu-drive --project=platinum-bleu-drive --billing-project=platinum-bleu-drive --format="json(projectId,projectNumber,lifecycleState,parent)"
gcloud billing projects describe platinum-bleu-drive --project=platinum-bleu-drive --billing-project=platinum-bleu-drive --format=json
gcloud services list --enabled --project=platinum-bleu-drive --billing-project=platinum-bleu-drive --format="value(config.name)"
gcloud projects get-iam-policy platinum-bleu-drive --billing-project=platinum-bleu-drive --flatten="bindings[].members" --filter="bindings.members:catherine@platinumbleutls.com" --format="table(bindings.role)"
```

After billing is proven active, enable the approved prerequisites:

```powershell
gcloud services enable run.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com compute.googleapis.com servicenetworking.googleapis.com iam.googleapis.com iamcredentials.googleapis.com cloudscheduler.googleapis.com containerscanning.googleapis.com logging.googleapis.com monitoring.googleapis.com --project=platinum-bleu-drive --billing-project=platinum-bleu-drive
```

Common mistakes: mistaking an account name for a valid token; leaving either project setting on `khproject88`; confusing CLI credentials with ADC; enabling services before billing read-back; granting broad roles before diagnosing the missing permission.

**Exit gate:** exact account, project ID, project number, ACTIVE lifecycle, open billing account with `billingEnabled: true`, required APIs enabled, and no command using `khproject88`.

## 2. Establish the reviewed initial Git baseline

Repository implementation entrypoints: `.github/workflows/ci.yml`, `deploy/tool-pins.json`, `scripts/secret-scan.js`, `cloudbuild.yaml`, generated `cloudbuild-promote.yaml`, `scripts/promotion.py`, and `deploy/iam/`. Run the commands in the synchronized Codex prompt and retain the limitations in `baseline-controls.md`. Local configuration does not establish live enforcement.

**Risk:** with no baseline, later diffs, provenance, review, and immutable deployment evidence are impossible.

A production-worthy initial commit contains only reviewed source, migrations, tests, docs, and locked dependencies. It contains no `.env`, token, private key, provider credential, customer export, database dump, browser profile, or generated runtime state.

```powershell
git status --short --branch
git add -N .
git diff --check
git diff --stat
git diff
npm ci
npm test
npm run check
rg -n --hidden -g "!.git/**" -g "!node_modules/**" -g "!.env.example" "(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|AIza[0-9A-Za-z_-]{35}|ghp_[0-9A-Za-z]{36}|xox[baprs]-|client_secret\s*[:=]\s*[^<])" .
```

Investigate every match. A zero-match pattern scan is not a complete secret scan.

Before calling the baseline deployable, add:

- `.github/CODEOWNERS` for `deploy/**`, workflows, migrations, and security-sensitive source. On GitHub Free for this private repository, this is review routing and evidence, not an enforceable merge gate.
- `.github/workflows/ci.yml` with read-only workflow permissions, full-SHA-pinned actions, `npm ci`, tests, checks, and a pinned Gitleaks scan. GitHub checks are useful evidence but are not a required-status enforcement boundary on this plan.
- `cloudbuild.yaml` for Google Cloud to repeat clean install, tests, checks, pinned Gitleaks scanning, image build, Artifact Analysis scanning, and digest publication under `pb-dashboard-builder`. The builder has no Cloud Run deploy permission and no runtime-secret access.
- `cloudbuild-promote.yaml` as the reviewed source for an inline, administratively controlled promotion-trigger configuration under `pb-dashboard-deployer`. Creating the trigger with `--inline-config=cloudbuild-promote.yaml` copies the reviewed configuration into the trigger instead of loading a mutable build file from the pushed repository. The promotion must accept an exact verified image digest and commit SHA, never a mutable tag or arbitrary source build.

After complete review:

```powershell
git add .
git diff --cached --check
git diff --cached --stat
git commit -S -m "chore: establish reviewed dashboard baseline"
git show --stat --show-signature HEAD
```

Push only to `https://github.com/kirkseyhouse/platinumbleutls.git`. Do not deploy this initial commit.

### GitHub Free interim control profile

The verified private repository cannot use private-repository rulesets, required environment reviewers, secret scanning, or push protection on its current GitHub Free plan. Do not make the repository public and do not describe advisory controls as enforced.

Retain and periodically verify the supported GitHub settings:

- Private visibility.
- Dependabot vulnerability alerts.
- Full-SHA pinning for GitHub Actions.
- Read-only default workflow tokens.
- Workflows cannot approve pull requests.
- Squash merge is the only allowed merge method.
- No GitHub Actions workflow has a production service account, Workload Identity Federation grant, production secret, or Cloud Run deploy permission.

Compensating controls:

1. Sign the baseline and release commits locally. Record `git show --show-signature`, exact commit SHA, staged-file list, test/check results, and secret-scan result in the evidence package.
2. Run Gitleaks at a pinned release or container digest before the first commit, before every release tag, in GitHub CI, and again in Cloud Build. Scan the working tree and Git history once history exists.
3. Treat pull requests, CODEOWNERS, and GitHub CI as review evidence. They do not prevent an administrator or writer from pushing directly.
4. Give GitHub no production deployment credential. A compromised GitHub workflow may consume CI minutes but cannot deploy, read production secrets, impersonate a production service account, or modify Cloud Run.
5. Use two Google Cloud Build stages:
   - `pb-dashboard-build` repeats tests, checks, secret scanning, container build, and vulnerability scanning, then publishes an image digest. Its `pb-dashboard-builder` identity can write only to the dashboard Artifact Registry and its approved log destination.
   - `pb-dashboard-promote` uses the reviewed inline trigger configuration, accepts only the recorded digest and commit SHA, requires Cloud Build approval, and deploys through `pb-dashboard-deployer`. The deployer cannot write source or build a different image.
6. Create the promotion trigger with `--inline-config=cloudbuild-promote.yaml --require-approval`. Record the reviewed promotion-config hash in evidence. Grant `roles/cloudbuild.builds.approver` only to the named owner approver. Record the approval comment, build ID, digest, commit SHA, evidence-index link, approver identity, and timestamp.
7. If the approver is also the change author, label the control `single-operator owner approval`. Require MFA, a fresh action-time review of the exact digest and evidence, Cloud Audit Logs, and an alert on trigger edits, approvals, IAM changes, and deployments. Do not claim independent review.
8. Keep trigger administration separate from build execution where current identities allow it. Neither builder nor deployer may edit its trigger, approve builds, change IAM, or access runtime secrets.
9. A GitHub push or merge never constitutes production authorization. Only the approved Cloud Build promotion of the verified digest can reach production.

This interim profile avoids a GitHub subscription upgrade. Google Cloud build, storage, scanning, and deployment usage may still incur ordinary project charges.

Common mistakes: calling CODEOWNERS or CI enforceable on GitHub Free; adding a production OIDC grant to GitHub; letting one Cloud Build identity both build arbitrary source and deploy it; approving before checking the digest and evidence; using a mutable tag; relying on only one secret scan; rewriting incident-relevant history.

**Exit gate:** clean signed baseline; exact private origin; supported GitHub settings read back; pinned local, GitHub, and Cloud Build checks pass; GitHub has no production credential; builder and deployer IAM are distinct and least-privileged; the promotion trigger uses the reviewed inline configuration and is approval-gated; a test build cannot deploy; a test promotion stays pending until approval; the approved promotion deploys only the recorded digest. Direct-push prevention and independent review remain unavailable and must be recorded as residual risks, not asserted as complete.

## 3. Verify OAuth

**Risk:** wrong redirects, audience, scopes, or provider account can leak tokens or authorize the wrong tenant.

In Google Auth Platform for `platinum-bleu-drive` configure:

- Branding: Platinum Bleu Operations, company support email, owner contact.
- Audience: Internal to the Platinum Bleu Workspace organization.
- Web application client. No JavaScript origins because authorization is server-side.
- Exact redirect URIs:
  - `https://ops.platinumbleutls.com/auth/google/callback`
  - `https://ops.platinumbleutls.com/integrations/gmail/callback`
  - `https://ops.platinumbleutls.com/integrations/calendar/callback`
  - `https://ops.platinumbleutls.com/integrations/drive/callback`

Keep sign-in at `openid email`. Connector scopes are Gmail metadata, Calendar events, and Drive file access exactly as declared in `src/connectors.js`. Set `APP_ORIGIN=https://ops.platinumbleutls.com` without a trailing slash. Do not broaden scopes to solve mapping errors.

In the company-owned Intuit app, set `https://ops.platinumbleutls.com/integrations/quickbooks/callback`, bind the exact Platinum Bleu realm, and switch to production only after sandbox compatibility. The accounting scope is broad, so the app's no-write boundary remains mandatory.

Deployed staging tests must prove: approved member success; outside-domain denial; unprovisioned-domain denial; suspended-member denial; state, nonce, PKCE, issuer, audience, `azp`, hosted-domain and email checks; exact displayed scopes; same operator identity for Google connectors; wrong QuickBooks realm rejection; controlled reconnect after revocation.

Common mistakes: trusting the `hd` request parameter instead of verified token claims; URI slash/case mismatch; external audience; preview callback in production; treating consent success as mapping proof.

**Exit gate:** all tests pass over HTTPS with redacted consent, claims, callback, and denial evidence.

## 4. Secure secrets and rotation

**Risk:** hardcoded values, project-wide access, environment leakage, or unsafe key rotation can expose providers or destroy connector-token availability.

Required code changes before production secrets:

1. Keep production password/URL database variables prohibited and validate the implemented IAM connector design in Phase 5 staging.
2. Replace one `TOKEN_ENCRYPTION_KEY` with current and previous key versions, a ciphertext key marker, and a controlled re-encryption job.
3. Add fail-closed startup validation for each enabled provider.
4. Prevent logs from emitting environment values, authorization headers, tokens, webhook signatures, or payloads.

Create individual automatic-replication secrets:

```powershell
$PbSecrets = @('pb-google-client-id','pb-google-client-secret','pb-token-key-current','pb-token-key-previous','pb-qbo-client-id','pb-qbo-client-secret','pb-qbo-realm-id','pb-qbo-webhook-token','pb-hcp-api-key','pb-hcp-company-id','pb-notion-token','pb-notion-root-page-id')
$PbSecrets | ForEach-Object { gcloud secrets create $_ --replication-policy=automatic --project=platinum-bleu-drive }
```

Enter values through secure local input, never command arguments, chat, repository files, or CI output. Grant `roles/secretmanager.secretAccessor` on each secret, only to the workload that needs it:

```powershell
gcloud secrets add-iam-policy-binding pb-google-client-secret --member="serviceAccount:pb-dashboard-runtime@platinum-bleu-drive.iam.gserviceaccount.com" --role="roles/secretmanager.secretAccessor" --project=platinum-bleu-drive
```

Bind numbered versions to Cloud Run and deploy a new revision when rotating. Rotation policy: provider clients/API keys and webhook tokens every 90 days; token-encryption key every 180 days using dual-read/new-write plus transactional re-encryption; immediate emergency rotation after suspected compromise. Secret Manager schedules notify; they do not rotate credentials at providers.

Verify secret inventory, each secret's IAM policy, Cloud Run revision mappings, repository/image scans, and a complete nonproduction rotation plus rollback.

Common mistakes: project-level accessor; storing a DB password; rotating the token key without re-encrypting rows; using `latest` as proof a running revision changed; putting secrets in build arguments.

**Exit gate:** no secrets in source, history, image, CI, or logs; per-secret access only; numbered revision mapping; tested rotation and rollback; named owner and calendar.

## 5. Configure Cloud SQL for production

**Risk:** public exposure, passwords, excessive database privilege, or uncontrolled connections can expose data or exhaust the database.

After cost and resource-creation approval:

```powershell
gcloud compute networks create pb-prod-vpc --subnet-mode=custom --bgp-routing-mode=regional --project=platinum-bleu-drive
gcloud compute networks subnets create pb-prod-us-central1 --network=pb-prod-vpc --region=us-central1 --range=10.30.0.0/24 --enable-private-ip-google-access --project=platinum-bleu-drive
gcloud compute addresses create pb-sql-private-range --global --purpose=VPC_PEERING --prefix-length=16 --network=pb-prod-vpc --project=platinum-bleu-drive
gcloud services vpc-peerings connect --service=servicenetworking.googleapis.com --ranges=pb-sql-private-range --network=pb-prod-vpc --project=platinum-bleu-drive
gcloud sql instances create pb-prod-sql --database-version=POSTGRES_16 --edition=ENTERPRISE --tier=db-custom-2-7680 --region=us-central1 --availability-type=REGIONAL --network=projects/platinum-bleu-drive/global/networks/pb-prod-vpc --no-assign-ip --storage-type=SSD --storage-size=20 --storage-auto-increase --backup-start-time=08:00 --retained-backups-count=30 --enable-point-in-time-recovery --retained-transaction-log-days=7 --retain-backups-on-delete --deletion-protection --database-flags=cloudsql.iam_authentication=on --project=platinum-bleu-drive
gcloud sql databases create platinum_bleu --instance=pb-prod-sql --project=platinum-bleu-drive
```

Do not configure authorized public networks. Confirm no public address and empty `authorizedNetworks`.

Create Phase 9 service accounts, then:

```powershell
gcloud sql users create pb-dashboard-runtime@platinum-bleu-drive.iam.gserviceaccount.com --instance=pb-prod-sql --type=cloud_iam_service_account --project=platinum-bleu-drive
gcloud sql users create pb-dashboard-worker@platinum-bleu-drive.iam.gserviceaccount.com --instance=pb-prod-sql --type=cloud_iam_service_account --project=platinum-bleu-drive
gcloud sql users create pb-dashboard-migrate@platinum-bleu-drive.iam.gserviceaccount.com --instance=pb-prod-sql --type=cloud_iam_service_account --project=platinum-bleu-drive
```

Each needs `roles/cloudsql.client` and `roles/cloudsql.instanceUser`. PostgreSQL grants are separate. Run `deploy/database-bootstrap.sql` once as the approved database administrator after all three IAM users exist. Run migrations only as `pb-dashboard-migrate`, then apply `deploy/runtime-role.sql` as that migration identity. Bootstrap attaches the restricted `pb_runtime` role to runtime and worker; do not grant migration ownership to either workload. They must not own tables, create schemas, bypass RLS, administer roles/databases, replicate, or become superuser.

Implemented repository control: `src/db.js` uses `@google-cloud/cloud-sql-connector` with private IP, automatic IAM authentication, the exact database/workload usernames, a pool maximum of five, coordinated connector/pool shutdown, prohibited production password/URL overrides, and fail-closed role-drift checks. Local tests cover connector failure, pool exhaustion, connection loss, cleanup, identity mismatch, role escalation, ownership, and schema privilege drift. Live staging must still prove token refresh/reconnection, private reachability, PostgreSQL 16 behavior, and Cloud SQL enforcement.

Deploy Cloud Run with Direct VPC egress, `private-ranges-only`, the correct service account and network tag `pb-dashboard`. Allow TCP 5432 only to the database private address. Initial connection budget is five web instances times five connections, 25 total, with capacity reserved for worker, migration, administration and recovery. Keep maximum instances five and concurrency eight until load testing justifies change.

```powershell
gcloud sql instances describe pb-prod-sql --project=platinum-bleu-drive --format=json
gcloud run services describe pb-dashboard --region=us-central1 --project=platinum-bleu-drive --format=yaml
gcloud compute firewall-rules list --project=platinum-bleu-drive --filter="network:pb-prod-vpc" --format="table(name,direction,priority,allowed,denied,destinationRanges,targetTags)"
```

Common mistakes: password fallback; confusing IAM with PostgreSQL grants; migration identity on web; temporary public IP; unbounded autoscaling times pool size; manual one-hour IAM tokens.

**Exit gate:** staging proves private IP, automatic IAM auth, non-owner runtime grants, bounded connections, isolation and safe connection-failure behavior.

## 6. Backups and disaster recovery

**Risk:** enabled backups do not prove recoverability or regional resilience.

Use initial targets of RPO at or below 15 minutes and RTO at or below four hours, subject to owner approval. Retain 30 backups and seven days of logs with PITR, regional HA, backups on delete and deletion protection.

```powershell
gcloud sql instances create pb-prod-sql-dr --master-instance-name=pb-prod-sql --replica-type=READ --region=us-east1 --network=projects/platinum-bleu-drive/global/networks/pb-prod-vpc --no-assign-ip --project=platinum-bleu-drive
```

Replication is asynchronous. Alert when lag threatens RPO. Before launch and quarterly, restore to a new isolated instance:

```powershell
$PbRestoreTimestamp = (Get-Date).ToUniversalTime().AddMinutes(-15).ToString('yyyy-MM-ddTHH:mm:ssZ')
gcloud sql instances clone pb-prod-sql pb-restore-drill --point-in-time=$PbRestoreTimestamp --project=platinum-bleu-drive
```

Validate migration level, row counts, test checksums, tenant boundaries, IAM grants, app smoke test and restore timings. Confirm backup settings after restore. Annually test regional recovery in `us-east1`. Delete drill resources only after evidence approval and exact-target recheck.

```powershell
gcloud sql instances describe pb-prod-sql --project=platinum-bleu-drive --format="json(settings.backupConfiguration,settings.availabilityType,settings.deletionProtectionEnabled,replicaNames)"
gcloud sql backups list --instance=pb-prod-sql --project=platinum-bleu-drive
gcloud sql operations list --instance=pb-prod-sql --project=platinum-bleu-drive --limit=20
```

Common mistakes: confusing HA with DR; claiming RPO without lag/PITR monitoring; restoring over production; omitting restored-instance backup settings; checking rows but not application usability.

**Exit gate:** a restore meets approved RPO/RTO, replica and lag alerts are healthy, and recovery ownership is recorded.

## 7. Security review

**Risk:** functional infrastructure can remain overprivileged, unauditable, vulnerable or open to exfiltration.

Enable Admin Activity, System Event, Policy Denied and required Data Access logs for SQL, Secret Manager, IAM, Storage, Artifact Registry and Run. Preserve every IAM binding and `etag` when adding `auditConfigs`. Create a 365-day audit bucket and sink. Alert on denied access, IAM changes, unusual secret reads, SQL admin changes, backup failure, replica lag and vulnerabilities. Validate before any irreversible retention lock.

```powershell
gcloud projects get-iam-policy platinum-bleu-drive --format=json --project=platinum-bleu-drive > pb-iam-policy-before.json
```

With organization approval, start VPC Service Controls in dry-run:

```powershell
gcloud access-context-manager perimeters dry-run create pb-prod-perimeter --policy=ACCESS_POLICY_ID --resources="projects/531881403960" --restricted-services="sqladmin.googleapis.com,secretmanager.googleapis.com,storage.googleapis.com,artifactregistry.googleapis.com" --project=platinum-bleu-drive
gcloud access-context-manager perimeters dry-run describe pb-prod-perimeter --policy=ACCESS_POLICY_ID --project=platinum-bleu-drive
```

Observe seven full operating days including CI, deploy, rotation, backup, restore, sync and incident access. Resolve every violation before enforcement. The perimeter does not replace IAM, private DB networking, or third-party controls.

```powershell
gcloud projects get-iam-policy platinum-bleu-drive --format=json --project=platinum-bleu-drive
gcloud iam service-accounts list --project=platinum-bleu-drive
gcloud asset search-all-iam-policies --scope=projects/platinum-bleu-drive --project=platinum-bleu-drive --format=json
gcloud artifacts docker images list us-central1-docker.pkg.dev/platinum-bleu-drive/pb-dashboard --include-tags --show-occurrences --project=platinum-bleu-drive
```

Review primitive roles, keys, inactive/external principals, broad secret access and impersonation. Use groups for humans and monitored MFA break-glass. Pin Actions by full SHA, generate SBOM, allow zero unapproved Critical/High findings, deploy by digest. Verify HTTPS, secure cookies, `private, no-store`, approved ingress, direct-origin rejection, CSRF, revocation, rate limit, RBAC/RLS, idempotency, immutable finance and secret-free logs. Keep document upload disabled until scanning, retention and recovery pass.

Common mistakes: enforcing perimeter before dry-run; assuming it protects DB data plane; logs without sink/alerts; one-time scanning; deployer reading runtime secrets; runtime deploying itself.

**Exit gate:** signed checklist, resolved violations, time-bounded exceptions, tested logging/alerts and clean approved digest.

## 8. Live provider compatibility

**Risk:** mocks do not prove endpoints, scopes, pagination, webhooks, quotas, refresh or company identity.

Use approved staging records and stay in `hcp_coexistence`. Do not enable QBO writes, HCP replacement, invoice issue, production scheduling or customer messaging.

| Provider | Proof |
|---|---|
| Google sign-in | Approved success; outside-domain, unprovisioned, suspended, expired and revoked failures. |
| Gmail | Metadata scope, bounded pages, refresh, 401/403, 429 `Retry-After`, timeout, no body collection. |
| Calendar | Exact calendar/scope, timezone/DST, pagination/deletion limits, 429/timeout. |
| Drive | `drive.file`, designated folder, pagination, moved/deleted behavior, no broad crawl. |
| QuickBooks | Exact realm/endpoint, read-only mapping, refresh, signed/replayed webhook, envelope rejection, 401/403/429/5xx/timeout. |
| HCP | Exact company/timezone, live endpoint/pagination/mapping/tombstones, atomic two-collection publication, prior snapshot on failure. |
| Notion | Exact workspace/root metadata, revocation/rate limit, no duplicate operating system. |

Every provider call needs finite timeout, safe/idempotent retries only, honored `Retry-After`, capped exponential backoff with jitter, no automatic retry for 400/401/403 or uncertain writes, attempt cap/dead-letter, last-good snapshot with stale state, secret-free correlation logs, and alerts. Implement and test any missing behavior.

Acceptance: connect in staging; verify account/company; bounded sync; compare fields to provider UI; force refresh; inject 429/5xx/timeout/malformed pagination/duplicate or out-of-order webhook/partial collection; prove bounded recovery; revoke; reconnect without duplicates; record version, scopes, rates, owner and limits.

Common mistakes: treating Codex connector availability as app authorization; happy path only; retrying uncertain finance/scheduling writes; partial HCP publication; presenting stale data as current; broadening scopes to fix bugs.

**Exit gate:** every enabled provider has identity, scope, endpoint, refresh, quota, retry, staleness, revocation and recovery evidence. Others remain disabled and visibly unavailable.

## 9. Production authorization

**Risk:** unclear identity ownership, key-based CI or undocumented impersonation defeats prior controls.

```powershell
$PbServiceAccounts = @(
  @{ Id='pb-dashboard-runtime'; Name='Platinum Bleu dashboard runtime' },
  @{ Id='pb-dashboard-worker'; Name='Platinum Bleu dashboard worker' },
  @{ Id='pb-dashboard-migrate'; Name='Platinum Bleu dashboard migration' },
  @{ Id='pb-dashboard-builder'; Name='Platinum Bleu dashboard builder' },
  @{ Id='pb-dashboard-deployer'; Name='Platinum Bleu dashboard deployer' }
)
$PbServiceAccounts | ForEach-Object { gcloud iam service-accounts create $_.Id --display-name=$_.Name --project=platinum-bleu-drive }
```

Never create service-account keys.

| Principal | Allowed | Excluded |
|---|---|---|
| Runtime | SQL Client/Instance User; per-secret and required bucket access | Deploy/build/IAM/secret admin/migrations/broad storage. |
| Worker | SQL roles; connector secrets; required queue/object access | Deploy/IAM/unrelated secrets. |
| Migration | SQL roles and DB migration ownership | Web/worker attachment and provider secrets. |
| Builder | Artifact Registry Writer for `pb-dashboard`; approved build-log destination; vulnerability scan access | Cloud Run deploy, runtime secrets, DB, IAM, build approval. |
| Deployer | Cloud Run deployment rights; Artifact Registry Reader; Service Account User only on runtime/worker | Source mutation, image build/write, runtime secrets, DB, Owner/Editor, key admin, build approval. |
| Human approvers | Protected production approval and narrow operator/viewer roles | Shared account and routine Owner. |
| Break-glass | Time-bound monitored MFA elevation | Routine access. |

Do not grant GitHub OIDC or GitHub Actions either production service-account impersonation or Cloud Run deployment permission in the GitHub Free interim profile. Connect the private repository to Cloud Build using the supported Cloud Build repository connection. Use user-specified build and deploy service accounts. Configure `pb-dashboard-build` so it cannot deploy. Create `pb-dashboard-promote` from the reviewed `cloudbuild-promote.yaml` using `--inline-config` and `--require-approval`, so the production instructions are copied into the controlled trigger rather than loaded from a mutable repository file at run time. It may deploy only the supplied immutable digest. Grant `roles/cloudbuild.builds.approver` only to the named human approver, never to either service account.

Maintain an access matrix with principal/group, owner, purpose, exact resource/role, grant/review/expiry dates, impersonation, last use and revocation. Quarterly reconcile Cloud, GitHub, Workspace, app, PostgreSQL and provider roles.

Final evidence: Phase 1 context/billing; signed reviewed commit, supported GitHub-setting read-back, CI, Cloud Build results, promotion-config hash, approval, digest and scan; OAuth denials; secret IAM/rotation; private IAM SQL/load; restore/DR; security/log/perimeter; provider matrix; access matrix; explicit owner approval for revision, hostname, providers, mode, cost and window.

Only then promote the tested digest. Recheck sign-in and outside denial, health, DB IAM, authorization, provider reads, logs, alerts and backup. Record revision/digest. Health alone is not production proof.

## Stop conditions and evidence

Stop for false billing/context; missing Git gates; leaked secret; SQL public IP/password/owner runtime/unbounded pool; no restore drill; unapproved Critical/High finding; external OAuth access; unverified provider identity/scope/pagination/retry; undocumented principal/impersonation; or changed HCP/QBO/Notion ownership.

During execution add redacted files under `docs/production-readiness/`: `evidence-index.md`, `access-matrix.md`, `oauth-validation.md`, `provider-compatibility.md`, `restore-drill.md`, `security-review.md`, and `production-authorization.md`. Maintain `deploy/cloud-run.yaml`, `.github/CODEOWNERS`, `.github/workflows/ci.yml`, `cloudbuild.yaml`, and `cloudbuild-promote.yaml`. Never commit secrets, customer data, account numbers or private payloads.

## Authoritative references

- [Google Cloud CLI authorization](https://cloud.google.com/sdk/docs/authorizing)
- [Application Default Credentials](https://cloud.google.com/sdk/gcloud/reference/auth/application-default/login)
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub ruleset plan availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [GitHub environment protection availability](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [Cloud Build approval gates](https://cloud.google.com/build/docs/securing-builds/gate-builds-on-approval)
- [Cloud Build user-specified service accounts](https://cloud.google.com/build/docs/securing-builds/configure-user-specified-service-accounts)
- [Google OAuth redirect rules](https://support.google.com/cloud/answer/15549257)
- [Internal OAuth apps](https://support.google.com/cloud/answer/13464323)
- [Secret Manager best practices](https://cloud.google.com/secret-manager/docs/best-practices)
- [Cloud Run to Cloud SQL](https://cloud.google.com/sql/docs/postgres/connect-run)
- [Cloud SQL IAM authentication](https://cloud.google.com/sql/docs/postgres/iam-authentication)
- [Cloud SQL backup and restore](https://cloud.google.com/sql/docs/postgres/backup-recovery/backups)
- [Cross-region replicas](https://cloud.google.com/sql/docs/postgres/replication/cross-region-replicas)
- [Data Access audit logs](https://cloud.google.com/logging/docs/audit/configure-data-access)
- [VPC Service Controls](https://cloud.google.com/vpc-service-controls/docs/service-perimeters)
- [Container scanning](https://cloud.google.com/artifact-analysis/docs/container-scanning-overview)
