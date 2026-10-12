# רגוע וחזק – Design review & implementation spec

**Author:** UI/UX design · **Scope:** `index.html`, the whole UI (5 tabs, overlays, onboarding/settings), Hebrew copy, app icon
**For:** the software engineer applying the changes. Every item gives **where** (tab / component / selector / function), the **problem**, and the **exact change**. Everything stays inside the single self-contained `index.html`: vanilla JS, no frameworks, and no CDN except the optional Google Font. Heebo will be embedded as base64.

---

## 0. How this review was done

- I rendered the app with Playwright (Chromium) at **360×780** and **390×844**, `isMobile`, `hasTouch`, DPR 2, in both `colorScheme: light` and `dark`. The seeded data was: a child named "יואב", a start date 5 weeks ago (week 6), 40 incidents trending down, stars, praises and moods. I also captured a fresh install, and a "week 10, no improvement" data set that triggers the professional-help card. I screenshotted every tab, every exercise mid-animation, the completion screen, the celebration, the toast, settings, onboarding and the empty states. The screenshots are in `/tmp/design-shots/` (baseline) and `/tmp/design-shots/mock/` (a scratch copy with the proposed tokens and CSS applied, to check that the spec below works).
- **No horizontal scroll** at 360 or 390 (`scrollWidth === innerWidth` on every tab). ✅
- I computed WCAG 2.x contrast ratios with a small script (sRGB relative luminance). The numbers are below.
- Priorities: **P1** must fix before release · **P2** should fix (quality and native feel) · **P3** nice to have.

**What already works well:** it's mobile-first, the 5-tab bottom nav is in place, the cards are big, Heebo is used, the palette is calm, dark mode is automatic, there are safe-area insets on the top bar, nav and overlays, there's a reduced-motion block, `aria-pressed` is used on chips, the protocol card is strong, and the copy is warm. The foundations are good. Most of the work below is polish, contrast and making it feel like an Android app.

---

## 1. Design tokens – paste-ready `:root` (replaces the current `:root` + dark `@media` block)

> Keep the existing token **names** where they exist, so most of the CSS keeps working. The new tokens are additions. `--green/--yellow/--orange/--red` keep their names (used by `moodColor()`), but the values change.

```css
:root{
  /* surfaces */
  --bg:#eef7f6; --bg-grad:#e0f0f3;
  --surface:#ffffff; --surface2:#f3f9f8;
  --seg-track:#eaf4f3; --seg-on:#ffffff;
  /* text */
  --text:#12313a; --muted:#4a676c; --placeholder:#587478;
  /* lines */
  --line:#d3e6e4;          /* decorative dividers & card borders only */
  --line-strong:#6e9491;   /* borders that identify a control: inputs, chips, check rings */
  /* brand */
  --accent:#1a7f76; --accent-strong:#0f625b; --accent-soft:#d5efeb; --on-accent:#ffffff;
  --blue:#2f6f9c; --blue-strong:#245a80; --blue-soft:#e0edf7;
  /* status */
  --good:#1f7343; --good-soft:#dcf2e4;
  --warn:#805300; --warn-soft:#fcf1d6; --warn-line:#d9b45f;
  --danger:#a8302f; --danger-soft:#fce4e3;
  /* hero */
  --hero-from:#1a7f76; --hero-to:#2f6f9c; --on-hero:#ffffff;
  /* feelings thermometer (same in both themes) */
  --green:#4cbb7f; --yellow:#f4c84a; --orange:#f39a45; --red:#ec6a6a; --on-mood:#10262b;
  /* praise button */
  --praise-from:#f6c053; --praise-to:#f39a45; --on-praise:#3a2100;
  /* breathing circle */
  --breath-mid:#1a7f76; --breath-lo:#2f6f9c; --on-breath:#ffffff;
  /* charts */
  --chart-bar:#3a9189; --chart-bar-cur:#0f625b; --chart-grid:#d3e6e4;
  /* focus & overlays */
  --focus:#0f625b; --scrim:rgba(10,30,34,.45);
  --shadow:0 1px 2px rgba(18,49,58,.06),0 4px 16px rgba(18,49,58,.07);
  --shadow-lg:0 12px 32px rgba(18,49,58,.20);

  /* type scale (Heebo) */
  --fs-xs:13px; --fs-sm:15px; --fs-base:17px; --fs-md:20px; --fs-lg:24px; --fs-xl:30px; --fs-2xl:40px; --fs-display:56px;
  --lh-tight:1.25; --lh-body:1.55;
  /* spacing (4px base) */
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:20px; --sp-6:24px; --sp-7:32px; --sp-8:40px;
  /* radius */
  --r-sm:10px; --r-md:14px; --r-lg:18px; --r-xl:24px; --r-pill:999px;
  --radius:var(--r-xl);            /* legacy alias used by .card */
  /* layout */
  --nav-h:72px; --topbar-h:68px;
  color-scheme:light;
}
@media (prefers-color-scheme: dark){
  :root{
    --bg:#0d1b1e; --bg-grad:#10232a;
    --surface:#16292d; --surface2:#1c3236;
    --seg-track:#0f2125; --seg-on:#2a4649;
    --text:#e3f1ef; --muted:#a3bfbd; --placeholder:#8aa6a4;
    --line:#284442; --line-strong:#5b807d;
    --accent:#4cc3b6; --accent-strong:#73d8cc; --accent-soft:#1c3f3c; --on-accent:#06201d;
    --blue:#72b4e2; --blue-strong:#9ccbec; --blue-soft:#18334a;
    --good:#6fd39a; --good-soft:#173a29;
    --warn:#f0c15a; --warn-soft:#3a3015; --warn-line:#8a6d2a;
    --danger:#f08a8a; --danger-soft:#3e1d1d;
    --hero-from:#17655e; --hero-to:#1f5b80; --on-hero:#ffffff;
    --breath-mid:#4cc3b6; --breath-lo:#3f8fc0; --on-breath:#06201d;
    --chart-bar:#3d8f87; --chart-bar-cur:#73d8cc; --chart-grid:#284442;
    --focus:#7fe0d4; --scrim:rgba(0,0,0,.6);
    --shadow:0 1px 2px rgba(0,0,0,.3),0 6px 20px rgba(0,0,0,.3);
    --shadow-lg:0 12px 32px rgba(0,0,0,.55);
    color-scheme:dark;
  }
}
```

### 1.1 Measured contrast – current vs proposed

**Current failures** (light unless marked D):

| Pair | Where | Ratio | Needs |
|---|---|---|---|
| `#fff` on `--accent #21958a` | every `.btn` primary, chip pressed, hero start | **3.66** | 4.5 (17px bold is not "large") |
| `#fff` on hero end `#3a83b5` | `.hero` text | **4.12** | 4.5 |
| D `#fff` on hero `#4cc3b6`/`#72b4e2` | `.hero` in dark mode | **2.15 / 2.25** | 4.5 |
| D `#fff` on `.ex .circle` `#4cc3b6` | breathing counter in dark mode | **2.15** | 3 (large) |
| `#fff` on `.circle.push` `#f5b942` | wall-push counter | **1.76** | 3 |
| `#fff` on `--green #3bb273` | green mood button | **2.69** | 3 (large) |
| `--blue` on `--blue-soft` | `.pill.blue` (stars count) | **3.39** | 4.5 |
| `--warn` on `--warn-soft` | `.reward b` | **3.72** | 4.5 |
| `--good` on `--surface` | `.kpi em.good-t` 12.5px | **4.07** | 4.5 |
| `--danger` on `--danger-soft` | reset button | **4.15** | 4.5 |
| `--muted` on `--accent-soft` / `--bg-grad` | done checklist subtitle / text on page bg | **4.06 / 4.13** | 4.5 |
| `--accent-strong` on `--accent-soft` | `.pill`, active nav label | **4.41** | 4.5 |
| `--line` on `--surface` | input / chip borders (non-text) | **1.28** | 3 |
| bars at `opacity:.62` | chart bars (non-text) | **2.14** | 3 |
| D selected seg vs track | `.seg button[aria-pressed=true]` | **1.12** | visibly different |

**Proposed tokens, all verified:**

