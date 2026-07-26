const fs = require('fs');
const path = require('path');

const TEST_SELECTION_REGISTRY = path.join(
  'packages',
  'workspace',
  'test-selection.registry.json',
);

function globToRegExp(glob) {
  let out = '';
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index];
    const next = glob[index + 1];
    if (character === '*' && next === '*') {
      out += '.*';
      index += 1;
    } else if (character === '*') {
      out += '[^/]*';
    } else if ('\\.+?^${}()|[]'.includes(character)) {
      out += `\\${character}`;
    } else {
      out += character;
    }
  }
  return new RegExp(`^${out}$`);
}

function matchesPattern(file, pattern) {
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3);
    return file === prefix || file.startsWith(`${prefix}/`);
  }
  return globToRegExp(pattern).test(file);
}

function readTestSelectionRegistry(root) {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(root, TEST_SELECTION_REGISTRY), 'utf8'),
    );
  } catch {
    return { rules: [] };
  }
}

function exclusivelyOwnedFiles(files, registry) {
  const owned = new Set();
  for (const rule of registry?.rules || []) {
    if (!rule.exclusive) continue;
    for (const file of files) {
      if (
        (rule.source || []).some((pattern) => matchesPattern(file, pattern))
        && !(rule.exclude || []).some((pattern) => matchesPattern(file, pattern))
      ) {
        owned.add(file);
      }
    }
  }
  return owned;
}

function isLintConfigurationFile(file) {
  return /(^|\/)eslint\.config\.[cm]?[jt]s$/.test(String(file || ''));
}

function reviewTaskEntrypoint(taskRoot) {
  return path.join(taskRoot, 'packages', 'workspace', 'scripts', 'review.js');
}

function reviewTestPackages(
  files,
  root,
  fileExists,
  registry = readTestSelectionRegistry(root),
) {
  const preciselyOwnedFiles = exclusivelyOwnedFiles(files, registry);
  const packages = [
    ...new Set(
      files
        .filter((file) => !preciselyOwnedFiles.has(file))
        .filter((file) => !isLintConfigurationFile(file))
        .map((file) => {
          const match = file.match(/^packages\/([^/]+)\//);
          return match ? match[1] : null;
        })
        .filter(Boolean),
    ),
  ];

  return packages.filter((pkg) =>
    fileExists(path.join(root, 'packages', pkg, 'jest.config.mjs')),
  );
}

module.exports = {
  isLintConfigurationFile,
  reviewTaskEntrypoint,
  reviewTestPackages,
};
