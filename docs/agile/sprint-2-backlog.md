# Sprint 2 - UI review sprint (20 Oct 2026)

**Sprint goal:** turn the product owner's UI review of the signed-in app into a calmer, interactive, easy-to-use product, without changing the approved neon look, and prove every change with tests and before/after screenshots.

**Status:** completed 20 Oct 2026 - see the [sprint review](sprint-2-review.md) for results, before/after screenshots and the retrospective.

**Process:** Scrum-style sprint of one day. Product owner: SriNithish J K. Developer: Claude (pair). Review input: the owner's walkthrough of Home, Vault, Security & profile, Activity log and Student records (5 screenshots, 20 Oct).

Estimates are story points (1 = an hour or less, 3 = half a day, 5 = most of a day).

## Product backlog for this sprint

| ID | User story | Points | Priority |
|---|---|---|---|
| US-1 | As a **user**, I want my home page to show only what matters (my requests or to-dos, my documents, a short recent-activity column) so it does not feel empty in one place and endless in another. | 3 | Must |
| US-2 | As a **user**, I want recent activity to be a compact column with repeats grouped, so a batch request to 4 students is one line, not four. | 2 | Must |
| US-3 | As a **user**, I want the Vault page to feel alive and interactive (status at a glance, motion, drag-and-drop upload) instead of blank placeholder rows. | 5 | Must |
| US-4 | As a **user**, I want Security & profile to open one section at a time (Overview shows a summary of every section; clicking a section shows only that section, with its own link). | 3 | Must |
| US-5 | As a **user**, I want the Activity log to be easy to scan: grouped repeats, search, filters, and pages instead of one long stack. | 3 | Must |
| US-6 | As **faculty**, I want to type a batch (26, 23MX, 24...) or pick "All" and see exactly the students of that batch as profile cards, then ask the whole batch. | 3 | Must |
| US-7 | As a **user**, I want a subtle moving background in the signed-in app that never slows the page down. | 2 | Should |
| US-8 | As the **team**, we want a CI/CD pipeline that runs every test suite (unit, end-to-end, browser) and deploys only when everything is green. | 2 | Must |
| US-9 | As the **team**, we want the app checked on several browsers and screen sizes. | 2 | Should |
| BUG-1 | Faculty and administrators see a "Student ID / Roll number - Not added yet" warning on Security. | 1 | Must |
| BUG-2 | Faculty and administrators see "School marksheets" and "College documents" sections in their own vault. | 1 | Should |

## Acceptance criteria

**US-1 Home**
- Student: "Needs you" and "Your documents" side by side, "Recent activity" as a narrow right-hand column on wide screens.
- Faculty: "Your requests", "Your batches" and "Your documents" in the main column, recent activity on the right; no large empty area under the cards.
- Administrator: "College at a glance", "Requests waiting" and recent activity.
- On phones everything stacks in one column in the same order.

**US-2 Recent activity column**
- Shows at most 6 rows; consecutive identical events are one row with a "×N" count.
- Never grows taller than the column; "Full timeline" opens the Activity log.

**US-3 Vault**
- A vault status panel: animated completion ring, the 4 required documents as a step track (each missing one is a button that opens upload for that type), and live counts.
- Document cards reveal with a staggered animation, tilt toward the pointer, and show a shimmer on hover; verified cards carry a seal.
- Empty slots are drop zones: dragging a file onto one opens the upload window with that type and file ready; dragging a file anywhere on the page shows a "drop to upload" overlay.
- All motion is off with "reduce motion".

**US-4 Security & profile**
- Tabs: Overview, Personal info, Sign-in & security, Your devices, Preferences, Delete account.
- Overview: the security score plus one summary tile per section (status line + "Open"), nothing else.
- Each tab shows only its own section; the URL changes (`/security?tab=devices`) so Back and links work.
- Faculty and administrators do not see the roll-number row (BUG-1).

**US-5 Activity log**
- Consecutive identical events are grouped ("Access requested ×4"), expandable.
- Search box, category filters with counts, 15 rows per page with page controls; summary panel stays beside the list.
- Rows are compact single lines, not tall cards.

**US-6 Student records**
- Batch chips (All, 23MX, 24MX, ...) with student counts, plus a box where typing "26", "26MX" or "23" selects that batch; empty input or "All" shows everyone.
- The selected batch's students appear as profile cards (initials, roll number, verified documents, access status) before the request form.
- A batch with no students says so and suggests the batches that exist.
- "Ask this batch" uses the selected batch; it is disabled for "All".
- The server supports `GET /records/students?batch=23MX` and `GET /records/batches`.

**US-7 Background**
- A slow, low-contrast animated background behind the signed-in app, paused in hidden tabs and off with reduced motion; scrolling stays at 60 fps.

**US-8 CI/CD**
- GitHub Actions: lint + unit, build, end-to-end, and browser (UI) jobs; deploy job runs only on `main` after all pass and only if a deploy hook secret is configured.

**US-9 Cross-platform**
- Chrome and Edge; phone (390 px), tablet (768 px), laptop (1366 px), desktop (1920 px); dark and light.

## Definition of done
1. Acceptance criteria met and seen in a real browser screenshot.
2. Unit, end-to-end and browser test suites all green; new behaviour covered by a test.
3. Works in dark and light, desktop and phone; keyboard reachable; reduced motion respected.
4. No console errors.
5. Committed with a clear message; docs updated.
