# Redesign brief: /admin/tasks

Paste this file into the repo root and tell Claude Code: "Read ADMIN-TASKS-REDESIGN.md and implement it."

## Stack (confirmed from the live site)

- Next.js App Router (`_next/static/chunks`, Turbopack), deployed on Vercel
- Tailwind CSS utility classes
- `next/font`: Inter (sans) + Libre Baskerville (serif display)
- Existing custom class in use: `section-label`
- Route to change: the page component serving `/admin/tasks`

Match the existing visual language. Do not introduce a component library, a CSS-in-JS layer, or a new font. Tailwind utilities only.

## Current state

One page, stacked vertically, roughly 2,500px tall:

1. Page header ("Tasks" / "Templates, assignments, progress"), a "New stage name" input, an "+ Add Stage" button
2. A global search input
3. "Assign Task to Client" card: client `<select>` (38 clients), due-date input, "Assign" button, and a scrolling checkbox list of every task grouped by stage
4. "Assigned Tasks" section: flat list grouped by client
5. All 7 stage panels fully expanded, every task row rendered

Stages and counts today (do not change the data, only the presentation):

| Stage | Tasks |
|---|---|
| Onboarding | 8 |
| Onboarding w/o children | 5 |
| Discovery | 4 |
| Case Prep Stage | 5 |
| Mediation Prep | 3 |
| Trial Prep | 1 |
| Post Case | 3 |

Task rows carry optional badges: `Form`, `Signature`, and a 📝 marker. Row actions are `Open`, `Edit`, `Delete`. Stage headers have `Rename` and a task count.

## The four problems to solve

### 1. Everything on one long page

Split the page into three tabs directly under the page header. Tabs control local state only, no route change, no data refetch.

- **Assign** (default tab): the assign panel plus the per-client progress view
- **Templates**: the 7 stage panels
- **Progress**: full per-client rollup

Within the **Templates** tab, make every stage panel collapsible.

- Collapsed by default on load, except any stage the user last had open (persist the open/closed set in `localStorage` under `efl.admin.tasks.openStages`)
- Stage header stays visible when collapsed and shows: stage name, task count, and a chevron that rotates on toggle
- Header is a `<button>` with `aria-expanded` and `aria-controls`; the panel body gets a matching `id`
- Keep `Rename` and `+ Add Task` reachable, but move them into the expanded body so the collapsed header stays clean
- Add "Expand all" / "Collapse all" text buttons above the stage list

Give the page a max width (`max-w-6xl mx-auto`) so rows do not stretch edge to edge on a wide monitor. Right now the Open/Edit/Delete links sit a full screen away from the task name they belong to, which is a large part of why the page feels unwieldy.

### 2. Assigning tasks is tedious

Replace the current client `<select>` and unfiltered checkbox list.

**Client picker.** Swap the native `<select>` for a typeahead combobox. Filter the 38 clients as the user types, match on substring anywhere in the name (not just prefix, since names are stored "Last, First"). Full keyboard support: up/down to move, Enter to select, Escape to close. Show the selected client as a dismissible chip.

**Task picker.** Keep the grouped checkbox list but add:

- A filter input above it that narrows tasks by name in real time, keeping stage group headers that still have matches and hiding empty groups
- A "Select all in stage" checkbox on each stage group header, rendering indeterminate when the stage is partially selected
- A running count near the Assign button: "Assign 6 tasks to Grey, C"
- Raise the list max-height so more rows are visible at once, roughly `max-h-[420px] overflow-y-auto`

**Bulk assign.** Allow multiple clients to be selected at once. The chip row holds several clients; Assign then applies the checked tasks to every selected client with the same optional due date. Confirm before writing when the operation touches more than 20 client-task pairs.

**Disabled state.** The Assign button is disabled until at least one client and one task are selected. Add a `title` explaining why when disabled.

**Feedback.** After a successful assign, show an inline success banner naming what happened ("Assigned 6 tasks to 2 clients") with an Undo action that stays live for 10 seconds. Clear the selections. Do not reload the page.

### 3. Hard to see client progress

Today "Assigned Tasks" is a flat list keyed by client with no sense of completion.

Build a per-client progress view for the **Progress** tab:

