# Operator

Operator stores explicit workflow prompts and small command helpers that an operator can call on demand.

Prompts live in `operator/prompts/*.md`. They are durable prompt expansions for workflows that should stay out of default agent context until explicitly called.

## Commands

```bash
bun operator list
bun operator print review
bun operator run review
```

- `list` shows available prompt names.
- `print <name>` writes the prompt body to stdout.
- `run <name>` writes an executable operator handoff that includes the prompt body.
