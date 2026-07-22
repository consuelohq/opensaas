const root = import.meta.dir;
const planRoot = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const masterPath = `${planRoot}/plan.md`;

const master = await Bun.file(masterPath).text();
const readme = await Bun.file(`${root}/README.md`).text();
const dispatch = await Bun.file(`${planRoot}/dispatch.md`).text();
const environmentRegistry = await Bun.file(`${planRoot}/environment-registry.md`).text();
const reviewTemplate = await Bun.file(`${root}/grok-review-template.md`).text();
const gitignore = await Bun.file(`${planRoot}/../../../../.gitignore`).text();
const files: string[] = [];

for await (const name of new Bun.Glob('*.md').scan({ cwd: root })) {
  files.push(name);
}

files.sort();

const workers = files.filter((name) => /^\d{2}-.*\.md$/.test(name));
const expectedPrefixes = Array.from({ length: 30 }, (_, index) =>
  String(index + 1).padStart(2, '0'),
);
const references = [...readme.matchAll(/`((?:\d{2})-.*?\.md)`/g)].map(
  (match) => match[1],
);
const uniqueReferences = [...new Set(references)];
const missingReferences = uniqueReferences.filter((name) => !files.includes(name));
const unreferencedWorkers = workers.filter((name) => !references.includes(name));
const groupedPrefixes = workers.reduce<Record<string, string[]>>((groups, name) => {
  const prefix = name.match(/^(\d{2})-/)?.[1] ?? name;
  (groups[prefix] ??= []).push(name);
  return groups;
}, {});
const duplicatePrefixes = Object.entries(groupedPrefixes).filter(
  ([, names]) => names.length > 1,
);
const missingPrefixes = expectedPrefixes.filter((prefix) => !groupedPrefixes[prefix]);
const unexpectedPrefixes = Object.keys(groupedPrefixes).filter(
  (prefix) => !expectedPrefixes.includes(prefix),
);
const structuralFailures: string[] = [];
let totalLines = master.split('\n').length + readme.split('\n').length;

const workerTexts: string[] = [];

for (const name of workers) {
  const text = await Bun.file(`${root}/${name}`).text();
  totalLines += text.split('\n').length;

  if (!text.includes('packages/os/plans/consuelo-os-foundation/plan.md')) {
    structuralFailures.push(`${name}: missing master-plan reference`);
  }
  if (!/^## (?:Mission|Objective)$/m.test(text)) {
    structuralFailures.push(`${name}: missing Mission or Objective section`);
  }
  if (!/^## .*?(?:Acceptance|Validation|Tests).*$/mi.test(text)) {
    structuralFailures.push(`${name}: missing acceptance or validation section`);
  }
  if (/\b(?:TO[D]O|T[B]D|FIXM[E])\b/.test(text)) {
    structuralFailures.push(`${name}: contains placeholder`);
  }
  if (!/os\.get_steering|OS-only execution/i.test(text)) {
    structuralFailures.push(`${name}: missing OS execution contract`);
  }
  if (!/Grok 4\.5|CodeRabbit\/Grok review/i.test(text)) {
    structuralFailures.push(`${name}: missing independent-review contract`);
  }

  workerTexts.push(text);
}

