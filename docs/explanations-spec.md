# רגוע וחזק – Tool explanations: ⓘ sheets + "מילון כלים ומושגים"

**Author:** UI/UX design · **For:** the engineer (implementation) and the client (Hebrew content review)
**Based on:** `index.html` at release 1.0.0 (commit `736cf91`). All selectors and functions named below exist in that version.

The client asked that every tool and practice in the app explain itself, and approved two features:
1. **An ⓘ button** on every Calm-tab tool tile, every Today checklist row and the daily stop game. Tapping it opens an **explanation sheet**.
2. **A "מילון כלים ומושגים" chapter** in the Guide tab, with every tool, stop game and key concept as collapsible entries.

There is **one source of truth**: a single `INFO` object (§2) feeds the sheet and the guide chapter, and it also feeds the Today "המשחק של היום" box. No explanation text is written twice.

---

## 1. Content

Rules I applied to every entry:
- **Parents are addressed in the plural.** Instructions use the impersonal present plural ("שואפים", "מתחילים"), the register the app already uses. Tips use the plural imperative ("הניחו", "תרגלו").
- **The child line is masculine singular** ("אתה…"). It appears only for the 6 calm tools.
- **A fixed structure:** **מה זה** (1–2 sentences) · **למה זה עוזר** (1–2 sentences: plain mechanism, no jargon, no promises) · **איך מלמדים / איך עושים / איך משחקים** (3–5 numbered steps) · **טיפ** (one line).
- **Timings match `EXS` exactly:** balloon 4/6 × 6, candle 4/6 × 6, box 4-4-4-4 × 4, robot 5/5 × 3, wall 10 s push + 4 s breath, stop sentence 4 words × 3 s × 2. The morning breathing is the balloon at 18 cycles (3 minutes).
- **Length:** each entry is 55–110 words, under 30 seconds to read on a phone. Nothing medical and no diagnoses. There are no claims beyond "helps the body slow down" or "practice makes it stronger".
- The **קשור** line lists related entry ids. They show up as "ראו גם" chips. **פעולה** is the sheet's primary button (§4.3).

Entry counts: **6 calm tools · 3 routine practices · 10 stop games · 8 concepts = 27 entries.** The 5 Today checklist rows map to 3 routine entries plus 2 concept entries: the stop-game row opens **משחק עצירה** and the one-on-one row opens **זמן אחד-על-אחד**, so that content isn't written twice (see open question 1).

The format below is strict (one field per bullet). Appendix A is the same content converted to the JS `INFO` object, ready to paste. If the Hebrew is edited here, regenerate or edit Appendix A to match.

### 1.1 כלי רגיעה (Calm tab tiles)

#### 🎈 נשימת בלון · `balloon`
- **לילד:** אתה מנפח את הבטן כמו בלון ומרוקן אותה לאט – והגוף שלך נרגע.
- **מה זה:** נשימה עמוקה לבטן: שואפים מהאף ומרגישים את הבטן מתנפחת כמו בלון, ואז נושפים לאט מהפה עד שהבלון מתרוקן.
- **למה זה עוזר:** כשהנשיפה איטית וארוכה יותר מהשאיפה, הגוף מקבל אות להאט: הלב נרגע והשרירים משתחררים. הדימוי של בלון עוזר להתרכז בבטן ולא בכעס.
- **איך מלמדים:**
  1. יושבים או עומדים בנוח, יד אחת על הבטן.
  2. שואפים מהאף 4 שניות – היד עולה כשהבטן מתנפחת.
  3. נושפים לאט מהפה 6 שניות – היד יורדת כשהבלון מתרוקן.
  4. חוזרים 6 פעמים, בערך דקה. בבוקר – 3 דקות.
  5. באפליקציה העיגול גדל בשאיפה וקטן בנשיפה, ואפשר פשוט לנשום איתו.
- **טיפ:** כשהוא שוכב, הניחו לו בובה קטנה על הבטן ותנו לו לראות אותה עולה ויורדת.
- **קשור:** `morning`, `candle`, `thermo`
- **פעולה:** `ex:balloon`

#### 🕯️ נשימת נר · `candle`
- **לילד:** אתה מריח פרח ונושף על נר בעדינות – שהלהבה תזוז ולא תכבה.
- **מה זה:** נשימה עם דמיון: שואפים לאט מהאף כאילו מריחים פרח, ונושפים בעדינות מהפה כאילו מזיזים להבה של נר – בלי לכבות אותה.
- **למה זה עוזר:** הנר "מבקש" נשיפה איטית ורכה, וזו בדיוק הנשיפה שמרגיעה את הגוף. הדמיון נותן לילד משימה פשוטה שמסיטה את תשומת הלב מהכעס.
- **איך מלמדים:**
  1. מרימים אצבע מול הפה – זה הנר.
  2. מריחים פרח: שואפים לאט מהאף, 4 שניות.
  3. נושפים על הנר בעדינות, 6 שניות – שהלהבה רק תרקוד.
  4. חוזרים 6 פעמים.
- **טיפ:** בפעם הראשונה החזיקו פיסת טישו מול הפה שלו – המטרה שהיא תזוז, לא שתעוף.
- **קשור:** `balloon`, `box`
- **פעולה:** `ex:candle`

#### 🟦 נשימת קובייה · `box`
- **לילד:** אתה נושם בארבעה צעדים של 4: שואף, מחזיק, נושף ומחכה – כמו לצייר ריבוע.
- **מה זה:** נשימה בארבעה שלבים שווים של 4 שניות: שואפים, מחזיקים, נושפים ומחכים – כמו לצייר ריבוע עם הנשימה.
- **למה זה עוזר:** הספירה הקבועה נותנת לראש משהו להתמקד בו, והקצב האחיד מאט את הנשימה. היא מתאימה במיוחד כשהמחשבות רצות מהר.
- **איך מלמדים:**
  1. שואפים מהאף וסופרים לאט עד 4.
  2. מחזיקים את האוויר – עד 4.
  3. נושפים מהפה – עד 4.
  4. מחכים רגע בלי לנשום – עד 4.
  5. עושים 4 סבבים, בערך דקה. אפשר לצייר באצבע ריבוע באוויר תוך כדי.
- **טיפ:** החזקת האוויר צריכה להיות נוחה, בלי מאמץ. אם קשה לו, תרגלו קודם בלי האפליקציה, בספירה של 3.
- **קשור:** `balloon`, `robot`
- **פעולה:** `ex:box`

#### 🤖 רובוט וספגטי · `robot`
- **לילד:** קודם אתה רובוט קשוח ומכווץ, ואז ספגטי רך ורפוי – והמתח יוצא מהגוף.
- **מה זה:** משחק הרפיה: 5 שניות "רובוט" – מכווצים את כל הגוף חזק, ואז 5 שניות "ספגטי" – משחררים הכול ונהיים רכים ורפויים. 3 סבבים.
- **למה זה עוזר:** אחרי כיווץ חזק קל יותר לשרירים להשתחרר, והילד לומד להרגיש את ההבדל בין גוף מתוח לגוף רגוע. זה מתאים במיוחד לילד שקשה לו לשבת בשקט ולנשום.
- **איך מלמדים:**
  1. עומדים או יושבים.
  2. "רובוט!" – אגרופים קפוצים, כתפיים למעלה, פנים מכווצות, 5 שניות.
  3. "ספגטי!" – משחררים הכול: ידיים רפויות, כתפיים למטה, 5 שניות.
  4. חוזרים 3 פעמים.
- **טיפ:** עשו את זה יחד איתו ותגזימו – רובוט קשוח וספגטי מתנדנד. צחוק קטן הוא חלק מההרגעה.
- **קשור:** `wall`, `corner`
- **פעולה:** `ex:robot`

#### 🧱 לדחוף את הקיר · `wall`
- **לילד:** אתה דוחף את הקיר בכל הכוח 10 שניות, ואז עוזב ונושם עמוק. הכעס יוצא, ואף אחד לא נפגע.
- **מה זה:** עומדים מול קיר, ידיים ישרות על הקיר, ודוחפים בכל הכוח 10 שניות. אחר כך עוזבים ונושמים עמוק.
- **למה זה עוזר:** כעס מגיע עם הרבה אנרגיה בגוף. דחיפה חזקה מוציאה אותה דרך השרירים בדרך בטוחה, ואחרי מאמץ חזק הגוף נוטה להשתחרר. זה כלי טוב במיוחד בכתום ובאדום.
- **איך מלמדים:**
  1. עומדים מול קיר, רגל אחת קצת מאחור.
  2. מניחים כפות ידיים על הקיר בגובה הכתפיים, ידיים ישרות.
  3. דוחפים בכל הכוח 10 שניות – כאילו מזיזים את הקיר.
  4. עוזבים, מנערים את הידיים ונושמים עמוק.
  5. אם צריך – עוד סבב.
- **טיפ:** בחרו מראש "קיר כעס" קבוע בבית. כשאתם רואים כתום, מספיק להציע: "בוא לקיר".
- **קשור:** `robot`, `thermo`
- **פעולה:** `ex:wall`

#### ✋ משפט העצירה · `stop`
- **לילד:** כשהכעס עולה, אתה עוצר, נושם, חושב – ובוחר מה לעשות.
- **מה זה:** ארבע מילים שעוצרות רגע לפני מעשה: עצור (הגוף קופא), נושם (נשימה אחת עמוקה), חושב (מה יקרה אם…?), בוחר (דרך מותרת).
- **למה זה עוזר:** בכעס הגוף פועל מהר יותר מהמחשבה. המשפט יוצר הפסקה קצרה בין הדחף למעשה, ובהפסקה הזו אפשר לבחור אחרת. קל לזכור מילים קבועות גם כשקשה.
- **איך מלמדים:**
  1. מלמדים בזמן רגוע, לא באמצע התפרצות.
  2. אומרים יחד בקול, מילה אחרי מילה, עם תנועה: יד עוצרת, נשימה, אצבע לרקה, אגודל למעלה.
  3. באפליקציה כל מילה נדלקת ל-3 שניות, בשני סבבים.
  4. מתרגלים במשחק תפקידים, ורק אז משתמשים ברגע אמת – בשקט ובקצרה.
- **טיפ:** השתמשו במשפט גם בעצמכם, בקול, כשאתם מתעצבנים. ילדים לומדים הכי הרבה ממה שהם רואים.
- **קשור:** `roleplay`, `stopgame`
- **פעולה:** `ex:stop`

### 1.2 סדר היום (Today checklist rows)

