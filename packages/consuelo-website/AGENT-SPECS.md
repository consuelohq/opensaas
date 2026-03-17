# Consuelo Website — Agent Specs

## Agent Tooling — MANDATORY

**Use `qmd` before writing any copy** to pull real Consuelo product context:
```bash
qmd query "consuelo product positioning insurance sales"
qmd query "consuelo features dialer coaching CRM analytics"
qmd query "consuelo pricing tiers free growth enterprise"
```

**Use agent-browser after every change** to visually verify pages:
```bash
npx astro build && npx astro preview &
# Navigate to http://localhost:4321, screenshot each changed page
# Check at 375px (mobile), 768px (tablet), 1440px (desktop)
# Verify: no "Foxi" text, no broken layouts, images load
```

**Use GitHub CLI for changelog** (correct repo: `consuelohq/opensaas`):
```bash
gh pr list --repo consuelohq/opensaas --state merged --limit 50 --json title,mergedAt,body
```

## File Cleanup (ALREADY DONE)
- `public/icons/` — DELETED (old .li animation files, incompatible with Foxi)
- `public/fonts/` — DELETED (Geist fonts, Foxi uses Inter + Outfit)
- `src/pages/robots.txt.ts` — DELETED (static `public/robots.txt` takes precedence)
- `public/_headers` — UPDATED (Sentry domains added to CSP)

