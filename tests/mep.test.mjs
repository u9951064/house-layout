// 水電空調模組測試：設備、走線／風管工具、開關連燈具、數量表、圖面別、復原
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { serve } from "../scripts/serve.mjs";
import { chromium } from "playwright";

const PORT = (+process.env.TEST_PORT || 4199) + 4,
  URL = `http://127.0.0.1:${PORT}/index.html`;
const BASE = {
  app: "house-layout-base",
  version: 1,
  name: "MEP",
  walls: [
    [0, 0, 600, 0, 20, []],
    [600, 0, 600, 500, 20, []],
    [600, 500, 0, 500, 20, []],
    [0, 500, 0, 0, 20, []],
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
  page.on("dialog", d => d.accept(d.type() === "prompt" ? d.defaultValue() || "MEP" : undefined));
  await page.goto(URL);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("hl-tip-off", "1");
  });
  await page.reload();
  await page.evaluate(b => window.__fp.loadData(b, "MEP"), BASE);
});
test.after(async () => {
  await browser?.close();
  server?.close();
});
const ev = (fn, arg) => page.evaluate(fn, arg);
const items = () => ev(() => window.__fp.state.items.map(i => ({ ...i })));
const add = (type, x, y) =>
  ev(([type, x, y]) => window.__fp.addItem(window.__fp.DEFAULTS[type], x, y).id, [type, x, y]);

test("元件庫有燈具、開關、插座、空調分類，加入後補齊參數", async () => {
  const cats = await ev(() => [...document.querySelectorAll("#palette h3")].map(h => h.textContent));
  for (const c of ["燈具", "開關", "插座・弱電", "空調・全熱交換"]) assert.ok(cats.includes(c), c);
  const id = await add("downlight", 150, 150);
  await add("downlight", 300, 150);
  await add("outlet2", 100, 20);
  const erv = await add("ervUnit", 400, 300);
  const it = (await items()).find(i => i.id === id);
  assert.equal(it.watt, 10);
  assert.equal(it.cct, 3000);
  assert.equal(it.showName, false);
  // 吸頂設備的離地高度跟著天花高度；全熱交換機天花內放不下時外露在天花下
  const elevOf = id =>
    ev(id => {
      window.__fp.state.sel = id;
      document.querySelector('[data-ptab="props"]').click();
      return document.getElementById("pE").value;
    }, id);
  assert.equal(await elevOf(id), String(270 - 3));
  assert.equal(await elevOf(erv), String(270 - 27 - 2));
});

async function clickWorldish(fx, fy) {
  const r = await page.locator("#svg").boundingBox();
  await page.mouse.click(r.x + r.width * fx, r.y + r.height * fy);
}

test("風管工具：點擊放節點、Enter 完成、折線沒有縮放把手", async () => {
  const before = (await items()).length;
  await page.click("#tbDuct");
  assert.equal(await ev(() => document.getElementById("mepBar").hidden), false);
  await clickWorldish(0.3, 0.3);
  await clickWorldish(0.55, 0.3);
  await clickWorldish(0.55, 0.6);
  await page.keyboard.press("Enter");
  const its = await items();
  assert.equal(its.length, before + 1);
  const d = its[its.length - 1];
  assert.equal(d.type, "ductSupply");
  assert.equal(d.pts.length, 3);
  assert.equal(d.dia, 10);
  await page.keyboard.press("Escape");
  assert.equal(await ev(() => document.body.dataset.tool), "");
  await ev(id => {
    window.__fp.state.sel = id;
    document.querySelector('[data-ptab="props"]').click();
  }, d.id);
  await ev(() => document.querySelector('[data-ptab="props"]').click());
  await page.mouse.move(5, 5);
  assert.equal(await ev(() => document.querySelectorAll("#uiLayer .handle").length), 0);
  assert.ok(await ev(() => /m/.test(document.getElementById("propBody").textContent)));
});

