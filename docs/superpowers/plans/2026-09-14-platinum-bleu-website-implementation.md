# Platinum Bleu Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private, Git-controlled Next.js replacement for `https://platinumbleutls.com` that preserves current URLs and organic value, supports protected Git-backed browser editing, and remains off the production domain until a separately approved cutover.

**Architecture:** One Next.js 16 App Router repository owns the public application, typed route registry, Git-backed content, Keystatic editor, SEO policy, lead orchestration, tests, and runbooks. Public content is prerendered on deployment; the lead endpoint uses mockable HCP and email adapters; Vercel supplies protected previews and application delivery while Cloudflare remains DNS-only authoritative DNS.

**Tech Stack:** Next.js 16.x, React 19, TypeScript, Node.js 24.x, Keystatic GitHub mode, Zod, Vitest, Testing Library, Playwright, axe-core, Vercel, Cloudflare DNS, Housecall Pro, and an owner-approved transactional email provider.

**Spec:** `docs/superpowers/specs/2026-09-14-platinum-bleu-nextjs-website-design.md`

## Global Constraints

- Work only in `C:\dev\Platinum Bleu\platinum-bleu-site`; `C:\dev\Platinum Bleu` remains a non-Git evidence workspace.
- Begin every implementation session with `git status --short --branch`; preserve unrelated changes.
- Use Next.js 16.x App Router, React 19, TypeScript strict mode, and Node.js 24.x.
- Use Server Components and deployment-time static generation for public content; leave Cache Components disabled and do not add ISR or on-demand revalidation.
- Keep `trailingSlash: true`, `lang="en-US"`, the apex canonical origin, all 17 current routes, and one self-canonical per indexable page.
- Do not place a homepage canonical in the shared root layout and do not emit `hreflang` without real alternate-language URLs.
- Keep primary content, headings, links, schema, phone, and email in initial HTML.
- Public phone is `(501) 404-8887`; public email is `services@platinumbleutls.com`; the server-only notification inbox is `catherine@platinumbleutls.com`.
- Never read, print, display, hash, copy, transmit, or commit `C:\dev\Platinum Bleu\housecall-api.txt` during ordinary development.
- Never commit `.env*`, keys, credentials, backups, database exports, recovery codes, customer data, or raw authenticated audit evidence.
- Preview uses mock HCP/email adapters, is protected/noindex, and never receives the production HCP key.
- Do not publish unverified claims, customer PII in analytics/URLs/logs/alerts, or free-form content as executable HTML.
- No remote push, external account creation, Vercel project/domain action, production DNS, nameserver, DNSSEC, WordPress, analytics, email, or live HCP write without its explicit approval gate.
- Use test-driven development for every feature: write a focused failing test, run it and observe the expected failure, implement the minimum behavior, rerun the focused test, then run the relevant suite.
- Commit after each independently reviewable task; never combine unrelated work.

---

## File and responsibility map

| Area | Files | Responsibility |
|---|---|---|
| Tooling | `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts` | Pinned runtime, commands, strict compilation, test environments, slash/header policy |
| Public routing | `data/routes.ts`, `lib/routes/registry.ts`, `app/page.tsx`, `app/[slug]/page.tsx`, `app/not-found.tsx` | The 17 approved pages, static params, dispatch, and real 404 behavior |
| Content | `content/site.yaml`, `content/claims.yaml`, `content/pages/*.mdoc`, `content/services/*.mdoc`, `content/locations/*.mdoc`, `lib/content/*` | Git-backed public copy, structured fields, claim status, parsing, and validation |
| Editor | `keystatic.config.tsx`, `app/keystatic/[[...params]]/page.tsx`, `app/api/keystatic/[...params]/route.ts` | Local authoring during development and protected GitHub-mode browser editing |
| SEO | `lib/seo/*`, `components/seo/json-ld.tsx`, `app/sitemap.ts`, `app/robots.ts` | Metadata, canonical, graph, sitemap, robots, and preview index policy |
| Legacy URLs | `data/legacy-urls.yaml`, `lib/legacy/*`, generated redirect artifact | Reviewed dispositions, redirect validation, media preservation |
| UI | `components/layout/*`, `components/content/*`, `components/navigation/*`, `app/globals.css` | Server-rendered templates, navigation, responsive styles, accessibility |
| Lead form | `components/forms/*`, `lib/leads/*`, `app/api/leads/route.ts` | Form UX, request validation, orchestration, safe responses, reconciliation events |
| Integrations | `lib/integrations/hcp/*`, `lib/integrations/email/*`, `lib/integrations/operations/*` | Vendor-independent interfaces, mock adapters, gated production adapters, redacted alerts |
| Booking | `components/booking/booking-launcher.tsx`, `lib/integrations/hcp/widget.ts` | Interaction-only native HCP widget loading and fallback |
| Analytics | `lib/analytics/*`, `components/analytics/*` | Allowlisted events, accepted-lead timing, client deduplication |
| Verification | `tests/unit/*`, `tests/integration/*`, `tests/e2e/*`, `scripts/validate-*` | Route/content/SEO/integration checks, rendered crawl, accessibility, viewport and no-JS proof |
| Operations | `docs/runbooks/*` | Editor workflow, environment matrix, HCP test gate, DNS events, cutover, rollback, monitoring |

---

