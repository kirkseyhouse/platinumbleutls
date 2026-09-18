# Dashboard build checkpoint â€” September 16, 2026

## HANDOFF

**Owner:** Catherine / Platinum Bleu application owner.

**What I need from you:** Activate the linked billing account or select an active authorized company account for the verified project `platinum-bleu-drive` (project number `531881403960`). Do not send passwords or secrets in chat. Cloud billing, OAuth configuration, provider grants, DNS, and activation remain separate setup actions.

**What I am delivering:**
- Private operational dashboard source with Google Workspace domain and membership enforcement, role restrictions, customer import, leads, job/resource workflows, draft invoices, private document scaffolding, and audit.
- Added assignment management, guarded start/complete/cancel transitions, full-record overview counts, invoice draft editing, and explicit Chicago timezone handling.
- HCP full-refresh validation before atomic publication: snapshots, customer/job projections, and success state commit together. Pagination/mapping failures preserve the prior dataset. Bounded staging rejects oversized refreshes; source deletion handling remains incomplete.
- PostgreSQL migrations, Docker/Cloud Run templates, cloud setup guide, and detailed target architecture.
- Automated test and syntax results, with production gaps recorded in README.

**Blockers:** Project selection is supplied; company CLI sign-in and enabled-services inventory are verified; exact project ID/number and ACTIVE status are verified after approved Cloud Resource Manager API enablement. Cloud configuration, live app OAuth, runtime database, and provider grants remain pending. Full bidirectional accounting, document scanning, incremental Google sync, and production recovery still require implementation/validation. Browser review of the latest invoice/job interactions was blocked by automatic approval review because its selected model was at capacity.

**Definition of done:** DP, Cat, and Tonya sign in through company-only SSO to deployed staging and complete their permitted workflows against verified PostgreSQL/provider integrations, with security, recovery, and owner-approved production activation evidence.

**Links:** [README](../README.md), [architecture](architecture.md), [cloud setup](cloud-setup.md), [existing Notion HQ](https://app.notion.com/p/3d8401438e5081e18352cf276fd2b344).

**Changed files:** New repository under C:/dev/Platinum Bleu/platinum-bleu-dashboard. src/, public/, migrations/, scripts/, tests/, deploy/, package files, README, and docs. Marketing website repository unchanged.

**Validation performed:** npm test: 24 passed, zero failures. npm run check: JavaScript syntax and entrypoint assets passed. Tests use PGlite with PostgreSQL constraints; no live Cloud SQL or real OAuth validation. New HCP test proves pagination and mapping failure rollback. Current browser DOM inspection confirmed authenticated synthetic overview renders; previous desktop/mobile visual checks and customer creation were completed. Latest invoice editing, job action, and CSV modal browser interactions remain unverified.

**Implementation evidence:** tests/application.test.js exercises authenticated API roles, tenant isolation, scheduling overlaps, invoice immutability, imports, webhook retries, assignments, lifecycle transitions, summary counts, and HCP refresh rollback. tests/time.test.js covers Chicago summer/winter and DST gap/fold rejection. The synthetic QA session was manually installed in a local browser for testing only; its server was stopped, making the session unusable. Its localhost cookie may remain in that browser until overwritten/cleared. No production login bypass exists.

**Repo state:** main, no commits, no remote/push/deployment; new files remain untracked. No production URL. The locally started 8080 and 8082 processes were stopped at this checkpoint. An older 8081 process was not stopped because its identity could not be confirmed.

**Notion sync required:** No external write performed. This dashboard has no verified dedicated build record. If tracking is requested, use the existing Platinum Bleu Operations Intake & Triage; do not mark the public Website Implementation Dashboard as completion evidence for this separate app.

**Recommended next action:** The billing link exists, but its account reports open=false and project billingEnabled=false. Activate the account or select an active authorized company account. Approved API enablement is partial: Billing, IAM, SQL Admin are enabled; the remaining six require billing. No application resources were provisioned.

**Cloud update:** Cloud Resource Manager API enabled with explicit approval; successful project read matched 531881403960. Billing API is disabled, so billing status remains unknown. No paid resources, IAM grants, or deployment were created.

**Latest cloud result:** Approved API enablement partially succeeded. Enabled and read back Billing, IAM, and Cloud SQL Admin. Google blocked six remaining APIs because billing is disabled. No billing account linkage, database, application deployment, or IAM grants were performed.

**Billing follow-up:** The project is linked to My Billing Account, but account open=false and project billingEnabled=false. No billing mutation was performed. Remaining approved API enablement is still blocked.
