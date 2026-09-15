# Platinum Bleu Next.js Website Design

**Status:** Written specification for Catherine's review  
**Date:** September 14, 2026  
**Repository:** `C:\dev\Platinum Bleu\platinum-bleu-site`  
**Production domain:** `https://platinumbleutls.com`  
**Locale:** `en-US`

## 1. Purpose and decision

Build a private, Git-controlled Next.js website that can replace the current WordPress site without changing the public site until Catherine approves a separate production cutover. Catherine must be able to edit public content through either Codex or a protected browser editor. Both editing paths must change the same repository, receive a preview, and pass review before production.

This specification accepts the consolidated architecture in the handoff as the approved direction. It authorizes design documentation only. It does not authorize application scaffolding, public copy changes, a remote repository, Vercel project creation, external account creation, production deployment, DNS changes, analytics changes, Housecall Pro writes, test messages, or WordPress changes.

### Selected approach

Use one private Git repository containing the Next.js application, typed route registry, content, legacy URL ledger, tests, and operational documentation. Next.js 16 App Router and React 19 render the public site; Vercel builds previews and production; Keystatic GitHub mode writes browser edits to review branches in the same repository; Cloudflare remains registrar and authoritative DNS with web records set to DNS-only.

### Alternatives considered

1. **Selected: Next.js plus Keystatic GitHub mode in one repository.** This meets both editing requirements without creating a second public-content database. Git history, pull requests, previews, and deployment state remain connected.
2. **Rejected: external headless CMS.** This adds another content authority, account, permission model, webhook path, and failure surface without a demonstrated need.
3. **Rejected: Git/Codex editing only.** This is simpler technically but fails the protected browser-editor requirement.

Keystatic Cloud is not part of the initial design. GitHub mode already supplies repository-backed authentication and branch-aware editing. Adding Keystatic Cloud later would require a separate approval based on a demonstrated collaboration need.

## 2. Authoritative sources and current evidence

Implementation decisions must use current sources in this order:

1. Catherine's approved handoff and later explicit approvals.
2. Current repository files and reviewed content/URL ledgers.
3. `docs/migration/PLATINUM-BLEU-NEXTJS-SEO-MIGRATION-STRATEGY.md`.
4. The public September 9 baseline in `docs/migration/baseline/wordpress-2026-09-09/`, especially `public-crawl.json`, `page-sitemap.xml`, and the saved public HTML.
5. The restricted authenticated audit that remains in `C:\dev\Platinum Bleu\outputs\wordpress-audit-2026-09-09\`, especially `MEETING-BRIEF.md` and the access/infrastructure evidence.
6. Current live responses from `https://platinumbleutls.com`.
7. Current primary vendor documentation for Next.js, Vercel, Keystatic, Cloudflare, Google, and Housecall Pro.

The strategy remains authoritative except where the approved handoff deliberately supersedes it. The important superseding decisions are:

- public Git-backed content is generated at deployment time, without initial ISR or on-demand revalidation;
- Cache Components stay disabled initially;
- the shared root layout must not declare a homepage canonical;
- `lang="en-US"` is required and `hreflang` is omitted until real alternate-language URLs exist;
- lead delivery is best-effort dual delivery with an explicit partial-delivery reconciliation path;
- the Cloudflare control migration and Vercel web cutover are separate events.

### Verified baseline

- The saved September 9 sitemap and crawl contain 17 public routes, all returning HTTP 200 at capture time.
- The homepage had one H1; the other 16 routes had two H1 elements.
- Privacy, About, Services, Contact, and Service Areas lacked meta descriptions in the saved crawl.
- Each crawled route had a self-canonical at capture time.
- The sampled schema graphs lacked a `LocalBusiness` or `HomeAndConstructionBusiness` entity.
- The inspected GA4 property had no data stream and the inspected GTM workspace had no tags.
- The September 9 owner-controlled Cloudflare zone showed DNS-only apex and `www` A records targeting `62.72.53.7`, plus email and verification records.
- On September 14, public DNS still delegated to `alina.ns.cloudflare.com` and `guss.ns.cloudflare.com`; those authoritative servers returned apex addresses `199.16.172.3` and `199.16.173.214`. The Catherine-controlled `dina.ns.cloudflare.com` and `rex.ns.cloudflare.com` zone returned `62.72.53.7` for the apex. This difference makes the control move a distinct, carefully verified migration event.
- The live homepage displayed `(501) 404-8887`. It also displayed `info@platinumbleu.com`, while the approved replacement public email is `services@platinumbleutls.com`.
- The live homepage contained claims including “over 5 years,” “licensed and insured,” “certified arborists,” “24/7,” and “same-day service.” The audit did not verify those claims.

