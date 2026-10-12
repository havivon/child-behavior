#!/usr/bin/env bash
# Builds dist/ragua-vehazak.apk from the CURRENT ../index.html without Gradle / Android SDK
# downloads: aapt -> javac (android.jar API 23) -> dx -> zipalign -> apksigner (v1 + v2).
#
#   ./android/build.sh            # from anywhere; idempotent, always a clean rebuild
#
# Intermediates: android/build/ (gitignored). Output: <repo>/dist/ragua-vehazak.apk
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
BUILD="$HERE/build"
DIST="$ROOT/dist"
APK_NAME="ragua-vehazak.apk"
ANDROID_JAR="/usr/lib/android-sdk/platforms/android-23/android.jar"
KEYSTORE_DIR="$HERE/keystore"
KEYSTORE="$KEYSTORE_DIR/release.jks"
KEYPROPS="$KEYSTORE_DIR/keystore.properties"
ICON_SVG="$ROOT/docs/design/icon.svg"
ICON_FG_SVG="$ROOT/docs/design/icon-foreground.svg"
ICON_BG_SVG="$ROOT/docs/design/icon-background.svg"

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33mWARN: %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

# ----------------------------------------------------------------------------- 1. toolchain
log "Checking toolchain"
pkgs=()
command -v aapt      >/dev/null 2>&1 || pkgs+=(aapt)
command -v zipalign  >/dev/null 2>&1 || pkgs+=(zipalign)
command -v apksigner >/dev/null 2>&1 || pkgs+=(apksigner)
{ command -v dalvik-exchange || command -v dx; } >/dev/null 2>&1 || pkgs+=(dalvik-exchange)
command -v dexdump   >/dev/null 2>&1 || pkgs+=(dexdump)
[ -f "$ANDROID_JAR" ]                || pkgs+=(android-sdk-platform-23)
command -v unzip     >/dev/null 2>&1 || pkgs+=(unzip)
if [ "${#pkgs[@]}" -gt 0 ]; then
  SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
  echo "Installing: ${pkgs[*]}"
  $SUDO apt-get install -y --no-install-recommends "${pkgs[@]}" \
    || { $SUDO apt-get update && $SUDO apt-get install -y --no-install-recommends "${pkgs[@]}"; }
fi
for t in aapt zipalign apksigner javac keytool node unzip; do
  command -v "$t" >/dev/null 2>&1 || die "'$t' not found (javac/keytool: install a JDK >= 11; node: Node.js + global playwright)"
done
DX="$(command -v dalvik-exchange || command -v dx)"
[ -f "$ANDROID_JAR" ] || die "missing $ANDROID_JAR"

# ----------------------------------------------------------------------------- 2. signing key
# The SAME key must sign every future update. A new key = "app not installed" on update, and the
# only way forward is uninstalling, which deletes all of the family's data. Never regenerate.
log "Signing key"
if [ ! -f "$KEYSTORE" ] && [ ! -f "$KEYPROPS" ]; then
  mkdir -p "$KEYSTORE_DIR"
  pw="$(head -c 64 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)"
  keytool -genkeypair -noprompt -storetype PKCS12 -keystore "$KEYSTORE" -alias ragua \
    -keyalg RSA -keysize 2048 -sigalg SHA256withRSA -validity 10950 \
    -dname "CN=Ragua Vehazak" -storepass "$pw" -keypass "$pw" 2>&1 | grep -v JAVA_TOOL_OPTIONS || true
  cat > "$KEYPROPS" <<EOF
# Release signing key for com.raguavehazak.app -- KEEP THIS FILE AND release.jks FOREVER.
# Every update must be signed with this exact key, otherwise Android refuses to install it
# over the existing app and the only fix (uninstall) wipes all data stored in the app.
storeFile=release.jks
storeType=PKCS12
storePassword=$pw
keyAlias=ragua
keyPassword=$pw
EOF
  echo "Generated new release key: $KEYSTORE"
elif [ ! -f "$KEYSTORE" ] || [ ! -f "$KEYPROPS" ]; then
  die "only one of release.jks / keystore.properties exists in $KEYSTORE_DIR. Restore the missing file from backup; do NOT generate a new key (updates would fail to install)."
fi
prop() { sed -n "s/^$1=//p" "$KEYPROPS" | head -n1 | tr -d '\r'; }
KS_PASS="$(prop storePassword)"; KEY_PASS="$(prop keyPassword)"; KEY_ALIAS="$(prop keyAlias)"
[ -n "$KS_PASS" ] && [ -n "$KEY_ALIAS" ] || die "storePassword/keyAlias missing in $KEYPROPS"
[ -n "$KEY_PASS" ] || KEY_PASS="$KS_PASS"
export KS_PASS KEY_PASS

# ----------------------------------------------------------------------------- 3. clean tree
log "Preparing $BUILD"
rm -rf "$BUILD"
mkdir -p "$BUILD"/{assets,gen,classes,res} "$DIST"