| Pair (light) | Ratio | Pair (dark) | Ratio |
|---|---|---|---|
| text / surface | 13.76 | text / surface | 13.03 |
| text / surface2 | 12.92 | text / surface2 | 11.61 |
| muted / surface | 6.09 | muted / surface | 7.73 |
| muted / surface2 | 5.72 | muted / surface2 | 6.89 |
| muted / bg-grad | 5.20 | muted / accent-soft | 5.89 |
| muted / accent-soft | 5.04 | placeholder / surface2 | 5.18 |
| placeholder / surface2 | 4.71 | on-accent / accent | 7.94 |
| on-accent / accent | 4.84 | accent-strong / accent-soft | 6.80 |
| accent-strong / accent-soft | 5.95 | accent-strong / surface | 8.94 |
| accent-strong / surface | 7.20 | blue-strong / blue-soft | 7.55 |
| blue-strong / blue-soft | 6.19 | good / surface | 8.25 |
| good / surface | 5.85 | good / good-soft | 6.85 |
| good / good-soft | 4.97 | warn / warn-soft | 7.74 |
| warn / warn-soft | 5.92 | danger / danger-soft | 6.23 |
| danger / danger-soft | 5.54 | on-hero / hero-from · hero-to | 6.86 · 7.33 |
| on-hero / hero-from · hero-to | 4.84 · 5.42 | on-breath / breath-mid · breath-lo | 7.94 · 4.79 |
| on-mood / green · yellow · orange · red | 6.54 · 9.90 · 7.13 · 5.12 | text / seg-on | 8.74 |
| on-praise / praise-from · praise-to | 9.00 · 6.81 | line-strong / surface · surface2 (non-text) | 3.48 · 3.10 |
| on-breath / breath-mid · breath-lo | 4.84 · 5.42 | chart-bar · chart-bar-cur / surface | 3.94 · 8.94 |
| line-strong / surface · surface2 (non-text) | 3.33 · 3.13 | focus / bg | 11.33 |
| chart-bar · chart-bar-cur / surface | 3.76 · 7.20 | | |
| focus / bg | 6.60 | | |

### 1.2 Type scale – map every font-size onto it

The file currently uses 22 different font sizes (12, 12.5, 13, 13.5, 14, 14.5, 15, 16, 17, 18, 19, 20, 22, 24, 26, 30, 34, 36, 40, 64, 90, 110). Map them like this. Emoji illustration sizes such as `.trophy` and `.done-face` are exempt.

| Token | px | Use (selectors) |
|---|---|---|
| `--fs-xs` | 13 | `.check .when`, `.kpi span`, `.kpi em`, `.legend`, `table.wk th`, `nav.bottom button`, `.now-badge`, `.phase-card .wk`, `.tool small`, `.small`, chart text (SVG units, see P2-24) |
| `--fs-sm` | 15 | `.sub`, `.pill`, `.today-moods span`, `.seg button`, `.hbars .lab`, `.chart-info`, `table.wk`, `.vent li`, `.note-list li`, `.btn.small`, `.mood small`, `.hero .phase-chip`, `.check .game` |
| `--fs-base` | 17 | body, `.chip` (was 16), `.btn`, `.input`, `.card h3`, `.tool` |
| `--fs-md` | 20 | `.card h2`, `.btn.big`, `.praise-btn`, `.mood`, `.yn .chip`, `.hero h1 small`, `.ex .stage-label .phase`, `details > summary` |
| `--fs-lg` | 24 | `.sheet-head h2`, `.ex h2`, `.ex .ex-text` (was 22, bigger for the child) |
| `--fs-xl` | 30 | `.celebrate h2` |
| `--fs-2xl` | 40 | `.hero h1` (was 34), `.stopwords div` |
| `--fs-display` | 56 | exercise counter `.ex .stage-label .num` |

Headings use `line-height:var(--lh-tight)` and body uses `var(--lh-body)`. Add `font-variant-numeric:tabular-nums` to `.kpi b`, `table.wk`, `#exMeta`, `.ex .stage-label .num` and `.pill`, so numbers don't jitter.
**Font weights:** use only **400, 700, 800**. Replace every `font-weight:500` (`.hero .eyebrow`, `.hero h1 small`, `.mood small`, `.tool small`, `.ex .meta`, `.chip`) with 400 (or 700 where noted below). When embedding Heebo, embed either the variable woff2 (Hebrew + Latin subsets), or static 400/700/800 only. Drop the Google Fonts `<link>` once it's embedded, so nothing hits the network offline.

### 1.3 Spacing scale – 4-pt rhythm

| Selector | Current | New |
|---|---|---|
| `.card` padding / margin-bottom | 18 / 14 | `var(--sp-5)` 20 / `var(--sp-4)` 16 |
| `.card h2` margin-bottom | 10 | `var(--sp-3)` 12 |
| `.grid2`, `.tools`, `.yn`, `.moods` gap | 10 | `var(--sp-3)` 12 |
| `.check` padding / margin-bottom | 12 / 10 | `var(--sp-3) var(--sp-4)` / `var(--sp-2)` |
| `.goal` padding / margin-bottom | 12 / 10 | `var(--sp-4)` / `var(--sp-3)` |
| `label.lbl` margin | 14 0 6 | `var(--sp-5) 0 var(--sp-2)` |
| `main` padding-top | 6 | `var(--sp-2)` |
| `.topbar` padding | 10 16 | `var(--sp-2) var(--sp-4)` (keeps a 64px bar with the 48px button) |
| `.kpis` margin-bottom | 14 | `var(--sp-4)` |
| `.mood-msg` margin | 14 0 4 | `0 0 var(--sp-3)` (it is the first child of its card) |
| inline spacers `<div style="height:10px">`, `height:16px` | – | remove; use `margin-top:var(--sp-3)` / `var(--sp-4)` on the next element |

### 1.4 Radius scale

| Token | px | Use |
|---|---|---|
| `--r-sm` | 10 | `.check .game`, `.seg button`, `.legend i.bar` |
| `--r-md` | 14 | `.input`, `.btn.small`, `.icon-btn`, `.x-btn`, `.callout`, `.vent li`, `.toast`, `.seg` |
| `--r-lg` | 18 | `.btn`, `.btn.big`, `.praise-btn`, `.check`, `.goal`, `.tool`, `.kpi`, `.reward`, `.mood-msg`, `.yn .chip` |
| `--r-xl` | 24 | `.card`, `.mood`, `.stopwords div`, `.modal-card` |
| `--r-pill` | 999 | `.chip`, `.pill`, `.now-badge`, `.phase-chip`, nav indicator |

---

## 2. P1 – must fix

### P1-1 · Color system fails WCAG AA in key places (both themes)
- **Where:** global `:root`, `.btn`, `.hero`, `.pill.blue`, `.reward b`, `.kpi em`, `.btn.danger`, `.input`, `.chip`, `.mood[data-c]`, `.ex .circle`, chart bars.
- **Problem:** see §1.1. The worst cases: in dark mode the **hero text is white on light teal (2.15:1)**, every **primary button is 3.66:1**, the **wall-push counter is 1.76:1**, and input borders are 1.28:1, so fields are barely visible on white cards.
- **Change:**
  1. Replace the token block with §1.
  2. `.hero{background:linear-gradient(135deg,var(--hero-from),var(--hero-to));color:var(--on-hero)}` · `.hero .eyebrow,.hero h1 small{opacity:1}` (opacity .9 pushes white below 4.5).
  3. `.hero .phase-chip{background:rgba(6,32,36,.22);margin:2px 0;margin-inline-end:6px}` (the white-20% chip was 3.4:1).
  4. `.input{border:1.5px solid var(--line-strong)}` · `.input::placeholder{color:var(--placeholder);opacity:1}` · `.chip{border-color:var(--line-strong)}` · `.check .box{border-color:var(--accent)}` (already OK).
  5. `.pill.blue{color:var(--blue-strong)}` · `.hbars .track span{background:var(--blue)}`.
  6. `.praise-btn{background:linear-gradient(135deg,var(--praise-from),var(--praise-to));color:var(--on-praise)}`.
  7. Moods: delete `.mood[data-c=red]{…color:#fff}` and `.mood[data-c=green]{…color:#fff}` text colors and set `.mood{color:var(--on-mood)}` for all four. The softer tokens also make the thermometer less aggressive for a child who is already angry.
  8. `.pro{border-color:var(--warn-line)}`. Delete the `color-mix(...)` border.
  9. Status bar: `<meta name="theme-color" content="#e0f0f3" media="(prefers-color-scheme: light)">` and `content="#10232a"` for dark (currently `#21958a` teal above a light header). **Android teammate:** status bar `#e0f0f3` with dark icons (light theme) / `#10232a` with light icons (dark theme); navigation bar `#ffffff` / `#16292d`. In `setupInstall()` keep `theme_color:'#1a7f76'` and set `background_color:'#eef7f6'`.

