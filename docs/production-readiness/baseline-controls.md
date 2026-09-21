# Phase 2 implementation and activation contract

The September 18 implementation request authorizes repository preparation and the local signed baseline. It does not authorize cloud resource creation, live IAM grants, trigger creation, a GitHub push, or deployment. This document is the implementation handoff; the production runbook remains the phase authority.

## Implemented controls

| Surface | Implementation | Enforcement boundary |
| --- | --- | --- |
| Git | Dedicated local Ed25519 signing identity, public allowed-signers file | Local verification; GitHub key registration is separate |
| GitHub | SHA-pinned checkout/setup-node, read-only token, full history, clean install, tests, checks, Gitleaks, promotion tests, generated-config drift check, signed push verification | Advisory on GitHub Free; no cloud credentials |
| Scanner | Gitleaks 8.30.1, SHA-256-verified Windows/Linux release archives, full default rules | Eligible working files plus all fetched history; no blanket exemptions |
| Builder | Dedicated builder, read-only source token, full branch/tag history, signature check, repeated tests/scans, digest-pinned build tools/base image, SBOM, Artifact Analysis gate, verified provenance requested | Can publish to pb-dashboard; cannot deploy |
| Promoter | Python program embedded directly in controlled inline YAML | Requires named approval, exact source provenance, successful trusted build, published digest and completed scan |
| IAM | Pinned Google Terraform provider and lockfile, additive member grants, five keyless service accounts | Definitions validated locally; no grants applied |

Gitleaks scans files eligible for Git, including untracked initial files. Ignored local files are not claimed clean. Docker uses an explicit input allowlist; local secrets, tests, tooling, Terraform state, CI definitions and documentation do not enter the runtime build context. The scanner deliberately refuses shallow Git history and checks its downloaded archive before every extraction.

The Cloud Build builder expands the connection-provided Git checkout using a read-only repository token held only in memory and a child process environment. It never writes that token to a URL, command argument, file or log. The dedicated connection should contain only this repository. Manual archive submissions lack required Git metadata and are intentionally unsupported. The supported path is a Cloud Build v2 repository trigger.

The promoter's image, service name, project, region, service accounts, human approver and trigger IDs are administrative configuration, not caller-controlled substitutions. Caller inputs are the exact commit SHA, digest and successful builder build UUID. Missing trigger IDs intentionally stop execution until approved provisioning supplies them. The program uses Cloud Build's immutable build results to link the commit and digest, then rereads Artifact Analysis. Empty, unfinished, unsupported, failed, high, critical and unknown scans cannot authorize a revision. No vulnerability exception bypass is implemented.

An approved promotion updates the existing `pb-dashboard` image with `--no-traffic`. It does not bootstrap configuration, apply IAM, run migrations, change provider mode, or shift traffic. Revision readiness, actual digest read-back and smoke tests remain required before a separately authorized traffic shift. An asynchronous update accepted by Cloud Run is not proof that the revision became ready.

## Local signing

The existing Git author identity is preserved. A repository-specific Ed25519 key was created outside the repository at `C:\Users\cphil\.ssh\platinum-bleu-dashboard-signing`; its private file has inherited access removed and an explicit full-control grant only for the current Windows account. It has no passphrase and relies on local account/file protection, so hardware-backed or passphrase-protected signing remains a future hardening option. The private material is never included in Git or evidence.

Public fingerprint: `SHA256:ePWy+aZ1yRrfZN00Y+4qvAxb8rrCi693/9DMTa5yFWM`.

`deploy/allowed-signers` holds only the public key. Repository-local settings select SSH signing and the local trust file. Verify with:

```powershell
git -c gpg.format=ssh -c gpg.ssh.allowedSignersFile=deploy/allowed-signers verify-commit HEAD
git show --no-patch --show-signature HEAD
```

No GitHub signing-key registration was performed. The current CLI authorization lacks signing-key administration scope. A valid local signature does not claim GitHub's Verified badge. If registering later, upload only the `.pub` file through the owner's GitHub signing-key settings, confirm the fingerprint, and keep this repository-specific key distinct from SSH authentication credentials.

## Approved future provisioning sequence

