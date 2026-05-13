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

function withChunkMetadata(chunk, metadata = {}) {
  return {
    ...chunk,
    nodeType: metadata.nodeType || chunk.nodeType || null,
    parentName: metadata.parentName || chunk.parentName || null,
    symbolPath: metadata.symbolPath || chunk.symbolPath || chunk.name || null,
  };
}

function createChunk(sourceLines, node, type, name, metadata = {}) {
  const startLine = node.startPosition.row + 1;
  const endLine = node.endPosition.row + 1;
  const content = getNodeContent(sourceLines, node);
  const resolvedName = name || getNodeName(node);

  return withChunkMetadata({
    type,
    name: resolvedName,
    startLine,
    endLine,
    content,
    contentHash: contentHash(content),
  }, { nodeType: node.type, symbolPath: resolvedName, ...metadata });
}

function createLineChunk(sourceLines, startLine, endLine, type, name, metadata = {}) {
  const content = sourceLines.slice(startLine - 1, endLine).join('\n').trim();

  return withChunkMetadata({
    type,
    name,
    startLine,
    endLine,
    content,
    contentHash: contentHash(content),
  }, metadata);
}

function splitLineRange(sourceLines, startLine, endLine, type, name, metadata = {}) {
  const chunks = [];
  let part = 1;

  for (let line = startLine; line <= endLine; line += MAX_BLOCK_LINES) {
    const chunkEndLine = Math.min(endLine, line + MAX_BLOCK_LINES - 1);
    const chunkName = endLine - startLine + 1 > MAX_BLOCK_LINES && name ? `${name} part ${part}` : name;
    const chunk = createLineChunk(
      sourceLines,
      line,
      chunkEndLine,
      type,
      chunkName,
      {
        ...metadata,
        symbolPath: metadata.symbolPath && chunkName === name ? metadata.symbolPath : chunkName,
      },
    );

    if (chunk.content) {
      if (chunk.content.length > MAX_CHUNK_CHARS) {
        chunks.push(...splitLiteralContent(chunk.content, type, chunk.name, chunk.startLine, chunk));
      } else {
        chunks.push(chunk);
      }
      part += 1;
    }
  }

  return chunks;
}

function splitLiteralContent(content, type, name, startLine = 1, metadata = {}) {
  const lines = content.split('\n');
  const chunks = [];
  let part = 1;

  if (lines.length === 1 && content.length > MAX_CHUNK_CHARS) {
    for (let index = 0; index < content.length; index += MAX_CHUNK_CHARS) {
      const chunkContent = content.slice(index, index + MAX_CHUNK_CHARS).trim();
      if (!chunkContent) continue;

      const chunkName = name ? `${name} part ${part}` : null;
      chunks.push(withChunkMetadata({
        type,
        name: chunkName,
        startLine,
        endLine: startLine,
        content: chunkContent,
        contentHash: contentHash(chunkContent),
      }, {
        ...metadata,
        symbolPath: metadata.symbolPath && chunkName === name ? metadata.symbolPath : chunkName,
      }));
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
        const chunkName = name ? `${name} part ${part}` : null;
        chunks.push(withChunkMetadata({
          type,
          name: chunkName,
          startLine: startLine + chunkStartIndex,
          endLine: startLine + chunkStartIndex,
          content: chunkContent,
          contentHash: contentHash(chunkContent),
        }, {
          ...metadata,
          symbolPath: metadata.symbolPath && chunkName === name ? metadata.symbolPath : chunkName,
        }));
        part += 1;
      }
      continue;
    }

    const chunkContent = chunkLines.join('\n').trim();
    if (!chunkContent) continue;

    const chunkName = lines.length > MAX_BLOCK_LINES && name ? `${name} part ${part}` : name;
    chunks.push(withChunkMetadata({
      type,
      name: chunkName,
      startLine: startLine + chunkStartIndex,
      endLine: startLine + index - 1,
      content: chunkContent,
      contentHash: contentHash(chunkContent),
    }, {
      ...metadata,
      symbolPath: metadata.symbolPath && chunkName === name ? metadata.symbolPath : chunkName,
    }));
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
    return splitLiteralContent(chunk.content, chunk.type, chunk.name, chunk.startLine, chunk);
  }

  return splitLineRange(sourceLines, chunk.startLine, chunk.endLine, chunk.type, chunk.name, chunk);
}

function createChunksForNode(sourceLines, node, type, name, metadata = {}) {
  return splitOversizedChunk(sourceLines, createChunk(sourceLines, node, type, name, metadata));
}

