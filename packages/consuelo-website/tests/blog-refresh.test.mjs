import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

  test("keeps RSS copy and social links in the footer, including Discord", async () => {
    const [homepage, footer, socials, constants] = await Promise.all([
      readSiteFile("src/pages/blog/index.astro"),
      readSiteFile("src/components/Footer.astro"),
      readSiteFile("src/components/Socials.astro"),
      readSiteFile("src/constants.ts"),
    ]);

    expect(homepage).toContain('<Layout title="The Consuelo Blog"');
    expect(homepage).toContain("The Consuelo Blog");
    expect(homepage).toContain("featuredPosts.length > 0");
    expect(homepage).not.toContain("Tips, updates, stories");
    expect(homepage).not.toContain("Social Links:");

    expect(footer).toContain("RSS Feed");
    expect(footer).toContain("Tips, updates, stories");
    expect(footer).toContain("Socials");
    expect(socials).toContain("SOCIALS");
    expect(constants).toContain("export const SOCIALS");
    expect(constants).toContain("siteLinks.discord");
    expect(existsSync(join(siteRoot, "src/components/Socials.astro"))).toBe(true);
  });

  test("uses the requested blog name and navigation destinations", async () => {
    const [metadata, header, backButton] = await Promise.all([
      readSiteFile("src/lib/site-seo.ts"),
      readSiteFile("src/components/Header.astro"),
      readSiteFile("src/components/BackButton.astro"),
    ]);

    expect(metadata).toContain("blogTitle: 'The Consuelo Blog'");
    expect(header).toContain('href="/"');
    expect(header).toContain("OS");
    expect(header).not.toContain("Tags");
    expect(header).toContain('href="https://os.consuelohq.com"');
    expect(backButton).toContain("Home");
    expect(backButton).not.toContain("<span>home</span>");
    expect(backButton).toContain('id="post-utility-nav"');
  });

  test("renders a dedicated responsive article table of contents", async () => {
    const [article, postLayout, toc, astroConfig] = await Promise.all([
      readSiteFile("src/content/blog/software-is-becoming-decision-infrastructure.md"),
      readSiteFile("src/layouts/PostDetails.astro"),
      readSiteFile("src/components/ArticleToc.astro"),
      readSiteFile("astro.config.mjs"),
    ]);

    expect(article).not.toContain("## Table of contents");
    expect(postLayout).toContain("ArticleToc");
    expect(postLayout).toContain("headings={articleHeadings}");
    expect(toc).toContain("Table of Contents");
    expect(toc).toContain("data-article-toc");
    expect(toc).toContain("IntersectionObserver");
    expect(toc).toContain("scrollIntoView");
    expect(toc).toContain("aria-current");
    expect(astroConfig).not.toContain("remarkOpenToc");
    expect(astroConfig).not.toContain("remarkCollapse");
    expect(existsSync(join(siteRoot, "src/plugins/remarkOpenToc.mjs"))).toBe(false);
  });

  test("scopes black browser chrome to the blog layout", async () => {
    const [layout, seoHead] = await Promise.all([
      readSiteFile("src/layouts/Layout.astro"),
      readSiteFile("src/components/SeoHead.astro"),
    ]);

    expect(layout).toContain('themeColorLight="#000000"');
    expect(layout).toContain('themeColorDark="#000000"');
    expect(layout).toContain('colorScheme="dark"');
    expect(seoHead).toContain("themeColorLight");
    expect(seoHead).toContain("themeColorDark");
    expect(seoHead).toContain("colorScheme");
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
    expect(blogCss).toContain(".article-toc__rail");
    expect(blogCss).toContain("scroll-snap-type: x proximity");
    expect(blogCss).toContain("@media (min-width: 86rem)");

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
