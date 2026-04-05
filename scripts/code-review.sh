#!/usr/bin/env bash
# pre-push code review — enforces 16 mandatory rules from CODING-STANDARDS.md
# runs on changed files vs main. exit 1 = block push.
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0
WARNINGS=""

# get changed .ts/.tsx files vs main (all packages, exclude deleted)
# check committed diff first, then fall back to staged+unstaged (agent may not have committed yet)
CHANGED_FILES=$(git diff --name-only --diff-filter=ACMR origin/main...HEAD -- 'packages/*/src/**/*.ts' 'packages/*/src/**/*.tsx' 2>/dev/null || echo "")
if [ -z "$CHANGED_FILES" ]; then
  CHANGED_FILES=$(git diff --name-only --diff-filter=ACMR HEAD -- 'packages/*/src/**/*.ts' 'packages/*/src/**/*.tsx' 2>/dev/null || echo "")
fi
if [ -z "$CHANGED_FILES" ]; then
  CHANGED_FILES=$(git diff --name-only --diff-filter=ACMR --staged -- 'packages/*/src/**/*.ts' 'packages/*/src/**/*.tsx' 2>/dev/null || echo "")
fi
CHANGED_FILES=$(echo "$CHANGED_FILES" | grep -v '^$' | sort -u || true)

if [ -z "$CHANGED_FILES" ]; then
  echo -e "${GREEN}no changed .ts/.tsx files to review${NC}"
  exit 0
fi

echo -e "${BOLD}code review: checking $(echo "$CHANGED_FILES" | wc -l | tr -d ' ') files${NC}"
echo ""

# helper: report a violation
report() {
  local check="$1" file="$2" line="$3" msg="$4"
  WARNINGS="${WARNINGS}  ${RED}FAIL${NC} [${check}] ${file}:${line} — ${msg}\n"
  FAIL=$((FAIL + 1))
}

