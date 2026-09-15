# Platinum Bleu Next.js SEO Migration Strategy

**Prepared:** September 14, 2026  
**Business:** Platinum Bleu Tree Service  
**Current domain:** `https://platinumbleutls.com`  
**Target stack:** Next.js App Router, Vercel, Cloudflare DNS, Housecall Pro

## Executive recommendation

The strongest architecture for Platinum Bleu is to:

- Keep `platinumbleutls.com` and the existing WordPress URL paths wherever possible.
- Use the Next.js App Router with primarily prerendered Server Components.
- Let Vercel own application delivery, ISR, image optimization, and performance telemetry.
- Keep Cloudflare as registrar and authoritative DNS initially, not as a second reverse-proxy CDN in front of Vercel.
- Use Housecall Pro's on-site booking modal for scheduling and a first-party Next.js endpoint for attributable website leads.
- Treat AEO as excellent technical SEO plus locally specific, expert-supported content, not a separate collection of schema hacks.

This approach has the best balance of crawlability, performance, local relevance, conversion tracking, and migration safety for an intermediate developer maintaining the rebuild.

## Source and verification status

This strategy is grounded in:

- The public September 9, 2026 WordPress baseline now retained in `docs/migration/baseline/wordpress-2026-09-09/`, plus the restricted authenticated audit that remains in `C:\dev\Platinum Bleu\outputs\wordpress-audit-2026-09-09\`.
- The current WordPress page sitemap and public crawl results.
- The authenticated Platinum Bleu Google Drive identity.
- Current primary documentation from Next.js, Vercel, Cloudflare, Google Search Central, web.dev, and Housecall Pro.

The supplemental ChatGPT share URL supplied during planning returned **Shared chat not found** and its contents could not be incorporated. Reconcile any decisions from that conversation before implementation if a new accessible share is provided.

The Housecall Pro connector is installed but is not currently connected because `HOUSECALL_PRO_API_KEY` is not configured. The integration patterns below are therefore technically grounded but are not certified against Platinum Bleu's enabled Housecall Pro plan, fields, services, or booking callbacks.

## Verified starting point

The September 9 audit established:

- 17 URLs in the WordPress page sitemap.
- Six primary service pages: tree trimming, tree removal, stump removal, emergency tree services, debris removal, and land clearing.
- Five city pages: Little Rock, Conway, Benton, Maumelle, and Sherwood.
- All 17 sampled URLs returned HTTP 200.
- Most pages had duplicated H1 patterns.
- No `LocalBusiness` type was found in the sampled Yoast schema graphs.
- The inspected GA4 property had no data stream, and the inspected GTM workspace had no tags.
- Cloudflare apex and `www` records were DNS-only while Hostinger/LiteSpeed served the live site.
- Current field Core Web Vitals were unavailable.

Before rebuilding, preserve `docs/migration/baseline/wordpress-2026-09-09/public-crawl.json` and `docs/migration/baseline/wordpress-2026-09-09/page-sitemap.xml` in the repository. Keep the access-sensitive `MEETING-BRIEF.md` in the restricted parent workspace.

## 1. Next.js application architecture

### Rendering model

Use the App Router and default to Server Components.

| Content | Rendering | Revalidation |
|---|---|---:|
| Homepage and core service pages | Static generation | On deploy or on demand |
| Location pages | Static generation plus ISR | 24 hours |
| Educational articles | Static generation plus ISR | 1-24 hours |
| Contact and estimate-request pages | Static shell with client form island | On deploy |
| Housecall Pro booking | Client component loaded on interaction | Never part of SEO rendering |
| Form submission and API routes | Dynamic server route | Never cache |
| Sitemap and robots | Generated metadata routes | Deploy or on demand |

Headings, service explanations, location proof, FAQs, internal links, reviews, and contact information must exist in the initial HTML. Do not fetch primary SEO content after hydration.

Limit client components to navigation behavior, galleries, booking launchers, form state, and analytics event helpers.

### URL strategy

Retain the current URLs:

```text
/tree-trimming-services/
/tree-removal-services/
/stump-removal-services/
/emergency-tree-services/
/debris-removal-services/
/land-clearing-services/
/little-rock-ar/
/conway-ar/
/benton-ar/
/maumelle-ar/
/sherwood-ar/
```

This avoids unnecessary redirects for URLs already known to Google. A future `/service-areas/little-rock-ar/` structure provides little inherent ranking benefit and creates migration risk.

Suggested route layout:

```text
app/
  layout.tsx
  page.tsx
  tree-removal-services/page.tsx
  tree-trimming-services/page.tsx
  (locations)/
    [location]/page.tsx
