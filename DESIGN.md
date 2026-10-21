# TrustVault – Design Contract

This is the brand contract every screen follows. The interface lives in `client/`.

Direction: Apple-clean layout on a dark neon stage, chosen with the
[UI/UX Pro Max skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) and 21st.dev (theme, bento grid; the aurora
backdrop, cursor spotlight and sliding tab pill follow patterns from its catalog, written here by hand).

The first interface (neo-brutalist) is kept, unused, in `client-classic/` with its own `DESIGN.md`.

## Look
- **Apple-clean layout on a dark neon stage.** Pure black background, huge tight headings, lots of space, one idea per section.
- Neon accents: cyan (`#19e6ff`), purple (`#b56bff`), pink (`#ff4fd8`), green for success (`#39ff9c`). The primary button and the active
  nav pill use the cyan → purple → pink gradient.
- **Inter Tight** headings, **Inter** body, **JetBrains Mono** for numbers, codes and labels.
- Rounded shapes (pills for buttons, 26px cards), 1px borders, coloured glow instead of grey shadows.
- **Light theme** (toggle in the top bar): the same design on a crisp white stage with a dot grid. Fills use electric blue → violet → pink; coloured *text* uses deeper tones (see the light overrides in `client/src/index.css` and `landing.css`). Check both themes for every change.
- Tokens are in `client/src/index.css`; the landing page has its own sheets (`client/src/landing.css`, `client/src/landing-extras.css`); app extras are in `client/src/app.css`.

**This look is the foundation - extend it, do not replace it.**

## What is in it
| Area | Pieces |
|---|---|
| Landing page | Vault-door intro (once per tab, click to skip) · neon hero with a 3D glass ID card that tilts to the cursor · standards marquee · a sentence that lights up as you scroll · try-it demo (a sample card is scanned, checked and stamped) · six feature panels with live graphics · product preview (laptop + phone) · numbers · three steps · closing panel |
| Sign-in | Step tracker · Caps Lock warning · paste-code button · welcome-back card on a trusted device · vault doors that close and reopen on the dashboard · invitation sign-up |
| App | Top navigation with drop-down menus · identity progress ring · Star and glow backdrop · while-you-were-away summary · next best step · live notifications (every 15 s) · 3D document wallet (click to bring forward, click to flip, QR on the back) · status donut and 14-day activity line · confetti when a document becomes verified · quick search (Ctrl+K) · guided tour (first visit, restart from search or the account menu) |
| Admin | Overview charts · user search and filters · invitations for verifiers and admins · audit log filter, search and CSV export |
| Pages | Guided empty states (animated emblem, how-it-works steps, next action) · one tile per document type when a vault section is empty · access requests as cards · activity as a timeline with a summary column · security groups in two columns on wide screens |
| Everywhere | Pages load on demand with a neon top bar · Scanner cursor (mouse only): a dot on the pointer and four corner brackets that snap around a button or link like a scanner framing a document, with one scan line; text fields keep the normal caret · optional click and success sounds (off by default, speaker button in the top bar) · neon 404 page |

## Layout
- **Navigation:** a floating pill bar at the top, same as the landing page. Sections are Home, Vault, Privacy, plus Verify and Admin for staff. Hovering or focusing a section drops one glass panel that morphs between sections (intro, page tiles, a featured action). Phones use the bottom bar with **More**. Ctrl+K reaches everything.
- **Width:** pages use up to 1640px. Dashboards go to three columns from 1536px; document and review cards go three across.
- **Main screen order:** hero with the wallet → while you were away → next best step → number tiles → identity ring, verification donut, activity line → setup checklist → recent documents, weekly activity, devices.

## Motion (library: `motion`, plus CSS)
| Where | What happens |
|---|---|
| Every page | Fades and slides in on navigation; the sidebar and phone-dock highlight is one shared element that slides to the new page |
| Buttons | Lift and glow on hover, squash on press, light sweep across filled buttons, icons scale |
| Dialogs | Spring up with a blurred backdrop; the close button rotates; focus returns to the opener |
| Cards and tiles | A soft light follows the cursor (`data-spot`); document cards and stat tiles lift on hover |
| Filters and tabs | The active pill slides between options |
| Numbers | Count up; activity bars grow; progress bars ease |
| Code boxes | Each box pops when filled, the row shakes on a wrong code |
| Vault lock | Pulsing ring, padlock flips to open, the screen zooms and blurs away |
| Sign-in | Headline builds word by word, proof chips spring in, each step slides in |
| Landing | Aurora backdrop, scroll progress bar, 3D-tilting ID cards with a scan line and a VERIFIED stamp, scroll reveals, a live Authenticator code, a ledger chain that links up |

Helpers are in `client/src/lib/fx.jsx` (`Reveal`, `Words`, `Tilt`, `Aurora`, `ScrollProgress`, `useSpotlight`).

## Rules
- Animate transform and opacity; no blur on large containers (it breaks sticky and fixed children).
- Content must be visible without waiting for a script: entrances are CSS animations, scroll reveals are a class added by an observer with a safety timeout. Check changes with real browser screenshots at desktop and phone width.
- Nothing important depends on motion: `prefers-reduced-motion` turns it all off (`MotionConfig reducedMotion="user"` and a CSS rule).
- Text on a filled colour is ink (`#04141c`); status is never colour alone.

## Run
```bash
npm run dev      # API on 5000 + the site on http://localhost:5173
npm run build
```

## Motion-graphics layer

Added on top of the neon foundation, never instead of it. All of it is off for "reduce motion" and on touch screens where it depends on a mouse.

- `client/src/lib/motion-kit.jsx`: `useMotionKit()` (one app-wide pointer listener) tilts any `data-tilt` element in 3D and pulls `.lp-btn` / `data-magnetic` buttons toward the cursor. `data-tilt="translateY(-10px)"` keeps the element's own hover transform. Cards and stat tiles carry `data-tilt` by default.
- `<ParticleShield>`: the logo drawn by glowing particles that assemble, breathe, scatter from the cursor and explode on click. Used on the landing call to action and the sign-in / sign-up pages.
- Landing scroll story (`pages/landing-story.jsx`): a pinned section where one card goes upload → encrypted → checked → VERIFIED → QR proof as the visitor scrolls.
- `.neon-ring`: a gradient arc that travels around the border (sign-in card, dashboard hero).
- Headlines built with `<Words>` flip in letter by letter.
- App cards and stat tiles rise out of a blur as they scroll into view (CSS scroll timeline, `backwards` fill only, so hover and tilt keep working).
- Content never depends on an animation to become visible.