The current public phone is `(501) 404-8887`. The current approved public email is `services@platinumbleutls.com`. The lead notification inbox is `catherine@platinumbleutls.com` and is server-only configuration, not editable public content.

## 3. Scope boundaries

### Included in the implementation project after spec and plan approval

- A local Next.js 16.x, React 19, TypeScript application on Node.js 24.x.
- All 17 current routes, the exact trailing-slash convention, and a complete historic URL ledger.
- Static, initial-HTML public content with responsive, accessible templates.
- Centralized routes, metadata, schema, robots, sitemap, redirects, and status handling.
- Git-backed content and a protected Keystatic GitHub-mode editor.
- A first-party estimate form with mockable Housecall Pro and transactional-email adapters.
- A lazy-loaded native Housecall Pro booking launcher.
- Analytics-safe conversion events and deduplication behavior.
- Automated build, SEO, route, accessibility, responsive, integration, and secret-safety checks.
- Preview, cutover, rollback, monitoring, and WordPress-retention runbooks.

### Excluded unless separately approved

- New public claims, prices, hours, service areas, testimonials, ratings, awards, licenses, or certifications.
- Mass-generated city/service combinations.
- A customer database, custom CRM, durable outbox, external headless CMS, or custom booking engine.
- Production DNS, nameserver, DS/DNSSEC, registrar, Cloudflare, Vercel-domain, WordPress, GA4, GTM, Google Ads, GBP, or Housecall Pro changes.
- Creating or connecting a GitHub repository before Catherine selects the owning personal account or organization.
- Live lead, customer, booking, email, or form submissions without action-time approval.
- Deleting or changing local backups, WordPress recovery material, or the existing public origin.

## 4. Repository and application architecture

### Repository boundary

`C:\dev\Platinum Bleu\platinum-bleu-site` is the application repository. `C:\dev\Platinum Bleu` remains a non-Git evidence/document workspace. The migration strategy and public crawl/sitemap/HTML/header baseline live under `docs/migration/`. Authenticated audit evidence, access records, forensic material, and raw backups stay outside the child repository.

The repository must ignore framework output, `.env` files, `housecall-api.txt`, `*api-key*`, private keys, recovery codes, customer data, WordPress backups, database exports, and raw backup directories. Secret scanning runs in local verification and continuous integration. The existing `C:\dev\Platinum Bleu\housecall-api.txt` must never be read, printed, displayed, hashed, copied, documented, transmitted, or committed during ordinary development.

### Runtime structure

The public application uses:

- Next.js 16.x App Router;
- React 19;
- TypeScript in strict mode;
- Node.js 24.x, pinned in `package.json` and the local version file chosen in the implementation plan;
- Server Components by default;
- static generation at deployment for Git-backed public content;
- `cacheComponents` left disabled;
- `trailingSlash: true`;
- Node runtime, `no-store`, and explicit request handling for lead and editor API routes.

Public marketing pages do not use ISR, on-demand revalidation, runtime content fetching, or streaming as an architectural dependency. A merged content change creates a new deployment. Client Components are limited to navigation state, galleries requiring interaction, estimate-form state, analytics helpers, and the Housecall Pro launcher.

### Proposed module boundaries

```text
app/
  layout.tsx                    shared shell; metadata defaults without canonical
  page.tsx                      homepage resolved from route/content registries
  [slug]/page.tsx               approved one-segment public routes only
  api/leads/route.ts            dynamic lead intake boundary
  keystatic/                    protected editor UI
  api/keystatic/                Keystatic server routes
  robots.ts
  sitemap.ts
components/
  content/                      server-rendered page sections
  forms/                        estimate form client island
  navigation/                   accessible navigation behavior
  seo/                          JSON-LD output only
  booking/                      lazy HCP launcher
content/
  pages/                        homepage and general pages
  services/                     six approved service documents
  locations/                    five approved location documents
  site.yaml                     public contact and organization display fields
  claims.yaml                   verified-claim ledger
data/
  routes.ts                     single typed route registry
  legacy-urls.yaml              complete disposition ledger
lib/
  content/                      typed loaders and validators
  leads/                        orchestration and delivery result model
  integrations/hcp/             interface, mock, and production adapter
  integrations/email/           interface, mock, and production adapter
  analytics/                    safe event contract
  seo/                          metadata, canonical, schema, sitemap builders
  validation/                   build-time and request validation
tests/
docs/
  runbooks/
  superpowers/specs/
```

