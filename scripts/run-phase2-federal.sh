#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Phase 2: Federal Data Integration
# DEV-990 (Congress.gov pull) + DEV-992 (normalization)
# DEV-991 deferred (GovInfo not needed — Congress.gov has text URLs)
#
# What this does:
# 1. kiro-cli creates postgres tables on EC2
# 2. kiro-cli writes Node.js pull scripts
# 3. kiro-cli SCPs scripts to EC2 and starts the pull
# 4. Pull runs overnight (~20 hours for 67K bills + 20K amendments)
#
# Usage: bash scripts/run-phase2-federal.sh

SSH_KEY="$HOME/.ssh/openpalantir.pem"
EC2_HOST="ec2-user@3.80.35.87"
SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no $EC2_HOST"
LOG_DIR="$HOME/Dev/opensaas/logs/phase2"
mkdir -p "$LOG_DIR"

echo "═══════════════════════════════════════════════════"
echo "  Phase 2: Federal Data Integration"
echo "  DEV-990 + DEV-992"
echo "═══════════════════════════════════════════════════"
echo ""

# ─── Task 1: Create tables + write pull scripts via kiro-cli ───
echo "▶ [1/3] Creating tables and pull scripts via kiro-cli..."

kiro-cli chat --trust-all-tools --no-interactive <<'KIRO_PROMPT' 2>&1 | tee "$LOG_DIR/task1-tables-and-scripts.log"
You are implementing Phase 2 of the Consuelo/Delilah project — federal data integration from Congress.gov.

## SSH/DB Access
- SSH: `ssh -i ~/.ssh/openpalantir.pem ec2-user@3.80.35.87`
- DB: `sudo -u postgres psql -d openstatesorg`
- API key on EC2: `CONGRESS_API_KEY=ElKvzrOne8hitt5gleh1PtAcwmF0BAeH24x9Yi3O`

## Step 1: Create all postgres tables on EC2

SSH to EC2 and run this SQL via psql:

```sql
CREATE TABLE IF NOT EXISTS congress_session (
  id SERIAL PRIMARY KEY,
  congress INT NOT NULL,
  session_number INT NOT NULL,
  start_date DATE,
  end_date DATE,
  UNIQUE(congress, session_number)
);

CREATE TABLE IF NOT EXISTS congress_bill (
  id SERIAL PRIMARY KEY,
  congress INT NOT NULL,
  bill_type VARCHAR(10) NOT NULL,
  bill_number INT NOT NULL,
  title TEXT,
  introduced_date DATE,
  latest_action_date DATE,
  latest_action_text TEXT,
  origin_chamber VARCHAR(10),
  origin_chamber_code VARCHAR(2),
  policy_area TEXT,
  congress_gov_url TEXT,
  update_date TIMESTAMPTZ,
  raw_json JSONB,
  search_vector tsvector,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(congress, bill_type, bill_number)
);
CREATE INDEX IF NOT EXISTS idx_cb_congress ON congress_bill(congress);
CREATE INDEX IF NOT EXISTS idx_cb_search ON congress_bill USING gin(search_vector);

CREATE TABLE IF NOT EXISTS congress_bill_action (
  id SERIAL PRIMARY KEY,
  bill_id INT REFERENCES congress_bill(id),
  action_date DATE,
  action_text TEXT,
  action_type VARCHAR(100),
  chamber VARCHAR(20),
  action_order INT
);
CREATE INDEX IF NOT EXISTS idx_cba_bill ON congress_bill_action(bill_id);

CREATE TABLE IF NOT EXISTS congress_bill_text (
  id SERIAL PRIMARY KEY,
  bill_id INT REFERENCES congress_bill(id),
  version_type VARCHAR(100),
  version_date DATE,
  url_html TEXT,
  url_pdf TEXT,
  url_xml TEXT,
  UNIQUE(bill_id, version_type)
);

CREATE TABLE IF NOT EXISTS congress_member (
  id SERIAL PRIMARY KEY,
  bioguide_id VARCHAR(20) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  full_name VARCHAR(200),
  party VARCHAR(50),
  state VARCHAR(50),
  district INT,
  chamber VARCHAR(30),
  image_url TEXT,
  raw_json JSONB
);

CREATE TABLE IF NOT EXISTS congress_bill_sponsor (
  id SERIAL PRIMARY KEY,
  bill_id INT REFERENCES congress_bill(id),
  bioguide_id VARCHAR(20),
  full_name VARCHAR(200),
  party VARCHAR(10),
  state VARCHAR(50),
  is_cosponsor BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_cbs_bill ON congress_bill_sponsor(bill_id);
CREATE INDEX IF NOT EXISTS idx_cbs_bio ON congress_bill_sponsor(bioguide_id);

CREATE TABLE IF NOT EXISTS congress_amendment (
  id SERIAL PRIMARY KEY,
  congress INT NOT NULL,
  amendment_type VARCHAR(10) NOT NULL,
  amendment_number INT NOT NULL,
  purpose TEXT,
  description TEXT,
  chamber VARCHAR(20),
  bill_id INT REFERENCES congress_bill(id),
  sponsor_bioguide VARCHAR(20),
  sponsor_name VARCHAR(200),
  latest_action_date DATE,
  latest_action_text TEXT,
  raw_json JSONB,
  UNIQUE(congress, amendment_type, amendment_number)
);
CREATE INDEX IF NOT EXISTS idx_ca_bill ON congress_amendment(bill_id);

CREATE TABLE IF NOT EXISTS congress_vote (
  id SERIAL PRIMARY KEY,
  congress INT NOT NULL,
  session_number INT NOT NULL,
  chamber VARCHAR(10) NOT NULL,
  roll_call_number INT NOT NULL,
  bill_id INT REFERENCES congress_bill(id),
  vote_date DATE,
  question TEXT,
  result TEXT,
  yea_count INT,
  nay_count INT,
  not_voting_count INT,
  present_count INT,
  UNIQUE(congress, session_number, chamber, roll_call_number)
);

CREATE TABLE IF NOT EXISTS congress_vote_detail (
  id SERIAL PRIMARY KEY,
  vote_id INT REFERENCES congress_vote(id),
  bioguide_id VARCHAR(20),
  member_name VARCHAR(200),
  party VARCHAR(10),
  state VARCHAR(50),
  vote_cast VARCHAR(20)
);
CREATE INDEX IF NOT EXISTS idx_cvd_vote ON congress_vote_detail(vote_id);
CREATE INDEX IF NOT EXISTS idx_cvd_bio ON congress_vote_detail(bioguide_id);
```

