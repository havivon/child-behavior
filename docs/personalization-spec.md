# רגוע וחזק – Personalization by age & family position

**Author:** UI/UX design · **For:** the engineer (implementation), QA and the client (Hebrew review)
**Based on:** `index.html` at `634705e`, which includes the explanations feature from `acbea8a` (the `INFO` object and info sheets). Functions and constants named below exist in that version.

Today the app assumes the brief's child: **10 years old, the eldest of 7**. This spec turns that into a profile the parents set:
- **age** (4–14)
- **number of children** (1–12)
- **his position** (1 = eldest … N = youngest)

Content then follows that profile everywhere. The child is still addressed in the masculine singular, as before (no gender field).

---

## 1. Data model, validation, migration

### 1.1 New `settings` fields
| Field | Type | Valid | Meaning |
|---|---|---|---|
| `childAge` | integer \| `null` | 4–14 | age in whole years |
| `siblingsCount` | integer \| `null` | 1–12 | children in the family, **including him** |
| `birthOrder` | integer \| `null` | 1 … `siblingsCount` | 1 = eldest, N = youngest. Always 1 when N = 1 |
| `profileReview` | boolean | – | `true` → show the one-time Today prompt (§6.4) |
| `miniReward` | `{ on: boolean, every: int 1–10, text: string ≤ 60 }` | – | optional daily mini-reward (§4.4) |

