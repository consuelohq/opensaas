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

## existing twenty shortcuts

twenty already has a hotkey system (`react-hotkeys-hook` + recoil). these are built in:

| shortcut | action | source |
|----------|--------|--------|
| `⌘ K` | open command menu | useCommandMenuHotKeys |
| `/` | search records | useCommandMenuHotKeys |
| `@` | ask AI (if enabled) | useCommandMenuHotKeys |
| `?` | keyboard shortcut help | KeyboardShortcutMenu |
| `g s` | go to settings | GotoHotkeysEffectsProvider |
| `g {key}` | go to object page | GoToHotkeyItemEffect (dynamic) |
| `Escape` | back / close | useCommandMenuHotKeys |

twenty's hotkey hooks:
- `useGlobalHotkeys` — single key or modifier combos
- `useGlobalHotkeysSequence` — two-key sequences (g+s pattern)
- `useGoToHotkeys` — navigation via g+key
- `useHotkeysOnFocusedElement` — context-aware (scoped to focused element)

## dialer shortcuts (phase 2 — now)

registered via `useDialerHotkeys` hook.

### global

| shortcut | action | context |
|----------|--------|---------|
| `d` | open/focus dialer sidebar | anywhere (not in text input) |

### in-call (active call only)

| shortcut | action | context |
|----------|--------|---------|
| `m` | toggle mute | during active call |
| `h` | toggle hold | during active call |
| `t` | open transfer modal | during active call |
| `Escape` | close modal / cancel transfer | modal open |
| `Enter` | confirm action | modal open |

### dial pad

| shortcut | action | context |
|----------|--------|---------|
| `0-9` | type digit | dial pad focused |
| `Enter` | dial / confirm | dial pad focused |
| `Escape` | clear / close | dial pad focused |

## planned shortcuts (future phases)

### navigation (g + key sequences)

| shortcut | action | phase |
|----------|--------|-------|
| `g d` | go to dashboard | 2 |
| `g c` | go to contacts | 4 |
| `g q` | go to queue | 4 |
| `g a` | go to activities/calls | 5 |
| `g k` | go to knowledge base | 6 |
| `g s` | go to settings | exists |

### record actions (when viewing a contact)

| shortcut | action | phase |
|----------|--------|-------|
| `c` | call this contact | 4 |
| `e` | edit record | 4 |
| `n` | new note | 5 |

### queue (phase 4)

| shortcut | action | phase |
|----------|--------|-------|
| `Space` | start/pause queue | 4 |
| `s` | skip current | 4 |
| `r` | redial last | 4 |

### coaching panel (phase 3)

| shortcut | action | phase |
|----------|--------|-------|
| `k` | toggle coaching panel | 3 |

## linear's full shortcut list (reference)

88 shortcuts total. key patterns we're borrowing:

**navigation sequences (g + key):** inbox, my issues, backlog, archived, all issues, board, cycles, active cycle, projects, settings

**single-key actions:** c=create, e=edit, a=assign, l=labels, s=status, p=priority, f=filter, x=select, r=rename

**modifier combos:** ⌘+K=command menu, ⌘+I=details sidebar, ⌘+B=toggle view, ⌘+Delete=delete

**two-key sequences:** m+b=mark blocked, m+x=mark blocking, m+r=related, m+m=merge, o+i=open issue, o+f=open favorite

**the pattern:** most frequent actions = single key. navigation = g+key. destructive = modifier. relationships = m+key. open = o+key.

## implementation notes

- all hooks use twenty's `useGlobalHotkeys` / `useGlobalHotkeysSequence`
- shortcuts are disabled when typing in text inputs (default behavior)
- in-call shortcuts only fire when `callStateAtom` indicates active call
- dialer shortcuts registered in `useDialerHotkeys` hook, mounted in `DialerSidebar`
- each phase adds its shortcuts to the relevant component, not a central registry