function createClassShellChunk(sourceLines, node, name) {
  const body = node.childForFieldName('body');
  const startLine = node.startPosition.row + 1;
  const endLine = body ? body.startPosition.row + 1 : startLine;
  const className = name || getNodeName(node);

  return createLineChunk(sourceLines, startLine, endLine, 'class', className, {
    nodeType: node.type,
    symbolPath: className,
  });
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

  return splitOversizedChunk(sourceLines, withChunkMetadata({
    type: 'import',
    name: 'imports',
    startLine,
    endLine,
    content,
    contentHash: contentHash(content),
  }, { nodeType: 'import_statement', symbolPath: 'imports' }));
}

function getPropertyName(node) {
  const key = node.childForFieldName('key');
  if (key) return key.text.replace(/^['\"]|['\"]$/g, '');

  return getNodeName(node);
}

function joinSymbolPath(parentName, name) {
  if (!parentName) return name || null;
  if (!name) return parentName;
  return `${parentName}.${name}`;
}

function isFunctionLikeNode(node) {
  return [
    'arrow_function',
    'function',
    'function_expression',
    'generator_function',
  ].includes(node?.type);
}

function getDeclaratorValue(node) {
  return node.childForFieldName('value');
}

function getFunctionDeclarators(node) {
  if (node.type !== 'lexical_declaration' && node.type !== 'variable_declaration') return [];

  return (node.namedChildren || []).filter((child) => {
    const value = getDeclaratorValue(child);
    return child.type === 'variable_declarator' && isFunctionLikeNode(value);
  });
}

function getObjectDeclarators(node) {
  if (node.type !== 'lexical_declaration' && node.type !== 'variable_declaration') return [];

  return (node.namedChildren || []).filter((child) => {
    const value = getDeclaratorValue(child);
    return child.type === 'variable_declarator' && value?.type === 'object';
  });
}

function addFunctionDeclaratorChunks(chunks, sourceLines, node) {
  const declarators = getFunctionDeclarators(node);
  for (const declarator of declarators) {
    const name = getNodeName(declarator);
    const value = getDeclaratorValue(declarator);
    chunks.push(...createChunksForNode(sourceLines, declarator, 'function', name, {
      nodeType: value?.type || declarator.type,
      symbolPath: name,
    }));
  }

  return declarators.length > 0;
}

function addObjectMemberChunks(chunks, sourceLines, objectNode, parentName) {
  let added = false;

  for (const member of objectNode.namedChildren || []) {
    if (member.type === 'pair') {
      const name = getPropertyName(member);
      const value = member.childForFieldName('value');
      const symbolPath = joinSymbolPath(parentName, name);

      if (isFunctionLikeNode(value)) {
        chunks.push(...createChunksForNode(sourceLines, member, 'method', name, {
          nodeType: value.type,
          parentName,
          symbolPath,
        }));
        added = true;
        continue;
      }

      if (value?.type === 'object') {
        added = addObjectMemberChunks(chunks, sourceLines, value, symbolPath) || added;
      }
      continue;
    }

    if (member.type === 'method_definition') {
      const name = getNodeName(member);
      chunks.push(...createChunksForNode(sourceLines, member, 'method', name, {
        nodeType: member.type,
        parentName,
        symbolPath: joinSymbolPath(parentName, name),
      }));
      added = true;
    }
  }

  return added;
}

function addObjectDeclaratorChunks(chunks, sourceLines, node) {
  let added = false;

  for (const declarator of getObjectDeclarators(node)) {
    const name = getNodeName(declarator);
    const objectNode = getDeclaratorValue(declarator);
    const addedMembers = addObjectMemberChunks(chunks, sourceLines, objectNode, name);
    if (addedMembers) {
      chunks.push(...createChunksForNode(sourceLines, declarator, 'block', name, {
        nodeType: objectNode.type,
        symbolPath: name,
      }));
      added = true;
    }
  }

  return added;
}

function getCallName(node) {
  const expression = node.namedChildren?.[0];
  return expression?.type === 'identifier' ? expression.text : null;
}

function getFirstStringArgument(callNode) {
  const args = callNode.childForFieldName('arguments');
  const stringNode = (args?.namedChildren || []).find((child) => child.type === 'string');
  const fragment = (stringNode?.namedChildren || []).find((child) => child.type === 'string_fragment');
  return fragment?.text || null;
}

function addTestCallChunk(chunks, sourceLines, node) {
  if (node.type !== 'expression_statement') return false;

  const callNode = node.namedChildren?.[0];
  const callName = callNode?.type === 'call_expression' ? getCallName(callNode) : null;
  if (!['describe', 'it', 'test'].includes(callName)) return false;

  const testName = getFirstStringArgument(callNode);
  const name = testName ? `${callName}: ${testName}` : callName;
  chunks.push(...createChunksForNode(sourceLines, node, 'test', name, {
    nodeType: callNode.type,
    symbolPath: name,
  }));
  return true;
}

function addClassChunks(chunks, sourceLines, node) {
  const className = getNodeName(node);
  chunks.push(createClassShellChunk(sourceLines, node, className));

  const body = node.childForFieldName('body');
  for (const member of body?.namedChildren || []) {
    if (member.type === 'method_definition' || member.type === 'public_field_definition') {
      const name = getNodeName(member);
      chunks.push(...createChunksForNode(sourceLines, member, 'method', name, {
        nodeType: member.type,
        parentName: className,
        symbolPath: joinSymbolPath(className, name),
      }));
    }
  }
}

function addDeclarationChunks(chunks, sourceLines, declaration) {
  if (declaration.type === 'class_declaration') {
    addClassChunks(chunks, sourceLines, declaration);
    return true;
  }

  if (declaration.type === 'function_declaration' || declaration.type === 'generator_function_declaration') {
    const name = getNodeName(declaration);
    chunks.push(...createChunksForNode(sourceLines, declaration, 'function', name, {
      nodeType: declaration.type,
      symbolPath: name,
    }));
    return true;
  }

  if (declaration.type === 'type_alias_declaration' || declaration.type === 'interface_declaration') {
    const name = getNodeName(declaration);
    chunks.push(...createChunksForNode(sourceLines, declaration, 'type', name, {
      nodeType: declaration.type,
      symbolPath: name,
    }));
    return true;
  }

  return false;
}

function addTopLevelNodeChunks(chunks, sourceLines, node) {
  if (addDeclarationChunks(chunks, sourceLines, node)) return true;

  if (addFunctionDeclaratorChunks(chunks, sourceLines, node)) return true;

  if (addObjectDeclaratorChunks(chunks, sourceLines, node)) return true;

  if (addTestCallChunk(chunks, sourceLines, node)) return true;

  if (node.type === 'export_statement') {
    const declaration = node.childForFieldName('declaration');
    if (declaration && addDeclarationChunks(chunks, sourceLines, declaration)) return true;

    if (declaration && addFunctionDeclaratorChunks(chunks, sourceLines, declaration)) return true;

    if (declaration && addObjectDeclaratorChunks(chunks, sourceLines, declaration)) return true;

    chunks.push(...createChunksForNode(
      sourceLines,
      node,
      'export',
      declaration ? getNodeName(declaration) : getNodeName(node),
      { nodeType: node.type },
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
          chunks.push(...splitOversizedChunk(sourceLines, withChunkMetadata({
            type: 'block',
            name: null,
            startLine: blockStart,
            endLine: blockEnd,
            content,
            contentHash: contentHash(content),
          }, { nodeType: 'block' })));
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
    return [withChunkMetadata({
      type: 'block',
      name: null,
      startLine: 1,
      endLine: lines.length,
      content: source,
      contentHash: contentHash(source),
    }, { nodeType: 'markdown' })];
  }

  return headings.flatMap((heading, index) => {
    const nextHeading = headings[index + 1];
    const startLine = heading.line;
    const endLine = nextHeading ? nextHeading.line - 1 : lines.length;
    const content = lines.slice(startLine - 1, endLine).join('\n');

    return splitOversizedChunk(lines, withChunkMetadata({
      type: 'block',
      name: heading.title,
      startLine,
      endLine,
      content,
      contentHash: contentHash(content),
    }, { nodeType: 'markdown_heading', symbolPath: heading.title }));
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

      return splitOversizedChunk(lines, withChunkMetadata({
        type: 'block',
        name: key,
        startLine: 1,
        endLine: lines.length,
        content,
        contentHash: contentHash(`${index}:${content}`),
      }, { nodeType: 'json_property', symbolPath: key }));
    });
  } catch {
    return splitOversizedChunk(source.split('\n'), withChunkMetadata({
      type: 'block',
      name: null,
      startLine: 1,
      endLine: source.split('\n').length,
      content: source,
      contentHash: contentHash(source),
    }, { nodeType: 'json' }));
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
