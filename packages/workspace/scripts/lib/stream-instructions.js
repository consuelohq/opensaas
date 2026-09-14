const fs = require('fs');
const path = require('path');

function streamInstructionPath(area) {
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const areaPath = path.join(repoRoot, 'areas', area, 'AGENTS.md');
  if (fs.existsSync(areaPath)) return areaPath;
  return path.resolve(__dirname, '..', '..', '..', 'os', 'streams', area, 'AGENTS.md');
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
