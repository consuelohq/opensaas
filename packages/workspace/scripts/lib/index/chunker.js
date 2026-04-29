const crypto = require('crypto');
const path = require('path');

// Bun's tree-sitter package path expects bundled prebuilds. The native build
// created by node-gyp-build is valid, so load through that path instead.
const bunVersion = process.versions.bun;
let Parser;
let JavaScript;
let TypeScript;
try {
  process.versions.bun = undefined;
  Parser = require('tree-sitter');
  JavaScript = require('tree-sitter-javascript');
  TypeScript = require('tree-sitter-typescript');
} finally {
  if (bunVersion === undefined) {
    delete process.versions.bun;
  } else {
    process.versions.bun = bunVersion;
  }
}

const MAX_BLOCK_LINES = 150;
const MAX_CHUNK_LINES = 150;
const MAX_CHUNK_CHARS = 4_000;

function contentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getLines(source) {
  return source.split('\n');
}

function getNodeContent(sourceLines, node) {
  const startLine = node.startPosition.row + 1;
  const endLine = node.endPosition.row + 1;
  return sourceLines.slice(startLine - 1, endLine).join('\n');
}

function getNodeName(node) {
  const nameNode = node.childForFieldName('name');
  if (nameNode) return nameNode.text;

  for (const child of node.namedChildren || []) {
    if (child.type === 'property_identifier' || child.type === 'identifier' || child.type === 'type_identifier') {
      return child.text;
    }
  }

  return null;
}

function createChunk(sourceLines, node, type, name) {
  const startLine = node.startPosition.row + 1;
  const endLine = node.endPosition.row + 1;
  const content = getNodeContent(sourceLines, node);

  return {
    type,
    name: name || getNodeName(node),
    startLine,
    endLine,
    content,
    contentHash: contentHash(content),
  };
}

function createLineChunk(sourceLines, startLine, endLine, type, name) {
  const content = sourceLines.slice(startLine - 1, endLine).join('\n').trim();

  return {
    type,
    name,
    startLine,
    endLine,
    content,
    contentHash: contentHash(content),
  };
}

function splitLineRange(sourceLines, startLine, endLine, type, name) {
  const chunks = [];
  let part = 1;

  for (let line = startLine; line <= endLine; line += MAX_BLOCK_LINES) {
    const chunkEndLine = Math.min(endLine, line + MAX_BLOCK_LINES - 1);
    const chunk = createLineChunk(
      sourceLines,
      line,
      chunkEndLine,
      type,
      endLine - startLine + 1 > MAX_BLOCK_LINES && name ? `${name} part ${part}` : name,
    );

    if (chunk.content) {
      if (chunk.content.length > MAX_CHUNK_CHARS) {
        chunks.push(...splitLiteralContent(chunk.content, type, chunk.name, chunk.startLine));
      } else {
        chunks.push(chunk);
      }
      part += 1;
    }
  }

  return chunks;
}

function splitLiteralContent(content, type, name, startLine = 1) {
  const lines = content.split('\n');
  const chunks = [];
  let part = 1;

  if (lines.length === 1 && content.length > MAX_CHUNK_CHARS) {
    for (let index = 0; index < content.length; index += MAX_CHUNK_CHARS) {
      const chunkContent = content.slice(index, index + MAX_CHUNK_CHARS).trim();
      if (!chunkContent) continue;

      chunks.push({
        type,
        name: name ? `${name} part ${part}` : null,
        startLine,
        endLine: startLine,
        content: chunkContent,
        contentHash: contentHash(chunkContent),
      });
      part += 1;
    }

    return chunks;
  }

  let index = 0;
  while (index < lines.length) {
    const chunkLines = [];
    let charCount = 0;
    const chunkStartIndex = index;

    while (index < lines.length && chunkLines.length < MAX_BLOCK_LINES) {
      const nextLine = lines[index];
      if (chunkLines.length === 0 && nextLine.length > MAX_CHUNK_CHARS) break;
      if (chunkLines.length > 0 && charCount + nextLine.length + 1 > MAX_CHUNK_CHARS) break;

      chunkLines.push(nextLine);
      charCount += nextLine.length + 1;
      index += 1;
    }

    if (chunkLines.length === 0) {
      const longLine = lines[index] || '';
      const chunkContent = longLine.slice(0, MAX_CHUNK_CHARS).trim();
      lines[index] = longLine.slice(MAX_CHUNK_CHARS);
      if (!lines[index]) index += 1;

      if (chunkContent) {
        chunks.push({
          type,
          name: name ? `${name} part ${part}` : null,
          startLine: startLine + chunkStartIndex,
          endLine: startLine + chunkStartIndex,
          content: chunkContent,
          contentHash: contentHash(chunkContent),
        });
        part += 1;
      }
      continue;
    }

    const chunkContent = chunkLines.join('\n').trim();
    if (!chunkContent) continue;

    chunks.push({
      type,
      name: lines.length > MAX_BLOCK_LINES && name ? `${name} part ${part}` : name,
      startLine: startLine + chunkStartIndex,
      endLine: startLine + index - 1,
      content: chunkContent,
      contentHash: contentHash(chunkContent),
    });
    part += 1;
  }

  return chunks;
}

