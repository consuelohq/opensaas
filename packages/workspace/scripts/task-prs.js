#!/usr/bin/env bun

// task-prs.js — show task PR + review PR links for the current task
// reads .task/current.json and queries github for the review PR

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function writeStdout(s = '') { process.stdout.write(s + '\n'); }
function writeStderr(s = '') { process.stderr.write(s + '\n'); }

function findTaskMeta() {
  const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  let dir = process.cwd();
  while (dir !== '/') {
    const p = path.join(dir, '.task', 'current.json');
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (data.taskBranch && currentBranch && data.taskBranch !== currentBranch) return null;
      return data;
    }
    dir = path.dirname(dir);
  }
  return null;
}

function gh(args) {
  try {
    return execSync(`gh ${args}`, { encoding: 'utf8', timeout: 10000 }).trim();
  } catch { return null; }
}

function main() {
  const json = process.argv.includes('--json');
  const meta = findTaskMeta();

  if (!meta) {
    writeStderr('no .task/current.json found — run from a task worktree or repo root');
    process.exit(1);
  }

  const result = {
    area: meta.area,
    taskBranch: meta.taskBranch,
    stream: meta.stream,
    taskPr: { number: meta.prNumber, url: meta.prUrl },
    reviewPr: null,
  };

  // find review PR: stream/* -> main
  if (meta.stream) {
    const prJson = gh(`pr list --repo consuelohq/opensaas --head ${meta.stream} --base main --json number,url,title,state,isDraft --limit 1`);
    if (prJson) {
      try {
        const prs = JSON.parse(prJson);
        if (prs.length > 0) {
          result.reviewPr = {
            number: prs[0].number,
            url: prs[0].url,
            title: prs[0].title,
            state: prs[0].state,
            draft: prs[0].isDraft,
          };
        }
      } catch {}
    }
  }

  if (json) {
    writeStdout(JSON.stringify(result, null, 2));
    return;
  }

  writeStdout(`area: ${result.area}`);
  writeStdout(`branch: ${result.taskBranch}`);
  writeStdout(`stream: ${result.stream}`);
  writeStdout('');
  writeStdout(`task pr:   #${result.taskPr.number} ${result.taskPr.url}`);
  if (result.reviewPr) {
    const draft = result.reviewPr.draft ? ' (draft)' : '';
    writeStdout(`review pr: #${result.reviewPr.number} ${result.reviewPr.url}${draft}`);
  } else {
    writeStdout('review pr: none (run task:pr to create)');
  }
}

main();