### Task 1: Establish the tested Next.js foundation

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `next-env.d.ts`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `playwright.config.ts`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `tests/unit/config/next-config.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Approved runtime and rendering constraints from the spec.
- Produces: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run validate`, and `npm run build`; exported `nextConfig` for unit inspection.

- [ ] **Step 1: Create the package manifest and install the approved major versions**

Create scripts for `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`, `test:e2e`, and `validate`. Set `engines.node` to `24.x`. Run:

```powershell
npm install next@16 react@19 react-dom@19 zod@4 @keystatic/core @keystatic/next yaml
npm install --save-dev typescript @types/node @types/react @types/react-dom eslint eslint-config-next vitest jsdom @testing-library/react @testing-library/jest-dom @playwright/test @axe-core/playwright
```

Commit the generated lockfile so the resolved versions are reproducible.

- [ ] **Step 2: Write the failing configuration test**

```ts
import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

describe("Next.js policy", () => {
  it("keeps slash compatibility and Cache Components off", () => {
    expect(nextConfig.trailingSlash).toBe(true);
    expect(nextConfig.cacheComponents).not.toBe(true);
  });
});
```

- [ ] **Step 3: Run the focused test and observe the expected failure**

Run: `npm test -- tests/unit/config/next-config.test.ts`  
Expected: FAIL because `next.config.ts` does not yet export the required policy.

- [ ] **Step 4: Implement the minimal framework configuration and root shell**

Export a typed Next config with `trailingSlash: true`, `poweredByHeader: false`, no `cacheComponents: true`, and version-controlled baseline headers. Create an `en-US` root HTML shell whose metadata contains `metadataBase` and title defaults but no `alternates.canonical`.

- [ ] **Step 5: Run foundation verification**

Run: `npm test -- tests/unit/config/next-config.test.ts`  
Expected: PASS.  
Run: `npm run typecheck && npm run lint && npm run build`  
Expected: all commands exit 0.

- [ ] **Step 6: Commit the foundation**

```powershell
git add package.json package-lock.json tsconfig.json next-env.d.ts next.config.ts eslint.config.mjs vitest.config.ts vitest.setup.ts playwright.config.ts app .gitignore tests/unit/config
git commit -m "build: establish Next.js 16 foundation"
```

---

### Task 2: Create the typed route registry and content contracts

**Files:**
- Create: `data/routes.ts`
- Create: `lib/routes/types.ts`
- Create: `lib/routes/registry.ts`
- Create: `lib/content/schema.ts`
- Create: `lib/content/load-content.ts`
- Create: `tests/unit/routes/registry.test.ts`
- Create: `tests/unit/content/schema.test.ts`

**Interfaces:**
- Consumes: Zod and the 17 paths in the approved spec.
- Produces: `RouteDefinition`, `routeRegistry`, `getRouteByPath(pathname)`, `getRouteBySlug(slug)`, `getStaticSlugs()`, `SiteContent`, `PageContent`, `ServiceContent`, `LocationContent`, and `loadContent(route)`.

- [ ] **Step 1: Define failing registry invariants**

Test that the registry contains exactly 17 unique paths, every non-root path begins and ends with `/`, the six services and five locations match the spec, reserved paths cannot register, and unknown slugs return `undefined`.

```ts
expect(routeRegistry).toHaveLength(17);
expect(new Set(routeRegistry.map((route) => route.path)).size).toBe(17);
expect(getRouteBySlug("not-approved-ar")).toBeUndefined();
```

- [ ] **Step 2: Run the focused tests and observe missing-module failures**

Run: `npm test -- tests/unit/routes/registry.test.ts tests/unit/content/schema.test.ts`  
Expected: FAIL because the route and content modules do not exist.

- [ ] **Step 3: Implement the route and content types**

Use this public contract:

```ts
export type RouteKind = "home" | "general" | "service" | "location";

export type RouteDefinition = Readonly<{
  id: string;
  path: `/${string}`;
  kind: RouteKind;
  contentKey: string;
  index: boolean;
  follow: boolean;
  sitemap: boolean;
  navLabel: string;
  breadcrumbLabel: string;
}>;
```

Populate the exact 17-route registry. Zod schemas require title, description, H1, body document, social image with alt text, and kind-specific service/location fields.

- [ ] **Step 4: Implement content loading with server-only boundaries**

`loadContent(route)` reads only the route's registered Git-backed record and returns the discriminated content type. It throws a build-stopping `ContentValidationError` with route ID and field name, never raw customer or secret values.

- [ ] **Step 5: Run focused and full unit tests**

Run: `npm test -- tests/unit/routes/registry.test.ts tests/unit/content/schema.test.ts`  
Expected: PASS.  
Run: `npm test`  
Expected: all current tests pass.

- [ ] **Step 6: Commit the route/content contracts**

```powershell
git add data/routes.ts lib/routes lib/content tests/unit/routes tests/unit/content
git commit -m "feat: define public route and content contracts"
```

---

### Task 3: Import the 17-page content baseline and claim controls

