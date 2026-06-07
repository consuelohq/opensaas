Research Ingest
Use the workspace research:ingest tool to turn research sources into durable context before analysis.

This skill is specifically for the research ingestion workflow Ko built. It is not the general task lifecycle skill.

Core rule
When Ko provides a YouTube link, podcast link, paper, PDF, article, report, web page, or local media/source and wants to learn from it or discuss it, ingest the source first through research.ingest unless Ko explicitly says not to.

Successful ingest automatically saves a self-contained text bundle to context. Do not add an extra approval step for context save.

Source handling
Use this workflow for:

YouTube links and video links
Podcast episode links, podcast RSS links, Apple Podcasts or Spotify episode pages
PDFs, papers, reports, arXiv links, whitepapers, and long articles
Local files or media paths that Ko asks to ingest
Multi-source research where durable comparison or reuse matters
For a simple uploaded PDF that Ko only wants answered once, direct file reading can be acceptable. Prefer research:ingest when durability, repeatability, later recall, podcasts, videos, or links are involved.

Workspace tools
The workspace app exposes:

os.get_steering()
os.call({ tool, input, taskSession, timeout })
Use typed facade calls. For research ingestion, the normal call is:

await os.call({
  tool: "research.ingest",
  input: {
    source: "<url-or-file>",
    question: "<what Ko wants to learn>",
    visual: false
  },
  timeout: 600,
})
Use visual: true only when visual content matters: slides, diagrams, demos, screen recordings, whiteboards, charts, or UI walkthroughs.

await os.call({
  tool: "research.ingest",
  input: {
    source: "<video-url>",
    question: "<what Ko wants to learn>",
    visual: true,
    slidesMax: 8
  },
  timeout: 600,
})
Use contextTitle when Ko gives a clear title or when a better durable title is obvious:

await os.call({
  tool: "research.ingest",
  input: {
    source: "<source>",
    question: "<question>",
    contextTitle: "Research Bundle: <clear title>"
  },
  timeout: 600,
})
Do not use noContextSave in normal user-facing work. It is only for tests/debugging or when Ko explicitly asks not to save.

Output artifacts
A successful ingest creates a run directory with text artifacts:

packet.md — human-friendly brief and start-here document
extracted.md — full extracted source text or transcript
manifest.json — machine-readable index and provenance
context-bundle.md — full text bundle saved to context
summary.json and raw logs for debugging
optional slides/ only when visual extraction is enabled
The context entry must contain the full text of:

packet.md
extracted.md
manifest.json
Do not replace these full contents with paths only. Paths may appear inside the bundle, but the bundle must be self-contained.

Default behavior
Load steering once if it has not already been loaded this conversation.
Call research.ingest with the source and Ko's question.
Let research.ingest autosave the full text bundle to context.
Use the returned packet/context information as the grounding source for the next response.
Answer Ko from the ingested source, making uncertainty explicit when extraction failed or was partial.
If the ingest fails, inspect the returned error and raw-log path when available. Do not pretend the source was read. Explain what failed and suggest the narrowest retry: different link, visual: false, videoMode: "transcript", videoMode: "understand", local file path, or manual upload.

Question mapping
Map Ko's natural language to question:

“learn from this” → question: "what are the key ideas, useful lessons, and actions to take from this source?"
“summarize this” → question: "summarize the source accurately with key claims and supporting details"
“turn this into a plan” → question: "extract the actionable strategy and turn it into a concrete plan"
“compare these” → ingest each source separately, then compare saved bundles
“explain like i'm 5” → ingest first, then explain simply from the bundle
Visual extraction guidance
Use visual: true when the video likely contains important on-screen information. Keep frame budgets small by default:

quick look: slidesMax: 4
normal video: slidesMax: 8
dense technical talk or demo: slidesMax: 16
Do not add separate OCR, visual digests, or image handling outside research.ingest. The tool already owns artifact creation. This skill should not invent extra files.

Cleanup and durability
Default run artifacts are under the operating system temp directory, so local frames/slides can be temporary. This is okay because the text context bundle is durable.

Use keep: true only when Ko wants durable local files in addition to saved context.

Use outDir only when Ko requests a specific local location.

After ingest: what to do next
After successful ingest, respond with a concise confirmation and immediately help with Ko's requested analysis. Include:

the fact that the bundle was saved to context
what source was ingested
whether visual extraction was used, if relevant
a useful first answer from the packet/extracted text
Do not stop at “ingested successfully” if Ko asked a substantive question. Ingest is the setup step; the answer should use the saved bundle.

Multiple sources
For multiple links or files:

Ingest each source separately.
Give each one a clear contextTitle.
Confirm which ingests succeeded or failed.
Compare or synthesize only from successful bundles unless Ko asks to proceed with partial data.
Privacy and safety
Do not print secrets, raw tokens, credentials, full phone numbers, or sensitive payloads from extracted material unless Ko explicitly needs them and it is safe. Redact sensitive runtime details in summaries.

Do not use external web browsing as a substitute for ingestion when Ko asks to process a specific source. Use web only for current context around the source when it materially helps and the source itself has already been ingested or cannot be ingested.


Try in chat