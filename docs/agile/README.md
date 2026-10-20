# How TrustVault is built (agile)

TrustVault is developed in short Scrum-style sprints. The product owner reviews the running app, the review becomes user stories with acceptance criteria, each story is built and tested, and the sprint ends with a review (before/after evidence) and a retrospective.

| Role | Who |
|---|---|
| Product owner | SriNithish J K - decides what matters, accepts or rejects each story |
| Developer / tester | Claude (AI pair) - designs, builds, tests and documents |

## The loop

1. **Review** - the product owner walks through the app and points at what is wrong or missing (screenshots + notes).
2. **Backlog** - every point becomes a user story ("As a ..., I want ..., so that ...") with a priority, an estimate and acceptance criteria. Bugs found on the way are added too.
3. **Build** - one story at a time. Each one is checked in a real browser before moving on.
4. **Test** - automated tests are added for the new behaviour, then all suites run: unit, end-to-end (API) and browser (every page, every role, both themes, four screen sizes).
5. **Sprint review** - before/after screenshots and test results against the acceptance criteria.
6. **Retrospective** - what went well, what to improve next sprint.
7. **CI/CD** - every push runs the same tests on GitHub; the live site deploys only when all of them pass.

## Definition of done (every story)

- Acceptance criteria met and seen in a real browser screenshot
- Unit, end-to-end and browser test suites green, with a test for the new behaviour
- Dark and light theme, desktop to phone, keyboard reachable, "reduce motion" respected
- No console errors
- Committed with a clear message, documents updated

## Documents

| Sprint | Backlog | Review + retrospective |
|---|---|---|
| Sprint 2 - UI review (20 Oct 2026) | [sprint-2-backlog.md](sprint-2-backlog.md) | [sprint-2-review.md](sprint-2-review.md) |

Pipeline: [ci-cd.md](ci-cd.md).