function splitOversizedChunk(sourceLines, chunk) {
  const lineCount = chunk.endLine - chunk.startLine + 1;
  if (lineCount <= MAX_CHUNK_LINES && chunk.content.length <= MAX_CHUNK_CHARS) {
    return [chunk];
  }

  if (lineCount <= 1) {
    return splitLiteralContent(chunk.content, chunk.type, chunk.name, chunk.startLine);
  }

  return splitLineRange(sourceLines, chunk.startLine, chunk.endLine, chunk.type, chunk.name);
}

function createChunksForNode(sourceLines, node, type, name) {
  return splitOversizedChunk(sourceLines, createChunk(sourceLines, node, type, name));
}

function createClassShellChunk(sourceLines, node, name) {
  const body = node.childForFieldName('body');
  const startLine = node.startPosition.row + 1;
  const endLine = body ? body.startPosition.row + 1 : startLine;

  return createLineChunk(sourceLines, startLine, endLine, 'class', name || getNodeName(node));
}

function getParserForPath(filePath) {
  const extension = path.extname(filePath);
  const parser = new Parser();

  if (extension === '.ts') {
    parser.setLanguage(TypeScript.typescript);
    return parser;
  }

  if (extension === '.tsx') {
    parser.setLanguage(TypeScript.tsx);
    return parser;
  }

  if (extension === '.js' || extension === '.jsx') {
    parser.setLanguage(JavaScript);
    return parser;
  }

  return null;
}

function addCoveredLines(coveredLines, chunk) {
  for (let line = chunk.startLine; line <= chunk.endLine; line += 1) {
    coveredLines.add(line);
  }
}

function groupImportChunks(sourceLines, children) {
  const importNodes = children.filter((node) => node.type === 'import_statement');
  if (importNodes.length === 0) return [];

  const first = importNodes[0];
  const last = importNodes[importNodes.length - 1];
  const startLine = first.startPosition.row + 1;
  const endLine = last.endPosition.row + 1;
  const content = sourceLines.slice(startLine - 1, endLine).join('\n');

  return splitOversizedChunk(sourceLines, {
    type: 'import',
    name: 'imports',
    startLine,
    endLine,
    content,
    contentHash: contentHash(content),
  });
}

function addClassChunks(chunks, sourceLines, node) {
  chunks.push(createClassShellChunk(sourceLines, node));

  const body = node.childForFieldName('body');
  for (const member of body?.namedChildren || []) {
    if (member.type === 'method_definition' || member.type === 'public_field_definition') {
      chunks.push(...createChunksForNode(sourceLines, member, 'method'));
    }
  }
}

function addTopLevelNodeChunks(chunks, sourceLines, node) {
  if (node.type === 'function_declaration' || node.type === 'generator_function_declaration') {
    chunks.push(...createChunksForNode(sourceLines, node, 'function'));
    return true;
  }

  if (node.type === 'class_declaration') {
    addClassChunks(chunks, sourceLines, node);
    return true;
  }

  if (node.type === 'type_alias_declaration' || node.type === 'interface_declaration') {
    chunks.push(...createChunksForNode(sourceLines, node, 'type'));
    return true;
  }

  if (node.type === 'export_statement') {
    const declaration = node.childForFieldName('declaration');
    if (declaration) {
      if (declaration.type === 'class_declaration') {
        addClassChunks(chunks, sourceLines, declaration);
        return true;
      }

      if (declaration.type === 'function_declaration' || declaration.type === 'generator_function_declaration') {
        chunks.push(...createChunksForNode(sourceLines, declaration, 'function'));
        return true;
      }

      if (declaration.type === 'type_alias_declaration' || declaration.type === 'interface_declaration') {
        chunks.push(...createChunksForNode(sourceLines, declaration, 'type'));
        return true;
      }
    }

    chunks.push(...createChunksForNode(
      sourceLines,
      node,
      'export',
      declaration ? getNodeName(declaration) : getNodeName(node),
    ));
    return true;
  }

  return false;
}

