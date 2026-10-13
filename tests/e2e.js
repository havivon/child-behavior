#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';
/**
 * End-to-end acceptance suite for "רגוע וחזק" (index.html).
 *
 *   node tests/e2e.js                 run everything
 *   node tests/e2e.js stars calm      run only tests whose name contains one of the words
 *   SHOTS=/tmp/qa-shots node tests/e2e.js   also save a screenshot when a test fails
 *
 * Every test gets a fresh browser context (mobile emulation 375x760, touch,
 * Asia/Jerusalem time zone, he-IL locale) and a fake clock (page.clock), so the
 * suite is hermetic: no network, no shared storage, no dependence on "today".
 * Each test is mapped to the line of docs/spec.md it verifies ("spec:").
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const KEY = 'ragua-vehazak-v1';
const TZ = 'Asia/Jerusalem';
const DAY = 864e5;
const SHOTS = process.env.SHOTS || '';

/* ------------------------------------------------------------------ *
 * Time helpers (all expressed in Asia/Jerusalem wall-clock time)
 * ------------------------------------------------------------------ */
const fmtKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtHour = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** 'YYYY-MM-DD' of an instant, in Jerusalem */
const keyJ = d => fmtKey.format(new Date(d));
/** instant for a Jerusalem wall-clock time 'YYYY-MM-DDTHH:MM' (handles DST) */
function tsJ(s) {
  for (const off of ['+03:00', '+02:00']) {
    const d = new Date(s + ':00' + off);
    if (keyJ(d) === s.slice(0, 10) && fmtHour.format(d) === s.slice(11, 16)) return d.getTime();
  }
  throw new Error('bad local time ' + s);
}
const addDaysKey = (k, n) => { const d = new Date(k + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** Monday 12 Oct 2026, 10:00 Jerusalem — the default "now" of the suite */
const NOW = tsJ('2026-10-12T10:00');
const TODAY = keyJ(NOW);
/** start date such that NOW falls in program week w (day 1 of that week) */
const startForWeek = (w, now = NOW) => addDaysKey(keyJ(now), -(w - 1) * 7);
/** wall-clock time on day `dayIndex` (0-based) of program week w, given start date */
const tsIn = (start, w, dayIndex = 0, hhmm = '17:00') => tsJ(addDaysKey(start, (w - 1) * 7 + dayIndex) + 'T' + hhmm);

const PHASE_NAMES = { 1: ['מיפוי'], 2: ['ויסות גופני'], 3: ['ויסות גופני'], 4: ['ויסות גופני', 'שליטה עצמית'], 5: ['שליטה עצמית'], 6: ['שליטה עצמית', 'ניהול כעס'], 7: ['שליטה עצמית', 'ניהול כעס'], 8: ['ניהול כעס', 'שתלטנות וחברה'], 9: ['ניהול כעס', 'שתלטנות וחברה'], 10: ['שתלטנות וחברה'], 11: ['שתלטנות וחברה'], 12: ['שתלטנות וחברה'] };

/* ------------------------------------------------------------------ *
 * State builders
 * ------------------------------------------------------------------ */
function makeState(o = {}) {
  return {
    v: 1,
    settings: Object.assign({
      childName: 'דני', startDate: startForWeek(1),
      rules: ['שומרים על הידיים לעצמנו', 'מדברים בכבוד', 'עוצרים ונושמים'],
      goals: [{ id: 'g1', text: 'שומר על ידיים לעצמו' }, { id: 'g2', text: 'משתמש בפינת הרגיעה' }],
      reward: 'פיצה משפחתית', starsNeeded: 15, onboarded: true
    }, o.settings || {}),
    days: o.days || {}, stars: o.stars || [], celebrated: o.celebrated || {}, moods: o.moods || [],
    incidents: o.incidents || [], ui: Object.assign({ tab: 'today', chartMode: 'all' }, o.ui || {})
  };
}
let idSeq = 0;
function inc(ts, o = {}) {
  return Object.assign({ id: 'i' + (++idSeq), ts, trigger: 'הפסד', target: 'אח / אחות', actions: ['צעקה'], duration: '1–5 דקות', response: [], used: null, note: '' }, o);
}
/** a state rich enough to exercise every screen */
function richState(week = 5) {
  const start = startForWeek(week);
  const incidents = [];
  const trig = ['הפסד', 'מעבר בין פעילויות', 'מסכים', 'אח לקח לו משהו'];
  for (let w = 1; w <= week; w++) {
    const n = Math.max(1, (9 - w * 1.5) | 0);
    for (let i = 0; i < n; i++) {
      const ts = w === week ? NOW - (i + 1) * 600e3 : tsIn(start, w, i % 7, ['08:10', '13:30', '16:45', '19:20', '22:05'][i % 5]);
      incidents.push(inc(ts, { trigger: trig[i % 4], actions: i % 2 ? ['מכה', 'צעקה'] : ['השתלטות'], used: i % 3 ? 'yes' : 'no', note: i === 0 ? 'הערה קצרה' : '' }));
    }
  }
  const days = {};
  days[TODAY] = { checks: { move: true }, praises: [{ ts: NOW - 3600e3, note: 'ויתר לאחיו על התור בלי שביקשו ממנו' }, { ts: NOW - 1800e3, note: '' }] };
  return makeState({ settings: { startDate: start }, incidents, days, stars: [{ goalId: 'g1', ts: NOW - 1000 }, { goalId: 'g2', ts: NOW - 900 }], moods: [{ ts: NOW - 600e3, c: 'yellow' }] });
}

/* ------------------------------------------------------------------ *
 * Mini test harness
 * ------------------------------------------------------------------ */
const tests = [];
function test(name, spec, fn, opts = {}) { tests.push({ name, spec, fn, opts }); }
class AssertionError extends Error {}
function assert(c, msg) { if (!c) throw new AssertionError(msg); }
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new AssertionError(`${msg}\n      expected: ${JSON.stringify(b)}\n      actual:   ${JSON.stringify(a)}`); }
const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg} (expected ≈${b}±${tol}, got ${a})`);

let browser;
/**
 * Open the app in a fresh context.
 * opts: state (object|string|null = no seeding), time (ms), clock (false = real clock),
 *       width, height, scheme ('light'|'dark'), offline, init (extra init script fn/str), goto (false)
 */
async function open(t, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: opts.width || 375, height: opts.height || 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    locale: 'he-IL', timezoneId: opts.tz || TZ, colorScheme: opts.scheme || 'light', acceptDownloads: true
  });
  t.ctxs.push(ctx);
  // Hermetic network: every remote request is recorded in t.remote. The app embeds its font, so nothing
  // remote is expected; a Google Fonts stylesheet would still get an empty stub (unless offline) so that
  // results never depend on the network.
  await ctx.route(/^https?:\/\//, route => {
    const u = route.request().url();
    t.remote.push(u);
    if (!opts.offline && u.startsWith('https://fonts.googleapis.com/')) return route.fulfill({ status: 200, contentType: 'text/css', body: '/* stub */' });
    return route.abort();
  });
  const state = opts.state === undefined ? makeState() : opts.state;
  if (state !== null) {
    await ctx.addInitScript(([k, v]) => {
      try { if (!localStorage.getItem('__qa_seeded')) { localStorage.setItem(k, v); localStorage.setItem('__qa_seeded', '1'); } } catch (e) { /* storage disabled by test */ }
    }, [KEY, typeof state === 'string' ? state : JSON.stringify(state)]);
  }
  if (opts.init) await ctx.addInitScript(opts.init);
  const page = await ctx.newPage();
  page.errors = [];
  page.dialogs = [];   // titles + bodies of the in-app confirm sheets answered with answer()
  page.on('console', m => { if (m.type() === 'error' && !(opts.offline && /Failed to load resource|ERR_/.test(m.text()))) page.errors.push('console.error: ' + m.text()); });
  page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
  // native alert()/confirm() must never appear (they were replaced by the in-app confirm sheet)
  page.on('dialog', d => { page.errors.push('native dialog shown: ' + d.message()); d.dismiss().catch(() => {}); });
  t.pages.push(page);
  if (opts.clock !== false) {
    const time = opts.time || NOW;
    await page.clock.install({ time: time - 10000 });
    await page.clock.pauseAt(time);
  }
  if (opts.goto !== false) { await page.goto(APP); await page.waitForSelector('main .tab.active', { state: 'attached' }); }
  return page;
}
const getState = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
const go = (page, tab) => page.click(`nav.bottom [data-tab=${tab}]`);
const txt = (page, sel) => page.locator(sel).first().innerText();
const toastText = page => page.textContent('#toast');
const visible = (page, sel) => page.locator(sel).first().isVisible();
async function setSettings(page, fields) {
  await page.click('.topbar [data-act=openSettings]');
  for (const [id, v] of Object.entries(fields)) await page.fill('#' + id, String(v));
  await page.click('#setOverlay [data-act=saveSettings]');
}
/**
 * page.reload() that tolerates a Chromium quirk with file:// pages: in a fresh context, a reload occasionally
 * comes back with an EMPTY localStorage (all writes of the previous document lost – reproduced with a 3-line
 * page and the original app build; never happens over http://). A marker key detects that case; the
 * pre-reload snapshot is then restored and the page reloaded again, so tests see what the app really saved.
 * (The seed guard lives in localStorage, not sessionStorage: sessionStorage is also occasionally lost on reload,
 * which made the seed script overwrite the app's data – the cause of a ~10% flake in the round-2 runs.)
 */
async function reload(page) {
  const snap = await page.evaluate(() => { localStorage.setItem('__qa_marker', String(Math.random())); return JSON.stringify(Object.entries(localStorage)); });
  await page.reload();
  for (let i = 0; i < 3 && !(await page.evaluate(() => localStorage.getItem('__qa_marker') !== null)); i++) {
    page.storageRetries = (page.storageRetries || 0) + 1;
    await page.evaluate(sn => { localStorage.clear(); for (const [k, v] of JSON.parse(sn)) localStorage.setItem(k, v); }, snap);
    await page.reload();
  }
}
const fileFrom = (name, content) => ({ name, mimeType: 'application/json', buffer: Buffer.from(content) });
/** answer the in-app confirm sheet (#dlg): ok=true → confirm button, false → cancel */
async function answer(page, ok) {
  await page.waitForSelector('#dlg:not([hidden])');
  page.dialogs.push((await page.textContent('#dlgTitle')) + ' | ' + (await page.textContent('#dlgBody')));
  const title = await page.textContent('#dlgTitle');
  await page.click(ok ? '#dlgOk' : '#dlgCancel');
  // closed, or replaced by a follow-up confirmation (reset asks twice)
  await page.waitForFunction(tt => document.querySelector('#dlg').hidden || document.querySelector('#dlgTitle').textContent !== tt, title);
}
/** tap "add star" like a person would: the app ignores a repeat tap on the same star button within 800 ms
 *  (double-tap guard, QA #10), and the suite's clock is paused, so advance it a little before every tap */
async function addStar(page, id) {
  await page.clock.runFor(1000);
  await page.click(`#tab-today [data-act=star][data-id=${id}]`);
}

/* In-page overflow probe: returns the scroll width and any element sticking out of the viewport. */
function overflowProbe() {
  const vw = document.documentElement.clientWidth;
  const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  const off = [];
  const desc = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + ' "' + (el.textContent || '').trim().slice(0, 30) + '"';
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('[hidden]') || el.classList.contains('confetti') || el.id === 'toast' || el.closest('#toast')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1 && el.tagName !== 'TEXTAREA' && el.tagName !== 'INPUT') off.push('scrolls horizontally: ' + desc(el) + ` (${el.scrollWidth}>${el.clientWidth})`);
    if (r.right > vw + 1 || r.left < -1) {
      let a = el.parentElement, clipped = false;
      while (a && a !== document.body && a !== document.documentElement) {
        const o = getComputedStyle(a).overflowX;
        if (/(hidden|clip)/.test(o)) { const ar = a.getBoundingClientRect(); if (ar.right <= vw + 1 && ar.left >= -1) { clipped = true; break; } }
        if (/(auto|scroll)/.test(o)) break; // reported by the scroll-container rule
        a = a.parentElement;
      }
      if (!clipped) off.push('outside viewport: ' + desc(el) + ` [${Math.round(r.left)}..${Math.round(r.right)} of ${vw}]`);
    }
  }
  return { vw, sw, off: [...new Set(off)].slice(0, 6) };
}

/* ================================================================== *
 * 1. Layout: no horizontal scroll, light & dark, all screens
 * ================================================================== */
async function tourScreens(page, label, problems) {
  const check = async where => {
    const r = await page.evaluate(overflowProbe);
    if (r.sw > r.vw + 1) problems.push(`${label} ${where}: page scrollWidth ${r.sw} > ${r.vw}`);
    r.off.forEach(o => problems.push(`${label} ${where}: ${o}`));
  };
  for (const tab of ['today', 'calm', 'incident', 'progress', 'guide']) {
    await go(page, tab);
    if (tab === 'calm') await page.click('#tab-calm .mood[data-c=red]');
    if (tab === 'incident') await page.evaluate(() => { document.querySelector('#tab-incident details').open = true; });
    if (tab === 'guide') await page.evaluate(() => document.querySelectorAll('#tab-guide details').forEach(d => { d.open = true; }));
    await check('tab ' + tab);
  }
  await page.click('.topbar [data-act=openSettings]');
  await check('settings');
  await page.click('#setOverlay [data-act=closeSettings]');
  await go(page, 'calm');
  for (const ex of ['stop', 'balloon', 'candle', 'box', 'robot', 'wall']) {
    await page.click(`#tab-calm .card:not(#moodTools) [data-ex=${ex}]`);
    await check('exercise ' + ex);
    if (ex === 'wall') { await page.clock.runFor(15000); await check('exercise completion screen'); }
    await page.click('#exOverlay [data-act=exClose] >> nth=-1');
  }
  await page.evaluate(() => celebrate(1));
  await check('celebration');
  await page.click('#celOverlay [data-act=celClose]');
  await page.evaluate(() => openSettings(true));
  await check('onboarding');
}
for (const scheme of ['light', 'dark']) {
  for (const width of [320, 360, 375, 390, 414]) {
    test(`layout: no horizontal overflow @${width}px ${scheme} (all tabs + overlays)`, 'עיצוב / דרישות טכניות: "בדיקה ב-375px רוחב, בלי גלילה אופקית"; "מצב כהה אוטומטי"', async t => {
      const page = await t.open({ width, scheme, state: richState(5) });
      const problems = [];
      await tourScreens(page, `${width}/${scheme}`, problems);
      assert(!problems.length, 'horizontal overflow:\n      ' + problems.join('\n      '));
    });
  }
}
test('layout: dark mode is applied automatically from prefers-color-scheme', 'עיצוב: "מצב כהה אוטומטי"', async t => {
  const light = await t.open({ scheme: 'light' });
  const dark = await t.open({ scheme: 'dark' });
  const bg = p => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  const lb = await bg(light), db = await bg(dark);
  assert(lb && db && lb !== db, `--bg should differ between light (${lb}) and dark (${db})`);
  const lum = await dark.evaluate(() => { const c = getComputedStyle(document.querySelector('.card:not(.hero)')).backgroundColor.match(/\d+/g).map(Number); return (c[0] + c[1] + c[2]) / 3; });
  assert(lum < 80, 'cards should be dark in dark mode, average channel = ' + lum);
});
test('layout: long unbroken user text does not overflow the screen', 'דרישות טכניות: "בלי גלילה אופקית" (adversarial input)', async t => {
  const long = 'א'.repeat(30), longGoal = 'ב'.repeat(50), longNote = 'ג'.repeat(120);
  const st = richState(3);
  st.settings.childName = long; st.settings.goals[0].text = longGoal; st.settings.reward = 'ד'.repeat(80);
  st.days[TODAY].praises.push({ ts: NOW - 60e3, note: longNote });
  st.incidents.push(inc(NOW - 120e3, { note: 'ה'.repeat(200) }));
  const page = await t.open({ width: 360, state: st });
  const problems = [];
  for (const tab of ['today', 'incident']) {
    // navigate programmatically: when the layout overflows, mobile Chrome zooms out and the nav buttons end up off-screen
    await page.evaluate(tb => { showTab(tb); if (tb === 'incident') document.querySelector('#tab-incident details').open = true; }, tab);
    const r = await page.evaluate(overflowProbe);
    const vv = await page.evaluate(() => ({ scale: visualViewport.scale, w: innerWidth }));
    if (vv.w > 361) problems.push(`${tab}: mobile layout viewport grew to ${vv.w}px (page zoomed out, scale ${vv.scale.toFixed(2)})`);
    if (r.sw > r.vw + 1) problems.push(`${tab}: scrollWidth ${r.sw} > ${r.vw}`);
    // culprits: elements whose own content is wider than their box
    const culprits = await page.evaluate(() => [...document.querySelectorAll('main .tab.active *')].filter(e => e.children.length === 0 || e.matches('h2,li,b,span')).filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible' && e.clientWidth > 0)
      .map(e => `${e.tagName.toLowerCase()}${e.className ? '.' + e.className : ''} (content ${e.scrollWidth}px in ${e.clientWidth}px box)`).slice(0, 4));
    culprits.forEach(c => problems.push(`${tab}: overflowing element ${c}`));
  }
  assert(!problems.length, 'content cut off / overflowing:\n      ' + problems.join('\n      '));
});

/* ================================================================== *
 * 2. Onboarding & settings
 * ================================================================== */
test('onboarding: first run shows welcome settings; cannot be dismissed; save starts the program', 'הגדרות; היום: "מחושב מתאריך התחלה שנבחר בהגדרות"', async t => {
  const page = await t.open({ state: null });
  assert(await visible(page, '#setOverlay'), 'welcome overlay must be visible on first run');
  assert((await txt(page, '#setTitle')).includes('ברוכים הבאים'), 'welcome title');
  eq(await page.locator('#setOverlay [data-act=closeSettings]').count(), 0, 'no close button during onboarding');
  await page.keyboard.press('Escape');
  assert(await visible(page, '#setOverlay'), 'Escape must not dismiss onboarding');
  eq(await page.inputValue('#sStart'), TODAY, 'start date defaults to today');
  await page.fill('#sName', '  יוסי  ');
  await page.fill('#sStart', startForWeek(3));
  await page.click('#setOverlay [data-act=saveSettings]');
  assert(!(await visible(page, '#setOverlay')), 'overlay closes after save');
  const s = await getState(page);
  eq([s.settings.onboarded, s.settings.childName, s.settings.startDate], [true, 'יוסי', startForWeek(3)], 'saved settings (name trimmed)');
  assert((await txt(page, '.hero h1')).replace(/\s+/g, ' ').includes('שבוע 3 מתוך 12'), 'hero week after onboarding');
  assert((await txt(page, '.hero .eyebrow')).includes('יוסי'), 'child name in greeting');
  await reload(page);
  assert(!(await visible(page, '#setOverlay')), 'onboarding not shown again after reload');
});
test('settings: values are saved and reflected (rules, goals, reward, stars needed)', 'הגדרות: "שם הילד, תאריך התחלה, 3 חוקי הבית, יעדי הכוכבים, הפרס ומספר הכוכבים הנדרש"', async t => {
  const page = await t.open();
  await setSettings(page, { sRule0: 'חוק א', sRule1: 'חוק ב', sRule2: 'חוק ג', sGoal0: 'יעד ראשון', sGoal1: 'יעד שני', sGoal2: 'יעד שלישי', sReward: 'טיול לים', sNeed: 9 });
  assert(!(await visible(page, '#setOverlay')), 'settings closed');
  eq(await toastText(page), 'נשמר ✓', 'toast');
  const goals = await page.locator('#tab-today .goal > b').allInnerTexts();
  eq(goals, ['יעד ראשון', 'יעד שני', 'יעד שלישי'], 'three goals rendered');
  eq(await page.locator('#tab-today ol.bullets li').allInnerTexts(), ['חוק א', 'חוק ב', 'חוק ג'], 'rules rendered');
  assert((await txt(page, '#tab-today .pill.blue')).includes('0/9'), 'stars needed in pill');
  assert((await txt(page, '#tab-today .reward')).includes('טיול לים'), 'reward text');
  await reload(page);
  const s = await getState(page);
  eq([s.settings.reward, s.settings.starsNeeded, s.settings.goals.length], ['טיול לים', 9, 3], 'persisted');
});
test('settings: validation (min 2 goals, bad/empty date kept, star target clamped to 1..200)', 'הגדרות + טבלת כוכבים: "2–3 יעדים"', async t => {
  const page = await t.open();
  const before = await getState(page);
  await page.click('.topbar [data-act=openSettings]');
  await page.fill('#sName', 'שם חדש');
  await page.fill('#sGoal1', '');
  await page.fill('#sGoal2', '');
  await page.click('#setOverlay [data-act=saveSettings]');
  assert(await visible(page, '#setOverlay'), 'overlay must stay open when <2 goals');
  assert((await toastText(page)).includes('לפחות 2 יעדים'), 'toast explains the 2-goal minimum');
  eq((await getState(page)).settings.childName, before.settings.childName, 'nothing saved on validation failure');
  await page.fill('#sGoal1', 'יעד 2');
  await page.fill('#sStart', '');
  await page.fill('#sNeed', '500');
  await page.click('#setOverlay [data-act=saveSettings]');
  let s = await getState(page);
  eq(s.settings.startDate, before.settings.startDate, 'empty date keeps previous start date');
  eq(s.settings.starsNeeded, 200, 'star target clamped to max 200');
  // a target below 1 is rejected with a validation message (team-lead ruling) – never silently replaced by 15
  for (const bad of ['0', '-4', '']) {
    await page.click('.topbar [data-act=openSettings]');
    await page.evaluate(() => { document.querySelector('#toast').textContent = ''; });
    await page.fill('#sName', 'לא יישמר');
    await page.fill('#sNeed', bad);
    await page.click('#setOverlay [data-act=saveSettings]');
    assert(await visible(page, '#setOverlay'), `target "${bad}": settings stay open`);
    assert((await toastText(page)).includes('לפחות 1'), `target "${bad}": validation message, got "${await toastText(page)}"`);
    s = await getState(page);
    eq([s.settings.starsNeeded, s.settings.childName], [200, 'שם חדש'], `target "${bad}": nothing saved (not 15, not 1)`);
    await page.click('#setOverlay [data-act=closeSettings]');
  }
  await setSettings(page, { sNeed: 1 });
  eq((await getState(page)).settings.starsNeeded, 1, '1 is the minimum accepted target');
});
test('settings: Escape / ✕ close without saving', 'הגדרות', async t => {
  const page = await t.open();
  await page.click('.topbar [data-act=openSettings]');
  await page.fill('#sName', 'לא נשמר');
  await page.keyboard.press('Escape');
  assert(!(await visible(page, '#setOverlay')), 'Escape closes');
  await page.click('.topbar [data-act=openSettings]');
  eq(await page.inputValue('#sName'), 'דני', 'unsaved change discarded');
  await page.click('#setOverlay [data-act=closeSettings]');
  assert(!(await visible(page, '#setOverlay')), '✕ closes');
  eq(await page.evaluate(() => document.body.style.overflow), '', 'body scroll restored');
});