#### 🌅 נשימת בוקר ושאלת המדחום · `morning`
- **מה זה:** פותחים את היום ב-3 דקות של נשימת בלון ביחד, ואז שואלים: "איפה אתה במדחום?" – ירוק, צהוב, כתום או אדום.
- **למה זה עוזר:** תרגול בזמן רגוע הופך את הנשימה להרגל, כך שהיא זמינה גם ברגע קשה. השאלה על המדחום מלמדת אותו לשים לב למה שהוא מרגיש לפני שהכעס גדל.
- **איך עושים:**
  1. בוחרים רגע קבוע, למשל לפני ארוחת הבוקר.
  2. לוחצים "התחילו 3 דקות נשימה" ונושמים יחד: 4 שניות שאיפה, 6 שניות נשיפה.
  3. שואלים: "איפה אתה במדחום עכשיו?" ומקבלים כל תשובה בלי ויכוח.
  4. אם הוא בצהוב, בכתום או באדום – שואלים בעדינות מה קרה ומציעים כלי.
  5. בסוף הנשימה המשימה מסומנת בסדר היום מעצמה.
- **טיפ:** גם "אדום" בבוקר הוא תשובה טובה – הוא זיהה את מה שהוא מרגיש. אמרו לו: "תודה שסיפרת".
- **קשור:** `balloon`, `thermo`
- **פעולה:** `act:morningBreath`

#### 🏃 תנועה בחוץ · `move`
- **מה זה:** 30–60 דקות של תנועה פעילה בחוץ בכל יום: ריצה, אופניים, כדור, טיפוס או קפיצה בחבל.
- **למה זה עוזר:** ילד חסר מנוחה צובר הרבה אנרגיה. כשהיא יוצאת במשחק ובתנועה, נשאר פחות "דלק" להתפרצויות, ולרוב גם השינה טובה יותר.
- **איך עושים:**
  1. קובעים זמן קבוע, עדיף אחר הצהריים – לפני השעות המועדות.
  2. נותנים לו לבחור פעילות מתוך 2–3 אפשרויות.
  3. מכוונים למאמץ שגורם להזיע ולהתנשף, לא רק להליכה איטית.
  4. אפשר לחלק: 20 דקות אחרי בית הספר ועוד 20 לפני הערב.
- **טיפ:** הצטרפו מדי פעם. מסירות כדור או מרוץ קצר הם גם זמן איכות איתו.
- **קשור:** `stopgame`

#### 🌙 "מה הצלחת היום?" וסיפור · `bed`
- **מה זה:** לפני השינה שואלים: "מה הצלחת היום?", מוצאים יחד לפחות הצלחה אחת, ומסיימים בסיפור.
- **למה זה עוזר:** גם אחרי יום קשה, הדבר האחרון שהוא שומע הוא משהו טוב שהוא עשה. זה בונה אצלו תחושה של "אני מסוגל", והטקס הקבוע עוזר להירגע לקראת השינה.
- **איך עושים:**
  1. שואלים בקול רך: "מה הצלחת היום?"
  2. אם הוא לא מוצא – עוזרים לו: "ראיתי שהבוקר חיכית לתור שלך."
  3. אפשר להיעזר בשבחים שנרשמו היום ב"תפסתי אותו מתנהג יפה".
  4. לא מדברים עכשיו על האירועים הקשים של היום – יש לזה זמן אחר.
  5. מסיימים בסיפור, גם קצר.
- **טיפ:** ספרו גם אתם על הצלחה קטנה שלכם מהיום – כך זו שיחה ולא מבחן.
- **קשור:** `praise`

### 1.3 משחקי עצירה (order and names exactly as `GAMES`)

#### 🎨 צבע-מילה · `colorword`
- **מה זה:** אומרים צבע, והוא עושה תנועה שסיכמתם מראש – למשל אדום = קופץ, כחול = קופא, ירוק = מסתובב. באמצע מחליפים את החוקים!
- **למה זה עוזר:** הוא צריך להקשיב, לזכור את החוק ולעצור את התגובה הישנה כשהחוקים משתנים. זה אימון לגמישות ולעצירה.
- **איך משחקים:**
  1. מסכימים על 3 צבעים ו-3 תנועות.
  2. קוראים צבעים בקצב איטי, ואז מהר יותר.
  3. אחרי כמה סבבים מחליפים חוק: עכשיו אדום = קופא.
  4. מתחלפים – הוא קורא ואתם זזים.
- **טיפ:** כשהוא מתבלבל, צחקו יחד. הטעויות הן חלק מהכיף ומהאימון.
- **קשור:** `stopgame`, `headshoulders`

#### 🧊 תופסת קפואה · `freeze`
- **מה זה:** רוקדים ומתרוצצים עם מוזיקה. כשהמוזיקה נעצרת – קופאים כמו פסל. מי שזז מחכה סיבוב אחד.
- **למה זה עוזר:** לעצור את הגוף באמצע תנועה ובשיא ההתרגשות – זה בדיוק מה שצריך גם ברגע של כעס.
- **איך משחקים:**
  1. מפעילים מוזיקה קצבית.
  2. עוצרים אותה ברגעים לא צפויים.
  3. כולם קופאים, ומי שזז מחכה סיבוב אחד בצד.
  4. מאריכים בהדרגה את זמן הקפיאה.
- **טיפ:** שתפו גם את האחים הקטנים, ותנו לו להיות זה שמפעיל את המוזיקה.
- **קשור:** `stopgame`, `traffic`

#### 🏗️ ג׳נגה על זמן · `jenga`
- **מה זה:** ג׳נגה רגילה, אבל לכל תור יש 10 שניות. כל אחד בתורו מוציא לבנה ומניח אותה למעלה.
- **למה זה עוזר:** צריך לחכות לתור, לפעול בזהירות תחת לחץ קטן ולהתמודד עם הרגע שבו המגדל נופל. זה תרגול של סבלנות ושל הפסד בכבוד.
- **איך משחקים:**
  1. בונים את המגדל יחד.
  2. מפעילים טיימר של 10 שניות לכל תור.
  3. מי שהפיל אומר "אוף, בפעם הבאה", ובונים מחדש.
- **טיפ:** הפילו גם אתם את המגדל מדי פעם, והדגימו הפסד רגוע.
- **קשור:** `stopgame`, `chess`

#### 🙃 ראש-כתפיים הפוך · `headshoulders`
- **מה זה:** כשאומרים "ראש" נוגעים בכתפיים, וכשאומרים "כתפיים" נוגעים בראש. מאיצים בהדרגה.
- **למה זה עוזר:** הגוף רוצה לעשות את מה שהוא שומע. לעשות הפוך מאמן לעצור תגובה אוטומטית – כמו לעצור יד שרוצה להכות.
- **איך משחקים:**
  1. מתחילים לאט, עם שתי מילים בלבד: ראש וכתפיים.
  2. מאיצים בהדרגה.
  3. מוסיפים זוג חדש: ברכיים ובהונות.
  4. מתחלפים – הוא נותן את ההוראות.
- **טיפ:** התחילו לאט מספיק כדי שיצליח. הצלחה בהתחלה נותנת חשק להמשיך.
- **קשור:** `stopgame`, `colorword`

#### 🚦 רמזור · `traffic`
- **מה זה:** ירוק – הולכים, צהוב – לאט מאוד, אדום – עוצרים במקום. ההורה מחליף צבעים מהר, ולפעמים מנסה לבלבל.
- **למה זה עוזר:** המשחק מאמן להאט ולעצור את הגוף לפי סימן, והצבעים מזכירים את מדחום הרגשות.
- **איך משחקים:**
  1. משחקים במסדרון או בחצר.
  2. קוראים צבעים, או מרימים דפים צבעוניים.
  3. מחליפים מהר יותר ככל שהוא מצליח.
  4. מי שזז באדום חוזר כמה צעדים אחורה.
- **טיפ:** אחרי המשחק אפשר לקשר: "גם בכעס יש צהוב – זה הרגע להאט."
- **קשור:** `thermo`, `freeze`

#### 🗣️ שמעון אומר · `simon`
- **מה זה:** מבצעים הוראה רק אם היא מתחילה ב"שמעון אומר". בסבב השני הוא מוביל – ומתרגל להוביל בהגינות.
- **למה זה עוזר:** צריך להקשיב עד הסוף לפני שפועלים, בדיוק ההפך מתגובה מהירה בלי מחשבה. ההובלה נותנת לו תפקיד חיובי.
- **איך משחקים:**
  1. נותנים הוראות: "שמעון אומר: קפוץ!" – קופצים. "קפוץ!" – לא זזים.
  2. מגבירים את הקצב.
  3. בסבב השני הוא שמעון.
  4. בסוף שואלים: מה היה קשה? מה עזר לך לעצור?
- **טיפ:** כשהוא מוביל, שבחו הובלה הוגנת: "נתת לכולם הזדמנות – ככה נראה מנהיג טוב."
- **קשור:** `stopgame`

#### 🥁 תיפוף ועצירה · `drum`
- **מה זה:** מתופפים על השולחן לפי הקצב של ההורה, ועוצרים בדיוק ברגע שההורה עוצר.
- **למה זה עוזר:** הוא צריך להקשיב, לעקוב ולעצור ברגע. זה אימון קצר לשליטה בתנועה, שגם פורק אנרגיה.
- **איך משחקים:**
  1. מתופפים קצב פשוט, והוא מחקה.
  2. עוצרים פתאום – והוא עוצר מיד.
  3. משנים קצב: מהר, לאט, חזק, חלש.
  4. מתחלפים בתפקידים.
- **טיפ:** אפשר לתופף גם על הברכיים – בהמתנה לאוטובוס או לפני ארוחה.
- **קשור:** `stopgame`

#### ♟️ שחמט או דמקה · `chess`
- **מה זה:** משחק אחד בלי למהר. לפני כל מהלך אומרים בשקט: "עצור, חושב, בוחר". מסיימים בלחיצת יד.
- **למה זה עוזר:** משחקי חשיבה מלמדים לעצור ולחשוב לפני שזזים, ולהפסיד בלי להתפרץ. ההפסד קורה בתוך משחק – מקום בטוח לתרגל אותו.
- **איך משחקים:**
  1. בוחרים משחק שהוא מכיר, או לומדים יחד את החוקים.
  2. לפני כל מהלך אומרים: "עצור, חושב, בוחר".
  3. בסוף לוחצים ידיים, לא משנה מי ניצח.
  4. משבחים כל הפסד רגוע.
- **טיפ:** הדגימו הפסד יפה בקול: "אוף, הפסדתי. היה משחק טוב – בפעם הבאה."
- **קשור:** `stop`, `jenga`

#### 🍬 אתגר דחיית סיפוק · `delaygame`
- **מה זה:** מציעים בחירה: פרס קטן עכשיו, או כפול אם מחכים 10 דקות. מאריכים את זמן ההמתנה בהדרגה.
- **למה זה עוזר:** הוא מתאמן להחזיק דחף ולבחור ב"אחר כך" – אותה יכולת שעוזרת לו לעצור כשהוא כועס.
- **איך משחקים:**
  1. בוחרים פרס קטן ואהוב: ממתק, מדבקה או 5 דקות משחק.
  2. מציעים: "אחד עכשיו, או שניים אם תחכה 10 דקות."
  3. מפעילים טיימר שהוא רואה, ונותנים לו משהו לעשות בינתיים.
  4. עומדים בהבטחה מיד כשהטיימר מצלצל.