### P1-2 · Numeric ranges render reversed (bidi): "1–5 דקות" shows as "5–1"
- **Where:** checklist titles (`CHECKS`: "30–60", "10–15"), incident chips (`INC.duration`: "1–5", "5–15", "15–30"), hour buckets (`hourBucket()`: "(6–12)"…), the guide (`weeksLabel()` "שבועות 2–4", "9–11", "6–8", "20–30"), `proReasons` ("15–30"), settings ("2–3 יעדים"). Visible in every screenshot: "60–30 דקות תנועה בחוץ", "שבועות 4–2", "(18–15)".
- **Problem:** the en dash (U+2013) is a neutral character, so in RTL each number becomes its own run and the order flips. At 360px the range can also wrap at the dash ("15–" / "30").
- **Change:** do **not** change the stored strings: `INC.*` values are persisted and compared (`LONG_DUR`). Fix the text nodes after rendering instead. Add this utility:
  ```js
  // Wrap "12–15" in an LTR isolate and glue it so it never breaks across lines.
  function fixRanges(root) {
    if (!root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (/\d–\d/.test(n.data) && !n.data.includes('⁦'))
        n.data = n.data.replace(/(\d+)–(\d+)/g, '⁦$1⁠–⁠$2⁩');
    }
  }
  ```
  Call it as the **last line** of `renderToday()`, `renderCalm()`, `renderIncident()`, `renderProgress()`, `renderGuide()` (with `$('#tab-…')`) and `openSettings()` (with `$('#setInner')`). It only touches text nodes, so `data-val` attributes stay intact and chip matching keeps working. (I verified this in the mock: "30–60", "(15–18)" and "שבועות 2–4" render correctly in both themes.)

### P1-3 · Native `confirm()` dialogs → styled in-app confirm sheet
- **Where:** `ACT.delPraise`, `ACT.delIncident`, `ACT.reset` (2×), `importData()`.
- **Problem:** the native dialog in an Android WebView shows the page URL or "file://" as its title, uses system fonts, is LTR-styled, ignores dark mode and looks broken. In a calm app, an alarming system alert is the wrong tone.
- **Change:** add one reusable bottom-anchored confirm sheet (thumb-reachable, Material-style).
  **Markup** (before `<div id="toast">`):
  ```html
  <div id="dlg" class="modal" hidden role="alertdialog" aria-modal="true" aria-labelledby="dlgTitle" aria-describedby="dlgBody">
    <div class="modal-card">
      <h2 id="dlgTitle"></h2>
      <p id="dlgBody"></p>
      <div class="modal-actions">
        <button type="button" class="btn ghost" id="dlgCancel">ביטול</button>
        <button type="button" class="btn" id="dlgOk">אישור</button>
      </div>
    </div>
  </div>
  ```
  **CSS:**
  ```css
  .modal{position:fixed;inset:0;z-index:80;display:grid;place-items:end center;
    padding:var(--sp-4) var(--sp-4) calc(var(--sp-4) + env(safe-area-inset-bottom));
    background:var(--scrim);animation:fadeIn .2s ease}
  .modal[hidden]{display:none}
  .modal-card{width:100%;max-width:420px;background:var(--surface);border-radius:var(--r-xl);
    padding:var(--sp-6) var(--sp-5) var(--sp-5);box-shadow:var(--shadow-lg);
    animation:sheetUp .25s cubic-bezier(.2,.8,.2,1)}
  .modal-card h2{font-size:var(--fs-md);line-height:var(--lh-tight);margin:0 0 var(--sp-2)}
  .modal-card p{color:var(--muted);margin:0 0 var(--sp-5)}
  .modal-card p[hidden]{display:none}
  .modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3)}
  .btn.danger-solid{background:var(--danger);color:#fff;box-shadow:none}
  @keyframes sheetUp{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
  @keyframes fadeIn{from{opacity:0}}
  ```
  (`#fff` on `--danger #a8302f` = 6.71. In dark mode `--danger` is `#f08a8a`, so use `color:#2a0b0b` there: `@media (prefers-color-scheme:dark){.btn.danger-solid{color:#2a0b0b}}` = 7.56. The tense grey circle label: white on `#8695a2` = 3.07, which passes for large text.)
  In RTL the DOM order cancel → confirm puts **confirm on the left**, which mirrors Android's LTR placement. That's correct.
  **JS:**
  ```js
  function ask({ title, body = '', ok = 'אישור', cancel = 'ביטול', danger = false }) {
    return new Promise(resolve => {
      const d = $('#dlg'), okB = $('#dlgOk'), cB = $('#dlgCancel'), prev = document.activeElement;
      $('#dlgTitle').textContent = title;
      $('#dlgBody').textContent = body; $('#dlgBody').hidden = !body;
      okB.textContent = ok; cB.textContent = cancel;
      okB.className = 'btn' + (danger ? ' danger-solid' : '');
      d.hidden = false; cB.focus();
      const done = v => {
        d.hidden = true; okB.onclick = cB.onclick = d.onclick = null;
        document.removeEventListener('keydown', onKey, true);
        if (prev && prev.focus) prev.focus();
        resolve(v);
      };
      const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
      okB.onclick = () => done(true); cB.onclick = () => done(false);
      d.onclick = e => { if (e.target === d) done(false); };
      document.addEventListener('keydown', onKey, true);
    });
  }
  ```
  Make the handlers `async` and use it like this:
  | Call site | `ask({...})` |
  |---|---|
  | `delPraise` | `title:'למחוק את הרישום?', ok:'מחיקה', danger:true` |
  | `delIncident` | `title:'למחוק את האירוע?', body:'הוא יוסר גם מהגרפים ומהסיכום.', ok:'מחיקה', danger:true` |
  | `importData` (inside `onload`, make it `async`) | `title:'לייבא את הגיבוי?', body:'הייבוא יחליף את כל הנתונים שנמצאים עכשיו בטלפון.', ok:'ייבוא', danger:true` |
  | `reset` step 1 | `title:'למחוק את כל הנתונים?', body:'כל הרישומים, הכוכבים וההגדרות יימחקו מהטלפון, ואי אפשר יהיה לשחזר אותם. מומלץ לייצא גיבוי קודם.', ok:'המשך', danger:true` |
  | `reset` step 2 | `title:'בטוחים?', body:'זה הצעד האחרון – אחריו הכול נמחק.', ok:'כן, למחוק הכול', danger:true` |

### P1-4 · Keyboard / accessibility: no visible focus, nested interactive controls
- **Where:** global; `.input:focus{outline:none}`; checklist `.check[role=checkbox]` in `renderToday()`; the `keydown` handler for `[role=checkbox]`.
- **Problem:** (a) there's no `:focus-visible` style anywhere, and inputs remove the outline entirely. (b) The `▶ התחילו 3 דקות נשימה` `<button>` sits **inside** a `div[role=checkbox]`. Interactive content nested in another control is invalid: screen readers announce it wrongly, and one tap can hit both (patched with `stopPropagation`). (c) The checklist uses `<br>` and `<div>` inside the control.
- **Change:**
  ```css
  :focus-visible{outline:3px solid var(--focus);outline-offset:2px}
  .input:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 28%,transparent)}
  .check-hit:focus-visible{outline-offset:-3px}
  ```
  Restructure each checklist row in `renderToday()`:
  ```html
  <div class="check ${done ? 'done' : ''}">
    <button type="button" class="check-hit" role="checkbox" aria-checked="${done}" data-act="check" data-id="${c.id}">
      <span class="box">${CHECK_SVG}</span>
      <span class="cbody">
        <span class="when">${c.icon} ${c.when}</span>
        <span class="ctitle">${c.title}</span>
        ${c.sub ? `<span class="sub">${c.sub}</span>` : ''}
      </span>
    </button>
    <!-- extras live OUTSIDE the toggle -->
    ${c.id === 'stop' ? `<div class="check-extra"><div class="game">…</div></div>` : ''}
    ${c.id === 'morning' && !done ? `<div class="check-extra"><button class="btn small" data-act="morningBreath">…</button></div>` : ''}
  </div>
  ```
  ```css
  .check{display:block;padding:0}
  .check-hit{all:unset;box-sizing:border-box;display:flex;gap:var(--sp-3);align-items:flex-start;width:100%;
    padding:var(--sp-3) var(--sp-4);border-radius:inherit;cursor:pointer;text-align:start}
  .check .when,.check .ctitle,.check .sub{display:block}
  .check-extra{padding:0 var(--sp-4) var(--sp-3);padding-inline-start:calc(var(--sp-4) + 34px + var(--sp-3))}
  .check-extra .game{margin-top:0}
  ```
  Then delete the `[role=checkbox]` branch of the `keydown` listener (a `<button>` handles Enter/Space natively) and remove `e.stopPropagation()` from `ACT.morningBreath`. Also give the 3 rule inputs and 3 goal inputs in `openSettings()` an accessible name: `aria-label="חוק ${i+1}"` / `aria-label="יעד ${i+1}"`, because a placeholder is not a label.

