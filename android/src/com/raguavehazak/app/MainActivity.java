package com.raguavehazak.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Vibrator;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Single-activity wrapper around the bundled web app (assets/index.html).
 *
 * Compiled against android.jar API 23 (minSdk 21, targetSdk 34): every API used here exists
 * on API 21, except where guarded by Build.VERSION.SDK_INT. No lambdas (dx cannot desugar them).
 *
 * JS <-> native contract (see android/README.md):
 *   AndroidBridge.saveFile(filename, mimeType, content)  -> window.__androidSaveResult(true|false)
 *   AndroidBridge.vibrate(ms)                            -> vibration, clamped to 1..1000 ms
 *   AndroidBridge.getAppVersion()                        -> versionName
 *   hardware back -> window.__androidBack() === true means "handled by the page",
 *                    anything else sends the app to the background (moveTaskToBack).
 */
public class MainActivity extends Activity {

    /** Never change this URL: localStorage is keyed by origin, a new URL would "lose" all data. */
    private static final String START_URL = "file:///android_asset/index.html";
    private static final String ASSET_PREFIX = "file:///android_asset/";

    private static final int REQ_FILE_CHOOSER = 1001;
    private static final int REQ_SAVE_FILE = 1002;

    private static final long BACK_TIMEOUT_MS = 1500;
    private static final long MAX_VIBRATE_MS = 1000;
    /** Content waiting for the "create document" picker; a file so it survives process death. */
    private static final String PENDING_SAVE_NAME = "pending-save.tmp";

    // View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR (API 23) / SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR (API 26).
    // Literal values because the latter is not in the API 23 android.jar we compile against.
    private static final int FLAG_LIGHT_STATUS_BAR = 0x00002000;
    private static final int FLAG_LIGHT_NAVIGATION_BAR = 0x00000010;

    /**
     * Safety-net shims injected after every page load (idempotent). They only kick in for code
     * paths that do not use AndroidBridge directly:
     *  - navigator.vibrate(ms | pattern) -> AndroidBridge.vibrate (WebView has no Vibration API);
     *    a pattern becomes one pulse of its total "on" time.
     *  - <a download href="blob:..."> clicks (the classic blob-download export) ->
     *    AndroidBridge.saveFile, because WebView cannot download blob: URLs.
     */
    private static final String SHIM_JS =
            "(function(){"
            + "if(window.__androidShim||!window.AndroidBridge)return;window.__androidShim=true;"
            + "try{Object.defineProperty(navigator,'vibrate',{configurable:true,writable:true,value:function(p){"
            + "var ms=0;if(typeof p==='number'){ms=p;}else if(p&&typeof p.length==='number'){"
            + "for(var i=0;i<p.length;i+=2){ms+=(+p[i])||0;}}"
            + "ms=Math.max(0,Math.min(1000,Math.round(ms)));if(ms>0){AndroidBridge.vibrate(ms);}return true;}});}catch(e){}"
            + "try{var blobs={};var oc=URL.createObjectURL,orv=URL.revokeObjectURL;"
            + "URL.createObjectURL=function(o){var u=oc.apply(URL,arguments);if(o instanceof Blob){blobs[u]=o;}return u;};"
            + "URL.revokeObjectURL=function(u){delete blobs[u];return orv.apply(URL,arguments);};"
            + "document.addEventListener('click',function(ev){"
            + "var a=ev.target&&ev.target.closest?ev.target.closest('a[download]'):null;if(!a)return;"
            + "var b=blobs[a.href]||blobs[a.getAttribute('href')];if(!b)return;"
            + "ev.preventDefault();var name=a.getAttribute('download')||'download';"
            + "var r=new FileReader();r.onload=function(){AndroidBridge.saveFile(name,b.type||'application/octet-stream',String(r.result));};"
            + "r.onerror=function(){window.__androidSaveResult&&window.__androidSaveResult(false);};"
            + "r.readAsText(b);},true);}catch(e){}"
            + "})();";

