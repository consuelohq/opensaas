# <RD work ID> receipt

Each node owns only its receipt. RD0 owns graph/coordination changes.
Use one of: not_started, active, blocked, validated_pending_promotion, integrated,
released. Product alignment can separately remain alignment_open.
Replace placeholders with observed values; unknown is an acceptable honest value.

- Work ID / graph revision:
- Observation timestamp:
- Status:
- Scope and approved decisions:
- Task session / branch / worktree:
- Task PR:
- Task head SHA:
- Integration target: stream/dialer
- Stream review PR:
- Integration evidence:
- Prerequisites and their current PR/commit evidence:
- Owned files/modules:
- Changed behavior:
- Acceptance checks and exact results:
- Review/check state and unresolved findings:
- Limitations / blockers:
- Cleanup completed or precise preservation reason:
- Suggested next ready ID and evidence:
- Next prompt or required decision:

A committed receipt is a historical observation. Resolve task PR merge state,
integration SHA, current stream tip and late reviews live before deciding readiness.
Do not make endless follow-up commits solely to record the commit that contains
this receipt. Put post-promotion evidence in the final coordinator handoff.
