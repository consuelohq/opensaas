# Google

Use the Consuelo OS tool `google` for Google Workspace work. The underlying command runtime is managed by OS; do not install OpenClaw, run package-manager setup, or ask the user to manage the implementation CLI.

## Supported services

Use this skill for Gmail, Calendar, Drive, Docs, Sheets, and Contacts. The current Google runtime supports modern Docs editing as well as reads, so prefer the native tool instead of assuming documents are export-only.

## First use

Call `google` normally. If the Google account has not been connected yet, OS starts browser OAuth on the user's node, saves the refresh token in the platform keyring, and reuses that connection later. Do not ask the user to create an OAuth client or paste client secrets.

## Tool shape

The `google` tool has three actions: `status`, `connect`, and `run`. For `run`, pass the service command as an argv array, for example `['gmail', 'search', 'newer_than:7d']` or `['docs', 'cat', '<document-id>']`. Do not include wrapper-owned global flags such as JSON, readonly, access-token, account, client, force, or no-input flags; OS controls those.

## Read and write policy

Reads use `mode: 'read'` (the default). OS enforces the runtime's read-only HTTP guard.

Mutations use `mode: 'write'` and require explicit user approval before execution. This includes sending mail, creating or changing events, uploading or sharing Drive files, editing Docs or Sheets, and creating or changing contacts. Never turn a read into a write merely to make a command succeed.

After first-time OAuth, a read may be retried automatically. Do not automatically replay a write after authorization; require the approved write call to execute only once after the connection is ready.

## Common command families

Gmail: search, get, threads, attachments, labels, drafts, send.

Calendar: calendars, events, free/busy, create, update, delete, RSVP.

Drive: search, list, get, download, upload, move, copy, share.

Docs: info, cat, create, export, edit, insert, update, delete, find-replace, patch, prepend, append, clear, set, style, headings, tables, images, page breaks, comments.

Sheets: get, values, metadata, create, update, append, clear, formatting and structural mutations supported by the installed runtime.

Contacts: list, search, get, create, update, delete where supported by the installed runtime.

When unsure of exact argv for a less common operation, use the installed Google command schema/help through the native wrapper rather than inventing flags.
