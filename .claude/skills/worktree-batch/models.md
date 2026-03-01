# model catalog

quick reference for opencode model selection. use `-m <model>` flag on `opencode run`.

## selection guide

| task type | recommended | fallback |
|-----------|-------------|----------|
| complex features, new architecture | `opencode/glm-5-free` | `nvidia/moonshotai/kimi-k2.5` |
| bug fixes, spec-driven fixes | `opencode/minimax-m2.5-free` | `nvidia/z-ai/glm5` |
| mechanical (add fields, rename, types) | `zai-coding-plan/glm-4.7-flashx` | `opencode/minimax-m2.5-free` |
| speed-critical (ko is waiting) | `zai-coding-plan/glm-4.7-flashx` | `zai-coding-plan/glm-4.7` |

## full catalog

### free — opencode provider (daily caps, no cost)

| model | quality | speed | notes |
|-------|---------|-------|-------|
| `opencode/kimi-k2.5-free` | ★★★★★ | slow | opus-tier, daily limit |
| `opencode/glm-5-free` | ★★★★★ | slow | opus-tier, daily limit |
| `opencode/minimax-m2.5-free` | ★★★★ | medium | solid all-rounder, daily limit |
| `opencode/gpt-5-nano` | ★★★ | fast | good for simple tasks |
| `opencode/big-pickle` | ??? | ??? | untested |

### free — nvidia (1000 req/day, no cost)

| model | quality | speed | notes |
|-------|---------|-------|-------|
| `nvidia/moonshotai/kimi-k2.5` | ★★★★★ | slow | top pick for complex work |
| `nvidia/z-ai/glm5` | ★★★★★ | slow | top pick for complex work |
| `nvidia/z-ai/glm4.7` | ★★★★ | fast | ⚠️ DO NOT USE — ko says never nvidia for glm4.7. use `zai-coding-plan/glm-4.7` instead |
| `nvidia/deepseek-ai/deepseek-v3.2` | ★★★★★ | slow | strong coder |
| `nvidia/qwen/qwen3-coder-480b-a35b-instruct` | ★★★★★ | slow | massive, untested in our workflow |

### paid — zai coding plan (ko's subscription)

| model | quality | speed | notes |
|-------|---------|-------|-------|
| `zai-coding-plan/glm5` | ★★★★★ | medium | faster than nvidia glm5 |
| `zai-coding-plan/glm-4.7` | ★★★★ | fast | daily driver when speed matters |
| `zai-coding-plan/glm-4.7-flashx` | ★★★ | fastest | mechanical tasks only |
| `zai-coding-plan/glm-4.5` | ★★★ | fast | older, still decent |

## usage

```bash
# in opencode run command
cd /tmp/opensaas-dev-857 && /opt/homebrew/bin/opencode run -m nvidia/moonshotai/kimi-k2.5 "prompt..."

# kiro picks model based on task complexity, or ko overrides:
# "use glm5 for all of these"
# "use zai for speed"
# "use minimax for the simple ones, kimi for the hard one"
```

## quota strategy

1. **nvidia first** — 1000 req/day is plenty, use for top-tier models
2. **opencode free as backup** — when nvidia is slow or quota is low
3. **zai paid for speed** — when ko is waiting or batch is time-sensitive
4. **mix within a batch** — hard tasks get kimi/glm5, easy tasks get minimax/nano
