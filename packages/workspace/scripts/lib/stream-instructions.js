const fs = require('fs');
const path = require('path');

function streamInstructionPath(area) {
  return path.resolve(__dirname, '..', '..', 'streams', area, 'AGENTS.md');
}

function readStreamInstructions(area) {
  const filePath = streamInstructionPath(area);
  if (!fs.existsSync(filePath)) {
    return { exists: false, path: filePath, content: '' };
  }
  return {
    exists: true,
    path: filePath,
    content: fs.readFileSync(filePath, 'utf8'),
  };
}

module.exports = { readStreamInstructions, streamInstructionPath };
