import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
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

  test("uses conventional title/sentence casing for visible marketing copy", () => {
    const content = read("src/data/home-content.ts");
    const navigation = read("src/data/site-navigation.ts");
    const hero = read("src/components/home/HomeHero.astro");
    const feature = read("src/components/home/HomeFeaturePreview.astro");
    const faq = read("src/components/home/HomeFaq.astro");
    const placeholder = read("src/components/home/DialerFeaturePlaceholder.astro");
    const pricing = read("src/pages/pricing.astro");
    const primitives = read("src/styles/primitives.css");
    const renderedStyles = [hero, feature, faq, placeholder, pricing, primitives].join("\n");

    expect(content).toContain("Stop Paying Sales Reps to Listen to Phones Ring.");
    expect(content).toContain("Get Early Access");
    expect(content).toContain("See How It Works");
    expect(content).toContain("in Your CRM");
    expect(content).toContain("Stop Listening");
    expect(content).toContain("to Ringing");
    expect(content).toContain("Inbound +");
    expect(content).toContain("Callbacks");
    expect(content).toContain("Know What");
    expect(content).toContain("Happened");
    expect(content).toContain("Work the");
    expect(content).toContain("Next Step");
    expect(content).toContain("One Agency.");
    expect(content).toContain("More Sales Floors.");
    expect(navigation).toContain("label: 'Consuelo'");
    expect(navigation).toContain("label: 'Docs'");
    expect(navigation).toContain("label: 'Pricing'");
    expect(navigation).toContain("label: 'Features'");
    expect(navigation).not.toMatch(/label: ['"]Demo['"]/i);
    expect(renderedStyles).not.toMatch(/text-transform:\s*(?:uppercase|lowercase)/);
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
    expect(feature.indexOf("dialer-product__stories")).toBeLessThan(feature.indexOf("<HomeFaq />"));

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

  test("uses the requested header structure and Consuelo mark", () => {
    const header = read("src/components/site/SiteHeader.astro");
    const navigation = read("src/data/site-navigation.ts");

    expect(navigation).toContain("{ label: 'Consuelo'");
    expect(navigation).toContain("{ label: 'Docs'");
    expect(navigation).toContain("{ label: 'Pricing'");
    expect(navigation).toContain("{ label: 'Features'");
    expect(header).toContain("/favicon.svg");
    expect(header).toContain("<span>Consuelo</span>");
    expect(header).toContain("<span>Dialer</span>");
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

  test("preserves the inherited feature scroll layout while preventing long headings from overflowing", () => {
    const panel = read("src/components/home/HomeFeaturePreview.astro");

    expect(panel).toContain("position: sticky");
    expect(panel).toContain("data-feature-story");
    expect(panel).toContain("overflow-wrap: anywhere");
    expect(panel).toContain("minmax(0");
    expect(panel).toContain("@media (max-width: 760px)");
  });
});