```

Static service routes take precedence over the root-level dynamic location route. Set `dynamicParams = false` so unapproved city slugs return real 404 responses.

### Dynamic location-page pattern

```tsx
// app/(locations)/[location]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locations, getLocation } from "@/content/locations";
import { JsonLd } from "@/components/seo/json-ld";
import { buildLocationGraph } from "@/lib/seo/schema";

export const revalidate = 86_400;
export const dynamicParams = false;

type Props = {
  params: Promise<{ location: string }>;
};

export function generateStaticParams() {
  return locations.map(({ slug }) => ({ location: slug }));
}

export async function generateMetadata(
  { params }: Props,
): Promise<Metadata> {
  const { location: slug } = await params;
  const location = getLocation(slug);

  if (!location) return {};

  const canonical = `https://platinumbleutls.com/${location.slug}/`;

  return {
    title: `Tree Services in ${location.name}, AR | Platinum Bleu`,
    description: location.metaDescription,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title: `Tree Services in ${location.name}, Arkansas`,
      description: location.metaDescription,
      images: [{
        url: location.socialImage,
        width: 1200,
        height: 630,
        alt: `Platinum Bleu tree service work near ${location.name}`,
      }],
    },
  };
}

export default async function LocationPage({ params }: Props) {
  const { location: slug } = await params;
  const location = getLocation(slug);

  if (!location) notFound();

  return (
    <>
      <JsonLd value={buildLocationGraph(location)} />
      <main>
        <article>
          <header>
            <p>Serving {location.name} and surrounding communities</p>
            <h1>Tree Services in {location.name}, Arkansas</h1>
            <p>{location.introduction}</p>
          </header>
          {/* Render substantive, city-specific content here. */}
        </article>
      </main>
    </>
  );
}
```

A city page should only be indexable when it contains real local value: actual projects or photographs, true service boundaries, local operating considerations, accurate availability, and purposeful links to relevant services. Do not generate every city/service combination.

### Metadata

Set global defaults in `app/layout.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://platinumbleutls.com"),
  title: {
    default: "Platinum Bleu Tree Service",
    template: "%s | Platinum Bleu",
  },
  description:
    "Professional tree removal, tree trimming, stump removal, land clearing, debris cleanup, and emergency tree service in Central Arkansas.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    siteName: "Platinum Bleu Tree Service",
    type: "website",
    locale: "en_US",
  },
};
```

Also implement:

- `app/sitemap.ts`
- `app/robots.ts`
- `app/manifest.ts`
- `app/opengraph-image.tsx` or page-specific OG images
- Self-referencing canonicals
- One descriptive H1 per page
- Real 404 responses for unknown cities
- `noindex` for previews, form-success routes, internal search, and campaign duplicates

### Structured data

Use a connected JSON-LD graph:

- Homepage: `Organization`, `HomeAndConstructionBusiness` or `LocalBusiness`, `WebSite`, and `WebPage`.
- Service page: `Service`, `WebPage`, `BreadcrumbList`, and provider reference.
- Location page: `Service`, `WebPage`, `BreadcrumbList`, and `areaServed`.
- Educational article: `Article`, with truthful author or reviewer data.
- FAQ: `FAQPage` only when the same questions and answers are visible on the page.

Do not expose a hidden residential or service-area-business street address to satisfy schema. If the GBP address is intentionally hidden, use truthful public organization details and `areaServed`.

```tsx
// components/seo/json-ld.tsx
export function JsonLd({ value }: { value: object }) {
  const json = JSON.stringify(value).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
```

```ts
const SITE = "https://platinumbleutls.com";

export function buildLocationGraph(location: LocationContent) {
  const pageUrl = `${SITE}/${location.slug}/`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HomeAndConstructionBusiness",
        "@id": `${SITE}/#business`,
        name: "Platinum Bleu Tree Service",
        url: SITE,
        telephone: "+15014048887",
        logo: `${SITE}/images/platinum-bleu-logo.png`,
        areaServed: locations.map((item) => ({
          "@type": "City",
          name: `${item.name}, Arkansas`,
        })),
        sameAs: [], // Add only verified official profiles.
      },
      {
        "@type": "Service",
        "@id": `${pageUrl}#tree-service`,
        name: `Tree Services in ${location.name}, Arkansas`,
        url: pageUrl,
        provider: { "@id": `${SITE}/#business` },
        areaServed: {
          "@type": "City",
          name: `${location.name}, Arkansas`,
        },
        serviceType: [
          "Tree removal",
          "Tree trimming",
          "Stump removal",
          "Land clearing",
          "Debris removal",
          "Emergency tree service",
        ],
      },
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: `Tree Services in ${location.name}, Arkansas`,
        mainEntity: { "@id": `${pageUrl}#tree-service` },
        about: { "@id": `${SITE}/#business` },
      },
    ],
  };
}
```

Do not manufacture ratings, awards, licenses, locations, years in business, or 24/7 availability. Do not create a separate business entity for every city.

## 2. Vercel deployment and caching

Vercel should be the single application delivery and cache-control owner.

Use:

- Production deployments from a protected main branch.
- Preview deployments protected from indexing.
- ISR for content-backed service and location pages.
- On-demand revalidation after approved content changes.
- Immutable caching for hashed Next.js assets.
- `no-store` for lead, webhook, preview, and authenticated endpoints.
- Vercel Speed Insights for real-user performance.
- GA4 for acquisition and conversion reporting.
- Vercel Observability and function logs for integration failures.

Do not apply broad manual `Cache-Control` overrides to normal Next.js pages. Let Next.js and Vercel coordinate static output and ISR.

### Performance targets

Use Google's field thresholds at the 75th percentile, separately for mobile and desktop:

- LCP: at or below 2.5 seconds
- INP: at or below 200 milliseconds
- CLS: at or below 0.1

Internal launch guardrails:

- Representative Lighthouse mobile performance score of at least 90.
- No layout movement from images, fonts, cookie notices, booking widgets, or form messages.
- No third-party booking, review, or chat JavaScript in the critical rendering path.
- Hero/LCP image preloaded or given `priority`.
- Explicit dimensions for every image.
- Fonts self-hosted through `next/font`.
- Primary content usable without client-side JavaScript.
- Booking and forms tested at 360, 390, 768, and 1440 CSS pixels.

Lighthouse 90 is an internal engineering budget, not a ranking guarantee. Field data from Speed Insights, CrUX, and Search Console is authoritative after launch.

## 3. Cloudflare architecture

### Recommended: DNS-only in front of Vercel

Keep Cloudflare for:

- Registration
- Authoritative DNS
- DNSSEC
- Email DNS records
- Account recovery and administrative control

Point production web records to Vercel while leaving them DNS-only:

```text
Visitor -> Vercel Edge -> Next.js
              ^