test("走線工具：雙擊完成", async () => {
  const before = (await items()).length;
  await page.click("#tbWire");
  await clickWorldish(0.35, 0.7);
  await clickWorldish(0.5, 0.7);
  const r = await page.locator("#svg").boundingBox();
  await page.mouse.dblclick(r.x + r.width * 0.5, r.y + r.height * 0.7);
  await page.keyboard.press("Escape");
  const its = await items();
  assert.equal(its.length, before + 1);
  const w = its[its.length - 1];
  assert.equal(w.type, "wire");
  assert.equal(w.pts.length, 2);
  assert.equal(w.circuit, "L1");
});

test("點元件庫的風管卡片會啟動風管工具並帶入類型", async () => {
  await ev(() =>
    [...document.querySelectorAll("#palette .pal")]
      .find(c => c.querySelector("span").textContent.startsWith("回風管"))
      .click(),
  );
  assert.equal(await ev(() => document.body.dataset.tool), "duct:ductReturn");
  assert.equal(await ev(() => document.getElementById("mepDuctType").value), "ductReturn");
  await clickWorldish(0.3, 0.8);
  await clickWorldish(0.6, 0.8);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  const d = (await items()).at(-1);
  assert.equal(d.type, "ductReturn");
  assert.equal(d.pts.length, 2);
});

test("開關連到燈具：產生配線並設為同一迴路", async () => {
  const sw = await add("sw2", 50, 250);
  await ev(() => document.querySelector('[data-ptab="props"]').click());
  await ev(() => document.querySelectorAll("#propBody [data-light]").forEach(c => (c.checked = true)));
  const nWire = (await items()).filter(i => i.type === "wire").length;
  await page.click("#mLink");
  const its = await items();
  const s = its.find(i => i.id === sw);
  assert.ok(s.circuit);
  const lights = its.filter(i => i.type === "downlight");
  assert.ok(lights.every(l => l.circuit === s.circuit));
  assert.equal(its.filter(i => i.type === "wire").length, nWire + lights.length);
});

test("數量估算：燈具、迴路、風管長度", { skip: !!process.env.TEST_ROOT }, async () => {
  const rows = await ev(async () => (await import("/src/mep/index.js")).mepRows());
  const dl = rows.find(r => r.item === "嵌燈");
  assert.equal(dl.qty, 2);
  assert.ok(rows.some(r => r.group === "迴路" && r.qty > 0));
  assert.ok(rows.some(r => r.group === "風管" && r.unit === "m" && r.qty > 0));
  const lg = await ev(async () => (await import("/src/mep/index.js")).mepLegend("light"));
  assert.ok(lg.count >= 2 && lg.svg.startsWith("<g"));
});

test("圖面別：插座弱電圖隱藏燈具、空調圖顯示風管", async () => {
  const its = await items();
  const light = its.find(i => i.type === "downlight"),
    outlet = its.find(i => i.type === "outlet2"),
    duct = its.find(i => i.type === "ductSupply");
  const shown = id => ev(id => !!document.querySelector(`#itemLayer .item[data-id="${id}"]`), id);
  await page.selectOption("#selPlan", "power");
  assert.equal(await shown(light.id), false);
  assert.equal(await shown(outlet.id), true);
  await page.selectOption("#selPlan", "hvac");
  assert.equal(await shown(duct.id), true);
  assert.equal(await shown(outlet.id), false);
  await page.selectOption("#selPlan", "layout");
  assert.equal(await shown(duct.id), false);
});

test("復原會移除最後加入的設備", async () => {
  const n = (await items()).length;
  await add("smoke", 500, 400);
  assert.equal((await items()).length, n + 1);
  await page.mouse.click(5, 5);
  await page.keyboard.press("ControlOrMeta+z");
  assert.equal((await items()).length, n);
});

test("沒有頁面錯誤", () => {
  assert.deepEqual(errors, []);
});
