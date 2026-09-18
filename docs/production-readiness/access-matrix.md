# Proposed dashboard access matrix

Status: definitions only, no grants applied by this implementation. Owner for review: Catherine. Grant/expiry/last-use fields remain pending live approval and read-back. Review quarterly and after any incident or identity change.

| Principal | Exact grant | Resource | Excluded |
| --- | --- | --- | --- |
| pb-dashboard-runtime | SQL client + instanceUser | Condition: pb-prod-sql only | Build/deploy/IAM/migration ownership |
| pb-dashboard-worker | SQL client + instanceUser | Condition: pb-prod-sql only | Build/deploy/IAM/unrelated secrets |
| pb-dashboard-migrate | SQL client + instanceUser | Condition: pb-prod-sql only | Runtime attachment/provider credentials |
| Runtime/worker | secretAccessor | Only approved `secret_consumers` map entries | Default map empty; no project-wide grant |
| pb-dashboard-builder | artifactregistry.writer | us-central1/pb-dashboard | Deploy/runtime secrets/DB/approval |
| pb-dashboard-builder | storage.objectCreator | platinum-bleu-drive-pb-build-logs | Other buckets/overwrite/delete |
| pb-dashboard-builder | cloudbuild.readTokenAccessor | Dedicated reviewed repository connection | Repository writes/other connections |
| pb-dashboard-deployer | artifactregistry.reader | us-central1/pb-dashboard | Image writes/builds |
| pb-dashboard-deployer | run.services.get/update custom role | Existing us-central1/pb-dashboard | Service creation/IAM changes |
| pb-dashboard-deployer | serviceAccountUser | Runtime and worker identities only | Migration/builder attachment/tokenCreator |
| pb-dashboard-deployer | cloudbuild.builds.get custom role | Project | Submit/edit/approve builds |
| pb-dashboard-deployer | storage.objectCreator | platinum-bleu-drive-pb-promote-logs | Other buckets/overwrite/delete |
| Builder/deployer | containeranalysis.occurrences.viewer | Project | Scan metadata writes/admin |
| catherine@platinumbleutls.com | cloudbuild.builds.approver | Project | No service-account approver grant |
| GitHub Actions | contents: read | Source repository | All production Cloud access |

All workload accounts are keyless. Human approval is single-operator owner approval until a separate reviewer is approved. Human operators, trigger administration, state administration, organization inherited roles, break-glass and platform service-agent access require separate review. Record actual granted timestamps, policy hashes, revocation tests and owner acceptance here after provisioning. The definitions alone do not establish least privilege in a live project.
