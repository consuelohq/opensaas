#!/bin/bash
#
# Agent Configuration
#
# This file configures which AI agent CLI to use for autonomous task processing.
#

# =============================================================================
# AGENT CLI SELECTION
# =============================================================================

# Agent CLI: "kiro"
AGENT_CLI="kiro"

# =============================================================================
# CLI INVOCATION PATTERNS
# =============================================================================

# Kiro CLI invocation (non-interactive, full tool access)
KIRO_CMD="kiro-cli chat --trust-all-tools --no-interactive --agent worker"

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# Get the appropriate command based on current CLI selection
get_agent_cmd() {
  echo "$KIRO_CMD"
}

# =============================================================================
# TASK PROCESSING SETTINGS
# =============================================================================

# Maximum retries for failed tasks before flagging for review
MAX_RETRIES=1

# Timeout for agent execution (in seconds, 0 = no timeout)
AGENT_TIMEOUT=0

# Whether to run tests after each task (true/false)
RUN_TESTS_AFTER_TASK=true

# Which tests to run for validation
# Uses nx to run twenty-server tests (adjust as needed per task)
TEST_COMMAND="npx nx test twenty-server"

# =============================================================================
# GITHUB REPO (explicit — prevents gh from resolving to upstream twentyhq/twenty)
# =============================================================================
GITHUB_REPO="consuelohq/opensaas"

# =============================================================================
# GIT SETTINGS
# =============================================================================

# Base branch for agent work (PRs target this branch)
BASE_BRANCH="staging"

# Branch to create run branches FROM (pull fresh code)
SOURCE_BRANCH="staging"

# Branch to create PRs TO
PR_TARGET_BRANCH="main"

# Branch prefix for agent-created branches
BRANCH_PREFIX="agent"

# =============================================================================
# TASK SOURCE SETTINGS
# =============================================================================

# Task source: "issues" (GitHub Issues), "projects" (GitHub Projects), or "linear" (Linear.app)
TASK_SOURCE="linear"

# GitHub Projects settings (used when TASK_SOURCE="projects")
GITHUB_PROJECT_NUMBER="2"
GITHUB_PROJECT_OWNER="consuelohq"

# Mercury status columns (case-sensitive - use exact names from board)
PROJECT_STATUS_READY="spec prepared"
PROJECT_STATUS_WORKING="in progress"
PROJECT_STATUS_DONE="done"
PROJECT_STATUS_REVIEW="in review"

# GitHub Issues settings (used when TASK_SOURCE="issues")
ISSUE_LABEL_READY="kiro"
ISSUE_LABEL_WORKING="agent-working"
ISSUE_LABEL_REVIEW="agent-review"
ISSUE_LABEL_TEST="agent-test"
ISSUE_LABEL_COMPLETED="agent-completed"

# =============================================================================
# RUN STATE MANAGEMENT
# =============================================================================

RUN_STATE_FILE="${SCRIPT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}/run-state.json"

# =============================================================================
# NOTIFICATION SETTINGS
# =============================================================================

SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# =============================================================================
# LINEAR SETTINGS
# =============================================================================

# Linear API key (set in environment variable, NOT here)

# Team ID (DEV team)
LINEAR_TEAM_ID="29f5c661-da6c-4bfb-bd48-815a006ccaac"

# Label name to filter issues (issues must have this label to be picked up)
LINEAR_LABEL_NAME="kiro"

# Workflow State Names (must match Linear exactly — case-sensitive)
LINEAR_STATE_OPEN="open"
LINEAR_STATE_IN_PROGRESS="In Progress"
LINEAR_STATE_IN_REVIEW="In Review"
LINEAR_STATE_DONE="Done"

# Workflow State IDs
LINEAR_STATE_OPEN_ID="1160621c-7a00-4945-9093-47ba33862b7e"
LINEAR_STATE_IN_PROGRESS_ID="d8f29981-a8ce-451d-8910-ca8c04af01b2"
LINEAR_STATE_IN_REVIEW_ID="9646d767-0fa0-4163-8315-1c2a4fa9fad0"
LINEAR_STATE_DONE_ID="3dce5724-2643-4151-a66b-7f7b8d152bd2"
LINEAR_STATE_STAGING_ID="b2159f55-fdd9-42d1-bf28-3a71fb0e56f7"

# Kiro label ID (required for task-creator)
LINEAR_LABEL_KIRO_ID="c7ce3962-247b-49d3-819b-4b5142741442"

# Mercury project ID (auto-adds issues to Mercury project)
LINEAR_PROJECT_MERCURY_ID="10004248-b69d-4a76-825a-83d5628571c8"

# =============================================================================
# WORKTREE + REVIEW CONFIG
# =============================================================================
AGENT_WORKTREE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/../opensaas-agent"
REVIEW_MODEL="nvidia/moonshotai/kimi-k2.5"
OPENCODE_CMD="/opt/homebrew/bin/opencode"
REVIEW_TIMEOUT=600  # 10 min — reviews take 2-5 min, kill if hung

# linear oauth (agent identity — for sending agent activities)
LINEAR_OAUTH_CLIENT_ID="83e3d4cd417ac427494d5a811438c4cb"
LINEAR_OAUTH_CLIENT_SECRET="efb3d3cd56358291c8ce1c0e5f2d1391"