**Files:**
- Create: `content/site.yaml`
- Create: `content/claims.yaml`
- Create: `content/pages/home.mdoc`
- Create: `content/pages/privacy-policy.mdoc`
- Create: `content/pages/about.mdoc`
- Create: `content/pages/services.mdoc`
- Create: `content/pages/contact.mdoc`
- Create: `content/pages/service-areas.mdoc`
- Create: `content/services/*.mdoc` for all six services
- Create: `content/locations/*.mdoc` for all five locations
- Create: `scripts/import-wordpress-baseline.mjs`
- Create: `scripts/validate-content.mjs`
- Create: `tests/unit/content/claims.test.ts`

**Interfaces:**
- Consumes: `docs/migration/baseline/wordpress-2026-09-09/home-public.html`, `contact-public.html`, `public-crawl.json`, and `page-sitemap.xml`.
- Produces: 17 validated content records, `ClaimRecord`, `isClaimPublishable(claimId)`, and `npm run validate:content`.

- [ ] **Step 1: Write failing tests for approved contact facts and blocked claims**

Assert that site content uses `(501) 404-8887`, `services@platinumbleutls.com`, and `en-US`; known unsupported claim phrases fail unless referenced by a verified claim record.

- [ ] **Step 2: Run the claim tests and observe the missing-content failure**

Run: `npm test -- tests/unit/content/claims.test.ts`  
Expected: FAIL because site and claim records do not exist.

- [ ] **Step 3: Build a deterministic public-baseline importer**

The script extracts headings, paragraphs, links, and public image URLs from the saved HTML into an intermediate report. It does not execute HTML, import scripts/forms, or read the restricted audit. The report identifies the exact source selector and flags the phrases “over 5 years,” “licensed and insured,” “certified arborists,” “24/7,” and “same-day” for manual exclusion or verified-claim linkage.

- [ ] **Step 4: Create the reviewed content records**

Create all 17 files with exact baseline metadata from `public-crawl.json`, one intended H1, the approved phone/email, and public content that excludes unsupported claims. Preserve source notes in front matter for review. Do not invent local projects, availability, credentials, or proof.

- [ ] **Step 5: Implement content validation**

Reject missing metadata, empty primary content, duplicate content keys, missing assets/alt text, unregistered internal links, known unsupported phrases without a verified claim ID, and a location without `approved: true`.

- [ ] **Step 6: Verify the content set**

Run: `npm run validate:content`  
Expected: reports 17 valid content records and zero unsupported published claims.  
Run: `npm test -- tests/unit/content/claims.test.ts`  
Expected: PASS.

- [ ] **Step 7: Commit the content baseline**

```powershell
git add content scripts/import-wordpress-baseline.mjs scripts/validate-content.mjs tests/unit/content
git commit -m "content: establish reviewed WordPress baseline"
```

---

### Task 4: Render the public shell and all route kinds

**Files:**
- Create: `app/page.tsx`
- Create: `app/[slug]/page.tsx`
- Create: `app/not-found.tsx`
- Create: `components/layout/site-header.tsx`
- Create: `components/layout/site-footer.tsx`
- Create: `components/navigation/mobile-navigation.tsx`
- Create: `components/content/page-renderer.tsx`
- Create: `components/content/general-page.tsx`
- Create: `components/content/service-page.tsx`
- Create: `components/content/location-page.tsx`
- Create: `tests/unit/pages/page-renderer.test.tsx`
- Create: `tests/integration/routes/static-routes.test.ts`

**Interfaces:**
- Consumes: `routeRegistry`, `getRouteBySlug`, `getStaticSlugs`, and `loadContent`.
- Produces: server-rendered home/general/service/location pages and real 404 behavior.

- [ ] **Step 1: Write failing renderer and static-route tests**

Test one route of each kind, exactly one H1, visible phone/email, purposeful service/location links, all 16 non-root static params, and `notFound()` for an unknown slug.

- [ ] **Step 2: Run focused tests and observe missing-component failures**

Run: `npm test -- tests/unit/pages/page-renderer.test.tsx tests/integration/routes/static-routes.test.ts`  
Expected: FAIL because renderers and pages are absent.

- [ ] **Step 3: Implement the shared shell and route dispatcher**

Keep layout/header/footer as Server Components. Make only mobile menu state a Client Component. Dispatch by the route/content discriminant; do not fetch primary content after hydration.

- [ ] **Step 4: Implement static params and hard 404s**

`generateStaticParams()` returns registered non-root slugs. Set `dynamicParams = false`. Unknown content calls `notFound()` and the custom 404 offers home, Services, Service Areas, Contact, and the public phone.

- [ ] **Step 5: Verify route rendering and no-JS content**

Run the focused tests, then `npm run build`. Inspect build output to confirm all 17 public routes are prerendered and the lead/editor routes remain dynamic.

- [ ] **Step 6: Commit public routing**

```powershell
git add app components/layout components/navigation components/content tests/unit/pages tests/integration/routes
git commit -m "feat: render all approved public routes"
```

---

### Task 5: Centralize metadata, sitemap, robots, and JSON-LD

**Files:**
- Create: `lib/seo/constants.ts`
- Create: `lib/seo/metadata.ts`
- Create: `lib/seo/schema.ts`
- Create: `lib/seo/serialize-json-ld.ts`
- Create: `components/seo/json-ld.tsx`
- Create: `app/sitemap.ts`
- Create: `app/robots.ts`
- Modify: `app/page.tsx`
- Modify: `app/[slug]/page.tsx`
- Create: `tests/unit/seo/metadata.test.ts`
- Create: `tests/unit/seo/schema.test.ts`
- Create: `tests/unit/seo/discovery.test.ts`

