# MCP-backed second brain + sandboxed coding agent platform

## Summary

We want to build a customizable agent platform that turns ChatGPT into a high-context research and coding operator for our workflow.

The core idea is:

- a **second brain** backed by a database
- a **thin steering layer** loaded at the beginning of each chat
- a **sandbox execution environment** for code, bash, tests, and git operations
- an **MCP layer** that exposes the brain, tools, and sandbox to ChatGPT
- connectors for systems like **GitHub**, **Linear**, and later internal/external APIs

This should let us move from chat assistant to a much more useful research + coding + execution agent while keeping the system customizable for our use case.

---

## Problem

Right now we have partial pieces:

- ChatGPT has strong reasoning and chat UX
- GitHub access is available
- Linear access exists but is not yet write-capable here
- coding-agent style workflows are possible in other tools
- our memories, skills, API keys, and operational context are scattered

What is missing is a unified system that gives the model:

1. durable context
2. retrievable memory
3. reusable skills
4. secure access to tools and secrets
5. a real execution environment
6. approval-aware write actions

---

## Vision

Create a platform where ChatGPT can:

- understand who we are, how we work, and what matters
- search a second brain for memories, docs, commands, and skills
- use a sandbox like a coding agent
- interact with GitHub and later Linear end-to-end
- execute research, coding, and workflow tasks with real context
- operate through a stable MCP interface instead of relying only on ad hoc prompts

This should feel like a personalized agent harness with:

- system prompt
- steering files
- memory
- tools
- skills
- execution runtime

---

## High-level architecture

### 1. Data plane: second brain

Use a backend like Supabase/Postgres as the durable source of truth for:

- memories
- documents
- chunks / embeddings
- skills
- commands
- tool registry
- source registry
- artifacts
- job history
- secret aliases

Important distinction:

- **model-readable brain** stores context, procedures, docs, and metadata
- **raw secrets** should not be stored in prompt-injected content

### 2. Steering layer

Create a `BRAIN.md` file that acts as a durable operator manual loaded at the start of chat.

This file should define:

- what the second brain is
- available tools and commands
- source-of-truth hierarchy
- memory rules
- coding workflow conventions
- approval rules for write actions
- what to store vs what to retrieve on demand

This can be long, but it should behave like a **constitution + map + handbook**, not a dumping ground for all state.

### 3. Tool plane

Expose brain + integrations through MCP tools such as:

- `brain.search`
- `brain.remember`
- `brain.get_memory`
- `brain.list_skills`
- `brain.get_skill`
- `brain.search_docs`
- `brain.list_commands`
- `brain.run_command`
- `github.search_code`
- `github.read_context`
- `linear.create_issue`
- `linear.update_issue`
- `sandbox.create`
- `sandbox.exec`
- `sandbox.read_file`
- `sandbox.write_file`
- `sandbox.git_status`
- `sandbox.git_commit`
- `sandbox.git_push`
- `jobs.get_status`
- `artifacts.get`

### 4. Execution plane

Use a sandbox runtime such as Daytona or Cloudflare Containers for:

- repo checkout
- file tree operations
- bash commands
- npm / bun / python / tests
- git workflows
- indexing tasks
- coding-agent style execution

This is what gives the system hands.

### 5. Control plane

Build a thin app/admin surface for:

- managing skills
- approving memories
- mapping secret aliases
- reviewing tool runs
- monitoring job execution
- debugging retrieval quality
- approving write actions when needed

---

## Key design principles

### A. Prompt is not the whole product

The system prompt and steering files matter a lot, but they should not carry all state.

Use:

- prompt files for policy, routing, and conventions
- database for durable knowledge
- sandbox for execution
- MCP as the bridge

### B. Treat the steering file as a control tower

`BRAIN.md` should be rich and opinionated, but not the entire warehouse.

Good for:

- operating principles
- workflow rules
- tool routing
- memory policies
- coding conventions
- approval rules

Bad for:

- raw API keys
- giant copied docs
- constantly changing project state
- large raw code dumps

### C. Expose capabilities, not secrets

The model should use aliases like:

- `stripe_prod`
- `github_bot`
- `anthropic_eval`
- `openai_research_key`

The backend resolves those aliases securely server-side.

### D. Start with approved actions before autonomy

Begin with:

- read
- search
- summarize
- draft
- propose changes
- execute with approval

Only later expand to more autonomous workflows.

---