function chunkTreeSitterFile(filePath, source) {
  const parser = getParserForPath(filePath);
  if (!parser) return [];

  const sourceLines = getLines(source);
  const tree = parser.parse(source);
  const chunks = [];
  const coveredLines = new Set();
  const children = tree.rootNode.namedChildren || [];

  for (const chunk of groupImportChunks(sourceLines, children)) {
    chunks.push(chunk);
    addCoveredLines(coveredLines, chunk);
  }

  for (const node of children) {
    if (node.type === 'import_statement') continue;

    if (addTopLevelNodeChunks(chunks, sourceLines, node)) {
      addCoveredLines(coveredLines, {
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
      });
    }
  }

  let blockStart = null;
  for (let index = 1; index <= sourceLines.length; index += 1) {
    const isCovered = coveredLines.has(index);
    const isEmpty = sourceLines[index - 1].trim() === '';

    if (!isCovered && !isEmpty && blockStart === null) {
      blockStart = index;
    }

    const blockLength = blockStart === null ? 0 : index - blockStart + 1;
    if (blockStart !== null && (isCovered || blockLength >= MAX_BLOCK_LINES || index === sourceLines.length)) {
      const blockEnd = isCovered ? index - 1 : index;
      if (blockEnd >= blockStart) {
        const content = sourceLines.slice(blockStart - 1, blockEnd).join('\n').trim();
        if (content) {
          chunks.push(...splitOversizedChunk(sourceLines, {
            type: 'block',
            name: null,
            startLine: blockStart,
            endLine: blockEnd,
            content,
            contentHash: contentHash(content),
          }));
        }
      }
      blockStart = null;
    }
  }

  return chunks.sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine);
}

function chunkMarkdown(source) {
  const lines = getLines(source);
  const headings = [];

  lines.forEach((line, index) => {
    if (/^#{1,6}\s+/.test(line)) {
      headings.push({ line: index + 1, title: line.replace(/^#{1,6}\s+/, '').trim() });
    }
  });

  if (headings.length === 0) {
    return [{
      type: 'block',
      name: null,
      startLine: 1,
      endLine: lines.length,
      content: source,
      contentHash: contentHash(source),
    }];
  }

  return headings.flatMap((heading, index) => {
    const nextHeading = headings[index + 1];
    const startLine = heading.line;
    const endLine = nextHeading ? nextHeading.line - 1 : lines.length;
    const content = lines.slice(startLine - 1, endLine).join('\n');

    return splitOversizedChunk(lines, {
      type: 'block',
      name: heading.title,
      startLine,
      endLine,
      content,
      contentHash: contentHash(content),
    });
  });
}

function chunkJson(source) {
  try {
    const parsed = JSON.parse(source);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('not an object');
    }

    return Object.keys(parsed).flatMap((key, index) => {
      const content = JSON.stringify({ [key]: parsed[key] }, null, 2);
      const lines = content.split('\n');

      return splitOversizedChunk(lines, {
        type: 'block',
        name: key,
        startLine: 1,
        endLine: lines.length,
        content,
        contentHash: contentHash(`${index}:${content}`),
      });
    });
  } catch {
    return splitOversizedChunk(source.split('\n'), {
      type: 'block',
      name: null,
      startLine: 1,
      endLine: source.split('\n').length,
      content: source,
      contentHash: contentHash(source),
    });
  }
}

function chunkFile(filePath, source) {
  const extension = path.extname(filePath);

  if (extension === '.md') return chunkMarkdown(source);
  if (extension === '.json') return chunkJson(source);

  return chunkTreeSitterFile(filePath, source);
}

module.exports = {
  chunkFile,
  contentHash,
  getParserForPath,
};