**Interfaces:**
- Consumes: `RouteDefinition` and validated content records.
- Produces: `buildMetadata(route, content): Metadata`, `buildSchemaGraph(route, content): JsonLdGraph`, `serializeJsonLd(graph): string`, `sitemap()`, and `robots()`.

- [ ] **Step 1: Write failing SEO invariants**

Assert apex HTTPS origin, exact trailing-slash self-canonical, no root-layout canonical, unique titles/descriptions, no `hreflang`, production-only sitemap entries, noindex/sitemap exclusion, one business entity ID, visible-content parity, and `<` escaping in serialized JSON-LD.

- [ ] **Step 2: Run focused SEO tests and observe missing-builder failures**

Run: `npm test -- tests/unit/seo`  
Expected: FAIL because SEO builders do not exist.

- [ ] **Step 3: Implement metadata and discovery builders**

Use `https://platinumbleutls.com` as the only canonical origin. Derive sitemap only from registry entries where `index && sitemap`. In preview, return restrictive robots and `X-Robots-Tag` headers in addition to Vercel defaults.

- [ ] **Step 4: Implement the connected truthful schema graph**

Use stable IDs `https://platinumbleutls.com/#organization` and `https://platinumbleutls.com/#business`; reference those entities from Service and WebPage nodes. Omit hidden address, unsupported hours/claims, ratings, awards, prices, and unverified profiles.

- [ ] **Step 5: Verify SEO output**

Run: `npm test -- tests/unit/seo`  
Expected: PASS.  
Run: `npm run build`  
Expected: exit 0 with static metadata routes.

- [ ] **Step 6: Commit SEO policy**

```powershell
git add lib/seo components/seo app/page.tsx app/[slug]/page.tsx app/sitemap.ts app/robots.ts tests/unit/seo
git commit -m "feat: centralize SEO and structured data"
```

---

### Task 6: Implement the legacy URL and media ledger

**Files:**
- Create: `data/legacy-urls.yaml`
- Create: `lib/legacy/schema.ts`
- Create: `lib/legacy/validate-ledger.ts`
- Create: `lib/legacy/build-redirects.ts`
- Create: `scripts/build-legacy-ledger-report.mjs`
- Create: `scripts/validate-legacy-ledger.mjs`
- Create: `tests/unit/legacy/ledger.test.ts`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: public sitemap/crawl, final WordPress exports when approved, and `routeRegistry`.
- Produces: `LegacyUrlRecord`, `validateLegacyLedger(records, routes)`, `buildPermanentRedirects(records)`, a missing-evidence report, and Next redirect configuration.

- [ ] **Step 1: Write failing ledger tests**

Cover duplicate sources, route collisions, loops, chains, outside-origin destinations, homepage catch-alls, invalid disposition combinations, and important media without a preserve/redirect decision.

- [ ] **Step 2: Run the ledger tests and observe expected failure**

Run: `npm test -- tests/unit/legacy/ledger.test.ts`  
Expected: FAIL because the ledger modules are absent.

- [ ] **Step 3: Implement the ledger schema and validators**

Use the dispositions `retain`, `redirect-permanent`, `not-found`, `gone`, and `preserve-media`. Make evidence availability explicit; missing Search Console/log/backlink exports are recorded as unavailable, never interpreted as zero.

- [ ] **Step 4: Seed the 17 retained routes and public media paths**

Import the sitemap/crawl entries and referenced `/wp-content/uploads/` paths. Mark full historic completeness false until the gated final exports and redirect inventories are collected.

- [ ] **Step 5: Generate only reviewed direct redirects**

Feed validated `redirect-permanent` records into `next.config.ts`. Implement 410 handling in an explicit route/status layer only for reviewed `gone` records; all other unknown paths remain 404.

- [ ] **Step 6: Verify and commit the ledger system**

Run: `npm run validate:legacy && npm test -- tests/unit/legacy/ledger.test.ts && npm run build`  
Expected: validation passes for current evidence and reports historic completeness as pending gated exports, without claiming an empty history.

```powershell
git add data/legacy-urls.yaml lib/legacy scripts/build-legacy-ledger-report.mjs scripts/validate-legacy-ledger.mjs tests/unit/legacy next.config.ts
git commit -m "feat: add verified legacy URL ledger"
```

---

### Task 7: Add protected Keystatic content editing

**Files:**
- Create: `keystatic.config.tsx`
- Create: `app/keystatic/[[...params]]/page.tsx`
- Create: `app/api/keystatic/[...params]/route.ts`
- Create: `lib/editor/storage.ts`
- Create: `tests/unit/editor/storage.test.ts`
- Create: `docs/runbooks/content-editing.md`
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: content schemas and the selected repository `platinumbleutls/platinumbleutls`.
- Produces: `getKeystaticStorage(environment)`, Keystatic collections/singletons, local authoring mode, GitHub mode with `branchPrefix: "content/"`, and noindex editor routes.

- [ ] **Step 1: Write failing storage-policy tests**

Assert local development resolves to local storage, preview/production resolve to GitHub storage for `platinumbleutls/platinumbleutls`, GitHub branches are restricted to `content/`, and missing server credentials fail closed outside local development.

- [ ] **Step 2: Run focused tests and observe the missing-policy failure**