- **טיפ:** אם הוא בחר "עכשיו" – זה בסדר. בלי ביקורת; מנסים שוב מחר.
- **קשור:** `delay`

#### 🎭 משחק תפקידים: משפט העצירה · `roleplay`
- **מה זה:** מדמים מצב מעצבן – אח לוקח משהו, מפסידים במשחק – ומתרגלים "עצור – נושם – חושב – בוחר". מתחלפים בתפקידים.
- **למה זה עוזר:** אחרי שמתרגלים רגע קשה כמה פעמים בזמן רגוע, קל יותר לבחור נכון גם ברגע אמת – כמו חזרה לפני הצגה.
- **איך משחקים:**
  1. בוחרים מצב אמיתי שקורה בבית.
  2. אתם משחקים את האח, והוא מתרגל לעצור, לנשום, לחשוב ולבחור.
  3. מתחלפים: הוא משחק את האח, ואתם מראים בחירה טובה – או בחירה גרועה ומצחיקה שהוא מתקן.
  4. בסוף שואלים יחד: איזו בחירה עבדה הכי טוב?
- **טיפ:** שמרו על אווירה קלילה ומצחיקה, ואל תתרגלו מיד אחרי אירוע אמיתי.
- **קשור:** `stop`

### 1.4 מושגים

#### 🌡️ מדחום הרגשות · `thermo`
- **מה זה:** סולם של ארבעה צבעים שעוזר לילד לתאר כמה הרגש חזק: ירוק – רגוע, צהוב – מתעצבן, כתום – כועס, אדום – עומד להתפוצץ.
- **למה זה עוזר:** קשה לעצור כעס כשהוא כבר באדום. כשהילד לומד לזהות "צהוב", אפשר להשתמש בכלי בזמן, לפני הפיצוץ. הצבעים נותנים לכם שפה משותפת, בלי מילים מסובכות.
- **איך מלמדים:**
  1. מסבירים את ארבעת הצבעים בזמן רגוע, עם דוגמאות מהחיים שלו.
  2. שואלים כמה פעמים ביום: "איפה אתה במדחום?"
  3. מדגימים בעצמכם: אומרים בקול כשאתם בצהוב, ומה אתם עושים כדי להירגע.
  4. בלשונית "רגיעה" הוא בוחר צבע ומקבל כלים שמתאימים לו.
- **טיפ:** אין צבע "רע". גם אדום הוא מידע – שבחו אותו על כך שזיהה.
- **קשור:** `balloon`, `corner`

#### 🛋️ פינת רגיעה · `corner`
- **מה זה:** פינה נעימה בבית שהילד בוחר ומעצב, ואליה הוא הולך כדי להירגע. זו לא פינת עונש: לא שולחים אליה – מזמינים אליה.
- **למה זה עוזר:** מקום שקט ומוכר עוזר לגוף להירגע מהר יותר. כשזו בחירה שלו ולא עונש, הוא לומד שלהירגע זה כוח, לא השפלה.
- **איך עושים:**
  1. בוחרים מקום יחד: פינה בחדר, מתחת לשולחן, ליד חלון.
  2. ממלאים אותה יחד: כרית, שמיכה, כדור לחץ, דפים וצבעים, ספר אהוב.
  3. מתרגלים ללכת אליה כשהוא בירוק, כדי שתהיה מוכרת.
  4. ברגע קשה מציעים: "רוצה ללכת לפינה שלך?" – ולא "לך לפינה!".
  5. הוא חוזר כשהוא מוכן, ואז משבחים אותו.
- **טיפ:** אחד היעדים בטבלת הכוכבים יכול להיות "משתמש בפינת הרגיעה" – כוכב על כל פעם שהלך אליה בעצמו.
- **קשור:** `thermo`, `robot`

#### 🛑 משחק עצירה · `stopgame`
- **מה זה:** משחק קצר ומצחיק שבו צריך לעצור, לחכות או לעשות הפוך ממה שהגוף רוצה – כמו תופסת קפואה או רמזור. בכל יום האפליקציה מציעה משחק אחר.
- **למה זה עוזר:** עצירה היא מיומנות שמתחזקת באימון, כמו שריר. כשמתרגלים אותה בכיף ובלי לחץ, קל יותר להשתמש בה גם בכעס.
- **איך עושים:**
  1. מקדישים 10–15 דקות, עדיף באותה שעה בכל יום.
  2. משחקים את "המשחק של היום" מכרטיס "סדר היום", או כל משחק אחר מהרשימה.
  3. מתחילים לאט וקל, ומקשים בהדרגה.
  4. משבחים כל עצירה מוצלחת: "וואו, קפאת בדיוק בזמן!"
  5. כשמפסידים – מתרגלים גם הפסד בכבוד.
- **טיפ:** תנו לו להוביל סבב. ילדים שאוהבים לשלוט נהנים להיות "השופט" – וזה מלמד להוביל בהגינות.
- **קשור:** `freeze`, `roleplay`

#### 💙 זמן אחד-על-אחד · `one`
- **מה זה:** 15 דקות ביום שבהן הורה נמצא רק איתו – בלי אחים ובלי טלפון – והוא בוחר מה עושים.
- **למה זה עוזר:** בבית עם שבעה ילדים קשה לקבל תשומת לב חיובית. זמן קבוע שהוא רק שלו נותן לו אותה בדרך טובה, ומפחית את הצורך להשיג אותה בהתנהגות קשה.
- **איך עושים:**
  1. קובעים שעה קבועה ומכריזים: "זה הזמן שלנו".
  2. מכבים טלפונים ומרחיקים את האחים – הורה שני או בייביסיטר יכולים לעזור.
  3. הוא בוחר את הפעילות, בתוך גבולות סבירים.
  4. משתתפים, מתארים ומתלהבים – בלי לתקן, בלי שאלות מבחן ובלי ביקורת.
  5. מסיימים בזמן ובחיוך: "נהניתי איתך. מחר נמשיך."
- **טיפ:** לא מבטלים את הזמן הזה כעונש. הוא קורה גם אחרי יום קשה – ודווקא אז.
- **קשור:** `praise`

#### ⚖️ תוצאה הגיונית · `consequence`
- **מה זה:** תגובה של ההורה למעשה לא מקובל, שקשורה ישירות למעשה, קצרה ובגודל מתאים. למשל: שבר – עוזר לתקן; היכה במשחק – המשחק נגמר להיום.
- **למה זה עוזר:** כשהתוצאה קשורה למעשה, הילד מבין את הקשר בין מה שעשה למה שקרה, ולא מרגיש שמענישים אותו סתם. תוצאה קצרה מאפשרת גם להתחיל מחדש מהר.
- **איך עושים:**
  1. מחכים שכולם יירגעו – לא קובעים תוצאה בשיא הכעס.
  2. בודקים: זה קשור למעשה? זה קצר? זה הוגן?
  3. אומרים בקול רגוע ובקצרה: "זרקת את המשחק, אז המשחק נגמר להיום."
  4. עומדים במה שאמרתם, בלי הרצאה ובלי להוסיף.
  5. למחרת מתחילים דף חדש.
- **טיפ:** אם קשה לחשוב על תוצאה ברגע, אפשר לומר "אחשוב על זה ואגיד לך אחר כך" – ולחזור כשאתם רגועים.
- **קשור:** `repair`

#### 🔧 תיקון · `repair`
- **מה זה:** אחרי שפגע במישהו או בחפץ, הילד עושה משהו שמתקן – לא רק אומר "סליחה": עוזר לבנות מחדש, מביא קרח, מצייר ציור, מחזיר את מה שלקח.
- **למה זה עוזר:** תיקון מלמד אחריות בלי בושה: "טעיתי, ואני יכול לתקן". הוא גם עוזר לאח שנפגע להרגיש שרואים אותו, ומחזיר את השקט בין האחים.
- **איך עושים:**
  1. מחכים שיירגע, ומדברים בפרטיות – לא מול האחים.
  2. שואלים: "מה יכול לעזור לו עכשיו להרגיש טוב יותר?"
  3. נותנים לו לבחור דרך לתקן – אפשר להציע 2–3 רעיונות.
  4. מלווים אותו כשהוא מתקן, ומשבחים את המעשה.
- **טיפ:** אל תכריחו "סליחה" מיד. סליחה בכפייה מלמדת רק להגיד מילים; מעשה קטן של תיקון שווה יותר.
- **קשור:** `consequence`

#### 👀 שבח ספציפי · `praise`
- **מה זה:** שבח שמתאר בדיוק מה הילד עשה, מיד כשזה קורה. למשל: "ראיתי שוויתרת לאחיך על התור – זה היה בוגר", במקום "כל הכבוד".
- **למה זה עוזר:** ילדים חוזרים על מה שמקבל תשומת לב. שבח ספציפי אומר לו בדיוק מה כדאי לעשות שוב, ומראה לו שרואים גם את הרגעים הטובים, לא רק את הקשים.
- **איך עושים:**
  1. "תופסים" אותו מתנהג יפה – גם בדברים קטנים ורגילים.
  2. מתארים את המעשה: "ראיתי ש…"
  3. מוסיפים מילה חמה או את ההשפעה: "…וזה עזר לאחותך."
  4. בלי "אבל" בסוף, ובלי להזכיר את מה שהיה פעם.
  5. מכוונים ל-5 שבחים ביום, ורושמים ב"תפסתי אותו מתנהג יפה".
- **טיפ:** מול האחים, שבח בלחישה או אגודל למעלה עובד מצוין – בלי להביך אותו.
- **קשור:** `bed`, `one`

#### ⏳ דחיית סיפוק · `delay`
- **מה זה:** היכולת לחכות למשהו שרוצים – לוותר על "עכשיו" בשביל משהו טוב יותר אחר כך.
- **למה זה עוזר:** ילד שמתאמן בהמתנה לומד להחזיק דחף לרגע – אותה יכולת שהוא צריך כשאח לוקח לו משהו או כשהוא מפסיד. כמו כל מיומנות, היא משתפרת באימון.
- **איך מלמדים:**
  1. מתחילים בהמתנות קצרות וקלות: "עוד 2 דקות ונתחיל."
  2. משתמשים בטיימר שהוא רואה – קל יותר לחכות כשרואים את הסוף.
  3. מציעים בחירה: פרס קטן עכשיו, או גדול יותר אחרי המתנה (ראו "אתגר דחיית סיפוק").
  4. מאריכים את ההמתנה בהדרגה, ומשבחים כל המתנה מוצלחת.
  5. עומדים בהבטחה – תמיד. אחרת אין סיבה לחכות.