### P1-5 · Tap targets under 44px
- **Where:** `.x-btn` (delete praise ×, delete incident 🗑️) **40×40**; `.seg button` (הכול / רק מכות) **38px** tall; `.btn.small` 44 (OK, but 48 is preferred).
- **Change:** `.x-btn{width:48px;height:48px;border-radius:var(--r-md);display:grid;place-items:center}` · `.seg button{min-height:44px;padding:4px 16px}` · `.btn.small{min-height:48px}`. Replace the "×" and "🗑️" glyphs with the SVG icons in Appendix A (`close` for praise notes, `trash` for incidents) at 22px, `color:var(--muted)`.

### P1-6 · Breathing exercise: the counter is unreadable and swings in size
- **Where:** `startEx()` markup, `.ex .circle`, `.ex .num`, `applyStep()`, `EXS`.
- **Problem:** `.num` lives **inside** the scaled circle with `transform:scale(2)`, so the digit swings from ~57px to ~128px every breath and dominates the screen. It's white on a light-teal highlight, 2.15:1 in dark mode, and white on orange (1.76:1) in the wall exercise. There's also no word inside the circle saying *what* to do now, which is the main cue a 10-year-old needs.
- **Change:**
  1. Markup in `startEx()` (non-`words` branch):
     ```html
     <div class="stage">
       <div class="ring"></div>
       <div class="circle" id="exCircle"></div>
       <div class="stage-label" aria-hidden="true"><span class="phase" id="exPhase"></span><span class="num" id="exNum"></span></div>
     </div>
     <p class="ex-text" id="exText" aria-live="polite"></p>
     ```
  2. CSS (replaces `.ex .ring`, `.ex .circle` background, `.ex .num`):
     ```css
     .ex .stage > *{grid-area:1/1}
     .ex .ring{position:static;width:100%;height:100%;border-radius:50%;border:2px dashed color-mix(in srgb,var(--accent) 45%,transparent)}
     .ex .circle{background:radial-gradient(circle,var(--breath-mid) 0 50%,var(--breath-lo) 100%);
       box-shadow:inset 0 24px 48px -12px rgba(255,255,255,.35),0 10px 40px color-mix(in srgb,var(--breath-mid) 40%,transparent)}
     .ex .circle.tense{background:radial-gradient(circle,#8695a2,#5d6b78)}
     .ex .circle.push{background:radial-gradient(circle,var(--praise-from),var(--praise-to))}
     .ex .stage-label{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;line-height:1.1;color:var(--on-breath);pointer-events:none}
     .ex .stage.tense .stage-label{color:#fff}
     .ex .stage.push .stage-label{color:var(--on-praise)}
     .ex .stage-label .phase{font-size:var(--fs-md);font-weight:800}
     .ex .stage-label .num{font-size:var(--fs-display);font-weight:800;font-variant-numeric:tabular-nums}
     ```
     Delete the old `.ex .num{… transform:scale(2) …}` rule. The circle at minimum scale (.45 × 281px at 360w = 126px) still fits the label (≈80×82px).
  3. Add a short `label` to each step in `EXS`: balloon/candle `'שואפים'`, `'נושפים'` · box `'שואפים'`, `'מחזיקים'`, `'נושפים'`, `'מחכים'` · robot `'מכווצים'`, `'משחררים'` · wall `'דוחפים'`, `'נושמים'`.
  4. In `applyStep()` add: `$('#exPhase').textContent = st.label || ''; $('.ex .stage').className = 'stage' + (st.cls ? ' ' + st.cls : '');`.
  (I verified this in the mock, light and dark: `/tmp/design-shots/mock/390L-ex-balloon.png`, `390D-ex-wall.png`.)

### P1-7 · Calm tab: after choosing a feeling, the message scrolls under the sticky top bar
- **Where:** `ACT.mood` → `#moodTools.scrollIntoView({block:'start'})`.
- **Problem:** the first line of the most important message ("עצור! קודם הגוף…") is hidden behind the translucent header (screenshot `390L-calm-red.png`).
- **Change:** `html{scroll-padding-top:calc(var(--topbar-h) + 12px + env(safe-area-inset-top))}`. This also fixes every other `scrollIntoView`. (I verified this in the mock.)

### P1-8 · Android back button must close overlays, not exit the app
- **Where:** `startEx`/`stopEx`, `openSettings`/`closeSettings`, `celebrate`, `ask()`; Android wrapper.
- **Problem:** in the APK, the hardware/gesture back during a breathing exercise, settings or celebration will exit the app (or do nothing). That's the most "un-native" behaviour a user can hit, and the child is the one most likely to hit it.
- **Change:**
  ```js
  const openOverlay = name => { try { history.pushState({ ov: name }, ''); } catch (e) {} };
  const closeOverlayViaUI = fallback => { if (history.state && history.state.ov) history.back(); else fallback(); };
  window.addEventListener('popstate', () => {
    if (!$('#dlg').hidden) return $('#dlgCancel').click();
    if (!$('#exOverlay').hidden) return stopEx();
    if (!$('#celOverlay').hidden) { $('#celOverlay').hidden = true; return; }
    if (!$('#setOverlay').hidden) { if (S.settings.onboarded) closeSettings(); else openOverlay('settings'); return; }
    if (S.ui.tab !== 'today') showTab('today');
  });
  ```
  Call `openOverlay('ex'|'settings'|'cel'|'dlg')` when each overlay opens. Every UI close path (✕ buttons, "סיום", "יש!", Escape, `done()` in `ask`) goes through `closeOverlayViaUI(() => stopEx())` and so on, so the history stack stays in sync. For the tab rule (back from a non-home tab → היום, then exit), push `{tab:t}` in `showTab()` when leaving `today`, and use `history.replaceState(null,'')` when returning to it. **Android teammate:** in `onBackPressed`, call `webView.canGoBack() ? webView.goBack() : finish()`.

### P1-9 · Hebrew copy: wrong form of address and outright errors
- **Where / Change:** (the full copy list is in §5; these are the must-fix lines)
  | Where | Current | Proposed | Why |
  |---|---|---|---|
  | `renderGuide()` · 5 rules #1 | `1. קודם אתה רגוע` | `1. קודם אתם רגועים` | The app speaks to the parents in plural |
  | `celebrate()` | `כל הכבוד${name}!` → "כל הכבוד יואב!" | `כל הכבוד, ${name}!` (keep `כל הכבוד!` without a name) | Vocative comma |
  | `celebrate()` | `הגעתם ל-${n} כוכבים השבוע!` | `צברת ${n} כוכבים השבוע!` | The headline speaks to the child; don't switch to plural mid-screen |
  | `MOODS.red.msg` | `עצור! קודם הגוף. אף אחד לא נפגע – גם לא אתה. בחר כלי אחד עכשיו.` | `בוא נעצור רגע. שומרים על כולם – וגם עליך. בחר כלי אחד:` | "אף אחד לא נפגע" reads as "nobody was hurt" (a statement), and "עצור!" barks at a child who is already in red |
  | `renderProgress()` · `proReasons` (days) | `ב-${n} מתוך 7 הימים האחרונים היו אירועים – כמעט כל יום.` | n = 7: `בכל אחד מ-7 הימים האחרונים היו אירועים.` · otherwise: `ב-${n} מתוך 7 הימים האחרונים היו אירועים.` | "כמעט כל יום" is wrong when it is every day |
  | `renderProgress()` · `proReasons` (long) | `היו כמה התפרצויות ארוכות (מעל 15–30 דקות) בשבועיים האחרונים.` | `בשבועיים האחרונים היו ${long14} התפרצויות שנמשכו 15 דקות ויותר.` | "מעל 15–30" is meaningless |
  | `renderToday()` · reward line | `עוד ${n} כוכבים לפרס:` (n = 1 → "עוד 1 כוכבים") | n = 1: `עוד כוכב אחד לפרס:` | Agreement |
  | `pickInfo()` | `${x.all} אירועים, מתוכם ${x.hits} עם מכות` | 1 → `אירוע אחד`; hits 1 → `מתוכו אחד עם מכות`; hits 0 → `אף אחד מהם לא עם מכות` | Agreement |
  | `renderGuide()` · p3 ג׳נגה | `מוציאים לבנה בתורו עם טיימר.` | `כל אחד בתורו מוציא לבנה, עם טיימר.` | Plural verb with a singular "בתורו" |
  | `PHASES[p4].tip` | `…עוצרים, מגינים, ומדברים רק אחרי שנרגע.` | `…עוצרים, מגינים ומדברים רק אחרי שהוא נרגע.` | No comma before ו; "שנרגע" is ambiguous (we / he) |
  Add a helper: `const many = (n, one, word) => n === 1 ? one : `${n} ${word}`;` and use it for כוכבים, אירועים and שבחים.

