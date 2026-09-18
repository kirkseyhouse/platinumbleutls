# Production-readiness evidence index

Session: 2026-09-18, America/Chicago. Latest ADC verification: 05:25:13 -05:00.

## Gate status

**Phase 1: previously VERIFIED.** The earlier session verified project/billing/ADC and all 13 APIs; those cloud facts were not reverified during this repository-only implementation. **Phase 2: LOCAL CONTROLS IMPLEMENTED; LIVE ENFORCEMENT PENDING.** The GitHub Free profile is selected, the synchronized prompt and CI/build/promoter/IAM definitions exist, and local verification passes. Signing is configured; post-commit signature and history verification is recorded in the latest closeout below when completed. GitHub plan restrictions remain accepted residual risks, not an unresolved upgrade requirement. Phases 3 through 9 are not complete.

Authority: `docs/production-readiness-runbook.md` and workspace `AGENTS.md`. The complete runbook was read before cloud action. No repository-specific AGENTS.md was found in the scoped repository search.

Housecall Pro remains the operational source in `hcp_coexistence`, QBO the accounting authority, and Notion the operating record. No provider, deployment or operating policy was changed.

## Verified in this session

| Check | Fresh result | Status |
| --- | --- | --- |
| Repository | `main`, no commits, all existing implementation files untracked; index empty | Verified |
| Isolated CLI configuration | Created and activated `platinum-bleu`; account `catherine@platinumbleutls.com`; core project and billing quota project both `platinum-bleu-drive` | Verified |
| CLI authentication and project | Active account read-back plus successful authenticated project description; project ID `platinum-bleu-drive`, number `531881403960`, lifecycle `ACTIVE` | Verified |
| Project billing | `billingEnabled: true`; linked billing account present | Verified |
| Linked billing account | `open: true`; identifier intentionally omitted | Verified |
| ADC metadata | Existing `authorized_user` credentials; quota project now matches `platinum-bleu-drive` after owner reauthentication | Verified |
| ADC identity | Google UserInfo confirms exact expected company account and verified email; output restricted to booleans | Verified |
| ADC quota permission | Cloud Resource Manager `testIamPermissions` using ADC and explicit company quota header returns `serviceusage.services.use` | Verified |
| Required APIs | All 13 required APIs enabled; requiredApiCount=13, enabledRequiredCount=13, missing=[] | Verified |
| Production readiness | No deployed behavior validated; later gates not executed | Blocked |

CLI read-back and ADC were verified separately. The earlier quota correction failed with `USER_PROJECT_DENIED`; no role grant was executed. After owner reauthentication, fresh local metadata confirmed the corrected quota project. An initial UserInfo request with a quota header returned HTTP 403 / `USER_PROJECT_DENIED`. The standard UserInfo request without that header confirmed the exact identity, and a separate Cloud Resource Manager permission test with the explicit company quota header succeeded. The final combined verification exited 0. These results resolve the credential blocker; they do not validate deployed workload authentication.

Required APIs already enabled: `sqladmin.googleapis.com`, `iam.googleapis.com`, `iamcredentials.googleapis.com`, `logging.googleapis.com`, `monitoring.googleapis.com`.

Newly enabled after owner approval: `run.googleapis.com`, `secretmanager.googleapis.com`, `artifactregistry.googleapis.com`, `cloudbuild.googleapis.com`, `compute.googleapis.com`, `servicenetworking.googleapis.com`, `cloudscheduler.googleapis.com`, `containerscanning.googleapis.com`.

The filtered project IAM read returned these roles for the named operator: `roles/accessapproval.admin`, `roles/accesscontextmanager.policyAdmin`, `roles/analyticshub.admin`, `roles/billing.projectManager`, `roles/iam.accessPolicyAdmin`, `roles/owner`. This is an inventory only, not a completed least-privilege review or evidence of ADC identity.

## Commands and evidence handling

All cloud reads and the ADC correction used the following explicit flags:

```powershell
--configuration=platinum-bleu --account=catherine@platinumbleutls.com --project=platinum-bleu-drive --billing-project=platinum-bleu-drive --quiet
```

Executed read operations: active-account listing; project description; project billing description; linked billing-account description restricted to `open`; enabled-service listing; project IAM policy filtered to the approved operator's roles. Local configuration descriptions and ADC metadata projections were also read. Account, project, billing and API state were freshly read again after the owner reported successful reauthentication.

