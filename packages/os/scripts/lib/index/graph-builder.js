const fs = require('fs');
const path = require('path');

const { getParserForPath } = require('./chunker');

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function withoutExtension(filePath) {
  return filePath.replace(/\.(ts|tsx|js|jsx)$/, '');
}

function isSourceFile(filePath) {
  return SOURCE_EXTENSIONS.includes(path.extname(filePath));
}

function isTestFile(filePath) {
  return /\.(spec|test)\.(ts|tsx|js|jsx)$/.test(filePath) || filePath.includes('/__tests__/');
}

function pathExists(fileSet, candidate) {
  return fileSet.has(normalizePath(candidate));
}

function tryResolveFile(fileSet, basePath) {
  const candidates = [
    basePath,
    ...SOURCE_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => path.join(basePath, `index${extension}`)),
  ];

  for (const candidate of candidates) {
    const normalized = normalizePath(candidate);
    if (pathExists(fileSet, normalized)) return normalized;
  }

  return null;
}

function resolveWorkspaceImport(fileSet, specifier) {
  if (specifier.startsWith('@consuelo/')) {
    const [, packageAndRest] = specifier.split('@consuelo/');
    const [packageName, ...rest] = packageAndRest.split('/');
    const basePath = rest.length > 0
      ? path.join('packages', packageName, 'src', ...rest)
      : path.join('packages', packageName, 'src', 'index');
    return tryResolveFile(fileSet, basePath);
  }

  const [packageName, ...rest] = specifier.split('/');
  const packageRoot = path.join('packages', packageName);
  if (!Array.from(fileSet).some((filePath) => filePath.startsWith(`${packageRoot}/`))) {
    return null;
  }

  const basePath = rest.length > 0
    ? path.join(packageRoot, 'src', ...rest)
    : path.join(packageRoot, 'src', 'index');

  return tryResolveFile(fileSet, basePath);
}

function readBarrelTargets(repoRoot, fileSet, filePath) {
  if (!path.basename(filePath).startsWith('index.')) return [];

  const absolutePath = path.join(repoRoot, filePath);
  if (!fs.existsSync(absolutePath)) return [];

  const content = fs.readFileSync(absolutePath, 'utf8');
  const targets = [];
  const reExportPattern = /export\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g;
  let match = reExportPattern.exec(content);

  while (match) {
    const target = resolveImport(repoRoot, fileSet, filePath, match[1], false);
    if (target) targets.push(target);
    match = reExportPattern.exec(content);
  }

  return targets.slice(0, 5);
}

function resolveImport(repoRoot, fileSet, sourcePath, specifier, followBarrel = true) {
  if (!specifier || specifier.startsWith('node:')) return null;

  let target = null;
  if (specifier.startsWith('.')) {
    const directory = path.dirname(sourcePath);
    target = tryResolveFile(fileSet, normalizePath(path.join(directory, specifier)));
  } else {
    target = resolveWorkspaceImport(fileSet, specifier);
  }

  if (!target) return null;

  if (followBarrel && path.basename(target).startsWith('index.')) {
    const barrelTargets = readBarrelTargets(repoRoot, fileSet, target);
    return barrelTargets[0] || target;
  }

  return target;
}

function walk(node, callback) {
  callback(node);
  for (const child of node.namedChildren || []) {
    walk(child, callback);
  }
}

