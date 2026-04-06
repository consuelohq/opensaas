# SEO and LLM Discoverability Audit

Date: 2026-03-31
Scope:
- https://consuelohq.com
- https://consuelohq.com/blog
- https://docs.consuelohq.com

## Executive summary

The main marketing site and blog are publicly reachable and expose crawlable HTML links, which means the setup is not fundamentally invisible. However, the current implementation appears only partially optimized for search and LLM discoverability.

The strongest issues found in the live experience are:
1. A broken docs navigation target for AI Overview.
2. Mixed branding and stale copy across docs and homepage navigation ("Twenty" remnants remain visible in important navigational areas).
3. Homepage topical focus is diluted by a very large docs/navigation block appearing before or alongside the primary marketing message.
4. Some high-signal SEO items could not be verified from the public page output alone and should be checked in Search Console and source-level metadata.

## What looks good already

### 1) Publicly reachable surfaces
- `consuelohq.com` resolves publicly.
- `consuelohq.com/blog` resolves publicly.
- `docs.consuelohq.com` resolves publicly and serves rendered documentation content.

### 2) Crawlable HTML links exist
The marketing homepage exposes many standard anchor links to docs and other site sections. The blog index also exposes standard linked post cards, categories, and resource links. This is directionally good for discovery.

### 3) Blog structure is useful
The blog index has:
- topical categories
- dated entries
- descriptive article titles
- summaries/excerpts

That is helpful for both classic search and retrieval by assistants.

## Confirmed issues

### P0 — Broken docs route: AI Overview
The docs navigation exposes an `AI -> Overview` entry, but the linked destination resolves to a 404:
- expected linked path from nav: `/user-guide/ai/overview`
- observed result: broken page

This is a direct discoverability and UX defect. It wastes internal linking equity, creates a poor crawl path, and signals content inconsistency.

**Recommended fix**
- Restore the page at `/user-guide/ai/overview`, or
- update all nav references to the canonical working AI overview URL, and
- add a redirect from the broken path if the slug changed.

### P1 — Brand/content inconsistency in docs and homepage navigation
Visible docs and homepage navigation still contain multiple references to `Twenty`, including:
- `What is Twenty`
- `Navigate around Twenty`
- `can i send emails from twenty`
- `Discover Twenty`
- `What is Consuelo Next`

This creates confusion for users, weakens topical coherence for search engines, and risks splitting relevance between old and new product naming.

**Recommended fix**
- Audit all docs nav labels, article titles, headings, breadcrumbs, and FAQ text for stale `Twenty` references.
- Replace legacy naming or intentionally preserve it only where it is part of a migration/compatibility note.
- Add redirects or alias pages if legacy queries still matter.

### P1 — Homepage topical dilution
The homepage appears to surface a large documentation-style navigation block near the top before the core marketing story fully establishes the main topic.

This is not necessarily a technical indexing failure, but it is likely suboptimal from a search and page-framing standpoint. The homepage should strongly and immediately communicate the primary commercial/topic intent.

**Recommended fix**
- Keep the top-level docs link in navigation, but reduce the huge docs catalog exposure on the homepage.
- Move large docs inventories to dedicated docs/search pages instead of presenting them as a dominant homepage element.
- Strengthen above-the-fold message clarity and keep one primary topic per page.

### P1 — Title/heading alignment should be tightened
The homepage visual heading is strong (`sales infrastructure that integrates everywhere`) but the page title appears comparatively thin (`Consuelo`).

This can make title-link generation and page-topic interpretation weaker than it should be.

**Recommended fix**
- Use a more descriptive title pattern for the homepage.
- Suggested direction: `Consuelo | Open-Source Sales Infrastructure for Insurance Teams`
- Keep title, H1, and supporting copy aligned around the same commercial/topic intent.

### P2 — Docs information architecture needs cleanup
The docs home is live and rendered, but there are signals of roughness:
- duplicated `Get Started`
- stale `Twenty` naming
- broken AI overview link
- mixed conceptual labeling across sections

This does not prevent indexing by itself, but it reduces trust, clarity, and retrieval quality.

**Recommended fix**
- Run a docs IA cleanup pass.
- Check global nav, sidebar groups, page titles, and "Next" links.
- Ensure every important section has one canonical landing page and no dead ends.

## Things that must be checked in Search Console / source code

These are not safely confirmable from live page text alone and should be verified directly in implementation and GSC:

### Technical verification checklist
- [ ] `robots.txt` exists and allows crawling of marketing, blog, and docs paths.
- [ ] `sitemap.xml` exists and includes canonical marketing pages, blog posts, and docs pages.
- [ ] Search Console property is verified for both root domain and relevant subdomains as needed.
- [ ] Canonicals are present and correct on homepage, blog index, blog posts, docs home, and docs pages.
- [ ] Pages return `200` for canonicals and `301`/`308` only where intentionally redirected.
- [ ] No important pages are tagged `noindex`, `nofollow`, or overly restrictive `max-snippet` values.
- [ ] Open Graph and standard metadata match visible page titles and descriptions.
- [ ] Important docs/blog content is present in rendered HTML and not hidden behind brittle client-only rendering.
- [ ] Broken links are scanned and fixed sitewide.

### Content verification checklist
- [ ] Homepage title rewritten to match the main commercial/topic target.
- [ ] Brand terms standardized across homepage, docs, and blog.
- [ ] One primary keyword/topic intent per key landing page.
- [ ] Blog posts link back into relevant docs/product pages and vice versa.
- [ ] Important docs pages have descriptive titles, H1s, summaries, and internal links.

## LLM discoverability recommendations

### 1) Add `/llms.txt`
This is not required for Google SEO, but it is a useful additive layer for AI assistants and retrieval systems.

Suggested sections:
- product summary
- core product pages
- docs root
- getting started docs
- AI/coaching docs
- dialer docs
- CRM/docs for insurance teams
- blog categories or selected flagship articles

### 2) Offer clean machine-readable docs paths where possible
If your docs stack supports it, expose markdown or simplified text representations for high-value docs pages.

### 3) Curate core docs pages
Do not rely on the full docs tree alone. Identify the 10 to 20 pages that best explain:
- what Consuelo is
- who it is for
- CRM
- dialer
- AI coaching
- workflows
- GHL integration
- self-hosting / open-source

These should be internally linked from the docs root and referenced in `llms.txt`.

## Priority plan

### This week
1. Fix the broken AI Overview docs route.
2. Remove or rewrite stale `Twenty` references in visible navigation and key docs pages.
3. Tighten homepage title and meta description.
4. Confirm `robots.txt`, `sitemap.xml`, canonicals, and indexing status in Search Console.

### Next
1. Reduce homepage docs-nav overload.
2. Clean up docs landing page labels and next-links.
3. Add `llms.txt`.
4. Build a shortlist of canonical high-value docs pages for AI/search discovery.

## Suggested owners
- Marketing site metadata / homepage framing: web
- Docs IA and broken routes: docs or product engineering
- Search Console + sitemap verification: growth / web
- `llms.txt` and curated AI discovery paths: web + docs

## Definition of done
- Broken docs links fixed or redirected.
- Brand naming is consistent across key public surfaces.
- Homepage title/H1/meta are aligned.
- Sitemap and robots are verified.
- Search Console confirms indexing for homepage, blog, a representative blog post, docs home, and representative docs pages.
- `llms.txt` published and reviewed.