Exact file splitting may be refined in the implementation plan, but these boundaries are contractual: route and SEO policy is centralized; integration adapters do not own form UI; the form does not call vendors directly; content files do not contain executable integration logic.

## 5. Route registry and URL behavior

`data/routes.ts` is the only authority for indexable public application routes. Each entry contains:

- stable route ID;
- exact pathname with leading and trailing slash;
- page kind (`home`, `general`, `service`, or `location`);
- content record key;
- index/follow policy;
- sitemap inclusion;
- title and description source fields;
- schema builders to apply;
- navigation and breadcrumb labels;
- approval state for any newly introduced location.

The initial registry contains exactly these current routes:

| Kind | Path |
|---|---|
| Home | `/` |
| General | `/privacy-policy/` |
| General | `/about/` |
| General | `/services/` |
| General | `/contact/` |
| General | `/service-areas/` |
| Service | `/tree-trimming-services/` |
| Service | `/tree-removal-services/` |
| Service | `/stump-removal-services/` |
| Service | `/emergency-tree-services/` |
| Service | `/debris-removal-services/` |
| Service | `/land-clearing-services/` |
| Location | `/little-rock-ar/` |
| Location | `/conway-ar/` |
| Location | `/benton-ar/` |
| Location | `/maumelle-ar/` |
| Location | `/sherwood-ar/` |

All 17 routes remain represented and initially indexable to preserve the current public structure. Any later decision to consolidate, remove, or noindex one requires a reviewed ledger change.

The root homepage is explicit. The `[slug]` page uses `generateStaticParams` from the registry and rejects unregistered slugs with a real 404; unapproved locations never render as soft 404s. Reserved application paths such as `/api/` and `/keystatic/` are excluded from the public registry.

### Legacy URL ledger

`data/legacy-urls.yaml` is a reviewed, versioned ledger generated from the final WordPress page and database inventory, XML sitemaps, Search Console exports, valid analytics landing pages, backlink evidence, server logs, internal links, media URLs, and all WordPress/Yoast/hosting/Cloudflare redirects available at freeze time.

Each row contains old URL, observed status, canonical, index directive, page type, evidence source, traffic/backlink/conversion evidence when available, final disposition, destination if any, content owner, and QA status. Allowed dispositions are:

- `retain` at the same path;
- `redirect-permanent` directly to a genuinely equivalent final path;
- `not-found` for a normal 404;
- `gone` for an intentional 410;
- `preserve-media` for an important media path retained at the same URL.

Validation rejects duplicate sources, source/destination collisions, redirect chains, loops, homepage catch-all redirects, destinations outside the approved origin, and conflicting retain/redirect entries. HTTP, host, case, and slash normalization must reach the final canonical in no more than one application redirect after the protocol/host edge normalization.

Important `/wp-content/uploads/...` paths are preserved byte-for-byte in compatible public storage or receive a direct redirect to the exact replacement. Old images never redirect generically to a logo or gallery.

## 6. Git-backed content and protected browser editing

Keystatic exposes structured editing for site settings, general pages, services, and locations. Long-form fields use a repository-native document format; metadata and constrained fields remain typed structured data. Uploaded assets are committed under reviewed public asset paths rather than stored in an unrelated media database.

The editor contract is:

1. Keystatic runs in GitHub mode against the private repository selected by Catherine.
2. Only GitHub users with explicit repository write access can authenticate.
3. Keystatic is restricted to branches prefixed `content/`.
4. Direct pushes to `main` are blocked by branch protection.
5. A browser edit commits to a `content/` branch and is reviewed through a pull request and protected Vercel preview.
6. Required checks validate content, routes, metadata, links, media, accessibility, and the build.
7. Catherine reviews the preview and manually authorizes merge. If Catherine is the sole maintainer, the branch rule requires a pull request and checks but does not require an impossible self-approval; a second authorized reviewer can be required later.
8. Merging to `main` creates the production deployment only after the production project and domain have separately been approved.

