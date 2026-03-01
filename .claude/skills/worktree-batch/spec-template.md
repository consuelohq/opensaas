# spec template

use this template when creating new linear task specs. the goal: an agent can pick this up and code it without asking questions, and kiro can review it by checking each criterion against the diff.

## why this matters

bad spec → opencode does 5/23 items → kiro merges anyway → known gap → tech debt.
good spec → opencode has a checklist → kiro has a checklist → nothing slips through.

the DEV-858 lesson: "convert all settings atoms to createState" without listing them = opencode converts 5 and calls it done. listing all 23 file paths = opencode has a checklist.

---

## template

```markdown
## <title>

### context
<1-2 sentences: why this change is needed, what review/issue found it>

### changes

#### 1. <first change>

**files:**
- `path/to/file1.ts` (lines XX-YY)
- `path/to/file2.ts` (new file)

**what's wrong:**
<current behavior or code that needs fixing>

**fix:**
```typescript
// before
<current code>

// after
<fixed code>
```

**edge cases:**
- <anything the agent should watch for>

---

#### 2. <second change>
...

---

### acceptance criteria

numbered, binary pass/fail. each one maps to a specific change above.

1. `path/to/file1.ts` — <specific testable condition>
2. `path/to/file2.ts` — <specific testable condition>
3. all files in `path/to/dir/*.ts` — <condition that applies to all>
4. `bash scripts/code-review.sh` — 13/13 pass
5. no files outside scope are modified

### scope boundary

**files to change:**
- `path/to/file1.ts`
- `path/to/file2.ts`
- `path/to/dir/*.ts` (list each file if <10, glob if >10)

**files NOT to touch:**
- `path/to/unrelated.ts` (being modified by DEV-XXX)
- `packages/cli/src/commands/deploy.ts` (already fixed in DEV-YYY)

### review reference
- parent issue: DEV-XXX
- review source: DEV-YYY (code review that found these issues)
- coding standards: CODING-STANDARDS.md rules #N, #M
```

---

## rules for writing specs

### acceptance criteria must be binary

```
# ❌ vague
- [ ] settings atoms use createState

# ✅ specific
- [ ] settingsRoleIdsState.ts uses createState with key 'settings.roleIds'
- [ ] settingsRolesIsLoadingState.ts uses createState with key 'settings.rolesIsLoading'
- [ ] playgroundApiKeyState.ts uses createState with key 'settings.playgroundApiKey'
```

### file paths must be explicit

```
# ❌ vague
- settings components need aria-labels

# ✅ specific
- packages/twenty-front/src/modules/settings/components/PlaygroundSetupForm.tsx — aria-label on form inputs
- packages/twenty-front/src/modules/settings/components/SettingsSSOSAMLForm.tsx — aria-label on SAML fields
```

### "all files in X" needs enumeration

if the spec says "all files in settings/states/", list them:

```
files to change:
- settings/states/settingsRoleIdsState.ts
- settings/states/settingsRolesIsLoadingState.ts
- settings/states/playgroundApiKeyState.ts
- settings/states/userLookupResultState.ts
- settings/states/configVariableState.ts
- settings/states/customDomainState.ts
... (all 23 files)
```

this is tedious but prevents the "i did 5 and called it done" failure.

### scope boundary prevents cross-contamination

when running parallel tasks, list files the OTHER tasks are editing:

```
files NOT to touch (parallel tasks):
- packages/cli/src/commands/deploy.ts (DEV-860)
- packages/cli/src/commands/dev.ts (DEV-860)
- packages/cli/src/commands/migrate.ts (DEV-860)
```

### before/after code when possible

agents do better with concrete examples than abstract descriptions:

```
# ❌ abstract
convert atom to createState

# ✅ concrete
// before
import { atom } from 'recoil';
export const someState = atom({ key: 'someState', default: null });

// after
import { createState } from '@/ui/utilities/state/utils/createState';
export const someState = createState<SomeType | null>({
  key: 'settings.someState',
  defaultValue: null,
});
```

### edge cases are not optional

if the python source or previous review found edge cases, include them:

```
edge cases:
- phone number might not start with + (validate before normalizing)
- customFields JSON.parse can throw — wrap in try/catch
- empty string is not the same as null for optional fields
```

---

## spec quality checklist (for kiro before sending to opencode)

before generating the opencode prompt from a spec:

- [ ] every acceptance criterion is binary pass/fail
- [ ] every file to change is listed by path
- [ ] scope boundary includes files NOT to touch
- [ ] before/after code provided where the change is non-obvious
- [ ] edge cases listed
- [ ] a developer could start coding from this spec alone — no questions needed