## Colors — KEEP THE PINK
The Foxi pink (#E2187D) is close enough to Consuelo's brand. Do NOT change the color palette.

## CRITICAL RULES — READ BEFORE TOUCHING ANYTHING

1. **DO NOT create new components.** No new .tsx, .jsx, or .astro files. Zero.
2. **DO NOT modify any component in `src/components/`.** The Foxi layout, structure, and styling are final.
3. **DO NOT touch `src/styles/global.css`, `tailwind.config.mjs`, `astro.config.mjs`, or `postcss.config.mjs`.**
4. **DO NOT change the grid system, layout components, or CSS classes.**
5. You are ONLY allowed to edit the files explicitly listed in each task below.
6. After every task, run `npx astro build` and confirm it succeeds with 0 errors.
7. If a build fails, REVERT your changes and try again. Do not "fix" build errors by modifying components.

## What Consuelo Is (for writing copy)

Consuelo is an open-source sales infrastructure platform for insurance sales teams. It combines:
- **Power Dialer** ($20/seat/mo) — local presence, multi-line, spam shield, call transfer
- **AI CRM** (free forever) — built on Twenty CRM, open source, contacts/companies/pipeline
- **Real-time AI Coaching** — whispers objection handling during live calls, post-call scoring
- **Analytics** — call metrics, rep performance, team dashboards
- **Lead Automation** — queue management, re-engagement sequences, auto-prioritization

Target audience: Insurance sales teams (agencies, IMOs, call centers).
Competitors being replaced: Salesforce ($79/mo), PhoneBurner ($95/mo), Gong ($60/mo).
Key value prop: Replace your entire $250+/seat/mo stack with one $20/seat platform.
Website: consuelohq.com | GitHub: github.com/consuelohq/opensaas
CRM app: app.consuelohq.com | Docs: docs.consuelohq.com

---

## Task W.1: Site Config + SEO Metadata

**Files to edit (ONLY these):**
- `src/config/config.ts`
- `astro.config.mjs` (ONLY the `site` field)

**Changes to `src/config/config.ts`:**
```typescript
export const configData: Config = {
  siteTitle: 'Consuelo — Open-Source Sales Infrastructure',
  siteDescription: 'Power dialer, AI CRM, real-time coaching, and analytics for insurance sales teams. $20/seat. Free CRM forever. Open source.',
  ogImage: '/og.jpg',
  logo: {
    src: '/logo.svg',
    alt: 'Consuelo logo'
  },
  canonical: true,
  noindex: false,
  mode: 'auto',
  scrollAnimations: true
}
```

**Changes to `astro.config.mjs`:**
- Change `site: "https://foxi.netlify.app"` → `site: "https://www.consuelohq.com"`
- Do NOT change anything else in this file.

**Acceptance criteria:**
- `npx astro build` succeeds
- `grep -r "Foxi" src/config/config.ts` returns nothing
- `grep "consuelohq" astro.config.mjs` returns the site URL

---

## Task W.2: Navigation + Footer + Social Links

**Files to edit (ONLY these):**
- `src/config/navigationBar.ts`
- `src/config/footerNavigation.ts`
- `src/config/socialLinks.ts`

**Changes to `src/config/navigationBar.ts`:**
```typescript
export const navigationBarData: NavData = {
  logo: {
    src: '/logo.svg',
    alt: 'Consuelo',
    text: 'Consuelo'
  },
  navItems: [
    { name: 'Home', link: '/' },
    { name: 'Pricing', link: '/pricing' },
    { name: 'Features', link: '/features' },
    {
      name: 'Resources',
      link: '#',
      submenu: [
        { name: 'Blog', link: '/blog' },
        { name: 'Changelog', link: '/changelog' },
        { name: 'FAQ', link: '/faq' },
        { name: 'Docs', link: 'https://docs.consuelohq.com' }
      ]
    },
    { name: 'Contact', link: '/contact' }
  ],
  navActions: [{ name: 'Get Started', link: 'https://app.consuelohq.com', style: 'primary', size: 'lg' }]
}
```

**Changes to `src/config/footerNavigation.ts`:**
```typescript
export const footerNavigationData: FooterData = {
  footerAbout: {
    title: 'Consuelo',
    aboutText: 'Open-source sales infrastructure for insurance teams. Power dialer, AI CRM, real-time coaching, and analytics — all in one platform.',
    logo: {
      src: '/logo.svg',
      alt: 'Consuelo',
      text: 'Consuelo'
    }
  },
  footerColumns: [
    {
      category: 'Product',
      subCategories: [
        { subCategory: 'Features', subCategoryLink: '/features' },
        { subCategory: 'Pricing', subCategoryLink: '/pricing' },
        { subCategory: 'FAQ', subCategoryLink: '/faq' },
        { subCategory: 'Changelog', subCategoryLink: '/changelog' }
      ]
    },
    {
      category: 'Resources',
      subCategories: [
        { subCategory: 'Documentation', subCategoryLink: 'https://docs.consuelohq.com' },
        { subCategory: 'Blog', subCategoryLink: '/blog' },
        { subCategory: 'GitHub', subCategoryLink: 'https://github.com/consuelohq/opensaas' }
      ]
    },
    {
      category: 'Company',
      subCategories: [
        { subCategory: 'Contact', subCategoryLink: '/contact' },
        { subCategory: 'Terms', subCategoryLink: '/terms' }
      ]
    }
  ],
  subFooter: {
    copywriteText: '© Consuelo 2025.'
  }
}
```

**Changes to `src/config/socialLinks.ts`:**
```typescript
export const socialLinks: SocialLink[] = [
  {
    name: 'github',
    link: 'https://github.com/consuelohq/opensaas',
    icon: 'github-icon'
  },
  {
    name: 'twitter',
    link: 'https://twitter.com/consuelohq',
    icon: 'twitter-icon'
  }
]
```

Note: The icon names must match SVG files in `src/icons/`. Check what icons exist there. If `github-icon` doesn't exist but `fb-icon` does, keep the existing icon names and just change the links. Do NOT create new icon files.

**Acceptance criteria:**
- `npx astro build` succeeds
- `grep -r "Foxi" src/config/` returns nothing
- All nav links point to valid pages or external URLs

---

## Task W.3: Homepage Content

**Files to edit (ONLY these):**
- `src/pages/index.astro` (ONLY the SEO object and any inline text — do NOT change imports or component usage)
- `src/components/blocks/hero/HomeCTA.astro` (ONLY the text content inside the HTML — do NOT change imports, layout, or component structure)
- `src/components/blocks/CTA/BasicDark.astro` (ONLY the text content — do NOT change imports, layout, or component structure)

**Changes to `src/pages/index.astro`:**
```typescript
const SEO = {
  title: 'Consuelo — $20 Power Dialer. Free CRM. AI Coaching.',
  description: 'Open-source sales infrastructure for insurance teams. Power dialer with local presence, free CRM, real-time AI coaching, and analytics. Replace your $250/seat stack for $20.'
}
```

**Changes to `src/components/blocks/hero/HomeCTA.astro`:**
Change ONLY the text content (keep all component structure, imports, layout identical):
- ChipNotification text: `<strong>Open Source</strong> sales infrastructure` (remove avatar group if desired, or keep it)
- h1: `The <strong>$20 power dialer</strong> with a free CRM and AI coaching`
- p: `Insurance sales teams replace their $250/seat stack with Consuelo. Power dialer, CRM, real-time AI coaching, and analytics — one platform, open source.`
- Button text: `Get started free`
- Image alt: `Consuelo — sales infrastructure platform`

**Changes to `src/components/blocks/CTA/BasicDark.astro`:**
Change ONLY the text props passed to the CTA component:
- title: `"Start closing more with less tools."`
- text: `"Join insurance teams using Consuelo to replace their entire sales stack. Free CRM forever, $20/seat power dialer, real-time AI coaching."`
- ChipNotification: `<span class="hidden md:block">Open Source,</span> <Highlight classes="md:ml-2">Free CRM Forever</Highlight>`
- Button text: `Get started free`

**Acceptance criteria:**
- `npx astro build` succeeds
- Homepage renders with Consuelo copy
- `grep -r "Foxi" src/pages/index.astro src/components/blocks/hero/HomeCTA.astro src/components/blocks/CTA/BasicDark.astro` returns nothing

---

## Task W.4: Features Data + Features Page

**Files to edit (ONLY these):**
- `src/data/json-files/featuresData.json`
- `src/pages/features.astro` (ONLY the SEO object, header object, and section title/text strings — do NOT change imports or component usage)
- `src/components/blocks/features/FeatureList.astro` (ONLY the h2 and p text — do NOT change imports or layout)

**Changes to `src/data/json-files/featuresData.json`:**
Replace ALL entries. Use these categories (must match the filter logic in features.astro): `Analytics`, `Productivity`, `Security`, `Integrations`, `Support`.

Write 6-8 features per category (30-40 total). Each feature needs: title, icon (use icons from the existing set — see the current file for valid icon names), description, category.

Feature ideas per category:
- **Analytics**: Call metrics dashboard, rep performance scoring, team leaderboards, conversion tracking, call recording analytics, pipeline velocity, campaign ROI tracking
- **Productivity**: Power dialer, multi-line dialing, call queue management, auto-dialer scheduling, voicemail drop, click-to-call, speed-to-lead
- **Security**: End-to-end encryption, SOC 2 compliance, role-based access, DNC list management, call recording consent, data export/portability, TCPA compliance
- **Integrations**: GoHighLevel, Salesforce import, HubSpot import, Zapier, webhook API, CSV import/export, REST API
- **Support**: Onboarding assistance, knowledge base, live chat, dedicated CSM, training webinars, community forum, 24/7 email support

Every description must be about Consuelo's actual features for insurance sales teams. No generic SaaS copy.

**Changes to `src/pages/features.astro`:**
```typescript
const SEO = {
  title: 'Consuelo | Features for Insurance Sales Teams',
  description: 'Power dialer with local presence, free CRM, real-time AI coaching, analytics, and integrations. Built for insurance sales teams.'
}
const header = {
  title: 'Everything your sales team needs in <strong>one platform</strong>.',
  text: 'Power dialer, CRM, AI coaching, analytics, and integrations — built for insurance sales.'
}
```

Also update the section titles/text passed to each `<Feature>` component:
- Analytics: `"Call Analytics & Reporting"` / `"Track every metric that matters — call volume, connect rates, conversion, and rep performance."`
- Security: `"Compliance & Security"` / `"TCPA compliant, DNC management, call recording consent, and role-based access control."`
- Productivity: `"Dialer & Productivity"` / `"Power dialer with local presence, multi-line, voicemail drop, and queue management."`
- Integrations: `"Integrations"` / `"Connect with GoHighLevel, Salesforce, HubSpot, Zapier, and more."`
- Support: `"Support & Onboarding"` / `"Dedicated onboarding, training, knowledge base, and responsive support."`

**Changes to `src/components/blocks/features/FeatureList.astro`:**
- h2: `Whats included on <strong>all</strong> Consuelo plans`
- p: Keep the same structure, change text to: `"Every plan includes the full platform — power dialer, CRM, AI coaching, analytics, and integrations. No feature gating, no surprises."`

**Acceptance criteria:**
- `npx astro build` succeeds
- `grep -r "Foxi" src/pages/features.astro src/data/json-files/featuresData.json src/components/blocks/features/FeatureList.astro` returns nothing
- Features page renders with insurance sales content

---

## Task W.5: Pricing Data + Pricing Page

**Files to edit (ONLY these):**
- `src/data/json-files/pricingTablesdata.json`
- `src/pages/pricing.astro` (ONLY the SEO, header, and testimonialData objects)

**Changes to `src/data/json-files/pricingTablesdata.json`:**
```json
[
  {
    "header": {
      "title": "Starter",
      "subtitle": "For solo reps getting started.",
      "currency": "$",
      "price": "0",
      "priceLabel": "free forever",
      "priceMontly": "0",
      "priceLabelMontly": "free forever",
      "buttonName": "Start free",
      "buttonLink": "https://app.consuelohq.com"
    },
    "body": {
      "listItems": [
        { "listItem": "1 seat" },
        { "listItem": "Power dialer" },
        { "listItem": "Full CRM (contacts, companies, pipeline)" },
        { "listItem": "50 AI coaching minutes/month" },
        { "listItem": "Basic analytics" }
      ]
    },
    "footer": {
      "buttonName": "See all features",
      "buttonLink": "/features"
    },
    "type": "basic"
  },
  {
    "header": {
      "title": "Growth",
      "subtitle": "For teams that need to move fast.",
      "currency": "$",
      "price": "20",
      "priceLabel": "seat/month",
      "priceMontly": "20",
      "priceLabelMontly": "seat/month",
      "buttonName": "Start free trial",
      "buttonLink": "https://app.consuelohq.com"
    },
    "body": {
      "listItems": [
        { "listItem": "Unlimited seats" },
        { "listItem": "Local presence dialing" },
        { "listItem": "Multi-line dialing" },
        { "listItem": "Unlimited AI coaching" },
        { "listItem": "Call transfer (warm + cold)" },
        { "listItem": "Full analytics & reporting" },
        { "listItem": "Priority support" }
      ]
    },
    "footer": {
      "buttonName": "See all features",
      "buttonLink": "/features"
    },
    "type": "featured"
  },
  {
    "header": {
      "title": "Enterprise",
      "subtitle": "For orgs with compliance needs.",
      "currency": "",
      "price": "Custom",
      "priceLabel": "",
      "priceMontly": "Custom",
      "priceLabelMontly": "",
      "buttonName": "Talk to sales",
      "buttonLink": "/contact"
    },
    "body": {
      "listItems": [
        { "listItem": "Everything in Growth" },
        { "listItem": "SSO / SAML" },
        { "listItem": "Custom integrations" },
        { "listItem": "Dedicated CSM" },
        { "listItem": "SLA" },
        { "listItem": "On-prem option" }
      ]
    },
    "footer": {
      "buttonName": "See all features",
      "buttonLink": "/features"
    },
    "type": "basic"
  }
]
```

**Changes to `src/pages/pricing.astro`:**
```typescript
const SEO = {
  title: 'Consuelo | Pricing — $20/seat Power Dialer + Free CRM',
  description: 'Replace your $250/seat sales stack with Consuelo. Free CRM forever, $20/seat power dialer with AI coaching. No contracts.'
}
const header = {
  title: 'Replace your entire stack for <strong>$20/seat</strong>.',
  text: 'Free CRM forever. No contracts. 14-day free trial on Growth.'
}
const testimonialData = {
  blockquote: 'We switched from five tools to one. Reps actually use the CRM now because it\'s where the dialer lives. Our answer rate went from 8% to over 30% with local presence.',
  figcaption: 'Marcus T.',
  cite: 'Sales Director, Shield Insurance'
}
```

**Acceptance criteria:**
- `npx astro build` succeeds
- `grep -r "Foxi" src/pages/pricing.astro src/data/json-files/pricingTablesdata.json` returns nothing

---

## Task W.6: Highlight Rows (Homepage Product Sections)

**Files to edit (ONLY these):**
- `src/components/blocks/highlights/HightlightRows.astro` (ONLY the `highlightBlocks` array text content — do NOT change imports, types, layout, or image references)

**Changes:** Update ONLY the `title` and `text` fields in the `highlightBlocks` array. Keep all image imports, imagePosition, imageWidth, imageHeight, and mobileImage references exactly as they are.

```typescript
const highlightBlocks: HighlightBlock[] = [
  {
    title: '<strong>Power Dialer</strong> with Local Presence',
    text: 'Call from local numbers that match your prospect\'s area code. Answer rates jump from 8% to 30%+ with local presence. Multi-line dialing, voicemail drop, and spam shield keep your numbers clean and your team moving fast.',
    // ... keep all image fields identical
  },
  {
    title: 'AI <strong>Coaching</strong> in Real Time',
    text: 'Your reps get live whisper coaching during calls — objection handling, script prompts, and closing techniques delivered in real time. Post-call scoring surfaces patterns across your team so you can coach what matters.',
    // ... keep all image fields identical
  },
  {
    title: '<strong>CRM</strong> That Reps Actually Use',
    text: 'Built on Twenty CRM (open source). Contacts, companies, pipeline, and deal tracking — all connected to the dialer. Reps update the CRM because it\'s where they make calls, not a separate tool they ignore.',
    // ... keep all image fields identical
  },
  {
    title: 'Analytics & <strong>Automation</strong>',
    text: 'Track call volume, connect rates, talk time, and conversion by rep, team, or campaign. Automated lead queues prioritize hot prospects, re-engage cold leads, and keep your pipeline moving even when your team clocks out.',
    // ... keep all image fields identical
  }
]
```

**Acceptance criteria:**
- `npx astro build` succeeds
- `grep -r "Foxi" src/components/blocks/highlights/HightlightRows.astro` returns nothing
- All 4 image imports still work (build doesn't fail on missing images)

---

## Task W.7: FAQ Data + FAQ Page

**Files to edit (ONLY these):**
- `src/data/json-files/faqData.json`
- `src/pages/faq.astro` (ONLY the SEO, header, and section title/text strings)

**Changes to `src/data/json-files/faqData.json`:**
Replace ALL entries. Keep the same JSON structure. Use categories: `pricing`, `integrations`, `features`.

Write 5-6 questions per category about Consuelo for insurance sales teams. Examples:

Pricing:
- "How much does Consuelo cost?" → $20/seat/mo for Growth, free Starter plan, CRM is free forever
- "Is there a free trial?" → 14-day free trial, no credit card required
- "What's included in the free plan?" → 1 seat, power dialer, full CRM, 50 AI coaching minutes
- "Are there contracts?" → No contracts, cancel anytime
- "Do you charge per minute for calls?" → Calling minutes billed separately through Twilio at cost
- "How does Consuelo compare to PhoneBurner/Kixie?" → $20 vs $95-149/seat, plus free CRM and AI coaching included

Integrations:
- "Does Consuelo work with GoHighLevel?" → Yes, embedded widget + contact sync
- "Can I import from Salesforce/HubSpot?" → Yes, CSV import and API
- "Is there a Zapier integration?" → Yes
- "Does Consuelo have an API?" → Yes, REST API + webhooks
- "Can I import my existing contacts?" → Yes, CSV import with field mapping

Features:
- "What is local presence dialing?" → Calls show a local number matching prospect's area code
- "How does AI coaching work?" → Real-time whisper during calls + post-call scoring
- "Is the CRM really free?" → Yes, built on open-source Twenty CRM, free forever
- "Can I record calls?" → Yes, with consent management built in
- "What about DNC/TCPA compliance?" → Built-in DNC list management and TCPA compliance tools

**Changes to `src/pages/faq.astro`:**
```typescript
const SEO = {
  title: 'Consuelo | FAQ — Pricing, Features, Integrations',
  description: 'Get answers about Consuelo pricing, features, integrations, and how it works for insurance sales teams.'
}
const header = {
  title: 'Frequently Asked <strong>Questions</strong>',
  text: 'Everything you need to know about Consuelo.'
}
```

Also update the section titles/text passed to each `<FAQ>` component and the `<TextImage>` component — replace all "Foxi" references with "Consuelo" and make the copy relevant to insurance sales.

**Acceptance criteria:**
- `npx astro build` succeeds
- `grep -r "Foxi" src/pages/faq.astro src/data/json-files/faqData.json` returns nothing

---

## Task W.8: Terms, Contact, Testimonials, Toast, Modal, Blog

**Files to edit (ONLY these):**
- `src/data/markdown-files/terms.md`
- `src/pages/terms.astro` (ONLY the SEO object)
- `src/pages/contact.astro` (ONLY the SEO and header objects)
- `src/components/blocks/testimonials/BasicDark.astro` (ONLY the default prop values for blockquote, figcaption, cite)
- `src/components/blocks/contact/ContactCards.astro` (ONLY the text content in Card props)
- `src/components/ui/Toast.astro` (ONLY the text content — change "Foxi Pro" to "Consuelo" and update the link)
- `src/components/blocks/modal/SignUp.astro` (ONLY the text "get started with Foxi" → "get started with Consuelo")
- `src/components/blocks/socialproof/Basic.astro` (ONLY the h2 text — change "50,000+" to relevant number and "businesses" to "insurance teams")

**Changes to `src/data/markdown-files/terms.md`:**
Replace all "Foxi" with "Consuelo". Update the intro to reference Consuelo's services (power dialer, CRM, AI coaching). Keep the same legal structure.

**Changes to default testimonial in `BasicDark.astro`:**
```typescript
const {
  blockquote = 'Consuelo replaced five tools for our team. The power dialer with local presence tripled our contact rate, and reps actually use the CRM because it\'s built into the dialer.',
  figcaption = 'Sarah K.',
  cite = 'Agency Owner, Keystone Insurance',
  bg,
  bgPosition = 'center'
} = Astro.props
```

**Changes to Toast.astro:**
- Change "Foxi Pro" → "Consuelo"
- Change the link to `https://github.com/consuelohq/opensaas`
- Change body text to: `Star us on <a href="https://github.com/consuelohq/opensaas" target="_blank">GitHub</a> — open-source sales infrastructure for insurance teams.`
- Change localStorage key from `foxiToastDismissed` to `consueloToastDismissed`

**Acceptance criteria:**
- `npx astro build` succeeds
- `grep -r "Foxi\|foxi" src/data/markdown-files/terms.md src/pages/terms.astro src/pages/contact.astro src/components/blocks/testimonials/BasicDark.astro src/components/blocks/contact/ContactCards.astro src/components/ui/Toast.astro src/components/blocks/modal/SignUp.astro src/components/blocks/socialproof/Basic.astro` returns nothing

---

## Task W.9: Responsive Breakpoints Audit & Fix

**IMPORTANT: This task requires RESEARCH first.**

Before making any changes, the agent must:
1. Read `tailwind.config.mjs` to understand the breakpoint system
2. Read `src/styles/global.css` to understand the base styles
3. Read `src/components/ui/Row.astro`, `src/components/ui/Col.astro`, `src/components/ui/Section.astro` to understand the grid system
4. Read `src/components/ui/NavigationBar.astro` to understand the mobile nav
5. Read `src/components/blocks/hero/HomeCTA.astro` to understand the hero layout
6. Read `src/components/blocks/features/FeatureCards.astro` and `src/components/blocks/features/FeatureSticky.astro`
7. Read `src/components/blocks/pricing/PricingColumns.astro`
8. Test the build output by reading the generated HTML in `dist/` after building

**What to check and fix:**
- Navigation: hamburger menu works on mobile, full nav on desktop
- Hero section: text scales properly, image doesn't overflow
- Feature cards: stack to 1 column on mobile, 2 on tablet, 3-4 on desktop
- Pricing tables: stack to 1 column on mobile, 3 on desktop
- Highlight rows (TextImage): image and text stack vertically on mobile, side-by-side on desktop
- FAQ accordions: full width on all screens
- Footer: columns stack on mobile
- All text: readable on 320px width (no horizontal overflow)
- All images: don't overflow their containers on any screen size

**Files you MAY edit (ONLY if needed for responsive fixes):**
- `src/components/ui/Row.astro`
- `src/components/ui/Col.astro`
- `src/components/ui/Section.astro`
- `src/components/ui/NavigationBar.astro`
- `src/components/ui/Footer.astro`
- `src/components/blocks/hero/HomeCTA.astro`
- `src/components/blocks/features/FeatureCards.astro`
- `src/components/blocks/pricing/PricingColumns.astro`
- `src/components/blocks/highlights/HightlightRows.astro`
- `src/components/blocks/basic/TextImage.astro`
- `src/styles/global.css` (ONLY for adding responsive utility classes — do NOT change existing styles)

**What you MUST NOT do:**
- Do not change the color scheme or visual design
- Do not add new dependencies
- Do not restructure the component hierarchy
- Do not change any text content (that's handled by other tasks)

**Acceptance criteria:**
- `npx astro build` succeeds
- No horizontal scrollbar on any page at 320px, 768px, 1024px, 1440px widths
- Navigation collapses to hamburger on mobile
- All content is readable and properly laid out at all breakpoints
