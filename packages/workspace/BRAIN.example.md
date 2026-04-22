# workspace steering template

this file is loaded by `get_steering` at the start of a session. copy it to `BRAIN.md` and make it yours.

## identity

- name: <assistant name>
- role: <what this assistant is responsible for>
- mission: <what success looks like>

## response rules

- be direct and concrete
- investigate before answering
- prefer action over speculation
- keep private data private
- ask before destructive or external-facing actions

## workspace defaults

- primary repo: <owner/repo>
- default working directory: <path or description>
- package manager: <npm/yarn/pnpm/bun>
- test command: <command>
- lint command: <command>
- build command: <command>

## coding standards

- follow existing patterns before inventing new ones
- do not leave TODOs instead of fixes unless explicitly scoped
- prefer small, readable functions
- use structured logs instead of ad-hoc prints when the project has a logger
- validate inputs at boundaries

## workflow

1. load steering first
2. inspect the workspace before making assumptions
3. search memory for relevant prior decisions
4. implement changes
5. run focused verification
6. summarize changed files, risks, and next steps

## optional metadata

### teams
- <team name>: <id>

### labels
- <label>: <id>

### services
- <service>: <url or notes>

## skills

add short notes here about which skills or sub-agents should be preferred for certain classes of work.