`/keystatic/`, its authentication callbacks, and editor APIs emit `X-Robots-Tag: noindex, nofollow, noarchive` and never appear in the sitemap. Keystatic secrets remain server-side. The GitHub App is limited to the selected repository and minimum required permissions.

Remote repository ownership is a hard gate. Local application work may proceed after plan approval, but GitHub mode, branch protection, Vercel Git integration, and browser editing cannot be completed until Catherine chooses the owning personal account or organization and approves creating or connecting that private repository.

## 7. Content and claim governance

Initial migration preserves current public copy for private preview comparison, but it does not automatically approve every claim for launch. `content/claims.yaml` records a stable claim ID, exact approved wording, evidence reference, status, approving owner, and approval date. Schema and reusable trust components may only consume claims marked verified.

Until Catherine supplies evidence and approval, the replacement must not publish or encode claims such as:

- certified arborists;
- licensed and insured;
- over five years in business;
- 24/7 availability;
- same-day service;
- ratings, awards, guarantees, prices, or service areas beyond the approved pages.

A content validation rule flags known unverified claim phrases and any structured-data claim lacking a verified ledger entry. Free-form editorial review remains required because automated phrase checks cannot prove truth.

Every public page has one descriptive H1. Heading levels reflect document hierarchy, not visual size. Service and location content, FAQs, links, and visible business facts are rendered in initial HTML. Location pages remain indexable only when their content contains true local value; the system does not create combinatorial city/service pages.

## 8. Metadata, sitemap, robots, and structured data

`app/layout.tsx` sets `metadataBase`, title defaults, site description defaults, open-graph site name/locale, and `lang="en-US"`. It does not set `alternates.canonical`. The route-level metadata builder creates exactly one absolute self-canonical for every indexable route.

The metadata builder rejects:

- a canonical origin other than `https://platinumbleutls.com`;
- a canonical path that differs from the registered path;
- missing title, description, canonical, or one-H1 requirement;
- duplicate route IDs, paths, slugs, titles, or canonical URLs where uniqueness is required;
- indexable pages omitted from the sitemap;
- noindex pages included in the sitemap;
- unapproved location routes;
- alternate-language declarations when no real alternate URL exists.

`app/sitemap.ts` derives only from the route registry. `lastModified` comes from reviewed repository content history or an explicit content date, never the request time. `app/robots.ts` allows intended public routes in production and points to the production sitemap. Preview deployments receive defense-in-depth `noindex` through both Vercel's preview header behavior and application environment handling. A custom preview domain cannot be used unless its `X-Robots-Tag` behavior is explicitly verified.

JSON-LD uses one connected graph with stable IDs:

- `Organization` and `HomeAndConstructionBusiness` for the real business entity;
- `WebSite` and homepage `WebPage` on the homepage;
- `WebPage`, `Service`, and `BreadcrumbList` on service and location pages;
- truthful `areaServed` only for approved areas;
- `FAQPage` only when identical questions and answers are visible;
- `Article` only for a future real article with truthful author/reviewer data.

The business entity is not duplicated per city. No hidden address is exposed. Ratings, hours, credentials, pricing, awards, reviews, same-as profiles, and availability are omitted until verified. JSON-LD strings are serialized safely so embedded markup cannot terminate the script element.

## 9. Public experience, accessibility, and performance

The visual implementation should preserve recognizable Platinum Bleu identity and the information architecture while improving hierarchy and usability. A separate visual/copy review occurs on protected previews; this specification does not approve new public copy or a redesign for production.

Required behavior:

- semantic header, navigation, main content, footer, breadcrumbs, and page landmarks;
- keyboard-operable desktop and mobile navigation with visible focus;
- properly associated form labels and clear inline plus summary errors;
- no essential content hidden behind animation or JavaScript;
- touch targets and layouts tested at 360, 390, 768, and 1440 CSS pixels;
- no horizontal overflow at the required widths;
- reduced-motion support and no unexpected focus movement;
- WCAG 2.2 AA color contrast and interaction behavior;
- explicit image dimensions, meaningful alt text, and decorative empty alt text;
- self-hosted fonts through `next/font` and no render-blocking third-party font request;
- the LCP image optimized and prioritized when appropriate;
- the Housecall Pro widget absent from the critical rendering path.

