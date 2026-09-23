import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const packageRoot = join(repoRoot, "packages/consuelo-dialer-website");

const read = (path) => readFileSync(join(packageRoot, path), "utf8");

describe("Consuelo Dialer landing page", () => {
  test("is an independent Astro/Bun package", () => {
    expect(existsSync(packageRoot)).toBe(true);
    expect(existsSync(join(packageRoot, "src/pages/index.astro"))).toBe(true);

    const pkg = JSON.parse(read("package.json"));
    expect(pkg.name).toBe("consuelo-dialer-website");
    expect(pkg.scripts.build).toContain("astro");
  });

  test("uses the canonical OS casing hierarchy for Dialer marketing copy", () => {
    const content = read("src/data/home-content.ts");
    const navigation = read("src/data/site-navigation.ts");
    const hero = read("src/components/home/HomeHero.astro");
    const feature = read("src/components/home/HomeFeaturePreview.astro");
    const faq = read("src/components/home/HomeFaq.astro");
    const placeholder = read("src/components/home/DialerFeaturePlaceholder.astro");
    const pricing = read("src/pages/pricing.astro");
    const primitives = read("src/styles/primitives.css");
    const renderedStyles = [hero, feature, faq, placeholder, pricing, primitives].join("\n");

    expect(content).toContain("STOP PAYING SALES REPS TO LISTEN TO PHONES RING.");
    expect(content).toContain("GET EARLY ACCESS");
    expect(content).toContain("STAY\\nIN YOUR CRM");
    expect(content).toContain("STOP LISTENING\\nTO RINGING");
    expect(content).toContain("INBOUND +\\nCALLBACKS");
    expect(content).toContain("KNOW WHAT\\nHAPPENED");
    expect(content).toContain("WORK THE\\nNEXT STEP");
    expect(content).toContain("ONE AGENCY.\\nMORE SALES FLOORS.");
    expect(navigation).toContain("label: 'CONSUELO'");
    expect(navigation).toContain("label: 'DOCS'");
    expect(navigation).toContain("label: 'PRICING'");
    expect(navigation).toContain("label: 'FEATURES'");
    expect(navigation).not.toMatch(/label: ['"]Demo['"]/i);
    expect(renderedStyles).not.toMatch(/text-transform:\s*lowercase/);
  });

  test("keeps source-authored casing and typography when client-side styles try to override the page", () => {
    const layout = read("src/layouts/MarketingLayout.astro");
    const hero = read("src/components/home/HomeHero.astro");
    const header = read("src/components/site/SiteHeader.astro");

    expect(layout).toContain('id="dialer-site-root"');
    expect(layout).toContain("#dialer-site-root :where(");
    expect(layout).toContain("text-transform: none !important;");
    expect(hero).toContain("font-family: var(--site-font-display) !important;");
    expect(header).toContain("font-family: var(--site-font-mono) !important;");
    expect(header).toContain("font-family: var(--site-font-display) !important;");
  });

  test("keeps product proof inside the main feature story instead of standalone homepage sections", () => {
    const index = read("src/pages/index.astro");
    const content = read("src/data/home-content.ts");
    const feature = read("src/components/home/HomeFeaturePreview.astro");

    expect(index).toContain("HomeFeaturePreview");
    expect(index).not.toContain("HomeFounderSection");
    expect(existsSync(join(packageRoot, "src/components/home/HomeFounderSection.astro"))).toBe(false);
    expect(index).not.toContain("HomeDialerStats");
    expect(index).not.toContain("HomeAgencySection");

    expect(content).toContain("3×");
    expect(content).toContain("500ms");
    expect(content).toContain("CSV");
    expect(content).toContain("server");
    expect(content).toContain("HighLevel");
    expect(feature).toContain("data-feature-story");
    expect(feature).toContain("<HomeFaq />");
    expect(feature.indexOf("product-story")).toBeLessThan(feature.indexOf("<HomeFaq />"));

    expect(content).not.toContain("340%");
    expect(content).not.toContain("47%");
    expect(content).not.toContain("12,000");
    expect(content).not.toContain("shield insurance");
    expect(content).not.toContain("apex financial");
    expect(content).not.toContain("summit benefits");
  });

  test("does not render the redundant founding-agency announcement above the hero", () => {
    const content = read("src/data/home-content.ts");
    const hero = read("src/components/home/HomeHero.astro");

    expect(content).not.toContain("Founding agency program · Early access");
    expect(hero).not.toContain("dialer-hero__announcement");
  });

  test("ports the canonical Consuelo OS homepage shell instead of adding Dialer-only chrome", () => {
    const index = read("src/pages/index.astro");
    const hero = read("src/components/home/HomeHero.astro");
    const feature = read("src/components/home/HomeFeaturePreview.astro");
    const final = read("src/components/home/HomeCloudCta.astro");
    const previewPath = join(packageRoot, "src/components/home/PreviewNotice.astro");

    expect(index).toContain("home-scroll-layer");
    expect(hero).toContain("dialer-hero__actions");
    expect(hero).not.toContain("dialer-hero__proof");
    expect(hero).not.toContain("secondaryLabel");
    expect(hero).not.toContain("button--secondary");

    expect(existsSync(previewPath)).toBe(true);
    const preview = read("src/components/home/PreviewNotice.astro");
    expect(preview).toContain("Consuelo Dialer is currently in preview.");
    expect(preview).toContain("Discord");
    expect(preview).toContain("support@consuelohq.com");

    expect(feature).toContain("<PreviewNotice />");
    expect(feature).toContain("CONSUELO DIALER");
    expect(feature).toContain("MEMBER? SIGN IN");
    expect(feature).toContain("<h2>FEATURES</h2>");
    expect(feature).not.toContain("Early Product Preview");
    expect(feature).not.toContain("The Sales Phone System Embedded in Your CRM.");
    expect(feature).not.toContain("Get Early Access →");
    expect(feature).not.toContain("What the Dialer Does");
    expect(feature).not.toContain("The Phone Layer.");

    expect(final).toContain("CONSUELO DIALER");
    expect(final).toContain("V0.0.1");
    expect(final).toContain("MIT LICENSE");
    expect(final).toContain("VIEW ALL OUR PLANS");
    expect(final).not.toContain("holding-world");
  });

  test("uses the requested header structure and Consuelo mark", () => {
    const header = read("src/components/site/SiteHeader.astro");
    const navigation = read("src/data/site-navigation.ts");

    expect(navigation).toContain("{ label: 'CONSUELO'");
    expect(navigation).toContain("{ label: 'DOCS'");
    expect(navigation).toContain("{ label: 'PRICING'");
    expect(navigation).toContain("{ label: 'FEATURES'");
    expect(header).toContain("/favicon.svg");
    expect(header).toContain("<span>CONSUELO</span>");
    expect(header).toContain("<span>DIALER</span>");
    expect(header).not.toContain("DOCS ↗");
  });

  test("uses placeholders on pricing instead of stale product screenshots", () => {
    const pricingContent = read("src/data/pricing-content.ts");
    const pricing = read("src/pages/pricing.astro");

    expect(pricingContent).not.toContain("/previews/power-dialer.webp");
    expect(pricingContent).not.toContain("/previews/analytics.webp");
    expect(pricingContent).not.toContain("/previews/coaching.webp");
    expect(pricingContent).not.toContain("imageSrc");
    expect(pricing).toContain("pricing-plan__placeholder");
    expect(pricing).toContain("Product Preview");
  });

  test("renders optimized generated clouds in the hero and preview band", () => {
    const hero = read("src/components/home/HomeHero.astro");
    const feature = read("src/components/home/HomeFeaturePreview.astro");
    const cloudFieldPath = join(packageRoot, "src/components/visuals/CloudField.astro");

    expect(existsSync(cloudFieldPath)).toBe(true);
    expect(hero).toContain("CloudField");
    expect(hero).not.toContain("/images/home/dither/cloud-");
    expect(feature).toContain('CloudField variant="preview"');
    expect(feature).not.toContain("/images/home/dither/cloud-");

    const cloudField = read("src/components/visuals/CloudField.astro");
    for (const name of [
      "dialer-cloud-01.webp",
      "dialer-cloud-02.webp",
      "dialer-cloud-03.webp",
      "dialer-cloud-04.webp",
    ]) {
      expect(cloudField).toContain(`/images/clouds/${name}`);
      const assetPath = join(packageRoot, "public/images/clouds", name);
      const bytes = readFileSync(assetPath);
      expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
      expect(statSync(assetPath).size).toBeLessThan(500_000);
    }

    expect(cloudField).toContain("cloud-field__body");
    expect(cloudField).not.toContain("cloud-field__haze");
    expect(cloudField).toContain("cloud-field__glow");
    expect(cloudField).toContain("variant");
    expect(cloudField).toContain("loading=");
    expect(cloudField).not.toContain("loading: 'lazy'");
    expect(cloudField).not.toContain("mask-image:");
    expect(cloudField).not.toContain("-webkit-mask-image:");
    expect(cloudField).toContain("@media (prefers-reduced-motion: reduce)");
    expect(cloudField).toContain("@media (max-width: 720px)");
    expect(cloudField).toMatch(/cloud-field__cloud--(?:far-left|far-right)[\s\S]*display:\s*none/);
  });

  test("ships alpha-cleaned clouds without faint rectangular canvas edges", () => {
    const reportPath = join(packageRoot, "tests/fixtures/cloud-alpha-report.json");
    expect(existsSync(reportPath)).toBe(true);

    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    expect(report.alphaCutoff).toBeGreaterThanOrEqual(8);

    for (const item of report.assets) {
      const assetPath = join(packageRoot, "public/images/clouds", item.name);
      const bytes = readFileSync(assetPath);
      const sha256 = createHash("sha256").update(bytes).digest("hex");

      expect(sha256).toBe(item.sha256);
      expect(item.cornerMaxAlpha).toBe(0);
      expect(item.borderMaxAlpha).toBe(0);
    }
  });

  test("keeps preview clouds separated at opposite edges", () => {
    const cloudField = read("src/components/visuals/CloudField.astro");

    expect(cloudField).toContain("--preview-right-width: min(67vw, 54rem)");
    expect(cloudField).toContain("--preview-left-width: min(55vw, 46rem)");
    expect(cloudField).toContain("--preview-right-offset: 0%");
    expect(cloudField).toContain("--preview-left-offset: -3%");
    expect(cloudField).toContain("right: var(--preview-right-offset)");
    expect(cloudField).toContain("left: var(--preview-left-offset)");
    expect(cloudField).toContain("cloud-field--preview::before");
    expect(cloudField).toMatch(/cloud-field--preview \.cloud-field__cloud--hero-right[\s\S]*--cloud-opacity:\s*0\.8/);
    expect(cloudField).toMatch(/cloud-field--preview \.cloud-field__cloud--hero-right[\s\S]*z-index:\s*5/);
    const bodyRule = cloudField.match(/\.cloud-field__body\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    expect(bodyRule).not.toContain("filter:");
  });

  test("does not ship the retired dither-only cloud assets", () => {
    for (const name of ["cloud-1.png", "cloud-2.png", "cloud-3.png", "cloud-4.png"]) {
      expect(existsSync(join(packageRoot, "public/images/home/dither", name))).toBe(false);
    }
  });

  test("preserves the inherited feature scroll layout while preventing long headings from overflowing", () => {
    const panel = read("src/components/home/HomeFeaturePreview.astro");

    expect(panel).toContain("position: sticky");
    expect(panel).toContain("data-feature-story");
    expect(panel).toContain("overflow-wrap: anywhere");
    expect(panel).toContain("minmax(0");
    expect(panel).toContain("@media (max-width: 760px)");
  });
});
