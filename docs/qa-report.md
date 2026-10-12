# QA report: "רגוע וחזק" (`index.html`)

- **Build tested:** `index.html` as of HEAD `3f37f1b` (unchanged since `fef60fb`; line numbers below refer to this version)
- **Acceptance criteria:** `docs/spec.md`
- **Automated suite:** `tests/e2e.js`, run with `node tests/e2e.js` (see `tests/README.md`)
- **Environment:** Playwright 1.56 Chromium, emulating a phone (375×760, touch, `isMobile`). Time zone Asia/Jerusalem. Fake clock set to Monday 12 Oct 2026, 10:00.

## Summary

| | Count |
|---|---|
| Automated tests | **86** |
| Passing | **70** |
| Failing | **16** (all are real app bugs; none are test bugs) |
| Bugs in this report | **31** (16 caught by the automated suite + 15 found by exploratory testing and code reading) |
| By severity | 0 Blocker · 4 Major · 18 Minor · 9 Cosmetic |

Two full runs gave identical results, so the suite is deterministic.

**What works well (verified automatically):**
- Layout:
  - No horizontal scroll at 320, 360, 375, 390 and 414 px, in light and dark mode, on all 5 tabs and in the settings, all 6 exercises, the completion screen, the celebration and onboarding.
  - Dark mode switches on automatically.
- Onboarding and settings save.
- Week number and phase names for weeks 1–12, before the start date, after week 12, and across DST, month, year and leap-day boundaries.
- Checklist:
  - Toggling with tap, Space and Enter; persistence across reload.
  - Daily reset on reload and on return to the foreground.
  - The 3-minute morning breathing completes the item.
- Praise counter.
- Stars: no way to remove a star; the celebration fires once per week and resets in the next program week.
- Exercises: all 6 run with exactly the spec timing (box 4-4-4-4; robot 5 s/5 s × 3; wall 10 s; stop sentence). Countdowns are correct, the announced total time equals the real duration, and pause, resume, ✕, "סיום" and Escape all work.
- Incident form:
  - Single and multi select.
  - "What did he do" is required.
  - Automatic and editable date/time.
  - Recent-incidents list and delete.
  - Protocol card content.
- Progress:
  - Bar values.
  - Baseline and −70% target lines in the right positions.
  - "All / hits only" toggle (persisted).
  - Tool-usage %.
  - Trigger, hour and target analysis.
  - Weekly table and encouragement message.
  - Pro-help card in 8 of 9 scenarios.
- Guide: the current phase is open and highlighted in every week, and every spec section is present.
- Data:
  - Export is valid JSON identical to the stored state.
  - Import of a valid file replaces the data, after a confirmation.
  - Malformed JSON is rejected.
  - Reset asks twice.
  - The app keeps working in memory when localStorage throws or is blocked.
  - It recovers from corrupt stored JSON and works offline.
- XSS typed into the UI is escaped everywhere.
- Install: the embedded manifest is valid and the icons decode at their declared sizes.
- Accessibility: `lang="he" dir="rtl"`, and every button has an accessible name.
- Performance: 500 incidents render the Progress tab in under 300 ms.

**Biggest risks before release:**
1. **Bug 1, data loss.** Importing a backup the app cannot render destroys the user's data and leaves screens permanently blank, while the app reports "הקובץ לא תקין".
2. **Bug 2, XSS.** A crafted backup file can run script.
3. **Bug 3, wrong times.** If the app is resumed from the background on the Incident tab, the incident is saved with a stale time. This skews the hour analysis.
4. **Bug 4, false progress message.** At the start of every program week, the Progress tab announces "−100%, you reached the target 🎉".

---

## Bug list

Format: **severity**, then the failing automated test (if any), spec reference, repro steps, expected vs. actual, and the suspected code location (line numbers in `index.html`).

### Major

