function functionWindow(lines, startIndex, maxLines = 30) {
  const endIndex = Math.min(startIndex + maxLines, lines.length);
  const selected = [];
  let bodyDepth = 0;
  let bodyOpened = false;
  let parenDepth = 0;
  let bracketDepth = 0;
  let quote = null;
  let escaped = false;
  let blockComment = false;

  for (let lineIndex = startIndex; lineIndex < endIndex; lineIndex += 1) {
    const line = lines[lineIndex];
    selected.push(line);
    let lineComment = false;

    for (let charIndex = 0; charIndex < line.length; charIndex += 1) {
      const char = line[charIndex];
      const next = line[charIndex + 1];

      if (lineComment) break;
      if (blockComment) {
        if (char === '*' && next === '/') {
          blockComment = false;
          charIndex += 1;
        }
        continue;
      }
      if (quote) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === '\\') {
          escaped = true;
          continue;
        }
        if (char === quote) quote = null;
        continue;
      }
      if (char === '/' && next === '/') {
        lineComment = true;
        break;
      }
      if (char === '/' && next === '*') {
        blockComment = true;
        charIndex += 1;
        continue;
      }
      if (char === "'" || char === '"' || char === '`') {
        quote = char;
        continue;
      }

      if (!bodyOpened) {
        if (char === '(') parenDepth += 1;
        else if (char === ')' && parenDepth > 0) parenDepth -= 1;
        else if (char === '[') bracketDepth += 1;
        else if (char === ']' && bracketDepth > 0) bracketDepth -= 1;
        else if (char === '{' && parenDepth === 0 && bracketDepth === 0) {
          bodyOpened = true;
          bodyDepth = 1;
        }
        continue;
      }

      if (char === '{') bodyDepth += 1;
      else if (char === '}') {
        bodyDepth -= 1;
        if (bodyDepth === 0) return selected.join('\n');
      }
    }
  }

  return selected.join('\n');
}

function codeOutsideStringsAndComments(line) {
  let result = '';
  let quote = null;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      result += ' ';
      continue;
    }

    if (char === '/' && next === '/') break;
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      result += ' ';
      continue;
    }
    result += char;
  }

  return result;
}

function isAsyncFunctionDeclaration(line) {
  const code = codeOutsideStringsAndComments(line);
  return /\basync\s+function\s+\w+\s*\(/.test(code)
    || /^\s*async\s+\w+\s*\(/.test(code)
    || /\basync\s*(?:\([^)]*\)|\w+)\s*=>/.test(code);
}

function findUnhandledAsyncAwaitLines(lines) {
  const findings = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!isAsyncFunctionDeclaration(lines[index])) continue;
    const window = functionWindow(lines, index);
    if (/await\s/.test(window) && !/try\s*\{/.test(window) && !/\.catch\s*\(/.test(window)) {
      findings.push(index + 1);
    }
  }
  return findings;
}

module.exports = {
  codeOutsideStringsAndComments,
  findUnhandledAsyncAwaitLines,
  functionWindow,
  isAsyncFunctionDeclaration,
};
