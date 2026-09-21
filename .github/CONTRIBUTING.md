# Contributing to Consuelo

Thanks for contributing to Consuelo.

## Before changing code

Read the repository guidance in `AGENTS.md`, then follow the task and review
workflow documented under `packages/workspace` and `packages/os`. Use the
managed Consuelo workspace/task flow for repository changes rather than creating
ad-hoc worktrees or force-pushing shared branches.

## Local setup

Install the root workspace with the Bun version pinned by `package.json`:

```bash
bun install --frozen-lockfile
```

Root dependency installation and repository scripts use Bun.

## Pull requests

Keep changes scoped, add regression coverage for behavior changes, run the focused
tests first, then the repository review/verify gates. Do not merge stale checks from
an older SHA as evidence for a newer commit.

Preserve package-level and third-party license notices. New dependencies or vendored
code must keep their applicable license and attribution.

## Security issues

Do not report vulnerabilities in a public issue. Follow `.github/SECURITY.md`.