- **טיפ:** עזרו לו למצוא מה לעשות בזמן ההמתנה – לשיר, לספור, לשחק במשהו אחר. כשהידיים עסוקות, קל יותר לחכות.
- **קשור:** `delaygame`

---

## 2. Data model & rendering (single source of truth)

```js
// full content in Appendix A
const INFO = { balloon: { group, icon, title, kid?, what, why, howLabel, how: [...], tip, related: [...], ex?, act? }, … };
const INFO_GROUPS = [
  { id: 'calm',     icon: '🧘', title: 'כלי רגיעה',   ids: ['balloon', 'candle', 'box', 'robot', 'wall', 'stop'] },
  { id: 'routine',  icon: '📅', title: 'סדר היום',    ids: ['morning', 'move', 'bed'] },
  { id: 'games',    icon: '🛑', title: 'משחקי עצירה', ids: ['colorword', 'freeze', 'jenga', 'headshoulders', 'traffic', 'simon', 'drum', 'chess', 'delaygame', 'roleplay'] },
  { id: 'concepts', icon: '💡', title: 'מושגים',      ids: ['thermo', 'corner', 'stopgame', 'one', 'consequence', 'repair', 'praise', 'delay'] }
];
const CHECK_INFO = { morning: 'morning', move: 'move', stop: 'stopgame', one: 'one', bed: 'bed' };
```

- **`GAMES` gets an `id`** in the **same order** (the order drives `gameOfDay()`): `colorword, freeze, jenga, headshoulders, traffic, simon, drum, chess, delaygame, roleplay`. Drop `GAMES[i].d`. The Today "המשחק של היום" box shows `INFO[g.id].what` instead, so the game summary exists only once. Also replace `GAMES[i].n` with `INFO[g.id].title`, or keep `n` identical to it.
- **`infoContent(id, ctx)`** returns the inner HTML used by the sheet **and** the guide entry. `ctx` is `'calm' | 'today' | 'guide'`. Escape all strings with `esc()`. Run `fixRanges()` on the container after inserting the HTML (ranges such as "30–60" and "10–15" appear in the content).
- Section headings are the fixed strings `מה זה`, `למה זה עוזר`, `entry.howLabel` (`איך מלמדים` / `איך עושים` / `איך משחקים`) and `טיפ`.
- The calm tools' `TOOLS[t].name` must equal `INFO[t].title` (they already match).

---

## 3. The ⓘ button

### 3.1 Icon & base style
Add the icon to `ICON`, in the same family as the existing set (24×24, stroke, `.ic`):
```js
info: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.6v.01" stroke-width="2.6"/></svg>'
```
```css
.info-btn{position:absolute;top:0;inset-inline-end:0;z-index:1;width:44px;height:44px;display:grid;place-items:center;
  padding:0;border:none;background:none;color:var(--accent-strong);border-radius:var(--r-md)}
.info-btn .ic{width:22px;height:22px}
.info-btn:active{background:rgba(26,127,118,.14);background:color-mix(in srgb,var(--accent) 14%,transparent)}
```
**Hit area:** 44×44px. **Visual:** a 22px outlined circled "i" in `--accent-strong`. Focus uses the existing global `:focus-visible` ring. All buttons get `type="button"`, `data-act="info"`, `data-info="<entry id>"`, `data-ctx="calm|today|guide"`, `aria-haspopup="dialog"`, `aria-controls="infoSheet"` and an `aria-label` from §3.5.

### 3.2 Calm tool tiles (`toolBtn()` / `toolGrid()`)
A button can't contain another button, so wrap the tile and the ⓘ in a cell. They are **siblings**: the ⓘ covers the top inline-end corner (top-left in RTL), and a tap anywhere else on the tile still starts the exercise.
```js
function toolBtn(t, wide) {
  const x = TOOLS[t];
  return `<div class="tool-cell ${wide ? 'wide' : ''}">
    <button type="button" class="tool ${wide ? 'wide' : ''}" data-act="ex" data-ex="${t}"><span class="ti" aria-hidden="true">${x.icon}</span><span>${esc(x.name)}<br><small>${esc(x.sub)}</small></span></button>
    <button type="button" class="info-btn" data-act="info" data-info="${t}" data-ctx="calm" aria-haspopup="dialog" aria-controls="infoSheet" aria-label="מה זה ${esc(x.name)}?">${ICON.info}</button>
  </div>`;
}
```
```css
.tool-cell{position:relative;display:flex;min-width:0}
.tool-cell.wide{grid-column:1 / -1}          /* the grid span moves from .tool.wide to the cell */
.tool-cell > .tool{flex:1;min-width:0}
.tool-cell > .tool.wide{padding-inline:40px} /* keep the centred row content clear of the ⓘ */
```
In the existing rule `.tool.wide{grid-column:1 / -1; …}`, delete `grid-column` and keep the row layout. On narrow tiles the emoji is centred, so it never reaches the 44px corner. (Verified at 360px: `/tmp/design-shots/info/L-calm.png`.) The ⓘ appears on **every** tile, in both the "מה יעזור לך עכשיו" grid and "כל הכלים" (but see open question 3).

### 3.3 Today checklist rows (`renderToday()`)
The row toggle `.check-hit` is a `<button role="checkbox">`, so the ⓘ goes **after** it as a sibling inside `.check`, positioned in the top-left corner. The toggle gets end padding so its text never runs under the ⓘ.
```html
<div class="check …" data-id="${c.id}">
  <button type="button" class="check-hit" role="checkbox" …>…</button>
  <button type="button" class="info-btn" data-act="info" data-info="${CHECK_INFO[c.id]}" data-ctx="today"
          aria-haspopup="dialog" aria-controls="infoSheet" aria-label="${CHECK_ARIA[c.id]}">${ICON.info}</button>
  …existing .check-extra blocks…
</div>
```
```css
.check{position:relative}
.check-hit{padding-inline-end:52px}
.check > .info-btn{top:6px;inset-inline-end:6px}
```
**DOM order matters:** the ⓘ comes right after the toggle, so Tab order is toggle → ⓘ → extras ("התחילו 3 דקות נשימה" / "איך משחקים?").

### 3.4 The daily stop game (`.game` box inside `.check-extra`)
The stop row's corner ⓘ explains **משחק עצירה** in general. The specific game gets a labelled text button at the bottom of its box (two identical ⓘ icons in one row would be ambiguous):
```html
<div class="game">
  <b>המשחק של היום: ${esc(INFO[g.id].title)}</b><br>${esc(INFO[g.id].what)}
  <br><button type="button" class="info-link" data-act="info" data-info="${g.id}" data-ctx="today"
        aria-haspopup="dialog" aria-controls="infoSheet" aria-label="איך משחקים ${esc(INFO[g.id].title)}?">${ICON.info}איך משחקים?</button>
</div>
```
```css
.info-link{display:inline-flex;align-items:center;gap:6px;min-height:44px;margin-top:2px;margin-inline-start:-8px;padding:0 8px;
  border:none;background:none;color:var(--accent-strong);font-weight:700;font-size:var(--fs-sm);border-radius:var(--r-sm)}
.info-link .ic{width:20px;height:20px}
.info-link:active{background:rgba(26,127,118,.14);background:color-mix(in srgb,var(--accent) 14%,transparent)}
```

### 3.5 Accessible names (exact strings)
| Trigger | `aria-label` |
|---|---|
| Calm tiles | `מה זה נשימת בלון?` · `מה זה נשימת נר?` · `מה זה נשימת קובייה?` · `מה זה רובוט וספגטי?` · `מה זה לדחוף את הקיר?` · `מה זה משפט העצירה?` |
| Checklist `morning` | `מה זה נשימת הבוקר ושאלת המדחום?` |
| Checklist `move` | `למה תנועה בחוץ?` |
| Checklist `stop` | `מה זה משחק עצירה?` |
| Checklist `one` | `מה זה זמן אחד-על-אחד?` |
| Checklist `bed` | `הסבר: "מה הצלחת היום?" וסיפור` |
| Game of the day | `איך משחקים ${title}?` (e.g. `איך משחקים תופסת קפואה?`) |

`CHECK_ARIA` is a plain object with these five strings.

---

## 4. The explanation sheet

It reuses the existing bottom-sheet pattern (`.modal` scrim + `.modal-card`, `sheetUp` animation, the `.modal.arm` tap guard, tokens). It's a separate element from `#dlg`, because it has a header, a scrolling body and a footer.

### 4.1 Markup (add next to `#dlg`)
```html
<div id="infoSheet" class="modal" hidden role="dialog" aria-modal="true" aria-labelledby="infoTitle">
  <div class="modal-card info-card">
    <div class="info-head">
      <span class="info-ic" id="infoIcon" aria-hidden="true"></span>
      <h2 id="infoTitle" tabindex="-1"></h2>
      <button type="button" class="icon-btn" data-act="infoClose" aria-label="סגירה">${ICON.close}</button>
    </div>
    <div class="info-body" id="infoBody"></div>
    <div class="info-foot" id="infoFoot"></div>
  </div>
</div>
```
`role="dialog"` (not `alertdialog`: this is information, not a decision).

### 4.2 CSS
```css
.info-card{display:flex;flex-direction:column;max-width:560px;max-height:calc(100dvh - 32px - env(safe-area-inset-top));padding:0;overflow:hidden}
.info-card p{color:var(--text);margin:0}                      /* override .modal-card p (muted + margin) */
.info-head{display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-3) var(--sp-5);padding-inline-end:var(--sp-4);border-bottom:1px solid var(--line)}
.info-head h2{flex:1;min-width:0;margin:0;font-size:var(--fs-md)}
.info-ic{font-size:28px;line-height:1;flex:0 0 auto}
.info-body{overflow-y:auto;overscroll-behavior:contain;padding:var(--sp-4) var(--sp-5) var(--sp-5)}
.info-foot{padding:var(--sp-3) var(--sp-5) var(--sp-4);border-top:1px solid var(--line)}
.info-foot:empty{display:none}
.info-sec + .info-sec{margin-top:var(--sp-4)}
.info-sec h3{margin:0 0 var(--sp-1);font-size:var(--fs-sm);font-weight:800;color:var(--accent-strong)}
.info-steps{margin:0;padding-inline-start:1.3em}
.info-steps li{margin:4px 0;padding-inline-start:2px}
.info-steps li::marker{font-weight:800;color:var(--accent-strong)}
.info-tip{display:flex;gap:var(--sp-2);margin-top:var(--sp-4);padding:var(--sp-3) var(--sp-4);border-radius:var(--r-md);background:var(--warn-soft)}
.info-kid{margin:0 0 var(--sp-4);padding:var(--sp-3) var(--sp-4);border-radius:var(--r-lg);background:var(--accent-soft);font-size:var(--fs-md);font-weight:700}
.info-say{margin-top:var(--sp-4);padding-inline-start:var(--sp-3);border-inline-start:4px solid var(--accent)}
.info-say b{display:block;font-size:var(--fs-xs);color:var(--muted)}
.info-related{display:flex;flex-wrap:wrap;gap:var(--sp-2);margin-top:var(--sp-4)}
.info-related .chip{min-height:44px;font-size:var(--fs-sm)}
.info-more{margin-top:var(--sp-3)}
.info-parents{margin-top:var(--sp-2)}
.info-parents > summary{font-size:var(--fs-base)}
```
On a 360×780 screen the balloon entry needs about 85% of the height. The header and footer stay put and only the body scrolls. (Verified: `/tmp/design-shots/info/L-sheet.png`, `D-sheet-calm.png`.)