Billing account identifiers and credential fields were not printed or retained in evidence. Billing lookup results were processed in memory. ADC checks output only metadata, match/permission booleans and sanitized error codes. For independent identity verification, an ADC token was obtained through gcloud, held only in process memory, and sent in HTTPS Authorization headers to Google. The Resource Manager permission request explicitly selected `platinum-bleu-drive` as quota project. Gcloud file logging was disabled for these commands. No access token was printed or saved by the verification script, and no service-account key was created or downloaded.

The first sandboxed authentication-list attempt failed on access to the gcloud credential database. The approved retry outside that filesystem restriction succeeded. This local sandbox failure is distinct from the later ADC permission failure.

## Mutations and approval boundaries

- Created and activated the local `platinum-bleu` gcloud configuration with the approved account and both project settings. The existing default configuration was not rewritten.
- The initial ADC quota correction failed. The owner subsequently completed interactive ADC authentication and quota-project setup; fresh checks now verify identity, quota project and quota permission.
- Added and updated this redacted evidence index only. No pre-existing application, deployment or runbook files were edited. Nothing was staged, committed or pushed.
- Enabled the exact eight approved prerequisite APIs. No explicit IAM grant, paid resource provisioning, OAuth consent setup, live provider connection, DNS change, deployment, deletion or financial submission occurred. Automatic Google service-agent side effects have not yet been inventoried.
- No Notion, HCP, QBO or other external operating record was changed. This file is technical handoff evidence, not a replacement operating record or a new policy.

## Completed owner handoff and approved API operation

The owner completed interactive ADC authentication in their normal PowerShell and browser and reported successful quota-project setup. Subsequent independent checks verified the result. The original handoff commands are retained for provenance; no repeat login is currently requested:

```powershell
gcloud auth application-default login catherine@platinumbleutls.com --configuration=platinum-bleu --project=platinum-bleu-drive --billing-project=platinum-bleu-drive
gcloud auth application-default set-quota-project platinum-bleu-drive --configuration=platinum-bleu --account=catherine@platinumbleutls.com --project=platinum-bleu-drive --billing-project=platinum-bleu-drive
```

These commands replace local ADC credentials and select the company quota project; they do not authorize the dashboard's application OAuth consent setup. If authentication or the quota correction fails, stop and report only the redacted error. Do not grant roles as a workaround. Any necessary IAM grant requires diagnosis, an exact proposed principal/resource/role, and specific approval.

Owner approved the exact eight missing prerequisite APIs below and continued program execution. This command was executed successfully in `platinum-bleu-drive` after fresh project and open-account billing checks:

```powershell
gcloud services enable run.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com compute.googleapis.com servicenetworking.googleapis.com cloudscheduler.googleapis.com containerscanning.googleapis.com --configuration=platinum-bleu --account=catherine@platinumbleutls.com --project=platinum-bleu-drive --billing-project=platinum-bleu-drive
```

Approval boundary satisfied: the owner replied, "yes. i approve all actions to get this completed." Operation `operations/acf.p2-531881403960-e280f480-076b-4c78-afe3-49894c868ce7` finished successfully. The delayed original read-back returned all 13 prerequisites and exit 0; no duplicate enablement was submitted. Continue Phase 2 preparation while preserving the exact-stage and final-production-package gates and secure owner credential entry.

