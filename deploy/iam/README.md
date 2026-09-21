# Reviewed IAM definitions, not applied

This Terraform root creates five keyless workload identities and additive IAM members. It does not create paid runtime resources, grant GitHub access, assign primitive roles, or replace complete IAM policies. An apply requires a reviewed plan and explicit owner approval. Import any pre-existing matching service accounts/custom roles before planning; never recreate them blindly.

Prerequisites are existing `pb-dashboard` Artifact Registry, `pb-dashboard` Cloud Run service, the two dedicated log buckets, the reviewed Cloud Build v2 repository connection, approved secrets, and `pb-prod-sql`. Bootstrap these through separate approved provisioning. The promoter can update an existing service but cannot create one. Enable uniform bucket-level access and audit settings during approved bucket provisioning. Google cautions against retention policies on the active Cloud Build log destination. Use separate retained audit storage/export for durable evidence, and never remove an existing retention policy to make this configuration work. Final-only logging avoids ongoing log-object overwrites; verify objectCreator suffices during the first authorized build.

Run from this directory:

```powershell
terraform init -backend=false
terraform fmt -check
terraform validate
# Only after fresh cloud identity/context read-back:
terraform plan -var='repository_connection_name=APPROVED_CONNECTION_NAME' -out=reviewed.tfplan
```

Keep plan/state/tfvars files out of Git. Choose a protected remote state backend before applying; the local validation configuration does not establish state security. No apply command is part of this task.

Review `secret_consumers` explicitly; its default is empty. SQL IAM grants are conditional on the primary instance. Terraform defines the IAM DB users; `deploy/database-bootstrap.sql` and `deploy/runtime-role.sql` define PostgreSQL membership and runtime non-ownership. Those database controls remain unapplied until an authorized live activation.

Resource-level Artifact Registry writer and reader grants isolate build and deployment. Each identity can create objects only in its own log bucket. Container Analysis occurrence reads and build metadata reads are project-level API requirements; they reveal project metadata and are recorded exceptions to narrower resource scope, not write/admin capabilities. The dedicated repository connection should contain only this repository: its read-token grant can read every repository attached to that connection. The token is short lived and read only.

`run.services.update` cannot be restricted to an image field by IAM. The reviewed inline promotion program supplies only an exact digest and no-traffic update. Protect trigger administration and audit changes because that administrative boundary enforces this restriction. Service Account User permits attachment of runtime/worker, not standalone OAuth token minting. There are no worker-job update privileges yet; add narrowly scoped job permissions only with an approved worker deployment design.

Cloud Build's Google-managed service agent and Cloud Run's service agent have platform responsibilities. Verify their existing roles and required same-project image access during provisioning. Do not assign their service-agent roles to workload identities. Human trigger administrators/operators and their exact actAs requirements are a separate approved access decision. Neither builder nor deployer has builds.create, trigger edit, IAM mutation, secret access, signing keys, tokenCreator, or approval permission.

The human approver role is project scoped. Use a dedicated project boundary and read back all inherited/organization grants: additive Terraform cannot revoke privilege inherited elsewhere. Negative live tests must prove the builder cannot deploy, the deployer cannot publish an image/read secrets/approve, and unapproved promotion remains pending.

References: [Cloud SQL IAM conditions](https://docs.cloud.google.com/sql/docs/postgres/iam-conditions), [Cloud Build approval](https://docs.cloud.google.com/build/docs/securing-builds/gate-builds-on-approval), [user-specified build identities](https://docs.cloud.google.com/build/docs/securing-builds/configure-user-specified-service-accounts).