### 4.3 Content per context (`infoContent(id, ctx)`)
**Parent contexts (`today`, `guide`)**, top to bottom:
1. `.info-sec` **מה זה** → `<p>`
2. `.info-sec` **למה זה עוזר** → `<p>`
3. `.info-sec` **{howLabel}** → `<ol class="info-steps">`
4. `.info-tip` → `<span aria-hidden="true">💡</span><p><b>טיפ:</b> …</p>`
5. Calm tools only: `.info-say` → `<b>איך להסביר לו</b>` + the child line
6. `.info-related` → "ראו גם" chips: `<button type="button" class="chip" data-act="info" data-info="${rid}" data-ctx="${ctx}">${INFO[rid].icon} ${INFO[rid].title}</button>`. In the sheet, a chip replaces the content in place (scroll the body to the top, focus `#infoTitle`). In the guide, a chip opens that dictionary entry (§5.3).
7. Sheet only, not in the guide: `.info-more` → `<button type="button" class="info-link" data-act="infoToGuide" data-info="${id}">כל הכלים והמושגים במדריך</button>`

**Calm context (`calm`, opened by the child from a tile)**: keep it dead simple.
1. `.info-kid` → the child line (large)
2. `<details class="info-parents"><summary>להורים: מה זה ואיך מלמדים</summary>` sections 1–4 `</details>` (collapsed)

**Footer `#infoFoot`, the primary action** (`btn block`, `ICON.play` + label):
| Entry | Context | Label | Action |
|---|---|---|---|
| calm tool (`ex:*`) | `calm` | `בוא ננסה` | `closeInfo(); startEx(ex)` (`returnTo: 'calm'`, the default) |
| calm tool (`ex:*`) | `today` / `guide` | `נסו עכשיו` | `closeInfo(); startEx(ex, { returnTo: S.ui.tab })` |
| `morning` (`act:morningBreath`) | any, only while today's `morning` is not done | `התחילו 3 דקות נשימה` | `closeInfo(); ACT.morningBreath()` |
| all others | – | – (the footer is empty and hidden) | – |

In the guide (inline entries, §5) the same action renders as a `btn small` inside the entry after the tip, not in a footer.

**`finishEx()` for `returnTo === 'guide'`** (new branch): text `כל הכבוד! עכשיו אתם מכירים את התרגיל מבפנים – וקל יותר ללמד אותו.`, **no mood dots** (a parent trying the tool must not log a mood for the child), and the button `חזרה למדריך` with `data-goto="guide"`. For `returnTo === 'today'` with a calm tool (not the morning flow), use the same text with the button `חזרה להיום`.

### 4.4 Open, close, back, focus
- `openInfo(id, ctx)`: fill `#infoIcon`, `#infoTitle`, `#infoBody` and `#infoFoot`, run `fixRanges($('#infoSheet'))`, set `$('#infoSheet').hidden = false`, set `#infoBody.scrollTop = 0`, then call `restartAnim($('#infoSheet'), 'arm')`. That's the existing 400 ms tap guard, so the second tap of a double tap can't hit "נסו עכשיו". Hide any visible toast, as `ask()` does.
- **Overlay stack:** `OVERLAY_ORDER = ['#dlg', '#infoSheet', '#celOverlay', '#exOverlay', '#setOverlay']`. `syncOverlays()` then handles inert background, scroll lock and focus. Focus lands on `#infoTitle` (`tabindex="-1"`) and returns to the ⓘ that opened the sheet. The Tab trap works unchanged.
- **Close paths:** all four call `closeInfo()` (sets `hidden = true`):
  1. **✕** (`data-act="infoClose"`, through `shieldTaps()` like the dialog buttons)
  2. **Scrim tap**: `$('#infoSheet').addEventListener('click', e => { if (e.target === e.currentTarget && armed) { shieldTaps(); closeInfo(); } })`. Reuse the `dlgArmed()` logic, generalised to take the element.
  3. **Escape**: already routed through `androidBack()`
  4. **Android back**: in `androidBack()`, right after the `#dlg` line: `if (!$('#infoSheet').hidden) { closeInfo(); return true; }`
- **`infoToGuide`:** `closeInfo(); showTab('guide'); openDictEntry(id)`.
- If the sheet is open when a related chip is tapped: re-render in place, keep `ctx`, and focus `#infoTitle`.

---

## 5. The guide chapter "מילון כלים ומושגים"

### 5.1 Placement & layout
The chapter goes in `renderGuide()` right **after the five phase cards** and **before** "הבכור מתוך 7". The current phase stays at the top, and the dictionary sits next to the program content it explains.

It's four consecutive cards in the **existing phase-card pattern** (eyebrow + title + chevron), one per group, all collapsed by default:
```html
<section class="card phase-card dict" id="dict-${g.id}">
  <details>
    <summary><span><span class="wk">מילון כלים ומושגים</span>${g.icon} ${g.title} <span class="dict-count">${g.ids.length}</span></span></summary>
    <div class="body">
      ${g.ids.map(id => `
        <details class="dict-item" id="info-${id}">
          <summary><span class="di-ic" aria-hidden="true">${INFO[id].icon}</span><span class="di-t">${esc(INFO[id].title)}</span></summary>
          <div class="dict-body">${infoContent(id, 'guide')}${actionButton(id, 'guide')}</div>
        </details>`).join('')}
    </div>
  </details>
</section>
```
```css
.dict-count{display:inline-block;margin-inline-start:6px;padding:0 8px;border-radius:var(--r-pill);background:var(--accent-soft);color:var(--accent-strong);font-size:var(--fs-xs);font-weight:800;vertical-align:middle}
.dict-item{border-top:1px solid var(--line)}
.dict-item > summary{min-height:52px;padding:var(--sp-2) 0;font-size:var(--fs-base);font-weight:700;justify-content:flex-start;gap:var(--sp-3)}
.dict-item > summary .di-ic{flex:0 0 28px;font-size:22px;text-align:center}
.dict-item > summary .di-t{flex:1;min-width:0}
.dict-item[open] > summary{color:var(--accent-strong)}
.dict-body{padding:0 0 var(--sp-4);padding-inline-start:calc(28px + var(--sp-3))}  /* aligns with the title */
.dict-body .btn{margin-top:var(--sp-3)}
```
The existing `details > summary::after` chevron keeps working for both levels. The guide intro card subtitle (`.sub` under "📖 מדריך להורה") gets a second sentence: `בסוף המדריך: מילון של כל הכלים, המשחקים והמושגים.`

### 5.2 Group order & titles
1. 🧘 **כלי רגיעה** (6)
2. 📅 **סדר היום** (3)
3. 🛑 **משחקי עצירה** (10)
4. 💡 **מושגים** (8)

### 5.3 `openDictEntry(id)`
Find the group that holds `id`, open `#dict-${group} > details` and `#info-${id}`, then `$('#info-' + id).scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' })` (the existing `scroll-padding-top` keeps it clear of the header), and move focus to its `summary` with `preventScroll`. "ראו גם" chips inside the guide call this too.

### 5.4 Optional, recommended entry points (no new features, just links to the same content)
- The Guide phase items whose topic has an entry (p2: נשימה / מדחום / פינת רגיעה; p3: every game; p5: זמן אחד-על-אחד) get a trailing `info-link` "עוד על זה" → `openDictEntry(id)`.
- The Today praise card heading `👀 תפסתי… מתנהג יפה` gets an ⓘ → `praise`. The incident protocol card gets an ⓘ next to "תוצאה הגיונית" → `consequence`, and next to "תיקון מול הנפגע" → `repair`. Otherwise these concepts are only reachable from the guide.

---

## 6. Light & dark: measured contrast (new pairs)
Everything uses existing tokens, so dark mode works with no new CSS.

| Element | Light | Dark |
|---|---|---|
| ⓘ (`--accent-strong`) on tile `--surface2` | 6.76 | 7.97 |
| ⓘ on the "משפט העצירה" tile gradient (`--danger-soft` → `--warn-soft`) | 5.94 – 6.40 | 7.70 – 8.88 |
| ⓘ on a done checklist row (`--accent-soft`) | 5.95 | 6.80 |
| ⓘ / `.info-link` / `.info-sec h3` on `--surface` | 7.20 | 8.94 |
| Tip text (`--text` on `--warn-soft`) | 12.25 | 11.21 |
| Child line (`--text` on `--accent-soft`) | 11.39 | 9.91 |

The ⓘ only needs 3:1 as a graphic; the section headings are 15px/800 and pass 4.5:1.

---

## 7. QA acceptance checklist
- [ ] Six calm tiles × 2 grids, 5 checklist rows and the game of the day all show an ⓘ. Each hit area is ≥ 44×44, and a tap on it never starts the exercise or toggles the row.
- [ ] A tap on the rest of a tile still starts its exercise, and a tap on the rest of a row still toggles it.
- [ ] Screen readers announce each ⓘ by the §3.5 name, plus "dialog" on open. Focus lands on the sheet title and returns to the ⓘ on close.
- [ ] ✕, a scrim tap, Escape and Android back each close the sheet, and back does not leave the tab.
- [ ] "בוא ננסה" / "נסו עכשיו" starts the right exercise. The return button matches its origin (מדחום / היום / מדריך), and the guide flow never logs a mood.
- [ ] The guide chapter has 4 collapsed group cards with 6/3/10/8 entries, and every entry has the four sections. Related chips open the right entry.
- [ ] Changing an `INFO` string updates the sheet, the guide entry and (for games) the Today game box.
- [ ] Ranges show as "30–60", "10–15" and "2–3" (`fixRanges` ran), at 360px in light and dark, with no horizontal scroll.

---

