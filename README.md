# Platinum Bleu team dashboard

Private operational application for DP, Cat, and Tonya. Target: Google Cloud Run + PostgreSQL. Only approved `platinumbleutls.com` Google Workspace identities may create application sessions.

**Status: local implementation in progress; not deployed or approved for live company data.** No production URL exists. Selected project: `platinum-bleu-drive` / `531881403960` (exact ID/number verified against Google Cloud; project ACTIVE; company CLI sign-in verified). The cloud CLI previously selected a Kirksey account/project; use explicit project arguments. User approval to use Cloud Run/PostgreSQL does not authorize billing, DNS changes, Google consent, or a Housecall Pro replacement cutover.

## Implemented

- Google OIDC code flow with PKCE, state, nonce, signed ID-token validation, exact hosted-domain and email checks, pre-provisioned membership, hashed server sessions, CSRF, idle/absolute expiry, permission-version revocation, and suspension.
- Owner, Operations, Bookkeeper, Estimator, Crew, and Subcontractor roles. Assignment restrictions apply to field roles. Subcontractors still require a company-managed domain account.
- Customer creation and CSV staging/import with exact contact duplicate checks, durable idempotency, and safe retry.
- Lead pipeline with next action, owner, stage, and follow-up date.
- Job drafting, owner-attested agreement/deposit gates, resource reservations with PostgreSQL overlap exclusion, and guarded start/complete/cancel transitions. Completion/cancellation releases reservations.
- App visibility assignments, separate from production resource reservations.
- Invoice drafts, multi-line editing, server-side integer amount calculation, optimistic locking, approval, and a database guard against alteration of issued financial content.
- Role-filtered overview counts across all records, source labels, empty/error states, audit trail, connection health, and existing Notion HQ link.
- Private document metadata, quarantined upload, type/size checks, and authenticated streaming for scan-approved files. There is **no deployed scanner yet**; uploads cannot become usable without an approved scanning implementation.
- Encrypted OAuth token vault; Google and QBO consent handlers; bounded read-only provider synchronization adapters; QBO/Gmail authenticated webhook receivers, durable deduplication, retries, and dead-letter state.
- Docker image recipe, Cloud Run service template, migration runner, separate runtime-role template, and secure membership provisioning CLI.

## Deliberate operating boundaries

`OPERATIONAL_MODE=hcp_coexistence` is the default. It locks custom production scheduling and job-status commands. HCP remains the authoritative quote-to-cash system. Local customer/job/invoice entries are drafts and must not become a competing live ledger. An owner-approved cutover is required before setting `custom`.

Invoices can be drafted and approved, but **sending/issuing, credit/void workflows, payments, and bidirectional QBO writes are not implemented**. No app balance should be treated as reconciled accounting. The accounting endpoint exposes read-only provider snapshots when configured.

Do not interpret a connector in Codex as authorization or credentials for this app. Real data import and connector grants require explicit company-owned setup. No live data was imported during development.

## Run locally

Requires Node 24 (the checked runtime), npm, and PostgreSQL with `btree_gist`. Use a dedicated development database. PGlite is used only by isolated tests, never production.

1. `npm ci`
2. Create an ignored `.env` using `.env.example`. Configure an approved OAuth client, exact app origin, and database through a secure local mechanism. Never paste secrets into chat.
3. `npm run migrate` with a migration-owner connection.
4. Apply `deploy/runtime-role.sql` as the migration owner and grant its role to a separately provisioned application login. Set `DATABASE_URL` to that runtime login.
5. Provision exact approved identities: `npm run provision -- <company-email> "<name>" <role>`. Do not guess DP's or Tonya's email. Cat's role is `ops`; Tonya's is `bookkeeper`.
6. `npm start` starts the sign-in surface. Without required configuration, authentication/data access fail closed.

Secure `__Host-` cookies require HTTPS in production. Browser handling of localhost secure cookies must be verified with the actual development OAuth setup; do not weaken cookie settings as a workaround. The production process rejects database superusers, RLS-bypass roles, and table-owning runtime logins.

## Validation

```sh
npm test
npm run check
```

Tests exercise real PostgreSQL semantics via PGlite, including migrations, row security, exclusion constraints, transactional rollback, immutable invoice content, API permissions, replay/idempotency, token encryption, and webhook retry handling. They do not prove Cloud SQL behavior, Google consent, a deployed service, or live provider compatibility. A real PostgreSQL/Cloud SQL staging run remains mandatory.

`tests/browser-fixture.mjs` is an isolated localhost-only synthetic QA harness, excluded from the Docker image. It creates test sessions directly in an in-memory test database. It adds no application login route and must never be published or used with a real database. `.runtime`, screenshots, browser profiles, and test session files are ignored.

## Known gaps before production

1. Company-owned Google Cloud project, billing approval, OAuth internal app, exact member identities, secret provisioning, Cloud SQL, managed HTTPS/load-balancer/DNS, monitoring, and restore drill.
2. Real OIDC login/revocation test. App suspension revokes sessions, but automatic Workspace account-suspension reconciliation is not implemented. Enforce provider MFA administratively and validate the required lifecycle integration.
3. Live connector validation and scopes/account ownership. QBO webhook receiver implements a specific `eventNotifications` envelope; confirm the configured Intuit delivery version before enabling it. Unsupported envelopes are rejected.
4. Full financial lifecycle and approved bidirectional QBO mapping, including single-writer ownership while HCP is active. Existing HCP–QBO integration has not been inspected.
5. Malware scanner, approved file-retention policies, legal holds, object/database recovery, and orphan-upload reconciliation.
6. Gmail currently reads up to 100 inbox message metadata records. History cursor processing/watch renewal is not implemented. Calendar reads a bounded past/future window; outbound federation, incremental cursors, watch renewal, and deletion reconciliation remain incomplete. Drive lists authorized files under a designated folder; full change-feed/tombstone sync is incomplete. Notion currently provides an existing HQ link and a root-page metadata adapter, not embedded private content or task writes.
7. Read-only HCP adapters require actual endpoint/pagination verification, removal/tombstone handling, and performance tests before activation. HCP refreshes stage both collections within a 32 MB / 10,000-record-per-collection limit, then atomically publish snapshots, projections, and success state. Invalid pagination or a mapping failure preserves the previous dataset. These local checks do not establish that provider pagination is a point-in-time snapshot.
8. List views are limited to 200 rows; overview aggregates are complete. Cursor pagination, large-import review, named duplicate resolution, monitoring/dead-letter UI, and scale testing remain required for growth.
9. Multi-region recovery, distributed rate-limit enforcement, audit export/immutability outside the app database, scoped database service privileges, and formal security review.

The detailed target architecture is in [docs/architecture.md](docs/architecture.md). It describes the intended complete platform, not a claim that every item is implemented.

## Source and ownership

The existing operational record is [Platinum Bleu HQ](https://app.notion.com/p/3d8401438e5081e18352cf276fd2b344). Current task changes do not update Notion, HCP, accounting, Drive, DNS, or cloud resources. Keep those systems unchanged until their corresponding integration/cutover actions are authorized.