---

## 3. P2 – should fix

### Global / visual system
**P2-1 · Adopt the type, spacing and radius scales** (§1.2–1.4). Apply the mapping tables. This removes the "almost the same" sizes (12.5/13/13.5, 14/14.5/15) that make the UI feel unpolished.

**P2-2 · Control icons: SVG, not emoji/glyphs.** Emoji render differently on Samsung, Pixel and old Android, and glyphs such as "✕", "×" and "⏸" come from fallback fonts at the wrong weight (the pause button shows a tiny "॥"). Keep emoji for **content** (moods, tools, vent list, guide items, card titles). Use the `.ic` SVG set in Appendix A for **controls**: `✕` in `startEx`/`finishEx`/`openSettings` → `close`; `×` in praise list → `close`; `🗑️` → `trash`; `⏸ השהיה`/`▶ המשך` → `pause`/`play` + text; `▶ התחילו…` → `play`; `⬇️ ייצוא`/`⬆️ ייבוא` → `download`/`upload`; `+ ⭐ הוסף כוכב` → `plus` + "הוסיפו כוכב". SVG size inside `.btn`: 20px; inside `.icon-btn`/`.x-btn`: 22px.

**P2-3 · Star button label is mis-ordered and in the wrong person.** `+ ⭐ הוסף כוכב` renders with the "+" stranded at the visual end, and it is masculine singular. Change it to `<button class="btn small star-btn" …>${ICON.plus}הוסיפו כוכב</button>`.

**P2-4 · Tap feedback everywhere.** `-webkit-tap-highlight-color:transparent` removes the native highlight, but only `.btn`, `.chip`, `.mood` and `.tool` have an `:active` state. Add:
`.check-hit:active,.x-btn:active,.icon-btn:active,.seg button:active,details>summary:active{background:color-mix(in srgb,var(--text) 6%,transparent)}` and `nav.bottom button:active .ind{background:color-mix(in srgb,var(--accent) 18%,transparent)}`.

**P2-5 · Fallbacks for older Android WebViews.** `color-mix()` needs Chromium 111+. Before each `color-mix` declaration in `.topbar`, `nav.bottom` and `.mood-msg`, put a solid fallback line: `.topbar{background:var(--bg-grad)}`, `nav.bottom{background:var(--surface)}`. Use `min-height:100vh;min-height:100dvh` on `body` (the address bar and Android gesture insets make plain `100vh` jump).

**P2-6 · Overlays: stop scroll chaining & lock properly.** Add `.overlay{overscroll-behavior:contain}` so pull-to-refresh/overscroll on the overlay doesn't scroll the page behind it.

### Top bar & bottom navigation
**P2-7 · Bottom nav → Material 3 style indicator.** The current active state paints the whole 78×64 cell, so it looks like a web tab bar. Wrap each nav `<svg>` in `<span class="ind" aria-hidden="true">…</span>` and use:
```css
nav.bottom{height:calc(var(--nav-h) + env(safe-area-inset-bottom))}
nav.bottom button{gap:4px;font-size:var(--fs-xs);border-radius:0;min-height:56px}
nav.bottom button .ind{display:grid;place-items:center;width:60px;height:32px;border-radius:var(--r-pill);transition:background .2s}
nav.bottom button svg{width:24px;height:24px}
nav.bottom button.active{background:none;color:var(--accent-strong)}
nav.bottom button.active .ind{background:var(--accent-soft)}
nav.bottom button.active svg{transform:none}
```
(Verified in the mock. It fits 5 tabs at 360px.)

**P2-8 · Hero card polish (Today).**
`.hero::after{inset-inline-start:auto;inset-inline-end:-60px;bottom:-90px;background:rgba(255,255,255,.08)}` moves the decorative circle to the left (end) side, so it no longer sits behind the right-aligned text.
Week strip: `.weeks{align-items:center}` · `.weeks i{background:rgba(255,255,255,.25)}` · `.weeks i.done{background:rgba(255,255,255,.85)}` · `.weeks i.now{background:#fff;height:12px;box-shadow:0 0 0 3px rgba(255,255,255,.35)}`. Done and future weeks were almost indistinguishable before. `.hero h1{font-size:var(--fs-2xl)}` · `.hero h1 small{font-size:var(--fs-md)}`.

### Today tab
**P2-9 · Praise input placeholder is truncated** ("…למשל: ויתר לאחיו ע"). Change the placeholder to `מה ראיתם? (לא חובה)` and move the example into the `.sub` line above it: `שבח ספציפי וחם, מיד כשרואים – למשל: "ראיתי שוויתרת לאחיך על התור". היעד: 5 ביום.`

**P2-10 · Two "current phase" badges in the Guide** (weeks 4, 6–9 and 8–9 overlap). In `renderGuide()`, compute `const latest = activePhases(w).slice(-1)[0].id`. Only `latest` gets `<span class="now-badge">השלב הנוכחי</span>`. The other active phase gets `<span class="now-badge soft">ממשיכים לתרגל</span>` with `.now-badge.soft{background:var(--accent-soft);color:var(--accent-strong)}` and a card border of `1.5px solid var(--accent-soft)` instead of 2px accent. Both stay open.

### Calm tab (child-facing)
**P2-11 · Mood button hierarchy.** `.mood small{font-size:var(--fs-sm);font-weight:700;opacity:1}`. At 14px/500/.85 opacity the feeling words were too faint for an upset child. Add `.mood{border-radius:var(--r-xl)}`. Keep red at the top (hot = up, matching the thermometer).

**P2-12 · `.mood-msg` accent bar is curved.** `border-inline-start:6px` on an 18px-radius box draws a bent "bracket". Replace it with:
```css
.mood-msg{border-inline-start:none;position:relative;overflow:hidden;margin:0 0 var(--sp-3);padding:14px 16px;padding-inline-start:22px;font-size:var(--fs-md)}
.mood-msg::before{content:"";position:absolute;inset-block:0;inset-inline-start:0;width:6px;background:var(--mood-c,var(--accent))}
```
In `renderCalm()`, set `style="--mood-c:${moodColor(selMood)};background:color-mix(in srgb, ${moodColor(selMood)} 18%, var(--surface))"`.

**P2-13 · Less to scan once a feeling is chosen.** With a mood selected, the screen shows the recommended tools **and** the full "כל הכלים" grid, so משפט העצירה appears twice. When `selMood` is set, render the all-tools card collapsed:
`<section class="card"><details><summary>🧰 כל הכלים</summary><div class="tools" style="margin-top:var(--sp-3)">…</div></details></section>`. Rename `הכלים שמתאימים עכשיו:` to `מה יעזור לך עכשיו:` (`.card h3` → use `h2` styling at `--fs-md`).

**P2-14 · Orphan tile in the tools grid.** "כל הכלים" has 1 wide + 5 tiles, so "לדחוף את הקיר" sits alone next to an empty cell. Replace the inline `map(toolBtn)` calls with:
```js
function toolGrid(ids, wideIds = []) {
  const narrow = ids.filter(t => !wideIds.includes(t));
  const extra = narrow.length % 2 ? narrow[narrow.length - 1] : null;
  return ids.map(t => toolBtn(t, wideIds.includes(t) || t === extra)).join('');
}
```
Split the style: `.tool.wide` = layout only (`grid-column:1/-1;flex-direction:row;min-height:76px;gap:12px`). Move the red/amber gradient to `.tool[data-ex=stop]{background:linear-gradient(135deg,var(--danger-soft),var(--warn-soft))}`.

