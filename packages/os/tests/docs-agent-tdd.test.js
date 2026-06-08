#!/usr/bin/env node
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const doc = readFileSync('packages/os/docs/test-driven-agent-work.md', 'utf8');
const docLower = doc.toLowerCase();

const requiredPhrases = [
  '# Test-Driven Agent Work',
  'user intent',
  'compaction',
  'handoffs',
  'Intent assertion',
  'Red',
  'Green',
  'Yellow / Amber',
  'Acceptance test',
  'Specification by example',
  'Living documentation',
  'Workpad contract',
  'Agent TDD loop',
  'Capture intent',
  'Write red checks',
  'Make it green',
  'Refactor safely',
  'Record evidence',
  'surviving compaction',
  'Office artifacts',
  '--base-version',
  'TDD is how agents preserve intent'
];

for (const phrase of requiredPhrases) {
  assert.ok(doc.includes(phrase) || docLower.includes(phrase.toLowerCase()), `missing required phrase: ${phrase}`);
}

const statusHeadings = ['### Red', '### Green', '### Yellow / Amber'];
for (const heading of statusHeadings) {
  assert.ok(doc.includes(heading), `missing status heading: ${heading}`);
}

const workpadSections = [
  '## User intent assertions',
  '## Red checks',
  '## Green checks',
  '## Yellow / Amber checks',
  '## Files changed',
  '## Validation commands',
  '## Handoff notes'
];
for (const section of workpadSections) {
  assert.ok(doc.includes(section), `missing workpad section: ${section}`);
}

assert.ok(/If the user says something important, turn it into a durable assertion/.test(doc));
assert.ok(/The workpad is not a diary\. It is the executable memory of the task\./.test(doc));

process.stdout.write('docs-agent-tdd assertions passed\n');