/* ================================================================== *
 * 3. Week number & phase
 * ================================================================== */
test('today: "שבוע X מתוך 12" + phase name(s) for weeks 1..12 (via settings start date)', 'היום: "כותרת: שבוע X מתוך 12 ושם השלב הנוכחי"', async t => {
  const page = await t.open();
  const bad = [];
  for (let w = 1; w <= 12; w++) {
    for (const dayOff of [0, 6]) { // first and last day of each program week
      const start = addDaysKey(startForWeek(w), -dayOff);
      await setSettings(page, { sStart: start });
      const h1 = (await txt(page, '.hero h1')).replace(/\s+/g, ' ').trim();
      const chips = await page.locator('.hero .phase-chip').allInnerTexts();
      if (h1 !== `שבוע ${w} מתוך 12`) bad.push(`start ${start}: h1="${h1}" expected week ${w}`);
      if (JSON.stringify(chips) !== JSON.stringify(PHASE_NAMES[w])) bad.push(`week ${w}: phases ${JSON.stringify(chips)} expected ${JSON.stringify(PHASE_NAMES[w])}`);
      const nowIdx = await page.evaluate(() => [...document.querySelectorAll('.weeks i')].findIndex(i => i.classList.contains('now')));
      if (nowIdx !== w - 1) bad.push(`week ${w}: progress pip index ${nowIdx}`);
    }
  }
  assert(!bad.length, bad.join('\n      '));
});
test('today: before the start date and after week 12', 'היום: "שבוע X מתוך 12" (edge cases)', async t => {
  const page = await t.open({ state: makeState({ settings: { startDate: addDaysKey(TODAY, 3) } }) });
  const h1 = (await txt(page, '.hero h1')).replace(/\s+/g, ' ');
  assert(h1.includes('התוכנית מתחילה בעוד 3 ימים') && !h1.includes('שבוע'), 'before start: countdown instead of a week number, got: ' + h1);
  eq(await page.locator('.hero .phase-chip').count(), 0, 'no phase chip before start');
  const note = await txt(page, '.hero p');
  assert(note.includes('15.10.2026'), 'before start: shows the start date, got: ' + note);
  eq(await page.locator('.weeks i.now').count(), 0, 'no "current" pip before start');
  await setSettings(page, { sStart: addDaysKey(TODAY, -84) }); // day 85 = week 13
  assert((await txt(page, '.hero h1')).replace(/\s+/g, ' ').includes('שבוע 12 מתוך 12'), 'after program: capped at 12');
  assert((await txt(page, '.hero p')).includes('סיימתם 12 שבועות'), 'after program: finished message');
  eq(await page.locator('.weeks i.done').count(), 12, 'all pips done');
  await setSettings(page, { sStart: addDaysKey(TODAY, -83) }); // last day of week 12
  assert((await txt(page, '.hero p')).includes('סיימתם') === false, 'last day of week 12 is still in program');
});
test('robustness: week number across DST and month/year boundaries', 'היום: שבוע מחושב מתאריך התחלה (DST, month boundaries)', async t => {
  const cases = [
    ['2026-10-19', '2026-10-25T23:59', 1], ['2026-10-19', '2026-10-26T00:30', 2], // DST ends 25 Oct 2026 in Israel
    ['2027-03-22', '2027-03-28T23:50', 1], ['2027-03-22', '2027-03-29T00:10', 2], // DST starts 26 Mar 2027
    ['2026-01-29', '2026-02-04T23:00', 1], ['2026-01-29', '2026-02-05T00:01', 2], // month boundary
    ['2026-12-28', '2027-01-04T07:00', 2], ['2028-02-26', '2028-03-04T12:00', 2], // year & leap day
    ['2026-10-01', '2026-12-23T12:00', 12], ['2026-10-01', '2026-12-24T00:00', 12] // 12 & 13 (capped)
  ];
  const bad = [];
  for (const [start, now, w] of cases) {
    const page = await t.open({ time: tsJ(now), state: makeState({ settings: { startDate: start } }) });
    const h1 = (await txt(page, '.hero h1')).replace(/\s+/g, ' ');
    if (!h1.includes(`שבוע ${w} מתוך`)) bad.push(`start ${start}, now ${now}: "${h1}" expected week ${w}`);
    await page.context().close();
  }
  assert(!bad.length, bad.join('\n      '));
});

/* ================================================================== *
 * 4. Checklist
 * ================================================================== */
