# Consuelo OS Final Audit Records

This directory is the repository summary layer for Worker 23. Each assigned worker performs the review directly under `workers/independent-review-framework.md`; no delegated model or review subagent is invoked. GitHub remains the durable source of truth for code-review comments, structured review objects, agent-fix prompts, repair links, waivers, and dispositions.

Audit sequence:

1. Freeze the exact final candidate SHA and recover the baseline or merge-base evidence.
2. Select the authoritative GitHub review surface: prefer the dedicated review-only comparison PR; otherwise use the immutable ordinary promotion PR or exact GitHub comparison.
3. Run domain audits 23a through 23g against the same exact candidate SHA. Missing synthetic audit branches or the dedicated PR do not block code inspection.
4. Record findings and repair ownership in `finding-ledger.md`.
5. Freeze the repaired candidate SHA and rerun affected audits.
6. Run the fresh 23h cross-wave audit and record `GO` or `NO-GO`.

Files in this directory are committed templates. Audit agents replace template fields with evidence; they do not delete required sections. A report without matching GitHub review evidence is incomplete.