    private WebView webView;
    private Handler mainHandler;
    private Vibrator vibrator;
    private String versionName = "";

    private ValueCallback<Uri[]> fileCallback;
    private final AtomicBoolean saveInFlight = new AtomicBoolean(false);

    private boolean backPending;
    private int backToken;
    private boolean destroyed;

    // ------------------------------------------------------------------ lifecycle

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Known Android quirk: "Open" from the package installer, then the launcher icon, stacks a
        // second instance on top. Two live pages writing the same localStorage could overwrite
        // newer data with stale data, so drop the duplicate and reveal the original.
        if (!isTaskRoot()) {
            Intent i = getIntent();
            if (i != null && Intent.ACTION_MAIN.equals(i.getAction())
                    && i.hasCategory(Intent.CATEGORY_LAUNCHER)) {
                finish();
                return;
            }
        }

        mainHandler = new Handler(Looper.getMainLooper());
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        try {
            versionName = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            versionName = "";
        }

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        configureWebView(webView);
        setContentView(webView);
        applySystemColors();

        boolean restored = false;
        if (savedInstanceState != null) {
            try {
                restored = webView.restoreState(savedInstanceState) != null;
            } catch (Exception e) {
                restored = false;
            }
        }
        if (!restored) {
            webView.loadUrl(START_URL);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Handled in place (see configChanges in the manifest): the page is NOT reloaded.
        // Resources now resolve against the new uiMode, so re-apply light/dark colours.
        applySystemColors();
    }