test('checklist: 5 items, toggle (click + keyboard), counter, persistence across reload', 'היום: "צ\'קליסט של סדר היום"', async t => {
  const page = await t.open();
  const items = page.locator('#tab-today .check');
  eq(await items.count(), 5, 'five routine items');
  const titles = (await page.locator('#tab-today .check .ctitle').allInnerTexts()).join('|');
  for (const k of ['נשימת בלון', '30–60 דקות תנועה', '10–15 דקות משחק עצירה', '15 דקות אחד-על-אחד', 'מה הצלחת היום']) assert(titles.includes(k), 'item text: ' + k);
  assert((await txt(page, '#tab-today .check[data-id=morning]')).includes('איפה אתה במדחום'), 'morning includes thermometer question');
  assert((await txt(page, '#tab-today .check[data-id=stop] .game')).includes('המשחק של היום'), 'stop game shows game of the day');
  // the toggle is a real <button role=checkbox class=check-hit> inside each row (design P1-4: no nested controls)
  await page.click('#tab-today .check-hit[data-id=move]');
  eq(await page.getAttribute('#tab-today .check-hit[data-id=move]', 'aria-checked'), 'true', 'checked after click');
  assert((await txt(page, '#tab-today .card:nth-of-type(2) .pill')).includes('1/5'), 'counter 1/5');
  await page.focus('#tab-today .check-hit[data-id=one]');
  await page.keyboard.press('Space');
  eq(await page.getAttribute('#tab-today .check-hit[data-id=one]', 'aria-checked'), 'true', 'Space toggles focused item');
  await page.keyboard.press('Enter');
  eq(await page.getAttribute('#tab-today .check-hit[data-id=one]', 'aria-checked'), 'false', 'Enter toggles focused item');
  await page.keyboard.press('Space');
  await page.click('#tab-today .check-hit[data-id=move]');
  eq(await page.getAttribute('#tab-today .check-hit[data-id=move]', 'aria-checked'), 'false', 'second click unchecks');
  eq(await page.locator('#tab-today .check-hit button, #tab-today [role=checkbox] [data-act]').count(), 0, 'no interactive control nested inside a checkbox');
  await reload(page);
  eq(await page.getAttribute('#tab-today .check-hit[data-id=one]', 'aria-checked'), 'true', 'persisted across reload');
  eq((await getState(page)).days[TODAY].checks, { move: false, one: true }, 'stored under today key');
  for (const id of ['morning', 'move', 'stop', 'bed']) await page.click(`#tab-today .check[data-id=${id}] .box`);
  assert((await toastText(page)).includes('כל סדר היום הושלם'), 'all-done toast');
});
test('checklist: resets on the next day (reload) and the game of the day rotates', 'היום: "מתאפס כל יום"; "משחק מומלץ של היום, מתחלף"', async t => {
  const page = await t.open();
  await page.click('#tab-today .check[data-id=move]');
  await page.click('#tab-today .check[data-id=bed]');
  const game1 = await txt(page, '#tab-today .game b');
  await page.clock.setSystemTime(tsJ(addDaysKey(TODAY, 1) + 'T07:30'));
  await reload(page);
  eq(await page.locator('#tab-today .check.done').count(), 0, 'no item checked on the new day');
  const game2 = await txt(page, '#tab-today .game b');
  assert(game1 !== game2, `game should change daily ("${game1}" vs "${game2}")`);
  const s = await getState(page);
  eq(s.days[TODAY].checks, { move: true, bed: true }, 'yesterday kept in history');
});
test('checklist: resets when the app returns to foreground on a new day', 'היום: "מתאפס כל יום"', async t => {
  const page = await t.open();
  await page.click('#tab-today .check[data-id=move]');
  await page.clock.setSystemTime(tsJ(addDaysKey(TODAY, 1) + 'T07:30'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  eq(await page.locator('#tab-today .check.done').count(), 0, 'reset after visibilitychange');
});
test('checklist: resets at midnight while the app stays open in the foreground', 'היום: "מתאפס כל יום"', async t => {
  const page = await t.open({ time: tsJ(TODAY + 'T23:58') });
  await page.click('#tab-today .check[data-id=move]');
  await page.click('#tab-today .check[data-id=one]');
  await page.clock.runFor(5 * 60e3); // 00:03 next day, no user interaction, page still visible
  const done = await page.locator('#tab-today .check.done').count();
  eq(done, 0, 'checklist on screen should show the new (empty) day after midnight');
});
test('checklist: morning breathing button runs 3 minutes and completes the item', 'היום: "בוקר: 3 דקות נשימת בלון"', async t => {
  const page = await t.open();
  await page.click('#tab-today [data-act=morningBreath]');
  assert(await visible(page, '#exOverlay'), 'exercise overlay opens');
  eq(await page.getAttribute('#tab-today .check-hit[data-id=morning]', 'aria-checked'), 'false', 'tapping the button does not toggle the item itself');
  assert((await txt(page, '#exTitle')).includes('נשימת בלון'), 'balloon breathing');
  assert((await txt(page, '#exMeta')).includes('3:00'), 'total 3:00 shown, got ' + await txt(page, '#exMeta'));
  await page.clock.runFor(179e3);
  eq(await page.locator('#exInner .done-face').count(), 0, 'not finished at 2:59');
  await page.clock.runFor(1000);
  assert(await page.locator('#exInner .done-face').count() === 1, 'finished at 3:00');
  await page.click('#exInner .sheet-head [data-act=exClose]');
  eq(await page.getAttribute('#tab-today .check-hit[data-id=morning]', 'aria-checked'), 'true', 'morning item completed');
  eq(await page.locator('#tab-today [data-act=morningBreath]').count(), 0, 'button hidden when done');
  eq((await getState(page)).days[TODAY].checks.morning, true, 'persisted');
});
test('checklist: closing the morning breathing early does NOT complete the item', 'היום: "בוקר: 3 דקות נשימת בלון"', async t => {
  const page = await t.open();
  await page.click('#tab-today [data-act=morningBreath]');
  await page.clock.runFor(30e3);
  await page.click('#exOverlay .ex-actions [data-act=exClose]');
  eq(await page.getAttribute('#tab-today .check-hit[data-id=morning]', 'aria-checked'), 'false', 'not completed');
});

/* ================================================================== *
 * 5. Praise counter
 * ================================================================== */
test('praise: daily counter with target 5, note saved, Enter key, delete', 'היום: "תפסתי אותו מתנהג יפה: מונה יומי עם יעד 5, ושדה קצר"', async t => {
  const page = await t.open();
  assert((await txt(page, '#tab-today .praise-btn')).includes('(0/5)'), 'starts at 0/5');
  await page.fill('#praiseNote', 'עזר לאחותו');
  await page.click('#tab-today .praise-btn');
  eq(await page.inputValue('#praiseNote'), '', 'input cleared after save');
  assert((await txt(page, '#tab-today .note-list')).includes('עזר לאחותו'), 'note listed');
  assert((await txt(page, '#tab-today .note-list')).includes('10:00'), 'time listed');
  await page.fill('#praiseNote', 'שיתף משחק');
  await page.press('#praiseNote', 'Enter');
  assert((await txt(page, '#tab-today .praise-btn')).includes('(2/5)'), 'Enter key records praise');
  for (let i = 0; i < 3; i++) await page.click('#tab-today .praise-btn');
  assert((await txt(page, '#tab-today .praise-btn')).includes('(5/5)'), '5/5');
  assert((await txt(page, '#tab-today')).includes('הגעתם ליעד היומי'), 'daily target message');
  eq(await page.locator('#tab-today .praise-dots i.on').count(), 5, '5 dots on');
  await page.click('#tab-today [data-act=delPraise][data-i="0"]');
  await answer(page, false);
  assert((await txt(page, '#tab-today .praise-btn')).includes('(5/5)'), 'cancelled delete keeps it');
  await page.click('#tab-today [data-act=delPraise][data-i="0"]');
  await answer(page, true);
  assert((await txt(page, '#tab-today .praise-btn')).includes('(4/5)'), 'deleted');
  assert(page.dialogs[0].includes('למחוק את הרישום'), 'confirm sheet asks: ' + page.dialogs[0]);
  assert(!(await txt(page, '#tab-today .note-list')).includes('עזר לאחותו'), 'the right entry was deleted');
  await reload(page);
  eq((await getState(page)).days[TODAY].praises.length, 4, 'persisted');
  await page.clock.setSystemTime(tsJ(addDaysKey(TODAY, 1) + 'T08:00'));
  await reload(page);
  assert((await txt(page, '#tab-today .praise-btn')).includes('(0/5)'), 'counter is daily');
});

/* ================================================================== *
 * 6. Stars & celebration
 * ================================================================== */
test('stars: add star, no way to remove one', 'היום: "לחיצה מוסיפה כוכב. לא ניתן להוריד כוכב"', async t => {
  const page = await t.open();
  await page.click('#tab-today [data-act=star][data-id=g1]');
  eq(await page.locator('#tab-today .goal').first().locator('.stars .s').count(), 1, 'one star on goal 1');
  assert((await txt(page, '#tab-today .pill.blue')).includes('1/15'), 'pill 1/15');
  const removers = await page.evaluate(() => [...document.querySelectorAll('[data-act]')].map(e => e.dataset.act).filter(a => /star/i.test(a) && a !== 'star'));
  eq(removers, [], 'no star-removal actions in the DOM');
  await page.click('#tab-today .goal .stars .s');
  await page.dblclick('#tab-today .goal .stars .s');
  eq((await getState(page)).stars.length, 1, 'tapping a star does not remove it');
  await page.click('.topbar [data-act=openSettings]');
  const ids = await page.evaluate(() => [...document.querySelectorAll('#setOverlay [data-act]')].map(e => e.dataset.act));
  assert(!ids.some(a => /star/i.test(a)), 'no star removal in settings either');
});
test('stars: celebration fires exactly once when weekly target is reached; resets next week', 'היום: "כשמגיעים ליעד הכוכבים – אנימציה ופרס שהוגדר מראש"', async t => {
  const page = await t.open({ state: makeState({ settings: { starsNeeded: 3, reward: 'סרט בקולנוע' } }) });
  await addStar(page, 'g1');
  await addStar(page, 'g2');
  assert(!(await visible(page, '#celOverlay')), 'no celebration at 2/3');
  assert((await txt(page, '#tab-today .reward')).includes('עוד כוכב אחד'), '1 more star to reward (singular wording)');
  await addStar(page, 'g1');
  assert(await visible(page, '#celOverlay'), 'celebration at 3/3');
  const cel = await txt(page, '#celInner');
  assert(cel.includes('סרט בקולנוע') && cel.includes('דני') && cel.includes('3 כוכבים'), 'celebration shows name, target and reward: ' + cel);
  assert(await page.locator('.confetti').count() > 0, 'confetti animation');
  await page.click('#celOverlay [data-act=celClose]');
  assert(!(await visible(page, '#celOverlay')), 'closes');
  assert((await txt(page, '#tab-today .reward')).includes('הפרס הורווח השבוע'), 'reward earned banner');
  await addStar(page, 'g2');
  assert(!(await visible(page, '#celOverlay')), 'no second celebration (4/3)');
  await reload(page);
  await addStar(page, 'g2');
  assert(!(await visible(page, '#celOverlay')), 'no second celebration after reload');
  eq((await getState(page)).stars.length, 5, '5 stars stored');
  // next program week
  await page.clock.setSystemTime(NOW + 7 * DAY);
  await reload(page);
  assert((await txt(page, '#tab-today .pill.blue')).includes('0/3'), 'weekly stars reset in week 2');
  eq(await page.locator('#tab-today .goal .stars .s').count(), 0, 'no stars shown in new week');
  for (let i = 0; i < 2; i++) await addStar(page, 'g1');
  assert(!(await visible(page, '#celOverlay')), 'not yet');
  await addStar(page, 'g1');
  assert(await visible(page, '#celOverlay'), 'celebrates again in the new week');
});
test('stars: celebration respects a target raised after it was already celebrated', 'היום: "כשמגיעים ליעד הכוכבים"', async t => {
  const page = await t.open({ state: makeState({ settings: { starsNeeded: 2 } }) });
  await addStar(page, 'g1');
  await addStar(page, 'g1');
  assert(await visible(page, '#celOverlay'), 'celebrated at 2');
  await page.click('#celOverlay [data-act=celClose]');
  await setSettings(page, { sNeed: 4 });
  await addStar(page, 'g1');
  assert(!(await visible(page, '#celOverlay')), 'not at 3/4');
  await addStar(page, 'g1');
  assert(await visible(page, '#celOverlay'), 'reaching the new target (4) this week should celebrate and show the reward');
  assert((await txt(page, '#celInner')).includes('4 כוכבים'), 'celebration names the new target');
  await page.click('#celOverlay [data-act=celClose]');
  eq((await getState(page)).celebrated, { 1: 4 }, 'celebrated[week] stores the target that was celebrated');
  await setSettings(page, { sNeed: 3 }); // lowering the target after a celebration does not celebrate again
  await addStar(page, 'g2');
  assert(!(await visible(page, '#celOverlay')), 'no new celebration for a lower target');
});
test('stars: editing goals in settings never moves earned stars to another goal', 'היום: "לא ניתן להוריד כוכב"; הגדרות: יעדי הכוכבים', async t => {
  const page = await t.open({ state: makeState({ settings: { goals: [{ id: 'g1', text: 'A' }, { id: 'g2', text: 'B' }, { id: 'g3', text: 'C' }] }, stars: [{ goalId: 'g1', ts: NOW - 3000 }, { goalId: 'g1', ts: NOW - 2000 }, { goalId: 'g3', ts: NOW - 1000 }] }) });
  const read = () => page.locator('#tab-today .goal').evaluateAll(gs => gs.map(g => g.querySelector('b').textContent + ':' + g.querySelectorAll('.s').length));
  eq(await read(), ['A:2', 'B:0', 'C:1'], 'initial');
  await setSettings(page, { sGoal0: '' }); // remove goal A
  eq(await read(), ['B:0', 'C:1'], 'after removing A, B and C keep their stars');
  await page.click('.topbar [data-act=openSettings]');
  await page.click('#setOverlay [data-act=saveSettings]'); // save again without any change
  eq(await read(), ['B:0', 'C:1'], 'saving settings unchanged must not move stars between goals');
});
test('praise: a typed (unsaved) note survives other actions on the Today screen', 'היום: "שדה קצר לרשום מה ראית"', async t => {
  const page = await t.open();
  await page.fill('#praiseNote', 'ויתר על התור');
  await page.click('#tab-today .check[data-id=move]');
  await page.click('#tab-today [data-act=star] >> nth=0');
  eq(await page.inputValue('#praiseNote'), 'ויתר על התור', 'typed note is wiped by re-render');
});
test('robustness: accidental double tap on "add star" adds only one (stars cannot be removed)', 'היום: "לא ניתן להוריד כוכב" + robustness', async t => {
  const page = await t.open();
  const b = page.locator('#tab-today [data-act=star][data-id=g1]');
  await b.tap();
  await b.tap(); // ~100 ms later
  eq((await getState(page)).stars.length, 1, 'irreversible action should be protected against an accidental double tap');
});
test('robustness: rapid double taps elsewhere (save incident, checklist, tool, tab)', 'robustness', async t => {
  const page = await t.open();
  await go(page, 'incident');
  await page.click('#tab-incident [data-field=actions][data-val="מכה"]');
  await page.locator('#tab-incident [data-act=saveIncident]').dblclick();
  eq((await getState(page)).incidents.length, 1, 'double tap on save creates one incident');
  await go(page, 'today');
  await page.locator('#tab-today .check[data-id=move]').dblclick();
  const s = await getState(page);
  eq(!!s.days[TODAY].checks.move, false, 'double tap toggles twice consistently');
  await go(page, 'calm');
  await page.locator('#tab-calm .card:not(#moodTools) [data-ex=box]').dblclick({ force: true });
  await page.clock.runFor(1000);
  eq(await txt(page, '#exNum'), '3', 'only one timer running after double tap on a tool');
  await page.click('#exOverlay .ex-actions [data-act=exClose]');
  await page.locator('nav.bottom [data-tab=guide]').dblclick();
  assert(await page.locator('#tab-guide.active').count() === 1, 'tab active');
});

/* ================================================================== *
 * 7. Calm tab
 * ================================================================== */
test('calm: 4 thermometer colors, selection saved with time, matching tools per color', 'רגיעה: "מדחום רגשות … 4 צבעים … הבחירה נשמרת עם שעה"; "לפי הצבע מוצעים כלים מתאימים"', async t => {
  const page = await t.open();
  await go(page, 'calm');
  const moods = await page.locator('#tab-calm .mood').evaluateAll(els => els.map(e => [e.dataset.c, e.innerText.replace(/\s+/g, ' ').trim()]));
  eq(moods.map(m => m[0]).sort(), ['green', 'orange', 'red', 'yellow'], 'four colors');
  const labels = { green: ['ירוק', 'רגוע'], yellow: ['צהוב', 'מתעצבן'], orange: ['כתום', 'כועס'], red: ['אדום', 'עומד להתפוצץ'] };
  for (const [c, text] of moods) for (const w of labels[c]) assert(text.includes(w), `${c} label should include "${w}" (got "${text}")`);
  const heights = {};
  const toolsBy = {};
  let n = 0;
  for (const c of ['green', 'yellow', 'orange', 'red']) {
    await page.clock.runFor(60e3); n++;
    await page.click(`#tab-calm .mood[data-c=${c}]`);
    eq(await page.getAttribute(`#tab-calm .mood[data-c=${c}]`, 'aria-pressed'), 'true', c + ' pressed');
    heights[c] = await page.evaluate(() => parseFloat(document.querySelector('.thermo .fill').style.height));
    toolsBy[c] = await page.locator('#moodTools [data-ex]').evaluateAll(els => els.map(e => e.dataset.ex));
    assert(toolsBy[c].length >= 2, c + ': at least two suggested tools');
  }
  assert(heights.green < heights.yellow && heights.yellow < heights.orange && heights.orange < heights.red, 'thermometer fill rises with intensity ' + JSON.stringify(heights));
  assert(toolsBy.red.includes('stop') && toolsBy.red.includes('wall'), 'red suggests the stop sentence and pushing the wall');
  assert(toolsBy.green.some(x => ['balloon', 'candle', 'box'].includes(x)), 'green suggests breathing practice');
  const s = await getState(page);
  eq(s.moods.map(m => m.c), ['green', 'yellow', 'orange', 'red'], 'all selections saved');
  eq(s.moods.map(m => m.ts), [1, 2, 3, 4].map(i => NOW + i * 60e3), 'saved with timestamp');
  const chips = await page.locator('#tab-calm .today-moods span:not(.muted)').allInnerTexts();
  eq(chips.map(x => x.trim()), ['10:01', '10:02', '10:03', '10:04'], 'today\'s selections shown with time');
});
test('calm: all 6 tools listed + allowed ways to vent anger', 'רגיעה: כלים + "דרכים מותרות להוציא כעס"', async t => {
  const page = await t.open();
  await go(page, 'calm');
  const all = await page.locator('#tab-calm .card:not(#moodTools) [data-ex]').evaluateAll(els => els.map(e => e.dataset.ex).sort());
  eq(all, ['balloon', 'box', 'candle', 'robot', 'stop', 'wall'], 'six tools');
  const vent = (await page.locator('#tab-calm .vent li').allInnerTexts()).join('|');
  for (const k of ['לדחוף קיר', 'לקמט נייר', 'להכות כרית', 'לרקוע', 'אני כועס!', 'לצייר את הכעס']) assert(vent.includes(k), 'vent item: ' + k);
});

const EX_EXPECT = {
  // durations in seconds per step, cycles. Spec-mandated values marked in comments.
  box: { cycles: 4, steps: [4, 4, 4, 4] },              // spec: "נשימת קובייה (4-4-4-4)"
  robot: { cycles: 3, steps: [5, 5] },                  // spec: "5 שניות כיווץ ו-5 שחרור, 3 סבבים"
  wall: { cycles: 1, first: 10 },                       // spec: "טיימר של 10 שניות"
  balloon: { cycles: null, circle: true },
  candle: { cycles: null, circle: true },
  stop: { cycles: null, words: ['עצור', 'נושם', 'חושב', 'בוחר'] } // spec: "עצור – נושם – חושב – בוחר"
};
async function exState(page) {
  return page.evaluate(() => {
    const q = s => document.querySelector(s);
    const on = q('.stopwords div.on');
    const c = q('#exCircle');
    return {
      key: q('#exText') ? q('#exText').textContent : on ? 'w' + on.dataset.i : null,
      num: q('#exNum') ? q('#exNum').textContent : null,
      meta: q('#exMeta') ? q('#exMeta').textContent : null,
      done: !!q('.done-face'),
      dur: c ? c.style.transitionDuration : null, scale: c ? c.style.transform : null, cls: c ? c.className : null
    };
  });
}
async function recordExercise(page, maxSec) {
  const segs = [];
  let st = await exState(page);
  const initialMeta = st.meta;
  // single-cycle exercises show only "נשארו m:ss" (design P2-17), so a missing "סבב n" means cycle 1
  const cycleOf = meta => (meta.match(/סבב (\d+)/) || [0, '1'])[1];
  let cur = { key: st.key, cycle: cycleOf(st.meta), len: 0, nums: [st.num], dur: st.dur, scale: st.scale, cls: st.cls };
  let t = 0;
  while (t < maxSec) {
    await page.clock.runFor(1000); t++;
    st = await exState(page);
    cur.len++;
    if (st.done) { segs.push(cur); return { segs, total: t, initialMeta }; }
    const cyc = cycleOf(st.meta);
    if (st.key !== cur.key || cyc !== cur.cycle) { segs.push(cur); cur = { key: st.key, cycle: cyc, len: 0, nums: [st.num], dur: st.dur, scale: st.scale, cls: st.cls }; }
    else cur.nums.push(st.num);
  }
  return { segs, total: null, initialMeta };
}
for (const ex of ['candle', 'balloon', 'box', 'robot', 'wall', 'stop']) {
  test(`exercise ${ex}: step durations, cycles, countdown, completion screen`, 'רגיעה: "כל אחת עם אנימציה של עיגול שמתרחב ומתכווץ, טיימר והנחיה כתובה"; robot 5/5×3; wall 10s; box 4-4-4-4', async t => {
    const page = await t.open();
    await go(page, 'calm');
    await page.click(`#tab-calm .card:not(#moodTools) [data-ex=${ex}]`);
    assert(await visible(page, '#exOverlay'), 'overlay opens');
    eq(await page.evaluate(() => document.body.style.overflow), 'hidden', 'background scroll locked');
    const exp = EX_EXPECT[ex];
    const rec = await recordExercise(page, 400);
    assert(rec.total != null, 'exercise must finish');
    const per = rec.segs.map(s => s.len);
    // countdown: each step shows len, len-1, ..., 1
    for (const s of rec.segs) if (s.nums[0] !== null) eq(s.nums.map(Number), Array.from({ length: s.len }, (_, i) => s.len - i), `countdown in step "${s.key}"`);
    // the initially announced remaining time equals the real duration
    const m = rec.initialMeta.match(/(\d+):(\d\d)/);
    eq(+m[1] * 60 + +m[2], rec.total, 'announced total time vs actual duration');
    const cycles = +(rec.initialMeta.match(/מתוך (\d+)/) || [0, 1])[1];
    if (cycles === 1) assert(!/סבב/.test(rec.initialMeta), 'single-cycle meta has no "סבב 1 מתוך 1": ' + rec.initialMeta);
    if (exp.cycles) eq(cycles, exp.cycles, 'cycles');
    else assert(cycles >= 2 && /סבב 1 מתוך \d+/.test(rec.initialMeta), 'multi-cycle exercise announces its cycles: ' + rec.initialMeta);
    const stepsPerCycle = rec.segs.length / cycles;
    assert(Number.isInteger(stepsPerCycle), `segments ${rec.segs.length} not divisible by cycles ${cycles}`);
    if (exp.steps) eq(per, Array(cycles).fill(exp.steps).flat(), 'step durations (s)');
    if (exp.first) eq(per[0], exp.first, 'first step duration (s)');
    if (exp.words) {
      eq(rec.segs.slice(0, 4).map(s => s.key), ['w0', 'w1', 'w2', 'w3'], 'words highlighted in order');
    }
    if (exp.circle || exp.steps) {
      // circle animation: transition duration equals step duration; inhale expands, exhale shrinks
      for (const s of rec.segs) eq(s.dur, s.len + 's', `circle transition duration for "${s.key}"`);
      const scales = rec.segs.slice(0, stepsPerCycle).map(s => parseFloat(s.scale.match(/scale\(([\d.]+)/)[1]));
      assert(new Set(scales).size > 1, 'circle should expand and contract: ' + scales);
    }
    if (ex === 'robot') assert(/tense/.test(rec.segs[0].cls) && !/tense/.test(rec.segs[1].cls), 'robot: tense then loose');
    // completion screen
    const doneTxt = await txt(page, '#exInner');
    assert(doneTxt.includes('כל הכבוד'), 'completion screen');
    await page.click('#exInner [data-goto=calm]');
    assert(!(await visible(page, '#exOverlay')), 'closes');
    assert(await page.locator('#tab-calm.active').count() === 1, 'returns to calm tab');
    eq(await page.evaluate(() => document.body.style.overflow), '', 'scroll unlocked');
  });
}
test('exercise: pause/resume freezes the timer; total = nominal + pause', 'רגיעה: טיימר', async t => {
  const page = await t.open();
  await go(page, 'calm');
  await page.click('#tab-calm .card:not(#moodTools) [data-ex=box]');
  await page.clock.runFor(2000);
  const before = await exState(page);
  eq(before.num, '2', 'two seconds elapsed');
  await page.click('#exPauseBtn');
  assert((await txt(page, '#exPauseBtn')).includes('המשך'), 'button shows resume');
  await page.clock.runFor(10000);
  const during = await exState(page);
  eq([during.num, during.meta, during.key], [before.num, before.meta, before.key], 'frozen while paused');
  await page.click('#exPauseBtn');
  assert((await txt(page, '#exPauseBtn')).includes('השהיה'), 'button shows pause again');
  let t2 = 0;
  while (!(await exState(page)).done && t2 < 120) { await page.clock.runFor(1000); t2++; }
  near(t2 + 2, 64, 1, 'remaining run time after resume');
});
test('exercise: ✕, "סיום" and Escape close the overlay and stop the timer', 'רגיעה', async t => {
  const page = await t.open();
  await go(page, 'calm');
  for (const how of ['x', 'finish', 'escape']) {
    await page.click('#tab-calm .card:not(#moodTools) [data-ex=balloon]');
    await page.clock.runFor(3000);
    if (how === 'x') await page.click('#exInner .sheet-head [data-act=exClose]');
    if (how === 'finish') await page.click('#exInner .ex-actions [data-act=exClose]');
    if (how === 'escape') await page.keyboard.press('Escape');
    assert(!(await visible(page, '#exOverlay')), how + ' closes');
    eq(await page.evaluate(() => EX), null, how + ' stops the exercise');
  }
  await page.clock.runFor(70000);
  eq(await page.locator('#exInner .done-face').count(), 0, 'no completion screen pops up later');
});

/* ================================================================== *
 * 8. Incident form
 * ================================================================== */
test('incident: chip groups match spec, single vs multi select', 'רישום אירוע: "מה קרה לפני … כלפי מי … מה עשה … כמה זמן … איך הגבנו … כלי הרגעה (כן או לא)"', async t => {
  const page = await t.open();
  await go(page, 'incident');
  const grp = f => page.locator(`#tab-incident [data-group=${f}] .chip`).evaluateAll(els => els.map(e => e.dataset.val));
  const trig = await grp('trigger');
  for (const k of ['מעבר בין פעילויות', 'הפסד', 'אח לקח לו משהו', 'עייפות / רעב', 'מסכים', 'אחר']) assert(trig.includes(k), 'trigger option ' + k);
  assert(trig.some(x => /^ל?א$|ללא|לא /.test(x)), 'a "nothing/no trigger" option (spec: "לא")');
  eq((await grp('target')).length, 4, '4 targets');
  for (const k of ['אח', 'חבר', 'הורה', 'חפץ']) assert((await grp('target')).some(x => x.includes(k)), 'target ' + k);
  eq(await grp('actions'), ['מכה', 'צעקה', 'שבירה', 'השתלטות'], 'actions');
  assert((await grp('duration')).length >= 3, 'duration options');
  assert((await grp('response')).length >= 3, 'response options');
  eq(await grp('used'), ['yes', 'no'], 'used tool yes/no');
  const pressed = f => page.locator(`#tab-incident [data-group=${f}] .chip[aria-pressed=true]`).evaluateAll(els => els.map(e => e.dataset.val));
  await page.click('#tab-incident [data-field=trigger][data-val="הפסד"]');
  await page.click('#tab-incident [data-field=trigger][data-val="מסכים"]');
  eq(await pressed('trigger'), ['מסכים'], 'single select replaces');
  await page.click('#tab-incident [data-field=trigger][data-val="מסכים"]');
  eq(await pressed('trigger'), [], 'tap again deselects');
  await page.click('#tab-incident [data-field=actions][data-val="מכה"]');
  await page.click('#tab-incident [data-field=actions][data-val="שבירה"]');
  eq(await pressed('actions'), ['מכה', 'שבירה'], 'multi select');
  await page.click('#tab-incident [data-field=actions][data-val="מכה"]');
  eq(await pressed('actions'), ['שבירה'], 'multi deselect');
  await page.click('#tab-incident [data-field=used][data-val=yes]');
  await page.click('#tab-incident [data-field=used][data-val=no]');
  eq(await pressed('used'), ['no'], 'yes/no exclusive');
  // draft survives tab switch
  await go(page, 'today'); await go(page, 'incident');
  eq(await pressed('actions'), ['שבירה'], 'draft kept across tabs');
});
test('incident: required field validation, auto date/time, save, recent list, delete', 'רישום אירוע: "טופס מהיר … תאריך ושעה אוטומטיים"', async t => {
  const page = await t.open();
  await go(page, 'incident');
  eq(await page.inputValue('#incTs'), TODAY + 'T10:00', 'date/time pre-filled with now');
  await page.click('#tab-incident [data-act=saveIncident]');
  assert((await toastText(page)).includes('מה הוא עשה'), 'validation toast for missing action');
  eq((await getState(page)).incidents.length, 0, 'nothing saved');
  await page.clock.runFor(5 * 60e3); // the form was opened 5 min ago; save time should be 'now'
  await page.click('#tab-incident [data-field=trigger][data-val="מעבר בין פעילויות"]');
  await page.click('#tab-incident [data-field=target][data-val="חבר"]');
  await page.click('#tab-incident [data-field=actions][data-val="מכה"]');
  await page.click('#tab-incident [data-field=actions][data-val="צעקה"]');
  await page.click('#tab-incident [data-field=duration][data-val="5–10 דקות"]');
  await page.click('#tab-incident [data-field=response][data-val="הפרדנו"]');
  await page.click('#tab-incident [data-field=response][data-val="הצענו כלי הרגעה"]');
  await page.click('#tab-incident [data-field=used][data-val=yes]');
  await page.fill('#incNote', 'בהפסקה');
  await page.click('#tab-incident [data-act=saveIncident]');
  const s = await getState(page);
  eq(s.incidents.length, 1, 'saved');
  const i = s.incidents[0];
  eq([i.trigger, i.target, i.actions, i.duration, i.response, i.used, i.note], ['מעבר בין פעילויות', 'חבר', ['מכה', 'צעקה'], '5–10 דקות', ['הפרדנו', 'הצענו כלי הרגעה'], 'yes', 'בהפסקה'], 'all fields stored');
  eq(i.ts, NOW + 5 * 60e3, 'automatic timestamp = the moment of saving (not when the form was opened)');
  eq(await page.locator('#tab-incident .chip[aria-pressed=true]').count(), 0, 'form reset after save');
  eq(await page.inputValue('#incNote'), '', 'note reset');
  await page.click('#tab-incident details summary');
  const item = await txt(page, '#tab-incident .inc-item');
  // design P2-23: relative day label ("היום" / "אתמול" / d.m)
  assert(item.includes('היום · 10:05') && item.includes('מכה, צעקה') && item.includes('חבר') && item.includes('השתמש בכלי') && item.includes('בהפסקה'), 'recent list row: ' + item);
  assert((await txt(page, '#tab-incident details summary .pill')) === '1', 'count pill');
  await page.click('#tab-incident [data-act=delIncident]');
  await answer(page, false);
  eq((await getState(page)).incidents.length, 1, 'cancel keeps');
  await page.click('#tab-incident [data-act=delIncident]');
  await answer(page, true);
  eq((await getState(page)).incidents.length, 0, 'deleted');
  assert(page.dialogs[0].includes('למחוק את האירוע'), 'confirm sheet asks: ' + page.dialogs[0]);
  assert((await txt(page, '#tab-incident details')).includes('עוד לא נרשמו'), 'empty state');
});
test('incident: date/time can be edited before saving', 'רישום אירוע: "תאריך ושעה אוטומטיים" (editable)', async t => {
  const page = await t.open();
  await go(page, 'incident');
  await page.fill('#incTs', '2026-10-10T08:15');
  await page.click('#tab-incident [data-field=actions][data-val="שבירה"]');
  await go(page, 'guide'); await go(page, 'incident'); // edited time must survive tab switch
  eq(await page.inputValue('#incTs'), '2026-10-10T08:15', 'edited time kept');
  await page.click('#tab-incident [data-act=saveIncident]');
  eq((await getState(page)).incidents[0].ts, tsJ('2026-10-10T08:15'), 'stored edited time');
  await page.click('#tab-incident details summary');
  assert((await txt(page, '#tab-incident .inc-item')).includes('10.10 · 08:15'), 'shown with edited time');
  eq(await page.inputValue('#incTs'), TODAY + 'T10:00', 'next form back to now');
});
test('incident: auto time is "now" when the app is resumed hours later on the incident tab', 'רישום אירוע: "תאריך ושעה אוטומטיים"', async t => {
  const page = await t.open();
  await go(page, 'incident');
  await page.clock.runFor(3 * 3600e3); // parent switches to another app; returns 3 hours later (same day)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.click('#tab-incident [data-field=actions][data-val="מכה"]');
  await page.click('#tab-incident [data-act=saveIncident]');
  const ts = (await getState(page)).incidents[0].ts;
  near(ts, NOW + 3 * 3600e3, 2 * 60e3, `auto timestamp should be ~13:00, got ${new Date(ts).toLocaleTimeString('he-IL', { timeZone: TZ })}`);
});
test('incident: future date/time is rejected', 'רישום אירוע (validation)', async t => {
  const page = await t.open();
  await go(page, 'incident');
  await page.fill('#incTs', '2027-05-01T12:00');
  await page.click('#tab-incident [data-field=actions][data-val="מכה"]');
  await page.click('#tab-incident [data-act=saveIncident]');
  const s = await getState(page);
  assert(!s.incidents.some(i => i.ts > NOW + 60e3), 'an incident in the future should not be accepted (got ' + s.incidents.map(i => new Date(i.ts).toISOString()) + ')');
});
test('incident: "מה עושים עכשיו" card has all protocol content', 'רישום אירוע: כרטיס "מה עושים עכשיו"', async t => {
  const page = await t.open();
  await go(page, 'incident');
  const card = await txt(page, '#tab-incident .steps-card');
  assert(card.includes('מה עושים עכשיו'), 'title');
  for (const k of ['ברגע ההתפרצות', 'לעצור פיזית ובשקט', 'אני לא אתן לך להכות', 'להגן על האח הקטן', 'מעט מילים', 'להציע כלי', 'לחכות שיירגע',
    'אחרי שנרגע', 'בפרטיות', 'לא מול האחים', 'לתת שם לרגש', 'מותר לכעוס, אסור להכות', 'מה במקום', 'תיקון מול הנפגע',
    'תוצאה הגיונית', 'קצרה וצמודה למעשה', 'מחר מתחילים דף חדש']) assert(card.includes(k), 'protocol text missing: ' + k);
});

/* ================================================================== *
 * 9. Progress
 * ================================================================== */
function progressFixture() {
  const start = startForWeek(4);
  const I = [];
  // week 1: 10 incidents, 6 hits, used: 2 yes / 8 no
  for (let i = 0; i < 10; i++) I.push(inc(tsIn(start, 1, i % 7, i < 5 ? '17:30' : '21:30'), { actions: i < 6 ? ['מכה'] : ['צעקה'], used: i < 2 ? 'yes' : 'no', trigger: i < 6 ? 'הפסד' : 'מסכים', target: i < 7 ? 'אח / אחות' : 'הורה' }));
  // week 2: 7 incidents, 3 hits, used 3 yes / 2 no / 2 unknown
  for (let i = 0; i < 7; i++) I.push(inc(tsIn(start, 2, i, '19:00'), { actions: i < 3 ? ['מכה', 'צעקה'] : ['השתלטות'], used: i < 3 ? 'yes' : i < 5 ? 'no' : null, trigger: 'מעבר בין פעילויות', target: 'חבר' }));
  // week 3: 4 incidents, 1 hit, all used
  for (let i = 0; i < 4; i++) I.push(inc(tsIn(start, 3, i * 2, '13:00'), { actions: i === 0 ? ['מכה'] : ['צעקה'], used: 'yes', trigger: 'הפסד' }));
  // week 4 (current, today): 2 incidents, 0 hits
  I.push(inc(NOW - 3600e3, { actions: ['צעקה'], used: 'no' }), inc(NOW - 1800e3, { actions: ['שבירה'], used: 'yes', target: 'חפץ' }));
  const stars = [...Array(3)].map((_, i) => ({ goalId: 'g1', ts: tsIn(start, 1, i) })).concat([...Array(5)].map((_, i) => ({ goalId: 'g2', ts: tsIn(start, 2, i) })), [{ goalId: 'g1', ts: NOW - 5000 }]);
  const days = {};
  days[addDaysKey(start, 1)] = { checks: {}, praises: [{ ts: tsIn(start, 1, 1), note: '' }, { ts: tsIn(start, 1, 1), note: '' }] };
  days[addDaysKey(start, 8)] = { checks: {}, praises: [1, 2, 3, 4].map(() => ({ ts: tsIn(start, 2, 1), note: '' })) };
  days[TODAY] = { checks: {}, praises: [{ ts: NOW - 100, note: '' }] };
  return makeState({ settings: { startDate: start }, incidents: I, stars, days });
}
test('progress: weekly table (incidents, hits, tool %, stars, praise)', 'התקדמות: "אחוז האירועים שבהם השתמש בכלי"; "סיכום כוכבים ו\'תפסתי אותו\' לפי שבוע"', async t => {
  const page = await t.open({ state: progressFixture() });
  await go(page, 'progress');
  const rows = await page.locator('#tab-progress table.wk tbody tr').evaluateAll(trs => trs.map(tr => [...tr.cells].map(c => c.textContent.trim())));
  eq(rows, [['1', '10', '6', '20%', '3', '2'], ['2', '7', '3', '60%', '5', '4'], ['3', '4', '1', '100%', '0', '0'], ['4', '2', '0', '50%', '1', '1']], 'weekly summary rows');
  eq(await page.locator('#tab-progress table.wk tr.cur td').first().innerText(), '4', 'current week highlighted');
  // ruling 6: the current (partial) week only shows its count; the change compares the last completed week (3) with week 1
  const kpi = (await page.locator('#tab-progress .kpi').allInnerTexts()).map(k => k.replace(/\s+/g, ' '));
  eq(kpi.length, 4, 'four KPIs once a completed week can be compared');
  assert(kpi[0].includes('2') && kpi[0].includes('השבוע עד עכשיו'), 'KPI incidents this week so far: ' + kpi[0]);
  assert(kpi[1].includes('↓') && kpi[1].includes('60%') && kpi[1].includes('שבוע 3') && kpi[1].includes('שבוע 1'), 'KPI change week 3 vs week 1 (4 vs 10 = −60%): ' + kpi[1]);
  assert(kpi[2].includes('50%'), 'KPI tool use: ' + kpi[2]);
  assert(kpi[3].includes('1'), 'KPI praise: ' + kpi[3]);
});
test('progress: bar chart values, baseline (week 1) and −70% target lines, "all/hits" toggle', 'התקדמות: "גרף עמודות … קו בסיס של שבוע 1 וקו יעד של מינוס 70%"', async t => {
  const page = await t.open({ state: progressFixture() });
  await go(page, 'progress');
  const read = () => page.evaluate(() => {
    const svg = document.querySelectorAll('#tab-progress svg.chart')[0];
    const bars = [...svg.querySelectorAll('path')].map(p => { const m = p.getAttribute('d').match(/^M([\d.]+) ([\d.]+)V([\d.]+)Q[\d.]+ ([\d.]+)/); return { x: +m[1], bottom: +m[2], top: +m[4] }; });
    const refs = [...svg.querySelectorAll('line[pointer-events=none]')].map(l => ({ y: +l.getAttribute('y1'), color: l.getAttribute('stroke'), dash: l.hasAttribute('stroke-dasharray') }));
    const legend = svg.parentElement.querySelector('.legend').textContent;
    return { bars, refs, legend };
  });
  let r = await read();
  eq(r.bars.length, 4, 'one bar per elapsed week (weeks 5–12 empty)');
  const H = r.bars[0].bottom; // baseline pixel of value 0
  const unit = (H - r.bars[0].top) / 10; // px per incident (week 1 = 10)
  [10, 7, 4, 2].forEach((v, i) => near(H - r.bars[i].top, v * unit, 0.6, `bar height week ${i + 1}`));
  const base = r.refs.find(x => x.dash), tgt = r.refs.find(x => !x.dash);
  assert(base && tgt, 'baseline and target lines exist');
  near(base.y, H - 10 * unit, 0.6, 'baseline at week-1 value (10)');
  near(tgt.y, H - 3 * unit, 0.6, 'target line at 30% of baseline (3)');
  assert(r.legend.includes('בסיס (שבוע 1): 10') && r.legend.includes('יעד: עד 3 בשבוע (ירידה של 70%)'), 'legend: ' + r.legend);
  await page.click('#tab-progress [data-act=chartMode][data-mode=hits]');
  eq(await page.getAttribute('#tab-progress [data-mode=hits]', 'aria-pressed'), 'true', 'hits pressed');
  r = await read();
  // target line at 30% of 6 = 1.8; as a whole number of hits per week that means "up to 1"
  assert(r.legend.includes('בסיס (שבוע 1): 6') && r.legend.includes('עד 1 בשבוע'), 'hits legend: ' + r.legend);
  near(r.refs.find(x => !x.dash).y, r.bars[0].bottom - 1.8 * (r.bars[0].bottom - r.bars[0].top) / 6, 0.6, 'hits target line at 1.8');
  eq(r.bars.length, 3, 'hits mode: weeks with hits (6,3,1) have bars, week 4 has 0');
  near((r.bars[0].bottom - r.bars[1].top) / (r.bars[0].bottom - r.bars[0].top), 0.5, 0.02, 'hits week 2 = half of week 1');
  await reload(page);
  await go(page, 'progress');
  eq(await page.getAttribute('#tab-progress [data-mode=hits]', 'aria-pressed'), 'true', 'chart mode persisted');
  // tapping a bar shows details
  await page.click('#tab-progress [data-act=chartMode][data-mode=all]');
  await page.locator('#tab-progress svg.chart').first().locator('rect[data-w="2"]').click({ force: true });
  assert((await txt(page, '#tab-progress .chart-info')).includes('שבוע 2: 7 אירועים, מתוכם 3 עם מכות'), 'bar tap info');
});
test('progress: tool-usage chart per week', 'התקדמות: "אחוז האירועים שבהם השתמש בכלי הרגעה, לפי שבוע"', async t => {
  const page = await t.open({ state: progressFixture() });
  await go(page, 'progress');
  const hs = await page.evaluate(() => {
    const svg = document.querySelectorAll('#tab-progress svg.chart')[1];
    return [...svg.querySelectorAll('path')].map(p => { const m = p.getAttribute('d').match(/^M[\d.]+ ([\d.]+)V[\d.]+Q[\d.]+ ([\d.]+)/); return +m[1] - +m[2]; });
  });
  eq(hs.length, 4, '4 bars');
  [20, 60, 100, 50].forEach((p, i) => near(hs[i] / hs[2], p / 100, 0.02, `tool % week ${i + 1}`));
});
test('progress: trigger / hour / target analysis', 'התקדמות: "ניתוח טריגרים: הטריגרים הנפוצים, השעות המועדות ומול מי"', async t => {
  const page = await t.open({ state: progressFixture() });
  await go(page, 'progress');
  const lists = await page.locator('#tab-progress .hbars').evaluateAll(uls => uls.map(ul => [...ul.querySelectorAll('.lab')].map(l => [l.children[0].textContent, +l.children[1].textContent])));
  eq(lists.length, 3, 'three analyses');
  eq(lists[0][0], ['הפסד', 12], 'top trigger');
  eq(lists[0][1], ['מעבר בין פעילויות', 7], 'second trigger');
  // design P2-28: hour buckets are listed in chronological order (not by count)
  const order = ['בוקר (6–12)', 'צהריים (12–15)', 'אחר הצהריים (15–18)', 'ערב (18–21)', 'לילה (21–6)'];
  const hours = lists[1].map(([k]) => k);
  eq(hours, order.filter(k => hours.includes(k)), 'hour buckets in chronological order');
  eq(lists[1].find(([k]) => k === 'ערב (18–21)'), ['ערב (18–21)', 7], 'evening bucket = 7 (the most)');
  assert(lists[1].some(([k, v]) => k.startsWith('אחר הצהריים') && v === 5), 'afternoon bucket = 5');
  eq(lists[2][0], ['אח / אחות', 12], 'top target');
});
test('progress: encouragement message is always present', 'התקדמות: "הודעה מעודדת: ירידה הדרגתית עם עליות קטנות היא מהלך תקין"', async t => {
  for (const st of [makeState(), progressFixture()]) {
    const page = await t.open({ state: st });
    await go(page, 'progress');
    const e = await txt(page, '#tab-progress .encourage');
    assert(e.includes('ירידה הדרגתית') && e.includes('עליות קטנות') && e.includes('תקין'), 'encouragement: ' + e);
  }
});
test('progress: empty state with no incidents', 'התקדמות (empty state)', async t => {
  const page = await t.open();
  await go(page, 'progress');
  assert((await txt(page, '#tab-progress')).includes('עוד אין אירועים רשומים'), 'empty-state text');
  eq(await page.locator('#tab-progress .pro').count(), 0, 'no pro card');
});
test('progress: KPI does not claim the −70% target on the first day of a new week', 'התקדמות: השוואה לשבוע 1 (partial week)', async t => {
  const start = startForWeek(2);
  const I = [...Array(10)].map((_, i) => inc(tsIn(start, 1, i % 7)));
  const page = await t.open({ state: makeState({ settings: { startDate: start }, incidents: I }) }); // Monday 10:00 of week 2, no incident yet
  await go(page, 'progress');
  const enc = await txt(page, '#tab-progress .encourage');
  const kpi = await txt(page, '#tab-progress .kpi');
  assert(!enc.includes('הגעתם ליעד') && !kpi.includes('100%'), `2 hours into week 2 the app reports: "${kpi.replace(/\s+/g, ' ')}" / "${enc.slice(0, 60)}…"`);
});
test('progress: chart axis labels match gridline positions', 'התקדמות: גרף (scaling)', async t => {
  const bad = [];
  for (const n of [3, 5, 7, 13, 50]) {
    const start = startForWeek(2);
    const page = await t.open({ state: makeState({ settings: { startDate: start }, incidents: [...Array(n)].map((_, i) => inc(tsIn(start, 1, i % 7))) }) });
    await go(page, 'progress');
    const r = await page.evaluate(() => {
      const svg = document.querySelector('#tab-progress svg.chart');
      const grid = [...svg.querySelectorAll('line:not([pointer-events])')].map(l => +l.getAttribute('y1'));
      const labels = [...svg.querySelectorAll('text[text-anchor=end]')].map(tx => +tx.textContent);
      return { grid, labels };
    });
    const [y0, , yMax] = r.grid, [l0, lMid, lMax] = r.labels;
    const yMid = r.grid[1];
    const expectedMidY = y0 + (yMax - y0) * (lMid - l0) / (lMax - l0);
    if (Math.abs(expectedMidY - yMid) > 0.5) bad.push(`max ${n}: mid gridline labelled "${lMid}" but drawn at value ${(lMax * (y0 - yMid) / (y0 - yMax)).toFixed(1)}`);
    await page.context().close();
  }
  assert(!bad.length, bad.join('\n      '));
});

/* professional help card */
const proCases = [
  ['after week 8 with no decline → card', 10, [10, 9, 10, 9, 10, 10, 9, 10, 10], true],
  ['after week 8 with a clear decline → no card', 10, [10, 9, 8, 7, 6, 5, 4, 3, 2], false],
  ['exactly week 8, no decline → no card (spec: "after week 8")', 8, [10, 10, 10, 10, 10, 10, 10], false],
  ['week 12+ (program over), no decline → card', 14, [8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8], true],
  ['week 10, baseline week empty but incidents every week since → card', 10, [0, 5, 5, 5, 5, 5, 5, 5, 5], true]
];
for (const [name, week, perWeek, expectCard] of proCases) {
  test(`progress: pro-help card — ${name}`, 'התקדמות: "אם אחרי שבוע 8 אין ירידה, או שיש אירועים כמעט כל יום, הצג כרטיס \'כדאי לפנות לאיש מקצוע\'"', async t => {
    const start = startForWeek(week);
    const I = [];
    // spread incidents on days 0,2,4 (never "almost every day"), short duration
    perWeek.forEach((n, wi) => { for (let i = 0; i < n; i++) I.push(inc(tsIn(start, wi + 1, [0, 2, 4][i % 3], '16:00'))); });
    const page = await t.open({ state: makeState({ settings: { startDate: start }, incidents: I }) });
    await go(page, 'progress');
    const has = await page.locator('#tab-progress .pro').count() === 1;
    eq(has, expectCard, 'pro card shown');
    if (has) { const p = await txt(page, '#tab-progress .pro'); assert(p.includes('כדאי לפנות לאיש מקצוע') && p.includes('שפ״ח') && p.includes('קופת החולים'), 'pro card content'); }
  });
}
for (const [days, expectCard] of [[7, true], [6, true], [3, false]]) {
  test(`progress: pro-help card — incidents on ${days} of the last 7 days (week 3) → ${expectCard ? 'card' : 'no card'}`, 'התקדמות: "…או שיש אירועים כמעט כל יום…"', async t => {
    const start = startForWeek(3);
    const I = [];
    for (let d = 0; d < days; d++) I.push(inc(NOW - d * DAY - 3600e3));
    const page = await t.open({ state: makeState({ settings: { startDate: start }, incidents: I }) });
    await go(page, 'progress');
    eq(await page.locator('#tab-progress .pro').count(), expectCard ? 1 : 0, 'pro card');
  });
}
test('robustness: 500 incidents still render progress quickly', 'התקדמות (performance)', async t => {
  const start = startForWeek(12);
  const I = [];
  // weeks 1–11 plus earlier today (week 12, day 0, before 10:00) – nothing in the future, so all 500 must count
  for (let i = 0; i < 500; i++) I.push(inc(i % 12 === 11 ? NOW - (i + 1) * 60e3 : tsIn(start, 1 + (i % 12), i % 7, pad2(6 + i % 16) + ':' + pad2(i % 60)), { actions: i % 3 ? ['מכה'] : ['צעקה'], used: i % 2 ? 'yes' : 'no' }));
  const page = await t.open({ state: makeState({ settings: { startDate: start }, incidents: I }) });
  const t0 = Date.now();
  await go(page, 'progress');
  await page.waitForSelector('#tab-progress table.wk');
  const ms = Date.now() - t0;
  assert(ms < 1500, `progress render took ${ms} ms`);
  const sum = await page.locator('#tab-progress table.wk tbody tr td:nth-child(2)').evaluateAll(tds => tds.reduce((a, td) => a + +td.textContent, 0));
  // the fixture also spreads incidents over the rest of the current week (i.e. in the future); future-dated
  // incidents can no longer be logged and are not counted in the weekly stats (QA #6)
  assert(I.every(x => x.ts <= NOW), 'fixture has no future incidents');
  eq(sum, 500, 'all 500 incidents counted');
  const t1 = Date.now();
  await go(page, 'incident');
  assert(Date.now() - t1 < 1000, 'incident tab fast with 500 incidents');
  eq(await page.locator('#tab-incident .inc-item').count(), 15, 'recent list capped at 15');
});
function pad2(n) { return String(n).padStart(2, '0'); }

/* ================================================================== *
 * 10. Guide
 * ================================================================== */
test('guide: current phase(s) open + highlighted for every week 1..12', 'מדריך: "תוכן לפי שלבים, כשהשלב הנוכחי פתוח ומודגש"', async t => {
  const page = await t.open();
  const bad = [];
  for (let w = 1; w <= 12; w++) {
    await setSettings(page, { sStart: startForWeek(w) });
    await go(page, 'guide');
    const r = await page.evaluate(() => [...document.querySelectorAll('#tab-guide .phase-card')].slice(0, 5).map(c => ({
      cur: c.classList.contains('current'), open: c.querySelector('details').open, badge: !!c.querySelector('.now-badge'),
      name: (() => { const sp = c.querySelector('summary > span').cloneNode(true); sp.querySelectorAll('.wk,.now-badge').forEach(x => x.remove()); return sp.textContent.trim(); })()
    })));
    const curNames = r.filter(x => x.cur).map(x => x.name);
    if (JSON.stringify(curNames) !== JSON.stringify(PHASE_NAMES[w])) bad.push(`week ${w}: highlighted ${JSON.stringify(curNames)}`);
    r.forEach(x => { if (x.cur !== x.open || x.cur !== x.badge) bad.push(`week ${w}: "${x.name}" current=${x.cur} open=${x.open} badge=${x.badge}`); });
    await go(page, 'today');
  }
  assert(!bad.length, bad.join('\n      '));
});
test('guide: all spec sections and key content present', 'מדריך: שלבים, "הבכור מתוך 7", "5 כללי יסוד", "מתי לפנות לאיש מקצוע"', async t => {
  const page = await t.open();
  await go(page, 'guide');
  await page.evaluate(() => document.querySelectorAll('#tab-guide details').forEach(d => { d.open = true; }));
  const g = await txt(page, '#tab-guide');
  const must = {
    'phase labels': ['שבוע 1', 'שבועות 2–4', 'שבועות 4–7', 'שבועות 6–9', 'שבועות 8–12'],
    'week 1': ['רק מתעדים', 'שינה', 'ארוחות', 'מסכים', 'תנועה'],
    'weeks 2–4': ['פריקת אנרגיה', 'נשימה', 'מדחום', 'פינת רגיעה', 'לא פינת עונש'],
    'weeks 4–7': ['צבע-מילה', 'תופסת קפואה', 'ג׳נגה על זמן', 'ראש-כתפיים הפוך', 'שחמט', 'דמקה', 'דחיית סיפוק', 'לגו', 'פאזל 500', 'משחק תפקידים'],
    'weeks 6–9': ['ניהול כעס', 'ברגע ההתפרצות', 'אחרי שנרגע'],
    'weeks 8–12': ['בחירה בין שתיים', 'תפקיד אחריות', 'אחד-על-אחד', 'תור למנהיג', 'משא ומתן', 'משחקי צוות', 'שאלות אמפתיה', 'חבר אחד'],
    'firstborn of 7': ['הבכור מתוך 7', 'זמן אישי קבוע', 'בכור ולא שמרטף', 'זכויות של גדול', 'מקום נעול', 'לא להשוות', 'הפרדה', 'תפקיד מנהיגות'],
    '5 rules': ['5 כללי יסוד', 'קודם אתם רגועים', 'ביטחון לפני חינוך', '5 שבחים ביום', '3 חוקי בית', 'להאריך את הנשימה'],
    'seek help': ['מתי לפנות לאיש מקצוע', '6–8 שבועות', 'בעלי חיים', '20–30 דקות', 'כמעט כל יום', 'במסגרת החינוכית', 'קשב', 'שפ״ח', 'קופת החולים']
  };
  const missing = [];
  for (const [sec, words] of Object.entries(must)) for (const w of words) if (!g.includes(w)) missing.push(`${sec}: "${w}"`);
  assert(!missing.length, 'missing:\n      ' + missing.join('\n      '));
});

/* ================================================================== *
 * 11. Data: export / import / reset / storage failures
 * ================================================================== */
test('data: export downloads valid JSON identical to stored state', 'עיצוב: "כפתור ייצוא וייבוא JSON בהגדרות"', async t => {
  const page = await t.open({ state: richState(3) });
  await page.click('.topbar [data-act=openSettings]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#setOverlay [data-act=export]')]);
  eq(dl.suggestedFilename(), `ragua-vehazak-${TODAY}.json`, 'file name');
  const text = fs.readFileSync(await dl.path(), 'utf8');
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new AssertionError('export is not valid JSON'); }
  eq(data, await getState(page), 'export equals stored state');
  assert(data.incidents.length > 0 && data.settings.childName === 'דני', 'contains data');
});
test('data: import of a valid backup replaces all data (round trip)', 'עיצוב: "ייצוא וייבוא JSON"', async t => {
  const page = await t.open();
  const backup = richState(6); backup.settings.childName = 'רותי'; backup.ui.tab = 'progress';
  await page.click('.topbar [data-act=openSettings]');
  await page.setInputFiles('#importFile', fileFrom('b.json', JSON.stringify(backup)));
  await answer(page, false);
  eq(page.dialogs.length, 1, 'confirmation dialog shown');
  eq((await getState(page)).settings.childName, 'דני', 'cancel in confirm keeps current data');
  await page.setInputFiles('#importFile', fileFrom('b.json', JSON.stringify(backup)));
  await answer(page, true);
  await page.waitForFunction(() => document.querySelector('#setOverlay').hidden);
  assert(page.dialogs.some(d => d.includes('הייבוא יחליף')), 'confirmation asked');
  assert((await toastText(page)).includes('יובאו בהצלחה'), 'success toast');
  const s = await getState(page);
  eq([s.settings.childName, s.incidents.length, s.settings.startDate], ['רותי', backup.incidents.length, backup.settings.startDate], 'data replaced');
  await go(page, 'today');
  assert((await txt(page, '.hero .eyebrow')).includes('רותי'), 'UI shows imported data');
  assert((await txt(page, '.hero h1')).replace(/\s+/g, ' ').includes('שבוע 6'), 'imported start date applied');
});
test('data: malformed import files are rejected and the app keeps working', 'עיצוב: ייבוא JSON (robustness)', async t => {
  const page = await t.open({ state: richState(3) });
  const before = await getState(page);
  const files = ['not json at all', '', '[]', 'null', '{"foo":1}', '{"settings":null}', '"string"', '{"settings":'];
  for (const f of files) {
    await page.click('.topbar [data-act=openSettings]');
    await page.evaluate(() => { document.querySelector('#toast').textContent = ''; });
    await page.setInputFiles('#importFile', fileFrom('bad.json', f));
    await page.waitForFunction(() => document.querySelector('#toast').textContent !== '');
    assert((await toastText(page)).includes('לא נראה כמו קובץ גיבוי'), `"${f}" → toast, got ${await toastText(page)}`);
    assert(await page.locator('#dlg').isHidden(), `"${f}": no confirmation for an invalid file`);
    eq(await getState(page), before, `"${f}" must not change data`);
    await page.click('#setOverlay [data-act=closeSettings]');
  }
  for (const tab of ['today', 'calm', 'incident', 'progress', 'guide']) await go(page, tab);
  eq(page.dialogs.length, 0, 'no confirm dialog for invalid files');
  eq(await page.evaluate(k => localStorage.getItem(k + '-prev'), KEY), null, 'rejected files never touch the backup slot');
});
const hostile = {
  'non-string child name': { settings: { childName: 12345 } },
  'null goal entry': { settings: { goals: [null, { id: 'g2', text: 'x' }] } },
  'rules not strings': { settings: { rules: [1, null, {}] } },
  'incident with invalid ts': { settings: {}, incidents: [{ id: 'a', ts: 'yesterday', actions: ['מכה'] }] },
  'incident null / actions string': { settings: {}, incidents: [null, { id: 'b', ts: NOW, actions: 'מכה' }] },
  'day with null checks/praises': { settings: {}, days: { [TODAY]: { checks: null, praises: null } } },
  'ui.tab = "__proto__"': { settings: {}, ui: { tab: '__proto__' } }
};
test('data: structurally hostile import is rejected or sanitized; app never breaks (also after reload)', 'עיצוב: "שמירת כל הנתונים ב-localStorage (עטוף ב-try/catch)" + ייבוא JSON', async t => {
  const fails = [];
  for (const [name, data] of Object.entries(hostile)) {
    const page = await t.open({ state: richState(3) });
    await page.click('.topbar [data-act=openSettings]');
    await page.setInputFiles('#importFile', fileFrom('h.json', JSON.stringify(data)));
    await answer(page, true);
    await page.waitForFunction(() => document.querySelector('#toast').textContent !== '');
    for (const tab of ['today', 'calm', 'incident', 'progress', 'guide']) { await page.evaluate(() => document.querySelector('#setOverlay').hidden = true); await go(page, tab).catch(() => {}); }
    await reload(page);
    const rendered = await page.evaluate(() => { const a = document.querySelector('main .tab.active'); return !!a && a.innerHTML.length > 100; });
    if (page.errors.length || !rendered) fails.push(`${name}: ${rendered ? '' : 'app blank after reload; '}${page.errors.slice(0, 2).join(' | ')}`);
    page.errors.length = 0; // reported here, not by the harness
    await page.context().close();
  }
  assert(!fails.length, 'hostile files broke the app:\n      ' + fails.join('\n      '));
});
test('security: hostile import (ids / mood color) must not execute script', 'XSS via backup file', async t => {
  const page = await t.open();
  const payload = '"><img src=x onerror="window.__xss=(window.__xss||0)+1">';
  const data = makeState({
    settings: { goals: [{ id: payload, text: 'a' }, { id: 'g2', text: 'b' }] },
    incidents: [inc(NOW - 1000, { id: payload })],
    moods: [{ ts: NOW - 1000, c: payload }]
  });
  await page.click('.topbar [data-act=openSettings]');
  await page.setInputFiles('#importFile', fileFrom('x.json', JSON.stringify(data)));
  await answer(page, true);
  await page.waitForFunction(() => document.querySelector('#toast').textContent !== '');
  for (const tab of ['today', 'calm', 'incident']) await go(page, tab);
  await page.evaluate(() => { document.querySelector('#tab-incident details').open = true; });
  await page.waitForTimeout(200);
  const x = await page.evaluate(() => ({ xss: window.__xss || 0, imgs: document.querySelectorAll('img[src=x]').length }));
  eq(x, { xss: 0, imgs: 0 }, 'injected markup executed / inserted');
});
test('data: reset clears everything after double confirmation; cancel keeps data', 'הגדרות: "איפוס"', async t => {
  const page = await t.open({ state: richState(3) });
  await page.click('.topbar [data-act=openSettings]');
  await page.click('#setOverlay [data-act=reset]');
  await answer(page, false);
  assert((await getState(page)).incidents.length > 0, 'cancel keeps data');
  await page.click('#setOverlay [data-act=reset]');
  await answer(page, true);
  assert((await getState(page)).incidents.length > 0, 'still kept after the first confirmation');
  await answer(page, true);
  eq(page.dialogs.length, 3, 'two confirmations for reset (1 cancelled + 2)');
  const s = await getState(page);
  eq([s.incidents.length, s.stars.length, Object.keys(s.days).length, s.moods.length, s.settings.childName, s.settings.onboarded], [0, 0, 0, 0, '', false], 'all data cleared');
  assert(await visible(page, '#setOverlay') && (await txt(page, '#setTitle')).includes('ברוכים הבאים'), 'back to onboarding');
});
test('data: localStorage methods throwing → app renders and works in memory', 'עיצוב: "localStorage (עטוף ב-try/catch)"', async t => {
  const page = await t.open({ state: null, init: () => { const thr = () => { throw new DOMException('denied', 'SecurityError'); }; Storage.prototype.setItem = thr; Storage.prototype.getItem = thr; Storage.prototype.removeItem = thr; } });
  assert(await visible(page, '#setOverlay'), 'onboarding shown');
  await page.fill('#sName', 'נועם');
  await page.click('#setOverlay [data-act=saveSettings]');
  assert(!(await visible(page, '#setOverlay')), 'settings work in memory');
  assert((await txt(page, '.hero .eyebrow')).includes('נועם'), 'name shown');
  await page.click('#tab-today .praise-btn');
  await page.click('#tab-today .praise-btn');
  assert((await txt(page, '#tab-today .praise-btn')).includes('(2/5)'), 'praise works');
  await page.click('#tab-today .check-hit[data-id=move]');
  eq(await page.getAttribute('#tab-today .check-hit[data-id=move]', 'aria-checked'), 'true', 'checklist works');
  for (const tab of ['calm', 'incident', 'progress', 'guide', 'today']) await go(page, tab);
  const warned = await page.evaluate(() => typeof storageWarned !== 'undefined' && storageWarned);
  assert(warned, 'user is warned that data cannot be saved');
});
test('data: window.localStorage getter throwing (storage blocked) → app still works', 'עיצוב: "localStorage (עטוף ב-try/catch)"', async t => {
  const page = await t.open({ state: null, init: () => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } }); } });
  assert(await page.evaluate(() => { try { return !window.localStorage; } catch (e) { return true; } }), 'precondition: localStorage access throws');
  assert(await visible(page, '#setOverlay'), 'onboarding shown');
  await page.click('#setOverlay [data-act=saveSettings]');
  await go(page, 'incident');
  await page.click('#tab-incident [data-field=actions][data-val="מכה"]');
  await page.click('#tab-incident [data-act=saveIncident]');
  await page.click('#tab-incident details summary');
  eq(await page.locator('#tab-incident .inc-item').count(), 1, 'incident kept in memory');
});
test('data: corrupt JSON in storage → app recovers to a usable state', 'עיצוב: localStorage (robustness)', async t => {
  for (const bad of ['{"v":1,"settings":', 'undefined', '<html>', '{"settings":{"startDate":"not-a-date","starsNeeded":"abc","goals":[]}}']) {
    const page = await t.open({ state: bad });
    const ok = await page.evaluate(() => !!document.querySelector('#tab-today .hero'));
    assert(ok, `renders with storage "${bad}"`);
    const s = await page.evaluate(() => S.settings);
    assert(/^\d{4}-\d\d-\d\d$/.test(s.startDate) && s.starsNeeded >= 1 && s.goals.length >= 2, 'settings normalized: ' + JSON.stringify(s));
    if (await visible(page, '#setOverlay')) await page.click('#setOverlay [data-act=saveSettings]');
    await go(page, 'progress');
    await page.context().close();
  }
});
test('data: works offline (all remote requests fail)', 'דרישות טכניות: "עובד גם אופליין"', async t => {
  const page = await t.open({ offline: true, state: richState(4) });
  for (const tab of ['today', 'calm', 'incident', 'progress', 'guide']) { await go(page, tab); assert((await page.locator(`#tab-${tab}`).innerHTML()).length > 200, tab + ' renders'); }
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  assert(/Arial|sans-serif/.test(font), 'has local font fallbacks: ' + font);
  eq(t.remote, [], 'no remote requests at all (the font is embedded)');
});

