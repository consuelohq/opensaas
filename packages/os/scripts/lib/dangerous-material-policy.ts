export type DangerousMaterialSeverity = 'high' | 'critical';

export type DangerousMaterialSecurityEvent = {
  event: 'security.dangerous_material.denied';
  code: 'DANGEROUS_MATERIAL_BLOCKED';
  source: string;
  location: string;
  patternId: string;
  severity: DangerousMaterialSeverity;
  reason: string;
  rawPayloadCaptured: false;
};

export type DangerousMaterialAllowedDecision = { allowed: true };

export type DangerousMaterialBlockedDecision = {
  allowed: false;
  code: 'DANGEROUS_MATERIAL_BLOCKED';
  source: string;
  location: string;
  patternId: string;
  severity: DangerousMaterialSeverity;
  reason: string;
  securityEvent: DangerousMaterialSecurityEvent;
};

export type DangerousMaterialDecision =
  | DangerousMaterialAllowedDecision
  | DangerousMaterialBlockedDecision;

export type DangerousMaterialAssessmentInput = {
  source: string;
  rawBody?: string;
  value?: unknown;
};

type DangerousMaterialPattern = {
  id: string;
  severity: DangerousMaterialSeverity;
  reason: string;
  pattern: RegExp;
};

const word = (...parts: string[]): string => parts.join('');
const boundary = (value: string): string => `\\b${value}\\b`;
const destructiveTarget = '(?:\\/|~|\\$HOME)(?=[^a-zA-Z0-9_-]|$)';
const recursiveForceFlag = '-[^\\n;|&]*r[^\\n;|&]*f[^\\n;|&]*';
const forceRecursiveFlag = '-[^\\n;|&]*f[^\\n;|&]*r[^\\n;|&]*';

function rx(source: string): RegExp {
  return new RegExp(source, 'i');
}

const commands = {
  remove: word('r', 'm'),
  disk: word('disk', 'util'),
  format: word('m', 'k', 'f', 's'),
  duplicate: word('d', 'd'),
  shut: word('shut', 'down'),
  boot: word('re', 'boot'),
  mode: word('ch', 'mod'),
  owner: word('ch', 'own'),
  privilege: word('su', 'do'),
  fetchA: word('cu', 'rl'),
  fetchB: word('wg', 'et'),
};

const DANGEROUS_MATERIAL_PATTERNS: DangerousMaterialPattern[] = [
  {
    id: 'recursive-root-delete',
    severity: 'critical',
    reason: 'catastrophic recursive delete command',
    pattern: rx(`${boundary(commands.remove)}\\s+${recursiveForceFlag}\\s+${destructiveTarget}`),
  },
  {
    id: 'recursive-home-delete',
    severity: 'critical',
    reason: 'catastrophic home directory delete command',
    pattern: rx(`${boundary(commands.remove)}\\s+${forceRecursiveFlag}\\s+${destructiveTarget}`),
  },
  {
    id: 'macos-disk-erase',
    severity: 'critical',
    reason: 'disk erase command',
    pattern: rx(`${boundary(commands.disk)}\\s+(?:erase(?:Disk|Volume)?|partitionDisk|apfs\\s+deleteContainer)\\b`),
  },
  {
    id: 'filesystem-format',
    severity: 'critical',
    reason: 'filesystem format command',
    pattern: rx(`${boundary(commands.format)}(?:\\.[a-z0-9_-]+)?\\b`),
  },
  {
    id: 'device-overwrite',
    severity: 'critical',
    reason: 'raw device overwrite command',
    pattern: rx(`${boundary(commands.duplicate)}\\s+[^\\n;|&]*(?:\\bof=\\/dev\\/|\\bif=\\/dev\\/(?:zero|random|urandom)\\b)`),
  },
  {
    id: 'system-power-state',
    severity: 'high',
    reason: 'system power-state command',
    pattern: rx(`\\b(?:${commands.shut}|${commands.boot})\\b`),
  },
  {
    id: 'world-writable-root',
    severity: 'critical',
    reason: 'world-writable recursive permission change',
    pattern: rx(`${boundary(commands.mode)}\\s+-R\\s+777\\s+${destructiveTarget}`),
  },
  {
    id: 'privileged-destructive-command',
    severity: 'critical',
    reason: 'privileged destructive command',
    pattern: rx(`${boundary(commands.privilege)}\\s+(?:-[^\\s]+\\s+)*(?:${commands.remove}|${commands.disk}|${commands.format}|${commands.duplicate}|${commands.shut}|${commands.boot}|${commands.mode}|${commands.owner})\\b`),
  },
  {
    id: 'downloaded-script-shell',
    severity: 'high',
    reason: 'downloaded script piped into a shell',
    pattern: rx(`\\b(?:${commands.fetchA}|${commands.fetchB})\\b[\\s\\S]{0,160}\\|\\s*(?:sh|bash|zsh)\\b`),
  },
];

