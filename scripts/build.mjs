// 正式版建置：打包 JS／CSS 為內容雜湊檔名，避免瀏覽器快取到舊版（npm run build → dist/）
import * as esbuild from "esbuild";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const APP_CSS = ["css/base.css", "css/panels.css", "css/dialogs.css", "css/canvas.css"];
const GUIDES = ["guide.html", "guide.en.html"];
const COPY = ["PROMPT.md", "LICENSE", "CNAME", ".nojekyll", "examples", "docs"];

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, "assets"), { recursive: true });

const common = {
  bundle: true,
  minify: true,
  sourcemap: true,
  outdir: path.join(DIST, "assets"),
  metafile: true,
  logLevel: "warning",
};
const outputOf = (meta, ext) => path.basename(Object.keys(meta.outputs).find(f => f.endsWith(ext)));

// JS：單一 ESM bundle
const js = await esbuild.build({
  ...common,
  entryPoints: { app: "src/main.js" },
  format: "esm",
  target: "es2022",
  entryNames: "[name]-[hash]",
  absWorkingDir: ROOT,
});
// CSS：依原本載入順序合併
const css = await esbuild.build({
  ...common,
  stdin: {
    contents: APP_CSS.map(f => `@import "./${f}";`).join("\n"),
    resolveDir: ROOT,
    loader: "css",
    sourcefile: "app.css",
  },
  entryNames: "app-[hash]",
  absWorkingDir: ROOT,
});
const guideCss = await esbuild.build({
  ...common,
  entryPoints: { guide: "css/guide.css" },
  entryNames: "[name]-[hash]",
  absWorkingDir: ROOT,
});

const appJs = outputOf(js.metafile, ".js"),
  appCss = outputOf(css.metafile, ".css"),
  gCss = outputOf(guideCss.metafile, ".css");

// index.html：換成打包後的檔案
let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const links = APP_CSS.map(f => `<link rel="stylesheet" href="${f}">`);
for (const l of links) if (!html.includes(l)) throw new Error("index.html 找不到：" + l);
html = html.replace(links.join("\n"), `<link rel="stylesheet" href="assets/${appCss}">`);
const entry = '<script type="module" src="src/main.js"></script>';
if (!html.includes(entry)) throw new Error("index.html 找不到進入點 script");
html = html.replace(entry, `<script type="module" src="assets/${appJs}"></script>`);
fs.writeFileSync(path.join(DIST, "index.html"), html);

// 使用教學頁（中／英）：CSS 換成雜湊檔，圖片加上內容版本號
const imgHash = src =>
  crypto
    .createHash("sha1")
    .update(fs.readFileSync(path.join(ROOT, src)))
    .digest("hex")
    .slice(0, 8);
for (const page of GUIDES) {
  const guide = fs
    .readFileSync(path.join(ROOT, page), "utf8")
    .replace('href="css/guide.css"', `href="assets/${gCss}"`)
    .replace(/src="(docs\/img\/[^"?]+)"/g, (m, src) =>
      fs.existsSync(path.join(ROOT, src)) ? `src="${src}?v=${imgHash(src)}"` : m,
    );
  fs.writeFileSync(path.join(DIST, page), guide);
}

for (const f of COPY)
  if (fs.existsSync(path.join(ROOT, f))) fs.cpSync(path.join(ROOT, f), path.join(DIST, f), { recursive: true });

const size = f => (fs.statSync(path.join(DIST, "assets", f)).size / 1024).toFixed(1) + " KB";
console.log(`dist/ 建置完成：${appJs}（${size(appJs)}）、${appCss}（${size(appCss)}）、${gCss}`);