Launch budgets are field-oriented Core Web Vitals targets of LCP at or below 2.5 seconds, INP at or below 200 milliseconds, and CLS at or below 0.1 at the 75th percentile when sufficient data exists. A representative mobile Lighthouse score of at least 90 is a prelaunch engineering guardrail, not a ranking promise.

## 10. Conversion paths

### Path A: first-party “Request an estimate” form

The browser submits JSON to `POST /api/leads`. Required fields and consent copy are finalized during content review. The initial technical contract supports name, phone, optional email, requested service, optional property/service address, message, consent, and first-party attribution fields. PII stays in the encrypted request body and approved destinations; it never enters URLs, analytics, client logs, operational alerts, or unredacted server logs.

The server flow is:

```text
request
  -> method/content-type/body-size/origin checks
  -> schema validation and normalization
  -> honeypot and approved abuse control
  -> assign or validate opaque submission ID
  -> attempt HCP and transactional email delivery
  -> classify full, partial, or failed delivery
  -> return user-safe response with no vendor details or PII
```

Abuse controls begin with server validation, a hidden honeypot, minimum plausible completion timing, request-size limits, and origin checks. Any rate-limiting or challenge provider that introduces an external configuration, cookie, key, or accessibility burden must be proposed in the implementation plan and approved before activation. IP addresses are not written to application logs.

### Path B: native Housecall Pro booking

The booking button renders without the HCP script. On deliberate user interaction, a small Client Component loads the official, account-specific native HCP booking code. HCP owns booking services, availability, pricing, deposits, and booking creation. The page remains useful if the widget is blocked: the visitor retains the estimate form, public phone, and public email.

A booking-open click is a micro-event, not a booking. A `booking_complete` event is emitted only if Housecall Pro documents and the implementation verifies a trustworthy callback, redirect, message, or webhook proving completion.

### Housecall Pro verification gate

The strategy's sample API code is illustrative and must not be copied as an implementation contract. Before a production adapter is written or enabled, verify against current Housecall Pro documentation and the Platinum Bleu account:

- authentication header scheme and base URL;
- plan eligibility and credential permissions;
- customer/lead endpoints and exact payloads;
- whether a lead channel must be enabled;
- source, service-type, note, attribution, and custom-field support;
- timeouts, retry guidance, rate limits, duplicate/search behavior, and idempotency support;
- widget script/frame/connect domains and completion signals;
- response IDs and what constitutes durable acceptance.

The website credential is the separate local key intended for the website, not the Codex/plugin key. At the approved configuration step it is entered directly into Vercel Production as `HOUSECALL_PRO_API_KEY`. It is never named `NEXT_PUBLIC_*`, placed in Preview, read by client code, or copied through a documentation or chat surface. Preview and ordinary test environments use a mock adapter.

## 11. Dual delivery, errors, and reconciliation

The lead orchestrator owns two independent adapters: Housecall Pro as CRM destination and transactional email as human backup. A provider is considered to have durably accepted a lead only after its API returns the documented success status and a stable provider acknowledgment. A queued client request or analytics event is not acceptance.

| HCP | Email | HTTP result | Visitor experience | Operations |
|---|---|---:|---|---|
| Accepted | Accepted | 201 | Success | Structured success metric only |
| Accepted | Failed | 202 | Success | Non-PII partial alert and open reconciliation event |
| Failed | Accepted | 202 | Success | Non-PII partial alert and open reconciliation event |
| Failed | Failed | 503 | Clear failure plus call `(501) 404-8887` | Non-PII critical alert and failure event |

The visitor sees the same success message for 201 and 202 so internal vendor state is not disclosed. Each submission has a random opaque `submissionId`. The browser generates it once per submission attempt and retains it only long enough to make safe retries. Providers receive it through supported idempotency or metadata fields when available. The server never promises exact-once delivery when a provider lacks idempotency.

Before production, HCP duplicate behavior and email-provider idempotency must be verified. The production design then uses, in order: provider idempotency keys, provider-supported lookup by the opaque ID, or a documented manual duplicate-reconciliation procedure. It does not merge distinct customers based only on a shared phone or email.

Partial and failed outcomes emit structured, redacted operational events containing only the submission ID, UTC timestamp, page path from an allowlisted route, destination status category, retryability category, environment, and deployment ID. Names, phone numbers, email addresses, street addresses, messages, vendor customer/lead IDs, referrers, and raw errors are excluded.

