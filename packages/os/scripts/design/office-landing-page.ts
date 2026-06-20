import { createWorkspaceArtifact } from '../lib/artifacts';
import { getPackageRoot } from '../lib/manifest';
import type { CallOutput, SkillContext } from '../lib/types';

type LandingPageInput = {
  artifactTitle?: string;
  campaign?: {
    audience?: string;
    offer?: string;
    objective?: string;
    proofPoints?: string[];
  };
  sourceContext?: {
    workspaceSnapshotArtifactId?: string;
    briefArtifactId?: string;
    notes?: string;
  };
  publish?: boolean;
  replaceCustomerFacingPage?: boolean;
  name?: string;
  prompt?: string;
};

type DesignPlan = {
  workflow?: string;
  project?: {
    name?: string;
    skillId?: string;
    designSystemId?: string | null;
    metadata?: unknown;
    pendingPrompt?: string;
  };
};

type SpawnResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeInput(input: unknown): LandingPageInput {
  return isRecord(input) ? input as LandingPageInput : {};
}

function sanitizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 120);
}

function buildArtifactTitle(input: LandingPageInput): string {
  const explicitTitle = typeof input.artifactTitle === 'string' ? sanitizeTitle(input.artifactTitle) : '';
  if (explicitTitle.length > 0) return explicitTitle;
  const offer = typeof input.campaign?.offer === 'string' ? sanitizeTitle(input.campaign.offer) : '';
  if (offer.length > 0) return `${offer} Landing Page Draft`;
  return 'Office Landing Page Draft';
}

function buildPrompt(input: LandingPageInput, artifactTitle: string): string {
  if (typeof input.prompt === 'string' && input.prompt.trim().length > 0) return input.prompt.trim();
  const proofPoints = Array.isArray(input.campaign?.proofPoints)
    ? input.campaign.proofPoints.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  return [
    `Create a Consuelo landing page draft for: ${artifactTitle}.`,
    input.campaign?.audience ? `Audience: ${input.campaign.audience}` : null,
    input.campaign?.offer ? `Offer: ${input.campaign.offer}` : null,
    input.campaign?.objective ? `Objective: ${input.campaign.objective}` : null,
    proofPoints.length > 0 ? `Proof points: ${proofPoints.join('; ')}` : null,
    input.sourceContext?.workspaceSnapshotArtifactId ? `Workspace snapshot artifact: ${input.sourceContext.workspaceSnapshotArtifactId}` : null,
    input.sourceContext?.briefArtifactId ? `Brief artifact: ${input.sourceContext.briefArtifactId}` : null,
    input.sourceContext?.notes ? `Context notes: ${input.sourceContext.notes}` : null,
    'Use the existing Office system and website workflow. Produce a draft artifact only; do not publish or replace a customer-facing page without approval.',
  ].filter((line): line is string => Boolean(line)).join('\n');
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return slug.length > 0 ? slug : 'office-landing-page';
}

async function runDesignDryRun(name: string, prompt: string): Promise<SpawnResult> {
  try {
    const packageRoot = getPackageRoot();
    const child = Bun.spawn([
      'bun',
      './scripts/office.ts',
      'generate',
      'website',
      '--dry-run',
      '--json',
      '--name',
      name,
      '--prompt',
      prompt,
    ], {
      cwd: packageRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { stdout, stderr, exitCode };
  } catch (error: unknown) {
    return {
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1,
    };
  }
}

function parseDesignPlan(stdout: string): DesignPlan {
  const trimmed = stdout.trim();
  if (!trimmed) throw new Error('Office returned an empty dry-run plan.');
  const parsed = JSON.parse(trimmed) as unknown;
  if (!isRecord(parsed)) throw new Error('Office dry-run plan was not an object.');
  return parsed as DesignPlan;
}

function approvalOutput(input: LandingPageInput, context: SkillContext): CallOutput | null {
  if (!input.publish && !input.replaceCustomerFacingPage) return null;
  const blockedActions = [
    input.publish ? 'publish' : null,
    input.replaceCustomerFacingPage ? 'replace customer-facing page' : null,
  ].filter((item): item is string => item != null);
  return {
    ok: false,
    name: context.manifestEntry.name,
    permission: context.manifestEntry.permission,
    requiresApproval: true,
    proposedWrites: [{
      type: 'office-publish-request',
      actions: blockedActions,
      approvalRequired: true,
    }],
    error: {
      code: 'APPROVAL_REQUIRED',
      message: 'Publishing or replacing customer-facing pages requires explicit approval. Draft generation remains available without approval.',
    },
  };
}

export async function runOfficeLandingPage(input: unknown, context: SkillContext): Promise<CallOutput> {
  const normalizedInput = normalizeInput(input);
  const approval = approvalOutput(normalizedInput, context);
  if (approval) return approval;

  const artifactTitle = buildArtifactTitle(normalizedInput);
  const projectName = typeof normalizedInput.name === 'string' && normalizedInput.name.trim().length > 0
    ? sanitizeTitle(normalizedInput.name)
    : artifactTitle;
  const prompt = buildPrompt(normalizedInput, artifactTitle);
  const dryRun = await runDesignDryRun(projectName, prompt);
  if (dryRun.exitCode !== 0) {
    return {
      ok: false,
      name: context.manifestEntry.name,
      permission: context.manifestEntry.permission,
      requiresApproval: context.manifestEntry.requiresApproval,
      error: {
        code: 'OFFICE_DRY_RUN_FAILED',
        message: (dryRun.stderr || dryRun.stdout || `Office exited ${dryRun.exitCode}`).slice(0, 240),
      },
    };
  }

  let designPlan: DesignPlan;
  try {
    designPlan = parseDesignPlan(dryRun.stdout);
  } catch (error: unknown) {
    return {
      ok: false,
      name: context.manifestEntry.name,
      permission: context.manifestEntry.permission,
      requiresApproval: context.manifestEntry.requiresApproval,
      error: {
        code: 'OFFICE_PLAN_PARSE_FAILED',
        message: error instanceof Error ? error.message.slice(0, 240) : 'Could not parse Office dry-run plan.',
      },
    };
  }

  const result = {
    summary: 'Office landing page draft prepared.',
    workflow: 'website',
    designSystem: 'consuelo',
    primaryDesignSkill: designPlan.project?.skillId ?? 'saas-landing',
    fallbackDesignSkills: ['web-prototype', 'web-prototype-taste-editorial'],
    publishRequested: false,
    replaceCustomerFacingPageRequested: false,
    approval: {
      required: false,
      reason: null,
    },
    project: {
      name: designPlan.project?.name ?? projectName,
      metadata: designPlan.project?.metadata ?? null,
    },
    prompt,
    nextActions: [
      'Review the draft work order artifact.',
      'Open Office with the generated project plan when ready to iterate visually.',
      'Request explicit approval before publishing or replacing a customer-facing page.',
    ],
  };

  const artifact = createWorkspaceArtifact({
    traceId: context.traceId,
    workspaceId: context.workspaceId,
    createdByUserId: context.userId,
    skillName: context.manifestEntry.name,
    title: artifactTitle,
    fileName: `${slugify(artifactTitle)}.json`,
    type: 'draft',
    format: 'json',
    content: {
      generatedAt: new Date().toISOString(),
      traceId: context.traceId,
      skillName: context.manifestEntry.name,
      result,
      designPlan,
    },
    inputSummary: normalizedInput,
  });

  return {
    ok: true,
    name: context.manifestEntry.name,
    permission: context.manifestEntry.permission,
    requiresApproval: context.manifestEntry.requiresApproval,
    result,
    artifacts: [artifact],
    proposedWrites: [],
  };
}