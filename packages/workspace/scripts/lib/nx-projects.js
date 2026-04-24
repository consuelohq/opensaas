const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function getNxBinary(repoRoot) {
  const binaryName = process.platform === 'win32' ? 'nx.cmd' : 'nx';
  const nxPath = path.join(repoRoot, 'node_modules', '.bin', binaryName);
  return fs.existsSync(nxPath) ? nxPath : null;
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function runNxJson(repoRoot, args) {
  const nxPath = getNxBinary(repoRoot);
  if (!nxPath) {
    return null;
  }

  try {
    const output = execFileSync(nxPath, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return parseJson(output);
  } catch {
    return null;
  }
}

function readPackageProjects(repoRoot) {
  const packagesRoot = path.join(repoRoot, 'packages');
  if (!fs.existsSync(packagesRoot)) {
    return [];
  }

  return fs.readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const root = `packages/${entry.name}`;
      const packageJsonPath = path.join(repoRoot, root, 'package.json');
      const packageJson = fs.existsSync(packageJsonPath)
        ? parseJson(fs.readFileSync(packageJsonPath, 'utf8'))
        : null;

      return {
        name: packageJson && packageJson.name ? packageJson.name : entry.name,
        root,
        targets: {},
        source: 'package-scan',
      };
    });
}

const projectCache = new Map();

function readNxProjects(repoRoot) {
  const cachedProjects = projectCache.get(repoRoot);
  if (cachedProjects) {
    return cachedProjects;
  }

  const projectNames = runNxJson(repoRoot, ['show', 'projects', '--json']);

  if (!Array.isArray(projectNames)) {
    const packageProjects = readPackageProjects(repoRoot);
    projectCache.set(repoRoot, packageProjects);
    return packageProjects;
  }

  const projects = [];

  for (const name of projectNames) {
    const project = runNxJson(repoRoot, ['show', 'project', name, '--json']);

    if (!project || !project.root) {
      continue;
    }

    projects.push({
      name: project.name || name,
      root: String(project.root).replace(/\\/g, '/').replace(/\/$/, ''),
      targets: project.targets || {},
      source: 'nx',
    });
  }

  const sortedProjects = projects.sort((a, b) => b.root.length - a.root.length);
  projectCache.set(repoRoot, sortedProjects);
  return sortedProjects;
}

function normalizeRepoPath(filePath) {
  return String(filePath).replace(/\\/g, '/').replace(/^\.\//, '');
}

function getProjectsForFiles(repoRoot, files) {
  const projects = readNxProjects(repoRoot);
  const byName = new Map();

  for (const file of files) {
    const normalizedFile = normalizeRepoPath(file);
    const project = projects.find((candidate) => (
      normalizedFile === candidate.root || normalizedFile.startsWith(`${candidate.root}/`)
    ));

    if (!project) {
      continue;
    }

    const existing = byName.get(project.name) || { ...project, files: [] };
    existing.files.push(normalizedFile);
    byName.set(project.name, existing);
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function getProjectsWithTarget(repoRoot, files, target) {
  return getProjectsForFiles(repoRoot, files)
    .filter((project) => project.targets && project.targets[target]);
}

module.exports = {
  getNxBinary,
  readNxProjects,
  getProjectsForFiles,
  getProjectsWithTarget,
};