/* ================================================================== *
 * 12. Security (XSS through the UI)
 * ================================================================== */
test('security: HTML in name / rules / goals / reward / notes renders as text', 'XSS', async t => {
  const page = await t.open({ state: makeState({ settings: { starsNeeded: 1 } }) });
  const p = n => `<img src=x onerror="window.__xss=${n}">`;
  await page.click('.topbar [data-act=openSettings]');
  await page.fill('#sName', p(1).slice(0, 30));
  await page.fill('#sRule0', p(2));
  await page.fill('#sGoal0', p(3));
  await page.fill('#sReward', p(4));
  await page.click('#setOverlay [data-act=saveSettings]');
  await page.fill('#praiseNote', p(5));
  await page.click('#tab-today .praise-btn');
  await page.click('#tab-today [data-act=star] >> nth=0'); // celebration shows name + reward
  await page.click('#celOverlay [data-act=celClose]');
  await go(page, 'incident');
  await page.click('#tab-incident [data-field=actions][data-val="מכה"]');
  await page.fill('#incNote', p(6));
  await page.click('#tab-incident [data-act=saveIncident]');
  await page.click('#tab-incident details summary');
  await go(page, 'guide');
  await page.evaluate(() => document.querySelectorAll('#tab-guide details').forEach(d => { d.open = true; }));
  await page.click('.topbar [data-act=openSettings]');
  await page.click('#setOverlay [data-act=closeSettings]');
  await page.waitForTimeout(200);
  eq(await page.evaluate(() => [window.__xss || 0, document.querySelectorAll('img').length]), [0, 0], 'no script / no injected <img>');
  await go(page, 'today');
  assert((await txt(page, '#tab-today .goal b')).includes('<img src=x'), 'goal shown literally as text');
});

