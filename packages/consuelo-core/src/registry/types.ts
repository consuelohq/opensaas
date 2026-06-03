import { z } from 'zod';

export const RegistryExposureSchema = z.enum(['internal', 'operator', 'public', 'runtime']);

export const MigrationStatusSchema = z.enum([
  'workspace-owned',
  'os-owned',
  'shared-core',
  'copied-pending-core',
  'deprecated',
]);

export const SourceOfTruthSchema = z
  .object({
    ref: z.string().min(1),
    commit: z.string().min(1).optional(),
    path: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

const RegistryEntryBaseSchema = z
  .object({
    id: z.string().min(1),
    ownerPackage: z.string().min(1),
    exposure: RegistryExposureSchema,
    migrationStatus: MigrationStatusSchema,
    sourceOfTruth: SourceOfTruthSchema,
    validation: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const PackageRegistryEntrySchema = RegistryEntryBaseSchema.extend({
  path: z.string().min(1),
  packageJsonPath: z.string().min(1),
}).strict();

export const ScriptRegistryEntrySchema = RegistryEntryBaseSchema.extend({
  packageJsonPath: z.string().min(1),
  scriptName: z.string().min(1),
  command: z.string().min(1),
  resolvedTargets: z.array(z.string().min(1)).min(1),
}).strict();

export const ToolRegistryEntrySchema = RegistryEntryBaseSchema.extend({
  surface: z.string().min(1),
  scriptEntryId: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
}).strict();

export const SkillRegistryEntrySchema = RegistryEntryBaseSchema.extend({
  skillName: z.string().min(1),
  path: z.string().min(1).optional(),
  placeholder: z.boolean(),
}).strict();

export const ConsueloCoreRegistrySchema = z
  .object({
    version: z.literal(1),
    packages: z.array(PackageRegistryEntrySchema),
    scripts: z.array(ScriptRegistryEntrySchema),
    tools: z.array(ToolRegistryEntrySchema),
    skills: z.array(SkillRegistryEntrySchema),
  })
  .strict();

export type RegistryExposure = z.infer<typeof RegistryExposureSchema>;
export type MigrationStatus = z.infer<typeof MigrationStatusSchema>;
export type SourceOfTruth = z.infer<typeof SourceOfTruthSchema>;
export type PackageRegistryEntry = z.infer<typeof PackageRegistryEntrySchema>;
export type ScriptRegistryEntry = z.infer<typeof ScriptRegistryEntrySchema>;
export type ToolRegistryEntry = z.infer<typeof ToolRegistryEntrySchema>;
export type SkillRegistryEntry = z.infer<typeof SkillRegistryEntrySchema>;
export type ConsueloCoreRegistry = z.infer<typeof ConsueloCoreRegistrySchema>;

export type RegistryAuditCode =
  | 'PACKAGE_JSON_MISSING'
  | 'PACKAGE_SCRIPTS_INVALID'
  | 'SCRIPT_TARGET_MISSING'
  | 'SCRIPT_TARGET_REGISTRY_DRIFT'
  | 'LOCAL_IMPORT_MISSING'
  | 'WORKSPACE_OWNED_TARGET_MISSING'
  | 'WORKSPACE_SOURCE_MISSING_WITH_OS_COPY';

export type RegistryAuditIssue = {
  code: RegistryAuditCode;
  message: string;
  path: string;
  packageJsonPath?: string;
  scriptName?: string;
  command?: string;
  registryEntryId?: string;
  ownerPackage?: string;
  importerPath?: string;
  importSpecifier?: string;
};

export type RegistryDriftDuplicate = {
  relativePath: string;
  workspacePath: string;
  osPath: string;
  workspaceHash: string;
  osHash: string;
  sameHash: boolean;
  workspaceOwner: string;
  osOwner: string;
  workspaceRegistryEntryIds: string[];
  osRegistryEntryIds: string[];
};

export type RegistryDriftReport = {
  duplicates: RegistryDriftDuplicate[];
};

export type RegistryAuditCliOutput = {
  ok: boolean;
  issues: RegistryAuditIssue[];
  drift: RegistryDriftReport;
  registry: {
    version: 1;
    packages: number;
    scripts: number;
    tools: number;
    skills: number;
  };
};
