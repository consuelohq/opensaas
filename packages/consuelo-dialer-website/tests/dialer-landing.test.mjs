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

  test("uses the approved direct-response positioning without locking the product to one CRM", () => {
    const content = read("src/data/home-content.ts");
    const hero = read("src/components/home/HomeHero.astro");
    const header = read("src/components/site/SiteHeader.astro");

    expect(content).toContain("STOP PAYING SALES REPS TO LISTEN TO PHONES RING.");
    expect(content).toContain("embedded in the CRM");
    expect(content).toContain("GET EARLY ACCESS");
    expect(content).toContain("WATCH THE DEMO");
    expect(header).toContain("CONSUELO");
    expect(header).toContain("DIALER");
    expect(hero).not.toContain("installCommandForPlatform");
    expect(hero).not.toContain("ChatGPT");
    expect(hero).not.toContain("Claude");
  });

  test("uses only defensible technical proof instead of invented customer outcomes", () => {
    const content = read("src/data/home-content.ts");
    const stats = read("src/components/home/HomeDialerStats.astro");
    const allMarketing = content + "\n" + stats;

    expect(allMarketing).toContain("3×");
    expect(allMarketing).toContain("500ms");
    expect(allMarketing).toContain("0");
    expect(allMarketing).toContain("100%");
    expect(allMarketing).toContain("maximum current predictive fanout");
    expect(allMarketing).toContain("balanced launch stagger");
    expect(allMarketing).toContain("CSV");
    expect(allMarketing).toContain("candidate selection and call lifecycle decisions");

    expect(allMarketing).not.toContain("340%");
    expect(allMarketing).not.toContain("47%");
    expect(allMarketing).not.toContain("12,000");
    expect(allMarketing).not.toContain("shield insurance");
    expect(allMarketing).not.toContain("apex financial");
    expect(allMarketing).not.toContain("summit benefits");
  });

  test("preserves the inherited feature scroll layout while preventing long headings from overflowing", () => {
    const panel = read("src/components/home/HomeFeaturePreview.astro");

    expect(panel).toContain("position: sticky");
    expect(panel).toContain("data-feature-story");
    expect(panel).toContain("overflow-wrap: anywhere");
    expect(panel).toContain("minmax(0");
    expect(panel).toContain("@media (max-width: 760px)");
  });

  test("contains demo, agency, founder, FAQ, and repeated conversion surfaces without public deployment config changes", () => {
    const index = read("src/pages/index.astro");
    const content = read("src/data/home-content.ts");

    expect(index).toContain("HomeDialerStats");
    expect(index).toContain("HomeAgencySection");
    expect(index).toContain("HomeFounderSection");
    expect(index).toContain("HomeFeaturePreview");
    expect(content.match(/GET EARLY ACCESS/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(content).toContain("FOUNDING AGENCY");
    expect(content).toContain("Does Consuelo replace my CRM?");
    expect(content).toContain("Which CRMs does Consuelo support?");
  });
});