/* ================================================================== *
 * 13. Install: embedded manifest & icons
 * ================================================================== */
test('install: embedded manifest is a valid data-URL JSON with name, start_url, icons; apple-touch-icon present', 'דרישות טכניות: "manifest מוטמע כדי שאפשר יהיה להוסיף אותו למסך הבית"', async t => {
  const page = await t.open();
  const r = await page.evaluate(async () => {
    const href = document.querySelector('link[rel=manifest]').href;
    const apple = document.querySelector('link[rel=apple-touch-icon]').href;
    const sizeOf = src => new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth + 'x' + i.naturalHeight); i.onerror = () => res('error'); i.src = src; });
    let m = null;
    try { m = await (await fetch(href)).json(); } catch (e) { m = { error: String(e) }; }
    const iconSizes = m && m.icons ? await Promise.all(m.icons.map(i => sizeOf(i.src))) : [];
    return { href: href.slice(0, 40), m, apple: apple.slice(0, 22), appleSize: await sizeOf(apple), iconSizes, metas: [...document.querySelectorAll('meta[name=apple-mobile-web-app-capable],meta[name=viewport],meta[name=theme-color]')].length };
  });
  assert(r.href.startsWith('data:application/manifest+json'), 'manifest is a data URL: ' + r.href);
  assert(r.m && !r.m.error, 'manifest parses as JSON: ' + JSON.stringify(r.m && r.m.error));
  eq([r.m.name, r.m.lang, r.m.dir, r.m.display], ['רגוע וחזק', 'he', 'rtl', 'standalone'], 'manifest fields');
  assert(r.m.start_url && r.m.start_url.endsWith('index.html'), 'start_url: ' + r.m.start_url);
  assert(r.m.icons.some(i => i.sizes === '192x192') && r.m.icons.some(i => i.sizes === '512x512'), '192 & 512 icons');
  r.m.icons.forEach((i, k) => eq(r.iconSizes[k], i.sizes, 'icon decodes at declared size'));
  assert(r.apple.startsWith('data:image/png'), 'apple-touch-icon is an embedded PNG');
  eq(r.appleSize, '180x180', 'apple-touch-icon size');
  assert(r.metas >= 3, 'mobile meta tags');
});

/* ================================================================== *
 * 14. Accessibility basics
 * ================================================================== */