Run: `npm test -- tests/unit/editor/storage.test.ts`  
Expected: FAIL because editor storage is absent.

- [ ] **Step 3: Implement Keystatic schemas and routes**

Map site settings, claims, general pages, services, and locations to their existing files. Do not expose the notification inbox or secrets as fields. Use constrained component blocks rather than raw HTML/script input.

- [ ] **Step 4: Protect editor discovery and server behavior**

Add `X-Robots-Tag: noindex, nofollow, noarchive` for `/keystatic/:path*` and `/api/keystatic/:path*`; exclude both from sitemap and public navigation. Document the minimum-permission GitHub App and callback URLs.

- [ ] **Step 5: Verify local editing without configuring external credentials**

Run the editor tests and start the local site. Create a disposable local content branch/edit, confirm only the intended content file changes, then restore the disposable edit without touching user work.

- [ ] **Step 6: Stop at the GitHub App approval gate**

Present the exact GitHub App permissions, callback URLs, Vercel environment-variable names, and branch-protection settings to Catherine. Do not create the app, add secrets, change branch rules, or push until approved.

- [ ] **Step 7: Commit editor code and documentation**

```powershell
git add keystatic.config.tsx app/keystatic app/api/keystatic lib/editor tests/unit/editor docs/runbooks/content-editing.md next.config.ts
git commit -m "feat: add Git-backed browser editor"
```

---

### Task 8: Build accessible responsive presentation components

**Files:**
- Create: `components/content/hero.tsx`
- Create: `components/content/service-grid.tsx`
- Create: `components/content/service-area-grid.tsx`
- Create: `components/content/faq-list.tsx`
- Create: `components/content/contact-band.tsx`
- Modify: `components/content/*-page.tsx`
- Modify: `app/globals.css`
- Create: `tests/e2e/responsive.spec.ts`
- Create: `tests/e2e/accessibility.spec.ts`
- Create: `tests/e2e/no-javascript.spec.ts`

**Interfaces:**
- Consumes: validated content records and public route links.
- Produces: responsive Server Components and Playwright proof at 360, 390, 768, and 1440 CSS pixels.

- [ ] **Step 1: Write failing viewport, keyboard, and no-JavaScript tests**

Test no horizontal overflow, visible H1/content/contact links, menu keyboard operation, focus visibility, reduced motion, and axe violations on representative home, general, service, location, contact, privacy, and 404 pages.

- [ ] **Step 2: Run Playwright tests and observe failures against incomplete UI**

Run: `npm run test:e2e -- tests/e2e/responsive.spec.ts tests/e2e/accessibility.spec.ts tests/e2e/no-javascript.spec.ts`  
Expected: FAIL on missing presentation and accessibility requirements.

- [ ] **Step 3: Implement the minimal responsive design system**

Use CSS custom properties and focused global/component styles. Preserve recognizable Platinum Bleu identity from verified public assets without publishing new claims or copy. Use semantic landmarks, correct heading order, accessible controls, explicit image dimensions, and `next/font`.

- [ ] **Step 4: Verify all target widths and accessibility states**

Run the focused Playwright files. Capture screenshots for the representative page/state matrix and inspect them at full resolution. Fix clipping, overflow, contrast, focus, or hierarchy defects before continuing.

- [ ] **Step 5: Commit the presentation layer**

```powershell
git add components/content app/globals.css tests/e2e
git commit -m "feat: add responsive accessible presentation"
```

---

### Task 9: Define and test lead intake and dual-delivery orchestration

**Files:**
- Create: `lib/leads/types.ts`
- Create: `lib/leads/schema.ts`
- Create: `lib/leads/redaction.ts`
- Create: `lib/leads/orchestrate-lead.ts`
- Create: `lib/integrations/types.ts`
- Create: `lib/integrations/hcp/mock-adapter.ts`
- Create: `lib/integrations/email/mock-adapter.ts`
- Create: `lib/integrations/operations/logger.ts`
- Create: `app/api/leads/route.ts`
- Create: `tests/unit/leads/orchestration.test.ts`
- Create: `tests/integration/leads/route.test.ts`

**Interfaces:**
- Produces: `LeadInput`, `DeliveryAdapter`, `DeliveryReceipt`, `DeliveryFailure`, `LeadOutcome`, `orchestrateLead(input, adapters, operations)`, and `POST(request)`.

```ts
export type DeliveryReceipt = Readonly<{
  destination: "hcp" | "email";
  accepted: true;
  acknowledgementId: string;
}>;

export interface DeliveryAdapter {
  deliver(input: LeadInput, submissionId: string): Promise<DeliveryReceipt>;
}
```

- [ ] **Step 1: Write the four failing delivery-state tests**

Assert 201 for two acceptances, 202 for either partial outcome, 503 for dual failure, the same visitor success body for 201/202, call fallback for 503, bounded timeouts, and redacted operational events.

- [ ] **Step 2: Write failing request-boundary tests**

Cover method, JSON content type, body-size limit, origin allowlist, UUID submission ID, field normalization, honeypot, consent, validation errors, `Cache-Control: no-store`, and absence of echoed PII.

- [ ] **Step 3: Run focused tests and observe missing-orchestrator failures**

Run: `npm test -- tests/unit/leads/orchestration.test.ts tests/integration/leads/route.test.ts`  
Expected: FAIL because the lead domain is absent.