## 8. Open questions for the lead/client
1. **Checklist ↔ concept sharing.** The stop-game and one-on-one rows open the **משחק עצירה** and **זמן אחד-על-אחד** concept entries instead of separate practice entries, which avoids two near-identical texts. Is that acceptable, or does the client want 5 separate practice entries?
2. **A fourth group, "סדר היום".** The brief listed three groups (כלי רגיעה / משחקי עצירה / מושגים), but the morning, outdoor-movement and bedtime practices aren't concepts, and single-source-of-truth means they must appear in the dictionary. I added **סדר היום** as a fourth group. The alternative is folding the 3 entries into מושגים.
3. **ⓘ in the red state.** The client approved an ⓘ on *every* Calm tile, so that's the spec. My recommendation: hide it on the "מה יעזור לך עכשיו" tiles **only when `selMood === 'red'`**. A child about to explode shouldn't meet a detour, and the full grid below still has the ⓘ. That's a one-line change in `toolBtn()` if approved.
4. **CTA wording in the Calm context.** The brief asked for "נסו עכשיו". When the child opens the sheet from the Calm tab I used **"בוא ננסה"** (masculine singular, matching the rest of that tab), and kept "נסו עכשיו" for parents in Today and the Guide. Confirm.
5. **Optional entry points (§5.4)** for the praise card, the protocol and the phase items: go or no-go for this round?

---

## Appendix A – `INFO` (paste-ready, generated from §1 by script; 27 entries, all `related` ids verified)

The Hebrew is identical to §1. Strings use double quotes as JS delimiters, so the Hebrew quotation marks inside them are escaped (`\"`). Keep the en dash `–` in ranges: `fixRanges()` depends on it.

