# Consuelo OS Final Audit Records

This directory is the repository summary layer for Worker 23. GitHub remains the durable source of truth for code-review comments, structured review objects, agent-fix prompts, repair links, waivers, and dispositions.

Audit sequence:

1. Freeze the verified baseline SHA and final candidate SHA.
2. Open the canonical review-only GitHub comparison PR.
3. Run domain audits 23a through 23g against the same candidate SHA.
4. Record findings and repair ownership in `finding-ledger.md`.
5. Freeze the repaired candidate SHA and rerun affected audits.
6. Run the fresh 23h cross-wave audit and record `GO` or `NO-GO`.

Files in this directory are committed templates. Audit agents replace template fields with evidence; they do not delete required sections. A report without matching GitHub review evidence is incomplete.