    @Override
    protected void onDestroy() {
        destroyed = true;
        if (mainHandler != null) mainHandler.removeCallbacksAndMessages(null);
        fileCallback = null; // the page dies with the WebView; nothing left to resolve
        if (webView != null) {
            ViewGroup parent = (ViewGroup) webView.getParent();
            if (parent != null) parent.removeView(webView);
            webView.stopLoading();
            webView.removeJavascriptInterface("AndroidBridge");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    // ------------------------------------------------------------------ setup

    @SuppressWarnings("SetJavaScriptEnabled")
    private void configureWebView(WebView wv) {
        WebSettings s = wv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);            // localStorage, persisted in the app's data dir
        s.setAllowFileAccess(true);              // default is false for targetSdk >= 30
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);                      // ignore system font scale: layout is px-designed
        s.setSupportMultipleWindows(false);      // window.open -> shouldOverrideUrlLoading
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setGeolocationEnabled(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        wv.setOverScrollMode(View.OVER_SCROLL_NEVER);
        wv.setBackgroundColor(color(R.color.app_bg));
        wv.setWebViewClient(new AppWebViewClient());
        wv.setWebChromeClient(new AppChromeClient());
        wv.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
    }

    @SuppressWarnings("deprecation")
    private int color(int resId) {
        return getResources().getColor(resId); // getColor(int, Theme) is API 23+
    }

    @SuppressWarnings("deprecation")
    private void applySystemColors() {
        int bg = color(R.color.app_bg);
        Window w = getWindow();
        w.setBackgroundDrawable(new ColorDrawable(bg));
        if (webView != null) webView.setBackgroundColor(bg);

        w.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS
                | WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        w.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        w.setStatusBarColor(color(R.color.status_bar));
        w.setNavigationBarColor(color(R.color.nav_bar));

        boolean night = (getResources().getConfiguration().uiMode
                & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        View decor = w.getDecorView();
        int flags = decor.getSystemUiVisibility();
        if (Build.VERSION.SDK_INT >= 23) {
            flags = night ? (flags & ~FLAG_LIGHT_STATUS_BAR) : (flags | FLAG_LIGHT_STATUS_BAR);
        }
        if (Build.VERSION.SDK_INT >= 26) {
            flags = night ? (flags & ~FLAG_LIGHT_NAVIGATION_BAR) : (flags | FLAG_LIGHT_NAVIGATION_BAR);
        }
        decor.setSystemUiVisibility(flags);
    }

    // ------------------------------------------------------------------ back button

    @Override
    public void onBackPressed() {
        if (webView == null) {
            exitApp();
            return;
        }
        if (backPending) return; // a query is already in flight; its answer decides
        backPending = true;
        final int token = ++backToken;
        webView.evaluateJavascript(
                "(function(){try{return window.__androidBack?window.__androidBack()===true:false;}"
                        + "catch(e){return false;}})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (token != backToken || !backPending) return; // timed out already
                        backPending = false;
                        if (!"true".equals(value)) exitApp();
                    }
                });
        // If the page is hung (or never answers), don't trap the user.
        mainHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (token == backToken && backPending) {
                    backPending = false;
                    exitApp();
                }
            }
        }, BACK_TIMEOUT_MS);
    }

    /**
     * Back with nothing left to close sends the task to the background instead of finishing:
     * same as Android 12+'s default for launcher activities, keeps the page (and any half-filled
     * form) alive, and reopening is instant.
     */
    private void exitApp() {
        if (!moveTaskToBack(true)) finish();
    }

    // ------------------------------------------------------------------ activity results

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE_CHOOSER) {
            ValueCallback<Uri[]> cb = fileCallback;
            fileCallback = null;
            if (cb != null) cb.onReceiveValue(resultCode == RESULT_OK ? extractUris(data) : null);
            return;
        }
        if (requestCode == REQ_SAVE_FILE) {
            handleSaveResult(resultCode, data);
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    private static Uri[] extractUris(Intent data) {
        if (data == null) return null;
        ClipData clip = data.getClipData();
        if (clip != null && clip.getItemCount() > 0) {
            int n = 0;
            Uri[] all = new Uri[clip.getItemCount()];
            for (int i = 0; i < clip.getItemCount(); i++) {
                Uri u = clip.getItemAt(i).getUri();
                if (u != null) all[n++] = u;
            }
            if (n > 0) {
                Uri[] out = new Uri[n];
                System.arraycopy(all, 0, out, 0, n);
                return out;
            }
        }
        Uri u = data.getData();
        return u != null ? new Uri[]{u} : null;
    }

    // ------------------------------------------------------------------ file import

    private boolean startFileChooser(boolean multiple) {
        // "*/*": many file managers / Drive tag .json as application/octet-stream or text/plain,
        // and a MIME filter would grey those files out. The page validates the JSON itself.
        String[] actions = {Intent.ACTION_GET_CONTENT, Intent.ACTION_OPEN_DOCUMENT};
        for (String action : actions) {
            Intent i = new Intent(action);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("*/*");
            if (multiple) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            try {
                startActivityForResult(i, REQ_FILE_CHOOSER);
                return true;
            } catch (ActivityNotFoundException e) {
                // try the next action
            } catch (SecurityException e) {
                // try the next action
            }
        }
        return false;
    }

    // ------------------------------------------------------------------ file export

    /** UI thread. */
    private void launchSavePicker(String filename, String mimeType) {
        if (destroyed || isFinishing()) {
            abortSave();
            return;
        }
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(mimeType);
        i.putExtra(Intent.EXTRA_TITLE, filename);
        try {
            startActivityForResult(i, REQ_SAVE_FILE);
        } catch (ActivityNotFoundException e) {
            abortSave();
        } catch (SecurityException e) {
            abortSave();
        }
    }

    /** UI thread. */
    private void abortSave() {
        pendingSaveFile().delete();
        saveInFlight.set(false);
        deliverSaveResult(false);
    }

    /** UI thread. */
    private void handleSaveResult(int resultCode, Intent data) {
        final Uri uri = (resultCode == RESULT_OK && data != null) ? data.getData() : null;
        if (uri == null) { // cancelled
            abortSave();
            return;
        }
        final File pending = pendingSaveFile();
        new Thread(new Runnable() {
            @Override
            public void run() {
                final boolean ok = copyFileToUri(pending, uri);
                pending.delete();
                saveInFlight.set(false);
                mainHandler.post(new Runnable() {
                    @Override
                    public void run() {
                        deliverSaveResult(ok);
                    }
                });
            }
        }, "save-file").start();
    }

    private File pendingSaveFile() {
        return new File(getCacheDir(), PENDING_SAVE_NAME);
    }

    /** Background thread. */
    private boolean copyFileToUri(File src, Uri dst) {
        if (!src.isFile()) return false;
        InputStream in = null;
        OutputStream out = null;
        try {
            try {
                out = getContentResolver().openOutputStream(dst, "wt"); // truncate if it exists
            } catch (Exception e) {
                out = null;
            }
            if (out == null) out = getContentResolver().openOutputStream(dst, "w");
            if (out == null) return false;
            in = new FileInputStream(src);
            byte[] buf = new byte[16 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            out.flush();
            return true;
        } catch (Exception e) {
            return false;
        } finally {
            closeQuietly(in);
            closeQuietly(out);
        }
    }

    /** UI thread. Calls window.__androidSaveResult(ok); falls back to a native toast. */
    private void deliverSaveResult(final boolean ok) {
        if (webView == null || destroyed) return;
        String js = "(function(){var f=window.__androidSaveResult;"
                + "if(typeof f==='function'){f(" + ok + ");return true;}return false;})()";
        webView.evaluateJavascript(js, new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String handled) {
                if (!"true".equals(handled) && !destroyed) {
                    Toast.makeText(MainActivity.this,
                            ok ? R.string.save_ok : R.string.save_failed, Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    /** Called from the JavaBridge thread: posts the result to the UI thread. */
    private void postSaveResult(final boolean ok) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                deliverSaveResult(ok);
            }
        });
    }

    private static String sanitizeFilename(String name) {
        String n = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|\\x00-\\x1f]", "_").trim();
        if (n.length() > 120) n = n.substring(n.length() - 120);
        return n.isEmpty() ? "ragua-vehazak-backup.json" : n;
    }

    private static String sanitizeMime(String mime) {
        if (mime == null) return "application/octet-stream";
        String m = mime.trim().toLowerCase(Locale.ROOT);
        int semi = m.indexOf(';');
        if (semi >= 0) m = m.substring(0, semi).trim();
        return m.matches("[a-z0-9.+_-]+/[a-z0-9.+_-]+") ? m : "application/octet-stream";
    }

    private static void closeQuietly(java.io.Closeable c) {
        if (c == null) return;
        try {
            c.close();
        } catch (IOException ignored) {
            // nothing useful to do
        }
    }

    // ------------------------------------------------------------------ external links

    private void openExternal(Uri uri) {
        Intent i = new Intent(Intent.ACTION_VIEW, uri);
        i.addCategory(Intent.CATEGORY_BROWSABLE);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, R.string.no_browser, Toast.LENGTH_SHORT).show();
        } catch (SecurityException e) {
            Toast.makeText(this, R.string.no_browser, Toast.LENGTH_SHORT).show();
        }
    }

    // ------------------------------------------------------------------ dialogs

    /** Native alert/confirm safety net: RTL, Hebrew buttons, the JsResult is always resolved once. */
    private boolean showJsDialog(String message, final JsResult result, final boolean isConfirm) {
        if (destroyed || isFinishing()) {
            result.cancel();
            return true;
        }
        final boolean[] done = {false};
        AlertDialog.Builder b = new AlertDialog.Builder(this)
                .setMessage(message)
                .setPositiveButton(R.string.ok, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int which) {
                        if (!done[0]) { done[0] = true; result.confirm(); }
                    }
                });
        if (isConfirm) {
            b.setNegativeButton(R.string.cancel, new DialogInterface.OnClickListener() {
                @Override
                public void onClick(DialogInterface d, int which) {
                    if (!done[0]) { done[0] = true; result.cancel(); }
                }
            });
        }
        AlertDialog dialog = b.create();
        dialog.setCanceledOnTouchOutside(false);
        dialog.setOnDismissListener(new DialogInterface.OnDismissListener() {
            @Override
            public void onDismiss(DialogInterface d) {
                // Back key / dismissal: an alert counts as acknowledged, a confirm as "cancel".
                if (!done[0]) {
                    done[0] = true;
                    if (isConfirm) result.cancel(); else result.confirm();
                }
            }
        });
        try {
            dialog.show();
            dialog.getWindow().getDecorView().setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        } catch (RuntimeException e) { // e.g. BadTokenException while the activity is going away
            if (!done[0]) { done[0] = true; result.cancel(); }
        }
        return true;
    }

    // ------------------------------------------------------------------ clients

    private final class AppWebViewClient extends WebViewClient {
        @SuppressWarnings("deprecation")
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            // The (WebView, WebResourceRequest) overload is API 24+; its default delegates here.
            if (url == null) return true;
            if (url.startsWith(ASSET_PREFIX)) return false; // the bundled app itself
            Uri uri = Uri.parse(url);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (scheme.equals("http") || scheme.equals("https") || scheme.equals("mailto")
                    || scheme.equals("tel") || scheme.equals("sms") || scheme.equals("whatsapp")) {
                openExternal(uri);
            }
            return true; // never navigate the app's WebView away from the bundled page
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            if (url != null && url.startsWith(ASSET_PREFIX)) view.evaluateJavascript(SHIM_JS, null);
        }
    }

    private final class AppChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                         FileChooserParams params) {
            // A previous chooser that never returned must be resolved, or WebView stops
            // opening new ones.
            if (fileCallback != null) {
                fileCallback.onReceiveValue(null);
                fileCallback = null;
            }
            boolean multiple = params != null && params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE;
            fileCallback = callback;
            if (startFileChooser(multiple)) return true;
            fileCallback = null;
            callback.onReceiveValue(null); // keep the <input> usable
            Toast.makeText(MainActivity.this, R.string.no_picker, Toast.LENGTH_SHORT).show();
            return true;
        }

        @Override
        public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
            return showJsDialog(message, result, false);
        }

        @Override
        public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
            return showJsDialog(message, result, true);
        }
    }

    // ------------------------------------------------------------------ JS bridge

    /**
     * Exposed as window.AndroidBridge. Methods run on WebView's JavaBridge thread, not the UI
     * thread. Public (with public methods) so the bridge can always reflect on it.
     */
    public final class AndroidBridge {

        @JavascriptInterface
        public void saveFile(String filename, String mimeType, String content) {
            if (!saveInFlight.compareAndSet(false, true)) { // a picker is already open
                postSaveResult(false);
                return;
            }
            final String name = sanitizeFilename(filename);
            final String mime = sanitizeMime(mimeType);
            // Stage the content in the cache dir so it survives the activity/process being
            // killed while the picker is open.
            boolean staged = false;
            OutputStream out = null;
            try {
                out = new FileOutputStream(pendingSaveFile());
                out.write((content == null ? "" : content).getBytes(StandardCharsets.UTF_8));
                out.flush();
                staged = true;
            } catch (IOException e) {
                staged = false;
            } finally {
                closeQuietly(out);
            }
            if (!staged) {
                pendingSaveFile().delete();
                saveInFlight.set(false);
                postSaveResult(false);
                return;
            }
            mainHandler.post(new Runnable() {
                @Override
                public void run() {
                    launchSavePicker(name, mime);
                }
            });
        }

        @JavascriptInterface
        public void vibrate(long ms) {
            if (ms <= 0 || vibrator == null) return;
            try {
                if (vibrator.hasVibrator()) vibrator.vibrate(Math.min(ms, MAX_VIBRATE_MS));
            } catch (RuntimeException ignored) {
                // never let haptics break the page
            }
        }

        @JavascriptInterface
        public String getAppVersion() {
            return versionName;
        }
    }
}
