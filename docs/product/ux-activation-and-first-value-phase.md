# ux activation and first-value phase

## purpose

this doc turns the current product ux discussion into one implementation phase plus copy-pasteable subtasks.

the core principle is simple: the product should not make new users learn the whole system before they get value. it should guide them to their first real win with the fewest decisions possible.

for consuelo, the first-value path is:

1. import contacts
2. create or confirm a queue
3. place a first call
4. complete post-call follow-up
5. return to a dashboard that tells the user what to do next

## phase

### [phase] improve activation ux and guide users to first value

#### goal

reduce confusion for first-time and low-frequency users by making the main path more opinionated, more contextual, and easier to recover when users are unsure what to do next.

#### success criteria

- a new user can move from empty workspace to first completed call without needing docs or human intervention
- the dashboard always presents a single clear next step for users who are not yet activated
- import, queue creation, and first-call setup feel like one connected journey instead of separate tools
- help, changelog, and product guidance are available in-context without overwhelming the main interface
- advanced functionality is available but does not dominate the default experience

#### scope

this phase covers dashboard guidance, activation flows, contextual help, and progressive disclosure patterns inside the app. it does not require a full redesign of the product shell.

## subtasks

### [task] build a next-best-action dashboard for non-activated users

#### objective

make the dashboard act as a guidance layer instead of a passive analytics surface.

#### implementation notes

- add a primary dashboard card that changes based on workspace state
- state examples:
  - no contacts imported -> import contacts
  - contacts imported but no queue -> create first queue
  - queue exists but no completed calls -> place first call
  - first call completed -> review coaching or complete follow-up actions
- keep analytics below the primary action area for early users
- support dismissible helper text, but do not let multiple calls to action compete for attention

#### acceptance criteria

- the dashboard shows exactly one primary next action for non-activated users
- the next action changes automatically based on user state
- the dashboard never feels empty, even in a brand-new workspace

### [task] convert import-to-queue setup into a stepped activation flow

#### objective

turn csv import, field mapping, review, and queue setup into one connected wizard.

#### implementation notes

- use a multi-step flow instead of a long form
- suggested steps:
  1. upload csv
  2. map fields
  3. review invalid rows and duplicates
  4. assign records to a queue or create a new one
  5. confirm import and continue to calling
- include progress indicators and simple back navigation
- preserve state between steps so users do not lose work

#### acceptance criteria

- a user can import contacts and land in queue setup without leaving the flow
- each step has a clear primary action and a concise explanation
- invalid rows, duplicates, and mapping issues are surfaced before final confirmation

### [task] create a first-call launch flow from queue setup

#### objective

bridge the gap between queue creation and the first actual call.

#### implementation notes

- after queue setup, route users into a first-call checklist or launch screen
- show only the minimum needed to start:
  - selected queue
  - calling number or dialer prerequisites
  - expected outcome of starting the queue
- include a short "what happens next" explanation before launch
- treat first call and first queue as part of the same activation milestone

#### acceptance criteria

- a user can go from queue creation to active calling without hunting through navigation
- the launch screen explains what will happen when the queue starts
- the app records first-call completion as an activation milestone

### [task] make calling and coaching a focused full-page work mode

#### objective

make the core calling experience feel like the product's primary job, not a small panel inside a crowded app shell.

#### implementation notes

- reduce non-essential navigation chrome in call mode
- prioritize contact context, live call controls, and coaching content
- keep post-call actions immediately available after hangup
- ensure call status, errors, and recoverable states are obvious
- define a stable layout for active call, wrap-up, and follow-up actions

#### acceptance criteria

- call mode uses a focused layout optimized for active work
- users can clearly see current call state and next required action
- post-call logging or coaching review is available without leaving the flow

### [task] add a contextual help modal with quick links and state-aware guidance

#### objective

give users lightweight help inside the app without forcing them into docs-first behavior.

#### implementation notes

- add a persistent help entry point, such as a bottom-left question-mark button
- the modal should contain:
  - docs link
  - changelog link
  - 3 short product messages or reminders
  - one recommended next step based on current page or user state
- make content contextual by page:
  - import page -> csv tips, sample file, mapping guidance
  - queue page -> queue behavior and setup tips
  - call page -> shortcuts, controls, disposition guidance
- support one-time highlights for important changes

#### acceptance criteria

- help is accessible from anywhere in the app
- modal content changes based on screen or user state
- users can reach docs and changelog from the modal in one click

### [task] reintroduce onboarding tours as secondary guidance, not the main system

#### objective

bring back tours, but use them to orient rather than to carry the full onboarding burden.

#### implementation notes

- keep tours short and optional
- use tours for layout explanation and feature discovery
- do not rely on tours to teach the main activation path
- trigger tours at stable points in the journey, not immediately on every first load
- allow users to restart the tour from help

#### acceptance criteria

- tours explain where things live without blocking task completion
- users can skip, exit, and restart tours
- the first-value path still works even if a user never runs the tour

### [task] hide advanced features behind progressive disclosure

#### objective

optimize the default experience for regular users while still preserving power-user functionality.

#### implementation notes

- define which controls are advanced in queue setup, calling, and dashboard surfaces
- collapse advanced controls behind labels like "advanced settings"
- only expose complex options when they are relevant to the current task
- avoid presenting every possible configuration before a user has completed their first call workflow

#### acceptance criteria

- the default flow favors common actions and simple choices
- advanced controls remain available without cluttering the main path
- regular users can complete the core workflow without understanding power-user features

### [task] design empty states and reassurance states as training surfaces

#### objective

replace blank or ambiguous screens with guided states that teach the next move.

#### implementation notes

- every empty state should include:
  - one sentence explaining value
  - one primary action
  - one concrete example of what success looks like
- add reassurance messages for key system events:
  - contacts imported
  - queue created
  - call connected
  - call ended
  - follow-up saved
- make system state visible in places where users commonly hesitate

#### acceptance criteria

- no major workflow screen appears blank or unclear
- important system transitions are confirmed in plain language
- users always know what just happened and what to do next

### [task] define changelog and product education triggers inside the app

#### objective

show product updates only when they matter to user behavior.

#### implementation notes

- use contextual in-app notices for meaningful workflow changes
- use the help modal as a secondary surface for product education
- avoid generic changelog spam
- define trigger logic for:
  - feature changes that affect the current page
  - major workflow changes for active users
  - new guidance for users who have not completed activation

#### acceptance criteria

- users only see changelog nudges when updates are relevant to them
- changelog messaging explains what changed, why it matters, and where to find it
- changelog notices do not interrupt core workflows unless the change is critical

## rollout recommendation

ship this phase in the following order:

1. next-best-action dashboard
2. stepped import-to-queue flow
3. first-call launch flow
4. focused full-page call mode
5. contextual help modal
6. tour reintroduction and advanced-feature disclosure cleanup

this order improves activation fastest while keeping implementation effort connected to the product's core path.

## product principle to preserve

the app does not mainly need more explanation. it needs stronger pathing.

when in doubt, choose the ux decision that removes a choice, clarifies the next step, or moves the user closer to their first completed call.
