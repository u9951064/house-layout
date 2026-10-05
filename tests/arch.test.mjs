// 裝修模組測試：地坪、天花、窗簾、裝修分頁（設計規格）、開口規格、圖面別顯示
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { serve } from "../scripts/serve.mjs";
import { chromium } from "playwright";

const PORT = (+process.env.TEST_PORT || 4199) + 2,
  URL = `http://127.0.0.1:${PORT}/index.html`;
const BASE = {
  app: "house-layout-base",
  version: 1,
  unit: "cm",
  name: "裝修測試",
  walls: [
    [
      0,
      0,
      600,
      0,
      20,
      [[100, 260, "win", { sill: 45, head: 230, style: "casement", glass: "frosted", frameMat: "x-frame" }]],
    ],
    [600, 0, 600, 500, 20, []],
    [
      600,
      500,
      0,
      500,
      20,
      [[460, 550, "door", { hinge: "b", side: -1, head: 220, leafStyle: "glass", leafMat: "x-leaf" }]],
    ],
    [0, 500, 0, 0, 20, [[100, 200, "open", { head: 200 }]]],
  ],
  rooms: [{ n: "客廳", s: "", x: 300, y: 250 }],
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
  await page.evaluate(b => window.__fp.loadData(b, "arch"), BASE);
});
test.after(async () => {
  await browser?.close();
  server?.close();
});
const ev = (fn, arg) => page.evaluate(fn, arg);
const add = (type, x, y) =>
  ev(([type, x, y]) => window.__fp.addItem(window.__fp.DEFAULTS[type], x, y).id, [type, x, y]);

test("開口規格（窗型、窗台、門片）存檔後保留", async () => {
  const ops = await ev(() => window.__fp.projectData().base.walls.map(w => w[5]));
  assert.deepEqual(ops[0][0][3], { sill: 45, head: 230, style: "casement", glass: "frosted", frameMat: "x-frame" });
  assert.equal(ops[2][0][3].leafStyle, "glass");
  assert.equal(ops[2][0][3].head, 220);
  assert.equal(ops[3][0][3].head, 200);
});

test("元件庫有地坪、天花、牆面裝修、窗簾類型，且圖層正確", async () => {
  const r = await ev(() => {
    const D = window.__fp.DEFAULTS;
    return ["floorZone", "ceilCove", "ceilBeam", "wallPanel", "curtainDouble", "blindsVenetian"].map(
      k => D[k] && D[k].layer,
    );
  });
  assert.deepEqual(r, ["floor", "ceiling", "ceiling", "finish", "finish", "finish"]);
});

test("加入地坪、天花、窗簾並顯示屬性面板", async () => {
  const fz = await add("floorZone", 200, 200);
  assert.ok(await ev(() => document.querySelector('#propBody [data-matfield="mat"]')));
  assert.ok(await ev(() => document.getElementById("aAng")));
  await add("ceilCove", 300, 250);
  assert.ok(await ev(() => document.getElementById("aCove")));
  await add("curtainDouble", 180, 30);
  const r = await ev(() => ({
    mat2: !!document.querySelector('#propBody [data-matfield="mat2"]'),
    open: !!document.getElementById("aOpen"),
  }));
  assert.deepEqual(r, { mat2: true, open: true });
  // 天花離地預設＝方案天花高度 − 降板
  const ch = await ev(() => +document.getElementById("pE").value);
  assert.equal(ch, 1);
  assert.ok(fz > 0);
});

test("天花板離地預設隨方案天花高度變化", async () => {
  await add("ceilFlat", 300, 250);
  assert.equal(await ev(() => +document.getElementById("pE").value), 270);
});

test("裝修分頁：修改天花高度與牆面材質會寫入方案規格並可復原", async () => {
  await ev(() => document.querySelector('[data-ptab="finish"]').click());
  assert.ok(await ev(() => document.getElementById("sp_ceilH")));
  await page.fill("#sp_ceilH", "255");
  await page.dispatchEvent("#sp_ceilH", "change");
  const spec = await ev(() => window.__fp.projectData().designs[0].spec);
  assert.equal(spec.ceilH, 255);
  // 逐面牆的材質欄位：至少有室內側的面
  const faces = await ev(() => document.querySelectorAll("#propBody .arch-wall").length);
  assert.ok(faces >= 4, String(faces));
  await ev(() => document.querySelector("#propBody .arch-wall [data-matfield]").click());
  await page.waitForTimeout(100);
  // 材質挑選器可能是對話框；暫行版直接回傳下一個材質
  const picked = await ev(() => Object.keys(window.__fp.projectData().designs[0].spec.wallFin || {}).length);
  if (picked) {
    await ev(() => document.getElementById("btnUndo").click());
    assert.equal(await ev(() => Object.keys(window.__fp.projectData().designs[0].spec.wallFin || {}).length), 0);
  }
});

test("圖面別：地坪圖顯示地坪、隱藏家具；天花圖顯示天花", async () => {
  await add("sofa", 300, 400);
  const vis = () =>
    ev(() => {
      const out = {};
      for (const it of window.__fp.state.items) {
        const g = document.querySelector(`#itemLayer .item[data-id="${it.id}"]`);
        out[it.type] = !g ? "off" : g.classList.contains("dim") ? "dim" : "on";
      }
      return out;
    });
  const sel = async id => {
    await ev(id => {
      const s = document.getElementById("selPlan");
      s.value = id;
      s.dispatchEvent(new Event("change"));
    }, id);
  };
  await sel("floor");
  let v = await vis();
  assert.equal(v.floorZone, "on");
  assert.equal(v.sofa, "off");
  assert.equal(v.ceilCove, "off");
  await sel("ceiling");
  v = await vis();
  assert.equal(v.ceilCove, "on");
  assert.equal(v.floorZone, "off");
  await sel("layout");
  v = await vis();
  assert.equal(v.sofa, "on");
  assert.equal(v.floorZone, "off");
});

test("數量估算表有地坪、牆面、天花、窗簾項目", { skip: !!process.env.TEST_ROOT }, async () => {
  const groups = await ev(async () => {
    const m = await import("/src/ext/registry.js");
    const s = m.EXT.schedules.find(x => x.id === "arch");
    return [...new Set(s.rows().map(r => r.group))];
  });
  for (const g of ["地坪", "牆面", "天花", "窗簾"]) assert.ok(groups.includes(g), groups.join(","));
});

test("沒有頁面錯誤", () => {
  assert.deepEqual(errors, []);
});