- [ ] **Step 4: Implement the domain and mock adapters**

Use `Promise.allSettled` with an adapter-specific timeout and no blind automatic retry. Emit only `lead_delivery_success`, `lead_delivery_partial`, or `lead_delivery_failed` at intake, and `lead_delivery_reconciled` when an authorized operator closes a partial/failed record. Every event contains only submission ID, UTC time, registered page path, destination category, retryability, environment, and deployment ID.

- [ ] **Step 5: Verify redaction and outcome behavior**

Run focused tests with canary values for name, email, phone, address, message, and provider IDs; assert none occur in logs, analytics data, URLs, or response bodies.

- [ ] **Step 6: Commit the lead domain**

```powershell
git add lib/leads lib/integrations app/api/leads tests/unit/leads tests/integration/leads
git commit -m "feat: add safe dual-delivery lead intake"
```

---

### Task 10: Build the estimate form and analytics deduplication contract

**Files:**
- Create: `components/forms/estimate-form.tsx`
- Create: `components/forms/form-status.tsx`
- Create: `lib/analytics/events.ts`
- Create: `lib/analytics/lead-conversion.ts`
- Create: `components/analytics/analytics-client.tsx`
- Create: `tests/unit/analytics/lead-conversion.test.ts`
- Create: `tests/e2e/estimate-form.spec.ts`

**Interfaces:**
- Consumes: `POST /api/leads` response `{ ok, outcome, conversionToken }` without vendor/customer identifiers.
- Produces: accessible form states, `emitAcceptedLead(result, sessionStore)`, one `generate_lead` per accepted submission ID, and separate click-to-call behavior.

- [ ] **Step 1: Write failing form and analytics tests**

Cover labels, inline and summary errors, keyboard submission, busy state, retry state, 201/202 success parity, 503 call fallback, no conversion on validation/dual failure, and one conversion across accepted retries.

- [ ] **Step 2: Run the tests and observe missing-component failures**

Run: `npm test -- tests/unit/analytics/lead-conversion.test.ts` and the estimate-form Playwright file.  
Expected: FAIL because form and analytics helpers are absent.

- [ ] **Step 3: Implement the client island**

Generate one opaque UUID per submit intent with `crypto.randomUUID()`, send it only in the request body/header, retain it in session storage for retry deduplication, and clear PII fields according to the approved success UX. Do not place submitted values in the URL.

- [ ] **Step 4: Implement the allowlisted analytics event**

Allow only event name, opaque conversion token, registered page path, allowlisted service category, delivery class, and environment. Reject free-form properties at the TypeScript and runtime boundary.

- [ ] **Step 5: Verify form and event behavior**

Run the unit and Playwright tests with mocked 201, 202, 400, 429, and 503 responses. Inspect captured network requests and data-layer events for PII.

- [ ] **Step 6: Commit the form and analytics contract**

```powershell
git add components/forms components/analytics lib/analytics tests/unit/analytics tests/e2e/estimate-form.spec.ts
git commit -m "feat: add estimate form and conversion deduplication"
```

---

### Task 11: Verify and implement production delivery adapters behind gates

**Files:**
- Create: `docs/integrations/housecall-pro-contract.md`
- Create: `docs/integrations/transactional-email-contract.md`
- Create: `lib/integrations/hcp/production-adapter.ts`
- Create: `lib/integrations/hcp/adapter-factory.ts`
- Create: `lib/integrations/email/production-adapter.ts`
- Create: `lib/integrations/email/adapter-factory.ts`
- Create: `tests/contract/hcp-adapter.test.ts`
- Create: `tests/contract/email-adapter.test.ts`
- Modify: `app/api/leads/route.ts`

**Interfaces:**
- Consumes: verified vendor contracts, `HOUSECALL_PRO_API_KEY` in Production only, and the separately approved email provider configuration.
- Produces: production `DeliveryAdapter` implementations and environment factories that force mocks in Preview.

- [ ] **Step 1: Research the live HCP contract without using the secret**

Using current official documentation and read-only account/plugin capabilities, record the base URL, authentication scheme, plan/permission requirements, exact customer/lead endpoints and fields, accepted statuses, stable acknowledgment, timeouts, rate limits, source/custom-field support, duplicate lookup, and idempotency behavior. Record evidence links and access date. Do not read the local key or make a write.

- [ ] **Step 2: Stop if the verified contract cannot meet the delivery interface**

If HCP cannot create the intended lead safely or cannot support the deduplication contract, report the exact gap and revise the design with Catherine before code. Do not adapt the illustrative strategy sample by guesswork.

- [ ] **Step 3: Obtain transactional-email provider approval**

Present the simplest provider compatible with server-side API delivery, stable message acknowledgment, idempotency, domain authentication, redacted logs, and delivery to `catherine@platinumbleutls.com`. Reuse an existing approved provider if available. Do not create an account, add DNS, or send mail before approval.

- [ ] **Step 4: Write contract tests from the verified documentation**

Mock exact request URLs, headers, payloads, timeouts, success/error bodies, and duplicate/idempotency behavior. Tests must prove Preview cannot instantiate production adapters and client imports cannot reach server modules.

- [ ] **Step 5: Run contract tests and observe missing-adapter failures**

