# רגוע וחזק – Android app

A thin, signed Android wrapper around the single-file web app (`../index.html`): one
`MainActivity` with a full-screen `WebView` that loads `file:///android_asset/index.html`.
All data stays in the WebView's `localStorage` on the phone. The app has no INTERNET permission.

| | |
|---|---|
| Package | `com.raguavehazak.app` |
| Version | versionCode `1`, versionName `1.0.0` (in `AndroidManifest.xml`) |
| SDK | minSdk 21 (Android 5.0), targetSdk 34 |
| Permissions | `VIBRATE` only |
| Output | `<repo>/dist/ragua-vehazak.apk` (signed with APK Signature Scheme v1, v2 and v3) |

## Build

```bash
./android/build.sh
```

The script always does a clean rebuild and is safe to run again. It:

1. installs any missing apt packages (`aapt zipalign apksigner dalvik-exchange dexdump android-sdk-platform-23 unzip`),
2. creates the release key the first time only (see [Signing key](#signing-key-keep-it-forever)),
3. copies the **current** `../index.html` into the APK's assets. Only that one file is bundled, and the script warns if the page starts referencing other local files,
4. renders the launcher icons from `docs/design/icon.svg` (plus `icon-foreground.svg` / `icon-background.svg` for the adaptive icon), or from `android/tools/placeholder-icon.svg` if `icon.svg` doesn't exist,
5. `aapt` (manifest + resources + assets, generates `R.java`) → `javac` (Java 8 bytecode against `android.jar` API 23) → `dx` → `zipalign` → `apksigner`,
6. verifies the result: signatures, zip alignment, that `resources.arsc` is stored uncompressed (required for targetSdk ≥ 30), that the required entries are present, and that the bundled `index.html` is byte-identical to `../index.html`. It then prints `aapt dump badging`.

Requirements: Ubuntu/Debian with apt, a JDK (11 or newer; 21 is used here), and Node.js with a
global `playwright` install that includes Chromium (used for the icons). No Android SDK download,
Gradle or Android Gradle Plugin is needed.
Intermediates go to `android/build/`, which is gitignored.

**Releasing an update:** bump **both** `android:versionCode` (an integer that must always go up) and
`android:versionName` in `AndroidManifest.xml`, then run the script. Android refuses an "update"
with the same or a lower versionCode.

### Icons

`android/tools/render-icons.js` renders the icons with Playwright:

- **Legacy icons (API 21–25):** `mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher.png` at 48/72/96/144/192 px. Each is a rounded square with a 1dp margin.
- **Adaptive icon (API 26+):** `mipmap-anydpi-v26/ic_launcher.xml`.
  - If `docs/design/icon-foreground.svg` exists, it and `icon-background.svg` are used as the two adaptive layers. Each 512 canvas fills the whole 108dp layer, and the designer keeps the artwork inside the central 66% safe circle. If there is no background SVG, the background is a solid color averaged from `icon.svg`'s edges.
  - Otherwise, the full-bleed `icon.svg` is scaled to the visible 72dp viewport, and the launcher mask crops its corners.
  - There is no monochrome (themed-icon) layer, because the foreground's translucent rings and shadows would tint into blobs.

No `android:roundIcon` is set because that attribute is newer than the API 23 `android.jar` the
build uses. API 26+ launchers apply their own round mask to the adaptive icon.

## Signing key: keep it forever

`android/keystore/release.jks` (PKCS12, RSA 2048, valid for 30 years, `CN=Ragua Vehazak`, alias `ragua`)
and its password in `android/keystore/keystore.properties` are **meant to be committed** to the repo.

The client installs updates by sideloading. Android installs an update only if it is signed with the
**same key** as the installed app. If the key is lost, every new APK fails with "App not installed".
The only way out is to uninstall the app, and **uninstalling deletes all the family's data**.
So:

- never delete or regenerate the key. `build.sh` refuses to create a new key if either of the two files exists without the other,
- keep a second copy of both files outside the repo (for example in a password manager),
- the certificate's SHA-256 fingerprint is printed by `apksigner verify --print-certs dist/ragua-vehazak.apk`.

Never change the package name or the start URL (`file:///android_asset/index.html`) either.
`localStorage` belongs to the app and to that URL's origin, so changing either one makes the existing data inaccessible.

## Installing on a phone

1. Copy `ragua-vehazak.apk` to the phone (WhatsApp/Telegram to yourself, Google Drive, e-mail, or USB).
2. Tap the file. Android asks you to allow installs from that app ("Install unknown apps" / "התקנת אפליקציות לא מוכרות"). Allow it for the app you opened the file from (Files, Chrome, WhatsApp, ...).
3. Tap **Install** (התקנה). Google Play Protect may warn about an unknown developer. Choose "Install anyway" / "התקנה בכל זאת". This is expected for apps that aren't distributed through the Play Store.
4. Open "רגוע וחזק" from the home screen or app drawer.

**Updating:** open the newer APK the same way and tap **Update**. The data is kept, provided the APK
is signed with the same key and has a higher versionCode.
**Before uninstalling or switching phones:** go to Settings (⚙️) and export a JSON backup first.
`android:allowBackup="false"` is set because the data is meant to stay on the phone only, so Google
backup will **not** restore it.

The page uses modern CSS. Keep "Android System WebView" / Chrome up to date via the Play Store,
especially on Android 5–9.

## JS ↔ native contract (for `index.html`)

Detect the wrapper with `window.AndroidBridge`. Bridge methods are synchronous from JS's point of view.
On the native side they run on a background thread.

```js
const isAndroidApp = !!window.AndroidBridge;

// 1. Save a file (JSON export). Opens the system "Save as" (create document) picker
//    prefilled with the filename. No storage permission is needed. The content is written as UTF-8.
window.__androidSaveResult = ok => toast(ok ? 'קובץ הגיבוי נשמר' : 'השמירה בוטלה');
AndroidBridge.saveFile('ragua-vehazak-2026-10-12.json', 'application/json', json);

// 2. Haptics. Android WebView does not implement navigator.vibrate. ms is clamped to 1..1000.
AndroidBridge.vibrate(30);

// 3. App version (versionName), e.g. "1.0.0".
AndroidBridge.getAppVersion();

// 4. Hardware back. Return true if you handled it (closed an overlay/modal, went back to the home tab).
//    Return anything else (or don't define the function) and the app goes to the background.
window.__androidBack = () => { if (overlayOpen) { closeOverlay(); return true; } return false; };
```

Details:

- **`saveFile(filename, mimeType, content)`**: the native side calls `window.__androidSaveResult(true|false)` on the UI thread once the file is written (`true`), or when the user cancels or the write fails (`false`). If `__androidSaveResult` isn't defined, a native toast is shown instead. Only one save can be open at a time: a second call made while the picker is showing gets `false` immediately. Path characters in `filename` are replaced. An invalid `mimeType` becomes `application/octet-stream`.
- **`__androidBack`** must return a boolean **synchronously** (a Promise counts as "not handled"). Native evaluates it, and if the page doesn't answer within 1.5 s, the app goes to the background anyway. "Exit" is implemented as `moveTaskToBack(true)`, not `finish()`. This matches Android 12+'s default for launcher activities, keeps the page and any half-filled form alive, and makes reopening instant.
- **File import** (`<input type="file">`) works unchanged. The picker shows all files (`*/*`), because many file managers and Drive tag `.json` files as `application/octet-stream`, so the page must validate the JSON itself (it already does). Cancelling resolves the input with no file, and the input keeps working afterwards.
- **`alert()` / `confirm()`** show native RTL dialogs with "אישור" / "ביטול". Back counts as "ביטול" for `confirm()`. These are only a safety net. In-app modals look better.
- **External links** (`http(s):`, `mailto:`, `tel:`, `sms:`, `whatsapp:`) open in the system browser or app. The WebView never navigates away from the bundled page.

### No injected shims

The page calls the bridge directly: `vibrate()` uses `AndroidBridge.vibrate` whenever it exists,
and `exportData()` uses `AndroidBridge.saveFile` and returns before the blob-download path.
Native code therefore injects **no** JavaScript. An earlier build injected a fallback that patched
`navigator.vibrate`, `URL.createObjectURL` and `<a download>` clicks. It was removed once the page
integrated the bridge, because it no longer did anything and patching globals is a risk with no benefit.
Keep calling `AndroidBridge` directly. Android WebView has no `navigator.vibrate` or `navigator.share`
and cannot download `blob:` URLs, and the WebView blocks any navigation away from the bundled page.

## WebView behavior

- JavaScript and DOM storage are on. `localStorage` persists in the app's private data directory across restarts and updates, and is removed on uninstall. File access is on (needed for `file://`), but universal/file-URL cross access is off and mixed content is blocked.
- Text zoom is fixed at 100%, so the system font size doesn't break the px-based layout. Pinch zoom is disabled and there is no overscroll glow.
- Rotation (the app is locked to portrait anyway), keyboard, dark-mode, font-scale and locale changes are handled in place (`configChanges`), so the page is never reloaded. If Android does recreate the activity (for example after the process was killed in the background), the WebView state is restored.
- Colors match the page's design tokens, so there's no seam at the top or bottom and no white flash on launch:

  | | Light | Dark |
  |---|---|---|
  | Window and WebView background (`--bg`) | `#eef7f6` | `#0d1b1e` |
  | Status bar = top bar (`--bg-grad`, also the `theme-color` meta) | `#e0f0f3`, dark icons (API 23+) | `#10232a` |
  | Navigation bar = bottom nav (`--surface`) | `#ffffff`, dark icons (API 26+) | `#16292d` |

  Older Android can't draw dark system-bar icons. On API 21–22 the light status bar is the accent `#1a7f76` (white icons), and on API 21–25 the light navigation bar is `#12313a` (`--text`). If the tokens change, update `res/values*/colors.xml`.
- The page's `prefers-color-scheme` follows the app theme (`values` / `values-night`). With targetSdk 33+, WebView derives it from the theme's `isLightTheme`.
- Opening the app from the installer and then from the launcher would normally stack a second instance on top. That second instance closes itself immediately, so two pages never write the same `localStorage`.
- `android:windowSoftInputMode="adjustResize"`: the keyboard resizes the page instead of covering inputs.

## Files

```
android/
  build.sh                     build script (the only entry point)
  AndroidManifest.xml          package, versions, permissions, activity
  src/com/raguavehazak/app/MainActivity.java
  res/values*/                 strings (Hebrew), colors, themes (light / night / v23 / v26)
  tools/render-icons.js        SVG -> launcher PNGs + adaptive icon XML (Playwright)
  tools/placeholder-icon.svg   used until docs/design/icon.svg exists
  keystore/release.jks         release signing key (commit it, back it up)
  keystore/keystore.properties its password
  build/                       intermediates (gitignored)
```

## Known limitations

- Not tested on a device or emulator, because no emulator was available where this was built. The checks so far are static: `apksigner verify`, `aapt dump badging` / `xmltree`, `dexdump`, and API-level review of every framework call (all are API ≤ 21). Smoke-test on a real phone before handing it out: install, add data, kill and reopen the app, import, export, back button, dark mode.
- Live dark-mode switching while the app is open relies on the WebView re-reading the theme after the in-place configuration change. If the page doesn't switch until the app is restarted, remove `uiMode` from `configChanges`. The activity will then be recreated, and the page reloaded, on a theme change.
- `localStorage` writes are flushed to disk by Chromium after a short delay. If the process is killed within a second or two of a change, that change can be lost (rare).