#### 1. Importing a structurally invalid backup wipes all data and permanently breaks screens, while the app says "the file is invalid"
- **Severity:** Major (data loss)
- **Test:** #72 `data: structurally hostile import…`
- **Spec:** עיצוב, "שמירת כל הנתונים ב-localStorage (עטוף ב-try/catch), כולל כפתור ייצוא וייבוא JSON"
- **Repro:**
  1. Use the app with some data.
  2. Open ⚙️, tap "ייבוא" and choose a file containing `{"settings":{"childName":12345}}`.
  3. Accept the confirm dialog.
- **Expected:** The file is rejected (or sanitized) and the existing data is untouched.
- **Actual:** The toast says "הקובץ לא תקין", but all existing data has already been replaced and saved. After a reload, the Today tab is blank on every launch (`(S.settings.childName || "").trim is not a function`). The only way out is a full reset.
- **Other payloads that do the same:**
  - `goals:[null,…]`, which breaks Today.
  - `rules:[1,null,{}]`: the app is blank after reload.
  - `days:{"<today>":{"checks":null}}`, which breaks Today.
  - `incidents:[null]`, which breaks Incident and Progress.
  - `incidents:[{"ts":"yesterday","actions":["מכה"]}]`. This one even shows "יובאו בהצלחה" and then leaves the Progress tab permanently blank (`W[NaN]`).
- **Code:**
  - `normalize()` (404–418) only checks the top-level types. It does not check element types (strings in `rules`, objects in `goals`, numeric `ts`, string arrays in `actions`, objects in `days`).
  - `importData()` (1172–1184) calls `save()` (1179) before `showTab()` (1180) has proved the data renders. The `catch` then shows "invalid file" with the bad data already saved.
  - `weekStats()` (725–731) indexes `W[w]` with `w = NaN`.

#### 2. XSS through an imported backup: unescaped ids and mood color are written into HTML
- **Severity:** Major (security)
- **Test:** #73 `security: hostile import…`
- **Spec:** ייבוא JSON
- **Repro:** Import a file that contains:
  - a goal with id `"><img src=x onerror="alert(1)">`
  - an incident with the same id
  - a mood `{"ts":<today>,"c":"\"><img src=x onerror=alert(1)>"}`
- **Expected:** These values are rendered as text or rejected.
- **Actual:** The script runs on the Today, Calm and Incident tabs. The test counted 4 executions and 3 injected `<img>`s.
- **Code:**
  - `data-id="${gl.id}"` at 586.
  - `data-id="${i.id}"` at 690.
  - `moodColor(x.c)` interpolated into `style="…"` at 617 (via 477), and also at 613, 614 and 622 when `selMood` is involved.
- **Fix hint:**
  - `esc()` every interpolated value.
  - In `normalize`, keep only the moods whose `c` is a key of `MOODS`.
  - Regenerate ids that are not `/^[\w-]+$/`.

#### 3. The automatic incident time is stale when the app is resumed on the Incident tab
- **Severity:** Major
- **Test:** #47 `incident: auto time is "now" when the app is resumed hours later…`
- **Spec:** רישום אירוע, "תאריך ושעה אוטומטיים"
- **Repro:**
  1. Open the Incident tab at 10:00.
  2. Switch to another app. Return at 13:00 the same day; the browser tab stays alive, which is typical on phones.
  3. Pick "מכה" and save.
- **Expected:** The time is about 13:00.
- **Actual:** It is saved as 10:00. The field still shows the time from when the tab was rendered.
- **Impact:** The "שעות מועדות" analysis and the "last 7 days" logic get wrong data. Because the app remembers the last tab (`ui.tab`), parents often land straight on this form.
- **Code:**
  - `renderIncident()` (654) refreshes `draft.ts` only on render.
  - The `visibilitychange` handler (1314–1317) re-renders only when the date changed.
  - `saveIncident` (1270–1271) uses the field value even when the user never edited it (`draft.tsEdited === false`). When it is false, it should use `Date.now()`.

