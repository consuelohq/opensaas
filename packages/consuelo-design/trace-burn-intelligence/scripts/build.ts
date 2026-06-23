#!/usr/bin/env bun
import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(import.meta.dir, "../../../..");
const projectRoot = resolve(import.meta.dir, "..");
const astroBin = join(repoRoot, "packages/consuelo-website/node_modules/astro/bin/astro.mjs");
const projectNodeModules = join(projectRoot, "node_modules");
const sharedNodeModules = join(repoRoot, "packages/consuelo-website/node_modules");
if (!existsSync(join(projectNodeModules, "astro"))) {
  rmSync(projectNodeModules, { recursive: true, force: true });
  symlinkSync(sharedNodeModules, projectNodeModules, "dir");
}
const archiveTarget = join(repoRoot, "packages/consuelo-design/upstream/open-design/.od/consuelo/archive/artifacts/trace-burn-intelligence");

const result = spawnSync(process.execPath, [astroBin, "build", "--root", projectRoot], {
  cwd: repoRoot,
  stdio: "inherit",
  env: { ...process.env, NODE_PATH: sharedNodeModules },
});
if (result.status !== 0) process.exit(result.status ?? 1);

if (process.argv.includes("--copy-to-archive")) {
  const dist = join(projectRoot, "dist");
  if (!existsSync(dist)) throw new Error(`missing Astro dist: ${dist}`);
  mkdirSync(archiveTarget, { recursive: true });
  for (const name of ["index.html", "_astro"]) {
    const source = join(dist, name);
    const target = join(archiveTarget, name);
    if (!existsSync(source)) continue;
    rmSync(target, { recursive: true, force: true });
    cpSync(source, target, { recursive: true });
  }
  process.stdout.write(`${JSON.stringify({ ok: true, archiveTarget }, null, 2)}\n`);
}
