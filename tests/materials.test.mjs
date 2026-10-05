// 材質模組測試：材質庫、挑選器、自訂材質（存檔、復原）、3D 與 SVG 材質
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { serve } from "../scripts/serve.mjs";
import { chromium } from "playwright";

const PORT = (+process.env.TEST_PORT || 4199) + 1,
  URL = `http://127.0.0.1:${PORT}/index.html`;
const BASE = {
  app: "house-layout-base",
  version: 1,
  unit: "cm",
  name: "材質測試",
  walls: [
    [0, 0, 500, 0, 20, []],
    [500, 0, 500, 400, 20, []],
    [500, 400, 0, 400, 20, []],
    [0, 400, 0, 0, 20, []],
  ],
};

let server, browser, page;
const errors = [];
test.before(async () => {
  server = await serve(PORT, process.env.TEST_ROOT ? path.resolve(process.env.TEST_ROOT) : undefined);
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => {
    if (m.type() === "error" && !/favicon/.test(m.text())) errors.push(m.text());
  });
  page.on("dialog", d => d.accept(d.type() === "prompt" ? d.defaultValue() || "測試" : undefined));
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});
test.after(async () => {
  await browser?.close();
  server?.close();
});
const ev = (fn, arg) => page.evaluate(fn, arg);

test("內建材質庫：數量足夠、id 不重複、必要的預設材質存在", async () => {
  const r = await ev(() => {
    const all = window.__materials.allMats();
    return {
      n: all.length,
      uniq: new Set(all.map(m => m.id)).size,
      need: ["floor-oak-natural", "paint-white", "ceil-white", "wood-white"].every(
        id => window.__materials.getMat(id).name !== "?",
      ),
      cats: new Set(all.map(m => m.cat)).size,
    };
  });
  assert.ok(r.n >= 70, `材質數量 ${r.n}`);
  assert.equal(r.uniq, r.n);
  assert.ok(r.need);
  assert.ok(r.cats >= 12);
});

test("設計選單開啟材質庫（瀏覽模式），可分類與搜尋", async () => {
  await ev(b => window.__fp.loadData(b, "m"), BASE);
  await page.click('#menubar .mb[data-menu="design"]');
  await ev(() => [...document.querySelectorAll("#menuPop .mi")].find(d => d.textContent.includes("材質庫")).click());
  await page.waitForSelector("#matModal.show");
  const all = await page.locator("#matGrid .mcard").count();
  assert.ok(all >= 70);
  assert.equal(await page.locator("#matOk").isHidden(), true);
  await page.click('#matCats [data-cat="glass"]');
  const glass = await page.locator("#matGrid .mcard").count();
  assert.ok(glass >= 5 && glass < all);
  await page.fill("#matSearch", "大理石");
  assert.ok((await page.locator("#matGrid .mcard").count()) === 0); // 玻璃分類裡沒有大理石
  await page.click('#matCats [data-cat="all"]');
  assert.ok((await page.locator("#matGrid .mcard").count()) >= 3);
  await page.keyboard.press("Escape");
  assert.equal(await ev(() => document.getElementById("matModal").classList.contains("show")), false);
});

test("挑選器回傳選到的材質；取消回傳 null；分類限制", async () => {
  await ev(() => {
    window.__pick = window.__materials.openMatPicker({ value: "paint-white", cats: ["paint"] });
  });
  await page.waitForSelector("#matModal.show");
  const cats = await ev(() => [...document.querySelectorAll("#matCats [data-cat]")].map(b => b.dataset.cat));
  assert.deepEqual(cats, ["all", "paint"]);
  assert.equal(await ev(() => document.querySelector("#matGrid .mcard.on").dataset.id), "paint-white");
  await page.click('#matGrid .mcard[data-id="paint-sage"]');
  await page.click("#matOk");
  assert.equal(await ev(() => window.__pick), "paint-sage");
  await ev(() => {
    window.__pick = window.__materials.openMatPicker({ value: "paint-white" });
  });
  await page.click("#matCancel");
  assert.equal(await ev(() => window.__pick), null);
});

