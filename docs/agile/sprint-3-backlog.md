# Sprint 3 - main page motion sprint (20 Oct 2026)

**Sprint goal:** make the main page show, not tell, how a document is checked: a 3D model of the whole journey as the first screen, and a hero ID card that verifies itself, without slowing the page or changing the approved neon look.

**Status:** completed 20 Oct 2026 - see the [sprint review](sprint-3-review.md).

**Process:** one-day Scrum-style sprint. Product owner: SriNithish J K. Developer: Claude (pair). Input: the owner's idea for the hero card (fly in, rolling numbers, checked, approved, spin, slide away on scroll; trigger and spin chosen by the owner) and a 3D component brief (`TrustVault-3D-prompt.txt`, three.js, built for this repo).

## Product backlog for this sprint

| ID | User story | Points | Priority |
|---|---|---|---|
| US-1 | As a **visitor**, I want the first screen to show the document's whole journey as a 3D machine I can turn, so I can watch every check happen one by one. | 5 | Must |
| US-2 | As a **visitor**, I want the hero ID card to come alive (fly in, numbers roll and lock, checks tick, VERIFIED, a full turn), so "verified automatically" is obvious in seconds. | 3 | Must |
| US-3 | As the **team**, we want both checked by the browser suite and shipped through CI/CD to the live site. | 1 | Must |

## Acceptance criteria

**US-1 3D vault, first screen**
- The first section of `/welcome`: a three.js model of a document riding a ring conveyor through the sign-in gate, upload, the AES-256-GCM vault, automatic checks, the human verifier and the QR proof, with the hash-chained ledger in the middle.
- Modes Assembled, X-ray, Exploded and One document; views Overview, Side, Top, Station and Orbit; hovering a station explains it, clicking flies to it.
- Tamper test edits one block: the chain turns red from that block up, the status says "Chain broken at #...", then it heals.
- The wheel and a vertical swipe scroll the page (the scene never traps the visitor); a sideways drag turns the machine.
- three.js loads on its own after the page (not in the main bundle). Without WebGL 2 the page starts with the hero instead of showing an error.
- Headline and "Create free account" beside the machine on wide screens, above it on phones; dark and light theme readable; 390-1900 px with no sideways scroll; specimen data only.

**US-2 Hero card show**
- Flies in from the left at speed with motion streaks.
- The PAN number rolls like slot-machine reels and locks left to right on ABCPS1234F while the score flickers.
- OCR, Checksum and Number match tick on one by one and the score counts up to 96%.
- VERIFIED slams down (spark burst, sound if sound is on), then the card makes one full 360° turn showing a TrustVault back.
- Scrolling on past the card slides it away to the left; scrolling back brings it back.
- Plays once when the card comes into view, after the first-visit "Access granted" intro; with "reduce motion" the finished card is shown.

**US-3 Ship**
- A browser check for the 3D section (first on the page, modes, Top view, tamper, wheel not captured; falls back cleanly without WebGL).
- Unit, end-to-end and browser suites green (Chrome and Edge); pushed to GitHub, where CI runs them again and deploys only if they pass.