# ----------------------------------------------------------------------------- 4. web assets
[ -f "$ROOT/index.html" ] || die "missing $ROOT/index.html"
cp "$ROOT/index.html" "$BUILD/assets/index.html"
echo "assets/index.html <- index.html ($(wc -c < "$ROOT/index.html") bytes, sha256 $(sha256sum "$ROOT/index.html" | cut -c1-12))"
# Only index.html is bundled. Warn if it starts referencing other local files.
refs="$(grep -oE '(src|href)="[^"#:?]+\.(js|css|png|jpe?g|svg|webp|woff2?|ttf|json|mp3|wav)"' "$ROOT/index.html" | sort -u || true)"
[ -z "$refs" ] || warn "index.html references local files that are NOT bundled: $(echo "$refs" | tr '\n' ' ')"

# ----------------------------------------------------------------------------- 5. resources + icons
log "Resources and launcher icons"
cp -R "$HERE/res/." "$BUILD/res/"
if [ -f "$ICON_SVG" ]; then
  src_icon="$ICON_SVG"
else
  src_icon="$HERE/tools/placeholder-icon.svg"
  warn "docs/design/icon.svg not found, using placeholder icon"
fi
layer_args=()
if [ -f "$ICON_SVG" ] && [ -f "$ICON_FG_SVG" ]; then
  layer_args+=(--fg "$ICON_FG_SVG")
  [ -f "$ICON_BG_SVG" ] && layer_args+=(--bg "$ICON_BG_SVG")
fi
node "$HERE/tools/render-icons.js" "$src_icon" "$BUILD/res" "${layer_args[@]}"

# ----------------------------------------------------------------------------- 6. aapt package
log "aapt: packaging manifest, resources, assets"
# -0 arsc: resources.arsc must be stored uncompressed (Android 11+ refuses targetSdk>=30 APKs otherwise)
aapt package -f -m \
  -M "$HERE/AndroidManifest.xml" \
  -S "$BUILD/res" \
  -A "$BUILD/assets" \
  -I "$ANDROID_JAR" \
  -J "$BUILD/gen" \
  -0 arsc \
  -F "$BUILD/app.unaligned.apk"

# ----------------------------------------------------------------------------- 7. compile
log "javac (Java 8 bytecode against android.jar API 23)"
find "$HERE/src" "$BUILD/gen" -name '*.java' > "$BUILD/sources.txt"
javac -source 8 -target 8 -encoding UTF-8 -Xlint:all,-options \
  -bootclasspath "$ANDROID_JAR" -classpath "$ANDROID_JAR" \
  -d "$BUILD/classes" @"$BUILD/sources.txt" 2>&1 | grep -v '^Picked up JAVA_TOOL_OPTIONS' || true
[ -f "$BUILD/classes/com/raguavehazak/app/MainActivity.class" ] || die "javac failed"

log "dx -> classes.dex"
"$DX" --dex --min-sdk-version=21 --output="$BUILD/classes.dex" "$BUILD/classes" 2>&1 \
  | grep -v '^Picked up JAVA_TOOL_OPTIONS' || true
[ -s "$BUILD/classes.dex" ] || die "dx failed"
(cd "$BUILD" && aapt add -f app.unaligned.apk classes.dex >/dev/null)

# ----------------------------------------------------------------------------- 8. align + sign
log "zipalign + apksigner (v1 + v2)"
zipalign -f -p 4 "$BUILD/app.unaligned.apk" "$BUILD/app.aligned.apk"
apksigner sign \
  --ks "$KEYSTORE" --ks-key-alias "$KEY_ALIAS" \
  --ks-pass env:KS_PASS --key-pass env:KEY_PASS \
  --min-sdk-version 21 \
  --v1-signing-enabled true --v2-signing-enabled true \
  --out "$BUILD/app.signed.apk" "$BUILD/app.aligned.apk" 2>&1 | grep -v '^Picked up JAVA_TOOL_OPTIONS' || true
[ -s "$BUILD/app.signed.apk" ] || die "apksigner failed"

# ----------------------------------------------------------------------------- 9. verify
log "Verifying"
zipalign -c 4 "$BUILD/app.signed.apk" || die "zipalign check failed"
apksigner verify --verbose --print-certs "$BUILD/app.signed.apk" 2>&1 | grep -v '^Picked up JAVA_TOOL_OPTIONS' \
  | tee "$BUILD/verify.txt"
grep -q '^Verified using v1 scheme (JAR signing): true' "$BUILD/verify.txt" || die "v1 signature missing"
grep -q '^Verified using v2 scheme (APK Signature Scheme v2): true' "$BUILD/verify.txt" || die "v2 signature missing"
unzip -v "$BUILD/app.signed.apk" | awk '$NF=="resources.arsc" && $2!="Stored"{bad=1} END{exit bad}' \
  || die "resources.arsc is compressed"
for f in AndroidManifest.xml classes.dex resources.arsc assets/index.html \
         res/mipmap-xxxhdpi-v4/ic_launcher.png res/mipmap-anydpi-v26/ic_launcher.xml; do
  unzip -l "$BUILD/app.signed.apk" "$f" >/dev/null 2>&1 || die "$f missing from APK"
done
cmp -s <(unzip -p "$BUILD/app.signed.apk" assets/index.html) "$ROOT/index.html" || die "bundled index.html differs"
echo
aapt dump badging "$BUILD/app.signed.apk" | grep -E "^(package|sdkVersion|targetSdkVersion|application-label|uses-permission|launchable-activity|application:)" || true

cp "$BUILD/app.signed.apk" "$DIST/$APK_NAME"
log "Done: $DIST/$APK_NAME ($(du -h "$DIST/$APK_NAME" | cut -f1), sha256 $(sha256sum "$DIST/$APK_NAME" | cut -d' ' -f1))"