Cloudflare registrar and authoritative DNS
```

Avoid this unless a proven requirement justifies it:

```text
Visitor -> Cloudflare proxy/cache -> Vercel cache -> Next.js
```

Vercel advises against placing another reverse proxy in front of its edge because it can add latency, obscure security signals, and create double-cache invalidation problems.

With DNS-only records, Cloudflare Cache Rules and primary-hostname image transformations do not affect site delivery. Use `next/image` and Vercel's optimizer initially.

### If Cloudflare proxying becomes mandatory

- Respect origin cache headers.
- Never enable Cache Everything across the whole site.
- Bypass `/api/*`, booking, forms, webhooks, previews, and personalized routes.
- Do not cache errors or redirects for long periods.
- Preserve host and protocol.
- Do not rewrite canonicals.
- Purge both caching layers after changes.
- Verify that Googlebot is never challenged.
- Test HIT/MISS behavior and ISR freshness before production.

### Security headers

Emit version-controlled headers from Next.js/Vercel:

```ts
// next.config.ts
import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
```

Add Content Security Policy only after confirming Housecall Pro's exact script, frame, and connection domains. Start with `Content-Security-Policy-Report-Only`, inspect violations, then enforce the policy.

## 4. Housecall Pro integration

Use two conversion paths.

### Online booking: native Housecall Pro modal

Use Housecall Pro's supported booking-button code so the booking experience opens over the Platinum Bleu page.

Benefits:

- Visitor remains visually on the website.
- The landing page remains behind the modal.
- HCP owns services, availability, pricing, deposits, and booking creation.
- Lower implementation and data-handling risk.

Limitations:

- Immediate widget loading can increase INP.
- Iframe isolation may prevent detailed step tracking.
- Styling and accessibility control are limited.
- Modal content is not first-party indexable content.

Load the booking script only after intent:

```tsx
"use client";

import Script from "next/script";
import { useState } from "react";

export function BookingLauncher() {
  const [loadWidget, setLoadWidget] = useState(false);

  function beginBooking() {
    window.dataLayer?.push({
      event: "booking_open",
      booking_provider: "housecall_pro",
      page_path: window.location.pathname,
    });
    setLoadWidget(true);
  }

  return (
    <>
      <button type="button" onClick={beginBooking}>
        Book an estimate
      </button>
      {loadWidget && (
        <Script
          src={process.env.NEXT_PUBLIC_HCP_WIDGET_SRC}
          strategy="afterInteractive"
        />
      )}
    </>
  );
}
```

Do not count a button click as a completed booking. Emit `booking_complete` only from a documented HCP callback, message, redirect, or server webhook that proves completion.

If available in the account, configure HCP Reserve with Google against the verified Google Business Profile rather than simulating the feature with schema.

### First-party estimate and contact form

Use this flow:

```text
Browser
  -> POST /api/leads
  -> validation, spam check, and rate controls
  -> create or find HCP customer
  -> create HCP lead
  -> return first-party success state
```

```ts
// lib/housecall-pro.ts
const HCP_API = "https://api.housecallpro.com";

async function hcpRequest<T>({
  path,
  method = "GET",
  body,
}: {
  path: string;
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
}): Promise<T> {
  const token = process.env.HOUSECALL_PRO_API_KEY;

  if (!token) throw new Error("Housecall Pro is not configured");

  const response = await fetch(`${HCP_API}${path}`, {
    method,
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Housecall Pro request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function createHcpLead(input: ValidatedLead) {
  const customer = await hcpRequest<{ id: string }>({
    path: "/customers",
    method: "POST",
    body: {
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email || undefined,
      mobile_number: input.phone,
      addresses: input.address ? [input.address] : undefined,
    },
  });

  return hcpRequest<{ id: string }>({
    path: "/leads",
    method: "POST",
    body: {
      customer_id: customer.id,
      message: input.message,
      source: "Platinum Bleu website",
    },
  });
}
```

```ts
// app/api/leads/route.ts
import { NextResponse } from "next/server";
import { createHcpLead } from "@/lib/housecall-pro";
import { leadSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const result = leadSchema.safeParse(raw);

    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: "Please check the highlighted fields." },
        { status: 400 },
      );
    }

    // Verify anti-spam token, honeypot, and rate limit here.
    const lead = await createHcpLead(result.data);

    return NextResponse.json(
      { ok: true, leadReference: lead.id },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "We could not send your request. Please call (501) 404-8887.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
```

Verify the precise request schema against the current HCP documentation and Platinum Bleu account before shipping.

### Housecall Pro implementation gate

Confirm:

- Eligible MAX or XL API access.
- Admin ownership and authorization for the website credential.
- Required credential permissions.
- Enabled API Leads channel.
- Exact customer and lead payload fields.
- Lead-source values, custom fields, and service types.
- Booking-completion callbacks or webhooks.

Never paste the HCP credential into chat or commit it to the repository. Store it only in approved encrypted connection settings and Vercel environment variables.

### Attribution

Capture first-party landing attribution:

```ts
type Attribution = {
  firstLandingPath: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  gclid?: string;
  wbraid?: string;
  gbraid?: string;
};
```

On an accepted lead:

- Attach attribution to the HCP lead through supported fields or a private note.
- Send GA4 `generate_lead` only after server acceptance.
- Never send customer name, email, phone, address, message, or HCP ID into analytics or advertising parameters.
- Use an analytics-safe conversion ID for deduplication.
- Reconcile website successes with HCP accepted leads.
- Track click-to-call separately from accepted form lead and completed booking.

## 5. Local SEO and AEO

Google does not require special AI schema or an AI text file for AI Overviews or AI Mode. Eligible sources must be indexable, snippet-eligible, crawlable, internally linked, technically sound, and useful.

### Page structure for answer extraction

Each important page should contain:

1. One explicit topic and H1.
2. A 40-70 word direct answer beneath the H1.
3. H2 sections centered on real customer decisions.
4. Short, complete paragraphs.
5. Ordered steps for procedural answers.
6. Comparison tables for cost factors, risk, timing, and service choices.
7. FAQs based on real customer questions.
8. Original photographs with descriptive captions.
9. Truthful authorship or expert review.
10. A visible review date on advice likely to change.

Example:

```md
# Tree Removal in Little Rock, Arkansas

Platinum Bleu removes hazardous, storm-damaged, dead, and unwanted
trees for residential and commercial properties in Little Rock.
The process begins with an on-site assessment covering tree condition,
access, nearby structures, equipment requirements, debris removal,
and whether stump removal is included.

## When should a tree be removed instead of trimmed?

Direct answer...

## What affects the cost of tree removal in Little Rock?

| Factor | Why it changes the work |
|---|---|
| Tree height | ... |
| Access | ... |
| Utility lines | ... |
| Storm damage | ... |
```

### Entity and GBP consistency

Maintain one canonical business entity across:

- Website
- Google Business Profile
- Housecall Pro
- Bing Places
- Apple Business Connect
- Verified social profiles
- Legitimate local and industry citations

Keep the public business name, phone, site URL, service areas, categories, hours, emergency availability, logo, history, and team information consistent and accurate.

For the GBP:

- Use the most accurate primary category and only legitimate secondary categories.
- Link the website field to the canonical homepage.
- Link booking to the appropriate on-site destination where supported.
- Keep HCP Reserve with Google consistent with GBP.
- Use real service areas rather than an inflated radius.
- Publish real project photos with useful context and consent.
- Request and respond to reviews through a documented post-job process.
- Avoid templated keyword stuffing.
- Track GBP website and appointment URLs with distinct UTMs when supported.

### FAQ schema priority

Visible FAQs have user and answer-engine value, but `FAQPage` schema has low direct SERP-display value for this business. Google generally limits FAQ rich results to authoritative government and health sites.

- Prioritize useful visible answers.
- Use schema only when it exactly matches the visible content.
- Do not mass-produce FAQ blocks.
- Do not expect FAQ schema alone to improve rankings.

### Highest-value content assets

- Removal versus trimming decision guides.
- Storm-damage safety and first steps.
- What an estimate includes.
- Tree-removal cost factors without fabricated price guarantees.
- Crane, access, and utility-line considerations.
- Stump grinding versus full stump removal.
- Debris-removal scope.
- Land-clearing preparation and exclusions.
- Local case studies using original project photos.
- Service-area limits and emergency-response process.
- Accurate insurance and storm-claim documentation guidance.

Original job evidence is more valuable than a large collection of generic city pages.

## 6. WordPress migration safeguards

### Master URL ledger

Create the complete inventory from:

- WordPress XML export
- WordPress database and page inventory
- XML sitemaps
- Search Console indexed and landing-page exports
- Valid historic GA landing pages
- Backlink exports
- Server logs
- Rendered internal links
- Media URLs with inbound links
- WordPress, Yoast, hosting, `.htaccess`, and Cloudflare redirects

Each ledger row should contain:

```text
Old URL
HTTP status
Canonical
Index directive
Page type
Traffic
Conversions
Backlinks
New URL
Redirect action
Content owner
QA status
```

### Mapping rules

1. Retain the exact URL when valuable content remains equivalent.
2. Use a direct 301 or 308 when content has a new path.
3. Redirect consolidated pages only to genuinely equivalent consolidated content.
4. Use a relevant successor when one truly exists.
5. Return a real 404 or 410 when no equivalent exists.
6. Never redirect every removed page to the homepage.

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  async redirects() {
    return [
      {
        source: "/tree-cutting/",
        destination: "/tree-removal-services/",
        permanent: true,
      },
      {
        source: "/stump-grinding/",
        destination: "/stump-removal-services/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
```

For a large historic inventory, generate redirect configuration from a reviewed data file rather than maintaining a huge handwritten array.

Normalize HTTP, hostname, case, trailing-slash, and legacy-path variants directly to the final canonical URL. Avoid redirect chains.

### Media preservation

Do not casually break historic `/wp-content/uploads/...` URLs.

- Preserve important old paths in public storage, or redirect each linked media URL to the exact replacement.
- Update page markup to optimized new assets.
- Retain redirects for externally linked media.
- Never redirect every old image to the logo or a generic gallery.

### Search Console transition

Because the domain should stay the same:

- Do not use Change of Address.
- Keep the existing domain property verified.
- Export pre-launch performance and indexing baselines.
- Submit the new sitemap at launch.
- Remove obsolete sitemap submissions after acceptance.
- Inspect representative homepage, service, city, and article URLs.
- Monitor indexing, crawl activity, 404s, canonicals, Core Web Vitals, structured-data errors, and branded/non-branded queries.
- Request indexing for a representative set rather than repeatedly submitting every URL.

Keep permanent redirects for at least one year and preferably indefinitely for useful historic URLs.

### Cutover sequence

1. Freeze WordPress content edits.
2. Export final database, files, sitemaps, redirects, forms, and SEO metadata.
3. Preserve the existing live site and a restore-capable backup.
4. Crawl WordPress one final time.
5. Crawl the Vercel preview against the URL ledger.
6. Confirm preview protection and `noindex` cannot reach production.
7. Validate every redirect.
8. Validate canonicals, robots, sitemap, JSON-LD, headings, links, images, and status codes.
9. Test HCP booking and one explicitly approved form submission end to end.
10. Verify GA4 and GTM without transmitting PII.
11. Lower DNS TTL before the planned cutover.
12. Connect the production domain to Vercel.
13. Validate TLS and apex/`www` normalization.
14. Run the full production crawl.
15. Submit the sitemap.
16. Keep WordPress recoverable but non-authoritative during monitoring.
17. Monitor daily for one week and weekly through the first 90 days.

## Priority and trade-offs

| Priority | Work | SEO or conversion impact | Complexity |
|---|---|---:|---:|
| P0 | Preserve domain and valuable paths | Very high | Low |
| P0 | Complete URL inventory and redirect QA | Very high | Medium |
| P0 | Render primary content in initial HTML | Very high | Low |
| P0 | Verify booking and lead delivery end to end | Very high | Medium |
| P0 | Establish GA4 and GTM without PII | High | Medium |
| P1 | Create unique service and location content | Very high | High editorial effort |
| P1 | Implement connected business and service schema | Medium | Medium |
| P1 | Add Speed Insights and performance budgets | High | Low |
| P1 | Publish original case studies and job photography | High | Ongoing |
| P1 | Add first-party HCP lead endpoint | High | Medium-high |
| P2 | Add FAQ schema | Low direct SERP impact | Low |
| P2 | Add on-demand content revalidation | Medium operational value | Medium |
| P3 | Proxy Vercel through Cloudflare | Uncertain and potentially negative | High |
| P3 | Create a separate Cloudflare image pipeline | Low until scale demands it | Medium |
| Avoid | Mass city and service combinations | High SEO risk | High |
| Avoid | Treat `llms.txt` as an AEO project | No demonstrated Google requirement | Low but distracting |

## Delivery phases

### Phase 1: preservation and measurement

- Final WordPress inventory and backup.
- Complete URL ledger.
- Identify the canonical GA4 property or establish a new web stream.
- Configure GTM and conversion definitions.
- Verify HCP plan, Admin ownership, booking widget, API Leads, and credential path.

### Phase 2: Next.js foundation

- App Router shell.
- Existing URL routes.
- Metadata, sitemap, robots, status handling, and schema.
- Image and font performance.
- On-site booking launcher.
- First-party form UX.

### Phase 3: content migration

- Preserve approved copy first.
- Correct H1 and template structure.
- Add verified business entity details.
- Improve thin city pages only when local evidence is available.
- Add service FAQs and decision content.
- Add original project proof.

### Phase 4: integration and cutover

- HCP test workflow.
- Attribution and conversion deduplication.
- Full redirect crawl.
- Vercel production verification.
- DNS cutover.
- Search Console submission and monitoring.

## Approval and ownership gates

The following require owner approval or owner-authorized access before execution:

- Production DNS changes.
- WordPress freeze or shutdown.
- Housecall Pro credential creation and write access.
- A live form or booking test that creates a customer, lead, estimate, or job.
- GA4, GTM, Google Ads, or GBP configuration changes.
- Public copy changes, including business claims, prices, hours, and service areas.
- Publishing or deployment to the production domain.

## Definition of done

The migration is complete only when:

- Every inventoried legacy URL has a verified retain, redirect, 404, or 410 disposition.
- Production pages return intended status codes and self-canonicals.
- Robots and sitemap expose only intended indexable URLs.
- Structured data matches visible content and validates.
- No key content depends on client-side rendering.
- Representative mobile and desktop performance meets the agreed launch budgets.
- Booking and an approved form submission are verified through Housecall Pro.
- GA4 records one conversion per accepted lead and no PII.
- Cloudflare DNS, Vercel domain state, TLS, and hostname redirects are verified.
- Search Console accepts the sitemap and representative URL inspections pass.
- The WordPress backup and rollback path remain usable through the monitoring window.

## Primary references

- [Next.js `generateMetadata`](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Vercel and Cloudflare guidance](https://vercel.com/kb/guide/cloudflare-with-vercel)
- [Cloudflare Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/)
- [Google LocalBusiness structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business)
- [Google AI features and websites](https://developers.google.com/search/docs/appearance/ai-features)
- [Google generative AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [Google site migration guidance](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)
- [Core Web Vitals](https://web.dev/articles/vitals)
- [Housecall Pro Online Booking](https://help.housecallpro.com/en/articles/7034474-online-booking-overview)
- [Housecall Pro Public API](https://docs.housecallpro.com/)
