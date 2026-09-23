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

    expect(content).toContain("Stop Paying Sales Reps to Listen to Phones Ring.");
    expect(content).toContain("GET EARLY ACCESS");
    expect(content).toContain("STAY\\nIN YOUR CRM");
    expect(content).toContain("STOP LISTENING\\nTO RINGING");
    expect(content).toContain("INBOUND +\\nCALLBACKS");
    expect(content).toContain("KNOW WHAT\\nHAPPENED");
    expect(content).toContain("WORK THE\\nNEXT STEP");
    expect(content).toContain("ONE AGENCY.\\nMORE SALES FLOORS.");
    expect(navigation).toContain("label: 'Consuelo'");
    expect(navigation).toContain("label: 'Docs'");
    expect(navigation).toContain("label: 'Pricing'");
    expect(navigation).toContain("label: 'Features'");
    expect(navigation).not.toMatch(/label: ['"]Demo['"]/i);
    expect(renderedStyles).not.toMatch(/text-transform:\s*lowercase/);
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

  test("ships real PNG dither clouds instead of corrupt placeholder bytes", () => {
    for (const name of ["cloud-1.png", "cloud-2.png", "cloud-3.png", "cloud-4.png"]) {
      const bytes = readFileSync(join(packageRoot, "public/images/home/dither", name));
      expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
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