Plus, per day: `days[k].mini: boolean` (that day's mini-reward was already announced).

`defaults()`: `childAge: null, siblingsCount: null, birthOrder: null, profileReview: false, miniReward: { on: false, every: 3, text: 'פרס קטן להיום' }`.

### 1.2 `normalize()` rules (stored data **and** imports)
```js
const toInt = v => (typeof v === 'number' && Number.isInteger(v)) ? v
                 : (typeof v === 'string' && /^\d{1,2}$/.test(v.trim())) ? Number(v) : null;
let age = toInt(rs.childAge);       if (age === null || age < 4 || age > 14) age = null;
let n   = toInt(rs.siblingsCount);  if (n === null || n < 1 || n > 12) n = null;
let pos = toInt(rs.birthOrder);     if (pos === null || pos < 1) pos = null;
if (n === 1) pos = 1;
if (n !== null && pos !== null && pos > n) pos = null;      // inconsistent → ask again
let review = rs.profileReview === true;
if (st.onboarded && (age === null || n === null || pos === null)) {
  // legacy install or legacy backup: keep today's behaviour, ask gently
  if (age === null) age = 10;
  if (n === null)   n = 7;
  if (pos === null) pos = 1;
  review = true;
}
st.childAge = age; st.siblingsCount = n; st.birthOrder = pos; st.profileReview = review;
// miniReward
const mr = isObj(rs.miniReward) ? rs.miniReward : {};
st.miniReward = { on: mr.on === true, every: clamp(toInt(mr.every) ?? 3, 1, 10),
                  text: (typeof mr.text === 'string' && mr.text.trim()) ? mr.text.trim().slice(0, 60) : 'פרס קטן להיום' };
// days: d.days[k].mini = v.mini === true
```
- **Result:** every install that is already onboarded becomes **10 / 7 / 1** with `profileReview: true`. Nothing it shows changes until the parents edit the profile. The same applies to importing an old backup.
- Not onboarded: the fields stay `null`, and onboarding requires them (§6.1).
- `saveSettings()` always writes valid integers and sets `profileReview = false`.

### 1.3 The single helper: `profile()`
**All** personalised code reads the profile through this helper. Nothing reads `settings.childAge` and the other fields directly.
```js
const BANDS = ['4-6', '7-9', '10-12', '13-14'];
function profile() {
  const st = S.settings;
  const age = Number.isInteger(st.childAge) ? st.childAge : 10;
  const n   = Number.isInteger(st.siblingsCount) ? st.siblingsCount : 7;
  const pos = n === 1 ? 1 : clamp(Number.isInteger(st.birthOrder) ? st.birthOrder : 1, 1, n);
  const band = age <= 6 ? '4-6' : age <= 9 ? '7-9' : age <= 12 ? '10-12' : '13-14';
  const role = n === 1 ? 'only' : pos === 1 ? 'eldest' : pos === n ? 'youngest' : 'middle';
  const sibs = n - 1;
  return { age, band, n, pos, role, sibs,
           sib: sibs === 0 ? 's0' : sibs === 1 ? 's1' : 's2',  // wording: none / exactly one / several
           large: n >= 5, older: pos - 1, younger: n - pos };
}
const pick = (map, key) => (map && Object.prototype.hasOwnProperty.call(map, key)) ? map[key] : map.default;
```
Variant tables below use these keys: **band** (`4-6`, `7-9`, `10-12`, `13-14`), **role** (`only`, `eldest`, `middle`, `youngest`) and **sib** (`s0` none, `s1` exactly one sibling, `s2` two or more). "default" means the current text, unchanged.

### 1.4 Mid-program changes
- **Content follows the profile immediately.** Everything is derived at render time. After saving, `rerender()` covers the open tab. The guide, the sheets, the Calm tab and Today all read `profile()` on their next render.
- **History is never touched.** Stored incidents keep their values (e.g. target "אח / אחות" for a now-only child) and are counted in Progress as before. Stars, `celebrated`, moods and days are unchanged. `starsNeeded`, goals and the reward never change automatically (§4).
- **The game of the day can change** when the age changes, because the pool changes (§2.2). That's acceptable; the change is visible only on Today.
- **A running exercise keeps the timings it started with.** `startEx()` resolves `exDef(id)` once.
- **An incident draft in progress:** if a selected chip value is no longer offered (e.g. "אח / אחות" after the family is set to 1 child), drop it from the draft on the next `renderIncident()`, so no invisible value is saved.

---

## 2. Stop games by age

### 2.1 Age tags (add `ages: [min, max]` to each games entry in `INFO`)
| id | Game | Ages | Why |
|---|---|---|---|
| `colorword` | צבע-מילה | 5–14 | three colour rules need some memory |
| `freeze` | תופסת קפואה | 4–12 | feels childish to teens |
| `jenga` | ג׳נגה על זמן | 6–14 | fine motor skills; 6+ on the box |
| `headshoulders` | ראש-כתפיים הפוך | 4–11 | |
| `traffic` | רמזור | 4–9 | |
| `simon` | שמעון אומר | 4–10 | |
| `drum` | תיפוף ועצירה | 4–14 | rhythm works at any age |
| `chess` | שחמט או דמקה | 7–14 | checkers from ~7, chess later |
| `delaygame` | אתגר דחיית סיפוק | 4–14 | durations by band (§3.4) |
| `roleplay` | משחק תפקידים: משפט העצירה | 6–14 | |
| **`turtle`** (new) | 🐢 מרוץ צבים | 4–8 | |
| **`lions`** (new) | 🦁 אריות ישנים | 4–8 | |
| **`target`** (new) | 🎯 קליעה עם עצירה | 7–14 | keeps the teen pool varied |

**Pool size per age** (must be ≥ 6). ✅ all pass:

| Age | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Games | 8 | 9 | 11 | 13 | 13 | 11 | 10 | 9 | 8 | 7 | 7 |

### 2.2 Rotation
```js
const gamesFor = p => GAMES.filter(g => { const [a, b] = INFO[g.id].ages; return p.age >= a && p.age <= b; });
const gameOfDay = (d = new Date()) => { const pool = gamesFor(profile());
  return pool[Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5) % pool.length]; };
```
Append the 3 new ids to `GAMES` (`[..., 'turtle', 'lions', 'target']`) and to `INFO_GROUPS.games.ids`.
**Dictionary (guide):** in the games group, list the games that fit his age first. The others follow below a small sub-heading "למשחקים בגילים אחרים", each with a muted pill `גילים 4–8`. The group counter shows the number of suitable games. Guide phase p3 lists only suitable games (§5.3).

### 2.3 New games content (same structure as the other `INFO` entries)

#### 🐢 מרוץ צבים · `turtle` · ages 4–8
- **מה זה:** מרוץ הפוך: כולם יוצאים יחד, ומי שמגיע אחרון לקו הסיום – מנצח. אסור לעצור לגמרי, רק לזוז לאט-לאט.
- **למה זה עוזר:** כדי לזוז לאט כשהגוף רוצה לרוץ, צריך לשלוט בו בכל רגע. זה תרגול מצחיק של האטה – בדיוק מה שצריך כשמתחילים לכעוס.
- **איך משחקים:**
  1. מסמנים קו התחלה וקו סיום, במרחק כמה צעדים.
  2. "היכון, הכן, צב!" – כולם מתחילים לזוז לאט מאוד.
  3. מי שעוצר לגמרי או רץ – חוזר להתחלה.
  4. מי שמגיע אחרון מנצח, ומתחילים סיבוב חדש.
- **טיפ:** זוזו גם אתם לאט, בהגזמה ועם קול של צב – הצחוק הוא חלק מהאימון.
- **קשור:** `stopgame`, `freeze`

#### 🦁 אריות ישנים · `lions` · ages 4–8
- **מה זה:** שוכבים על הרצפה כמו אריות ישנים, בלי לזוז ובלי לצחוק. ההורה מנסה "להעיר" את האריות במילים מצחיקות – בלי לגעת.
- **למה זה עוזר:** לשכב בשקט כשמישהו מנסה להצחיק – זה אימון בשליטה בגוף ובדחף, ובסוף גם מרגיע.
- **איך משחקים:**
  1. נשכבים בנוח ועוצמים עיניים.
  2. ההורה מספר בדיחות או עושה קולות – בלי לגעת.
  3. מי שזז או צוחק מתחיל סיבוב חדש. אם משחקים כמה ילדים, הוא מצטרף "להעיר" את השאר.
  4. מתחילים בדקה אחת, ומאריכים בהדרגה.
- **טיפ:** מתאים מאוד לסוף יום עמוס או לפני השינה – המשחק נגמר כשכולם כבר באמת רגועים.
- **קשור:** `stopgame`, `corner`

#### 🎯 קליעה עם עצירה · `target` · ages 7–14
- **מה זה:** זורקים כדור לסל, לדלי או למטרה – אבל לפני כל זריקה עוצרים, נושמים פעם אחת ומכוונים.
- **למה זה עוזר:** הדחף הוא לזרוק מהר. העצירה הקצרה לפני כל זריקה מלמדת שחשיבה של שנייה משפרת את התוצאה – במשחק וגם בכעס.
- **איך משחקים:**
  1. בוחרים מטרה: סל, דלי, קופסה או חישוק.
  2. לפני כל זריקה: עוצרים, נושמים, מכוונים – ורק אז זורקים.
  3. משווים סבב "מהיר" לסבב "עם עצירה" – באיזה מהם קלע יותר?
  4. מתחלפים, ומעודדים גם החטאות.
- **טיפ:** לגדולים אפשר להפוך את זה לאתגר אישי: כמה קליעות מתוך 10 – ולשבור את השיא של עצמו.
- **קשור:** `stopgame`, `stop`

---

## 3. Calm tools & exercises by age

### 3.1 Exercise timings (`EXS`, per band)
7–9, 10–12 and 13–14 use the **current** timings. Only 4–6 changes.

| Tool | 4–6 | 7–9 · 10–12 · 13–14 (current) |
|---|---|---|
| balloon | 3 in / 4 out × 6 (42 s) | 4 / 6 × 6 (60 s) |
| candle | 3 / 4 × 6 (42 s) | 4 / 6 × 6 (60 s) |
| box | **simplified** 3-3-3-3 × 3 (36 s) | 4-4-4-4 × 4 (64 s) |
| robot | 4 tense / 4 release × 3 (24 s) | 5 / 5 × 3 (30 s) |
| wall | 6 s push + 4 s breath × 1 | 10 + 4 × 1 |
| stop sentence | 4 s per word × 2 | 3 s × 2 |
| morning breathing | balloon 3/4 × **17** = 119 s ≈ **2 min** | balloon 4/6 × 18 = **3 min** |

Implementation: `const EXS_BAND = { '4-6': {...}, '13-14': {...} }`, holding full `steps` arrays and `cycles` for the tools that change. `exDef(id) = { ...EXS[id], ...(EXS_BAND[p.band]?.[id] || {}) }`, and `startEx()` uses `exDef(id)`. `startMorning()` uses `cycles: p.band === '4-6' ? 17 : 18`. Add a helper `morningMin = () => profile().band === '4-6' ? 2 : 3`.

Step texts (`t`) per band. The `label` field stays as today: שואפים / נושפים / מחזיקים / מחכים / מכווצים / משחררים / דוחפים / נושמים.

| Tool · step | 4–6 | 13–14 |
|---|---|---|
| balloon · in | שואפים מהאף… הבטן גדלה כמו בלון | שאיפה איטית מהאף… הבטן מתרחבת |
| balloon · out | נושפים לאט… פשששש | נשיפה ארוכה מהפה… הכתפיים יורדות |
| candle · in | מריחים פרח… | שאיפה איטית מהאף… |
| candle · out | נושפים לאט על הנר – שלא יכבה | נשיפה ארוכה ושקטה – כמו להזיז להבה בלי לכבות |
| box · 4 steps | שואפים… / מחזיקים קצת… / נושפים… / מחכים… | (current) |
| robot · tense | רובוט! 🤖 גוף קשה-קשה | מכווצים את כל השרירים – אגרופים, כתפיים, פנים |
| robot · release | ספגטי! 🍝 גוף רך-רך | משחררים הכול – כבד ורפוי |
| wall · push | ידיים על הקיר – ודוחפים חזק-חזק! 💪 | ידיים על הקיר – ודוחפים בכל הכוח |
| wall · release | עוזבים… ונושמים | עוזבים… ונושמים עמוק |

### 3.2 Tile names, icons and subtitles (`TOOLS`, per band)
| id | 4–6 | 7–12 | 13–14 |
|---|---|---|---|
| balloon | 🎈 נשימת בלון · הבטן מתנפחת ומתרוקנת | (current) | 🌬️ **נשימת בטן** · נשימה איטית לבטן |
| candle | (current) | (current) | (current) |
| box | 🟦 נשימת קובייה · **3 – 3 – 3 – 3** | (current) | (current) |
| robot | (current) | (current) | 💪 **כיווץ ושחרור** · מכווצים ומשחררים |
| wall | 🧱 לדחוף את הקיר · **6 שניות בכל הכוח** | (current) | (current) |
| stop | (current) | (current) | (current) |

The `EXS` titles follow the same names and icons. `INFO[id].title` and `icon` follow `TOOLS` through the band overrides (§3.5), so the tile, the sheet, the dictionary and the aria-label ("מה זה נשימת בטן?") all agree.

### 3.3 Mood → tools for 4–6
Holding the breath is hard for a furious 4–6-year-old. For band `4-6` only, `MOODS.red.tools = ['stop', 'wall', 'balloon']` and `MOODS.orange.tools = ['wall', 'balloon', 'robot', 'stop']`. The box stays in the "כל הכלים" grid in its 3-3-3-3 form.

### 3.4 Delay-of-gratification durations
| Band | Wait |
|---|---|
| 4–6 | from 1 minute, gradually up to ~3 minutes (sand timer) |
| 7–9 | from 5 minutes, up to ~10 |
| 10–12 | from 10 minutes, gradually longer (current) |
| 13–14 | days: saving pocket money for a purchase, a bigger reward at the end of the week |

### 3.5 `INFO` band overrides (calm tools, routine, concepts, games)
**Mechanism:** `info(id)` returns the merged entry: base `INFO[id]` → `INFO_BAND[band][id]` → `INFO_SIB[sib][id]` (§5.5). Merge rules:
- Fields **replace**.
- `how` may be an object `{ index: text }` that replaces single steps (0-based).
- A value may be a function `p => string` (used for counts).

**Every read of `INFO[...]` in the app must go through `info()`.** That includes `infoContent`, `infoActionBtn`, the info sheet, the dictionary, the Today game box and the aria-labels.

**`INFO_BAND['4-6']`**
| id | field | text |
|---|---|---|
| balloon | kid | אתה מנפח בלון בבטן, ואז מוציא את האוויר לאט – פשששש. |
| balloon | how {1} | שואפים מהאף 3 שניות – היד עולה כשהבטן מתנפחת. |
| balloon | how {2} | נושפים לאט מהפה 4 שניות – היד יורדת כשהבלון מתרוקן. |
| balloon | how {3} | חוזרים 6 פעמים, פחות מדקה. בבוקר – 2 דקות. |
| candle | kid | אתה מריח פרח, ואז נושף לאט-לאט על הנר – שלא יכבה. |
| candle | how {1} | מריחים פרח: שואפים לאט מהאף, 3 שניות. |
| candle | how {2} | נושפים על הנר בעדינות, 4 שניות – שהלהבה רק תרקוד. |
| box | kid | אתה נושם כמו ריבוע: שואף, מחזיק קצת, נושף ומחכה. |
| box | what | נשימה בארבעה שלבים קצרים של 3 שניות: שואפים, מחזיקים קצת, נושפים ומחכים – כמו לצייר ריבוע קטן. |
| box | how (all) | 1. שואפים מהאף וסופרים לאט עד 3. · 2. מחזיקים את האוויר קצת – עד 3. · 3. נושפים מהפה – עד 3. · 4. מחכים רגע – עד 3. · 5. עושים 3 סבבים. אפשר לצייר באצבע ריבוע על השולחן תוך כדי. |
| box | tip | אם החזקת האוויר לא נוחה לו, דלגו עליה – בגיל הזה שאיפה ונשיפה איטיות מספיקות. |
| robot | kid | אתה רובוט קשה-קשה, ואז ספגטי רך-רך. |
| robot | what | משחק הרפיה: 4 שניות "רובוט" – מכווצים את כל הגוף חזק, ואז 4 שניות "ספגטי" – משחררים הכול ונהיים רכים. 3 סבבים. |
| robot | how {1} | "רובוט!" – אגרופים קפוצים, כתפיים למעלה, פנים מכווצות, 4 שניות. |
| robot | how {2} | "ספגטי!" – משחררים הכול: ידיים רפויות, כתפיים למטה, 4 שניות. |
| wall | kid | אתה דוחף את הקיר חזק-חזק, ואז נח ונושם. |
| wall | what | עומדים מול קיר, ידיים ישרות על הקיר, ודוחפים בכל הכוח 6 שניות. אחר כך עוזבים ונושמים עמוק. |
| wall | how {2} | דוחפים בכל הכוח 6 שניות – כאילו מזיזים את הקיר. |
| stop | kid | כשאתה כועס: עוצר, נושם, חושב – ובוחר. |
| stop | how {2} | באפליקציה כל מילה נדלקת ל-4 שניות, בשני סבבים. |
| morning | what | פותחים את היום ב-2 דקות של נשימת בלון ביחד, ואז שואלים: "איפה אתה במדחום?" – ירוק, צהוב, כתום או אדום. |
| morning | how {1} | לוחצים "התחילו 2 דקות נשימה" ונושמים יחד: 3 שניות שאיפה, 4 שניות נשיפה. |
| move | what | שעה ויותר ביום של משחק בתנועה, עדיף בחוץ: ריצה, מגלשות, כדור, קפיצות ואופניים. |
| move | how {3} | אפשר לחלק: חצי שעה אחרי הגן ועוד חצי שעה לפני הערב. |
| thermo | how {0} | מסבירים את ארבעת הצבעים בזמן רגוע, ומציירים יחד מדחום עם פרצופים לתלות על המקרר. |
| one | how {2} | הוא בוחר את הפעילות – למשל משחק על הרצפה, בנייה בקוביות, ציור או ספר. |
| delaygame | what | מציעים בחירה: פרס קטן עכשיו, או כפול אם מחכים דקה אחת. מאריכים בהדרגה, עד כמה דקות. |
| delaygame | how {1} | מציעים: "אחד עכשיו, או שניים אם תחכה עד שהשעון יצלצל." |
| delaygame | how {2} | מפעילים טיימר שהוא רואה – שעון חול או טיימר בטלפון – ונותנים לו משהו לעשות בינתיים. |
| delay | how {0} | מתחילים בהמתנות קצרות מאוד: "עוד דקה ונתחיל." |

**`INFO_BAND['7-9']`**
| id | field | text |
|---|---|---|
| one | how {2} | הוא בוחר את הפעילות – למשל משחק קופסה, לגו, כדור בחצר או בישול של משהו פשוט. |
| delaygame | what | מציעים בחירה: פרס קטן עכשיו, או כפול אם מחכים 5 דקות. מאריכים בהדרגה, עד 10 דקות. |
| delaygame | how {1} | מציעים: "אחד עכשיו, או שניים אם תחכה 5 דקות." |

**`INFO_BAND['10-12']`**
| id | field | text |
|---|---|---|
| one | how {2} | הוא בוחר את הפעילות – למשל משחק קלפים או קופסה, אופניים, בישול או פרויקט קטן ביחד. |

**`INFO_BAND['13-14']`** (mature tone: no "babyish" images, and privacy matters)
| id | field | text |
|---|---|---|
| balloon | title · icon | נשימת בטן · 🌬️ |
| balloon | kid | נשימה איטית לבטן – הדרך הכי מהירה להוריד את הלחץ בגוף, ואף אחד לא צריך לראות שאתה עושה את זה. |
| balloon | what | נשימה עמוקה לבטן: שואפים לאט מהאף והבטן מתרחבת, ואז נושפים לאט מהפה – ארוך יותר מהשאיפה. |
| balloon | tip | בהתחלה מתרגלים בשכיבה עם יד על הבטן, ואחר כך בישיבה – כך אפשר לעשות את זה גם בכיתה, בלי שאף אחד ישים לב. |
| candle | kid | שאיפה איטית ונשיפה ארוכה ושקטה – הנשיפה הארוכה היא מה שמאט את הגוף. |
| box | kid | 4 שניות שאיפה, 4 החזקה, 4 נשיפה, 4 המתנה – טכניקה שגם ספורטאים משתמשים בה לפני רגע לחוץ. |
| robot | title · icon | כיווץ ושחרור · 💪 |
| robot | kid | מכווצים את כל השרירים חזק, ואז משחררים – והמתח יוצא מהגוף. |
| robot | what | תרגיל הרפיה: 5 שניות מכווצים את כל השרירים חזק, ואז 5 שניות משחררים הכול. 3 סבבים. |
| robot | how {1} | מכווצים: אגרופים קפוצים, כתפיים למעלה, פנים מכווצות – 5 שניות. |
| robot | how {2} | משחררים הכול: ידיים רפויות, כתפיים למטה – 5 שניות. |
| robot | tip | מתאים גם לפני מבחן או משחק חשוב – ואפשר לעשות אותו בישיבה, בלי שאף אחד יראה. |
| wall | kid | דוחפים קיר בכל הכוח 10 שניות – מוציאים את האנרגיה של הכעס בלי לפגוע באף אחד. |
| stop | kid | כשהכעס עולה: עוצר, נושם, חושב – ובוחר מה לעשות. אתה מחליט, לא הכעס. |
| morning | what | פותחים את היום ב-3 דקות של נשימה איטית, ואז שואלים: "איפה אתה במדחום?" – ירוק, צהוב, כתום או אדום. |
| morning | tip | אם הוא לא רוצה לנשום ביחד – זה בסדר. הציעו לו לעשות את זה לבד, עם אוזניות, ורק שאלו על המדחום. |
| bed | what | לפני השינה שואלים: "מה הצלחת היום?", מוצאים יחד לפחות הצלחה אחת, ומסיימים בשיחה קצרה או בקריאה. |
| bed | how {4} | מסיימים בשיחה קצרה, בקריאה או בשיר – מה שהוא אוהב. |
| corner | what | מקום שקט משלו – בחדר או בפינה בבית – שהוא בוחר, ואליו הוא הולך כדי להירגע. זה לא עונש: לא שולחים אליו – מציעים. |
| corner | how {1} | ממלאים אותו יחד: אוזניות ומוזיקה שמרגיעה אותו, כדור לחץ, מחברת, משהו לשתות. |
| thermo | tip | יש מתבגרים שמעדיפים מספר מ-1 עד 10 על פני צבעים – אפשר להשתמש בשניהם. |
| praise | tip | מתבגרים נבוכים משבחים בקול. שבח קצר בפרטיות, או הודעה בטלפון, עובדים טוב יותר. |
| one | how {2} | הוא בוחר את הפעילות – למשל הליכה או נסיעה קצרה, בישול, משחק מחשב ביחד או קניות קטנות. שיחות טובות קורות דווקא כשעושים משהו ביחד. |
| stopgame | what | משחק קצר שבו צריך לעצור, לחכות או לכוון לפני שפועלים – כמו ג׳נגה על זמן או קליעה עם עצירה. בכל יום האפליקציה מציעה משחק אחר. |
| stopgame | how {3} | משבחים כל עצירה מוצלחת: "יפה, עצרת וחשבת לפני הזריקה." |
| delaygame | what | מציעים בחירה: משהו קטן עכשיו, או משהו גדול יותר בעוד כמה ימים – למשל לחסוך דמי כיס לקנייה. מאריכים בהדרגה. |
| delaygame | how {0} | בוחרים יחד מטרה שהוא באמת רוצה: משחק, בגד או יציאה. |
| delaygame | how {1} | מציעים: "אפשר משהו קטן עכשיו, או לחכות לסוף השבוע ולקבל משהו גדול יותר." |
| delaygame | how {2} | עוקבים יחד אחרי ההתקדמות – בטבלה, בצנצנת חיסכון או באפליקציה. |
| delay | how {0} | מתחילים בהמתנות שהוא בוחר: לחכות לסוף השבוע לפני קנייה, או לסיים משימה לפני הטלפון. |

**"איך להסביר לו"** (item 7 of the brief) uses the `kid` field, so the tables above already cover it. For 7–9 and 10–12 the current child lines fit and stay.

---

## 4. Star chart by age (defaults and suggestions only)

### 4.1 Band defaults
| Band | `starsNeeded` default | Suggested range | Daily mini-reward at onboarding | Default goals (onboarding only) | Weekly reward suggestion |
|---|---|---|---|---|---|
| 4–6 | **8** | 6–10 | **on**, every 3 stars, "מדבקה או עוד סיפור לפני השינה" | שומר על ידיים לעצמו · הולך לפינת הרגיעה כשהוא כועס | יציאה לגינה עם אבא או אמא |
| 7–9 | **12** | 10–14 | off | (current) | (current) בחירת פעילות מיוחדת עם אבא או אמא |
| 10–12 | **15** | 12–18 | off | (current) | (current) |
| 13–14 | **15** | 12–20 | off | מדבר בכבוד גם כשהוא כועס · לוקח הפסקה כשהוא מתעצבן | יציאה או חוויה משותפת שהוא בוחר |

### 4.2 Rules (never override the parent)
- **Onboarding:** when an age chip is chosen, any star field the parent hasn't touched (per-field dirty flag) takes the band default. That covers the stars stepper, the goals, the reward and the mini-reward. A touched field is never changed.
- **Settings, after onboarding:** if the band changes, nothing changes on its own. Under the stars stepper show the hint `מומלץ לגיל הזה: 6–10 כוכבים בשבוע` (from the table) and a small `btn ghost` labelled **"להחיל"**. The button only fills the stepper, and the parent still taps "שמירה". The hint is shown only when the current value is outside the suggested range.
- The goals and reward are never auto-replaced after onboarding.

### 4.3 Today star card copy
No change, except for the mini-reward line (§4.4).

### 4.4 Daily mini-reward (optional, any age; default on only for 4–6 at onboarding)
- **Settings** (in the stars card):
  - A switch row: **"פרס קטן יומי"** (a checkbox styled as a switch, 44px row).
  - When it's on: a stepper **"כל כמה כוכבים ביום?"** (1–10, default 3), and a text field **"מה הפרס הקטן?"** (≤ 60 characters, placeholder `מדבקה, עוד סיפור, 10 דקות משחק`).
- **Today** (stars card, under the weekly progress bar), when it's on: `פרס קטן להיום: <b>${k}</b>/${every} כוכבים` (`k` = stars earned today, capped at `every`).
- When `k` first reaches `every` that day: `days[today].mini = true`, haptic `success`, and a toast `🎈 הגיע הזמן לפרס הקטן: ${text}!`. Then the line reads `הפרס הקטן של היום הורווח 🎈`. It doesn't use the full celebration overlay.
- It never touches the weekly count or `celebrated`.

---

## 5. Family position (sibling role)

### 5.1 The role chapter (replaces "👑 הבכור מתוך 7" in `renderGuide()`)
Same card pattern and eyebrow `פרק מיוחד`. Title by role (digits for N and X):

| role | Title |
|---|---|
| eldest | 👑 הבכור מתוך ${n} |
| middle | 🧩 הילד האמצעי (מקום ${pos} מתוך ${n}) |
| youngest | 🌱 הצעיר מתוך ${n} |
| only | ⭐ ילד יחיד |

**Eldest** (the existing 7 points, kept; the `s1` column applies when there is exactly one sibling)
| # | Item | Text (s2, current) | s1 variant |
|---|---|---|---|
| 1 | 🗓️ זמן אישי קבוע | זמן קבוע (עדיף יומי) שהוא רק שלו – בלי אחים. כתוב ביומן, ולא מבטלים. | …שהוא רק שלו – בלי האח או האחות. כתוב ביומן, ולא מבטלים. |
| 2 | 🙅 בכור ולא שמרטף | עזרה – כן. אחריות של הורה על האחים – לא. | עזרה – כן. אחריות של הורה על האח או האחות – לא. |
| 3 | 🎖️ זכויות של גדול | לצד האחריות – זכויות: שעת שינה מאוחרת יותר, יותר בחירה, פעילות שרק גדולים עושים. | (same) |
| 4 | 🔒 מקום נעול לחפצים שלו | ארגז או מגירה עם מנעול שהאחים לא נוגעים בהם. פחות "לקחו לי!". | ארגז או מגירה עם מנעול, שרק הוא פותח. פחות "לקחו לי!". |
| 5 | ⚖️ לא להשוות | לא "תראה איך אחותך..." ולא "אתה הגדול, תהיה דוגמה" ברגע של כעס. | (same) |
| 6 | 🛡️ הגנה על האחים והפרדה | מזהים מצבים מועדים (מעברים, ערב, מסכים) ומפרידים מראש: חדרים שונים, פעילות נפרדת. | title: 🛡️ הגנה והפרדה · text: (same) |
| 7 | 🧭 תפקיד מנהיגות שהוא בוחר | הוא בוחר מרשימה: מדריך משחק לקטנים, אחראי על המוזיקה בנסיעה... מנהיגות חיובית במקום שתלטנות. | …מדריך משחק לאח הקטן, אחראי על המוזיקה בנסיעה… |

**Middle**
1. **🗓️ זמן אישי קבוע** – ילד אמצעי נבלע בקלות בין הגדולים לקטנים. זמן קבוע שהוא רק שלו – כתוב ביומן, ולא מבטלים.
2. **🪪 משהו שהוא רק שלו** – לא "הגדולים" ולא "הקטנים": תחביב, תפקיד או פינה שמזוהים רק איתו.
3. **⚖️ שיפוט הוגן** – מול הגדולים הוא הקטן, ומול הקטנים הוא הגדול. בודקים מה קרה, ולא מניחים מראש מי אשם.
4. **🙅 לא להשוות** – לא "תראה איך אחיך הגדול..." ולא "אתה כבר גדול, תוותר לקטן" ברגע של כעס.
5. **🔒 מקום לחפצים שלו** – ארגז או מגירה משלו, שהגדולים לא לוקחים והקטנים לא מפרקים.
6. **🛡️ הגנה והפרדה** – מזהים מצבים מועדים (מעברים, ערב, מסכים) ומפרידים מראש: חדרים שונים, פעילות נפרדת.
7. **🧭 תפקיד שהוא בוחר** – הוא בוחר מרשימה: מארגן משחק משפחתי, אחראי על המוזיקה בנסיעה… גם הוא מוביל לפעמים.

**Youngest**
1. **🗓️ זמן אישי קבוע** – גם לצעיר צריך זמן קבוע רק שלו, בלי הגדולים. כתוב ביומן, ולא מבטלים.
2. **🌱 לתת לו לעשות לבד** – לא "התינוק של הבית": משימות ואחריות שמתאימות לגילו, ושבח על כל צעד של עצמאות.
3. **⚖️ לא מגינים עליו אוטומטית** – גם הצעיר יכול להכאיב. בודקים מה קרה, ולא מניחים מראש שהגדולים אשמים.
4. **📢 שיהיה לו קול** – בבית עם ילדים גדולים קשה להישמע. מקשיבים עד הסוף, ומדי פעם נותנים לו את המילה הראשונה בשיחה משפחתית.
5. **🙅 לא להשוות** – לא "בגיל שלך אחותך כבר..." ולא "אתה הקטן, תוותר" ברגע של כעס.
6. **🚧 החינוך – אצל ההורים** – האחים הגדולים לא מתגרים בו ולא "מחנכים" אותו. גבולות ותוצאות – רק מכם.
7. **🧭 תפקיד אמיתי** – תפקיד שבו הוא מוביל: מחלק את הקינוח, בוחר משחק משפחתי, אחראי על האכלת חיית המחמד.

s1 variants (exactly one sibling, older than him): replace "הגדולים" with "האח הגדול או האחות הגדולה" in items 1 and 3, and "האחים הגדולים" with "האח הגדול או האחות הגדולה" in item 6. Item 4 becomes: "בבית עם אח או אחות גדולים קשה להישמע. מקשיבים עד הסוף, ומדי פעם נותנים לו את המילה הראשונה בשיחה משפחתית." Item 6 then reads: "האח הגדול או האחות הגדולה לא מתגרים בו ולא "מחנכים" אותו. גבולות ותוצאות – רק מכם."

**Only child**
1. **🗓️ זמן איכות קבוע** – גם כשההורים זמינים יותר, זמן קבוע ומתוכנן רק בשבילו – בלי טלפון ובלי מטלות – שווה זהב.
2. **🤝 לתרגל עם ילדים אחרים** – בלי אחים בבית, את התור, השיתוף וההפסד מתרגלים עם חברים, בני דודים ובחוגים. מזמינים חבר אחד בכל פעם.
3. **🎲 להפסיד גם בבית** – לא מוותרים לו במשחקים. הפסד בבית, ליד מבוגר רגוע, הוא האימון הכי בטוח.
4. **⏳ לחכות לתור** – בבית עם ילד אחד הכול מגיע מהר. תרגלו המתנה בכוונה: "עוד דקה אחת, ואז נמשיך."
5. **🧒 ילד, לא מבוגר קטן** – הוא לא שותף לדאגות של המבוגרים ולא שופט בין ההורים.
6. **🙅 לא להשוות** – לא "תראה איך הבן של השכנים..." ברגע של כעס.
7. **🧭 תפקיד אחריות** – תפקיד אמיתי בבית שהוא בוחר, כדי שירגיש שהוא תורם ולא רק מקבל.

### 5.2 Large-family card (N ≥ 5)
A separate card placed right after the role chapter: eyebrow `פרק מיוחד`, title **`👨‍👩‍👧‍👦 משפחה גדולה (${n} ילדים)`**.
1. **📅 לוח תורות קבוע** – מי בוחר משחק, מי יושב ליד החלון, מי ראשון באמבטיה – כתוב ותלוי במקום שכולם רואים. פחות ויכוחים על "זה לא הוגן!".
2. **🕐 זמן אישי לכל ילד** – גם 10 דקות בשבוע לכל ילד, בתורנות קבועה בין ההורים, עושות הבדל.
3. **🧭 מעברים מוכנים מראש** – בוקר, יציאה וערב הם השעות הקשות. מכינים מראש בגדים ותיקים, ומקטינים את מספר הילדים באותו חדר.
4. **🧺 משימה לפי גיל לכל ילד** – לכל ילד משימה קטנה שמתאימה לגילו, ואף אחד לא "העוזר הקבוע" של ההורים.
5. **🤝 לבקש עזרה** – סבים, שכנים, חוג או צהרון. כל שעה של עזרה מפנה זמן לילד שזקוק לו עכשיו. לבקש עזרה זה לא כישלון.

### 5.3 Guide phases (`renderGuide()` body texts) by band and sibling count
| Where | Variant | Text |
|---|---|---|
| p1 😴 שינה | by **age**: 4–5 | כמה שעות הוא ישן? בגיל ${age} צריך בערך 10–13 שעות שינה ביממה, כולל שנת צהריים אם יש. עייפות היא דלק לכעס. |
| | 6–12 | כמה שעות הוא ישן? בגיל ${age} צריך בערך 9–12 שעות שינה בלילה. עייפות היא דלק לכעס. |
| | 13–14 | כמה שעות הוא ישן? בגיל ${age} צריך בערך 8–10 שעות שינה בלילה – ומסכים בחדר בלילה הם גורם נפוץ לחוסר שינה. עייפות היא דלק לכעס. |
| p1 📱 מסכים | 4–6 | כמה זמן ביום, ומה קורה כשמכבים? בגיל הזה מומלץ עד בערך שעה ביום של תוכן איכותי, ועדיף ביחד איתכם. מודיעים 5 דקות לפני שמכבים. |
| | 7–9 | כמה זמן ביום, ומה קורה כשמכבים? קובעים מראש מתי וכמה, והמסך לא בא על חשבון שינה, תנועה וארוחות. בלי מסכים בשעה שלפני השינה. |
| | 10–12 | כמה זמן ביום, ומה קורה כשמכבים? מסכמים יחד כללים ברורים, ובלילה הטלפון נטען מחוץ לחדר. המעבר ממסך הוא טריגר נפוץ – מודיעים 5 דקות לפני. |
| | 13–14 | כמה זמן ביום, ומה קורה כשמכבים? קובעים כללים יחד איתו – מתי, כמה, ואיפה הטלפון בלילה – וכך קל לו יותר לעמוד בהם. שימו לב גם למשחקים ולרשתות שמשאירים אותו מתוח. |
| p2 🏃 פריקת אנרגיה יומית | 4–6 | שעה ויותר ביום של משחק בתנועה, עדיף בחוץ: ריצה, מגלשות, כדור, קפיצות. גוף עייף = פחות פיצוצים. |
| | 13–14 | 30–60 דקות ביום: ריצה, אופניים, כדורסל, אימון. גוף עייף = פחות פיצוצים. |
| p2 🎈 תרגילי נשימה | 4–6 | נשימת בלון ונר, ונשימת קובייה בגרסה קצרה. מתרגלים כשרגועים – כדי שיעבדו כשכועסים. |
| | 13–14 | title 🌬️ תרגילי נשימה · נשימת בטן, נר וקובייה. מתרגלים כשרגועים – כדי שיעבדו כשכועסים. |
| p2 🛋️ פינת רגיעה – לא פינת עונש | 13–14 | title **🎧 מקום שקט משלו – לא עונש** · מקום שהוא בוחר: החדר, אוזניות ומוזיקה, כדור לחץ. הולכים אליו כדי להירגע – לא נשלחים אליו כעונש. |
| p3 games list | all | built from `gamesFor(p)`: one line per suitable game, existing lines kept. New lines: 🐢 מרוץ צבים – "מי שמגיע אחרון מנצח. מאמן האטה ושליטה בגוף." · 🦁 אריות ישנים – "שוכבים בלי לזוז כשמנסים להצחיק. מאמן שליטה בדחף." · 🎯 קליעה עם עצירה – "עוצרים ונושמים לפני כל זריקה. מאמן חשיבה לפני פעולה." |
| p3 ⏳ אתגר דחיית סיפוק | 4–6 | פרס קטן עכשיו או כפול אחרי דקה. מאריכים בהדרגה, עד כמה דקות. |
| | 7–9 | פרס קטן עכשיו או כפול אחרי 5 דקות. מאריכים בהדרגה, עד 10 דקות. |
| | 13–14 | משהו קטן עכשיו או גדול יותר בעוד כמה ימים – למשל חיסכון לקנייה. |
| p3 🧩 פרויקט איטי | 4–6 | פאזל של 50–100 חלקים או בנייה בקוביות לאורך כמה ימים. מאמן התמדה וסבלנות. |
| | 7–9 | לגו או פאזל של 200–300 חלקים, שבונים לאורך כמה ימים. מאמן התמדה וסבלנות. |
| | 10–12 | (current) לגו גדול או פאזל 500 חלקים… |
| | 13–14 | דגם להרכבה, פאזל 1000 חלקים, או פרויקט בישול או יצירה לאורך כמה ימים. מאמן התמדה וסבלנות. |
| p5 ✌️ בחירה בין שתיים | 4–6 | במקום פקודה: "קודם פיג׳מה או קודם צחצוח שיניים?" – שליטה אמיתית, בתוך הגבולות שלכם. |
| | 13–14 | במקום פקודה: "מתי נוח לך לסדר את החדר – לפני האימון או אחריו?" – שליטה אמיתית, בתוך הגבולות שלכם. |
| p5 🔑 תפקיד אחריות אמיתי | 4–6 | משהו שבאמת חשוב לבית: מסדר את הנעליים בכניסה, עוזר לערוך את השולחן, מאכיל את חיית המחמד עם הורה. |
| | 7–9 | משהו שבאמת חשוב לבית: אחראי על הצמחים, מוציא את המיחזור, עוזר להכין סלט. לא עבודה שחורה. |
| | 13–14 | משהו שבאמת חשוב לבית: מכין ארוחה פשוטה פעם בשבוע, אחראי על משימה קבועה, עוזר בתיקונים עם כלים אמיתיים. לא עבודה שחורה. |
| p5 💙 זמן אחד-על-אחד | s2 (current) / s1 / s0 | 15 דקות ביום שבהן הוא מוביל. בלי טלפון, **{בלי אחים / בלי האח או האחות / בלי מטלות}**, בלי ביקורת. Then append the band ideas from §3.5 `one how{2}` without "הוא בוחר את הפעילות – " (e.g. "רעיונות: משחק על הרצפה, בנייה בקוביות, ציור או ספר."). |
| p5 ⚽ משחקי צוות | 4–6 | משחקים שיתופיים פשוטים: בונים מגדל ביחד, פאזל משותף – כולם מנצחים או מפסידים יחד. |
| p5 💭 שאלות אמפתיה | s1, s2 | (current) "איך לדעתך הרגיש אחיך כש...?" – בזמן רגוע, לא מיד אחרי אירוע. |
| | s0 | "איך לדעתך הרגיש החבר שלך כש...?" – בזמן רגוע, לא מיד אחרי אירוע. |
| | 4–6 (any sib) | "איך הוא הרגיש, לדעתך? שמח? עצוב? כועס?" – בזמן רגוע, ובעזרת ציורים של פרצופים. |
| p5 🧑‍🤝‍🧑 מפגש משחק עם חבר אחד | 4–6 | חבר אחד, כשעה, בבית. פעילות מוכנה מראש והורה ממש קרוב. מסיימים כשעוד טוב. |
| | 7–9, 10–12 | (current) |
| | 13–14 | title 🧑‍🤝‍🧑 מפגש עם חבר · חבר אחד או שניים סביב פעילות שהוא בוחר – ספורט, משחק, בישול. הורה בבית אבל לא מעל הראש, ושעת סיום ידועה מראש. |
| 5 כללי יסוד #3 | s0 | שבח ספציפי על התנהגות: "ראיתי שחיכית בסבלנות לתור שלך – זה היה בוגר." |
| מתי לפנות · list item | 4–6 | קשיים במסגרת החינוכית (גן, חוגים). |
| מתי לפנות · callout + Progress `.pro` card | 4–6 | …אפשר לפנות לשפ״ח (השירות הפסיכולוגי החינוכי) דרך הגן או בית הספר… |

### 5.4 The rest of the app (not `INFO`, not the guide)
| # | Where | Rule | Text |
|---|---|---|---|
| 1 | `CHECKS.morning.title` | 4–6 / 13–14 | `2 דקות נשימת בלון` / `3 דקות נשימת בטן` |
| 2 | Morning button: `renderToday()` and `infoActionBtn()` label | all | `התחילו ${morningMin()} דקות נשימה` |
| 3 | `finishEx()` (morning flow) | all | `סיימתם ${morningMin()} דקות נשימה. המשימה סומנה בסדר היום.` |
| 4 | `CHECKS.move.title` / `.sub` | 4–6 | `שעה של משחק בתנועה` / `ריצה, מגלשות, כדור, קפיצות – פריקת אנרגיה.` |
| | | 13–14 | title (current) / `ריצה, אופניים, כדורסל, אימון – פריקת אנרגיה.` |
| 5 | `CHECKS.one.sub` | s1 / s0 | `רק הוא והורה, בלי האח או האחות. הוא בוחר את הפעילות.` / `רק הוא והורה, בלי טלפונים. הוא בוחר את הפעילות.` |
| 6 | `CHECKS.bed.title` | 13–14 | `"מה הצלחת היום?" ושיחה קצרה` (`CHECK_ARIA.bed` follows: `הסבר: "מה הצלחת היום?" ושיחה קצרה`) |
| 7 | Today praise card `.sub` | s0 | `שבח ספציפי וחם, מיד כשרואים – למשל: "ראיתי שחיכית בסבלנות לתור שלך". היעד: 5 ביום.` |
| 8 | `INC.trigger` "אח לקח לו משהו" | s0 | not offered. Offer **`ילד אחר לקח לו משהו`** instead (a new stored value; the trigger analysis counts it as its own row) |
| 9 | `INC.target` "אח / אחות" | s0 | not offered (old data still shows in the list and in "מול מי") |
| 10 | `INC.response` "הגנו על האח" | s0 | offered as **`הרחקנו את מי שהיה לידו`** (a new stored value; responses are not aggregated) |
| 11 | `protocolHTML()` step 1, bullet 2 | eldest | (current) **קודם להגן על האח הקטן** – להרחיק אותו מהמקום. |
| | | middle, youngest | **קודם להגן על האח שנפגע** – להרחיק אותו מהמקום. |
| | | only | **קודם בטיחות** – להרחיק מהמקום את מי שעלול להיפגע, ואת מה שאפשר לזרוק. |
| 12 | `protocolHTML()` h3 #2 | s1 / s0 | `אחרי שנרגע – בפרטיות, לא מול האח או האחות` / `אחרי שנרגע – בפרטיות, בלי קהל` |
| 13 | `protocolHTML()` "לתת שם לרגש" example | 4–6 (s1, s2) | "היית ממש כועס כשהוא לקח לך את הצעצוע." |
| | | 13–14 (s1, s2) | "היית ממש כועס כשהוא נכנס לך לחדר בלי לשאול." |
| | | s0, 4–12 | "היית ממש כועס כשהיה צריך להפסיק לשחק." |
| | | s0, 13–14 | "היית ממש כועס כשביקשתי לכבות את המחשב." |
| 14 | `protocolHTML()` "להציע כלי" | 13–14 | **להציע כלי, בלי לחץ:** "רוצה ללכת לקיר?" או "בוא ננשום רגע ביחד". |
| 15 | `TOOLS` (box/wall subtitles, balloon/robot names and icons) | §3.2 | – |
| 16 | `EXS` titles, step texts, timings | §3.1 | – |
| 17 | `MOODS.red/orange.tools` | 4–6 | §3.3 |
| 18 | `defaults()` and the onboarding star fields | §4 | – |
| 19 | `INFO.move` how {3} "אחרי בית הספר" | 4–6 | §3.5 (`אחרי הגן`) |

Not affected (checked): MOODS messages, VENT, the mood labels, the celebration, the hero/phase tips, the incident actions and durations, Progress (except the `.pro` callout, 5.3), settings and backup copy, the welcome text, and the default rules.

### 5.5 `INFO` sibling overrides (`INFO_SIB`)
Applied after the band override. Only the `s0` and `s1` keys exist; `s2` is the base text.

**`INFO_SIB.s0`** (only child)
| id | field | text |
|---|---|---|
| freeze | tip | שתפו חברים או בני דודים כשאפשר, ותנו לו להיות זה שמפעיל את המוזיקה. |
| roleplay | what | מדמים מצב מעצבן – חבר לוקח משהו, מפסידים במשחק – ומתרגלים "עצור – נושם – חושב – בוחר". מתחלפים בתפקידים. |
| roleplay | how {1} | אתם משחקים את החבר, והוא מתרגל לעצור, לנשום, לחשוב ולבחור. |
| roleplay | how {2} | מתחלפים: הוא משחק את החבר, ואתם מראים בחירה טובה – או בחירה גרועה ומצחיקה שהוא מתקן. |
| one | what | 15 דקות ביום שבהן הורה פנוי רק לו – בלי טלפון ובלי מטלות – והוא בוחר מה עושים. |
| one | why | גם כשאין אחים, ימים עמוסים משאירים מעט זמן שבו ההורה באמת פנוי. זמן קבוע שהוא רק שלו נותן לו תשומת לב חיובית, ומפחית את הצורך להשיג אותה בהתנהגות קשה. |
| one | how {1} | מכבים טלפונים ומניחים בצד מטלות – הזמן הזה מוקדש רק לו. |
| repair | why | תיקון מלמד אחריות בלי בושה: "טעיתי, ואני יכול לתקן". הוא גם עוזר למי שנפגע להרגיש שרואים אותו, ומחזיר את השקט בבית. |
| repair | how {0} | מחכים שיירגע, ומדברים בפרטיות – בלי קהל. |
| praise | what | שבח שמתאר בדיוק מה הילד עשה, מיד כשזה קורה. למשל: "ראיתי שחיכית בסבלנות לתור שלך – זה היה בוגר", במקום "כל הכבוד". |
| praise | how {2} | מוסיפים מילה חמה או את ההשפעה: "…וזה עזר לי מאוד." |
| praise | tip | מול אחרים, שבח בלחישה או אגודל למעלה עובד מצוין – בלי להביך אותו. *(13–14: the band tip wins; apply the band override after the sib override for `praise.tip` only, or simply keep the 13–14 tip for every sib value.)* |
| delay | why | ילד שמתאמן בהמתנה לומד להחזיק דחף לרגע – אותה יכולת שהוא צריך כשחבר לוקח לו משהו או כשהוא מפסיד. כמו כל מיומנות, היא משתפרת באימון. |

**`INFO_SIB.s1`** (exactly one sibling)
| id | field | text |
|---|---|---|
| freeze | tip | שתפו גם את האח או האחות, ותנו לו להיות זה שמפעיל את המוזיקה. |
| one | what | 15 דקות ביום שבהן הורה נמצא רק איתו – בלי האח או האחות ובלי טלפון – והוא בוחר מה עושים. |
| one | why | כשיש בבית עוד ילד, קשה לקבל מספיק תשומת לב חיובית. זמן קבוע שהוא רק שלו נותן לו אותה בדרך טובה, ומפחית את הצורך להשיג אותה בהתנהגות קשה. |
| one | how {1} | מכבים טלפונים ומעסיקים את האח או האחות – הורה שני או בייביסיטר יכולים לעזור. |
| repair | why | …הוא גם עוזר לאח שנפגע להרגיש שרואים אותו, ומחזיר את השקט ביניהם. |
| repair | how {0} | מחכים שיירגע, ומדברים בפרטיות – לא מול האח או האחות. |
| praise | tip | מול האח או האחות, שבח בלחישה או אגודל למעלה עובד מצוין – בלי להביך אותו. |

**Base text that depends on family size (s2):**
- `one.why` becomes a function:
  - `p.large`: `בבית עם ${p.n} ילדים קשה לקבל תשומת לב חיובית. זמן קבוע שהוא רק שלו…` (same continuation as today)
  - otherwise: `כשיש בבית עוד ילדים, קשה לקבל מספיק תשומת לב חיובית. זמן קבוע…`
- `freeze.tip` with s2 and role `youngest`: `שתפו גם את האחים הגדולים, ותנו לו להיות זה שמפעיל את המוזיקה.` (today's "האחים הקטנים" is wrong for the youngest). For eldest and middle, keep the current tip.

---

## 6. UI for the new fields

### 6.1 Placement
- **Onboarding:** in the first card, after "איך קוראים לילד?" and **before** "מתי מתחילים?". All three are visible (not under "התאמה אישית") and **required**.
- **Settings:** the same three fields in that card. Add `id="sProfile"` on the age label for deep-linking.

### 6.2 Controls: single-select chips (my call, including for age and count)
| Field | Label | Chips | Notes |
|---|---|---|---|
| Age | **בן כמה הוא?** | `4` `5` … `14` (11 chips) | |
| Children | **כמה ילדים יש במשפחה (כולל אותו)?** | `1` … `12` | |
| Position | **מה המקום שלו?** | `הבכור` `2` `3` … `הצעיר` (N chips) | only when N > 1; for N = 2 just `הבכור` · `הצעיר` |

- Markup: the existing `.chips` with `.chip` buttons, `type="button"`, `aria-pressed`. The group wrapper gets `role="group"` and `aria-labelledby`. Number chips get `.chips.num .chip{min-width:48px;justify-content:center}` (height is already 46px, so the targets are 48 × 46 or more). Position chip aria-labels: `הבכור`, `מקום 3 מתוך 7`, `הצעיר`.
- Caption under the position chips, live (`.sub`, `aria-live="polite"`): `מקום ${pos} מתוך ${n} – הבכור` / `– ילד אמצעי` / `– הצעיר`. When N = 1: `ילד יחיד`.
- A live profile line at the end of the card (`.sub`): `התוכנית תותאם לגיל ${band}, ${roleLabel}${large ? ', משפחה גדולה' : ''}.` The band reads as e.g. `7–9`, so `fixRanges()` handles it; `roleLabel` is ילד יחיד / הבכור / ילד אמצעי / הצעיר.
- **Why chips, not steppers:** one tap, no preselected value (a wrong silent default such as "1 child" would quietly hide the sibling content), and the same component as the incident form. A stepper alternative is in open question 1.

### 6.3 Validation (in `saveSettings()`, before anything is written, like the existing goal check)
| Case | Toast | Focus |
|---|---|---|
| no age | בחרו בן כמה הוא | first age chip |
| no children count | בחרו כמה ילדים יש במשפחה | first count chip |
| N > 1 and no position | בחרו את המקום שלו במשפחה | first position chip |

When the count changes:
- If the current position is now greater than N, clear the position and show `.sub` "המקום שלו השתנה – בחרו שוב" above the position chips.
- If N becomes 1, set the position to 1 and hide the chips.
- If N grows, keep the position. (The eldest stays the eldest; a former "youngest" becomes a middle number, which is shown in the caption.)

### 6.4 The one-time Today prompt (migrated installs, `profileReview === true`)
Placed right after the hero card:
```html
<section class="card nudge" aria-labelledby="nudgeT">
  <div class="spread"><h2 id="nudgeT">✨ התאמה לגיל ולמשפחה</h2>
    <button type="button" class="x-btn" data-act="nudgeDismiss" aria-label="סגירת ההודעה">${ICON.close}</button></div>
  <p>עדכנו גיל ומקום במשפחה כדי להתאים את התוכנית.</p>
  <p class="sub">עד אז התוכנית מותאמת לילד בן 10, הבכור מתוך 7.</p>
  <button type="button" class="btn small" data-act="openProfile">לעדכון</button>
</section>
```
```css
.nudge{background:var(--accent-soft);border-color:transparent}
```
- `openProfile`: `openSettings(false)`, then scroll `#sProfile` into view and focus its first chip.
- `nudgeDismiss`: set `profileReview = false`, save, and re-render.
- Saving settings also clears it.
- It never appears for new installs (they answer during onboarding).

---

## 7. Variant count
| Area | Variants |
|---|---|
| Age bands × derived content | 4 bands |
| Exercise definitions changed per band | 6 tools + morning for 4–6 · text-only changes for 4 tools at 13–14 |
| `INFO` band overrides | 4–6: 30 field overrides · 7–9: 3 · 10–12: 1 · 13–14: 30 |
| `INFO` sibling overrides | s0: 13 · s1: 7 · s2 dynamic: 2 |
| Child lines ("לילד" / "איך להסביר לו") | 6 tools × 3 (4–6, 7–12, 13–14) = 18 |
| New games | 3 (age-tagged; all 13 games tagged) |
| Guide phase texts | 36 band/age/sibling variant rows (§5.3) |
| Role chapters | 4 (eldest + s1 variants, middle, youngest + s1 variants, only) + 1 large-family card |
| App-wide string rules | 19 rules, 25 variant rows (§5.4) |
| Star defaults | 4 band rows + the mini-reward feature |

---

## 8. QA checklist
**Data & migration**
- [ ] An existing onboarded install (no new fields) loads as 10 / 7 / 1 with the Today prompt, and every screen is identical to before.
- [ ] Importing an old backup gives the same result. A backup with `childAge:"9"` (a string) is accepted as 9. `childAge:3`, `15`, `"abc"` or `9.5` → treated as missing → 10 + prompt (onboarded) or asked (not onboarded). `birthOrder > siblingsCount` → position cleared → prompt. `siblingsCount:1` with `birthOrder:4` → 1.
- [ ] A new install: onboarding can't finish without age, count and (N > 1) position. The toasts and focus follow §6.3.
- [ ] The prompt disappears after "לעדכון" + save, or after ✕, and never comes back.

**Profile switching** (every band × role with one data set; history must not change)
- [ ] 4 / 1 child: no "אח / אחות" target chip, no "אח לקח לו משהו" trigger, "ילד אחר לקח לו משהו" shown, "הרחקנו את מי שהיה לידו" shown. Protocol "קודם בטיחות". The role chapter is "⭐ ילד יחיד". There's no large-family card. Old incidents with "אח / אחות" still show in the list and in "מול מי".
- [ ] 5 / 7 children / position 4: "הילד האמצעי (מקום 4 מתוך 7)", the large-family card, and protocol "האח שנפגע".
- [ ] 9 / 2 / 2: "🌱 הצעיר מתוך 2", s1 wording ("האח או האחות") in the protocol, the one-on-one sub and the sheets.
- [ ] 13 / 3 / 1: "נשימת בטן" and "כיווץ ושחרור" on the tiles, sheets, dictionary and aria-labels. Mature child lines. The teen sleep text "8–10". No traffic/simon/freeze/headshoulders/turtle/lions in the rotation or in p3.
- [ ] 4–6: balloon 3/4 × 6, box 3-3-3-3 × 3, robot 4/4, wall 6 s, stop words 4 s. The morning breathing runs ~2 min and every "3 דקות" morning string says 2. Red/orange moods offer balloon, not box.
- [ ] Sleep text per age: 4 → 10–13 with the nap note · 6 → 9–12 · 12 → 9–12 · 13 → 8–10.
- [ ] Game-of-the-day pool is ≥ 6 for each age 4–14 (iterate all ages × 30 days). The chosen game is always age-suitable.

**Stars**
- [ ] Onboarding at age 5 with untouched fields: 8 stars, mini-reward on (3, "מדבקה או עוד סיפור לפני השינה"), 4–6 goals. Touch the stars stepper, then change the age: the value stays.
- [ ] Settings: changing 10 → 5 with 15 stars shows the hint and "להחיל". Nothing changes until "להחיל" + "שמירה".
- [ ] Mini-reward: the 3rd star today → one toast, `days[today].mini = true`, and a 4th star → no second toast. The weekly count and `celebrated` are unaffected.

**General**
- [ ] A running exercise isn't affected by a settings change made in another flow. An incident draft drops values that are no longer offered.
- [ ] All new chips are ≥ 44px, keyboard-operable and announced. Light and dark modes. 360px with no horizontal scroll. Ranges such as "7–9", "8–10" and "10–13" render the right way round (`fixRanges`).

---

## 9. Open questions
1. **Chips vs. steppers.** The brief mentioned steppers. I chose chips for all three fields, so there's no silent wrong default and each answer is one tap. If you prefer steppers for age and count, they need an explicit empty state ("–") in onboarding, and the same validation.
2. **Activity for 4–6.** I changed the checklist item to "שעה של משחק בתנועה". That follows common guidance for young children, which is more than the brief's 30–60 minutes. OK, or keep the brief's number for all ages?
3. **Box breathing at 4–6.** I chose a simplified 3-3-3-3 × 3, kept in the grid, and removed it from the red/orange suggestions. The alternative is hiding it entirely for 4–6.
4. **Twins / same position.** Two children can share a position (e.g. twins who are the eldest). The model takes one number, and the parent picks the closest one. Fine for now?
5. **13–14 renames** ("נשימת בטן", "כיווץ ושחרור"). This means two names per tool across the app. Acceptable, or keep the original names and change only the tone?
6. **Mini-reward for all ages.** The switch is available at every age, and only pre-enabled for 4–6. Confirm, or restrict it to 4–9?
