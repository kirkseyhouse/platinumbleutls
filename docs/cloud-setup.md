# Cloud setup and activation contract

## Approved decision

Use Google Cloud Run and PostgreSQL rather than Sites. Preserve company-domain-only SSO. Do not substitute ChatGPT login, passwords, email links, guest access, or a development bypass.

## Selected project

- Project ID: `platinum-bleu-drive`
- Project number: `531881403960`
- Source: user supplied on September 16, 2026; exact project ID/number verified against Google Cloud; lifecycle ACTIVE, organization 801755082971.
- Use explicit `--project=platinum-bleu-drive --billing-project=platinum-bleu-drive` on project-scoped commands. Do not change global CLI defaults or deploy to the previously selected `khproject88`.

Verified successfully after approved Cloud Resource Manager API enablement:

```powershell
gcloud projects describe platinum-bleu-drive --project=platinum-bleu-drive --billing-project=platinum-bleu-drive --format="json(projectId,projectNumber,lifecycleState,parent)" --quiet
```

Require an exact project-number match before provisioning. Project selection does not itself authorize paid resources or changes to existing Drive configuration.

## Pending owner inputs

- CLI sign-in is restored as catherine@platinumbleutls.com. Enabled-services inventory succeeded on September 16, 2026. Cloud Resource Manager was enabled with explicit user approval; project number 531881403960 and organization parent 801755082971 are verified. Cloud Billing, IAM, and Cloud SQL Admin APIs are enabled and read back. Billing inspection confirms billingEnabled=false. Cloud Run and the remaining staging APIs could not be enabled until billing is linked; deployment permissions remain unverified.
- Approved billing budget and initial region. No paid resources have been provisioned.
- Exact company-managed email identities for DP and Tonya; Catherine's connected identity was `catherine@platinumbleutls.com`. Confirm application membership list before provisioning.
- Proposed hostname `ops.platinumbleutls.com` and authority to change its DNS. The public marketing website remains a separate project.

## Configure in staging first

1. Verify active account and project with explicit command-level project arguments. Do not change a user's global CLI project merely for convenience.
2. Create a dedicated application service account, separate worker identity, separate migration identity, and a CI workload identity. Grant only necessary Cloud SQL connection, object access, and individual secret-version access.
3. Provision PostgreSQL with regional availability, backups, point-in-time recovery, private connection plan, and restore testing. Run migrations with the migration identity, then apply runtime privileges. Runtime must not own tables or bypass RLS.
4. Register an internal Google OAuth client under the company Workspace organization. Use the exact HTTPS redirect `/auth/google/callback`. Store client secret and database connection in Secret Manager. Login scope is only `openid email`.
5. Approve each connector separately. Google connector callbacks are `/integrations/gmail/callback`, `/integrations/calendar/callback`, `/integrations/drive/callback`. QBO callback is `/integrations/quickbooks/callback`; bind its expected realm and environment. Set a separately generated 32-byte base64 token-vault encryption key through Secret Manager. Maintain a rotation plan before changing that key.
6. Build the Docker image from reviewed source; deploy by immutable digest. Fill the `REQUIRED_*` values in `deploy/cloud-run.yaml`. These placeholders are intentionally unprovisioned configuration, not deployment evidence.
7. Place service behind a managed external HTTPS load balancer. Restrict ingress to load-balancer/internal traffic and disable or reject unintended direct origins. Cloud Run transport access may need unauthenticated invocation for browser redirects, but the app still enforces Workspace authentication on all data routes. Verify this combination end to end before exposure.
8. Use managed certificate, approved DNS record, WAF, and edge rate limits. Cache only versioned public assets; all authenticated content remains `private, no-store`. Confirm TLS and direct-origin rejection. HSTS scope must not accidentally affect unverified sibling subdomains.
9. Deploy worker as an explicitly invoked Cloud Run Job, scheduled only after provider setup is approved. Set exact `TENANT_ID` and explicit `SYNC_PROVIDERS`; the default list is empty. One tenant per worker configuration. Overlapping runs must be prevented until provider-specific locking/staging is complete.
10. Establish error/queue-age/dead-letter alerts, budget alerts, recovery ownership, audit export, and a runbook. Confirm that logs omit secrets and client content.

## Resource limits

Starting template: one CPU, 512 MiB, maximum five web instances, eight concurrent requests per instance, five database connections per instance. These are proposed bounded defaults, not measured production capacity. At most 25 web database connections before adding workers/migrations. Upload body maximum is 20 MiB; tune concurrency and storage streaming based on measured memory. Do not raise instance counts without checking database connection capacity.

## Required launch proof

- Exact Google Workspace domain and membership restrictions tested with real company sign-in and an outside-domain denial; no alternate route.
- DP, Cat, and Tonya permitted and forbidden actions verified in deployed staging.
- Real PostgreSQL concurrent booking, tenant isolation, invoice immutability, session revocation, and import replay tests.
- Full safe test job through approved workflow; HCP coexistence mode unchanged unless cutover separately approved.
- Provider accounts, scopes, pagination, source ownership, retries, staleness and token refresh verified.
- Document scanner and recovery verified before uploads are enabled.
- Backup restore and rollback rehearsed; DNS and certificate checked; no public record endpoints or cache leakage.

Do not activate production merely because the container starts or a health probe passes.

## Approved staging API enablement - partial completion

Enable only these prerequisite services in the selected project: Cloud Billing (cloudbilling.googleapis.com), Cloud Run (run.googleapis.com), Cloud SQL Admin (sqladmin.googleapis.com), Secret Manager (secretmanager.googleapis.com), Artifact Registry (artifactregistry.googleapis.com), Cloud Build (cloudbuild.googleapis.com), IAM (iam.googleapis.com), Compute Engine (compute.googleapis.com), and Cloud Scheduler (cloudscheduler.googleapis.com).

This proposed action enables service APIs only. Resource creation, builds, secrets, IAM grants, billing linkage, DNS, deployment, and scheduled jobs are separate actions and are not included. The Cloud Resource Manager API is already enabled and its project-read result was verified.

## API enablement result

The user approved all nine prerequisite APIs. Google rejected the combined request because no billing account is linked to project 531881403960. A separate request enabled cloudbilling.googleapis.com, iam.googleapis.com, and sqladmin.googleapis.com; an enabled-services read-back confirmed all three. iamcredentials.googleapis.com also appeared in the resulting enabled list.

Still pending billing: run.googleapis.com, secretmanager.googleapis.com, artifactregistry.googleapis.com, cloudbuild.googleapis.com, compute.googleapis.com, cloudscheduler.googleapis.com. Approval to enable these persists; do not ask again after billing is restored. Billing read-back returned billingEnabled=false. No application resources were created and no billing account was linked.

Next owner action: reopen the linked billing account or select an active intended company billing account in https://console.cloud.google.com/billing/linkedaccount?project=platinum-bleu-drive . Do not select a Kirksey billing account by inference. Resource creation and its budget remain separate approval steps.

## Billing follow-up

After the user reported billing linked, live read-back confirmed a billing-account link exists, but project billingEnabled remains false. The linked account display name is My Billing Account and its account status is open=false. No account or payment changes were attempted. The blocker is account activation, not a missing project link. Reopen that account or link an active authorized company account, then recheck billingEnabled before retrying the six already-approved APIs.