async function visitAllScreens(page, fn) {
  for (const tab of ['today', 'calm', 'incident', 'progress', 'guide']) {
    await go(page, tab);
    if (tab === 'calm') await page.click('#tab-calm .mood[data-c=orange]');
    if (tab === 'incident') await page.evaluate(() => { document.querySelector('#tab-incident details').open = true; });
    if (tab === 'guide') await page.evaluate(() => document.querySelectorAll('#tab-guide details').forEach(d => { d.open = true; }));
    await fn('tab ' + tab);
  }
  await page.click('.topbar [data-act=openSettings]'); await fn('settings'); await page.click('#setOverlay [data-act=closeSettings]');
  await go(page, 'calm'); await page.click('#tab-calm .card:not(#moodTools) [data-ex=box]'); await fn('exercise'); await page.click('#exOverlay .ex-actions [data-act=exClose]');
  await page.evaluate(() => celebrate(1)); await fn('celebration'); await page.click('#celOverlay [data-act=celClose]');
}
test('a11y: html lang="he" dir="rtl"', 'עיצוב: "בעברית מלאה ו-RTL"', async t => {
  const page = await t.open();
  eq(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir, getComputedStyle(document.body).direction]), ['he', 'rtl', 'rtl'], 'lang/dir');
});
test('a11y: every button / interactive control has an accessible name', 'נגישות', async t => {
  const page = await t.open({ state: richState(4) });
  const bad = [];
  await visitAllScreens(page, async where => {
    const r = await page.evaluate(() => [...document.querySelectorAll('button, [role=checkbox], [role=button], input:not([type=hidden]), a[href], summary')].filter(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').filter(e => {
      const lbl = e.getAttribute('aria-label') || (e.labels && [...e.labels].map(l => l.textContent).join('')) || e.getAttribute('title') || e.getAttribute('placeholder') || '';
      const name = (lbl || e.textContent || '').replace(/\s+/g, ' ').trim();
      return !name || /^[✕×🗑️⏸▶\s]+$/u.test(name) && !e.getAttribute('aria-label');
    }).map(e => e.outerHTML.slice(0, 90)));
    r.forEach(x => bad.push(`${where}: ${x}`));
  });
  assert(!bad.length, [...new Set(bad)].join('\n      '));
});
test('a11y: primary controls are at least 44×44 px', 'עיצוב: "כפתורים גדולים ללחיצה באגודל"', async t => {
  const page = await t.open({ state: richState(4) });
  const bad = [];
  await visitAllScreens(page, async where => {
    const r = await page.evaluate(() => [...document.querySelectorAll('nav.bottom button, .btn, .chip, .mood, .tool, .check, .icon-btn, .star-btn, .praise-btn')]
      .filter(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed')
      .map(e => { const r = e.getBoundingClientRect(); return [e.className + ' "' + e.textContent.trim().slice(0, 15) + '"', Math.round(r.width), Math.round(r.height)]; })
      .filter(([, w, h]) => w < 44 || h < 44));
    r.forEach(([n, w, h]) => bad.push(`${where}: ${n} ${w}x${h}`));
  });
  assert(!bad.length, [...new Set(bad)].join('\n      '));
});
test('a11y: secondary controls (delete ×/🗑, chart toggle, summaries) are at least 44×44 px', 'עיצוב: "כפתורים גדולים ללחיצה באגודל"', async t => {
  const page = await t.open({ state: richState(4) });
  const bad = [];
  await visitAllScreens(page, async where => {
    const r = await page.evaluate(() => [...document.querySelectorAll('.x-btn, .seg button, details > summary')]
      .filter(e => e.offsetParent !== null)
      .map(e => { const r = e.getBoundingClientRect(); return [(e.className || e.tagName.toLowerCase()) + ' "' + e.textContent.trim().slice(0, 12) + '"', Math.round(r.width), Math.round(r.height)]; })
      .filter(([, w, h]) => w < 44 || h < 44));
    r.forEach(([n, w, h]) => bad.push(`${where}: ${n} ${w}x${h}`));
  });
  assert(!bad.length, [...new Set(bad)].join('\n      '));
});
test('a11y: dialogs move focus inside when opened and Escape closes them (incl. celebration)', 'נגישות (overlays)', async t => {
  const page = await t.open({ state: makeState({ settings: { starsNeeded: 1 } }) });
  const problems = [];
  await page.click('.topbar [data-act=openSettings]');
  if (!(await page.evaluate(() => document.querySelector('#setOverlay').contains(document.activeElement)))) problems.push('settings: focus stays behind the dialog');
  await page.keyboard.press('Escape');
  await go(page, 'calm');
  await page.click('#tab-calm .card:not(#moodTools) [data-ex=box]');
  if (!(await page.evaluate(() => document.querySelector('#exOverlay').contains(document.activeElement)))) problems.push('exercise: focus stays behind the dialog');
  await page.keyboard.press('Escape');
  await go(page, 'today');
  await page.click('#tab-today [data-act=star] >> nth=0');
  if (!(await page.evaluate(() => document.querySelector('#celOverlay').contains(document.activeElement)))) problems.push('celebration: focus stays behind the dialog');
  await page.keyboard.press('Escape');
  if (await visible(page, '#celOverlay')) problems.push('celebration: Escape does not close it');
  assert(!problems.length, problems.join('\n      '));
});

/* ================================================================== *
 * 15. Global smoke: no console errors across a full session
 * ================================================================== */
test('smoke: full tour with rich data, no console errors or page errors', 'כללי', async t => {
  const page = await t.open({ state: richState(9) });
  await visitAllScreens(page, async () => {});
  await page.clock.runFor(70e3);
  await go(page, 'progress');
  await page.click('#tab-progress [data-mode=hits]');
  await page.locator('#tab-progress svg.chart >> nth=1').locator('rect[data-w="3"]').click({ force: true });
  // harness asserts page.errors is empty
});

/* ================================================================== *
 * 16. Release round: behaviour added for the team-lead rulings, the QA bugs and the design review
 * ================================================================== */
test('dialog: deletes use the in-app confirm sheet (focus inside, Escape and scrim cancel, danger style)', 'ruling 4 / design P1-3: no native confirm()', async t => {
  const st = makeState({ incidents: [inc(NOW - 3600e3)] });
  const page = await t.open({ state: st });
  await go(page, 'incident');
  await page.click('#tab-incident details summary');
  await page.click('#tab-incident [data-act=delIncident]');
  await page.waitForSelector('#dlg:not([hidden])');
  eq(await txt(page, '#dlgTitle'), 'למחוק את האירוע?', 'title');
  assert((await txt(page, '#dlgBody')).includes('מהגרפים'), 'body');
  eq(await page.getAttribute('#dlg', 'role'), 'alertdialog', 'role');
  assert(await page.evaluate(() => document.querySelector('#dlg').contains(document.activeElement) && document.activeElement.id === 'dlgCancel'), 'focus starts on cancel');
  assert((await page.getAttribute('#dlgOk', 'class')).includes('danger-solid'), 'destructive confirm is styled as danger');
  eq(await page.evaluate(() => document.querySelector('main').inert), true, 'background is inert while the sheet is open');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  assert(await page.evaluate(() => document.querySelector('#dlg').contains(document.activeElement)), 'Tab stays inside the sheet');
  await page.keyboard.press('Escape');
  assert(await page.locator('#dlg').isHidden(), 'Escape closes the sheet');
  eq((await getState(page)).incidents.length, 1, 'Escape = cancel');
  await page.click('#tab-incident [data-act=delIncident]');
  await page.waitForSelector('#dlg:not([hidden])');
  await page.waitForTimeout(700); // a new sheet ignores taps for 400 ms (R2-1a)
  await page.mouse.click(20, 40); // tap on the scrim above the sheet
  assert(await page.locator('#dlg').isHidden(), 'tap on the scrim closes the sheet');
  eq((await getState(page)).incidents.length, 1, 'scrim = cancel');
  eq(await page.evaluate(() => document.querySelector('main').inert), false, 'background usable again');
});
test('back button: window.__androidBack follows the priority dialog → exercise → celebration → settings → tab → exit', 'ruling 1 (android/README.md contract)', async t => {
  const page = await t.open({ state: makeState({ settings: { starsNeeded: 1 } }) });
  const back = () => page.evaluate(() => window.__androidBack());
  eq(await back(), false, 'on Today with nothing open: not handled (app goes to background)');
  eq(typeof await back(), 'boolean', 'returns a plain boolean');
  await go(page, 'guide');
  eq(await back(), true, 'non-home tab: handled');
  assert(await page.locator('#tab-today.active').count() === 1, '…and goes to Today');
  await page.click('.topbar [data-act=openSettings]');
  await page.click('#setOverlay [data-act=reset]');
  await page.waitForSelector('#dlg:not([hidden])');
  eq(await back(), true, 'dialog: handled');
  assert(await page.locator('#dlg').isHidden() && await visible(page, '#setOverlay'), 'closes only the dialog first (cancel)');
  eq(await back(), true, 'settings: handled');
  assert(!(await visible(page, '#setOverlay')), 'settings closed');
  await go(page, 'calm');
  await page.click('#tab-calm [data-ex=box]');
  eq(await back(), true, 'exercise: handled');
  eq(await page.evaluate(() => [document.querySelector('#exOverlay').hidden, EX]), [true, null], 'exercise stopped');
  assert(await page.locator('#tab-calm.active').count() === 1, 'stays on the Calm tab');
  await go(page, 'today');
  await addStar(page, 'g1');
  assert(await visible(page, '#celOverlay'), 'celebration open');
  eq(await page.evaluate(() => document.body.style.overflow), 'hidden', 'celebration locks background scroll (QA #28)');
  eq(await back(), true, 'celebration: handled');
  assert(!(await visible(page, '#celOverlay')), 'celebration closed');
  eq(await back(), false, 'nothing left: not handled');
  // onboarding cannot be dismissed with back
  const fresh = await t.open({ state: null });
  eq(await fresh.evaluate(() => window.__androidBack()), false, 'onboarding: not handled');
  assert(await visible(fresh, '#setOverlay'), 'onboarding still shown');
});
test('android bridge: export goes through AndroidBridge.saveFile and __androidSaveResult shows a toast', 'ruling 2 (android/README.md)', async t => {
  const init = () => {
    window.__calls = [];
    window.AndroidBridge = { saveFile: (n, m, c) => { window.__calls.push(['saveFile', n, m, c]); }, vibrate: ms => { window.__calls.push(['vibrate', ms]); }, getAppVersion: () => '1.0.0' };
  };
  const page = await t.open({ state: richState(3), init });
  let downloads = 0; page.on('download', () => downloads++);
  await page.click('.topbar [data-act=openSettings]');
  await page.click('#setOverlay [data-act=export]');
  const calls = (await page.evaluate(() => window.__calls)).filter(c => c[0] === 'saveFile');
  eq(calls.length, 1, 'saveFile called once');
  eq([calls[0][1], calls[0][2]], [`ragua-vehazak-${TODAY}.json`, 'application/json'], 'file name and mime type');
  eq(JSON.parse(calls[0][3]), await getState(page), 'content = stored state');
  eq(await page.evaluate(() => typeof window.__androidSaveResult), 'function', '__androidSaveResult defined');
  await page.evaluate(() => window.__androidSaveResult(true));
  assert((await toastText(page)).includes('נשמר'), 'success toast: ' + await toastText(page));
  await page.evaluate(() => window.__androidSaveResult(false));
  assert((await toastText(page)).includes('לא נשמר'), 'failure toast: ' + await toastText(page));
  await page.waitForTimeout(300);
  eq(downloads, 0, 'no blob download inside the app');
});
test('android bridge: haptics use AndroidBridge.vibrate (patterns summed, clamped to 1000 ms), not navigator.vibrate', 'ruling 2', async t => {
  const init = () => {
    window.__vib = []; window.__nav = 0;
    window.AndroidBridge = { saveFile() {}, vibrate: ms => window.__vib.push(ms) };
    try { Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: () => { window.__nav++; return true; } }); } catch (e) { /* ignore */ }
  };
  const page = await t.open({ state: makeState({ settings: { starsNeeded: 1 } }), init });
  await page.click('#tab-today .check-hit[data-id=move]');
  eq(await page.evaluate(() => window.__vib), [20], 'single pulse for a check');
  await addStar(page, 'g1'); // success [30,40,30] → 60, then the celebration pattern [80,60,80,60,200] → 360
  eq(await page.evaluate(() => window.__vib.slice(1)), [60, 360], 'patterns become one pulse of their total "on" time');
  await page.evaluate(() => vibrate([900, 50, 900]));
  eq(await page.evaluate(() => window.__vib.pop()), 1000, 'clamped to 1000 ms');
  eq(await page.evaluate(() => window.__nav), 0, 'navigator.vibrate not used when the bridge exists');
  const web = await t.open({ init: () => { window.__nav = []; try { Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: p => { window.__nav.push(p); return true; } }); } catch (e) { /* ignore */ } } });
  await web.click('#tab-today .check-hit[data-id=move]');
  eq(await web.evaluate(() => window.__nav), [20], 'web: navigator.vibrate keeps working');
});
test('export (web): cancelling the share sheet does not trigger a download; other share errors fall back to download', 'QA #19 / ruling 2', async t => {
  for (const [errName, expectDownload] of [['AbortError', false], ['NotAllowedError', true]]) {
    const ctxInit = name => {
      Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => 'Mozilla/5.0 (Linux; Android 14) Mobile' });
      navigator.canShare = () => true;
      navigator.share = () => { window.__shared = (window.__shared || 0) + 1; return Promise.reject(new DOMException('x', name)); };
    };
    const page = await t.open({ state: richState(2), init: `(${ctxInit})(${JSON.stringify(errName)})` });
    let downloads = 0; page.on('download', () => downloads++);
    await page.click('.topbar [data-act=openSettings]');
    await page.click('#setOverlay [data-act=export]');
    await page.waitForTimeout(400);
    eq(await page.evaluate(() => window.__shared), 1, errName + ': share sheet opened');
    eq(downloads > 0, expectDownload, `${errName}: download fallback`);
  }
});
test('import safety: a backup that fails to render is rolled back; the previous data is kept in -prev and can be restored', 'ruling 5 / QA #1', async t => {
  const page = await t.open({ state: richState(3) });
  const before = await getState(page);
  await page.click('.topbar [data-act=openSettings]');
  // simulate a screen that cannot render the imported data
  await page.evaluate(() => { window.__realProgress = RENDER.progress; RENDER.progress = () => { if (S.settings.childName === 'BOOM') throw new Error('render failed'); return window.__realProgress(); }; });
  const bad = richState(5); bad.settings.childName = 'BOOM';
  await page.setInputFiles('#importFile', fileFrom('b.json', JSON.stringify(bad)));
  await answer(page, true);
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('לא הצלחנו'));
  eq(await getState(page), before, 'stored data unchanged');
  eq(await page.evaluate(() => S.settings.childName), 'דני', 'in-memory data restored');
  eq(await page.evaluate(k => localStorage.getItem(k + '-prev'), KEY), null, 'nothing committed');
  await page.evaluate(() => { RENDER.progress = window.__realProgress; });
  // a good import keeps the previous state under -prev, and "undo import" brings it back
  const good = richState(6); good.settings.childName = 'רותי';
  await page.setInputFiles('#importFile', fileFrom('g.json', JSON.stringify(good)));
  await answer(page, true);
  await page.waitForFunction(() => document.querySelector('#setOverlay').hidden);
  eq((await getState(page)).settings.childName, 'רותי', 'imported');
  eq(JSON.parse(await page.evaluate(k => localStorage.getItem(k + '-prev'), KEY)).settings.childName, 'דני', 'previous data kept under ragua-vehazak-v1-prev');
  await page.click('.topbar [data-act=openSettings]');
  await page.click('#setOverlay [data-act=undoImport]');
  await answer(page, true);
  await page.waitForFunction(() => document.querySelector('#setOverlay').hidden);
  const s = await getState(page);
  eq([s.settings.childName, s.incidents.length], ['דני', before.incidents.length], 'previous data restored');
});
test('import safety: normalize() deep-validates and sanitizes every field', 'ruling 5 / QA #1, #2', async t => {
  const page = await t.open();
  const r = await page.evaluate(now => {
    const n = normalize({
      settings: { childName: 'א'.repeat(99), startDate: '2026-02-31', rules: [1, null, {}, 'extra'], goals: [{ id: 'g<1>"', text: 'יעד' }, { id: 'g<1>"', text: 'שני' }, { id: 5, text: 7 }, null, { text: '' }], reward: 3, starsNeeded: '0', onboarded: 'yes' },
      days: { '2026-10-12': { checks: { move: 'x', one: true, evil: true }, praises: [{ ts: now, note: 5 }, { ts: now, note: 'ok' }, { ts: 'yesterday' }] }, 'bad-key': {}, '2026-13-01': {} },
      stars: [{ goalId: 'g"1', ts: now }, { goalId: 'g2', ts: 'x' }, null],
      celebrated: { 1: true, 2: 7, x: true, 3: 'a' },
      moods: [{ ts: now, c: 'red' }, { ts: now, c: '"><img>' }, { ts: -5, c: 'green' }],
      incidents: [{ id: 'a b<', ts: now, actions: 'מכה', response: [1, 'הפרדנו'], used: 'maybe', note: null }, { id: 'a b<', ts: now, actions: ['צעקה'] }, { ts: now, note: {} }, { ts: NaN }],
      ui: { tab: 'constructor', chartMode: 'x' }, __proto__: { polluted: true }
    });
    return { n, polluted: ({}).polluted };
  }, NOW);
  const n = r.n;
  eq(r.polluted, undefined, 'no prototype pollution');
  eq(n.settings.childName.length, 30, 'name capped at 30');
  eq(n.settings.startDate, TODAY, 'invalid date → today');
  eq(n.settings.rules, ['1', '', ''], 'exactly 3 string rules');
  eq(n.settings.goals.map(g => g.text), ['יעד', 'שני', '7'], 'goals: objects with text only');
  assert(n.settings.goals.every(g => /^[A-Za-z0-9_-]+$/.test(g.id)) && new Set(n.settings.goals.map(g => g.id)).size === 3, 'goal ids sanitized and unique: ' + JSON.stringify(n.settings.goals));
  eq([n.settings.reward, n.settings.starsNeeded, n.settings.onboarded], ['בחירת פעילות מיוחדת עם אבא או אמא', 1, false], 'reward default, target ≥ 1, boolean onboarded');
  eq(Object.keys(n.days), ['2026-10-12'], 'only valid day keys');
  eq(n.days['2026-10-12'], { checks: { one: true }, praises: [{ ts: NOW, note: 'ok' }] }, 'checks booleans of known items; praises with a numeric ts and a string note');
  eq(n.stars, [{ goalId: 'g1', ts: NOW }], 'stars: valid ts, sanitized goal id');
  eq(n.celebrated, { 1: 1, 2: 7 }, 'celebrated: legacy true → current target; numbers kept');
  eq(n.moods, [{ ts: NOW, c: 'red' }], 'moods: known colors and valid ts only');
  eq(n.incidents.length, 2, 'incidents with bad ts or non-string note dropped');
  eq([n.incidents[0].actions, n.incidents[0].response, n.incidents[0].used, n.incidents[0].note], [['מכה'], ['הפרדנו'], null, ''], 'incident fields coerced');
  assert(n.incidents.every(i => /^[A-Za-z0-9_-]+$/.test(i.id)) && n.incidents[0].id !== n.incidents[1].id, 'incident ids sanitized and unique');
  eq(n.ui, { tab: 'today', chartMode: 'all' }, 'ui values whitelisted');
});
test('storage: corrupt stored JSON is copied to ragua-vehazak-v1-corrupt and the user is told', 'ruling 5 / QA #20', async t => {
  const bad = '{"v":1,"settings":{"childName":"דני"';
  const page = await t.open({ state: bad });
  eq(await page.evaluate(k => localStorage.getItem(k + '-corrupt'), KEY), bad, 'raw string kept aside');
  assert((await toastText(page)).includes('עותק'), 'toast explains: ' + await toastText(page));
  assert(await visible(page, '#setOverlay'), 'app usable (onboarding)');
});
test('onboarding: offers "restore from backup" and keeps the form short (rules & stars collapsed)', 'QA #21 / design P2-29', async t => {
  const page = await t.open({ state: null });
  assert(await page.locator('#setOverlay [data-act=import]').isVisible(), 'restore button on the welcome screen');
  eq(await page.locator('#setOverlay details.card').evaluate(d => d.open), false, 'customisation collapsed');
  const backup = richState(4); backup.settings.childName = 'רותי'; backup.settings.onboarded = true;
  await page.setInputFiles('#importFile', fileFrom('b.json', JSON.stringify(backup)));
  await answer(page, true);
  await page.waitForFunction(() => document.querySelector('#setOverlay').hidden);
  assert((await txt(page, '.hero .eyebrow')).includes('רותי'), 'restored without filling the onboarding form');
});
test('before the start date: data is not counted in week 1, stars use a pre-start bucket, Progress explains', 'ruling 8 / QA #18, #27', async t => {
  const start = addDaysKey(TODAY, 2); // program starts on Wednesday
  const st = makeState({ settings: { startDate: start, starsNeeded: 2 }, incidents: [inc(NOW - 3600e3, { actions: ['מכה'] }), inc(NOW - DAY, { actions: ['מכה'] })] });
  const page = await t.open({ state: st });
  assert((await txt(page, '.hero h1')).includes('בעוד יומיים'), 'countdown');
  await addStar(page, 'g1');
  assert((await txt(page, '#tab-today .pill.blue')).includes('1/2'), 'pre-start stars counted in their own bucket');
  await addStar(page, 'g2');
  assert(await visible(page, '#celOverlay'), 'reaching the target before the start still celebrates');
  assert(!(await txt(page, '#celInner')).includes('השבוע'), 'no "this week" wording before the start');
  await page.click('#celOverlay [data-act=celClose]');
  await go(page, 'progress');
  const p = await txt(page, '#tab-progress');
  assert(p.includes('התוכנית מתחילה ב-') && p.includes('לא נספרים בקו הבסיס'), 'progress explains: ' + p.slice(0, 200));
  await go(page, 'incident');
  await page.click('#tab-incident details summary');
  eq(await page.locator('#tab-incident .inc-item').count(), 2, 'pre-start incidents stay in the list');
  // three days later = week 1: the pre-start data is not week 1
  await page.clock.setSystemTime(NOW + 3 * DAY);
  await reload(page);
  await go(page, 'today');
  assert((await txt(page, '.hero h1')).replace(/\s+/g, ' ').includes('שבוע 1 מתוך 12'), 'week 1 after the start');
  assert((await txt(page, '#tab-today .pill.blue')).includes('0/2'), 'week 1 stars start at 0');
  await go(page, 'progress');
  eq(await page.locator('#tab-progress table.wk tbody tr').evaluateAll(trs => trs.map(tr => tr.cells[1].textContent)), ['0'], 'week 1 has 0 incidents');
  assert((await txt(page, '#tab-progress')).includes('לפני תחילת התוכנית'), 'note about the pre-start incidents');
});
test('progress: partial current week is never compared; the last completed week is', 'ruling 6 / QA #4', async t => {
  const start = startForWeek(3);
  const I = [...Array(10)].map((_, i) => inc(tsIn(start, 1, i % 7))).concat([...Array(3)].map((_, i) => inc(tsIn(start, 2, i))));
  const page = await t.open({ state: makeState({ settings: { startDate: start }, incidents: I }) }); // week 3, day 1, no incident yet
  await go(page, 'progress');
  const kpi = (await page.locator('#tab-progress .kpi').allInnerTexts()).map(k => k.replace(/\s+/g, ' '));
  assert(kpi[0].includes('0') && kpi[0].includes('השבוע עד עכשיו'), 'current week = count so far: ' + kpi[0]);
  assert(kpi[1].includes('70%') && kpi[1].includes('שבוע 2'), 'change uses week 2 (3 vs 10 = −70%): ' + kpi[1]);
  const enc = await txt(page, '#tab-progress .encourage');
  assert(enc.includes('הגעתם ליעד') && enc.includes('בשבוע 2') && enc.includes('70%'), 'goal message names the completed week: ' + enc);
  // week 1: no comparison at all
  const p1 = await t.open({ state: makeState({ incidents: [inc(NOW - 3600e3)] }) });
  await go(p1, 'progress');
  eq(await p1.locator('#tab-progress .kpi').count(), 3, 'week 1: no comparison KPI');
  assert(!(await p1.locator('#tab-progress .kpis').innerText()).includes('לעומת'), 'no comparison KPI text in week 1');
});
test('progress: baseline = first week with incidents (and first week with hits in "hits only" mode)', 'ruling 7 / QA #13, #25', async t => {
  const start = startForWeek(4);
  const I = [...Array(6)].map((_, i) => inc(tsIn(start, 2, i), { actions: ['צעקה'] }))
    .concat([...Array(4)].map((_, i) => inc(tsIn(start, 3, i), { actions: i < 2 ? ['מכה'] : ['צעקה'] })));
  const page = await t.open({ state: makeState({ settings: { startDate: start }, incidents: I }) });
  await go(page, 'progress');
  let legend = await txt(page, '#tab-progress .legend');
  assert(legend.includes('בסיס (שבוע 2): 6'), 'all mode: baseline week 2: ' + legend);
  assert((await txt(page, '#tab-progress')).includes('בשבוע 1 לא נרשמו אירועים'), 'explains why the baseline is week 2');
  const kpi = (await page.locator('#tab-progress .kpi').allInnerTexts()).map(k => k.replace(/\s+/g, ' '));
  assert(kpi[1].includes('שבוע 3') && kpi[1].includes('(שבוע 2)') && kpi[1].includes('33%'), 'change vs the baseline week: ' + kpi[1]);
  await page.click('#tab-progress [data-act=chartMode][data-mode=hits]');
  legend = await txt(page, '#tab-progress .legend');
  assert(legend.includes('בסיס (שבוע 3): 2'), 'hits mode: first week with hits: ' + legend);
  eq(await page.locator('#tab-progress .kpi').count(), 3, 'hits mode: week 3 is the baseline, nothing completed after it to compare');
  // hits mode with incidents but no hits at all: accurate message
  const p2 = await t.open({ state: makeState({ settings: { startDate: startForWeek(2) }, incidents: [inc(tsIn(startForWeek(2), 1, 1))], ui: { chartMode: 'hits' } }) });
  await go(p2, 'progress');
  const msg = await txt(p2, '#tab-progress');
  assert(msg.includes('עוד לא נרשמו אירועי מכות') && !msg.includes('כשיהיו אירועים רשומים בשבוע 1'), 'hits-mode message: ' + msg.slice(0, 300));
});
test('progress: future weeks are not tappable; tapping a table row selects the week', 'QA #26 / design P3-11', async t => {
  const page = await t.open({ state: progressFixture() });
  await go(page, 'progress');
  eq(await page.locator('#tab-progress svg.chart').first().locator('rect[data-act=bar]').evaluateAll(rs => rs.map(r => r.dataset.w)), ['1', '2', '3', '4'], 'only elapsed weeks have tap targets');
  assert(await page.locator('#tab-progress svg.chart rect[data-w="1"]').first().getAttribute('aria-label') !== null, 'bars have accessible names');
  await page.click('#tab-progress table.wk tbody tr:nth-child(3)');
  assert((await txt(page, '#tab-progress .chart-info')).includes('שבוע 3: 4 אירועים'), 'row tap selects the week in the chart');
  // RTL: week 1 is the right-most bar
  const xs = await page.evaluate(() => [...document.querySelector('#tab-progress svg.chart').querySelectorAll('rect[data-act=bar]')].map(r => +r.getAttribute('x')));
  assert(xs.every((x, i) => i === 0 || x < xs[i - 1]), 'week 1 on the right, later weeks to the left: ' + xs);
});
test('incident: duration buckets and the 20-minute long-outburst rule', 'ruling 9 / QA #17; spec: "התפרצויות ארוכות מ-20–30 דקות"', async t => {
  const page = await t.open();
  await go(page, 'incident');
  eq(await page.locator('#tab-incident [data-group=duration] .chip').evaluateAll(els => els.map(e => e.dataset.val)), ['פחות מדקה', '1–5 דקות', '5–10 דקות', '10–20 דקות', '20–30 דקות', 'יותר מ-30 דקות'], 'duration buckets');
  const cases = [[['10–20 דקות', '15–30 דקות', '5–15 דקות'], 0], [['20–30 דקות', '10–20 דקות'], 0], [['20–30 דקות', 'יותר מ-30 דקות', '15–30 דקות'], 2]];
  for (const [durs, longN] of cases) {
    const p = await t.open({ state: makeState({ settings: { startDate: startForWeek(2) }, incidents: durs.map((d, i) => inc(NOW - (i * 3 + 1) * DAY, { duration: d })) }) });
    await go(p, 'progress');
    const pro = await p.locator('#tab-progress .pro').count() ? await txt(p, '#tab-progress .pro') : '';
    if (longN) assert(pro.includes(`בשבועיים האחרונים היו ${longN} התפרצויות שנמשכו 20 דקות ויותר`), 'long-outburst reason: ' + pro);
    else eq(pro, '', `no card for ${durs.join(', ')} (legacy "15–30" is not long)`);
    if (durs.includes('5–15 דקות')) { await go(p, 'incident'); await p.click('#tab-incident details summary'); assert((await txt(p, '#tab-incident details')).includes('5–15 דקות'), 'legacy value displayed as stored'); }
  }
});
test('incident: times more than 5 minutes ahead are rejected with a message; the field has a max', 'ruling 11 / QA #6', async t => {
  const page = await t.open();
  await go(page, 'incident');
  eq(await page.getAttribute('#incTs', 'max'), TODAY + 'T10:05', 'datetime max = now + 5 min');
  await page.click('#tab-incident [data-field=actions][data-val="מכה"]');
  await page.fill('#incTs', TODAY + 'T10:10');
  await page.click('#tab-incident [data-act=saveIncident]');
  assert((await toastText(page)).includes('עוד לא הגיעה'), 'message: ' + await toastText(page));
  eq((await getState(page)).incidents.length, 0, 'not saved');
  await page.fill('#incTs', TODAY + 'T10:04');
  await page.click('#tab-incident [data-act=saveIncident]');
  eq((await getState(page)).incidents.length, 1, 'within 5 minutes is accepted (clock skew)');
});
test('incident: the automatic time shown in the form stays current while the tab is open', 'ruling 12 / QA #3, #5', async t => {
  const page = await t.open();
  await go(page, 'incident');
  await page.clock.runFor(2 * 60e3 + 500);
  eq(await page.inputValue('#incTs'), TODAY + 'T10:02', 'refreshed by the 60 s tick');
  await page.fill('#incTs', TODAY + 'T09:00');
  await page.clock.runFor(2 * 60e3);
  eq(await page.inputValue('#incTs'), TODAY + 'T09:00', 'an edited time is never overwritten');
});
test('stars: double-tap guard ignores a repeat within 800 ms only', 'ruling 10 / QA #10', async t => {
  const page = await t.open();
  await page.click('#tab-today [data-act=star][data-id=g1]');
  await page.clock.runFor(500);
  await page.click('#tab-today [data-act=star][data-id=g1]');
  eq((await getState(page)).stars.length, 1, 'second tap after 500 ms ignored');
  await page.click('#tab-today [data-act=star][data-id=g2]');
  eq((await getState(page)).stars.length, 2, 'another goal is not blocked');
  await page.clock.runFor(400);
  await page.click('#tab-today [data-act=star][data-id=g1]');
  eq((await getState(page)).stars.length, 3, 'accepted after 900 ms');
});
test('stars: goal ids are stable – editing keeps the id, a new slot gets a new id, removed goals stay in the total', 'ruling 10 / QA #9', async t => {
  const page = await t.open({ state: makeState({ settings: { goals: [{ id: 'g1', text: 'A' }, { id: 'g2', text: 'B' }] }, stars: [{ goalId: 'g1', ts: NOW - 3000 }, { goalId: 'g2', ts: NOW - 2000 }] }) });
  await setSettings(page, { sGoal0: 'A – מנוסח מחדש', sGoal2: 'C חדש' });
  let s = await getState(page);
  eq(s.settings.goals.slice(0, 2).map(g => g.id), ['g1', 'g2'], 'edited goal keeps its id');
  assert(!['g1', 'g2', 'g3'].includes(s.settings.goals[2].id), 'new slot gets a new unique id: ' + s.settings.goals[2].id);
  const read = () => page.locator('#tab-today .goal').evaluateAll(gs => gs.map(g => g.querySelectorAll('.s').length));
  eq(await read(), [1, 1, 0], 'stars stay with their goals');
  await setSettings(page, { sGoal1: '' });
  eq(await read(), [1, 0], 'removed goal no longer shown');
  assert((await txt(page, '#tab-today .pill.blue')).includes('2/'), 'its star still counts in the weekly total');
  s = await getState(page);
  eq(s.stars.length, 2, 'no star deleted');
});
test('exercise: completion after the morning breathing returns to Today; after a tool, mood dots log a feeling', 'QA #16 / design P2-18, P3-3', async t => {
  const page = await t.open();
  await page.click('#tab-today [data-act=morningBreath]');
  await page.clock.runFor(180e3);
  assert((await txt(page, '#exInner')).includes('חזרה להיום'), 'button says "back to Today"');
  await page.click('#exInner [data-goto=today]');
  assert(await page.locator('#tab-today.active').count() === 1, 'returns to Today');
  await go(page, 'calm');
  await page.click('#tab-calm [data-ex=wall]');
  await page.clock.runFor(15e3);
  await page.click('#exInner [data-act=doneMood][data-c=green]');
  assert(await page.locator('#tab-calm.active').count() === 1, 'on Calm');
  eq(await page.getAttribute('#tab-calm .mood[data-c=green]', 'aria-pressed'), 'true', 'feeling selected');
  eq((await getState(page)).moods.map(m => m.c), ['green'], 'feeling logged');
});
test('exercise: pausing mid-second does not drift (wall-clock timer)', 'QA #24', async t => {
  const page = await t.open();
  await go(page, 'calm');
  await page.click('#tab-calm .card:not(#moodTools) [data-ex=wall]');
  await page.clock.runFor(1500);            // 8.5 s left in the 10 s step
  await page.click('#exPauseBtn');
  await page.clock.runFor(10300);
  await page.click('#exPauseBtn');
  await page.clock.runFor(400);
  eq(await txt(page, '#exNum'), '9', 'still 9 just before the next whole second');
  await page.clock.runFor(200);
  eq(await txt(page, '#exNum'), '8', 'decrements 0.5 s after resuming, not earlier');
});
test('ranges render left-to-right (bidi) without changing stored values', 'ruling 13 / design P1-2', async t => {
  const page = await t.open();
  const r = await page.evaluate(() => [...document.querySelectorAll('#tab-today .rng')].map(s => [s.textContent, s.dir, getComputedStyle(s).whiteSpace]));
  assert(r.some(([x, d, ws]) => x === '30–60' && d === 'ltr' && ws === 'nowrap'), 'checklist range isolated: ' + JSON.stringify(r));
  await go(page, 'incident');
  const chip = await page.evaluate(() => { const c = document.querySelector('[data-field=duration][data-val="1–5 דקות"]'); return [c.dataset.val, !!c.querySelector('.rng')]; });
  eq(chip, ['1–5 דקות', true], 'chip value unchanged, display isolated');
});
test('fonts: Heebo is embedded (data: URL, Hebrew + Latin) and the app makes no network requests', 'ruling 3 / ruling 14; spec: "פונט עברי קריא (Heebo)", "עובד גם אופליין"', async t => {
  const page = await t.open({ offline: true, state: richState(4) });
  const r = await page.evaluate(async () => {
    const faces = await document.fonts.load('700 20px Heebo', 'שלום abc');
    const all = [...document.fonts].filter(f => f.family.replace(/["']/g, '') === 'Heebo');
    return { loaded: faces.length, status: all.map(f => f.status), ranges: all.map(f => f.unicodeRange), body: getComputedStyle(document.body).fontFamily, html: document.documentElement.outerHTML.includes('fonts.googleapis') };
  });
  assert(r.loaded >= 1 && r.status.every(s => s === 'loaded' || s === 'unloaded') && r.status.includes('loaded'), 'Heebo faces load offline: ' + JSON.stringify(r.status));
  assert(r.ranges.some(x => /U\+590-5FF/i.test(x)) && r.ranges.some(x => /U\+0?0-FF/i.test(x)), 'hebrew + latin subsets: ' + r.ranges);
  assert(/^"?Heebo/.test(r.body), 'body uses Heebo first');
  eq(r.html, false, 'no Google Fonts reference left');
  for (const tab of ['today', 'calm', 'incident', 'progress', 'guide']) await go(page, tab);
  await page.click('.topbar [data-act=openSettings]');
  eq(t.remote, [], 'no remote request while using the app');
});
test('install: icon is the designer\'s stones icon (teal → blue gradient, light stones in the middle)', 'ruling 14 / design §6', async t => {
  const page = await t.open();
  const px = await page.evaluate(() => new Promise(res => {
    const i = new Image();
    i.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); x.drawImage(i, 0, 0); const at = (a, b) => [...x.getImageData(a, b, 1, 1).data]; res({ tl: at(4, 4), br: at(507, 507), mid: at(256, 270) }); };
    i.src = JSON.parse(atob(document.querySelector('link[rel=manifest]').href.split(',')[1].replace(/\s/g, ''))).icons.find(x => x.sizes === '512x512').src;
  }));
  assert(px.tl[1] > px.tl[0] && px.tl[1] > 120, 'teal top-left: ' + px.tl);
  assert(px.br[2] > px.br[1] - 10, 'blue-ish bottom-right: ' + px.br);
  assert(px.mid[0] > 200 && px.mid[1] > 200 && px.mid[2] > 200, 'light stone in the centre: ' + px.mid);
});

/* ================================================================== *
 * 17. Round-2 QA regression audit: new surface (confirm sheet, pre-start bucket, midnight tick)
 * ================================================================== */
async function doubleTap(page, sel) {
  const bx = await page.locator(sel).boundingBox();
  const x = bx.x + bx.width / 2, y = bx.y + bx.height / 2;
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(120);       // a quick human double tap
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(200);
}
test('dialog: a double tap on "המשך" in the reset sheet must not also confirm the second ("בטוחים?") step', 'הגדרות: "איפוס" (two-step confirmation)', async t => {
  const page = await t.open({ state: richState(4) });
  await page.click('.topbar [data-act=openSettings]');
  await page.click('#setOverlay [data-act=reset]');
  await page.waitForSelector('#dlg:not([hidden])');
  await page.waitForTimeout(700);  // the user reads the sheet first (a new sheet ignores taps for its first 400 ms, R2-1a)
  await doubleTap(page, '#dlgOk');
  const s = await getState(page);
  assert(s.incidents.length > 0 && s.settings.onboarded === true, `a double tap wiped all data (incidents left: ${s.incidents.length})`);
  assert(await visible(page, '#dlg') && (await txt(page, '#dlgTitle')).includes('בטוחים'), 'the second confirmation is still waiting for a deliberate tap');
});
test('dialog: a double tap on a confirm button does not click through to the screen behind', 'confirm sheet (ruling 4)', async t => {
  const page = await t.open({ state: makeState({ incidents: [inc(NOW - 3600e3), inc(NOW - 7200e3)] }) });
  await go(page, 'incident');
  await page.click('#tab-incident details summary');
  await page.click('#tab-incident [data-act=delIncident] >> nth=0');
  await page.waitForSelector('#dlg:not([hidden])');
  await page.waitForTimeout(700);  // the user reads the sheet first (a new sheet ignores taps for its first 400 ms, R2-1a)
  await doubleTap(page, '#dlgOk');
  eq((await getState(page)).incidents.length, 1, 'exactly one incident deleted');
  eq(await page.evaluate(() => S.ui.tab), 'incident', 'second tap must not activate whatever is under the sheet (e.g. a nav tab)');
});
test('stars: moving the start date into the future does not count old program stars in the pre-start bucket', 'ruling 8 / QA #18', async t => {
  const stars = [...Array(20)].map((_, i) => ({ goalId: 'g1', ts: NOW - (i + 1) * DAY }));
  const page = await t.open({ state: makeState({ settings: { startDate: startForWeek(5), starsNeeded: 15 }, stars }) });
  await setSettings(page, { sStart: addDaysKey(TODAY, 7) }); // restart the program next week
  const pill = await txt(page, '#tab-today .pill.blue');
  assert(!(await txt(page, '#tab-today .reward')).includes('הפרס הורווח'), `restart shows the reward as already earned (pill ${pill})`);
  await addStar(page, 'g1');
  assert(!(await visible(page, '#celOverlay')), 'one new star after a restart triggers a celebration');
});
test('midnight: the day-rollover re-render keeps focus (and the keyboard) in the field being typed', 'ruling 12 / QA #5', async t => {
  const page = await t.open({ time: tsJ(TODAY + 'T23:59') });
  await page.click('#praiseNote');
  await page.keyboard.type('ויתר');
  await page.clock.runFor(61e3);
  await page.keyboard.type(' על התור');
  eq(await page.inputValue('#praiseNote'), 'ויתר על התור', 'keystrokes after midnight are lost (focus dropped by the re-render)');
});
test('layout: the praise counter "(n/5)" never wraps inside itself (long child name, 320 px)', 'עיצוב (design P1-2 bidi)', async t => {
  const st = makeState({ settings: { childName: 'אברהם יצחק בן-דוד לוי' } });
  st.days[TODAY] = { checks: {}, praises: [{ ts: NOW - 1000, note: '' }, { ts: NOW - 900, note: '' }, { ts: NOW - 800, note: '' }] };
  const page = await t.open({ width: 320, state: st });
  const lines = await page.locator('#tab-today .praise-btn > span').evaluate(e => e.getClientRects().length > 1 ? e.getClientRects().length : Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight || 24)));
  eq(lines, 1, '"(3/5)" is split over several lines');
});