Run: `npm test -- tests/contract/hcp-adapter.test.ts tests/contract/email-adapter.test.ts`  
Expected: FAIL because production adapters are absent.

- [ ] **Step 6: Implement the minimum verified adapters**

Use server-only modules, `cache: "no-store"`, abort timeouts, safe status mapping, and provider-supported idempotency. Never log raw request/response bodies or provider entity IDs.

- [ ] **Step 7: Verify with mocks only**

Run all contract, integration, redaction, type, lint, and build checks. Inspect the client build for server environment names and integration modules.

- [ ] **Step 8: Stop at live configuration and write-test gates**

Provide Catherine the exact Vercel Production variable names and the single controlled test plan. Do not read/configure the HCP key, add email/DNS secrets, or create a real customer/lead/email until Catherine approves at action time.

- [ ] **Step 9: Commit production adapter code without secrets**

```powershell
git add docs/integrations lib/integrations app/api/leads/route.ts tests/contract
git commit -m "feat: add verified production delivery adapters"
```

---

### Task 12: Add the interaction-only Housecall Pro booking launcher

**Files:**
- Create: `lib/integrations/hcp/widget.ts`
- Create: `components/booking/booking-launcher.tsx`
- Create: `tests/e2e/booking-launcher.spec.ts`
- Modify: relevant CTA components

**Interfaces:**
- Consumes: account-specific widget configuration verified in Task 11.
- Produces: `BookingLauncher`, an allowlisted `booking_open` micro-event, trustworthy `booking_complete` only when documented, and call/form fallback.

- [ ] **Step 1: Write the failing critical-path test**

Assert no HCP script/frame/connect request occurs before deliberate click, the button is keyboard operable, failure leaves estimate/call options visible, and a click alone never emits `booking_complete`.

- [ ] **Step 2: Run the focused Playwright test and observe failure**

Run: `npm run test:e2e -- tests/e2e/booking-launcher.spec.ts`  
Expected: FAIL because the launcher is absent.

- [ ] **Step 3: Implement lazy script loading**

Load only the exact verified HCP widget URL after interaction. Keep all primary CTA copy and navigation server-rendered. Sanitize any cross-window message by exact origin and documented message shape.

- [ ] **Step 4: Verify network and performance behavior**

Run the Playwright test and inspect the request waterfall. Confirm no HCP asset participates in the initial LCP path.

- [ ] **Step 5: Commit booking behavior**

```powershell
git add lib/integrations/hcp/widget.ts components/booking tests/e2e/booking-launcher.spec.ts components
git commit -m "feat: lazy-load Housecall Pro booking"
```

---

### Task 13: Add full build-time and rendered-site validation