Verify all tables exist after creation.

## Step 2: Populate congress_session

```sql
INSERT INTO congress_session (congress, session_number, start_date, end_date) VALUES
(116, 1, '2019-01-03', '2020-01-03'),
(116, 2, '2020-01-03', '2021-01-03'),
(117, 1, '2021-01-03', '2022-01-03'),
(117, 2, '2022-01-03', '2023-01-03'),
(118, 1, '2023-01-03', '2024-01-03'),
(118, 2, '2024-01-03', '2025-01-03'),
(119, 1, '2025-01-03', '2026-01-03'),
(119, 2, '2026-01-03', '2027-01-03')
ON CONFLICT DO NOTHING;
```

## Step 3: Add US to state_mapping

```sql
INSERT INTO state_mapping (state_abbr, state_name, jurisdiction_id)
VALUES ('US', 'United States', 'ocd-jurisdiction/country:us/government')
ON CONFLICT DO NOTHING;
```

## Step 4: Write the Node.js pull script

Create a file at `/home/ec2-user/federal-pull/pull-congress.js` on EC2. The script must:

1. Use only built-in Node.js modules (https, pg via the already-installed node-postgres)
2. Connect to postgres: `postgresql://postgres:openpalantir2026@localhost/openstatesorg`
3. Pull from Congress.gov API with key `ElKvzrOne8hitt5gleh1PtAcwmF0BAeH24x9Yi3O`
4. Process in this order:
   a. Members first (small, needed for FK references)
   b. Bill lists for each congress (116-119), inserting into congress_bill
   c. Bill detail for each bill (sponsors, text versions, actions)
   d. Amendment lists for each congress
5. Rate limit: 750ms between API calls
6. Resume-safe: use INSERT ... ON CONFLICT DO NOTHING
7. Log progress every 100 items
8. Handle pagination (offset parameter, 250 items per page for efficiency)
9. On completion, update search_vector:
   ```sql
   UPDATE congress_bill SET search_vector =
     setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
     setweight(to_tsvector('english', coalesce(policy_area, '')), 'B');
   ```
10. Then populate id_mapping for all congress entities

Make sure to `mkdir -p /home/ec2-user/federal-pull` first, install pg if needed (`cd /home/ec2-user/federal-pull && npm init -y && npm install pg`), then write the script.

The script should be runnable as: `cd /home/ec2-user/federal-pull && node pull-congress.js`

## Step 5: Start the pull in a tmux session

```bash
tmux new-session -d -s federal-pull 'cd /home/ec2-user/federal-pull && node pull-congress.js 2>&1 | tee pull.log'
```

This way it runs in the background and we can check progress with `tmux attach -t federal-pull`.

## IMPORTANT
- Do NOT ask for confirmation. Execute everything.
- Verify tables exist after creation.
- Verify the script starts successfully (check first few lines of output).
- Report final status: tables created, script running, estimated completion time.
KIRO_PROMPT

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Task 1 complete. Check logs at:"
echo "  $LOG_DIR/task1-tables-and-scripts.log"
echo ""
echo "  To monitor the pull:"
echo "  ssh -i ~/.ssh/openpalantir.pem ec2-user@3.80.35.87"
echo "  tmux attach -t federal-pull"
echo ""
echo "  Pull will take ~20 hours for 67K bills."
echo "  Check progress: tail -f /home/ec2-user/federal-pull/pull.log"
echo "═══════════════════════════════════════════════════"