/* ================================================================== *
 * 18. Round-2 fixes: tap guards, undo swap, pre-start window, midnight focus, table keyboard
 * ================================================================== */
const center = async (page, sel) => { const b = await page.locator(sel).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
test('dialog guard: a new sheet ignores taps (buttons and scrim) for its first 400 ms', 'R2-1a', async t => {
  const page = await t.open({ state: makeState({ incidents: [inc(NOW - 3600e3)] }) });
  await go(page, 'incident');
  await page.click('#tab-incident details summary');
  await page.click('#tab-incident [data-act=delIncident]');
  await page.waitForSelector('#dlg:not([hidden])');
  const [x, y] = await center(page, '#dlgOk');
  await page.touchscreen.tap(x, y);                 // immediately: ignored
  await page.touchscreen.tap(20, 40);               // scrim, immediately: ignored too
  assert(await visible(page, '#dlg'), 'sheet still open');
  eq((await getState(page)).incidents.length, 1, 'early tap did not confirm');
  await page.waitForTimeout(700);
  await page.touchscreen.tap(x, y);
  await page.waitForSelector('#dlg', { state: 'hidden' });
  eq((await getState(page)).incidents.length, 0, 'a deliberate tap after 400 ms confirms');
});
test('dialog guard: the tap right after a sheet closes is swallowed (no click-through), later taps work', 'R2-1b / R2-2', async t => {
  const page = await t.open({ state: makeState({ incidents: [inc(NOW - 3600e3)] }) });
  await go(page, 'incident');
  await page.click('#tab-incident details summary');
  await page.click('#tab-incident [data-act=delIncident]');
  await page.waitForSelector('#dlg:not([hidden])');
  await page.waitForTimeout(700);
  const ok = await center(page, '#dlgOk'), nav = await center(page, 'nav.bottom [data-tab=progress]');
  await page.touchscreen.tap(...ok);
  await page.touchscreen.tap(...nav);               // within 400 ms of closing: swallowed
  eq(await page.evaluate(() => S.ui.tab), 'incident', 'tap after closing does not reach the nav');
  await page.waitForTimeout(700);
  await page.touchscreen.tap(...nav);
  eq(await page.evaluate(() => S.ui.tab), 'progress', 'a later tap works normally');
});
test('reset: the second step is laid out differently, so repeated double taps can never pass both', 'R2-1c', async t => {
  const page = await t.open({ state: richState(4) });
  await page.click('.topbar [data-act=openSettings]');
  await page.click('#setOverlay [data-act=reset]');
  await page.waitForSelector('#dlg:not([hidden])');
  await page.waitForTimeout(700);
  const ok1 = await center(page, '#dlgOk');
  await doubleTap(page, '#dlgOk');                    // first tap confirms step 1, second one is swallowed
  eq(await txt(page, '#dlgTitle'), 'בטוחים?', 'step 2 waiting');
  eq(await txt(page, '#dlgOk'), 'כן, למחוק הכול', 'step 2 confirm label');
  const ok2 = await center(page, '#dlgOk'), cancel2 = await center(page, '#dlgCancel');
  assert(Math.abs(ok2[0] - ok1[0]) > 50, `step 2 confirm is on the other side (x ${ok1[0]} → ${ok2[0]})`);
  near(cancel2[0], ok1[0], 2, 'step 2 cancel sits where step 1 confirm was');
  await page.waitForTimeout(700);
  await page.touchscreen.tap(...ok1);                 // a second double tap at the same spot hits "ביטול"
  await page.touchscreen.tap(...ok1);
  await page.waitForTimeout(700);
  assert(await page.locator('#dlg').isHidden(), 'sheet closed by cancel');
  assert((await getState(page)).incidents.length > 0, 'data kept');
});
test('undo import: swaps with the slot (undo, then redo), states the import time, nothing is lost', 'R2-5', async t => {
  const page = await t.open({ state: richState(3) });
  await page.click('.topbar [data-act=openSettings]');
  const b = richState(6); b.settings.childName = 'רותי';
  await page.setInputFiles('#importFile', fileFrom('b.json', JSON.stringify(b)));
  await answer(page, true);
  await page.waitForFunction(() => document.querySelector('#setOverlay').hidden);
  eq(JSON.parse(await page.evaluate(k => localStorage.getItem(k + '-prev-at'), KEY)), { kind: 'pre-import', at: NOW, undone: false }, 'import time and slot kind stored with the slot');
  await page.clock.runFor(3600e3);
  await go(page, 'incident');                         // a change made after the import
  await page.click('#tab-incident [data-field=actions][data-val="מכה"]');
  await page.click('#tab-incident [data-act=saveIncident]');
  const afterImport = (await getState(page)).incidents.length;
  await page.click('.topbar [data-act=openSettings]');
  assert((await txt(page, '#setOverlay [data-act=undoImport]')).includes('לפני הייבוא'), 'undo offered');
  await page.click('#setOverlay [data-act=undoImport]');
  const body = await txt(page, '#dlgBody');
  assert(body.includes('12.10.2026') && body.includes('10:00') && body.includes('לא יימחקו'), 'sheet states the import date/time and that nothing is lost: ' + body);
  await answer(page, true);
  await page.waitForFunction(() => document.querySelector('#setOverlay').hidden);
  eq((await getState(page)).settings.childName, 'דני', 'undo: data from before the import');
  eq(JSON.parse(await page.evaluate(k => localStorage.getItem(k + '-prev'), KEY)).incidents.length, afterImport, 'the imported data plus later changes moved to the slot');
  await page.click('.topbar [data-act=openSettings]');
  assert((await txt(page, '#setOverlay [data-act=undoImport]')).includes('מהגיבוי'), 'redo offered');
  await page.click('#setOverlay [data-act=undoImport]');
  await answer(page, true);
  await page.waitForFunction(() => document.querySelector('#setOverlay').hidden);
  const s = await getState(page);
  eq([s.settings.childName, s.incidents.length], ['רותי', afterImport], 'redo: imported data back, including the later change');
});
test('undo import: offered only for 7 days, and never when the slot would be an empty default state', 'R2-5', async t => {
  const page = await t.open({ state: richState(3) });
  await page.click('.topbar [data-act=openSettings]');
  await page.setInputFiles('#importFile', fileFrom('b.json', JSON.stringify(richState(5))));
  await answer(page, true);
  await page.waitForFunction(() => document.querySelector('#setOverlay').hidden);
  await page.clock.setSystemTime(NOW + 6 * DAY);
  await page.click('.topbar [data-act=openSettings]');
  eq(await page.locator('#setOverlay [data-act=undoImport]').count(), 1, 'offered on day 6');
  await page.click('#setOverlay [data-act=closeSettings]');
  await page.clock.setSystemTime(NOW + 7.5 * DAY);
  await page.click('.topbar [data-act=openSettings]');
  eq(await page.locator('#setOverlay [data-act=undoImport]').count(), 0, 'not offered after 7 days');
  eq(await page.evaluate(k => [localStorage.getItem(k + '-prev'), localStorage.getItem(k + '-prev-at')], KEY), [null, null], 'expired slot cleared');
  // restore during onboarding (new phone): there is nothing to go back to
  const fresh = await t.open({ state: null });
  await fresh.setInputFiles('#importFile', fileFrom('b.json', JSON.stringify(richState(4))));
  await answer(fresh, true);
  await fresh.waitForFunction(() => document.querySelector('#setOverlay').hidden);
  eq(await fresh.evaluate(k => localStorage.getItem(k + '-prev'), KEY), null, 'no undo slot for an empty default state');
  await fresh.click('.topbar [data-act=openSettings]');
  eq(await fresh.locator('#setOverlay [data-act=undoImport]').count(), 0, 'no undo button');
});
test('pre-start stars: week 0 counts only the last 7 days (from midnight 6 days ago) before the start', 'R2-3', async t => {
  const stars = [7, 8, 10].map(d => ({ goalId: 'g1', ts: NOW - d * DAY }))                 // too old
    .concat([{ goalId: 'g1', ts: tsJ(addDaysKey(TODAY, -6) + 'T00:05') }, { goalId: 'g2', ts: NOW - 2 * DAY }]);  // inside the window
  const page = await t.open({ state: makeState({ settings: { startDate: addDaysKey(TODAY, 3), starsNeeded: 3 }, stars, celebrated: { 0: 3 } }) });
  assert((await txt(page, '#tab-today .pill.blue')).includes('2/3'), 'only the 2 stars of the last 7 days: ' + await txt(page, '#tab-today .pill.blue'));
  await page.click('.topbar [data-act=openSettings]');
  await page.fill('#sStart', addDaysKey(TODAY, 4));
  await page.click('#setOverlay [data-act=saveSettings]');
  eq((await getState(page)).celebrated, {}, 'celebrated[0] cleared when the start date changes');
  await addStar(page, 'g1');
  assert(await visible(page, '#celOverlay'), '3/3 in the pre-start week celebrates');
});
test('midnight while typing: the re-render waits until the field is left; drafts are kept', 'R2-4 / QA #5', async t => {
  const page = await t.open({ time: tsJ(TODAY + 'T23:59') });
  await page.click('#tab-today .check-hit[data-id=move]');
  await page.click('#praiseNote');
  await page.keyboard.type('עזר');
  await page.clock.runFor(61e3);                       // midnight passes while the field is focused
  eq(await page.evaluate(() => document.activeElement.id), 'praiseNote', 'focus kept');
  eq(await page.locator('#tab-today .check.done').count(), 1, 're-render deferred (yesterday still on screen while typing)');
  await page.evaluate(() => document.activeElement.blur());
  await page.clock.runFor(300);
  eq(await page.locator('#tab-today .check.done').count(), 0, 'new day shown once the field is left');
  eq(await page.inputValue('#praiseNote'), 'עזר', 'typed text kept');
  // same on the incident tab
  await go(page, 'incident');
  await page.click('#incNote');
  await page.keyboard.type('בגן');
  await page.clock.setSystemTime(tsJ(addDaysKey(TODAY, 2) + 'T08:00'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  eq(await page.evaluate(() => document.activeElement.id), 'incNote', 'focus kept on the incident note');
  await page.keyboard.type(' היום');
  eq(await page.inputValue('#incNote'), 'בגן היום', 'keystrokes continue');
});
test('weekly table: rows are keyboard operable with a visible focus ring', 'R2-7', async t => {
  const page = await t.open({ state: progressFixture() });
  await go(page, 'progress');
  const row = '#tab-progress table.wk tbody tr[data-w="2"]';
  eq(await page.getAttribute(row, 'tabindex'), '0', 'row focusable');
  await page.focus(row);
  await page.keyboard.press('Enter');
  assert((await txt(page, '#tab-progress .chart-info')).includes('שבוע 2: 7 אירועים'), 'Enter selects the week');
  eq(await page.evaluate(() => document.activeElement.dataset.w), '2', 'focus stays on the row after the re-render');
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  eq(ring, 'solid', 'visible focus ring');
  await page.keyboard.press('Space');
  assert((await txt(page, '#tab-progress .chart-info')).includes('הקישו'), 'Space toggles the selection off');
});

/* ================================================================== *
 * 19. Round-3 QA re-verification: adversarial taps / keys on the reset flow, undo-slot promises
 * ================================================================== */
test('reset (adversarial): immediate double tap, triple/quad taps and Enter auto-repeat never pass both steps', 'R2-1 (round 3)', async t => {
  const page = await t.open({ state: richState(4) });
  const openReset = async () => { await page.click('.topbar [data-act=openSettings]'); await page.click('#setOverlay [data-act=reset]'); await page.waitForSelector('#dlg:not([hidden])'); };
  const intact = async what => assert((await getState(page)).incidents.length > 0, `${what}: data was wiped`);
  const closeAll = async () => { for (let i = 0; i < 3 && await page.evaluate(() => window.__androidBack()); i++); };
  // 1. immediate double tap (no reading delay): ignored by the arming window
  await openReset();
  await doubleTap(page, '#dlgOk');
  await intact('immediate double tap');
  eq(await txt(page, '#dlgTitle'), 'למחוק את כל הנתונים?', 'still on step 1');
  await closeAll();
  // 2. taps 150 ms apart (4 taps) after reading
  await openReset(); await page.waitForTimeout(700);
  const [x, y] = await center(page, '#dlgOk');
  for (let i = 0; i < 4; i++) { await page.touchscreen.tap(x, y); await page.waitForTimeout(150); }
  await page.waitForTimeout(300);
  await intact('4 taps 150 ms apart');
  await closeAll();
  // 3. keyboard: confirm step 1 with Enter, then auto-repeat Enter for 1.2 s
  await openReset(); await page.waitForTimeout(700);
  await page.focus('#dlgOk');
  for (let i = 0; i < 30; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(40); }
  await intact('Enter auto-repeat');
  await closeAll();
  // 4. back during the arming window of step 2 cancels safely
  await openReset(); await page.waitForTimeout(700);
  await page.click('#dlgOk');
  eq(await page.evaluate(() => window.__androidBack()), true, 'back handled during step-2 arming');
  assert(await page.locator('#dlg').isHidden(), 'step 2 cancelled by back');
  await intact('back during arming');
});
test('undo import: data set aside by an undo (incl. entries made after the import) is not deleted silently when the 7 days end', 'R2-5 (round 3): sheet promises "לא יימחקו … יישמרו במקומם"', async t => {
  const page = await t.open({ state: richState(3) });
  await page.click('.topbar [data-act=openSettings]');
  await page.setInputFiles('#importFile', fileFrom('b.json', JSON.stringify(richState(5))));
  await answer(page, true);
  await page.waitForFunction(() => document.querySelector('#setOverlay').hidden);
  await page.clock.setSystemTime(NOW + 2 * DAY);
  await go(page, 'incident');
  await page.click('#tab-incident [data-field=actions][data-val="מכה"]');
  await page.fill('#incNote', 'נרשם אחרי הייבוא');
  await page.click('#tab-incident [data-act=saveIncident]');
  await page.clock.setSystemTime(NOW + 6 * DAY);
  await page.click('.topbar [data-act=openSettings]');
  await page.click('#setOverlay [data-act=undoImport]');
  await answer(page, true);                             // the sheet promised the current data "לא יימחקו"
  await page.waitForFunction(() => document.querySelector('#setOverlay').hidden);
  await page.clock.setSystemTime(NOW + 8 * DAY);        // one day after the undo
  await page.click('.topbar [data-act=openSettings]');
  const kept = await page.evaluate(k => (localStorage.getItem(k + '-prev') || '').includes('נרשם אחרי הייבוא'), KEY);
  assert(kept || await page.locator('#setOverlay [data-act=undoImport]').count() === 1, 'the incident logged after the import was deleted with the expired undo slot, one day after an undo that promised to keep it');
});
test('stars: restarting the program does not re-award stars that were already rewarded in the old program week', 'R2-3 (round 3)', async t => {
  const stars = [...Array(15)].map((_, i) => ({ goalId: 'g1', ts: NOW - 3600e3 - i * 60e3 }));   // earned (and celebrated) this week
  const page = await t.open({ state: makeState({ settings: { startDate: startForWeek(5), starsNeeded: 15 }, stars, celebrated: { 5: 15 } }) });
  await setSettings(page, { sStart: addDaysKey(TODAY, 7) });
  await addStar(page, 'g1');
  assert(!(await visible(page, '#celOverlay')), 'the same 15 stars trigger a second celebration and reward after the restart');
});

/* ================================================================== *
 * 20. Round-3 fixes: set-aside slot, celebrated rebuild, tap-guard fallback
 * ================================================================== */
async function importAndUndo(page, child = 'רותי') {
  await page.click('.topbar [data-act=openSettings]');
  const b = richState(5); b.settings.childName = child;
  await page.setInputFiles('#importFile', fileFrom('b.json', JSON.stringify(b)));
  await answer(page, true);
  await page.waitForFunction(() => document.querySelector('#setOverlay').hidden);
  await page.click('.topbar [data-act=openSettings]');
  await page.click('#setOverlay [data-act=undoImport]');
  await answer(page, true);
  await page.waitForFunction(() => document.querySelector('#setOverlay').hidden);
}
test('undo slot: data set aside by an undo is kept beyond 7 days and can be discarded only via a danger confirm', 'R3-1', async t => {
  const page = await t.open({ state: richState(3) });
  await importAndUndo(page);
  eq(JSON.parse(await page.evaluate(k => localStorage.getItem(k + '-prev-at'), KEY)).kind, 'set-aside', 'slot tagged set-aside');
  await page.clock.setSystemTime(NOW + 30 * DAY);
  await page.click('.topbar [data-act=openSettings]');
  eq(await page.locator('#setOverlay [data-act=undoImport]').count(), 1, 'still offered (redo) after 30 days');
  assert((await txt(page, '#setOverlay')).includes('נשמרים עד שתחזירו אותם או תמחקו אותם'), 'copy explains the slot is kept');
  await page.click('#setOverlay [data-act=discardSetAside]');
  await page.waitForSelector('#dlg:not([hidden])');
  eq(await txt(page, '#dlgTitle'), 'למחוק את הנתונים שהוסטו?', 'discard confirm');
  assert((await page.getAttribute('#dlgOk', 'class')).includes('danger-solid'), 'danger styled');
  await answer(page, false);
  assert(await page.evaluate(k => !!localStorage.getItem(k + '-prev'), KEY), 'cancel keeps the set-aside data');
  await page.click('#setOverlay [data-act=discardSetAside]');
  await answer(page, true);
  eq(await page.evaluate(k => [localStorage.getItem(k + '-prev'), localStorage.getItem(k + '-prev-at')], KEY), [null, null], 'discarded');
  eq(await page.locator('#setOverlay [data-act=undoImport], #setOverlay [data-act=discardSetAside]').count(), 0, 'buttons gone');
  eq((await getState(page)).settings.childName, 'דני', 'current data untouched');
});
test('undo slot: a new import while data is set aside warns that the set-aside data will be replaced', 'R3-1', async t => {
  const page = await t.open({ state: richState(3) });
  await page.click('.topbar [data-act=openSettings]');
  await page.setInputFiles('#importFile', fileFrom('a.json', JSON.stringify(richState(4))));
  await page.waitForSelector('#dlg:not([hidden])');
  assert(!(await txt(page, '#dlgBody')).includes('שהוסטו'), 'no warning without a set-aside slot');
  await answer(page, false);
  await page.click('#setOverlay [data-act=closeSettings]');
  await importAndUndo(page);
  await page.click('.topbar [data-act=openSettings]');
  await page.setInputFiles('#importFile', fileFrom('c.json', JSON.stringify(richState(6))));
  await page.waitForSelector('#dlg:not([hidden])');
  const body = await txt(page, '#dlgBody');
  assert(body.includes('הנתונים שהוסטו בצד') && body.includes('יוחלפו'), 'import sheet warns: ' + body);
  await answer(page, false);
  eq(JSON.parse(await page.evaluate(k => localStorage.getItem(k + '-prev'), KEY)).settings.childName, 'רותי', 'cancelled import keeps the set-aside data');
});
test('stars: a start-date change rebuilds "celebrated" – buckets already at the target stay celebrated, others do not', 'R3-2', async t => {
  const start = startForWeek(5);
  const stars = [...Array(15)].map((_, i) => ({ goalId: 'g1', ts: tsIn(start, 2, 1, '12:00') + i * 60e3 }))   // old week 2: 15 (rewarded)
    .concat([...Array(3)].map((_, i) => ({ goalId: 'g2', ts: NOW - 3600e3 + i * 60e3 })));                // this week: 3
  const page = await t.open({ state: makeState({ settings: { startDate: start, starsNeeded: 15 }, stars, celebrated: { 2: 15, 4: 15 } }) });
  await setSettings(page, { sStart: addDaysKey(start, -7) });     // everything shifts one week later
  eq((await getState(page)).celebrated, { 3: 15 }, 'the full bucket (now week 3) stays celebrated; stale entries are gone; week 6 (3/15) is not');
  assert((await txt(page, '#tab-today .pill.blue')).includes('3/15'), 'current week shows 3/15');
});
test('tap guards: without CSS animations the JS fallback still arms the sheet and drops the shield after 450 ms', 'R3 robustness', async t => {
  const init = () => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '*,*::before,*::after{animation:none !important}'; document.head.appendChild(st); });
  const page = await t.open({ state: makeState({ incidents: [inc(NOW - 3600e3)] }), init });
  await go(page, 'incident');
  await page.click('#tab-incident details summary');
  await page.click('#tab-incident [data-act=delIncident]');
  await page.waitForSelector('#dlg:not([hidden])');
  await page.waitForTimeout(700);                       // real time passes, but no animation runs
  const ok = await center(page, '#dlgOk'), nav = await center(page, 'nav.bottom [data-tab=progress]');
  await page.touchscreen.tap(...ok);
  eq((await getState(page)).incidents.length, 1, 'still guarded before the fallback timer');
  await page.clock.runFor(460);                         // the 450 ms JS fallback fires
  await page.touchscreen.tap(...ok);
  await page.waitForSelector('#dlg', { state: 'hidden' });
  eq((await getState(page)).incidents.length, 0, 'armed by the fallback: the confirm works');
  await page.touchscreen.tap(...nav);
  eq(await page.evaluate(() => S.ui.tab), 'incident', 'shield swallows the follow-up tap');
  await page.clock.runFor(460);
  await page.touchscreen.tap(...nav);
  eq(await page.evaluate(() => S.ui.tab), 'progress', 'shield removed by the fallback');
});

/* ------------------------------------------------------------------ *
 * Runner
 * ------------------------------------------------------------------ */
module.exports = { makeState, richState, progressFixture, inc, tsJ, keyJ, startForWeek, NOW, TODAY, KEY, APP };
if (require.main === module) (async () => {
  const filters = process.argv.slice(2).map(s => s.toLowerCase());
  const selected = filters.length ? tests.filter(t => filters.some(f => t.name.toLowerCase().includes(f))) : tests;
  browser = await pw.chromium.launch();
  let pass = 0, fail = 0;
  const failures = [];
  const t0 = Date.now();
  for (const [i, tc] of selected.entries()) {
    const t = { ctxs: [], pages: [], remote: [] };
    t.open = opts => open(t, opts);
    const start = Date.now();
    let err = null;
    try {
      await Promise.race([tc.fn(t), new Promise((_, rej) => setTimeout(() => rej(new Error('test timeout (90s)')), 90e3))]);
      const pe = t.pages.flatMap(p => p.errors);
      if (pe.length) throw new AssertionError('console / page errors:\n      ' + [...new Set(pe)].slice(0, 5).join('\n      '));
    } catch (e) { err = e; }
    if (err && SHOTS && t.pages.length) {
      try { fs.mkdirSync(SHOTS, { recursive: true }); await t.pages[t.pages.length - 1].screenshot({ path: path.join(SHOTS, `fail-${String(i + 1).padStart(2, '0')}.png`) }); } catch (e) { /* page may be closed */ }
    }
    for (const c of t.ctxs) await c.close().catch(() => {});
    const ms = Date.now() - start;
    const n = String(i + 1).padStart(2, '0');
    if (!err) { pass++; console.log(`PASS ${n} ${tc.name} (${ms} ms)`); }
    else {
      fail++;
      const msg = err instanceof AssertionError ? err.message : (err.stack || String(err)).split('\n').slice(0, 3).join('\n      ');
      failures.push({ n, name: tc.name, spec: tc.spec, msg });
      console.log(`FAIL ${n} ${tc.name} (${ms} ms)\n      spec: ${tc.spec}\n      ${msg}`);
    }
  }
  await browser.close();
  console.log('\n' + '='.repeat(70));
  console.log(`SUMMARY: ${selected.length} tests, ${pass} passed, ${fail} failed  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  failures.forEach(f => console.log(`  ✗ ${f.n} ${f.name}`));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
