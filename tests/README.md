# E2E tests for "רגוע וחזק"

`tests/e2e.js` is a Playwright end-to-end acceptance suite for `index.html`. It needs no build step and no `package.json`.

## Requirements
- Node 18+ (tested on Node 22)
- Playwright installed globally (`npm i -g playwright`) with its Chromium browser. The script loads it from `npm root -g`, so no local `node_modules` is needed.

## Run
```bash
node tests/e2e.js                    # whole suite (about 2.5 minutes)
node tests/e2e.js stars exercise     # only tests whose name contains "stars" or "exercise"
SHOTS=/tmp/qa-shots node tests/e2e.js  # also save a screenshot of every failing test
```
The script prints one `PASS`/`FAIL` line per test. A failing test also prints the spec line it covers and the reason it failed. A summary comes last. The exit code is `0` when every test passes, `1` when any test fails, and `2` when the harness itself crashes.

## How it works
- **Hermetic.** Every test opens a new browser context with its own empty localStorage. The context emulates a phone: 375×760 viewport (other widths in the layout tests), `isMobile`, `hasTouch`, time zone `Asia/Jerusalem` and locale `he-IL`. Remote requests are blocked, except that the Google Fonts stylesheet gets an empty stub so the network cannot affect results. One test also blocks the fonts, to check that the app works offline.
- **Seeding.** `open(t, { state })` writes a state object into `localStorage['ragua-vehazak-v1']` with `addInitScript`. A guard key (`__qa_seeded`, kept in localStorage) makes this happen only once, so data written by the app survives a reload. Tests reload with the `reload(page)` helper, not `page.reload()`. In Chromium, reloading a `file://` page in a fresh context sometimes loses sessionStorage or the whole localStorage. The helper detects that with a marker key, restores the pre-reload snapshot and reloads again. Pass `state: null` to start with empty storage (first run), or a string to seed corrupt data.
- **Time.** Each test installs `page.clock` and pauses it at Monday 12 Oct 2026, 10:00 (Jerusalem time). Tests move time with `clock.runFor` (exercise timers, midnight), `clock.setSystemTime` (next day, next program week) and `tsJ()` (local wall-clock times, including across DST).
- **Errors.** A test fails on any `console.error` or uncaught page error. In the offline test, network-load errors are expected and do not count.
- **Dialogs.** The app uses an in-app confirm sheet (`#dlg`) instead of `confirm()`. Tests answer it with `answer(page, ok)`, which records each title and body in `page.dialogs`. A native `alert()`/`confirm()` fails the test.
- **Stars.** The app ignores a repeat tap on the same star button within 800 ms (double-tap guard), so tests add stars with `addStar(page, id)`, which advances the paused clock by 1 s before each tap.
- **Network.** Every remote request is recorded in `t.remote`; the font is embedded, so the app is expected to make none.
- Each test's `spec:` string names the line of `docs/spec.md` that it verifies.

## Current status
When written, the suite had 86 tests: 70 passed and 16 failed (real app bugs, described in `docs/qa-report.md`).
After the release fixes it has 109 tests (86 original, some updated to assert the new intended behaviour, plus 23 new ones in section 16), and all of them pass.
The round-2 QA audit added 5 regression tests (section 17), so the suite now has **114 tests: 109 pass and 5 fail**. The 5 failures are new app bugs from the release round, described in `docs/qa-report.md` under "Round 2 regression audit". The audit also fixed a harness flake: reloads now use `reload(page)` and the seed guard is kept in localStorage.
