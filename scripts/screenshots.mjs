// 產生使用教學（guide.html）用的截圖：npm run screenshots
// 一律使用 examples/sample-project.json 的範例格局，不含任何真實住家資料
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "img");
const PORT = 4320;
fs.mkdirSync(OUT, { recursive: true });

const server = await serve(PORT);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
page.on("dialog", d => d.accept(d.type() === "prompt" ? d.defaultValue() || "範例" : undefined));
const shot = (name, clip) => page.screenshot({ path: path.join(OUT, name + ".png"), clip });
const ev = (fn, arg) => page.evaluate(fn, arg);
const sample = JSON.parse(fs.readFileSync(path.join(ROOT, "examples", "sample-project.json"), "utf8"));

await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await ev(() => {
  localStorage.clear();
  localStorage.setItem("hl-tip-off", "1");
});
await page.reload();

// 1. 匯入畫面
await shot("gate", { x: 360, y: 60, width: 720, height: 780 });

// 2. 載入範例專案 → 整體介面
await ev(d => window.__fp.loadData(d, "範例兩房"), sample);
await page.waitForTimeout(2600); // 等「已建立專案」提示消失
await ev(() => {
  window.__fp.state.sel = null;
  document.querySelector('[data-ptab="props"]')?.click();
});
await page.waitForTimeout(300);
await shot("overview");

// 3. 選取單一物件 → 屬性面板
await ev(() => {
  const f = window.__fp;
  f.state.sel = f.state.items.find(i => i.type === "sofa").id;
  document.querySelector('[data-ptab="props"]').click();
});
await shot("props", { x: 1172, y: 86, width: 268, height: 520 });

// 4. 多選對齊
await ev(() => {
  const f = window.__fp;
  const ids = f.state.items.filter(i => ["tv", "fridge"].includes(i.type)).map(i => i.id);
  f.state.sel = ids[0];
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  f.state.sel = ids[0];
});
await page.click(
  `#itemLayer .item[data-id="${await ev(() => window.__fp.state.items.find(i => i.type === "tv").id)}"]`,
);
await page.click(
  `#itemLayer .item[data-id="${await ev(() => window.__fp.state.items.find(i => i.type === "fridge").id)}"]`,
  {
    modifiers: ["Shift"],
  },
);
await shot("multi", { x: 1172, y: 86, width: 268, height: 560 });

// 5. 右鍵選單
const box = await page.locator('#itemLayer .item[data-id="1"]').boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" });
await shot("context", { x: box.x - 40, y: box.y - 40, width: 420, height: 460 });
await page.keyboard.press("Escape");
await page.mouse.click(700, 120);

// 6. 選單列（檔案）
await page.click('#menubar .mb[data-menu="file"]');
await shot("menu", { x: 0, y: 0, width: 520, height: 420 });
await page.keyboard.press("Escape");

// 7. 元件庫
await shot("palette", { x: 0, y: 86, width: 236, height: 560 });

// 8. 分頁列與縮放列
await shot("sheets", { x: 236, y: 860, width: 1204, height: 40 });

// 9. 疊圖比較
await ev(() => {
  const sel = document.getElementById("selGhost");
  sel.value = sel.options[1].value;
  sel.dispatchEvent(new Event("change"));
});
await page.waitForTimeout(200);
await shot("ghost", { x: 236, y: 86, width: 936, height: 774 });
await ev(() => {
  const sel = document.getElementById("selGhost");
  sel.value = "";
  sel.dispatchEvent(new Event("change"));
});

// 10. 並排比較
await page.click("#shCmp");
await page.waitForTimeout(300);
await shot("compare");
await page.click("#cmpClose");

// 11. 底圖編輯
await ev(() => {
  document.querySelector('#menubar .mb[data-menu="base"]').click();
  [...document.querySelectorAll("#menuPop .mi")].find(d => d.textContent.includes("編輯底圖")).click();
  document.querySelector('#basePal [data-tool="wall"]').click();
});
await page.waitForTimeout(200);
await shot("base-edit");
await ev(() => document.getElementById("basePalDone").click());

// 12. 組合曲線元件
await ev(() => {
  const f = window.__fp;
  f.switchDesign(1);
  f.state.sel = f.state.items.find(i => i.type === "curveSlide").id;
  document.querySelector('[data-ptab="props"]').click();
});
await page.waitForTimeout(200);
await shot("curve", { x: 900, y: 86, width: 540, height: 600 });

// 13. AI 產生底圖
await ev(() => {
  document.querySelector('#menubar .mb[data-menu="base"]').click();
  [...document.querySelectorAll("#menuPop .mi")].find(d => d.textContent.includes("AI 產生底圖")).click();
});
await shot("ai", { x: 330, y: 60, width: 780, height: 780 });

await browser.close();
server.close();
console.log("截圖已輸出到", path.relative(ROOT, OUT));