function block(input: {
  source: string;
  location: string;
  pattern: DangerousMaterialPattern;
}): DangerousMaterialBlockedDecision {
  const securityEvent: DangerousMaterialSecurityEvent = {
    event: 'security.dangerous_material.denied',
    code: 'DANGEROUS_MATERIAL_BLOCKED',
    source: input.source,
    location: input.location,
    patternId: input.pattern.id,
    severity: input.pattern.severity,
    reason: input.pattern.reason,
    rawPayloadCaptured: false,
  };
  return {
    allowed: false,
    code: 'DANGEROUS_MATERIAL_BLOCKED',
    source: input.source,
    location: input.location,
    patternId: input.pattern.id,
    severity: input.pattern.severity,
    reason: input.pattern.reason,
    securityEvent,
  };
}

function assessText(input: {
  source: string;
  location: string;
  text: string;
}): DangerousMaterialDecision {
  for (const pattern of DANGEROUS_MATERIAL_PATTERNS) {
    if (pattern.pattern.test(input.text)) {
      return block({ source: input.source, location: input.location, pattern });
    }
  }
  return { allowed: true };
}

function jsonLocation(parent: string, key: string): string {
  return `${parent}.${key.replaceAll(/[^a-zA-Z0-9_$-]/g, '_')}`;
}

function stringValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string | number | boolean => (
      typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
    ))
    .map((item) => String(item));
}

function assessValue(input: {
  source: string;
  location: string;
  value: unknown;
}): DangerousMaterialDecision {
  if (typeof input.value === 'string') {
    return assessText({ source: input.source, location: input.location, text: input.value });
  }

  if (Array.isArray(input.value)) {
    const joined = stringValues(input.value).join(' ');
    if (joined) {
      const decision = assessText({ source: input.source, location: `${input.location}[]`, text: joined });
      if (!decision.allowed) return decision;
    }

    for (let index = 0; index < input.value.length; index += 1) {
      const decision = assessValue({
        source: input.source,
        location: `${input.location}[${index}]`,
        value: input.value[index],
      });
      if (!decision.allowed) return decision;
    }
    return { allowed: true };
  }

  if (!input.value || typeof input.value !== 'object') return { allowed: true };

  for (const [key, value] of Object.entries(input.value)) {
    const decision = assessValue({
      source: input.source,
      location: jsonLocation(input.location, key),
      value,
    });
    if (!decision.allowed) return decision;
  }

  return { allowed: true };
}

export function assessDangerousMaterial(input: DangerousMaterialAssessmentInput): DangerousMaterialDecision {
  if (typeof input.rawBody === 'string' && input.rawBody.length > 0) {
    const rawDecision = assessText({ source: input.source, location: '$rawBody', text: input.rawBody });
    if (!rawDecision.allowed) return rawDecision;
  }

  if ('value' in input) {
    return assessValue({ source: input.source, location: '$', value: input.value });
  }

  return { allowed: true };
}

export function dangerousMaterialError(input: DangerousMaterialBlockedDecision): {
  code: 'DANGEROUS_MATERIAL_BLOCKED';
  message: string;
  source: string;
  location: string;
  patternId: string;
  severity: DangerousMaterialSeverity;
} {
  return {
    code: input.code,
    message: 'Dangerous command material is blocked before workspace tool dispatch.',
    source: input.source,
    location: input.location,
    patternId: input.patternId,
    severity: input.severity,
  };
}

export function dangerousMaterialReason(text: string): string | null {
  const decision = assessText({ source: 'local-command', location: '$', text });
  return decision.allowed ? null : decision.reason;
}