**Files:**
- Create: `scripts/validate-routes.mjs`
- Create: `scripts/validate-secrets.mjs`
- Create: `scripts/crawl-built-site.mjs`
- Create: `tests/integration/seo/rendered-site.test.ts`
- Create: `tests/integration/security/client-bundle.test.ts`
- Create: `tests/e2e/visual-matrix.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: registries, content, ledger, built output, and local server.
- Produces: one `npm run validate` gate and machine-readable crawl/visual reports excluded from Git unless explicitly reviewed.

- [ ] **Step 1: Write failing validator fixture tests**

Create temporary invalid fixtures for duplicate slugs, missing metadata, wrong canonical origin, noindex+sitemap conflict, redirect loop/chain, unapproved location, unsupported claim, missing media, secret-shaped client text, and PII-shaped log payload.

- [ ] **Step 2: Run validators and observe expected failures**

Run each validator against its invalid fixture and confirm a non-zero exit with the exact route/record field, never the sensitive value.

- [ ] **Step 3: Implement the composite validation command**

`npm run validate` runs typecheck, lint, unit/integration tests, content validation, route validation, legacy validation, secret/client checks, build, rendered crawl, and Playwright tests in a deterministic order.

- [ ] **Step 4: Implement the rendered crawl assertions**

For every registry/ledger URL, assert status, final URL, canonical, index directive, title, description, one H1, sitemap membership, internal links, JSON-LD parseability/IDs, media status, and no accidental preview/editor discovery.

- [ ] **Step 5: Run the complete local release gate**

Run: `npm run validate`  
Expected: exit 0 with 17 retained routes checked, no secret/PII findings, all target widths checked, and primary content verified with JavaScript disabled.

- [ ] **Step 6: Commit the validation suite**

```powershell
git add scripts tests package.json package-lock.json
git commit -m "test: enforce migration release requirements"
```

---

### Task 14: Document environments, editing, DNS events, cutover, and rollback

**Files:**
- Create: `docs/runbooks/environment-matrix.md`
- Create: `docs/runbooks/preview-review.md`
- Create: `docs/runbooks/lead-reconciliation.md`
- Create: `docs/runbooks/cloudflare-event-a.md`
- Create: `docs/runbooks/vercel-event-b.md`
- Create: `docs/runbooks/wordpress-freeze-and-backup.md`
- Create: `docs/runbooks/monitoring-and-rollback.md`
- Create: `tests/unit/docs/runbook-contract.test.ts`

**Interfaces:**
- Consumes: the exact gates and thresholds in the approved spec.
- Produces: executable checklists with evidence fields, named ownership, commands/queries, expected results, stop conditions, and rollback steps.

- [ ] **Step 1: Write failing runbook contract tests**

Assert Event A and Event B are separate documents; Event A names `alina`, `guss`, `dina`, `rex`, `62.72.53.7`, and the DS lifecycle; Event B preserves email records and restores `62.72.53.7`; monitoring names Catherine and every rollback threshold; the WordPress runbook states 30-day operation and long-term restore retention.

- [ ] **Step 2: Run the documentation tests and observe missing-file failures**

Run: `npm test -- tests/unit/docs/runbook-contract.test.ts`  
Expected: FAIL because the runbooks are absent.

- [ ] **Step 3: Write Event A as an authority-control procedure**

Include zone exports/comparison, current public DNS snapshot, direct-origin verification, registrar-supported account/zone move, old-DS removal before NS change, new-DS publication after stable authority, web/media/mail verification, action-time message approval, and rollback to recorded `alina`/`guss` state.

- [ ] **Step 4: Write Event B as the application cutover procedure**

Include final backup/restore proof, freeze, crawl/ledger/media audit, preview acceptance, exact Vercel domain values, TLS pre-provisioning, DNS-only apex/`www` changes, untouched mail records, apex canonical, representative production crawl, approved lead canary, Search Console submission, and rollback to `62.72.53.7`.

- [ ] **Step 5: Write monitoring and reconciliation procedures**

Name Catherine as alert/reconciliation/rollback owner, require the change-window technical responder to be named before cutover, specify external checks and five-minute/two-region thresholds, document redacted lead event closure, and prohibit percentages that mislead at low volume.

- [ ] **Step 6: Verify and commit the runbooks**

Run: `npm test -- tests/unit/docs/runbook-contract.test.ts`  
Expected: PASS.

```powershell
git add docs/runbooks tests/unit/docs
git commit -m "docs: add migration and operations runbooks"
```

---

### Task 15: Review, push, protect, and create the first preview behind approvals

**Files:**
- Modify only files required by review findings.
- External gated configuration: GitHub private repository, branch protection, GitHub App, Vercel project, Preview environment variables, Deployment Protection.

**Interfaces:**
- Consumes: clean local `main`, all prior commits, `npm run validate` evidence, and Catherine's explicit approvals.
- Produces: protected remote `main`, pull-request preview workflow, protected/noindex Vercel preview, and no production-domain attachment.

- [ ] **Step 1: Run the fresh release gate**

Run: `git status --short --branch` and `npm run validate`.  
Expected: clean tree and complete validation exit 0.

- [ ] **Step 2: Perform code and spec-conformance review**

Use `superpowers:requesting-code-review`. Resolve findings with `superpowers:receiving-code-review`, rerun focused tests for every change, then rerun `npm run validate`.

- [ ] **Step 3: Present push and external configuration changes for approval**

Show the commit list, remote URL, repository visibility, proposed branch rules, GitHub App permissions, Vercel owner/project, preview protection setting, and environment matrix. State explicitly that the production domain and HCP key are excluded.

- [ ] **Step 4: Push only after explicit approval**

```powershell
git push -u origin main
```

Verify the remote commit hash and private repository visibility.

- [ ] **Step 5: Configure protected review flow only after approval**

Require pull requests and passing checks for `main`; prevent direct pushes; configure the repository-scoped Keystatic GitHub App; connect Vercel; enable Preview Deployment Protection; add mock-only Preview variables; create a `content/verification` edit branch and pull request.

- [ ] **Step 6: Verify the first protected preview**

From unauthenticated access, confirm protection blocks content. From approved access, run the rendered crawl and inspect `X-Robots-Tag: noindex`; confirm no production HCP key or live delivery call exists; exercise a browser content edit through branch, pull request, preview, and manual merge review without attaching `platinumbleutls.com`.

- [ ] **Step 7: Record verified and blocked production state**

Update the runbook evidence with preview URL, deployment ID, commit, test results, and unresolved production gates. Do not claim migration completion before Events A/B, live lead approval, Search Console verification, and the monitoring period.

- [ ] **Step 8: Commit any evidence-only documentation update**

```powershell
git add docs/runbooks
git commit -m "docs: record protected preview verification"
```

---

## Final implementation verification checklist

- [ ] `git status --short --branch` is clean and the final commit is identified.
- [ ] `npm run validate` exits 0 on Node.js 24.x.
- [ ] Build output shows 17 public routes statically generated and only approved dynamic endpoints.
- [ ] Rendered crawl proves status, canonical, robots, sitemap, metadata, one H1, links, schema, and media behavior.
- [ ] Browser matrix passes at 360, 390, 768, and 1440 CSS pixels with accessibility and no-JavaScript checks.
- [ ] HCP widget is absent from the critical path.
- [ ] Mock form tests prove full, both partial, and dual-failure outcomes plus non-PII reconciliation events.
- [ ] Analytics emits once only after accepted delivery and contains no PII.
- [ ] Repository and client bundle contain no secrets, private audit evidence, backups, database exports, recovery codes, or customer data.
- [ ] Keystatic uses a protected `content/` branch and preview review against the selected private repository.
- [ ] Preview is protected/noindex and has no production HCP key.
- [ ] External systems changed during the session are listed with approval and verification evidence.
- [ ] Production DNS/domain, HCP write, email, analytics, Search Console, WordPress, and destructive actions remain blocked until their named gates are approved.
