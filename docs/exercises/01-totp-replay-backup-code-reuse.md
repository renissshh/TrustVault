# Exercise 01: TOTP replay and backup-code reuse

**Roadmap task:** Phase 1, "TOTP replay and backup-code reuse: make `checkSecondFactor` atomic".
**You write the code.** This page explains the bug, how to see it, and how to check your fix.

## The bug

`checkSecondFactor(user, input)` in `server/src/routes/auth.js` checks the second factor in three steps:

1. read the user (done earlier by the route, e.g. `User.findOne({ email })`),
2. check in JavaScript (`code === user.lastTotp`, `user.backupCodes.indexOf(...)`),
3. write back with `user.save()`.

Between step 1 and step 3 there is a gap. Two requests that arrive together both load the *same* user document,
both see that the code is unused, and both pass. This is the same read-check-write race you already saw fixed
in this week's commits:

- `checkOtp` (`lib/security.js`) – fixed with `findOneAndDelete({ key, codeHash, ... })`
- share-link `maxViews` (`routes/public.js`) – fixed with a conditional `$inc`
- one-time faculty view (`lib/access.js`) – fixed by claiming the grant in one update

Here the two cases are:

- **6-digit Authenticator code:** `lastTotp` is meant to block replays, but two parallel requests with the same
  code both read the old `lastTotp`, both pass the `code === user.lastTotp` test, and both succeed.
- **Backup code (XXXX-XXXX):** "one-time" codes are removed with `splice` + `save()`. Two parallel requests can
  both find the hash before either save lands. Depending on Mongoose's array versioning you get either two
  successes or a `VersionError` (a 500 instead of a clean "wrong code"). Neither is what we want.

**Why it matters:** the second factor is what stops someone who already has the password (and maybe the email OTP).
An attacker who sees one valid code (shoulder-surfing, a phishing proxy) can race the real user and get a second session.

### Bonus bug (same function)

`authenticator.options = { window: 1 }` accepts the previous, current and next 30-second code. `lastTotp` remembers only
the *last code string*. So: use code A, then code B 30 s later (now `lastTotp = B`), and A is still inside the window
and is accepted again. Storing the code's **time step** (counter) instead of the code, and only accepting steps
*greater* than the last used one, closes both the race and this replay.

## Reproduce

1. Sign in as a user with Google Authenticator enabled, up to the TOTP step.
2. Copy the request the browser sends to the TOTP endpoint (DevTools → Network → "Copy as fetch").
3. Paste it twice in the console wrapped in `Promise.all([...])` with the same code and ticket.
4. Today: both can return 200. After your fix: exactly one returns 200, the other 400 "Wrong Google Authenticator code."

Same with a backup code instead of the 6-digit code.

## Files involved

- `server/src/routes/auth.js` – `checkSecondFactor` (and its four callers: `POST /reset`, `/login/totp`,
  `/reauth` and `/step-up/totp`; they only need the boolean, so their code should not change)
- `server/src/models.js` – `User` fields `lastTotp`, `backupCodes`
- `server/test/core.test.js` – where the unit test goes

## Fix approach (in words – no code here on purpose)

Move the "is it still unused?" check **into the database update's filter**, so MongoDB does the check and the write
as one atomic operation on one document. Only one request can match; the other gets `null` back.

- **Backup code:** a single `User.findOneAndUpdate` (or `updateOne` and look at `modifiedCount`) whose filter says
  "this user id AND `backupCodes` contains this hash AND `totpEnabled` is true", and whose update `$pull`s the hash.
  If nothing matched, return `false`.
- **Authenticator code:** first verify the code mathematically (no DB needed). Then a conditional update:
  filter "this user id AND `lastTotp` is not this value" (or, for the bonus: "last used step is less than this step,
  or not set"), update `$set` the new value. Matched → `true`; not matched → `false` (it was a replay).
- After the atomic update, keep the in-memory `user` object in step (or reload it) if a caller uses it afterwards
  – check what `/reset` does with `user.save()` later in the route, so you don't overwrite `backupCodes` with the
  old array.

## Hints

- Look at `git show 848d9a3` (the `checkOtp` fix) – your change has the same shape.
- `$ne`, `$pull`, `$lt` and `$exists` are the operators you need. `findOneAndUpdate` returns `null` when the
  filter matches nothing.
- For the bonus: `otplib`'s `authenticator.checkDelta(token, secret)` returns the step offset (-1, 0, 1) or `null`.
  The current step is `Math.floor(Date.now() / 30000)`; used step = current + delta. You may want a new numeric
  field (e.g. `lastTotpStep`) in `models.js`.
- `checkSecondFactor` is not exported. Either export it (small, fine) or move it to `lib/security.js` next to `checkOtp`.
- Keep the error messages exactly as they are – the client shows them.

## Verify

1. **Unit test** in `server/test/core.test.js`, copying the pattern of
   "an OTP passes once, even for two parallel requests with the right code":
   stub the `User` query method(s) you use with an in-memory row and a `setImmediate` tick so requests interleave.
   - two parallel calls with the same valid backup code → `[false, true]`, and the hash is gone from the row
   - two parallel calls with the same valid 6-digit code → `[false, true]`
     (stub `authenticator.check` / `checkDelta`, or generate a real code with `authenticator.generate(secret)`)
   - a wrong code → `false`, nothing written
   - (bonus) an older step after a newer one → `false`
2. `npm test --prefix server` passes.
3. If you can run MongoDB locally: `npm run test:e2e --prefix server` still passes.
4. Repeat the manual `Promise.all` check above.
5. Tick the task in `docs/ROADMAP.md` in the same commit.

## Questions to be ready for (viva / interview)

- Why is "read, check in JS, then save" unsafe even on a single Node.js process with one event loop?
- What does MongoDB guarantee about a single-document update that makes the filter-based fix correct?
- Why is storing the time step better than storing the last code string?