```js
const INFO = {
  balloon: {
    group: "calm",
    icon: "🎈",
    title: "נשימת בלון",
    kid: "אתה מנפח את הבטן כמו בלון ומרוקן אותה לאט – והגוף שלך נרגע.",
    what: "נשימה עמוקה לבטן: שואפים מהאף ומרגישים את הבטן מתנפחת כמו בלון, ואז נושפים לאט מהפה עד שהבלון מתרוקן.",
    why: "כשהנשיפה איטית וארוכה יותר מהשאיפה, הגוף מקבל אות להאט: הלב נרגע והשרירים משתחררים. הדימוי של בלון עוזר להתרכז בבטן ולא בכעס.",
    howLabel: "איך מלמדים",
    how: [
      "יושבים או עומדים בנוח, יד אחת על הבטן.",
      "שואפים מהאף 4 שניות – היד עולה כשהבטן מתנפחת.",
      "נושפים לאט מהפה 6 שניות – היד יורדת כשהבלון מתרוקן.",
      "חוזרים 6 פעמים, בערך דקה. בבוקר – 3 דקות.",
      "באפליקציה העיגול גדל בשאיפה וקטן בנשיפה, ואפשר פשוט לנשום איתו."
    ],
    tip: "כשהוא שוכב, הניחו לו בובה קטנה על הבטן ותנו לו לראות אותה עולה ויורדת.",
    related: ["morning", "candle", "thermo"],
    ex: "balloon"
  },
  candle: {
    group: "calm",
    icon: "🕯️",
    title: "נשימת נר",
    kid: "אתה מריח פרח ונושף על נר בעדינות – שהלהבה תזוז ולא תכבה.",
    what: "נשימה עם דמיון: שואפים לאט מהאף כאילו מריחים פרח, ונושפים בעדינות מהפה כאילו מזיזים להבה של נר – בלי לכבות אותה.",
    why: "הנר \"מבקש\" נשיפה איטית ורכה, וזו בדיוק הנשיפה שמרגיעה את הגוף. הדמיון נותן לילד משימה פשוטה שמסיטה את תשומת הלב מהכעס.",
    howLabel: "איך מלמדים",
    how: [
      "מרימים אצבע מול הפה – זה הנר.",
      "מריחים פרח: שואפים לאט מהאף, 4 שניות.",
      "נושפים על הנר בעדינות, 6 שניות – שהלהבה רק תרקוד.",
      "חוזרים 6 פעמים."
    ],
    tip: "בפעם הראשונה החזיקו פיסת טישו מול הפה שלו – המטרה שהיא תזוז, לא שתעוף.",
    related: ["balloon", "box"],
    ex: "candle"
  },
  box: {
    group: "calm",
    icon: "🟦",
    title: "נשימת קובייה",
    kid: "אתה נושם בארבעה צעדים של 4: שואף, מחזיק, נושף ומחכה – כמו לצייר ריבוע.",
    what: "נשימה בארבעה שלבים שווים של 4 שניות: שואפים, מחזיקים, נושפים ומחכים – כמו לצייר ריבוע עם הנשימה.",
    why: "הספירה הקבועה נותנת לראש משהו להתמקד בו, והקצב האחיד מאט את הנשימה. היא מתאימה במיוחד כשהמחשבות רצות מהר.",
    howLabel: "איך מלמדים",
    how: [
      "שואפים מהאף וסופרים לאט עד 4.",
      "מחזיקים את האוויר – עד 4.",
      "נושפים מהפה – עד 4.",
      "מחכים רגע בלי לנשום – עד 4.",
      "עושים 4 סבבים, בערך דקה. אפשר לצייר באצבע ריבוע באוויר תוך כדי."
    ],
    tip: "החזקת האוויר צריכה להיות נוחה, בלי מאמץ. אם קשה לו, תרגלו קודם בלי האפליקציה, בספירה של 3.",
    related: ["balloon", "robot"],
    ex: "box"
  },
  robot: {
    group: "calm",
    icon: "🤖",
    title: "רובוט וספגטי",
    kid: "קודם אתה רובוט קשוח ומכווץ, ואז ספגטי רך ורפוי – והמתח יוצא מהגוף.",
    what: "משחק הרפיה: 5 שניות \"רובוט\" – מכווצים את כל הגוף חזק, ואז 5 שניות \"ספגטי\" – משחררים הכול ונהיים רכים ורפויים. 3 סבבים.",
    why: "אחרי כיווץ חזק קל יותר לשרירים להשתחרר, והילד לומד להרגיש את ההבדל בין גוף מתוח לגוף רגוע. זה מתאים במיוחד לילד שקשה לו לשבת בשקט ולנשום.",
    howLabel: "איך מלמדים",
    how: [
      "עומדים או יושבים.",
      "\"רובוט!\" – אגרופים קפוצים, כתפיים למעלה, פנים מכווצות, 5 שניות.",
      "\"ספגטי!\" – משחררים הכול: ידיים רפויות, כתפיים למטה, 5 שניות.",
      "חוזרים 3 פעמים."
    ],
    tip: "עשו את זה יחד איתו ותגזימו – רובוט קשוח וספגטי מתנדנד. צחוק קטן הוא חלק מההרגעה.",
    related: ["wall", "corner"],
    ex: "robot"
  },
  wall: {
    group: "calm",
    icon: "🧱",
    title: "לדחוף את הקיר",
    kid: "אתה דוחף את הקיר בכל הכוח 10 שניות, ואז עוזב ונושם עמוק. הכעס יוצא, ואף אחד לא נפגע.",
    what: "עומדים מול קיר, ידיים ישרות על הקיר, ודוחפים בכל הכוח 10 שניות. אחר כך עוזבים ונושמים עמוק.",
    why: "כעס מגיע עם הרבה אנרגיה בגוף. דחיפה חזקה מוציאה אותה דרך השרירים בדרך בטוחה, ואחרי מאמץ חזק הגוף נוטה להשתחרר. זה כלי טוב במיוחד בכתום ובאדום.",
    howLabel: "איך מלמדים",
    how: [
      "עומדים מול קיר, רגל אחת קצת מאחור.",
      "מניחים כפות ידיים על הקיר בגובה הכתפיים, ידיים ישרות.",
      "דוחפים בכל הכוח 10 שניות – כאילו מזיזים את הקיר.",
      "עוזבים, מנערים את הידיים ונושמים עמוק.",
      "אם צריך – עוד סבב."
    ],
    tip: "בחרו מראש \"קיר כעס\" קבוע בבית. כשאתם רואים כתום, מספיק להציע: \"בוא לקיר\".",
    related: ["robot", "thermo"],
    ex: "wall"
  },
  stop: {
    group: "calm",
    icon: "✋",
    title: "משפט העצירה",
    kid: "כשהכעס עולה, אתה עוצר, נושם, חושב – ובוחר מה לעשות.",
    what: "ארבע מילים שעוצרות רגע לפני מעשה: עצור (הגוף קופא), נושם (נשימה אחת עמוקה), חושב (מה יקרה אם…?), בוחר (דרך מותרת).",
    why: "בכעס הגוף פועל מהר יותר מהמחשבה. המשפט יוצר הפסקה קצרה בין הדחף למעשה, ובהפסקה הזו אפשר לבחור אחרת. קל לזכור מילים קבועות גם כשקשה.",
    howLabel: "איך מלמדים",
    how: [
      "מלמדים בזמן רגוע, לא באמצע התפרצות.",
      "אומרים יחד בקול, מילה אחרי מילה, עם תנועה: יד עוצרת, נשימה, אצבע לרקה, אגודל למעלה.",
      "באפליקציה כל מילה נדלקת ל-3 שניות, בשני סבבים.",
      "מתרגלים במשחק תפקידים, ורק אז משתמשים ברגע אמת – בשקט ובקצרה."
    ],
    tip: "השתמשו במשפט גם בעצמכם, בקול, כשאתם מתעצבנים. ילדים לומדים הכי הרבה ממה שהם רואים.",
    related: ["roleplay", "stopgame"],
    ex: "stop"
  },
  morning: {
    group: "routine",
    icon: "🌅",
    title: "נשימת בוקר ושאלת המדחום",
    what: "פותחים את היום ב-3 דקות של נשימת בלון ביחד, ואז שואלים: \"איפה אתה במדחום?\" – ירוק, צהוב, כתום או אדום.",
    why: "תרגול בזמן רגוע הופך את הנשימה להרגל, כך שהיא זמינה גם ברגע קשה. השאלה על המדחום מלמדת אותו לשים לב למה שהוא מרגיש לפני שהכעס גדל.",
    howLabel: "איך עושים",
    how: [
      "בוחרים רגע קבוע, למשל לפני ארוחת הבוקר.",
      "לוחצים \"התחילו 3 דקות נשימה\" ונושמים יחד: 4 שניות שאיפה, 6 שניות נשיפה.",
      "שואלים: \"איפה אתה במדחום עכשיו?\" ומקבלים כל תשובה בלי ויכוח.",
      "אם הוא בצהוב, בכתום או באדום – שואלים בעדינות מה קרה ומציעים כלי.",
      "בסוף הנשימה המשימה מסומנת בסדר היום מעצמה."
    ],
    tip: "גם \"אדום\" בבוקר הוא תשובה טובה – הוא זיהה את מה שהוא מרגיש. אמרו לו: \"תודה שסיפרת\".",
    related: ["balloon", "thermo"],
    act: "morningBreath"
  },
  move: {
    group: "routine",
    icon: "🏃",
    title: "תנועה בחוץ",
    what: "30–60 דקות של תנועה פעילה בחוץ בכל יום: ריצה, אופניים, כדור, טיפוס או קפיצה בחבל.",
    why: "ילד חסר מנוחה צובר הרבה אנרגיה. כשהיא יוצאת במשחק ובתנועה, נשאר פחות \"דלק\" להתפרצויות, ולרוב גם השינה טובה יותר.",
    howLabel: "איך עושים",
    how: [
      "קובעים זמן קבוע, עדיף אחר הצהריים – לפני השעות המועדות.",
      "נותנים לו לבחור פעילות מתוך 2–3 אפשרויות.",
      "מכוונים למאמץ שגורם להזיע ולהתנשף, לא רק להליכה איטית.",
      "אפשר לחלק: 20 דקות אחרי בית הספר ועוד 20 לפני הערב."
    ],
    tip: "הצטרפו מדי פעם. מסירות כדור או מרוץ קצר הם גם זמן איכות איתו.",
    related: ["stopgame"]
  },
  bed: {
    group: "routine",
    icon: "🌙",
    title: "\"מה הצלחת היום?\" וסיפור",
    what: "לפני השינה שואלים: \"מה הצלחת היום?\", מוצאים יחד לפחות הצלחה אחת, ומסיימים בסיפור.",
    why: "גם אחרי יום קשה, הדבר האחרון שהוא שומע הוא משהו טוב שהוא עשה. זה בונה אצלו תחושה של \"אני מסוגל\", והטקס הקבוע עוזר להירגע לקראת השינה.",
    howLabel: "איך עושים",
    how: [
      "שואלים בקול רך: \"מה הצלחת היום?\"",
      "אם הוא לא מוצא – עוזרים לו: \"ראיתי שהבוקר חיכית לתור שלך.\"",
      "אפשר להיעזר בשבחים שנרשמו היום ב\"תפסתי אותו מתנהג יפה\".",
      "לא מדברים עכשיו על האירועים הקשים של היום – יש לזה זמן אחר.",
      "מסיימים בסיפור, גם קצר."
    ],
    tip: "ספרו גם אתם על הצלחה קטנה שלכם מהיום – כך זו שיחה ולא מבחן.",
    related: ["praise"]
  },
  colorword: {
    group: "games",
    icon: "🎨",
    title: "צבע-מילה",
    what: "אומרים צבע, והוא עושה תנועה שסיכמתם מראש – למשל אדום = קופץ, כחול = קופא, ירוק = מסתובב. באמצע מחליפים את החוקים!",
    why: "הוא צריך להקשיב, לזכור את החוק ולעצור את התגובה הישנה כשהחוקים משתנים. זה אימון לגמישות ולעצירה.",
    howLabel: "איך משחקים",
    how: [
      "מסכימים על 3 צבעים ו-3 תנועות.",
      "קוראים צבעים בקצב איטי, ואז מהר יותר.",
      "אחרי כמה סבבים מחליפים חוק: עכשיו אדום = קופא.",
      "מתחלפים – הוא קורא ואתם זזים."
    ],
    tip: "כשהוא מתבלבל, צחקו יחד. הטעויות הן חלק מהכיף ומהאימון.",
    related: ["stopgame", "headshoulders"]
  },
  freeze: {
    group: "games",
    icon: "🧊",
    title: "תופסת קפואה",
    what: "רוקדים ומתרוצצים עם מוזיקה. כשהמוזיקה נעצרת – קופאים כמו פסל. מי שזז מחכה סיבוב אחד.",
    why: "לעצור את הגוף באמצע תנועה ובשיא ההתרגשות – זה בדיוק מה שצריך גם ברגע של כעס.",
    howLabel: "איך משחקים",
    how: [
      "מפעילים מוזיקה קצבית.",
      "עוצרים אותה ברגעים לא צפויים.",
      "כולם קופאים, ומי שזז מחכה סיבוב אחד בצד.",
      "מאריכים בהדרגה את זמן הקפיאה."
    ],
    tip: "שתפו גם את האחים הקטנים, ותנו לו להיות זה שמפעיל את המוזיקה.",
    related: ["stopgame", "traffic"]
  },
  jenga: {
    group: "games",
    icon: "🏗️",
    title: "ג׳נגה על זמן",
    what: "ג׳נגה רגילה, אבל לכל תור יש 10 שניות. כל אחד בתורו מוציא לבנה ומניח אותה למעלה.",
    why: "צריך לחכות לתור, לפעול בזהירות תחת לחץ קטן ולהתמודד עם הרגע שבו המגדל נופל. זה תרגול של סבלנות ושל הפסד בכבוד.",
    howLabel: "איך משחקים",
    how: [
      "בונים את המגדל יחד.",
      "מפעילים טיימר של 10 שניות לכל תור.",
      "מי שהפיל אומר \"אוף, בפעם הבאה\", ובונים מחדש."
    ],
    tip: "הפילו גם אתם את המגדל מדי פעם, והדגימו הפסד רגוע.",
    related: ["stopgame", "chess"]
  },
  headshoulders: {
    group: "games",
    icon: "🙃",
    title: "ראש-כתפיים הפוך",
    what: "כשאומרים \"ראש\" נוגעים בכתפיים, וכשאומרים \"כתפיים\" נוגעים בראש. מאיצים בהדרגה.",
    why: "הגוף רוצה לעשות את מה שהוא שומע. לעשות הפוך מאמן לעצור תגובה אוטומטית – כמו לעצור יד שרוצה להכות.",
    howLabel: "איך משחקים",
    how: [
      "מתחילים לאט, עם שתי מילים בלבד: ראש וכתפיים.",
      "מאיצים בהדרגה.",
      "מוסיפים זוג חדש: ברכיים ובהונות.",
      "מתחלפים – הוא נותן את ההוראות."
    ],
    tip: "התחילו לאט מספיק כדי שיצליח. הצלחה בהתחלה נותנת חשק להמשיך.",
    related: ["stopgame", "colorword"]
  },
  traffic: {
    group: "games",
    icon: "🚦",
    title: "רמזור",
    what: "ירוק – הולכים, צהוב – לאט מאוד, אדום – עוצרים במקום. ההורה מחליף צבעים מהר, ולפעמים מנסה לבלבל.",
    why: "המשחק מאמן להאט ולעצור את הגוף לפי סימן, והצבעים מזכירים את מדחום הרגשות.",
    howLabel: "איך משחקים",
    how: [
      "משחקים במסדרון או בחצר.",
      "קוראים צבעים, או מרימים דפים צבעוניים.",
      "מחליפים מהר יותר ככל שהוא מצליח.",
      "מי שזז באדום חוזר כמה צעדים אחורה."
    ],
    tip: "אחרי המשחק אפשר לקשר: \"גם בכעס יש צהוב – זה הרגע להאט.\"",
    related: ["thermo", "freeze"]
  },
  simon: {
    group: "games",
    icon: "🗣️",
    title: "שמעון אומר",
    what: "מבצעים הוראה רק אם היא מתחילה ב\"שמעון אומר\". בסבב השני הוא מוביל – ומתרגל להוביל בהגינות.",
    why: "צריך להקשיב עד הסוף לפני שפועלים, בדיוק ההפך מתגובה מהירה בלי מחשבה. ההובלה נותנת לו תפקיד חיובי.",
    howLabel: "איך משחקים",
    how: [
      "נותנים הוראות: \"שמעון אומר: קפוץ!\" – קופצים. \"קפוץ!\" – לא זזים.",
      "מגבירים את הקצב.",
      "בסבב השני הוא שמעון.",
      "בסוף שואלים: מה היה קשה? מה עזר לך לעצור?"
    ],
    tip: "כשהוא מוביל, שבחו הובלה הוגנת: \"נתת לכולם הזדמנות – ככה נראה מנהיג טוב.\"",
    related: ["stopgame"]
  },
  drum: {
    group: "games",
    icon: "🥁",
    title: "תיפוף ועצירה",
    what: "מתופפים על השולחן לפי הקצב של ההורה, ועוצרים בדיוק ברגע שההורה עוצר.",
    why: "הוא צריך להקשיב, לעקוב ולעצור ברגע. זה אימון קצר לשליטה בתנועה, שגם פורק אנרגיה.",
    howLabel: "איך משחקים",
    how: [
      "מתופפים קצב פשוט, והוא מחקה.",
      "עוצרים פתאום – והוא עוצר מיד.",
      "משנים קצב: מהר, לאט, חזק, חלש.",
      "מתחלפים בתפקידים."
    ],
    tip: "אפשר לתופף גם על הברכיים – בהמתנה לאוטובוס או לפני ארוחה.",
    related: ["stopgame"]
  },
  chess: {
    group: "games",
    icon: "♟️",
    title: "שחמט או דמקה",
    what: "משחק אחד בלי למהר. לפני כל מהלך אומרים בשקט: \"עצור, חושב, בוחר\". מסיימים בלחיצת יד.",
    why: "משחקי חשיבה מלמדים לעצור ולחשוב לפני שזזים, ולהפסיד בלי להתפרץ. ההפסד קורה בתוך משחק – מקום בטוח לתרגל אותו.",
    howLabel: "איך משחקים",
    how: [
      "בוחרים משחק שהוא מכיר, או לומדים יחד את החוקים.",
      "לפני כל מהלך אומרים: \"עצור, חושב, בוחר\".",
      "בסוף לוחצים ידיים, לא משנה מי ניצח.",
      "משבחים כל הפסד רגוע."
    ],
    tip: "הדגימו הפסד יפה בקול: \"אוף, הפסדתי. היה משחק טוב – בפעם הבאה.\"",
    related: ["stop", "jenga"]
  },
  delaygame: {
    group: "games",
    icon: "🍬",
    title: "אתגר דחיית סיפוק",
    what: "מציעים בחירה: פרס קטן עכשיו, או כפול אם מחכים 10 דקות. מאריכים את זמן ההמתנה בהדרגה.",
    why: "הוא מתאמן להחזיק דחף ולבחור ב\"אחר כך\" – אותה יכולת שעוזרת לו לעצור כשהוא כועס.",
    howLabel: "איך משחקים",
    how: [
      "בוחרים פרס קטן ואהוב: ממתק, מדבקה או 5 דקות משחק.",
      "מציעים: \"אחד עכשיו, או שניים אם תחכה 10 דקות.\"",
      "מפעילים טיימר שהוא רואה, ונותנים לו משהו לעשות בינתיים.",
      "עומדים בהבטחה מיד כשהטיימר מצלצל."
    ],
    tip: "אם הוא בחר \"עכשיו\" – זה בסדר. בלי ביקורת; מנסים שוב מחר.",
    related: ["delay"]
  },
  roleplay: {
    group: "games",
    icon: "🎭",
    title: "משחק תפקידים: משפט העצירה",
    what: "מדמים מצב מעצבן – אח לוקח משהו, מפסידים במשחק – ומתרגלים \"עצור – נושם – חושב – בוחר\". מתחלפים בתפקידים.",
    why: "אחרי שמתרגלים רגע קשה כמה פעמים בזמן רגוע, קל יותר לבחור נכון גם ברגע אמת – כמו חזרה לפני הצגה.",
    howLabel: "איך משחקים",
    how: [
      "בוחרים מצב אמיתי שקורה בבית.",
      "אתם משחקים את האח, והוא מתרגל לעצור, לנשום, לחשוב ולבחור.",
      "מתחלפים: הוא משחק את האח, ואתם מראים בחירה טובה – או בחירה גרועה ומצחיקה שהוא מתקן.",
      "בסוף שואלים יחד: איזו בחירה עבדה הכי טוב?"
    ],
    tip: "שמרו על אווירה קלילה ומצחיקה, ואל תתרגלו מיד אחרי אירוע אמיתי.",
    related: ["stop"]
  },
  thermo: {
    group: "concepts",
    icon: "🌡️",
    title: "מדחום הרגשות",
    what: "סולם של ארבעה צבעים שעוזר לילד לתאר כמה הרגש חזק: ירוק – רגוע, צהוב – מתעצבן, כתום – כועס, אדום – עומד להתפוצץ.",
    why: "קשה לעצור כעס כשהוא כבר באדום. כשהילד לומד לזהות \"צהוב\", אפשר להשתמש בכלי בזמן, לפני הפיצוץ. הצבעים נותנים לכם שפה משותפת, בלי מילים מסובכות.",
    howLabel: "איך מלמדים",
    how: [
      "מסבירים את ארבעת הצבעים בזמן רגוע, עם דוגמאות מהחיים שלו.",
      "שואלים כמה פעמים ביום: \"איפה אתה במדחום?\"",
      "מדגימים בעצמכם: אומרים בקול כשאתם בצהוב, ומה אתם עושים כדי להירגע.",
      "בלשונית \"רגיעה\" הוא בוחר צבע ומקבל כלים שמתאימים לו."
    ],
    tip: "אין צבע \"רע\". גם אדום הוא מידע – שבחו אותו על כך שזיהה.",
    related: ["balloon", "corner"]
  },
  corner: {
    group: "concepts",
    icon: "🛋️",
    title: "פינת רגיעה",
    what: "פינה נעימה בבית שהילד בוחר ומעצב, ואליה הוא הולך כדי להירגע. זו לא פינת עונש: לא שולחים אליה – מזמינים אליה.",
    why: "מקום שקט ומוכר עוזר לגוף להירגע מהר יותר. כשזו בחירה שלו ולא עונש, הוא לומד שלהירגע זה כוח, לא השפלה.",
    howLabel: "איך עושים",
    how: [
      "בוחרים מקום יחד: פינה בחדר, מתחת לשולחן, ליד חלון.",
      "ממלאים אותה יחד: כרית, שמיכה, כדור לחץ, דפים וצבעים, ספר אהוב.",
      "מתרגלים ללכת אליה כשהוא בירוק, כדי שתהיה מוכרת.",
      "ברגע קשה מציעים: \"רוצה ללכת לפינה שלך?\" – ולא \"לך לפינה!\".",
      "הוא חוזר כשהוא מוכן, ואז משבחים אותו."
    ],
    tip: "אחד היעדים בטבלת הכוכבים יכול להיות \"משתמש בפינת הרגיעה\" – כוכב על כל פעם שהלך אליה בעצמו.",
    related: ["thermo", "robot"]
  },
  stopgame: {
    group: "concepts",
    icon: "🛑",
    title: "משחק עצירה",
    what: "משחק קצר ומצחיק שבו צריך לעצור, לחכות או לעשות הפוך ממה שהגוף רוצה – כמו תופסת קפואה או רמזור. בכל יום האפליקציה מציעה משחק אחר.",
    why: "עצירה היא מיומנות שמתחזקת באימון, כמו שריר. כשמתרגלים אותה בכיף ובלי לחץ, קל יותר להשתמש בה גם בכעס.",
    howLabel: "איך עושים",
    how: [
      "מקדישים 10–15 דקות, עדיף באותה שעה בכל יום.",
      "משחקים את \"המשחק של היום\" מכרטיס \"סדר היום\", או כל משחק אחר מהרשימה.",
      "מתחילים לאט וקל, ומקשים בהדרגה.",
      "משבחים כל עצירה מוצלחת: \"וואו, קפאת בדיוק בזמן!\"",
      "כשמפסידים – מתרגלים גם הפסד בכבוד."
    ],
    tip: "תנו לו להוביל סבב. ילדים שאוהבים לשלוט נהנים להיות \"השופט\" – וזה מלמד להוביל בהגינות.",
    related: ["freeze", "roleplay"]
  },
  one: {
    group: "concepts",
    icon: "💙",
    title: "זמן אחד-על-אחד",
    what: "15 דקות ביום שבהן הורה נמצא רק איתו – בלי אחים ובלי טלפון – והוא בוחר מה עושים.",
    why: "בבית עם שבעה ילדים קשה לקבל תשומת לב חיובית. זמן קבוע שהוא רק שלו נותן לו אותה בדרך טובה, ומפחית את הצורך להשיג אותה בהתנהגות קשה.",
    howLabel: "איך עושים",
    how: [
      "קובעים שעה קבועה ומכריזים: \"זה הזמן שלנו\".",
      "מכבים טלפונים ומרחיקים את האחים – הורה שני או בייביסיטר יכולים לעזור.",
      "הוא בוחר את הפעילות, בתוך גבולות סבירים.",
      "משתתפים, מתארים ומתלהבים – בלי לתקן, בלי שאלות מבחן ובלי ביקורת.",
      "מסיימים בזמן ובחיוך: \"נהניתי איתך. מחר נמשיך.\""
    ],
    tip: "לא מבטלים את הזמן הזה כעונש. הוא קורה גם אחרי יום קשה – ודווקא אז.",
    related: ["praise"]
  },
  consequence: {
    group: "concepts",
    icon: "⚖️",
    title: "תוצאה הגיונית",
    what: "תגובה של ההורה למעשה לא מקובל, שקשורה ישירות למעשה, קצרה ובגודל מתאים. למשל: שבר – עוזר לתקן; היכה במשחק – המשחק נגמר להיום.",
    why: "כשהתוצאה קשורה למעשה, הילד מבין את הקשר בין מה שעשה למה שקרה, ולא מרגיש שמענישים אותו סתם. תוצאה קצרה מאפשרת גם להתחיל מחדש מהר.",
    howLabel: "איך עושים",
    how: [
      "מחכים שכולם יירגעו – לא קובעים תוצאה בשיא הכעס.",
      "בודקים: זה קשור למעשה? זה קצר? זה הוגן?",
      "אומרים בקול רגוע ובקצרה: \"זרקת את המשחק, אז המשחק נגמר להיום.\"",
      "עומדים במה שאמרתם, בלי הרצאה ובלי להוסיף.",
      "למחרת מתחילים דף חדש."
    ],
    tip: "אם קשה לחשוב על תוצאה ברגע, אפשר לומר \"אחשוב על זה ואגיד לך אחר כך\" – ולחזור כשאתם רגועים.",
    related: ["repair"]
  },
  repair: {
    group: "concepts",
    icon: "🔧",
    title: "תיקון",
    what: "אחרי שפגע במישהו או בחפץ, הילד עושה משהו שמתקן – לא רק אומר \"סליחה\": עוזר לבנות מחדש, מביא קרח, מצייר ציור, מחזיר את מה שלקח.",
    why: "תיקון מלמד אחריות בלי בושה: \"טעיתי, ואני יכול לתקן\". הוא גם עוזר לאח שנפגע להרגיש שרואים אותו, ומחזיר את השקט בין האחים.",
    howLabel: "איך עושים",
    how: [
      "מחכים שיירגע, ומדברים בפרטיות – לא מול האחים.",
      "שואלים: \"מה יכול לעזור לו עכשיו להרגיש טוב יותר?\"",
      "נותנים לו לבחור דרך לתקן – אפשר להציע 2–3 רעיונות.",
      "מלווים אותו כשהוא מתקן, ומשבחים את המעשה."
    ],
    tip: "אל תכריחו \"סליחה\" מיד. סליחה בכפייה מלמדת רק להגיד מילים; מעשה קטן של תיקון שווה יותר.",
    related: ["consequence"]
  },
  praise: {
    group: "concepts",
    icon: "👀",
    title: "שבח ספציפי",
    what: "שבח שמתאר בדיוק מה הילד עשה, מיד כשזה קורה. למשל: \"ראיתי שוויתרת לאחיך על התור – זה היה בוגר\", במקום \"כל הכבוד\".",
    why: "ילדים חוזרים על מה שמקבל תשומת לב. שבח ספציפי אומר לו בדיוק מה כדאי לעשות שוב, ומראה לו שרואים גם את הרגעים הטובים, לא רק את הקשים.",
    howLabel: "איך עושים",
    how: [
      "\"תופסים\" אותו מתנהג יפה – גם בדברים קטנים ורגילים.",
      "מתארים את המעשה: \"ראיתי ש…\"",
      "מוסיפים מילה חמה או את ההשפעה: \"…וזה עזר לאחותך.\"",
      "בלי \"אבל\" בסוף, ובלי להזכיר את מה שהיה פעם.",
      "מכוונים ל-5 שבחים ביום, ורושמים ב\"תפסתי אותו מתנהג יפה\"."
    ],
    tip: "מול האחים, שבח בלחישה או אגודל למעלה עובד מצוין – בלי להביך אותו.",
    related: ["bed", "one"]
  },
  delay: {
    group: "concepts",
    icon: "⏳",
    title: "דחיית סיפוק",
    what: "היכולת לחכות למשהו שרוצים – לוותר על \"עכשיו\" בשביל משהו טוב יותר אחר כך.",
    why: "ילד שמתאמן בהמתנה לומד להחזיק דחף לרגע – אותה יכולת שהוא צריך כשאח לוקח לו משהו או כשהוא מפסיד. כמו כל מיומנות, היא משתפרת באימון.",
    howLabel: "איך מלמדים",
    how: [
      "מתחילים בהמתנות קצרות וקלות: \"עוד 2 דקות ונתחיל.\"",
      "משתמשים בטיימר שהוא רואה – קל יותר לחכות כשרואים את הסוף.",
      "מציעים בחירה: פרס קטן עכשיו, או גדול יותר אחרי המתנה (ראו \"אתגר דחיית סיפוק\").",
      "מאריכים את ההמתנה בהדרגה, ומשבחים כל המתנה מוצלחת.",
      "עומדים בהבטחה – תמיד. אחרת אין סיבה לחכות."
    ],
    tip: "עזרו לו למצוא מה לעשות בזמן ההמתנה – לשיר, לספור, לשחק במשהו אחר. כשהידיים עסוקות, קל יותר לחכות.",
    related: ["delaygame"]
  }
};
```