function getImportSpecifiers(tree) {
  const specifiers = [];

  walk(tree.rootNode, (node) => {
    if (node.type !== 'import_statement' && node.type !== 'export_statement') return;

    for (const child of node.namedChildren || []) {
      if (child.type === 'string') {
        specifiers.push(child.text.replace(/^['"]|['"]$/g, ''));
      }
    }
  });

  return specifiers;
}

function getCallIdentifiers(tree) {
  const calls = new Set();

  walk(tree.rootNode, (node) => {
    if (node.type !== 'call_expression') return;

    const callee = node.childForFieldName('function') || node.namedChildren?.[0];
    if (!callee) return;

    if (callee.type === 'identifier') {
      calls.add(callee.text);
    } else if (callee.type === 'member_expression') {
      const property = callee.childForFieldName('property');
      if (property?.text) calls.add(property.text);
    }
  });

  return Array.from(calls);
}

function buildExportedSymbols(chunksByFile) {
  const symbols = new Map();

  for (const [filePath, chunks] of chunksByFile.entries()) {
    for (const chunk of chunks) {
      if (!chunk.name) continue;
      if (!['function', 'class', 'method', 'type', 'export'].includes(chunk.type)) continue;

      if (!symbols.has(chunk.name)) {
        symbols.set(chunk.name, new Set());
      }
      symbols.get(chunk.name).add(filePath);
    }
  }

  return symbols;
}

function addEdge(edges, sourcePath, targetPath, edgeType, symbol = null) {
  if (!sourcePath || !targetPath || sourcePath === targetPath) return;
  edges.push({ sourcePath, targetPath, edgeType, symbol });
}

function buildImportEdges(repoRoot, fileSet, fileContents) {
  const edges = [];

  for (const [filePath, content] of fileContents.entries()) {
    if (!isSourceFile(filePath)) continue;

    const parser = getParserForPath(filePath);
    if (!parser) continue;

    try {
      const tree = parser.parse(content);
      for (const specifier of getImportSpecifiers(tree)) {
        const target = resolveImport(repoRoot, fileSet, filePath, specifier);
        if (!target) continue;
        addEdge(edges, filePath, target, 'imports', specifier);
        addEdge(edges, target, filePath, 'imported_by', specifier);
      }
    } catch {
      continue;
    }
  }

  return edges;
}

function buildTestEdges(fileSet) {
  const edges = [];
  const files = Array.from(fileSet).filter(isSourceFile);

  for (const filePath of files) {
    if (!isTestFile(filePath)) continue;

    const candidates = [];
    if (filePath.includes('/__tests__/')) {
      candidates.push(filePath.replace('/__tests__/', '/').replace(/\.(spec|test)(\.[^.]+)$/, '$2'));
    }
    candidates.push(filePath.replace(/\.(spec|test)(\.[^.]+)$/, '$2'));

    for (const candidate of candidates) {
      const target = tryResolveFile(fileSet, withoutExtension(candidate));
      if (!target || target === filePath) continue;
      addEdge(edges, filePath, target, 'tests');
      addEdge(edges, target, filePath, 'tested_by');
    }
  }

  return edges;
}

function buildSiblingEdges(fileSet) {
  const edges = [];
  const byDirectory = new Map();

  for (const filePath of Array.from(fileSet).filter(isSourceFile)) {
    const directory = path.dirname(filePath);
    if (!byDirectory.has(directory)) {
      byDirectory.set(directory, []);
    }
    byDirectory.get(directory).push(filePath);
  }

  for (const files of byDirectory.values()) {
    const sorted = files.sort();
    for (const filePath of sorted) {
      const siblings = sorted.filter((candidate) => candidate !== filePath).slice(0, 3);
      for (const sibling of siblings) {
        addEdge(edges, filePath, sibling, 'sibling');
      }
    }
  }

  return edges;
}

function buildCallEdges(chunksByFile, fileContents) {
  const edges = [];
  const exportedSymbols = buildExportedSymbols(chunksByFile);

  for (const [filePath, content] of fileContents.entries()) {
    if (!isSourceFile(filePath)) continue;

    const parser = getParserForPath(filePath);
    if (!parser) continue;

    try {
      const tree = parser.parse(content);
      for (const callName of getCallIdentifiers(tree)) {
        const targetFiles = exportedSymbols.get(callName);
        if (!targetFiles) continue;

        for (const targetPath of targetFiles) {
          addEdge(edges, filePath, targetPath, 'calls', callName);
          addEdge(edges, targetPath, filePath, 'called_by', callName);
        }
      }
    } catch {
      continue;
    }
  }

  return edges;
}

function buildGraph(repoRoot, filePaths, fileContents, chunksByFile) {
  const fileSet = new Set(filePaths.map(normalizePath));
  return [
    ...buildImportEdges(repoRoot, fileSet, fileContents),
    ...buildTestEdges(fileSet),
    ...buildSiblingEdges(fileSet),
    ...buildCallEdges(chunksByFile, fileContents),
  ];
}

module.exports = {
  buildGraph,
  isSourceFile,
  isTestFile,
  resolveImport,
};