Read-only diagnostic references: [Google ADC troubleshooting](https://docs.cloud.google.com/docs/authentication/troubleshoot-adc), [quota-project permissions](https://docs.cloud.google.com/docs/quotas/set-quota-project), and [Google UserInfo](https://developers.google.com/identity/openid-connect/reference).

Historical gate description: review the inventory and pass tests, checks, and credential detection before baseline work. CI ownership, exact stage approval, protected PRs, and environment controls were then proposed. The later GitHub Free decision supersedes unsupported controls; the subsequent implementation request authorizes the local signed baseline. Do not deploy the initial commit.

## Verification limits and closeout

Fresh Phase 2 validation completed: npm ci --no-fund installed 174 packages and audited 175 with zero reported vulnerabilities; npm test passed all 24 tests; npm run check passed JavaScript syntax and entrypoint-asset verification. The combined command exited 0. Application code remains unchanged. Full baseline secret scanning, container validation and deployed production tests remain incomplete. Earlier session test results are not reused as evidence.

The new evidence file was read back, checked with an untracked-file no-index whitespace comparison, and screened for selected credential and billing-identifier patterns with zero matches. This bounded evidence check is not a complete repository secret scan.

Git remains `main` with no commits, no staged files, and all existing files plus this evidence file untracked. Origin now points to the verified private `kirkseyhouse/platinumbleutls` repository. The separate website repository and non-Git workspace root were not edited. Production readiness is not established.

Recommended next task: complete the reviewed Git baseline and required GitHub controls. Recommended model/effort: GPT-6 Astra, high.

## Phase 2 initial inspection (historical; superseded where noted below)

**Phase 2: BLOCKED / OWNER-DECISION REQUIRED.** Missing Git governance gates prevent a baseline commit, push or progression into Phase 3. The owner authorized continued execution, but the exact company-owned private destination, independent reviewer and supported GitHub protection plan have not been established.

Fresh repository inventory: 41 untracked files, no commits, branch `main`, empty index and no remote. No unrelated files were edited or staged. Selected credential-pattern screening across all 41 files returned no matches. This is not a complete secret scan or completed source review. Source/deployment review is partial. `.github/CODEOWNERS`, CI and deploy workflows do not exist yet. No exact stage is ready for approval.

GitHub evidence:

- The connected GitHub profile is `kirkseyhouse`. Connector organization listing returned none; the local GitHub CLI additionally sees `Kirksey-House`.
- The CLI verified organization `Kirksey-House`, display name Kirksey House, plan `free`.
- Accessible repositories listed were `kirkseyhouse/cat-agent-system` (private, unrelated) and `kirkseyhouse/platinumbleutls` (public). Neither was selected as the dashboard destination.
- No authorized independent reviewer's GitHub handle or team is known.
- Effective Git author settings are inherited from the user's global configuration: name `styledbycatphillips-del`, email `catherine@kirkseyhouse.com`. No `commit.gpgsign`, `gpg.format` or `user.signingkey` setting was returned. No author identity or signing configuration was changed.
- Current official GitHub documentation says private-repository rulesets require Pro, Team or Enterprise, and required environment reviewers on Free/Pro/Team are restricted to public repositories. The runbook's private production environment with required reviewers therefore needs Enterprise capabilities. Dependency review for private repositories additionally requires Code Security or Advanced Security availability. No plan upgrade, financial action, repository creation, visibility change, collaborator grant or ruleset change occurred.

References: [rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets), [environment required reviewers](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), [dependency review](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review).

Local validation: Node `v24.15.0`, npm `11.12.1`. Docker CLI exists, but the Docker Desktop Linux engine named pipe was unavailable; no container validation was possible. `npm ci --no-fund` completed successfully: 174 packages installed, 175 audited, zero vulnerabilities reported. `npm test` passed all 24 tests with zero failures. `npm run check` passed syntax and entrypoint-asset verification. The combined command exited 0. npm reported a transitive uuid@9.0.1 deprecation warning; dependency changes were not made during this blocked baseline inspection. Ignored node_modules was regenerated. GitHub CLI experienced a TLS handshake timeout on its first identity read; subsequent organization/repository reads succeeded. Local filesystem-helper stalls also affected read and patch operations; the Phase 1 evidence update succeeded using a bounded PowerShell file replacement after apply_patch failed.

Required owner input: choose the company-owned private repository or organization with the necessary GitHub capabilities, name an authorized independent reviewer, and confirm the Git commit identity/signing arrangement. Preserve the private-repository and no-bypass gates. Do not substitute the public website repository or an AI self-review.

Next execution after these inputs: finish all untracked-file review and secret scanning; add the exact CODEOWNERS and pinned CI/OIDC deployment controls; complete clean install, tests, checks and container validation; present the exact stage for review; establish the signed baseline and verify remote protections without deploying it.

## Phase 2 GitHub settings read-back, 2026-09-18 07:18 America/Chicago

Owner instruction: "i made repo private. change any other settings you need in github. Next time, just fix it." This authorizes routine GitHub configuration without another general approval request. It does not remove the explicit financial, exact-stage or final-production gates.

Verified target: `kirkseyhouse/platinumbleutls`, repository ID `1370792585`, owner type User, `private=true`, default branch `main`, size 0 and no branches. The owner context selects this newly private repository for the dashboard. It is distinct from the website checkout's existing origin, `https://github.com/platinumbleutls/platinumbleutls.git`.

| Control | Before | Final read-back |
| --- | --- | --- |
| Visibility | Owner reported making private | Verified private; not changed by agent |
| Merge commits | Enabled | Disabled |
| Rebase merges | Enabled | Disabled |
| Squash merges | Enabled | Enabled; sole allowed merge method |
| Dependabot vulnerability alerts | Disabled, GET returned 404 | Enabled; GET succeeded |
| Actions full-SHA pinning | Not required | `sha_pinning_required=true` |
| Default workflow token permission | Read | Read, preserved |
| Actions may approve PRs | False | False, preserved |
| Private workflow access from other repositories | None | None, preserved |
| Rulesets | GET returned HTTP 403 | Blocked: GitHub says upgrade to Pro or make public; privacy preserved |
| Secret scanning and push protection | Unavailable | Enable attempt returned HTTP 422: secret scanning not available for this repository |
| Production environment | None | Not created without enforceable required protections |

Ruleset and secret-protection rejections came from GitHub feature availability, not Codex automatic approval review. No subscription purchase, visibility change, repository transfer, collaborator grant, commit, push, PR, deployment, or cloud change was made in this settings follow-up.

Fresh collaborator read-back found `kirkseyhouse` with admin permission and `platinumbleutls` with write permission. These are existing accounts; no access was granted. The company account is now a known reviewer candidate, but an independent human operator has not been established. Do not infer independence from a second login.

Local mutation: added `origin=https://github.com/kirkseyhouse/platinumbleutls.git` after verifying no existing origin and the exact private repository identity. Nothing was pushed. Commit author and signing configuration remain unchanged pending the signed-baseline gate.

The separate website repository was inspected read-only to prevent a remote mix-up. Git reported `main`, four existing modified documentation files, and untracked `AGENTS.md` plus `docs/handoffs/`. Its remote and all local changes were preserved.

Private branch rulesets need a supported plan; Pro alone does not satisfy the runbook's private production-environment required-reviewer gate. Current GitHub documentation limits required reviewers on Free, Pro and Team to public repositories. Private repository secret protection is also unavailable in the verified target. Resolve the account/repository capabilities without making source public or substituting a weaker approval gate.

No application tests were repeated for these GitHub-settings and evidence-only changes. The prior 24-test/check results remain explicitly dated prior evidence, not new production validation. Phase 2 remains blocked and no later phase was entered.

## Phase 2 GitHub Free compensating-control decision, 2026-09-18

Owner approved continued use of GitHub Free rather than purchasing a GitHub upgrade. The production-readiness runbook now treats GitHub as the private source and advisory CI host, not the enforceable production authorization boundary.

Verified GitHub plan limitations remain unchanged: private-repository rulesets returned HTTP 403 upgrade required; secret scanning and push protection returned HTTP 422 unavailable; private required-reviewer environments are unavailable on the current plan. The repository remains private. No unsupported GitHub control is represented as active.

Approved interim control architecture:

- Preserve the verified supported GitHub controls: private visibility, Dependabot alerts, full-SHA action pinning, read-only workflow tokens, workflows unable to approve pull requests, and squash-only merges.
- CODEOWNERS, pull requests, and GitHub CI provide review evidence but are advisory on this plan.
- Run a pinned Gitleaks scan locally, in GitHub CI, and again in Google Cloud Build.
- Give GitHub Actions no production service-account impersonation, production secrets, or Cloud Run deploy permission.
- Use `pb-dashboard-build` under `pb-dashboard-builder` to repeat clean install, tests, checks, secret scanning, image build, and vulnerability scanning, then publish an immutable digest. This identity cannot deploy.
- Use a separate `pb-dashboard-promote` trigger under `pb-dashboard-deployer` to deploy only the recorded digest. Create it from the reviewed `cloudbuild-promote.yaml` with `--inline-config` so production instructions are copied into the controlled trigger instead of loaded from a mutable repository file. The trigger must use `--require-approval`.
- Grant `roles/cloudbuild.builds.approver` only to the named human approver, never to builder or deployer service accounts.
- Record the promotion-config hash, build ID, commit SHA, digest, scan results, approval comment, approver, timestamp, and production revision.
- Until an independent approver exists, label approval as single-operator owner approval and retain MFA, action-time evidence review, audit logging, and alerts as compensating detective controls.

This historical decision removed a GitHub subscription upgrade as a Phase 2 prerequisite. At that checkpoint, the signed baseline, file review, pinned scans, Cloud Build configurations, distinct IAM identities and live promotion proof were still outstanding. No cloud resource, IAM role, build trigger, commit, push, or deployment was created by that documentation-only change. The implementation results below supersede the local-code portion of this checkpoint.

References: [GitHub ruleset availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets), [GitHub environment availability](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), [Cloud Build approval gates](https://cloud.google.com/build/docs/securing-builds/gate-builds-on-approval), [Cloud Build user-specified service accounts](https://cloud.google.com/build/docs/securing-builds/configure-user-specified-service-accounts).

## Phase 2 repository implementation, September 18, 2026

Authorization: owner requested synchronization of the Codex prompt and implementation of the signed baseline, pinned Gitleaks checks, GitHub CI, builder/promoter configurations and least-privilege IAM definitions, then instructed Codex to resolve signing setup. Work stayed in the dashboard repository. The previously unborn repository was moved from `main` to `codex/production-baseline` without discarding existing files. A worktree could not be based on a nonexistent commit.

Implemented: GitHub Free prompt synchronization; advisory CODEOWNERS; SHA-pinned CI; checksum-pinned Gitleaks 8.30.1; signed push/build verification; full-history retrieval through the dedicated Cloud Build repository connection; digest-pinned build containers and Node runtime; source provenance request and SBOM output; builder-only image publishing/scan gate; embedded inline promotion program; provider-pinned additive Terraform IAM; public signing trust file; explicit Docker/runtime input allowlist; activation handoff and access matrix.

Fresh local results before commit:

- Clean locked install succeeded: 174 packages. npm reported an existing transitive `uuid` deprecation; dependency compatibility was not changed in this scoped task.
- `npm test`: 26 passed, zero failed, including the scanner integrity/history cases.
- `npm run check`: passed JavaScript syntax and entrypoint assets.
- Python promotion tests: five passed, including wrong build identity, wrong trigger, failed build, mismatched digest/commit, absent source provenance, v2 connected-repository provenance, pending/rejected/wrong-owner approval and incomplete/high/critical/unknown scan rejection.
- Inline promotion rendering check passed. Reviewed YAML SHA-256: `b30e67fe5acb3bbba73a4963e57f97ab772a465555ab34a8dd8f9bc936251083`.
- Both build configurations passed the installed official Google Cloud SDK 578.0.0 config loader offline. This is schema/substitution-key validation, not a Cloud Build execution.
- Terraform 1.11.4 was downloaded to ignored local tooling after archive checksum verification. Google provider 6.50.0 was signature-verified and locked for Windows/Linux amd64. `terraform fmt -check` and `terraform validate` passed. No plan or apply was run.
- Gitleaks 8.30.1 working-tree scan passed with zero findings. Two earlier detections were ordinary documentation prose; wording was clarified and rescanned, with no allowlist or disabled rule. History scanning must run after the initial signed commit.
- Git intent-to-add exposed the complete 61-file initial inventory for diff/whitespace inspection. No private key, runtime file, Terraform state, customer export or dependency directory is part of that inventory. `git diff --check` passed. This review preserves the known application gaps; it is not independent production-security certification.
- GitHub live read-back reconfirmed private visibility, read-only workflow defaults, PR approval disabled for workflows, squash-only merges and enabled vulnerability alerts. GitHub settings were not changed.

Signing setup: no pre-existing local SSH signing key or public GitHub signing key existed; the GPG installation could not start its keybox daemon. Created a dedicated Ed25519 key outside Git, restricted its private file ACL to the current Windows account, preserved the existing author identity, and configured signing only in this repository. Public fingerprint and usage are in `baseline-controls.md`. GitHub signing-key registration was not performed; its existing CLI token lacks the required administration scope.

Execution limits: Docker Desktop's Linux engine was unavailable. No container build, GitHub CI run, Cloud Build run, Artifact Analysis image scan, live IAM enforcement test, deployment or production verification was performed. Trigger UUIDs and repository-resource input remain explicit fail-closed provisioning values. The promoter cannot pass the current password-style database configuration. Live SQL/OAuth/secret rotation/networking/recovery/provider/final-authorization gates remain unresolved.

External systems: read-only GitHub/public release/registry documentation lookups only. No GitHub push/settings write, Google Cloud resource/IAM/trigger mutation, Drive change, Notion change, or production deployment. The named Platinum Bleu Drive plugin had a local installation but no callable tools in this session; synchronization targeted the repository Codex prompt. No duplicate operating record was created.

Next task: review the concrete provisioning/trigger plan, complete IAM database integration and staging prerequisites, then obtain the runbook's exact live-change approvals. Recommended model/effort: GPT-6 Astra, high.
