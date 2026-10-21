# Sprint 3 review and retrospective - main page motion (20 Oct 2026)

Backlog and acceptance criteria: [sprint-3-backlog.md](sprint-3-backlog.md).

**Result:** all 4 stories done. 10 problems found while checking frames in a real browser, all fixed before release.

## Story by story

| ID | Story | Status | What changed |
|---|---|---|---|
| US-1 | 3D vault, first screen | Done | `client/src/components/ui/trustvault-3d.jsx` (three.js, from the owner's brief) is the first section of the main page: the headline "Every check, one by one." and *Create free account* on the left, the machine on the right (stacked on phones). Modes, views, Top, One document and Tamper test all work; the chain-status pill stays in view. Changes to the brief's `embed` mode for a first screen: the mode bar, journey and status stay visible, the wheel and a vertical swipe scroll the page while a sideways drag turns the machine, and the camera sits a little further back so the plate is not cut off. three.js is its own 173 KB (gzipped) download, fetched only by the main page; the main bundle is unchanged at 102 KB. No WebGL 2 → the page starts with the hero, no error box. |
| US-2 | Hero card show | Done | `client/src/pages/landing-hero.jsx`: flies in from the left with motion streaks, ten slot-machine reels lock on ABCPS1234F while the score flickers, the three checks tick on as the score counts to 96%, VERIFIED slams down with a spark burst, then one 360° turn shows a TrustVault back. Starts when the card is in view (after the first-visit intro). Scrolling past slides it left and back. Reduced motion: the finished card. |
| US-4 | Kinetic heading | Done | `client/src/pages/landing-headline.jsx`, after the owner's prompt-motion reference film (@twoclipping): "Every check, one by one." in Archivo at width 125 and weight 800 rises out of a mask line; *one by one* squeezes like an accordion into its full stop with a horizontal motion blur; the stop grows into a pill that shows OCR ✓, Checksum ✓, Number match ✓, Score counting to 96% with a bar, then paints green for Verified; it shrinks back into the stop and the letters spring out. A 12-second loop that rests long enough to read. Every style is computed from the clock with closed-form springs (no video, no CSS transitions), it pauses off screen, screen readers hear the plain sentence, reduced motion shows the still heading. |
| US-3 | Ship | Done | New browser check for the 3D section; all suites green on Chrome, Edge and Firefox; pushed to GitHub (CI runs the suites again and deploys only when they pass). |

## Before and after

Before - the first screen was the headline and the top of the card:
![Main page before](screens/landing-before.jpg)

After - the 3D vault comes first:
![Main page after](screens/landing-after.jpg)

Phone, light theme - One document, Tamper test, Top view, Assembled:
![3D vault on a phone](screens/vault3d-phone-light.jpg)

The kinetic heading (rest, accordion squeeze, the stop, the pill, Checksum, Number match, Score, Verified painted green, shrinking, letters springing back):
![Kinetic heading](screens/kinetic-heading.jpg)

The hero card show (fly-in, reels, locked, checks, VERIFIED, turn, back face, settled):
![Hero card show](screens/hero-card-show.jpg)

## Test evidence

| Suite | Before sprint | After sprint |
|---|---|---|
| Unit (`npm test`) | 10 | 10 |
| End-to-end API (`npm run test:e2e`) | 140 | 140 |
| Browser, Chrome (`npm run test:ui`) | 44 | **48** (3D vault first on the page, One document, Top view, tamper breaks the chain, the wheel is not captured; the heading shows each check in its pill; dark and light) |
| Browser, Edge | 44 | **48** |
| Firefox (WebDriver BiDi script) | 5 pages | Main page: 3D vault first and drawn, the heading's pill shows "Number match" at 5.9 s, hero card reaches VERIFIED, no console errors |

Frames were captured in headless Chrome at 1900, 1366, 768 and 390 px in both themes; no sideways scroll at any size.

## Problems found while checking frames (fixed)

1. **The card cut through the cards behind it while turning** - half of it swung behind the pink back card. The card now lifts toward the viewer during the turn.
2. **VERIFIED and 96% were hard to read in light mode** - the light theme's darker green sat on the dark card. The card keeps a bright green in both themes.
3. **On phones the 3D stage was mostly empty** - the machine is sized to the screen width, so a tall stage left a gap. The stage height now follows the width.
4. **In light mode the 3D view buttons and the One-document panel were white text on a white page.** They now sit on the same dark glass as the mode bar.
5. On a 1366×768 laptop the hero card was entirely below the fold, so a show that started "on page open" would have finished unseen; it now starts when the card comes into view.
6. **The heading's animation ran twice in development** - React mounts effects twice there, and the first mount's font callback started a second loop after its cleanup. A cancel flag stops it.
7. **"Verified" was dark text on dark green in light mode** - the pill keeps a bright green in both themes.
8. **The letters sprang back 23% too far**, past the page margin - the spring is calmer now (about 6%).
9. **The browser rejected the font-loading call** (`125%` is not allowed there); it now asks for `expanded`, the same width.
10. The new browser check compared the transform text, which browsers rewrite (`scaleX(1.0000)` becomes `scaleX(1)`); it now compares the drawn width.

## Retrospective

**Went well**
- Asking the owner two questions (when it plays, which spin) before building avoided a rebuild.
- Frame-by-frame captures caught all four visual bugs before any user saw them.

**To improve**
- The 3D scene renders slowly in headless browsers (software graphics), so its browser check jumps the animation clock instead of waiting.
- Firefox is still a separate script; folding it into `npm run test:ui` remains on the list.