**P2-15 · "Allowed ways to vent" look like buttons but do nothing.** `.vent li` has the same bordered tile look as the tappable `.tool`. A child will tap them. Use `.vent li{background:none;border:none;padding:var(--sp-2) var(--sp-1);font-weight:700}` · `.vent li span{font-size:28px}`.

### Exercise overlay
**P2-16 · Layout & controls.** Vertically center the stage: `.ex .stage{margin-top:auto}` with `.ex .ex-actions{margin-top:auto}` (today there's a large dead gap above the buttons). During an exercise there should be no filled primary: make "סיום" `btn ghost` and "השהיה" `btn ghost` + icon (a filled "סיום" invites quitting). `.stopwords div.on{transform:none;border-width:3px}`, because `scale(1.04)` pushes the active row to within 8px of the screen edge.

**P2-17 · Meta line.** In `updateExNums()`, when `EX.cycles === 1` show only `נשארו 0:12` (not "סבב 1 מתוך 1").

**P2-18 · Completion screen sends the parent to the wrong place.** After the morning breathing (started from **Today** via `ACT.morningBreath`), the done screen says "חזרה למדחום" and navigates to the Calm tab. Add `returnTo:'today'` to the `startEx('balloon', …)` options, store it on `EX`, and in `finishEx()` render `data-goto="${returnTo || 'calm'}"` with the label `returnTo === 'today' ? 'חזרה להיום' : 'חזרה למדחום'`.

**P2-19 · Reduced motion: keep breathing, drop the rest.** The global `transition-duration:.01ms !important` overrides the inline `transitionDuration`, so under reduced motion the circle **jumps** between sizes and the exercise loses its only visual pacing cue. A slow scale is the content here, not decoration. Add inside the existing `@media (prefers-reduced-motion: reduce)`:
`.ex .circle{transition-duration:var(--breath-dur,4s) !important}` and in `applyStep()`/`pauseEx()` also call `c.style.setProperty('--breath-dur', <same value you put in transitionDuration>)`. Shake, pulse, bounce, confetti and the tab `fadeUp` stay disabled. Add `scroll-behavior:auto !important` to that block too.

### Incident tab
**P2-20 · The protocol is below a long form.** During an outburst, a parent opens this tab looking for "what do I do now". Right under the `.sub` line, add `<button class="btn ghost small" data-act="gotoProtocol">🧭 מה עושים ברגע ההתפרצות?</button>` with `ACT.gotoProtocol = () => $('.steps-card').scrollIntoView({behavior: reduceMotion() ? 'auto' : 'smooth', block:'start'})`.

**P2-21 · Mark the one required field.** `<label class="lbl">מה הוא עשה? <span class="req">חובה</span> <span class="sub">(אפשר לבחור כמה)</span></label>` with `.req{display:inline-block;font-size:var(--fs-xs);font-weight:700;color:var(--accent-strong);background:var(--accent-soft);border-radius:var(--r-pill);padding:0 8px;margin-inline-start:6px;vertical-align:middle}`. Use a neutral color, not red: this is a stressful moment.

**P2-22 · Yes/No symmetry.** `✅ כן` / `לא`: remove the emoji (or give both one). Selected "no": `.yn .chip[data-val=no][aria-pressed=true]{background:var(--surface);color:var(--text);border:2px solid var(--text);font-weight:700}`.

**P2-23 · Recent list.** Replace `fmtDate(ts)` with a relative label (`היום` / `אתמול` / `d.m`), so "היום · 19:46 – מכה כלפי אח / אחות". The 🗑️ becomes the SVG `trash` (P1-5).

### Progress tab
**P2-24 · Bar chart: orientation, scale, legibility, selection.** Replace `barChart()` and `niceMax()` with the version in Appendix B. What changes:
(1) **RTL time axis:** week 1 sits at the right, matching the hero week strip (which already runs right-to-left) and the reading direction, with y-labels on the right.
(2) viewBox **320** wide (≈1:1 at 390px), so the 13-unit labels render at ~12–13px. Currently they're 10.5 units ≈ 9.8px.
(3) `niceMax` steps of 2/4/10/20, so 11 incidents → axis 12, not 20 (half the chart was empty).
(4) Solid token colors instead of `opacity:.62` (contrast 3.76+).
(5) The picked bar gets a 2px `var(--text)` outline, so it's distinguishable from the current week.
(6) The value label gets a surface-colored halo (`paint-order="stroke"`), so the target line no longer cuts through it.
In the legend: `.legend i.bar{background:var(--chart-bar)}` and the target text `יעד: עד ${Math.round(target)} בשבוע (ירידה של 70%)` (not "3.3"). `.chart-info` with no selection: `color:var(--muted);font-weight:400`. It currently looks like a bold link. (Verified in the mock: `/tmp/design-shots/mock/chart-light.png`, `chart-dark.png`.)

**P2-25 · Segmented control.** `.seg{background:var(--seg-track)}` · `.seg button[aria-pressed=true]{background:var(--seg-on)}`. In dark mode the selected segment was darker than the track (1.12:1). Hide the `.seg` when `totalInc === 0`.

**P2-26 · KPI cards.** Equal heights and a calmer delta:
```css
.kpi{display:flex;flex-direction:column;align-items:center;gap:2px;padding:var(--sp-3) var(--sp-2)}
.kpi b{font-size:28px;font-variant-numeric:tabular-nums}
.kpi span{font-size:var(--fs-xs);line-height:1.3}
.kpi em{margin-top:auto;font-size:var(--fs-xs);font-weight:700;padding:2px 8px;border-radius:var(--r-pill)}
.kpi em.good-t{background:var(--good-soft)}
.bad-t{color:var(--muted)}
```
An increase should **not** be red: the spec itself says small rises are normal. Delta copy: `↓ 82% משבוע 1` / `↑ 20% משבוע 1`. Also, "השבוע" is a partial week compared against a full week 1, so every Sunday shows a huge "drop". Until 7 days of the current week have passed, show `עד עכשיו · שבוע 1: ${base}` instead of a percent.

**P2-27 · Empty states need a next step.** Progress, no incidents: add a `btn small` "לרישום אירוע" (`data-act="tab" data-tab="incident"`) under the empty-state text. Today, no stars yet: fine as is.

**P2-28 · Hour buckets in chronological order** (`renderProgress()` → `שעות מועדות`): sort by `['בוקר (6–12)','צהריים (12–15)','אחר הצהריים (15–18)','ערב (18–21)','לילה (21–6)']` instead of by count, and give the max row `background:var(--blue-strong)`.

### Overlays: settings, onboarding, celebration
**P2-29 · Onboarding is a long settings form with the CTA below the fold.** The first screen a stressed parent sees is 9 inputs. In `openSettings(true)`:
- Welcome card copy: **"ברוכים הבאים ל״רגוע וחזק״"** / `12 שבועות, צעד קטן בכל יום. כאן תמצאו סדר יום קבוע, כלי רגיעה לילד, רישום אירועים מהיר ומעקב אחרי ההתקדמות. הכול נשמר רק בטלפון הזה.`
- Visible fields: `איך קוראים לילד?` and `מתי מתחילים?` with a `.sub` help line under the date: `שבוע 1 מתחיל בתאריך הזה. אפשר לבחור גם תאריך שכבר עבר.`
- Put the rules and stars cards inside `<details class="card"><summary>התאמה אישית: חוקי הבית וטבלת הכוכבים</summary>…</details>` with the sub line `אפשר לדלג – יש ברירות מחדל טובות, ואפשר לשנות בהגדרות.`
- Sticky footer CTA (also used for "שמירה" in settings):
  `.sheet-foot{position:sticky;bottom:0;margin:0 -16px;padding:var(--sp-3) 16px calc(var(--sp-3) + env(safe-area-inset-bottom));background:linear-gradient(to top,var(--bg) 75%,transparent)}`. Set `#setOverlay{padding-bottom:0}`. In settings mode, the backup and reset cards go **above** the footer.

**P2-30 · Settings header scrolls away.** `.sheet-head` in `#setOverlay`: `position:sticky;top:0;z-index:2;margin:0 -16px var(--sp-3);padding:calc(var(--sp-2) + env(safe-area-inset-top)) 16px var(--sp-2);background:var(--bg)`, and `#setOverlay{padding-top:0}`.

**P2-31 · Celebration overlay is see-through.** At `color-mix(var(--bg) 97%)`, the Today tab ghosts through behind the text. Use `.celebrate{background:radial-gradient(circle at 50% 30%,var(--warn-soft),var(--bg) 70%)}` (opaque, festive, verified in the mock), `.celebrate .trophy{animation:bounce 1s ease 4 alternate}` (not infinite), and `role="alertdialog" aria-labelledby="celTitle"` with `id="celTitle"` on the h2. Focus the "יש!" button on open. Add the label `הפרס שלך:` above the reward.

### Copy (P2)
**P2-32 · Apply the copy table in §5** (rows marked P2).

---

## 4. P3 – nice to have

- **P3-1** Header logo `.brand-logo span` breathes forever in peripheral vision. Run it 3 cycles on load (`animation-iteration-count:3`) or only on the Calm tab.
- **P3-2** Calm title personalised: `איך אתה מרגיש עכשיו${name ? ', ' + name : ''}?` (and keep "איך אני מרגיש עכשיו?" without a name). It signals "this is my space".
- **P3-3** Completion screen: instead of only "חזרה למדחום", show the 4 mood dots (48px, colored, emoji only) under "איך אתה מרגיש עכשיו?". Tapping one logs the mood (`S.moods.push`) and returns to Calm with it selected.
- **P3-4** For single-item deletes (praise, incident), replace the confirm sheet with an **undo toast**: delete immediately and show `נמחק · ביטול` for 5s. Add the button inside `.toast`, `pointer-events:auto`, min 44px.
- **P3-5** Pro-help card: add the action `btn ghost small` "מתי ולמי לפנות" → switch to Guide and open the "מתי לפנות לאיש מקצוע" `<details>`.
- **P3-6** Multi-select chips: show a check when pressed. `.chip[data-multi="1"][aria-pressed=true]::before{content:"";width:14px;height:14px;margin-inline-end:6px;background:currentColor;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5' fill='none' stroke='black' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat}` (+ `display:inline-flex;align-items:center` on `.chip`). This separates "pick one" from "pick several".
- **P3-7** Checklist done state: instead of `line-through`, use `.check.done .ctitle{color:var(--muted)}`. Strikethrough Hebrew with descenders reads poorly.
- **P3-8** Box-breathing tile icon `🟦` reads as "a blue square", not as breathing. Swap it for an inline SVG of a rounded square with a dot travelling its edges (same `.ti` size). The emoji is acceptable meanwhile.
- **P3-9** Tab switch animation `.tab{animation:fadeUp .2s ease}` (was .35s). Snappier, more native.
- **P3-10** Encouragement card: split it into a headline (`<b>`) with the % result and a body paragraph. Move the 🎉 out of mid-sentence.
- **P3-11** Chart accessibility: tapping a row in `table.wk` sets `chartPick.inc` too (the bar hit areas are ~25px wide). Also add `aria-label="שבוע ${wk}: ${v}"` on each hit `<rect>`, with `role="button"`.
- **P3-12** Settings "כמה כוכבים…": replace the number field with a −/+ stepper (two 48px `btn ghost` around a 64px read-only value). It avoids the numeric keyboard.
- **P3-13** Consistent haptics: 10ms for chips, 20ms for checks/moods, `[30,40,30]` for success. They currently range from 10 to 30 at random.

---

## 5. Hebrew copy review (current → proposed)

Address rules: **parents = plural (אתם)**; **Calm tab and exercises = the child, masculine singular** (the impersonal plural present tense, as in "שואפים… נושפים…", is the standard gentle Hebrew instruction register and stays). Tone: warm, short, never shaming. Spelling: the Academy's full spelling, **הכול** (not הכל).

| # | Pri | Where | Current | Proposed |
|---|---|---|---|---|
| 1 | P1 | 5 rules #1 | קודם אתה רגוע | קודם אתם רגועים |
| 2 | P1 | `celebrate()` | כל הכבוד יואב! / הגעתם ל-15 כוכבים השבוע! | כל הכבוד, יואב! / צברת 15 כוכבים השבוע! + label "הפרס שלך:" |
| 3 | P1 | `MOODS.red.msg` | עצור! קודם הגוף. אף אחד לא נפגע – גם לא אתה. בחר כלי אחד עכשיו. | בוא נעצור רגע. שומרים על כולם – וגם עליך. בחר כלי אחד: |
| 4 | P1 | pro reason (days) | ב-7 מתוך 7 הימים האחרונים היו אירועים – כמעט כל יום. | בכל אחד מ-7 הימים האחרונים היו אירועים. (n<7: ב-n מתוך 7 הימים האחרונים היו אירועים.) |
| 5 | P1 | pro reason (long) | היו כמה התפרצויות ארוכות (מעל 15–30 דקות) בשבועיים האחרונים. | בשבועיים האחרונים היו n התפרצויות שנמשכו 15 דקות ויותר. |
| 6 | P1 | reward line, chart pick | עוד 1 כוכבים לפרס · 1 אירועים | עוד כוכב אחד לפרס · אירוע אחד (helper `many()`) |
| 7 | P1 | guide p3 ג׳נגה | מוציאים לבנה בתורו עם טיימר. | כל אחד בתורו מוציא לבנה, עם טיימר. |
| 8 | P1 | `PHASES.p4.tip` | …עוצרים, מגינים, ומדברים רק אחרי שנרגע. | …עוצרים, מגינים ומדברים רק אחרי שהוא נרגע. |
| 9 | P2 | `MOODS.orange.msg` | הכעס גדל. זה הרגע להוציא אותו בדרך מותרת, לפני שהוא מתפוצץ. | הכעס גדל. בוא נוציא אותו בדרך מותרת – לפני שהוא מתפוצץ. |
| 10 | P2 | `MOODS.green.msg` | …זה זמן טוב לתרגל – כך הגוף יזכור גם כשיהיה קשה. | …זה זמן טוב לתרגל – ככה הגוף יזכור גם כשיהיה קשה. |
| 11 | P2 | Calm, tools heading | הכלים שמתאימים עכשיו: | מה יעזור לך עכשיו: |
| 12 | P2 | seg button, settings welcome, robot step | הכל | הכול (`הכול`, `אפשר לשנות הכול אחר כך`, `משחררים הכול – רך ורפוי`) |
| 13 | P2 | stars button | + ⭐ הוסף כוכב | הוסיפו כוכב (with plus icon) |
| 14 | P2 | praise input placeholder | מה ראיתם? (לא חובה) למשל: ויתר לאחיו על התור | מה ראיתם? (לא חובה) – example moves to `.sub` (P2-9) |
| 15 | P2 | praise delete aria-label | מחק | מחיקה |
| 16 | P2 | incident sub | רישום מהיר, פחות מ-30 שניות. רק לבחור. | רישום מהיר, פחות מ-30 שניות: בוחרים ושומרים. |
| 17 | P2 | incident label | מה עשה? (אפשר כמה) | מה הוא עשה? חובה (אפשר לבחור כמה) |
| 18 | P2 | incident label | איך הגבנו? (אפשר כמה) | איך הגבנו? (אפשר לבחור כמה) |
| 19 | P2 | incident label | כמה זמן נמשך? | כמה זמן זה נמשך? |
| 20 | P2 | incident label | השתמש בכלי הרגעה? | האם הוא השתמש בכלי הרגעה? |
| 21 | P2 | `INC.response` (display + stored; not aggregated anywhere, so it's safe to rename) | עצירה פיזית בשקט · הגנה על האח · הפרדה · הצעתי כלי הרגעה · חיכיתי שיירגע · שיחה אחרי שנרגע · תוצאה הגיונית · צעקתי / איבדתי סבלנות | עצרנו פיזית בשקט · הגנו על האח · הפרדנו · הצענו כלי הרגעה · חיכינו שיירגע · דיברנו אחרי שנרגע · נתנו תוצאה הגיונית · איבדנו סבלנות (קורה לכולם) — consistent first-person plural to match "איך הגבנו?"; the last item is non-shaming |
| 22 | P2 | validation toast | בחרו לפחות "מה עשה" | חסר רק דבר אחד: מה הוא עשה? |
| 23 | P2 | recent list | בלי כלי | בלי כלי הרגעה |
| 24 | P2 | protocol step 1 | להציע כלי: "בוא נדחוף את הקיר" או "נשימת בלון איתי". | להציע כלי: "בוא נדחוף את הקיר" או "בוא נעשה ביחד נשימת בלון". |
| 25 | P2 | protocol h3 #3 | ואז | אחר כך |
| 26 | P2 | 5 rules #1 body | נושמים, מנמיכים קול, ורק אז מגיבים. | נושמים, מנמיכים את הקול ורק אז מגיבים. |
| 27 | P2 | chart title | אירועים לשבוע | אירועים בכל שבוע |
| 28 | P2 | chart legend | יעד (ירידה של 70%): 3.3 | יעד: עד 3 בשבוע (ירידה של 70%) |
| 29 | P2 | KPI delta | ירידה של 82% מול שבוע 1 / עלייה של … | ↓ 82% משבוע 1 / ↑ 20% משבוע 1 (partial week: עד עכשיו · שבוע 1: 11) |
| 30 | P2 | table header | כלי | כלי % |
| 31 | P2 | settings label | שם הילד | איך קוראים לילד? |
| 32 | P2 | settings label | תאריך התחלת התוכנית | מתי מתחילים? + help "שבוע 1 מתחיל בתאריך הזה. אפשר לבחור גם תאריך שכבר עבר." |
| 33 | P2 | settings label | כמה כוכבים בשבוע צריך לפרס? | כמה כוכבים בשבוע מזכים בפרס? |
| 34 | P2 | backup buttons | ⬇️ ייצוא / ⬆️ ייבוא | ייצוא גיבוי / ייבוא מגיבוי (with SVG icons) |
| 35 | P2 | toasts | הקובץ לא תקין · הייצוא נכשל | זה לא נראה כמו קובץ גיבוי של רגוע וחזק · הייצוא נכשל. נסו שוב. |
| 36 | P2 | storage warning | שימו לב: לא ניתן לשמור נתונים בדפדפן הזה | שימו לב: הנתונים לא נשמרים במכשיר הזה. כדאי לייצא גיבוי מדי פעם. (in the APK there's no "browser") |
| 37 | P2 | Guide double badge | השלב הנוכחי ×2 | השלב הנוכחי + ממשיכים לתרגל (P2-10) |
| 38 | P2 | exercise meta, 1 cycle | סבב 1 מתוך 1 · נשארו 0:12 | נשארו 0:12 |
| 39 | P2 | done button after morning breath | חזרה למדחום | חזרה להיום (P2-18) |
| 40 | P3 | Calm h2 | איך אני מרגיש עכשיו? | איך אתה מרגיש עכשיו, יואב? (when a name is set) |

Checked and fine as they are: greetings, hero notes, CHECKS texts, GAMES, the vent list, the TOOLS subtitles, all exercise step texts (except #12), the protocol (except #24–25), the professional-help body, the guide phases (except #7, #26), the firstborn chapter, and the empty states. The geresh/gershayim (ג׳נגה, שפ״ח) use the correct Hebrew characters.

---

## 6. App icon

Files (all `viewBox="0 0 512 512"`):
- `docs/design/icon.svg`: full-bleed launcher/PWA icon (use it for `purpose:"any"` **and** `"maskable"`).
- `docs/design/icon-foreground.svg`: adaptive-icon foreground, transparent.
- `docs/design/icon-background.svg`: adaptive-icon background (solid fallback `#1a7f76`).

**Concept:** three balanced stones (strength through balance) inside soft breathing ripples (calm), resting on a still-water line. The calm teal → blue gradient matches `--hero-from/--hero-to`. No text. All artwork sits inside the central safe circle (r ≤ 160 of 169 = 66%), so it survives circle, squircle and rounded-square masks. I checked it rendered at 192px, 48px and 32px (`/tmp/design-shots/icon-preview.png`, `icon-48.png`): the stone stack stays recognisable at 48px.
**Engineer:** replace `makeIcon()` canvas drawing with the SVG rasterised to PNG at 192 and 512 (draw the SVG into the canvas via `new Image()` with a data-URI and `drawImage`, or embed pre-rendered base64 PNGs). Use the same image for the `apple-touch-icon` and the favicon. **Android teammate:** `mipmap-anydpi-v26/ic_launcher.xml` with `icon-background.svg` + `icon-foreground.svg` converted to vector drawables (or PNGs per density). Legacy `ic_launcher.png` comes from `icon.svg`.

---

## Appendix A – control icon set (24×24, use with existing `.ic` class)

```js
const ICON = {
  close:   '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  trash:   '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>',
  plus:    '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  pause:   '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" style="stroke-width:3"><path d="M9 5v14M15 5v14"/></svg>',
  play:    '<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>',
  download:'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  upload:  '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V9M7 14l5-5 5 5M5 4h14"/></svg>'
};
```
`.btn .ic{width:20px;height:20px;flex:0 0 auto}` · `.icon-btn .ic,.x-btn .ic{width:22px;height:22px}`. Media "play" is never mirrored in RTL.

## Appendix B – `niceMax()` + RTL `barChart()` (drop-in replacement, verified in the mock)

```js
function niceMax(v) { if (v <= 4) return 4; const step = v <= 10 ? 2 : v <= 20 ? 4 : v <= 50 ? 10 : 20; return Math.ceil(v / step) * step; }
function barChart({ id, vals, max, cur, refs = [], fmt = v => v, pick }) {
  // RTL time axis: week 1 at the right, y-axis labels on the right.
  const W = 320, H = 200, pr = 34, pl = 6, pt = 20, pb = 28;
  const pw = W - pl - pr, ph = H - pt - pb, slot = pw / 12, bw = slot * .6;
  const y = v => pt + ph - (v / max) * ph;
  const slotX = i => W - pr - (i + 1) * slot;          // left edge of week i's slot
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${id === 'inc' ? 'גרף אירועים לפי שבוע' : 'גרף שימוש בכלי הרגעה לפי שבוע'}">`;
  [0, max / 2, max].forEach(t => {
    s += `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="var(--chart-grid)" stroke-width="1"/>`;
    s += `<text x="${W - pr + 6}" y="${y(t) + 4.5}" font-size="13" text-anchor="start" fill="var(--muted)">${fmt(Math.round(t))}</text>`;
  });
  vals.forEach((v, i) => {
    const x = slotX(i) + (slot - bw) / 2, wk = i + 1, isCur = wk === cur, isPick = wk === pick;
    const fill = isCur ? 'var(--chart-bar-cur)' : 'var(--chart-bar)';
    if (v != null && v > 0) {
      const h = Math.max(3, (v / max) * ph), top = pt + ph - h, r = Math.min(4, h / 2, bw / 2);
      s += `<path d="M${x} ${pt + ph}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + bw - r}Q${x + bw} ${top} ${x + bw} ${top + r}V${pt + ph}Z" fill="${fill}"${isPick ? ' stroke="var(--text)" stroke-width="2"' : ''}/>`;
      if (isCur || isPick) s += `<text x="${x + bw / 2}" y="${top - 6}" font-size="13" font-weight="800" text-anchor="middle" fill="var(--text)" stroke="var(--surface)" stroke-width="4" stroke-linejoin="round" paint-order="stroke">${fmt(v)}</text>`;
    } else if (v === 0) {
      s += `<rect x="${x}" y="${pt + ph - 3}" width="${bw}" height="3" rx="1.5" fill="${fill}"/>`;
    }
    s += `<text x="${x + bw / 2}" y="${H - 8}" font-size="13" text-anchor="middle" fill="${isCur ? 'var(--text)' : 'var(--muted)'}" font-weight="${isCur ? 800 : 400}">${wk}</text>`;
    s += `<rect x="${slotX(i)}" y="${pt}" width="${slot}" height="${ph + pb}" fill="transparent" data-act="bar" data-chart="${id}" data-w="${wk}" style="cursor:pointer"/>`;
  });
  refs.forEach(r => {
    s += `<line x1="${pl}" x2="${W - pr}" y1="${y(r.v)}" y2="${y(r.v)}" stroke="${r.color}" stroke-width="2" ${r.dash ? 'stroke-dasharray="5 4"' : ''} pointer-events="none"/>`;
  });
  return s + '</svg>';
}
```
Keep `.chart{direction:ltr}`: SVG coordinates are physical. The RTL ordering is done in `slotX()`.