#### 4. At the start of every week the Progress tab announces "100% decline, you reached the target 🎉"
- **Severity:** Major (misleading feedback on the program's main success metric)
- **Test:** #56 `progress: KPI does not claim the −70% target on the first day of a new week`
- **Spec:** התקדמות, the baseline/target chart and "הודעה מעודדת"
- **Repro:** Week 1 has 10 incidents. Two hours into week 2 (no incidents yet), open the Progress tab.
- **Expected:** No claim that the target was reached, based on a partial week. The comparison should use the last complete week, or be pro-rated, or be labelled as partial.
- **Actual:**
  - The KPI shows "0 אירועים השבוע · ירידה של 100% מול שבוע 1".
  - The encouragement card shows "וואו! ירידה של 100% לעומת שבוע 1 – הגעתם ליעד. 🎉".
  - This repeats every week. The figure then rises as the week fills up, which looks like getting worse.
- **Code:** `renderProgress()` 778 (`change` compares the current, partial week with the full week 1) and 799–801.

### Minor

#### 5. The checklist does not reset at midnight while the app stays open in the foreground
- **Test:** #23
- **Spec:** היום, "צ'קליסט … מתאפס כל יום"
- **Repro:**
  1. At 23:58, check "תנועה" and "אחד-על-אחד".
  2. Leave the page visible past midnight (a tablet on the fridge, or a desktop browser).
- **Expected:** An empty checklist for the new day.
- **Actual:** Yesterday's ticks stay on screen. Tapping an item that appears ticked changes today's record and makes the whole list jump (all other items untick).
- **Code:** The reset happens only in the `visibilitychange` handler (1313–1317). There is no midnight timer, so the next render is triggered only by user actions.

#### 6. A future date/time is accepted for an incident
- **Test:** #48
- **Spec:** רישום אירוע
- **Repro:** Set "מתי?" to 01/05/2027 12:00, pick "מכה" and save.
- **Expected:** Rejected, or capped at now.
- **Actual:** Saved. A future incident is outside the "last 7 days" window but counts towards long outbursts (787 has no `dd >= 0` check) and goes into a future week.
- **Code:** `<input type=datetime-local>` at 661 has no `max`. `saveIncident` (1270–1272) has no check.

#### 7. A star target of 0 silently becomes 15
- **Test:** #15
- **Spec:** הגדרות, "מספר הכוכבים הנדרש"
- **Repro:** In ⚙️, set "כמה כוכבים בשבוע צריך לפרס?" to `0` and save.
- **Expected:** Clamped to 1 (the input has `min=1`; −4 already clamps to 1), or a validation message.
- **Actual:** The stored value is 15.
- **Code:** `parseInt(…) || 15` at 1147, and the same at 412.

#### 8. Raising the star target after a celebration means the new target never celebrates that week
- **Test:** #29
- **Spec:** היום, "כשמגיעים ליעד הכוכבים – אנימציה ופרס"
- **Repro:**
  1. Set the target to 2 and earn 2 stars (the celebration fires).
  2. Change the target to 4 and earn 2 more.
- **Expected:** A celebration at 4/4.
- **Actual:** No celebration, because `S.celebrated[week]` is already true.
- **Related:** `celebrated` is keyed by program week number. Changing the start date moves weeks onto week numbers that were already "celebrated".
- **Code:** `ACT.star` 1244–1250.

#### 9. Editing goals moves earned stars to a different goal
- **Test:** #30
- **Spec:** היום, "לא ניתן להוריד כוכב"; הגדרות, יעדי הכוכבים
- **Repro:**
  1. Goals A (2 ⭐), B (0), C (1 ⭐).
  2. In ⚙️, clear goal A and save. B and C look correct.
  3. Open ⚙️ again and just tap "שמירה".
- **Expected:** B 0, C 1.
- **Actual:** B shows 2 ⭐ (A's stars) and C shows 0. C's star is now orphaned, but it still counts towards the weekly total. Typing a new goal into a slot likewise inherits the old goal's stars.
- **Code:** `saveSettings` 1143 assigns ids by position (`'g' + (i + 1)`) instead of keeping each goal's existing id.

#### 10. An accidental double tap adds two stars that can never be removed
- **Test:** #32
- **Spec:** היום, "לא ניתן להוריד כוכב"
- **Repro:** Tap "+ ⭐ הוסף כוכב" twice within about 100 ms.
- **Expected:** One star. Since removal is impossible by design, the irreversible action needs a guard (debounce of about 500–800 ms, or a disabled state during the pop animation).
- **Actual:** Two stars.
- **Code:** `ACT.star` 1244.

#### 11. A typed praise note is lost when anything else on Today is tapped
- **Test:** #31
- **Spec:** היום, "שדה קצר לרשום מה ראית"
- **Repro:** Type into "מה ראיתם?", then tick a checklist item or add a star before tapping "תפסתי אותו!".
- **Expected:** The text stays.
- **Actual:** The field is emptied, because `renderToday()` rebuilds the input (570).
- **Fix hint:** Keep the draft in memory, as the incident form does with `draft.note`.

#### 12. Long unbroken text (a pasted URL, a long name) breaks the whole mobile layout
- **Test:** #12
- **Spec:** "בדיקה ב-375px רוחב, בלי גלילה אופקית"
- **Repro:**
  1. Set the child name to 30 characters without spaces, or save a praise note or incident note that is a long URL or word.
  2. Open Today (and Incident with the list expanded).
- **Expected:** The text wraps.
- **Actual:**
  - Today: the page's layout width grows to 846 px (1,440 px on Incident). Mobile Chrome zooms out and the header and bottom nav go partly off-screen; in the test the nav buttons could no longer be tapped.
  - Culprits: `.hero .eyebrow`, the `h2` "תפסתי את … מתנהג יפה", the praise `li`, and the `.inc-item` text.
  - `body{overflow-x:hidden}` (57) does not prevent this on mobile.
  - Screenshot: `fail-12.png` in the shots dir.
- **Code:**
  - No `overflow-wrap:anywhere` or `min-width:0` on `.note-list li` (153), `.card h2` (86, a flex container), `.inc-item > div` (207) or `.goal b` (158).

#### 13. The pro-help card never appears when week 1 has no logged incidents, however bad later weeks are
- **Test:** #62
- **Spec:** התקדמות, "אם אחרי שבוע 8 אין ירידה … הצג כרטיס"
- **Repro:** Week 1 has 0 incidents and weeks 2–9 have 5 each (on 3 days per week). Open Progress in week 10.
- **Expected:** The card appears (there was no decline).
- **Actual:** No card, because `noDecline` requires `stats[0].all > 0`. Parents who did not log in week 1 never get this signal.
- **Code:** 789.

#### 14. Secondary tap targets are below 44×44 px
- **Test:** #84
- **Spec:** עיצוב, "כפתורים גדולים ללחיצה באגודל"
- **Actual:**
  - Delete-praise "×" and delete-incident "🗑️": 40×40 (`.x-btn`, 155). These sit right next to the content, so mis-taps are likely.
  - The chart toggle "הכל" / "רק מכות": 38 px high (`.seg button`, 229).
  - Chart bars as tap targets are about 25 px wide (754).
- Primary controls all pass (test #83).

#### 15. Overlays don't manage focus; Escape doesn't close the celebration
- **Test:** #85
- **Spec:** accessibility basics
- **Repro:** Open Settings, an exercise or the celebration with the keyboard or a screen reader.
- **Expected:** Focus moves into the `role=dialog` and stays there (focus trap), Escape closes it, and focus returns to the trigger.
- **Actual:**
  - Focus stays on the page behind, and Tab moves through hidden content.
  - Escape does nothing on the celebration.
  - `#celOverlay` has no accessible name (`aria-labelledby` is missing).
- **Code:** `openSettings` 1132, `startEx` 1022, `celebrate` 1197; the Escape handler is at 1304; markup at 350.

#### 16. "חזרה למדחום" after the morning breathing goes to the Calm tab instead of back to Today
- **Found by:** exploratory testing
- **Repro:** Today → "▶ התחילו 3 דקות נשימה" → wait 3:00 → tap "חזרה למדחום".
- **Expected:** Return to Today, where the item just got ticked.
- **Actual:** The app jumps to the Calm tab. The parent's routine flow is interrupted, and the completion screen text ("איך אתה מרגיש עכשיו?") is aimed at the child.
- **Code:** `finishEx` 1079 hard-codes `data-goto="calm"`; `startEx` should take a return tab in `opts`.

#### 17. The long-outburst pro-help trigger uses a lower threshold than the spec
- **Found by:** code reading
- **Spec:** "התפרצויות ארוכות מ-20–30 דקות"
- **Actual:** `LONG_DUR` includes the bucket "15–30 דקות" (500), so two 16-minute outbursts trigger "כדאי לפנות לאיש מקצוע". `long14` (787) also counts future-dated incidents.
- **Suggestion:** Change the buckets to "15–20", "20–30" and ">30", and count only the last two.

#### 18. Data from before the start date counts as week 1 (baseline), stars included
- **Found by:** code reading and exploratory testing
- **Repro:** Set the start date to next Monday. Following the hint "אפשר כבר להתחיל לתעד", log incidents and add stars during the remaining days.
- **Actual:**
  - All of it is folded into week 1 (`wkOfTs`, 445). The baseline is inflated by up to the number of pre-start weeks, which makes the −70% target easier to "reach".
  - Pre-start stars also count towards week 1's reward. The pill showed 1/2 before the program started.
- **Expected:** Keep pre-start data out of the baseline, or show it separately.

#### 19. Starting the export share sheet and cancelling it triggers a file download anyway
- **Found by:** code reading (not reproducible headless)
- **Code:** `exportData` 1157 has `navigator.share(…).catch(() => downloadBlob(…))`. A user cancel rejects with `AbortError`, so a parent who cancels the Android/iOS share sheet still gets a file downloaded.
- **Fix:** Fall back only when `e.name !== 'AbortError'`.

#### 20. Corrupt stored data is silently overwritten
- **Found by:** code reading
- **Repro:** Put invalid JSON (for example a truncated write) in `ragua-vehazak-v1`.
- **Actual:** `load()` (419–421) falls back to the defaults, shows onboarding, and the first `save()` overwrites the original string. No chance to recover it, no warning.
- **Suggestion:** Copy the raw string to a `…-corrupt-<ts>` key and tell the user.

#### 21. Onboarding offers no "restore backup"
- **Found by:** exploratory testing
- **Spec:** הגדרות, ייבוא
- **Actual:** On a new phone, the welcome screen (`openSettings(true)`, 1118) hides import and export. The parent must first complete onboarding with dummy values, then import.

#### 22. Accessibility: nested interactive control, unlabeled chip groups, low contrast
- **Found by:** code reading and computed contrast
- **Actual:**
  - The "▶ התחילו 3 דקות נשימה" button sits inside a `div role=checkbox` (555–562). This is a nested interactive element, and screen readers announce both controls as one.
  - The chip groups' `<label class="lbl">` elements are not associated with the groups (662–667), because `.chips` has no `role=group` or `aria-labelledby`. A screen reader user hears "מכה, toggle button" with no question.
  - Contrast:
    - White text on the green mood button (`#3bb273`, 179) is about 2.7:1, which fails WCAG AA even for large text.
    - White on `.btn` accent `#21958a` (104) is about 3.7:1 for 17 px bold, which fails AA for normal text.
    - The hero's small white text on the teal-blue gradient is about 3.7–4.1:1.

### Cosmetic

#### 23. Chart y-axis label is wrong when the maximum is 5
- **Test:** #57
- **Repro:** Log 5 incidents in week 1 and open Progress in week 2.
- **Actual:** The middle gridline is drawn at 2.5 but labelled "3".
- **Code:** `niceMax()` (734) can return 5. The labels use `Math.round(t)` (742).
- **Fix:** Return 4 or 6 or 10 instead, or label with one decimal place.

#### 24. Pause/resume accuracy drifts by up to 1 s per pause
- **Found by:** exploratory testing
- **Repro:** Pause 0.5 s after a tick and resume 10.3 s later.
- **Actual:** The next decrement comes 0.2 s after resuming instead of 0.5 s. The 1 s `setInterval` keeps running while paused (1027, 1049, 1059–1068).
- **Related:** Timers count ticks, not wall-clock time, so a 3-minute breathing exercise stalls or drifts when the phone throttles background timers.

#### 25. "רק מכות" mode shows a misleading message when week 1 has incidents but no hits
- **Found by:** exploratory testing
- **Actual:** It says "קו הבסיס והיעד יופיעו כשיהיו אירועים רשומים בשבוע 1" (837) although week 1 does have incidents. It should say that there were no hits in week 1.

#### 26. Future weeks in the chart are tappable and report "0 אירועים"
- **Found by:** exploratory testing
- **Repro:** In week 2, tap the slot for week 9.
- **Actual:** "שבוע 9: 0 אירועים, מתוכם 0 עם מכות". The hit-rects are drawn for all 12 weeks (754).

#### 27. Before the start date, the hero shows "שבוע 1 מתוך 12" with the "מיפוי" chip
- **Found by:** exploratory testing
- **Actual:** The program has not started, but the header claims week 1 (527–546). The note underneath is correct.
- **Suggestion:** Show "מתחילים בעוד N ימים".

#### 28. The celebration overlay doesn't lock background scroll
- **Found by:** code reading
- **Actual:** `celebrate()` (1197) does not set `body.style.overflow='hidden'`, unlike Settings and the exercises, so scrolling over the overlay scrolls the page behind it.

#### 29. Bar chart reads left-to-right inside an RTL app
- **Found by:** exploratory screenshots
- **Actual:** `.chart{direction:ltr}` (221) puts week 1 on the left. This is a reasonable choice, but it is inconsistent with the RTL progress pips in the hero, where week 1 is on the right. The team should decide which direction to use.

#### 30. The incident "<30 seconds" form needs about 2.5 screens of scrolling on 320 px
- **Found by:** exploratory screenshots
- **Actual:** There are 33 chips before the save button. This is not a defect, but the "פחות מ-30 שניות" goal is at risk.
- **Suggestion:** Make the save button sticky, or collapse the "איך הגבנו" section by default.

#### 31. Small inconsistencies
- **Found by:** code reading
- **Actual:**
  - The praise-dots `aria-label` (573) sits on a `div` with no role, so it is ignored by assistive technology.
  - The headline "תפסתי אותו!" (572) ignores the configured name, although the card title uses it.

---

## Spec requirements that could not be verified automatically

1. **Install to the home screen on real devices.** The manifest is an embedded `data:` URL with `start_url` = the page URL, and the icons are generated by canvas at runtime. The suite checks that it parses and that the icons decode, but not whether Chrome on Android accepts a `data:` manifest as installable, or whether Safari on iOS picks up a JS-set `apple-touch-icon`. This needs a manual check on devices, over https.
2. **Offline launch from the home screen via `sw.js`.** It only works over https, and the suite runs from `file://`. Offline rendering itself was verified.
3. **Storage longevity on iOS.** Safari may evict localStorage for sites that are not installed after 7 days without a visit. This is a product risk to note: remind users to export, or install the app.
4. **Visual and brand requirements.** "צבעים רגועים: כחול-ירוק בהיר", Heebo rendering (fonts are stubbed in tests), the quality and smoothness of the animations, and confetti. These were checked by eye in screenshots only and look as intended.
5. **Haptics** (`navigator.vibrate`) and the native share sheet on mobile.
6. **Thumb ergonomics and safe areas** (notch, home indicator) on real iOS and Android hardware.
7. **"טופס מהיר (פחות מ-30 שניות)"**, which needs a usability timing study.
8. **Correct wording of the Hebrew content.** Presence of every spec item is verified, but whether the wording is correct and appropriate is not. The spec's trigger option "לא" was interpreted as "ללא טריגר ברור".
9. **Round 2: the Android APK.** This is owned by another teammate and was not tested here.