# 1. LOGGING — no console.* (except cli/output.ts and logger/src/*)
echo -n "  LOGGING .......... "
while IFS= read -r file; do
  [[ "$file" == packages/cli/src/output.ts ]] && continue
  [[ "$file" == packages/cli/src/utils/ui.ts ]] && continue
  [[ "$file" == packages/cli/src/commands/init.ts ]] && continue
  [[ "$file" == packages/logger/src/* ]] && continue
  while IFS=: read -r lineno line; do
    # skip eslint-disable comments
    echo "$line" | grep -q "eslint-disable" && continue
    report "LOGGING" "$file" "$lineno" "console.* usage — use structured logger"
  done < <(grep -n 'console\.\(log\|error\|warn\|info\|debug\)' "$file" 2>/dev/null || true)
done <<< "$CHANGED_FILES"
if [ $FAIL -eq 0 ]; then echo -e "${GREEN}PASS${NC}"; PASS=$((PASS + 1))
else echo -e "${RED}FAIL${NC}"; fi
LOGGING_FAIL=$FAIL
FAIL=0

# 2. SENTRY — HTTP errors should have sentry tracking
echo -n "  SENTRY ........... "
while IFS= read -r file; do
  # skip test files — assertions like expect(statusCode).toBe(400) are not real errors
  echo "$file" | grep -qE '(__tests__|.spec.|.test.)' && continue
  # only check files that have HTTP error patterns
  while IFS=: read -r lineno line; do
    # look ahead ~10 lines for Sentry reference
    total=$(wc -l < "$file")
    end=$((lineno + 10))
    [ $end -gt "$total" ] && end=$total
    if ! sed -n "${lineno},${end}p" "$file" | grep -q "Sentry\.\(capture\|withScope\)"; then
      report "SENTRY" "$file" "$lineno" "HTTP error without Sentry tracking"
    fi
  done < <(grep -n 'response\.\(ok\|status\).*[45][0-9][0-9]\|statusCode.*[>=].*400\|!response\.ok' "$file" 2>/dev/null || true)
done <<< "$CHANGED_FILES"
if [ $FAIL -eq 0 ]; then echo -e "${GREEN}PASS${NC}"; PASS=$((PASS + 1))
else echo -e "${RED}FAIL${NC}"; fi
SENTRY_FAIL=$FAIL
FAIL=0

# 3. PHONE_NORM — phone comparisons must use normalizePhone()
echo -n "  PHONE_NORM ....... "
while IFS= read -r file; do
  while IFS=: read -r lineno line; do
    # skip if normalizePhone is on the same line
    echo "$line" | grep -q "normalizePhone" && continue
    report "PHONE_NORM" "$file" "$lineno" "phone comparison without normalizePhone()"
  done < <(grep -n '\.phone\s*===\|\.phone\s*!==\|\.phoneNumber\s*===\|\.phoneNumber\s*!==' "$file" 2>/dev/null || true)
done <<< "$CHANGED_FILES"
if [ $FAIL -eq 0 ]; then echo -e "${GREEN}PASS${NC}"; PASS=$((PASS + 1))
else echo -e "${RED}FAIL${NC}"; fi
PHONE_FAIL=$FAIL
FAIL=0

# 4. SQL_PARAM — no template literals in .query() calls
echo -n "  SQL_PARAM ........ "
while IFS= read -r file; do
  while IFS=: read -r lineno _; do
    report "SQL_PARAM" "$file" "$lineno" 'template literal in SQL query — use parameterized queries'
  done < <(grep -n '\.query\s*(`' "$file" 2>/dev/null || true)
done <<< "$CHANGED_FILES"
if [ $FAIL -eq 0 ]; then echo -e "${GREEN}PASS${NC}"; PASS=$((PASS + 1))
else echo -e "${RED}FAIL${NC}"; fi
SQL_FAIL=$FAIL
FAIL=0

# 5. ERROR_HANDLING — async functions should have try/catch
echo -n "  ERROR_HANDLING ... "
while IFS= read -r file; do
  # skip test files — test functions intentionally let errors propagate to jest
  echo "$file" | grep -qE '\.(spec|test)\.(ts|tsx)$' && continue
  # find async functions, check if they contain try
  while IFS=: read -r lineno line; do
    # skip if wrapped in errorHandler (which provides try/catch)
    echo "$line" | grep -q "errorHandler" && continue
    # look ahead ~30 lines for try block, Promise, or absence of await (no async risk)
    total=$(wc -l < "$file")
    end=$((lineno + 30))
    [ $end -gt "$total" ] && end=$total
    lookahead=$(sed -n "${lineno},${end}p" "$file")
    echo "$lookahead" | grep -q "try\s*{" && continue
    echo "$lookahead" | grep -q "new Promise" && continue
    # if no await in the body, function can't throw asynchronously — skip
    echo "$lookahead" | grep -q "await " || continue
    report "ERROR_HANDLING" "$file" "$lineno" "async function without try/catch"
  done < <(grep -nE 'async\s+(function\s)?\s*\w*\s*\(|async\s*\(' "$file" 2>/dev/null || true)
done <<< "$CHANGED_FILES"
if [ $FAIL -eq 0 ]; then echo -e "${GREEN}PASS${NC}"; PASS=$((PASS + 1))
else echo -e "${RED}FAIL${NC}"; fi
ERROR_FAIL=$FAIL
FAIL=0

# 6. TYPE_SAFETY — no explicit any without HACK comment
echo -n "  TYPE_SAFETY ...... "
while IFS= read -r file; do
  while IFS=: read -r lineno line; do
    # check if previous line or same line has HACK comment
    prev=$((lineno - 1))
    [ $prev -lt 1 ] && prev=1
    context=$(sed -n "${prev},${lineno}p" "$file")
    echo "$context" | grep -q "HACK" && continue
    report "TYPE_SAFETY" "$file" "$lineno" "explicit 'any' without // HACK: comment"
  done < <(grep -n ': any\b\|as any\b\|<any>' "$file" 2>/dev/null || true)
done <<< "$CHANGED_FILES"
if [ $FAIL -eq 0 ]; then echo -e "${GREEN}PASS${NC}"; PASS=$((PASS + 1))
else echo -e "${RED}FAIL${NC}"; fi
TYPE_FAIL=$FAIL

# 7. SECRETS — no hardcoded keys, tokens, or passwords
echo -n "  SECRETS .......... "
FAIL=0
while IFS= read -r file; do
  # skip test files — test fixtures use fake tokens/keys
  echo "$file" | grep -qE '\.(spec|test)\.(ts|tsx)$' && continue
  while IFS=: read -r lineno line; do
    # skip env lookups and type annotations
    echo "$line" | grep -qE 'process\.env|getenv|\.env\b|: string|apiKey\?' && continue
    report "SECRETS" "$file" "$lineno" "possible hardcoded secret"
  done < <(grep -nE "(api[_-]?key|secret|password|token|bearer)\s*[:=]\s*['\"][A-Za-z0-9]" "$file" 2>/dev/null | grep -iv "type\|interface\|placeholder\|example\|TODO\|config\.\|process\.env" || true)
done <<< "$CHANGED_FILES"
if [ $FAIL -eq 0 ]; then echo -e "${GREEN}PASS${NC}"; PASS=$((PASS + 1))
else echo -e "${RED}FAIL${NC}"; fi
SECRETS_FAIL=$FAIL

# 8. TODO_FIXME — TODOs must reference a ticket (TODO(DEV-xxx))
echo -n "  TODO_FIXME ....... "
FAIL=0
while IFS= read -r file; do
  while IFS=: read -r lineno line; do
    # allow TODO(DEV-xxx) or FIXME(DEV-xxx) or TODO: DEV-xxx
    echo "$line" | grep -qE '(TODO|FIXME)\s*[\(:]?\s*DEV-[0-9]+' && continue
    report "TODO_FIXME" "$file" "$lineno" "TODO/FIXME without ticket ref — use TODO(DEV-xxx)"
  done < <(grep -n '\bTODO\b\|\bFIXME\b' "$file" 2>/dev/null || true)
done <<< "$CHANGED_FILES"
if [ $FAIL -eq 0 ]; then echo -e "${GREEN}PASS${NC}"; PASS=$((PASS + 1))
else echo -e "${RED}FAIL${NC}"; fi
TODO_FAIL=$FAIL

# 9. IMPORT_SAFETY — no require() or import * in .ts files
echo -n "  IMPORT_SAFETY .... "
FAIL=0
while IFS= read -r file; do
  while IFS=: read -r lineno line; do
    echo "$line" | grep -q "eslint-disable" && continue
    # allow import * for node builtins and Sentry
    echo "$line" | grep -qE "import \* as (fs|path|os|url|http|https|crypto|stream|util|child_process|Sentry)\b" && continue
    if echo "$line" | grep -q "require("; then
      report "IMPORT_SAFETY" "$file" "$lineno" "require() in .ts — use import"
    else
      report "IMPORT_SAFETY" "$file" "$lineno" "import * — use named imports"
    fi
  done < <(grep -nE '\brequire\s*\(|import \* as' "$file" 2>/dev/null | grep -v "// eslint-disable" || true)
done <<< "$CHANGED_FILES"
if [ $FAIL -eq 0 ]; then echo -e "${GREEN}PASS${NC}"; PASS=$((PASS + 1))
else echo -e "${RED}FAIL${NC}"; fi
IMPORT_FAIL=$FAIL

# 10. ROUTE_ORDER — literal routes (e.g. /search) must come before param routes (/:id)
echo -n "  ROUTE_ORDER ...... "
FAIL=0
while IFS= read -r file; do
  [[ ! "$file" == *routes/* ]] && continue
  # extract path lines in order, check if literal comes after param within same prefix
  prev_was_param="__none__"
  prev_prefix=""
  while IFS=: read -r lineno line; do
    route_path=$(echo "$line" | sed "s/.*path: *'\\([^']*\\)'.*/\\1/")
    prefix=$(echo "$route_path" | sed 's|/[^/]*$||')
    if echo "$route_path" | grep -q '/:'; then
      prev_was_param="$prefix"
    elif [ "$prev_was_param" = "$prefix" ]; then
      report "ROUTE_ORDER" "$file" "$lineno" "'$route_path' after param route — may be shadowed by /:param"
    fi
  done < <(grep -n "path: *'" "$file" 2>/dev/null || true)
done <<< "$CHANGED_FILES"
if [ $FAIL -eq 0 ]; then echo -e "${GREEN}PASS${NC}"; PASS=$((PASS + 1))
else echo -e "${RED}FAIL${NC}"; fi
ROUTE_FAIL=$FAIL

# 11. CATCH_TYPING — catch params must be typed as : unknown
echo -n "  CATCH_TYPING ..... "
FAIL=0
while IFS= read -r file; do
  # catch(err: any) — explicit any
  while IFS=: read -r lineno line; do
    echo "$line" | grep -q "HACK" && continue
    report "CATCH_TYPING" "$file" "$lineno" "catch(err: any) — use catch(err: unknown) with type guards"
  done < <(grep -n 'catch\s*(.*:\s*any)' "$file" 2>/dev/null || true)
  # catch(err) — bare, no type annotation
  while IFS=: read -r lineno line; do
    report "CATCH_TYPING" "$file" "$lineno" "bare catch(err) — use catch(err: unknown) with type guards"
  done < <(grep -n 'catch\s*(\s*\w\+\s*)' "$file" 2>/dev/null | grep -v ':\s*unknown\|:\s*any' || true)
done <<< "$CHANGED_FILES"
if [ $FAIL -eq 0 ]; then echo -e "${GREEN}PASS${NC}"; PASS=$((PASS + 1))
else echo -e "${RED}FAIL${NC}"; fi
CATCH_FAIL=$FAIL

# 12. OPTIONAL_IMPORT — peer deps must use lazy dynamic import, not top-level
echo -n "  OPTIONAL_IMPORT .. "
FAIL=0
while IFS= read -r file; do
  # find which package this file belongs to
  pkg_dir=$(echo "$file" | sed 's|/src/.*||')
  pkg_json="${pkg_dir}/package.json"
  [ ! -f "$pkg_json" ] && continue
  # extract peerDependencies keys
  peer_deps=$(node -e "try{const p=require('./${pkg_json}');console.log(Object.keys(p.peerDependencies||{}).join('\n'))}catch{}" 2>/dev/null || true)
  [ -z "$peer_deps" ] && continue
  # check top-level imports (before first function/class/export function)
  while IFS=: read -r lineno line; do
    # extract the package name from the import
    pkg=$(echo "$line" | sed "s/.*from ['\"]//;s/['\"].*//" | sed 's|/.*||' | sed 's/^@[^/]*\/[^/]*/&/')
    # handle scoped packages: @scope/name
    if echo "$pkg" | grep -q '^@'; then
      pkg=$(echo "$line" | sed "s/.*from ['\"]//;s/['\"].*//" | sed 's|^\(@[^/]*/[^/]*\).*|\1|')
    fi
    # check if this package is in peerDependencies
    if echo "$peer_deps" | grep -qxF "$pkg"; then
      # check if this is a top-level import (not inside a function — i.e. not indented)
      if echo "$line" | grep -qE '^import '; then
        report "OPTIONAL_IMPORT" "$file" "$lineno" "top-level import of peer dep '$pkg' — use lazy: await import('$pkg')"
      fi
    fi
  done < <(grep -n "^import .* from ['\"]" "$file" 2>/dev/null | grep -v "^.*:import type " || true)
done <<< "$CHANGED_FILES"
if [ $FAIL -eq 0 ]; then echo -e "${GREEN}PASS${NC}"; PASS=$((PASS + 1))
else echo -e "${RED}FAIL${NC}"; fi
OPTIONAL_IMPORT_FAIL=$FAIL

# 13. STUB_HANDLER — route handlers must not return hardcoded fake data without real logic
echo -n "  STUB_HANDLER ..... "
FAIL=0
while IFS= read -r file; do
  [[ ! "$file" == *routes/* ]] && continue
  # find handler functions, check if they have any real logic (await, if, function calls)
  # a stub is a handler whose ONLY action is res.json() with no awaits or conditionals
  while IFS=: read -r lineno _; do
    # extract the handler body (from handler line to next closing brace at same indent)
    total=$(wc -l < "$file")
    end=$((lineno + 15))
    [ $end -gt "$total" ] && end=$total
    body=$(sed -n "${lineno},${end}p" "$file")
    # skip if handler has real logic: await, if, const/let from function calls, try
    echo "$body" | grep -qE 'await |if \(|try \{|\.call\(|\.get\(|\.post\(|\.query\(' && continue
    # skip if marked as stub
    echo "$body" | grep -qiE 'STUB|TODO|FIXME|placeholder|health' && continue
    # if we get here, it's a handler with no real logic
    report "STUB_HANDLER" "$file" "$lineno" "handler with no real logic — implement or mark with // STUB:"
  done < <(grep -n 'handler:.*async\|handler: async' "$file" 2>/dev/null || true)
done <<< "$CHANGED_FILES"
if [ $FAIL -eq 0 ]; then echo -e "${GREEN}PASS${NC}"; PASS=$((PASS + 1))
else echo -e "${RED}FAIL${NC}"; fi
STUB_FAIL=$FAIL


# 14. SPEC_COMPLIANCE — verify work matches original prompt/spec
echo -n "  SPEC_COMPLIANCE . "
FAIL=0
PROMPT_FILE="/tmp/kiro-last-prompt.txt"
CONFIRM_FILE="/tmp/kiro-spec-confirmed"
if [ -f "$PROMPT_FILE" ] && [ -n "$CHANGED_FILES" ]; then
  # confirmation file must exist AND be newer than the prompt file
  if [ -f "$CONFIRM_FILE" ] && [ "$CONFIRM_FILE" -nt "$PROMPT_FILE" ]; then
    echo -e "${GREEN}PASS${NC} (confirmed)"
  else
    echo -e "${RED}FAIL${NC}"
    echo ""
    echo -e "  ${BOLD}CHANGED_FILES is set but no saved prompt found.${NC}"
    echo -e "  ${RED}→ Missing: /tmp/kiro-last-prompt.txt${NC}"
    echo -e "  ${RED}→ Either restore the prompt file, or confirm the changes are correct:${NC}"
    echo -e "  ${RED}→   echo 'confirmed' > /tmp/kiro-spec-confirmed${NC}"
    echo -e "  ${RED}→ Then re-run this script.${NC}"
    FAIL=1
  fi
else
  echo -e "${GREEN}PASS${NC} (no changed files to verify)"
fi
SPEC_FAIL=$FAIL



# 15. ESLINT — run eslint per-package with correct config (catches lingui, hardcoded colors, import restrictions, etc.)
echo -n "  ESLINT ........... "
FAIL=0
ESLINT_OUTPUT=""
if [ -n "$CHANGED_FILES" ]; then
  # group files by package and run eslint with each package's config
  ESLINT_PACKAGES=$(echo "$CHANGED_FILES" | sed 's|^packages/\([^/]*\)/.*|\1|' | sort -u)
  while IFS= read -r pkg; do
    [ -z "$pkg" ] && continue
    PKG_CONFIG="packages/$pkg/eslint.config.mjs"
    [ ! -f "$PKG_CONFIG" ] && continue
    # collect files for this package
    PKG_FILES=""
    while IFS= read -r file; do
      case "$file" in packages/"$pkg"/*) [ -f "$file" ] && PKG_FILES="$PKG_FILES $file" ;; esac
    done <<< "$CHANGED_FILES"
    [ -z "$PKG_FILES" ] && continue
    PKG_OUTPUT=$(npx eslint --config "$PKG_CONFIG" --max-warnings 0 $PKG_FILES 2>&1) || {
      FAIL=1
      ESLINT_OUTPUT="${ESLINT_OUTPUT}${PKG_OUTPUT}\n"
    }
  done <<< "$ESLINT_PACKAGES"
fi
if [ $FAIL -eq 0 ]; then echo -e "${GREEN}PASS${NC}"; PASS=$((PASS + 1))
else
  echo -e "${RED}FAIL${NC}"
  WARNINGS="${WARNINGS}  ${RED}FAIL${NC} [ESLINT] eslint violations found:\n"
  ESLINT_SUMMARY=$(echo -e "$ESLINT_OUTPUT" | head -30)
  WARNINGS="${WARNINGS}${ESLINT_SUMMARY}\n"
  if [ "$(echo -e "$ESLINT_OUTPUT" | wc -l)" -gt 30 ]; then
    WARNINGS="${WARNINGS}  ... (truncated, run npx nx lint:diff-with-main <package> for full output)\n"
  fi
fi
ESLINT_FAIL=$FAIL

# 16. TYPECHECK — run typecheck on affected packages
echo -n "  TYPECHECK ........ "
FAIL=0
TYPECHECK_OUTPUT=""
if [ -n "$CHANGED_FILES" ]; then
  # extract unique package names from changed file paths
  AFFECTED_PACKAGES=$(echo "$CHANGED_FILES" | sed 's|^packages/\([^/]*\)/.*|\1|' | sort -u)
  while IFS= read -r pkg; do
    [ -z "$pkg" ] && continue
    # verify the package has a project.json (is an nx project)
    [ ! -f "packages/$pkg/project.json" ] && continue
    PKG_OUTPUT=$(npx nx typecheck "$pkg" 2>&1) || {
      FAIL=1
      TYPECHECK_OUTPUT="${TYPECHECK_OUTPUT}\n--- $pkg ---\n${PKG_OUTPUT}"
    }
  done <<< "$AFFECTED_PACKAGES"
fi
if [ $FAIL -eq 0 ]; then echo -e "${GREEN}PASS${NC}"; PASS=$((PASS + 1))
else
  echo -e "${RED}FAIL${NC}"
  WARNINGS="${WARNINGS}  ${RED}FAIL${NC} [TYPECHECK] type errors found:\n"
  TC_SUMMARY=$(echo -e "$TYPECHECK_OUTPUT" | head -30)
  WARNINGS="${WARNINGS}${TC_SUMMARY}\n"
  if [ "$(echo -e "$TYPECHECK_OUTPUT" | wc -l)" -gt 30 ]; then
    WARNINGS="${WARNINGS}  ... (truncated, run npx nx typecheck <package> for full output)\n"
  fi
fi
TYPECHECK_FAIL=$FAIL


# summary
TOTAL_CHECKS=16
TOTAL_FAIL=$((LOGGING_FAIL + SENTRY_FAIL + PHONE_FAIL + SQL_FAIL + ERROR_FAIL + TYPE_FAIL + SECRETS_FAIL + TODO_FAIL + IMPORT_FAIL + ROUTE_FAIL + CATCH_FAIL + OPTIONAL_IMPORT_FAIL + STUB_FAIL + SPEC_FAIL + ESLINT_FAIL + TYPECHECK_FAIL))
echo ""
if [ $TOTAL_FAIL -gt 0 ]; then
  echo -e "${BOLD}violations:${NC}"
  echo -e "$WARNINGS"
  echo -e "${RED}${BOLD}BLOCKED${NC} — ${TOTAL_FAIL} violation(s) found. fix before pushing."
  echo -e "see CODING-STANDARDS.md for details."
  exit 1
else
  echo -e "${GREEN}${BOLD}ALL CHECKS PASSED${NC} (${PASS}/${TOTAL_CHECKS})"
  exit 0
fi