First prove cloud account/project/billing and obtain approval for the exact resources, cost and IAM plan. Create or import the workload identities, dedicated log buckets, Artifact Registry with vulnerability scanning, Cloud Build connection and existing secured Cloud Run service through approved provisioning. Use [IAM definitions](../../deploy/iam/README.md) and [access matrix](access-matrix.md). Review inherited roles as well as the additive Terraform plan.

The SQL IAM connector, database bootstrap/runtime grants, Direct VPC template, and promotion checks are implemented and locally tested. Live Cloud SQL enforcement, numbered secret creation/binding, VPC/firewall validation, real OAuth, backup/recovery and provider gates must still pass before a production promotion. The deployment template retains deliberate unresolved image and numbered-secret placeholders, and the promoter rejects password-style database configuration, wrong origin/network/identity, unnumbered OAuth secrets, and configuration drift.

After source has been explicitly authorized for push and is available at the exact reviewed commit, create the builder trigger using the supported v2 connection and `cloudbuild.yaml`. Set `_REPOSITORY_RESOURCE` to its exact resource name. Record the builder trigger UUID and a successful build ID, commit, image digest, scan/SBOM results and configuration hashes.

Create the promoter from the generated, reviewed inline configuration after provisioning approval. Example, with the approved repository resource supplied by the operator:

```powershell
gcloud builds triggers create manual --name=pb-dashboard-promote --region=us-central1 --repository=$PbApprovedRepositoryResource --branch=main --inline-config=cloudbuild-promote.yaml --require-approval --service-account=projects/platinum-bleu-drive/serviceAccounts/pb-dashboard-deployer@platinum-bleu-drive.iam.gserviceaccount.com --project=platinum-bleu-drive --billing-project=platinum-bleu-drive --configuration=platinum-bleu
```

The initial trigger is fail-closed because its two trust IDs are unresolved. Read back the generated trigger UUID. Set `BUILD_TRIGGER` and `PROMOTE_TRIGGER` in `scripts/promotion.py`, rerun its tests and `python scripts/render-cloud-build.py`, review/sign the configuration change, and replace the trigger's inline payload with the reviewed file using `gcloud builds triggers update manual ... --inline-config=cloudbuild-promote.yaml --require-approval`. Do not run a build from an unresolved configuration. Do not replace inline configuration with a source filename.

Before invocation, hash the local YAML and compare the exported trigger's embedded `build` object with the reviewed JSON/YAML content; account for server-populated defaults explicitly. Confirm its service account, exact connection, approval requirement, human approver binding, and absence of caller-controlled trust anchors. Triggered builds use the trigger's service account and force loose substitution handling, so the Python validations enforce inputs independently of `MUST_MATCH`. Record trigger-admin ownership. Hashing a local file alone does not establish the deployed trigger contents.

The human approval must record build UUID, source commit, exact image digest, promotion-config hash, evidence link and approval timestamp. Test that an unapproved promotion stays pending, builder cannot deploy, deployer cannot publish/read runtime secrets/approve, malformed digest fails, mismatched provenance fails, failed scan blocks, and an approved revision contains the recorded digest with no unexpected traffic change. Only those live tests complete the Cloud Build/IAM portion of Phase 2.

## Verification limits

Local JavaScript and Python tests, Terraform provider validation, schema decoding and Gitleaks are useful evidence. No GitHub Actions run, Cloud Build run, IAM denial test, Artifact Analysis scan, image deployment, real provider test or production smoke test has occurred in this implementation session. Docker Desktop's Linux engine was unavailable, so container build execution remains unverified. Runtime SQL, OAuth, secrets/rotation, DNS/TLS, recovery, provider behavior and final production authorization remain open.

Official references: [Cloud Build schema and provenance](https://docs.cloud.google.com/build/docs/api/reference/rest/v1/projects.builds), [manual inline triggers](https://docs.cloud.google.com/sdk/gcloud/reference/builds/triggers/create/manual), [repository read-token API](https://docs.cloud.google.com/build/docs/api/reference/rest/v2/projects.locations.connections.repositories/accessReadToken), [Gitleaks releases](https://github.com/gitleaks/gitleaks/releases).
