#!/usr/bin/env node
// Renders Android launcher icons from SVG with Playwright's Chromium.
//
// usage: node render-icons.js <icon.svg> <outResDir> [--fg <icon-foreground.svg>] [--bg <icon-background.svg>]
//
// Produces in <outResDir>:
//   mipmap-<dpi>/ic_launcher.png             legacy icon (API 21-25): rounded square from icon.svg
//   mipmap-<dpi>/ic_launcher_foreground.png  adaptive foreground layer (108dp canvas)
//   mipmap-<dpi>/ic_launcher_background.png  adaptive background layer (only with --bg)
//   mipmap-anydpi-v26/ic_launcher.xml        <adaptive-icon> (API 26+)
//   values/ic_launcher_colors.xml            solid background colour (used when there is no --bg)
//
// Adaptive-icon mapping (layers are 108dp, the launcher shows the central 72dp through its mask):
//  * --fg given: the designer's foreground/background SVGs are adaptive layers already
//    (512 canvas == 108dp, artwork inside the central 66% safe circle), so they fill the canvas.
//    Without --bg the background is a solid colour averaged from icon.svg's edges.
//  * no --fg: the full-bleed icon.svg is scaled to exactly the visible 72dp viewport, so the
//    mask crops it like any full-bleed icon; the solid background only shows during parallax.
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));

const argv = process.argv.slice(2);
const opt = name => { const i = argv.indexOf(name); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const fgSvg = opt('--fg'), bgSvg = opt('--bg');
const [iconSvg, outDir] = argv;
if (!iconSvg || !outDir) { console.error('usage: render-icons.js <icon.svg> <outResDir> [--fg fg.svg] [--bg bg.svg]'); process.exit(2); }

const DPIS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const dataUrl = f => 'data:image/svg+xml;base64,' + fs.readFileSync(f).toString('base64');
const iconUrl = dataUrl(iconSvg);
const fgUrl = fgSvg ? dataUrl(fgSvg) : iconUrl;

function html(size, img, { inset = 0, radius = 0 } = {}) {
  const inner = size - 2 * inset;
  return `<!doctype html><html><head><style>html,body{margin:0;background:transparent}
  #box{position:absolute;left:${inset}px;top:${inset}px;width:${inner}px;height:${inner}px;
  border-radius:${radius}px;overflow:hidden}
  #box img{display:block;width:100%;height:100%}</style></head>
  <body><div id="box"><img src="${img}"></div></body></html>`;
}

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    async function shot(size, img, opts, file) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(html(size, img, opts));
      await page.waitForFunction(() => { const i = document.querySelector('img'); return i.complete && i.naturalWidth > 0; });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    }
    for (const [dpi, k] of Object.entries(DPIS)) {
      const dir = path.join(outDir, 'mipmap-' + dpi);
      const legacy = Math.round(48 * k);
      // Legacy: 1dp margin, rounded-square (about 18% corner radius), like stock legacy icons.
      await shot(legacy, iconUrl, { inset: Math.round(1 * k), radius: Math.round(legacy * 0.18) }, path.join(dir, 'ic_launcher.png'));
      const layer = Math.round(108 * k);
      await shot(layer, fgUrl, { inset: fgSvg ? 0 : Math.round(18 * k) }, path.join(dir, 'ic_launcher_foreground.png'));
      if (fgSvg && bgSvg) await shot(layer, dataUrl(bgSvg), {}, path.join(dir, 'ic_launcher_background.png'));
    }
    // Solid background colour: average of icon.svg's edge pixels (corners + edge midpoints).
    await page.setViewportSize({ width: 64, height: 64 });
    await page.setContent('<!doctype html><body></body>');
    let bg = await page.evaluate(async (src) => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement('canvas'); c.width = c.height = 512;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, 512, 512);
      const pts = [[6, 6], [256, 6], [505, 6], [6, 256], [505, 256], [6, 505], [256, 505], [505, 505]];
      const sum = [0, 0, 0];
      for (const [px, py] of pts) {
        const d = x.getImageData(px, py, 1, 1).data;
        if (d[3] < 250) return null; // not full-bleed
        for (let j = 0; j < 3; j++) sum[j] += d[j];
      }
      return '#' + sum.map(v => Math.round(v / pts.length).toString(16).padStart(2, '0')).join('');
    }, iconUrl).catch(() => null);
    if (!bg) bg = '#21958a';
    fs.mkdirSync(path.join(outDir, 'values'), { recursive: true });
    fs.writeFileSync(path.join(outDir, 'values', 'ic_launcher_colors.xml'),
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${bg}</color>\n</resources>\n`);
    fs.mkdirSync(path.join(outDir, 'mipmap-anydpi-v26'), { recursive: true });
    const bgRef = fgSvg && bgSvg ? '@mipmap/ic_launcher_background' : '@color/ic_launcher_background';
    fs.writeFileSync(path.join(outDir, 'mipmap-anydpi-v26', 'ic_launcher.xml'),
      `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n` +
      `    <background android:drawable="${bgRef}" />\n` +
      `    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n</adaptive-icon>\n`);
    // No <monochrome> layer: the foreground's translucent rings/shadows would tint into blobs.
    console.log(`icons: legacy from ${path.basename(iconSvg)}; adaptive fg ${path.basename(fgSvg || iconSvg)}` +
      `, bg ${fgSvg && bgSvg ? path.basename(bgSvg) : bg}`);
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