- One card per client that has at least one assigned task, sorted by most overdue first, then by name
- Card header: client name, a slim progress bar, and "3 of 7 done"
- Card body: assigned tasks grouped by stage, each row showing task name, stage, due date, and status
- Status pills: `Done` (green), `Overdue` (red, due date in the past and not done), `Due soon` (amber, within 7 days), `Open` (gray)
- Keep the existing inline controls on each row: due-date input, `Clear`, `done`, `Remove`
- Collapse each client card to just the header plus progress bar by default; expand on click

Add a summary strip at the top of the tab: total clients with open tasks, total overdue tasks, total due this week. Make the overdue number a filter toggle that narrows the cards to clients with overdue work.

Also surface a compact version of this on the **Assign** tab: once a client is selected, show that one client's current progress card beside the assign panel, so you can see what they already have before assigning more.

### 4. Visual polish and density

- **Two-column layout on the Assign tab** at `lg:` and up: assign panel on the left (roughly 60%), selected-client progress on the right. Single column below `lg`.
- **Row actions.** `Open` / `Edit` / `Delete` are currently tiny text links pinned far right. Convert to icon buttons with `aria-label` and tooltips, grouped in a single cluster, always at a fixed distance from the row content rather than the viewport edge. Make `Delete` red only on hover so the rows are not visually noisy at rest. Keep the hit target at least 32px square.
- **Delete confirmation.** Deleting a task or stage must confirm first, naming the item. Deleting a stage that still contains tasks must say how many will go with it.
- **Stage headers.** Use the Libre Baskerville display font already loaded, a subtle background tint, and a left accent border. Give each stage a stable accent color so they are distinguishable at a glance; derive it from the stage index so new stages get one automatically.
- **Badges.** `Form` and `Signature` should be small pill badges with consistent color coding, not plain text. Replace the bare 📝 emoji with a labeled badge so its meaning is clear; if it marks "has instructions" or "has a note," say so in the badge or its tooltip.
- **Row density.** Tighten vertical padding on task rows, add a hover background, and add zebra striping or hairline dividers so a 40-row list is scannable.
- **Empty states.** Every stage with no tasks, and the Progress tab with no assigned work, needs a short empty-state message with the relevant action button. No blank panels.
- **Loading and error states.** Skeleton rows while data loads. If an assign, rename, or delete fails, show an inline error on the affected element with a retry, not a silent failure.
- **Sticky header.** Keep the page header and tab bar sticky at the top on scroll.

## Constraints

- Do not change any task names, stage names, or the underlying data model. This is a presentation and interaction change only.
- Preserve every existing capability: add stage, rename stage, add task, edit task, delete task, open task, assign to client with due date, mark done, clear due date, remove assignment, and global search.
- Global search must keep working across all three tabs. When a search term is active, auto-switch to the tab with matches and auto-expand stages that contain them.
- Keep it accessible: real buttons, `aria-expanded` on collapsibles, labels on every input, visible focus rings, full keyboard operation of the combobox and tabs.
- Mobile: stack to one column below `lg`, keep tap targets at 44px, do not horizontally scroll.
- Do not add a state management library. React state plus `localStorage` is enough.

## Build order

Ship in this sequence so each step is independently reviewable:

1. Max-width container, sticky header, tab shell with the three tabs. No behavior change yet.
2. Collapsible stage panels with `localStorage` persistence, expand/collapse all.
3. Row action icon buttons, badges, density, hover states, empty states, delete confirmations.
4. Client combobox and task filter, select-all-in-stage, running count, disabled state, success banner with undo.
5. Multi-client bulk assign.
6. Progress tab: client cards, progress bars, status pills, summary strip, overdue filter.
7. Selected-client progress panel on the Assign tab.

## Verification before deploy

- Assign a task to one client, confirm it appears in Progress with the right status pill
- Assign the same task to three clients at once, confirm all three
- Mark one done, confirm the progress bar and counts update without a reload
- Set a past due date, confirm the row shows `Overdue` and the client sorts to the top
- Collapse two stages, reload the page, confirm they are still collapsed
- Search a term that only appears in Post Case, confirm the tab switches and the stage auto-expands
- Tab through the combobox, the task list, and the stage headers using only the keyboard
- Check at 1440px, 1024px, and 390px widths
- Confirm the Vercel preview build passes before promoting to production
