import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;

describe("Trace Burn Intelligence Astro source contract", () => {
  test("uses Astro page source instead of patching one generated HTML file", () => {
    const page = readFileSync(join(root, "src/pages/index.astro"), "utf8");

    expect(page).toContain("Trace Burn Intelligence");
    expect(page).toContain("/trace-burn-intelligence/live-traces.json");
    expect(page).toContain('data-testid="trace-launcher"');
    expect(page).not.toContain("document.addEventListener('click'");
    expect(page).not.toContain("/Live traces/i");
  });

  test("ships one owned client module for trace explorer behavior", () => {
    const page = readFileSync(join(root, "src/pages/index.astro"), "utf8");
    const client = readFileSync(join(root, "src/scripts/traceExplorer.ts"), "utf8");

    expect(page).toContain("../scripts/traceExplorer.ts");
    expect(client).toContain("createTraceExplorerState");
    expect(client).toContain("pollTraceFeed");
    expect(client).not.toContain("window.openTraceExplorerV2");
  });

  test("table contract uses time-only start column and mobile full-screen modal", () => {
    const page = readFileSync(join(root, "src/pages/index.astro"), "utf8");
    const css = readFileSync(join(root, "src/styles/trace.css"), "utf8");

    expect(page).toContain("<span>Time</span>");
    expect(page).not.toContain("Start Time");
    expect(css).toContain("100dvh");
    expect(css).toContain("100vw");
    expect(css).toContain("--trace-time-col: 92px");
  });
});