The initial reconciliation item is the structured `lead_delivery_partial` or `lead_delivery_failed` event retained by the approved log/alert system. A corresponding `lead_delivery_reconciled` event closes the operational record after staff confirms the accepted destination and performs any approved correction. Catherine owns alerts and reconciliation. The technical operator for a cutover window owns immediate diagnosis. Before launch, Catherine must approve the transactional-email provider, operational alert channel, log retention, and external monitor; no new provider account is created from this specification.

If later policy requires both destinations to succeed before visitor success, the architecture must add a durable outbox with retries and explicit state. That is a new stateful service and requires a separate design and approval.

## 12. Attribution and analytics safety

The application may capture first-party landing path, referrer origin/path as allowed by policy, UTM fields, and advertising click IDs. It must validate length and character set and must not persist or transmit arbitrary URL values as PII.

Analytics events are emitted only after the server reports accepted full or partial delivery. The server returns an opaque analytics conversion token derived for the submission; it is not an HCP ID and contains no customer information. The browser records at most one `generate_lead` event per submission ID in that session. Retries returning the same accepted submission do not emit a second conversion.

Allowed lead event fields are a fixed schema such as event name, conversion token, registered page path, selected service category from an allowlist, delivery class (`full` or `partial`), and environment. Names, email, phone, address, message, HCP IDs, and free-form fields are prohibited.

GA4/GTM configuration, consent behavior, internal/test filtering, Ads conversion setup, and published container changes remain separate approval gates. Tests must prove no conversion on validation failure or dual failure and exactly one conversion for an accepted submission retry sequence.

## 13. Secrets and security controls

- Secrets are server-only environment variables and never Git-backed content.
- Production HCP credentials exist only in the Vercel Production environment.
- Preview uses mock adapters and must fail closed if a production-only integration is accidentally selected.
- Keystatic/GitHub credentials are scoped only to environments that need the editor and only to the selected private repository.
- Error responses are generic and logs are redacted by construction.
- Lead routes set `Cache-Control: no-store` and do not echo submitted values.
- Security headers are version controlled. Content Security Policy begins in report-only mode only after exact Keystatic, HCP, analytics, and image domains are known; enforcement follows a reviewed violation report.
- Dependency, secret, and client-bundle checks run before release.
- No unverified raw HTML or script field is exposed through Keystatic content.

## 14. Environments and deployment workflow

### Local

Local development uses repository content and mock delivery adapters. No production key is copied into local environment files by Codex. Local Keystatic editing may use its documented local storage mode during implementation, but acceptance of the protected browser editor requires GitHub mode against the selected private remote.

### Preview

Every pull request receives a Vercel preview. Preview deployments are authenticated/protected and must return `X-Robots-Tag: noindex`. They use mock HCP and email adapters, non-production analytics, and no production HCP key. The production domain is never assigned to a preview branch.

### Production

Only protected `main` can create the production build. Static public pages are regenerated on deployment. Production environment variables are explicitly allowlisted. Deployment to a Vercel production URL may occur only after approval; attaching or serving `platinumbleutls.com` is a later, separate cutover approval.

The remote and Vercel ownership model must be chosen by Catherine before connection. Nothing may be created under a guessed personal account or organization.

## 15. Cloudflare and production migration

Cloudflare stays the registrar and authoritative DNS provider. Vercel owns application delivery, previews, image optimization, TLS for the web application, and application logs. Web records remain DNS-only; Cloudflare proxying is not enabled in the initial architecture.

### Event A: move authoritative control without cutting over the application

This event requires explicit action-time approval and a maintenance runbook. Its goal is to move authority from the current `alina`/`guss` zone to Catherine's `dina`/`rex` zone while the Catherine-controlled apex and `www` continue to target the WordPress origin at `62.72.53.7`.

Before changing authority:

1. Export the complete current and destination zone records and compare A, AAAA, CNAME, MX, TXT, CAA, SRV, DKIM, SPF, DMARC, verification, and other records by name, value, priority, proxy state, and TTL.
2. Confirm `dina` and `rex` are still the nameservers assigned to Catherine's active zone and that both answer authoritatively with the intended WordPress web records and all required email records.
3. Verify the WordPress origin at `62.72.53.7` with correct host handling, HTTPS, representative routes, forms without submission, and media paths.
4. Record current public NS, SOA, DS/DNSSEC state, web answers, mail answers, TLS, and representative HTTP responses.
5. Confirm the Cloudflare Registrar/account UI supports the required same-provider zone/control move. If it does not, stop and use Cloudflare's supported account/zone transfer path or support process; do not improvise around registrar controls.

