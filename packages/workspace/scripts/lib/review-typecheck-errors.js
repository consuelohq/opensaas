const path = require('path');

const DIAGNOSTIC_PREVIEW_LIMIT = 2000;
const ANSI_RE = /\u001b\[[0-9;]*m/g;

function normalizeDiagnosticPath(repoRoot, file) {
  const raw = file.trim().replace(/^\.\//, '');
  const normalized = path.isAbsolute(raw) ? path.relative(repoRoot, raw) : raw;
  return normalized.split(path.sep).join('/');
}

// A failing compiler process is always a blocking finding. Do not infer
// success from the presence/absence of TypeScript's standard error wording.
function parseTypecheckFailure({ repoRoot, projectName, error }) {
  const stdout = error?.stdout?.toString() || '';
  const stderr = error?.stderr?.toString() || '';
  const output = [stdout, stderr].filter(Boolean).join('\n').replace(ANSI_RE, '');
  const findings = [];
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!/error\s+TS\d+/i.test(trimmed)) continue;
    const diagnostic = trimmed.match(/^(.+?)\((\d+),\d+\):\s*error\s+(TS\d+):\s*(.*)$/i)
      || trimmed.match(/^(.+?):(\d+):\d+\s*-\s*error\s+(TS\d+):\s*(.*)$/i);
    if (diagnostic) {
      findings.push({
        file: normalizeDiagnosticPath(repoRoot, diagnostic[1]),
        line: Number(diagnostic[2]),
        rule: 'TYPECHECK',
        msg: diagnostic[3] + ': ' + diagnostic[4],
      });
    } else {
      findings.push({
        file: '',
        line: 0,
        rule: 'TYPECHECK',
        msg: 'typecheck ' + projectName + ': ' + trimmed.slice(-DIAGNOSTIC_PREVIEW_LIMIT),
      });
    }
  }

  if (findings.length === 0) {
    const details = output.trim() || String(error?.message || 'compiler exited unsuccessfully without diagnostics');
    findings.push({
      file: '',
      line: 0,
      rule: 'TYPECHECK',
      msg: 'typecheck failed for ' + projectName + ': ' + details.slice(-DIAGNOSTIC_PREVIEW_LIMIT),
    });
  }

  return findings;
}

module.exports = { parseTypecheckFailure };
