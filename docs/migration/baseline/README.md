# Migration Baseline

This directory retains the non-sensitive public evidence needed to build and verify the Platinum Bleu WordPress replacement.

## Repository-retained sources

- `PLATINUM-BLEU-NEXTJS-SEO-MIGRATION-STRATEGY.md` in the parent `docs/migration/` directory
- `wordpress-2026-09-09/public-crawl.json`
- `wordpress-2026-09-09/page-sitemap.xml`
- `wordpress-2026-09-09/home-public.html`
- `wordpress-2026-09-09/contact-public.html`
- `wordpress-2026-09-09/public-headers.txt`

These files were moved from `C:\dev\Platinum Bleu` into the child repository after the design specification was approved.

## Restricted sources that remain outside Git

The authenticated WordPress user/plugin/site-health evidence, Cloudflare account and audit views, GA4/GTM/Search Console captures, forensic collection documents, owner access checklist, and related internal records remain at:

`C:\dev\Platinum Bleu\outputs\wordpress-audit-2026-09-09\`

They may be read locally when a task requires them. They must not be copied into Git without a separate privacy and necessity review. Secrets, customer data, recovery codes, database exports, and raw backups are always excluded.