DNSSEC procedure:

- If a parent DS record is active, capture it, disable signing on the old zone as directed by Cloudflare, remove the old DS at the registrar, and verify DS removal from independent resolvers before changing nameservers.
- Change authority only after the old DS can no longer cause bogus validation.
- After `dina`/`rex` are authoritative and stable, enable DNSSEC on Catherine's zone, publish the newly issued DS through the registrar-supported workflow, and verify secure validation from independent resolvers.
- Never reuse an old DS with a new zone's signing keys.

After the authority move, verify apex and `www`, TLS, all 17 public routes, important media, MX and public mail records, and approved send/receive mail tests. A mail test sends messages and therefore requires explicit approval. Roll back the authority change to the recorded `alina`/`guss` state if DNSSEC validation fails, the WordPress site does not remain equivalent, or required email records do not match.

Event A does not connect Vercel to the production domain and does not change WordPress.

### Event B: move only web delivery to Vercel

Event B occurs only after Catherine accepts a protected preview and explicitly approves production cutover. Before it:

1. Complete a final WordPress backup and prove restore capability.
2. Freeze public content changes.
3. Run a final WordPress crawl, complete the historic URL ledger, and finish redirect and media audits.
4. Verify all required checks against the Vercel preview, including JavaScript-disabled content and mock form behavior.
5. Configure and approve production secrets without exposing them.
6. Perform controlled HCP, email, form, booking, and analytics tests only under their action-time approvals.
7. Add both apex and `www` to the approved Vercel project and use the exact DNS values Vercel reports for that project; do not hard-code generic documentation examples.
8. Pre-provision and verify TLS through the supported Vercel process when available.

At cutover, change only the apex/`www` web-facing records in Catherine's Cloudflare zone, leave every email/Microsoft/Google/verification record untouched, and keep the records DNS-only. The canonical production hostname remains the apex `https://platinumbleutls.com`; `www` permanently redirects directly to the apex. Validate Vercel domain state, TLS, hostname normalization, all route/status/SEO requirements, media, and the approved lead canary.

Event B rollback restores the web records to `62.72.53.7`. The old WordPress origin stays operational and restore-capable for at least 30 days after cutover. Permanent redirects and long-term backups remain under the documented retention policy; hosting cancellation and backup destruction need separate approval.

## 16. Monitoring, ownership, and rollback thresholds

Catherine is the business owner, alert recipient, reconciliation owner, and rollback decision owner. The named person executing the approved cutover is the technical responder for that change window. The cutover runbook records that person's name and contact method before work begins.

An approved external uptime monitor checks apex and `www`, the homepage, one service route, one location route, and the lead endpoint with a non-submitting health method or synthetic mock-safe probe. Vercel Observability supplies application errors and performance signals. Lead monitoring uses redacted structured events only.

Immediate rollback to `62.72.53.7` is triggered by any of these conditions attributable to cutover:

- invalid or untrusted production TLS;
- apex or `www` unavailable for five consecutive minutes from two independent monitoring regions;
- any representative retained route returning the wrong status, canonical host, or a redirect loop after caches should have expired;
- sitemap or robots exposing previews or blocking the intended production site;
- an approved production canary receiving no durable acceptance from either HCP or email;
- required email DNS records changed or approved send/receive verification fails;
- a secret appears in a public response, client bundle, repository, analytics payload, or operational alert.

Before cutover, launch is held rather than rolled back if accessibility, responsive, content, redirect, SEO, or performance acceptance checks fail. After a stable launch, error-rate and Core Web Vitals thresholds are reviewed with real traffic; low-volume single events are investigated rather than converted into misleading percentages.

The external monitoring provider and alert destination are selected and approved before production. Reuse an existing approved service if one exists; do not create a parallel monitoring account without checking current Platinum Bleu systems.

## 17. Verification strategy

### Build and unit checks

