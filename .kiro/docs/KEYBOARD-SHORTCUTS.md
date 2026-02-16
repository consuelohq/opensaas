# keyboard shortcuts

consuelo follows linear's approach: single-key shortcuts by default, modifiers only when needed. the goal is to make keyboard-driven workflows feel natural from day one.

## philosophy

linear proves that keyboard shortcuts aren't a power-user feature — they're the primary interface. every action should be reachable without a mouse. we use the same patterns:

- **single keys** for common actions (no cmd/ctrl prefix)
- **g + key** sequences for navigation (go to X)
- **modifier keys** only for destructive or system-level actions
- **escape** always closes/cancels
- **enter** always confirms
- **?** shows the shortcut help menu

## twenty's hotkey system

twenty has a full hotkey infrastructure. **always use it** — never raw `addEventListener`.

| hook | use case | location |
|------|----------|----------|
| `useGlobalHotkeys` | single key or modifier combos | `ui/utilities/hotkey/hooks/` |
| `useGlobalHotkeysSequence` | two-key sequences (g+s pattern) | `ui/utilities/hotkey/hooks/` |
| `useGoToHotkeys` | navigation via g+key | `ui/utilities/hotkey/hooks/` |
| `useHotkeysOnFocusedElement` | context-scoped (focused element) | `ui/utilities/hotkey/hooks/` |

action menu actions can also declare `hotKeys` in their `ActionConfig` — twenty uses this for navigation shortcuts.

## already built — twenty (do not duplicate)

### global

| shortcut | action | source |
|----------|--------|--------|
| `⌘ K` | command menu | `useCommandMenuHotKeys` |
| `/` | search records | `useCommandMenuHotKeys` |
| `@` | ask AI | `useCommandMenuHotKeys` |
| `?` | keyboard shortcut help | `KeyboardShortcutMenu` |
| `Escape` | back / close | `useCommandMenuHotKeys` |

### navigation (g + key sequences)

registered via `DefaultRecordActionsConfig` + `GotoHotkeysEffectsProvider`.

| shortcut | action |
|----------|--------|
| `G P` | go to people |
| `G C` | go to companies |
| `G D` | go to dashboards |
| `G O` | go to opportunities |
| `G S` | go to settings |
| `G T` | go to tasks |
| `G N` | go to notes |
| `G W` | go to workflows |

### record table rows

registered in `useRecordTableRowHotkeys` + `useRecordTableRowFocusHotkeys`.

| shortcut | action |
|----------|--------|
| `j` / `↓` | move focus down |
| `k` / `↑` | move focus up |
| `x` | select / deselect row |
| `Shift+x` | select range |
| `Enter` | enter row (focus first cell) |
| `Ctrl/Cmd+Enter` | open record in command menu |
| `Escape` | unfocus row / deselect all |
| `Ctrl/Cmd+a` | select all rows |

### record board cards

registered in `useRecordBoardCardHotkeys`.

| shortcut | action |
|----------|--------|
| `x` | select / deselect card |
| `Enter` / `Ctrl/Cmd+Enter` | open in command menu |
| `Escape` | unfocus / deselect all |
| `Ctrl/Cmd+a` | select all |

## already built — consuelo dialer

### in-call shortcuts

registered via `useDialerHotkeys` hook (`modules/dialer/hooks/useDialerHotkeys.ts`).

| shortcut | action | context |
|----------|--------|---------|
| `m` | toggle mute | during active call |
| `h` | toggle hold | during active call |
| `t` | open transfer modal | during active call |
| `Escape` | close modal / end call | during active call |

## not yet built — needs components first

these shortcuts are planned but blocked on the underlying UI being built.

### dialer global

| shortcut | action | blocked by |
|----------|--------|------------|
| `d` | open/focus dialer sidebar | DEV-712 (DialerSidebar is a stub) |

### dial pad

| shortcut | action | blocked by |
|----------|--------|------------|
| `0-9` | type digit | DEV-712 |
| `Enter` | dial / confirm | DEV-712 |

### record-level actions (hover/focused)

linear's killer feature — single keys on hovered records. needs deep integration with twenty's field editing meta-types system. use `useHotkeysOnFocusedElement` + twenty's field input components.

| shortcut | action | complexity | notes |
|----------|--------|------------|-------|
| `a` | assign to user | medium | open assignee picker on focused row |
| `s` | change status/stage | medium | open status dropdown |
| `l` | add/edit labels | medium | open label picker |
| `p` | set priority | medium | open priority dropdown |
| `e` | edit record | low | could alias Enter (already focuses cell) |
| `Delete` | archive record | low | with confirmation dialog |
| `⌘ C` | copy phone number | low | clipboard API |

### coaching panel (phase 3)

| shortcut | action | blocked by |
|----------|--------|------------|
| `k` | toggle coaching panel | phase 3 not started |

### queue (phase 4)

| shortcut | action | blocked by |
|----------|--------|------------|
| `Space` | start/pause queue | phase 4 not started |
| `s` | skip current | phase 4 (context-scoped, won't conflict with record `s`) |
| `r` | redial last | phase 4 |

### quick actions (DEV-719)

| shortcut | action | blocked by |
|----------|--------|------------|
| `n` | add note | DEV-719 not built |
| `f` | schedule follow-up | DEV-719 not built |

## linear's patterns (reference)

88 shortcuts total. key patterns we borrow:

- **single-key actions:** c=create, e=edit, a=assign, l=labels, s=status, p=priority, f=filter, x=select
- **navigation sequences (g+key):** inbox, my issues, backlog, projects, settings
- **modifier combos:** ⌘+K=command menu, ⌘+Delete=delete
- **two-key sequences:** m+b=mark blocked, o+i=open issue

**the pattern:** most frequent = single key. navigation = g+key. destructive = modifier. relationships = m+key.

## implementation notes

- all hooks use twenty's `useGlobalHotkeys` / `useGlobalHotkeysSequence` / `useHotkeysOnFocusedElement`
- shortcuts are disabled in text inputs by default
- in-call shortcuts only fire when call is active
- record-level shortcuts use `useHotkeysOnFocusedElement` scoped to the focused row/card
- navigation shortcuts are declared as `hotKeys` in `ActionConfig` (twenty's action menu system)
- each phase adds shortcuts to the relevant component — no central registry