test("自訂材質：新增後存進專案檔，可復原／重做", async () => {
  await ev(() => {
    window.__pick = window.__materials.openMatPicker({ value: "floor-oak-natural", cats: ["floor"] });
  });
  await page.waitForSelector("#matModal.show");
  await page.click("#matNew");
  await page.fill("#medName", "我的地板");
  await page.fill("#medSize", "90");
  await page.selectOption("#medPat", "herringbone");
  await page.click("#medSave");
  const r = await ev(() => ({
    mats: window.__fp.projectData().materials,
    sel: document.querySelector("#matGrid .mcard.on")?.dataset.id,
  }));
  assert.equal(r.mats.length, 1);
  assert.equal(r.mats[0].name, "我的地板");
  assert.equal(r.mats[0].pattern, "herringbone");
  assert.equal(r.mats[0].size, 90);
  assert.ok(r.mats[0].id.startsWith("custom-"));
  assert.equal(r.sel, r.mats[0].id);
  await page.click("#matOk");
  assert.equal(await ev(() => window.__pick), r.mats[0].id);
  assert.equal(await ev(id => window.__materials.getMat(id).name, r.mats[0].id), "我的地板");
  await ev(() => document.getElementById("btnUndo").click());
  assert.equal(await ev(() => window.__fp.projectData().materials.length), 0);
  await ev(() => document.getElementById("btnRedo").click());
  assert.equal(await ev(() => window.__fp.projectData().materials.length), 1);
});

test("3D 材質與 SVG 圖樣不會出錯，且會快取", async () => {
  const r = await ev(async () => {
    const M = window.__materials;
    let THREE;
    try {
      THREE = await import("three");
    } catch (e) {
      // 正式版沒有 importmap：用最小替身測試介面
      class Mat {
        constructor(o) {
          Object.assign(this, o);
          this.color = { setStyle() {} };
          this.userData = {};
        }
      }
      class Tex {
        constructor(img) {
          this.image = img;
          this.repeat = { set: (x, y) => (this.rep = [x, y]) };
        }
      }
      THREE = {
        MeshStandardMaterial: Mat,
        CanvasTexture: Tex,
        RepeatWrapping: 1,
        SRGBColorSpace: "srgb",
        DoubleSide: 2,
        FrontSide: 0,
      };
    }
    const a = M.threeMaterial(THREE, "floor-oak-natural"),
      b = M.threeMaterial(THREE, "floor-oak-natural"),
      g = M.threeMaterial(THREE, "glass-clear"),
      p = M.threeMaterial(THREE, "paint-white");
    const svg = document.getElementById("svg");
    const f1 = M.svgPattern(svg, "tile-polish-60", { angle: 45 }),
      f2 = M.svgPattern(svg, "tile-polish-60", { angle: 45 }),
      plain = M.svgPattern(svg, "paint-white");
    const lone = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const f3 = M.svgPattern(
      lone.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "g")),
      "stone-carrara",
    );
    return {
      same: a === b,
      hasMap: !!a.map,
      glass: g.transparent && g.opacity < 0.5,
      plainNoMap: !p.map,
      f1,
      sameF: f1 === f2,
      nPat: svg.querySelectorAll(`pattern[id="${f1.slice(5, -1)}"]`).length,
      plain,
      lone: f3.startsWith("url(#") && !!lone.querySelector("defs > pattern"),
      sw: M.matSwatchURL("brick-red").startsWith("data:image/png"),
    };
  });
  assert.ok(r.same && r.hasMap && r.glass && r.plainNoMap);
  assert.ok(r.f1.startsWith("url(#mat-"));
  assert.ok(r.sameF);
  assert.equal(r.nPat, 1);
  assert.equal(r.plain, "#f4f2ee");
  assert.ok(r.lone);
  assert.ok(r.sw);
});

test("英文介面：材質庫沒有中文", async () => {
  await ev(() => localStorage.clear()); // 不含自訂材質（使用者取的中文名稱）
  await page.goto(URL + "?lang=en");
  await ev(() => {
    window.__materials.openMatPicker({ browse: true });
  });
  await page.waitForSelector("#matModal.show");
  const txt = await ev(() => document.getElementById("matModal").innerText);
  assert.equal(
    /\p{Script=Han}/u.test(txt),
    false,
    txt
      .split("\n")
      .filter(l => /\p{Script=Han}/u.test(l))
      .join(" | "),
  );
  await page.keyboard.press("Escape");
  await page.goto(URL + "?lang=zh-TW");
});

test("材質測試沒有任何頁面錯誤", () => {
  assert.deepEqual(errors, []);
});