- TypeScript strict typecheck and lint.
- Production `next build` on Node.js 24.x.
- Route-registry validation for duplicates, collisions, slashes, origin, approvals, reserved paths, and required metadata.
- Legacy-ledger validation for direct destinations, loops, chains, conflicts, and outside origins.
- Content validation for required fields, one intended H1, known unsupported claims, asset existence, alt text, and internal links.
- Metadata, sitemap, robots, canonical, locale, and JSON-LD unit tests.
- Lead state-table tests covering all four dual-delivery outcomes, timeouts, retries, idempotency behavior, redaction, and safe errors.
- Client-bundle and repository scans for secret names/values, server-only modules, and PII-shaped fixtures.

### Rendered and browser checks

- Crawl the built application and compare every retained URL to the registry/ledger.
- Assert status, final URL, canonical, index directive, title, description, H1 count, sitemap membership, links, schema, and media response.
- Run browser tests at 360, 390, 768, and 1440 CSS pixels.
- Test keyboard navigation, visible focus, reduced motion, form labels/errors, menu state, and automated accessibility checks.
- Disable JavaScript and confirm primary content, headings, contact details, links, and call fallback remain usable.
- Confirm the HCP script is absent before interaction and does not affect the LCP request path.
- Verify preview authentication and `X-Robots-Tag: noindex` from an unauthenticated and an authorized test path.
- Visually review representative home, general, service, location, contact, privacy, 404, and form-state pages.

### Controlled external verification

The following are not ordinary automated tests and require explicit approval at execution time:

- any HCP API write creating or modifying a customer, lead, estimate, job, or booking;
- any transactional email delivery test;
- any form submission that reaches a real destination;
- GA4/GTM/Ads/GBP changes;
- production-domain assignment or DNS change;
- Search Console sitemap submission or index request.

## 18. Acceptance criteria

The implementation is ready for preview review when:

- all 17 known routes render from the typed registry with exact trailing slashes;
- the available historic ledger is complete from all obtainable sources, with unavailable evidence explicitly recorded rather than assumed empty;
- route and ledger validation reject every required invalid condition;
- intended pages have one self-canonical, one H1, complete metadata, correct index policy, correct sitemap membership, and truthful connected schema;
- primary content and navigation work without client-side JavaScript;
- responsive and accessibility checks pass at all required widths;
- the booking widget is interaction-loaded and outside the critical path;
- mock lead tests prove full, partial, and failed delivery behavior, redacted alerts, reconciliation events, and analytics deduplication;
- no secrets are in Git or client output and no PII is in analytics or operational telemetry;
- Keystatic browser edits can use a protected content branch, pull request, preview, checks, and manual merge after remote ownership is approved;
- preview is protected/noindex and lacks the production HCP key;
- the cutover and rollback runbooks preserve `62.72.53.7`, email records, and the WordPress recovery window.

The migration itself is complete only after separately approved production cutover and verification of TLS, apex/`www` normalization, Cloudflare authority and DNS-only web records, Vercel domain state, representative production URLs, the approved lead workflow, Search Console sitemap acceptance, representative URL inspections, monitoring alerts, and the 30-day WordPress rollback period.

## 19. Explicit approval gates and unresolved owner choices

These are deliberate gates, not implementation assumptions:

1. Catherine selects the private GitHub repository owner before any remote is created or connected.
2. Catherine approves the implementation plan before application work begins.
3. Catherine approves any public copy or factual claim changes before production.
4. Catherine approves external vendors or account/configuration changes for transactional email, abuse control, and external monitoring.
5. Catherine approves action-time use of the website HCP key and every live write test.
6. Catherine approves GA4, GTM, Ads, GBP, Search Console, and production-domain actions.
7. Catherine approves Event A and Event B separately.
8. Catherine approves any hosting cancellation, WordPress shutdown, or destructive backup change.

No implementation plan should hide these gates inside technical tasks. Tasks must stop at each gate and record what evidence Catherine will review.

## 20. Primary documentation references

- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Next.js metadata file conventions](https://nextjs.org/docs/app/api-reference/file-conventions/metadata)
- [Keystatic GitHub mode](https://keystatic.com/docs/github-mode)
- [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)
- [Vercel preview indexing behavior](https://vercel.com/kb/guide/are-vercel-preview-deployment-indexed-by-search-engines)
- [Vercel custom-domain setup](https://vercel.com/docs/domains/set-up-custom-domain)
- [Vercel Cloudflare migration guidance](https://vercel.com/kb/guide/migrate-to-vercel-from-cloudflare)
- [Housecall Pro Public API](https://docs.housecallpro.com/)