const corpus = [
  master,
  readme,
  dispatch,
  environmentRegistry,
  reviewTemplate,
  ...workerTexts,
].join('\n');
const forbiddenPatterns: Array<[string, RegExp]> = [
  ['stale worker 02 filename', /02-artifact-builder\.md/i],
  ['stale no-release-branches rule', /without adding source branches|do not add `canary` or `beta` Git branches/i],
  ['optional CI container lane', /Containers may cover Linux clean hosts but are optional/i],
  ['wrong workspace-prefixed GTM route', /\/<workspace>\/gtm/i],
  ['dispatch before environment registry', /It is dispatchable as written|These prompts may be dispatched in dependency order/i],
  ['ambiguous tool source extensions', /manifest\.ts or manifest\.json|handler\.ts or handler\.js/i],
  ['positive temporary shim plan', /temporary compatibility shims with|Preserve compatibility aliases|Keep compatibility shims temporary|Provide a bounded compatibility message/i],
  ['separate Worker 27 dispatch', /Dispatch Worker 27 by itself first|Worker 27 may establish review infrastructure in parallel/i],
  ['local review artifacts as authority', /saved Grok 4\.5 review under|Save the redacted prompt, metadata, and response under/i],
  ['tracked generated review directory', /packages\/os\/plans\/consuelo-os-foundation\/reviews\/<task>\//i],
];
const forbiddenMatches = forbiddenPatterns
  .filter(([, pattern]) => pattern.test(corpus))
  .map(([label]) => label);

const coverage = {
  finalStatus: /Status: final architecture baseline/.test(master),
  environmentRegistryGate:
    /Environment registry \(completed pre-dispatch gate\)/.test(master) &&
    /Worker 01 is complete/.test(readme),
  trackedPlanSource:
    /packages\/os\/plans\/consuelo-os-foundation/.test(corpus) &&
    !/packages\/os\/\.workspace\/consuelo-os-foundation/.test(corpus),
  permanentReleaseBranches:
    /permanent protected `canary`, `beta`, and `stable` release branches/i.test(corpus),
  releaseAuthorityHierarchy:
    /signed channel manifests.*immutable.*tags.*GitHub Releases.*GitHub Deployments/is.test(corpus) &&
    /secondary.*promotion refs/is.test(corpus),
  automaticVersioning:
    /version-neutral `releaseFingerprint`/.test(corpus) &&
    /Default to a patch bump|defaults to one patch version/i.test(corpus) &&
    /first release.*seed version|first release requires.*seed/is.test(corpus) &&
    /same source commit and release fingerprint.*reuse.*version|retrying the same source\/fingerprint reuses the same version/is.test(corpus),
  schemaVersionSeparate:
    /`schemaVersion` is independent of the product version|`schemaVersion` does not follow SemVer/i.test(corpus),
  immutablePromotion:
    /promotion never rebuilds|promotion.*without rebuilding|never rebuild/is.test(corpus),
  githubAndCloudflareDistribution:
    /GitHub Release/.test(corpus) && /Cloudflare/.test(corpus) && /same digest|match by digest/is.test(corpus),
  runtimeBundleTerminology: /immutable runtime bundle/i.test(corpus),
  noPrDeployments:
    /Open pull requests run checks.*do not deploy|Pull requests run build and validation checks only/is.test(corpus),
  mandatoryCleanHostLane:
    /mandatory OCI clean-host|OCI clean-host CI lane.*mandatory/is.test(corpus),
  localDockerNotRequired:
    /Docker is not required on Ko's Mac|not require Docker on Ko's Mac/i.test(corpus),
  koOwnsRealMacMutation:
    /Ko, not a worker agent, runs install, update, reset, and uninstall|Ko runs every install, update, reset, restart, and uninstall/i.test(corpus),
  macMiniDev: /Mac Mini.*dev/is.test(corpus),
  macBookAirAcceptance: /MacBook Air.*(?:canary|beta)/is.test(corpus),
  multiNode:
    /server-backed node registry/i.test(corpus) &&
    /signed heartbeats/i.test(corpus) &&
    /never silently.*another computer|never silently.*cross-machine/is.test(corpus),
  gtmSubdomainRoute: /workspace.*\/gtm|\/gtm.*workspace/is.test(corpus),
  updateSkipsOnboarding:
    /update.*without repeating onboarding|updates? skips? OAuth|update.*never repeat.*OAuth/is.test(corpus),
  restartCommand: /consuelo restart/.test(corpus),
  restartReuse:
    /consuelo-reload\.js/.test(corpus) &&
    /workspace-watchdog\.sh|watchdog behavior/.test(corpus) &&
    /reply-safe.*launchd.*direct.*kill escalation.*bounded health/is.test(corpus),
  userSteering:
    /~\/Consuelo\/Steering\//.test(corpus) && /never overwrite.*user steering/i.test(corpus),
  notificationPreferences:
    /notification.*(?:off|disable).*snooze|off\/snooze/is.test(corpus),
  decisionMarkdownRemoved:
    /Stop installing `decision\.md`|stop seeding .*decision\.md/i.test(corpus),
  skillsRegistryInSteering: /skills.*steering|steering.*skills/is.test(corpus),
  providerSet:
    /Railway/.test(corpus) && /Vercel/.test(corpus) && /Cloudflare/.test(corpus),
  customerOperatorBoundary: /customer.*operator|operator.*customer/is.test(corpus),
  canonicalToolPackages:
    /canonical tool-package/i.test(corpus) && /`packages\/os\/tooling`.*(?:remove|delete)/is.test(corpus),
  exactTypeScriptToolLayout:
    /packages\/os\/tools\/<domain>\/\s+manifest\.ts\s+handler\.ts\s+schema\.ts\s+handler\.test\.ts/is.test(corpus),
  fullAndCoreOnly:
    /Full and core are the only shipped tool manifests/i.test(corpus) &&
    /development-tool and media-tool capability sets|dev and media capabilities/i.test(corpus),
  workflowSurfaceRetained:
    /workflow-bundles\.json.*(?:active|workflow runtime)|workflow runtime.*workflow-bundles\.json/is.test(corpus),
  parityInternalOnly:
    /script-parity-classifications\.json.*internal.*(?:fixture|audit)/is.test(corpus) &&
    /exclude.*runtime bundle|stay out of customer bundles/is.test(corpus),
  noToolCompatibilityShims:
    /Do not add compatibility shims|Do not add path shims/.test(corpus) &&
    /delete superseded source.*same release|delete superseded sources in the same release/is.test(corpus),
  existingTestsPreserved:
    /existing OS behavioral suites remain regression contracts/i.test(corpus) &&
    /os-get-steering-trace\.test\.ts/.test(corpus) &&
    /change.*assertion.*explicit approved behavior change|change an assertion only for an explicit approved behavior change/is.test(corpus),
  cliSplit:
    /`consuelo`.*OS lifecycle/is.test(corpus) && /`consuelo-dialer`/i.test(corpus),
  osWorkerExecution:
    /Bootstrap exactly once with `os\.get_steering\(\)`/.test(master) &&
    /Use `os\.call`/.test(master),
  independentReview:
    /Grok 4\.5/.test(corpus) &&
    /CodeRabbit/.test(corpus) &&
    /grok-review-template\.md/.test(corpus) &&
    /consuelo_high_signal_pr_review/.test(corpus),
  existingSubagentReviewLane:
    /packages\/os\/scripts\/subagent\.ts/.test(corpus) &&
    /--provider grok/.test(corpus) &&
    /--model grok-4\.5/.test(corpus) &&
    /--policy read/.test(corpus) &&
    /Do not create a new product review tool/i.test(corpus),
  ignoredReviewPromptDirectory:
    /packages\/os\/\.tmp-reviews\/<task>\/grok-prompt\.md/.test(corpus) &&
    /\/packages\/os\/\.tmp-reviews\//.test(gitignore) &&
    !/--instruction-path \/tmp\//.test(corpus),
  grokReadPolicyEnforced:
    /--permission-mode auto/.test(corpus) &&
    /den(?:y|ies).*edit.*write.*(?:shell|Bash)/is.test(corpus) &&
    /cancelled.*(?:incomplete|empty).*fail closed/is.test(corpus) &&
    /bounded turns/i.test(corpus) &&
    /(?:disables? memory.*subagents|memory (?:disabled|and subagents disabled))/i.test(corpus) &&
    /--workspace-only preferred/.test(corpus) &&
    !/--workspace-only strict/.test(corpus) &&
    !/Grok plan mode/i.test(environmentRegistry),
  githubReviewAuthority:
    /GitHub is the durable source of truth/i.test(corpus) &&
    /inline (?:review )?comments/i.test(corpus) &&
    /top-level PR comment/i.test(corpus),
  noSeparateReviewWorker:
    /Do not dispatch Worker 27/i.test(corpus) &&
    /review procedure is already available/i.test(corpus),
  environmentFailureStopRule:
    /If .*environment.*(?:broken|fails|unavailable|mismatch).*stop/is.test(corpus) &&
    /Do not bypass.*environment|no environment fallback/is.test(corpus),
  chatCloseoutContract:
    /chat.*only.*`done`.*PR (?:link|URL)|respond.*only.*`done`.*PR (?:link|URL)/is.test(corpus),
  fullReviewFindingContract:
    /agent_fix_prompt/.test(corpus) &&
    /inline_comment/.test(corpus) &&
    /context_checked/.test(corpus) &&
    /☑️ approved/.test(corpus) &&
    /☑️ issues found/.test(corpus),
  repoBoundaryAudit:
    /Repository, Product, Brand, License, And Package-Manager Audit/.test(corpus) &&
    /Do not assume the whole repository can simply become MIT/.test(corpus),
  extractionIsGated:
    /Do not start unless Ko explicitly approves Worker 28/.test(corpus),
};

const report = {
  masterLines: master.split('\n').length,
  workerCount: workers.length,
  totalLines,
  referencedWorkers: uniqueReferences.length,
  missingReferences,
  unreferencedWorkers,
  duplicatePrefixes,
  missingPrefixes,
  unexpectedPrefixes,
  structuralFailures,
  forbiddenMatches,
  coverage,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (
  workers.length !== expectedPrefixes.length ||
  missingReferences.length > 0 ||
  unreferencedWorkers.length > 0 ||
  duplicatePrefixes.length > 0 ||
  missingPrefixes.length > 0 ||
  unexpectedPrefixes.length > 0 ||
  structuralFailures.length > 0 ||
  forbiddenMatches.length > 0 ||
  Object.values(coverage).some((covered) => !covered)
) {
  process.exit(1);
}