## Proposed MVP

### MVP goal

Make ChatGPT effective as a high-context research and coding operator with memory + sandbox + GitHub.

### MVP scope

- database-backed second brain
- `BRAIN.md`
- MCP server
- sandbox runtime
- GitHub integration
- issue drafting workflow
- memory save/retrieve
- skill registry
- command registry

### MVP user flows

#### 1. Research flow

User asks a question about a system or project.

Agent:

- searches memory/docs
- reads GitHub for context
- summarizes findings
- drafts a plan or issue

#### 2. Coding flow

User asks for implementation work.

Agent:

- opens sandbox
- checks out repo
- reads files
- runs bash/tests
- edits files
- uses git operations
- prepares PR or patch

#### 3. Workflow flow

User asks to turn research into action.

Agent:

- drafts a GitHub issue / Linear issue
- includes problem, scope, context, risks, and acceptance criteria
- later can create/update issue directly once write actions exist

---

## Suggested data model

### Tables / entities

- `memories`
- `documents`
- `document_chunks`
- `skills`
- `commands`
- `tool_registry`
- `source_registry`
- `secret_aliases`
- `jobs`
- `artifacts`

Possible later additions:

- `entities`
- `relations`
- `projects`
- `owners`

### Conceptual split

- **memories** = distilled durable facts/preferences/context
- **documents** = raw source material
- **skills** = reusable playbooks/instructions
- **commands** = callable workflows
- **secret_aliases** = references to server-side secrets

---

## Suggested MCP tool contract

### Brain tools

- search memories and docs
- fetch a skill
- list commands
- save memory
- retrieve context by topic/project

### Sandbox tools

- create environment
- run bash commands
- read/write/list files
- git status/diff/commit/push
- install dependencies
- run tests
- upload/download artifacts

### Integration tools

- GitHub read/write operations
- Linear issue creation/update
- future connectors for docs, Slack, or internal APIs

---

## Phased rollout

### Phase 0

- define schema
- define `BRAIN.md`
- define MCP contract
- define secret-handling model

### Phase 1

- implement brain storage + retrieval
- implement memory save/retrieve
- implement skill registry
- implement command registry

### Phase 2

- wire up sandbox execution
- support repo checkout, bash, npm/bun/python, git, tests

### Phase 3

- connect GitHub deeply
- code context search
- patch generation
- PR drafting

### Phase 4

- connect Linear write actions
- create/update issues directly

### Phase 5

- add docs/wiki/chat/internal APIs via MCP
- expand retrieval + automation

---

## Non-goals for v0

- fully autonomous agent loops without approval
- putting raw API keys into model-readable memory
- encoding all operational state into one giant prompt
- relying on semantic search alone without metadata/routing
- trying to solve every connector/workflow on day one

---

## Risks / open questions

### Security

- how do we enforce approvals for destructive actions?
- how do we isolate secrets from model-readable context?
- how do we scope sandbox permissions safely?

### Retrieval quality

- what deserves memory vs document storage?
- what ranking strategy should combine keyword + semantic + metadata search?
- how should we handle stale memories?

### UX

- when should the model ask before taking action?
- how much should be implicit from `BRAIN.md` vs explicitly fetched each task?
- what should the default workflow be for coding vs research vs automation?

### Infra

- Daytona vs Cloudflare Containers vs hybrid
- how much should run in short-lived serverless jobs vs longer-lived sandboxes?
- where should artifacts and logs live?

---

## Success criteria

We should consider v0 successful if ChatGPT can reliably:

1. load `BRAIN.md` and follow our conventions
2. search second-brain memory and docs
3. start a sandbox and operate in a repo
4. run code, tests, and git commands
5. use GitHub context to improve answers and implementation plans
6. draft high-quality tasks/issues from research
7. securely use backend-resolved capability aliases instead of raw secrets

---

## Immediate next steps

1. Draft v0 schema for second-brain storage
2. Draft initial `BRAIN.md`
3. Define MCP tool surface
4. Pick sandbox provider for v0
5. Implement memory/doc retrieval first
6. Add GitHub-aware coding workflows
7. Add Linear write support once connector path is available

---

## Notes

The goal is not just to store more context.
The goal is to build a practical agent harness where:

- prompt = steering
- database = memory
- MCP = interface
- sandbox = execution
- integrations = action surface

That combination should make ChatGPT much more useful for day-to-day research, coding, and operational workflows.
