# dialer stream agent instructions

This stream owns dialer behavior across queue lifecycle, call orchestration, caller ID selection, Twilio-facing flows, dialer UI, and dialer scenario verification.

## read order

1. Root AGENTS.md
2. Root CODING-STANDARDS.md
3. This file
4. Nearby package or feature docs for the files being changed

## operating rules

- Work on stream/dialer only for dialer tasks unless ko explicitly selects another stream.
- Preserve multi-tenant production behavior; never assume a single workspace or single caller ID environment.
- Read the full queue/call lifecycle before editing isolated UI or Twilio call handling code.
- Verify call-flow changes with the most specific available scenario or runtime check, not syntax alone.
- Keep customer-facing dialer state boring: no invalid current-contact display, no overlapping call ownership, no hidden retry loops.

## validation

For dialer changes, prefer focused scenario checks and package-specific tests before broad review. If runtime behavior is involved, inspect Railway logs or run the scenario harness when credentials and environment allow it.
