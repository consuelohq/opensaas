import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(testDirectory, "..");

const readSiteFile = (path) => readFile(join(siteRoot, path), "utf8");

const listMarkdownFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return listMarkdownFiles(path);
      }

      return /\.mdx?$/.test(entry.name) ? [path] : [];
    }),
  );

  return files.flat();
};

describe("blog refresh contract", () => {
  test("keeps exactly the approved article and leaves featured empty", async () => {
    const blogDirectory = join(siteRoot, "src/content/blog");
    const markdownFiles = (await listMarkdownFiles(blogDirectory))
      .map((path) => relative(blogDirectory, path))
      .sort();

    expect(markdownFiles).toEqual([
      "software-is-becoming-decision-infrastructure.md",
    ]);

    const article = await readSiteFile(
      "src/content/blog/software-is-becoming-decision-infrastructure.md",
    );
    expect(article).toContain("featured: false");
    expect(article).not.toContain("featured: true");
  });

  test("removes the RSS and social promo block while preserving featured support", async () => {
    const [homepage, footer, constants] = await Promise.all([
      readSiteFile("src/pages/blog/index.astro"),
      readSiteFile("src/components/Footer.astro"),
      readSiteFile("src/constants.ts"),
    ]);

    expect(homepage).toContain('<Layout title="The Consuelo Blog"');
    expect(homepage).toContain("The Consuelo Blog");
    expect(homepage).toContain("featuredPosts.length > 0");

    for (const removedText of [
      "Blog RSS Feed",
      "RSS Feed",
      "Tips, updates, stories",
      "Social Links:",
      "IconRss",
      "Socials",
      "SOCIALS",
    ]) {
      expect(homepage).not.toContain(removedText);
    }

    expect(footer).not.toContain("Socials");
    expect(constants).not.toContain("SOCIALS");
    expect(existsSync(join(siteRoot, "src/components/Socials.astro"))).toBe(false);
  });

  test("uses the requested blog name and OS destination", async () => {
    const [metadata, header] = await Promise.all([
      readSiteFile("src/lib/site-seo.ts"),
      readSiteFile("src/components/Header.astro"),
    ]);

    expect(metadata).toContain("blogTitle: 'The Consuelo Blog'");
    expect(header).toContain('href="https://os.consuelohq.com"');
    expect(header).not.toContain('href="https://app.consuelohq.com">Get Started');
  });

  test("opens the generated table of contents in static HTML", async () => {
    const pluginPath = join(siteRoot, "src/plugins/remarkOpenToc.mjs");
    const [astroConfig, postLayout] = await Promise.all([
      readSiteFile("astro.config.mjs"),
      readSiteFile("src/layouts/PostDetails.astro"),
    ]);

    expect(existsSync(pluginPath)).toBe(true);
    expect(astroConfig).toContain("remarkOpenToc");
    expect(postLayout).not.toContain("expandToc");

    if (!existsSync(pluginPath)) {
      return;
    }

    const { default: remarkOpenToc } = await import(
      `${pathToFileURL(pluginPath).href}?test=${Date.now()}`
    );
    const tree = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "html", value: "<details>" },
            { type: "html", value: "<summary>" },
            { type: "text", value: "Open Table of contents" },
            { type: "html", value: "</summary>" },
          ],
        },
      ],
    };

    remarkOpenToc()(tree);

    expect(tree.children[0].children[0].value).toBe("<details open>");
    expect(tree.children[0].children[2].value).toBe("Table of contents");
  });

  test("uses device fonts and a comfortable mobile reading measure", async () => {
    const [blogCss, globalCss, tokensCss, tailwindConfig, marketingLayout, packageJson] =
      await Promise.all([
        readSiteFile("src/styles/blog.css"),
        readSiteFile("src/styles/global.css"),
        readSiteFile("src/styles/tokens.css"),
        readSiteFile("tailwind.config.mjs"),
        readSiteFile("src/layouts/MarketingLayout.astro"),
        readSiteFile("package.json"),
      ]);

    expect(blogCss).toContain("--system-font:");
    expect(blogCss).toContain("font-family: var(--system-font)");
    expect(blogCss).toMatch(/\.app-layout\s*\{[^}]*padding-inline:\s*clamp\(1\.5rem/s);
    expect(blogCss).toMatch(/#article\s*\{[^}]*max-width:\s*42rem/s);
    expect(blogCss).toMatch(/#article\s*\{[^}]*line-height:\s*1\.75/s);

    expect(globalCss).not.toContain("@font-face");
    expect(globalCss).not.toContain("Geist Mono");
    expect(tailwindConfig).toContain(
      'sans: [...defaultTheme.fontFamily.sans]',
    );
    expect(tailwindConfig).toContain(
      'headings: [...defaultTheme.fontFamily.sans]',
    );
    expect(tokensCss).not.toContain("@fontsource");
    expect(tokensCss).not.toContain("@font-face");
    expect(tokensCss).toContain("--site-font-display: 'Bodoni Moda Variable'");
    expect(tokensCss).toContain("--site-font-body: 'Inter Variable'");
    expect(tokensCss).toContain("--site-font-mono: ui-monospace");
    expect(marketingLayout).toContain("font-family: var(--site-font-body)");
    expect(marketingLayout).not.toContain("Geist Mono");
    expect(packageJson).toContain("@fontsource-variable/bodoni-moda");
    expect(packageJson).toContain("@fontsource-variable/inter");
    expect(existsSync(join(siteRoot, "public/fonts/GeistMono-Variable.woff2"))).toBe(false);
    expect(existsSync(join(siteRoot, "public/fonts/GeistSans-Variable.woff2"))).toBe(false);
  });
});
