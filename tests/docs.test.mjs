// 工程圖模組測試：立面圖（含編輯）、數量表、施工圖集
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { serve } from "../scripts/serve.mjs";
import { chromium } from "playwright";

const PORT = (+process.env.TEST_PORT || 4199) + 6,
  URL = `http://127.0.0.1:${PORT}/index.html`;
const SAMPLE = JSON.parse(fs.readFileSync(path.resolve("examples/sample-project.json"), "utf8"));

let server, browser, page;
const errors = [];
test.before(async () => {
  server = await serve(PORT, process.env.TEST_ROOT ? path.resolve(process.env.TEST_ROOT) : undefined);
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => {
    if (m.type() === "error" && !/favicon/.test(m.text())) errors.push(m.text());
  });
  page.on("dialog", d => d.accept(d.type() === "prompt" ? d.defaultValue() || "測試註記" : undefined));
  await page.goto(URL);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("hl-tip-off", "1");
  });
  await page.reload();
  await page.evaluate(d => window.__fp.loadData(d, "範例"), SAMPLE);
  await page.waitForFunction(() => window.__fp.base);
});
test.after(async () => {
  await browser?.close();
  server?.close();
});
const ev = (fn, arg) => page.evaluate(fn, arg);

test("立面圖：列出牆面、選一面顯示開口與尺寸", async () => {
  await page.click('[data-view="elev"]');
  await page.waitForSelector("#evSvg #evDraw .ev-floor", { state: "attached" });
  const faces = await ev(() => document.querySelectorAll(".ev-face").length);
  assert.ok(faces >= 8, "faces " + faces);
  // 第 0 面外牆有兩扇窗：選面 1（室內側、+y）
  await page.click('.ev-face[data-k="0:1"]');
  const r = await ev(() => ({
    ops: document.querySelectorAll("#evDraw .ev-op").length,
    dims: document.querySelectorAll("#evDraw .ev-dim").length,
    levels: [...document.querySelectorAll("#evDraw text")].map(t => t.textContent).filter(s => /^(FL|CH|SL)/.test(s)),
    key: document.querySelectorAll("#evKey .ev-key-idx").length,
  }));
  assert.equal(r.ops, 2);
  assert.ok(r.dims > 6);
  assert.deepEqual(r.levels.slice(0, 2), ["FL±0", "CH 270"]);
  assert.ok(r.key >= 2);
});

test("立面圖：靠牆的家具出現，拖曳改變離地高度並同步到物件", async () => {
  // 床頭靠在 0 號牆（主臥上方）
  const objs = await ev(() => [...document.querySelectorAll("#evDraw .ev-obj")].map(g => +g.dataset.id));
  assert.ok(objs.length >= 2, "objs " + objs.length);
  const id = await ev(() => window.__fp.state.items.find(i => i.type === "nightstand").id);
  assert.ok(objs.includes(id));
  const box = await page.locator(`#evDraw .ev-obj[data-id="${id}"]`).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 - 40, { steps: 5 });
  await page.mouse.up();
  const it = await ev(id => window.__fp.state.items.find(i => i.id === id), id);
  assert.ok(it.elev > 10, "elev " + it.elev);
  assert.equal(await ev(() => window.__fp.state.sel), id);
  // 復原
  await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  assert.ok(!((await ev(id => window.__fp.state.items.find(i => i.id === id).elev, id)) > 10));
});

test("立面圖：註記工具（尺寸、標記）存到 spec.elevNotes，可刪除", async () => {
  await page.click('[data-evtool="dim"]');
  const c = await page.locator("#evSvg").boundingBox();
  await page.mouse.move(c.x + c.width * 0.3, c.y + c.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(c.x + c.width * 0.6, c.y + c.height * 0.4, { steps: 4 });
  await page.mouse.up();
  await page.click('[data-evtool="mark"]');
  await page.mouse.click(c.x + c.width * 0.5, c.y + c.height * 0.5);
  let notes = await ev(() => window.__fp.projectData().designs[0].spec.elevNotes["0:1"]);
  assert.equal(notes.length, 2);
  assert.equal(notes[0].kind, "dim");
  assert.equal(notes[1].kind, "mark");
  await page.click('[data-evtool="select"]');
  await page.keyboard.press("Delete");
  notes = await ev(() => window.__fp.projectData().designs[0].spec.elevNotes["0:1"]);
  assert.equal(notes.length, 1);
});

test("立面圖：點元件庫卡片直接放到牆面前方（背靠牆、朝外）", async () => {
  const n0 = await ev(() => window.__fp.state.items.length);
  await page.locator("#palette .pal").first().click();
  const r = await ev(() => {
    const its = window.__fp.state.items;
    return { n: its.length, it: its[its.length - 1] };
  });
  assert.equal(r.n, n0 + 1);
  // 0 號牆水平、面 1 在下方（+y）→ 正面朝 +y：rot 0
  assert.equal(Math.round(r.it.rot) % 360, 0);
  assert.ok(Math.abs(r.it.y - 10) < 2, "y " + r.it.y);
  assert.ok(await ev(id => !!document.querySelector(`#evDraw .ev-obj[data-id="${id}"]`), r.it.id));
});

test("數量表：顯示表格並可匯出 CSV", async () => {
  await page.click('[data-view="sched"]');
  await page.waitForSelector(".sc-table");
  const rows = await ev(() => document.querySelectorAll(".sc-table tbody tr").length);
  assert.ok(rows > 8);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#scCSV")]);
  const p = await dl.path();
  const txt = fs.readFileSync(p, "utf8");
  assert.ok(txt.startsWith("﻿"));
  assert.ok(/雙人床/.test(txt));
});

test("施工圖集：產生多張含圖框的圖紙並下載 HTML", async () => {
  await ev(() => document.querySelector('#menubar .mb[data-menu="design"]').click());
  await ev(() => [...document.querySelectorAll("#menuPop .mi")].find(d => d.textContent.includes("施工圖集")).click());
  await page.waitForSelector("#drawsetModal.show #dsHTML");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#dsHTML")]);
  const html = fs.readFileSync(await dl.path(), "utf8");
  const pages = (html.match(/class="pg"/g) || []).length;
  assert.ok(pages >= 8, "pages " + pages);
  assert.ok(html.includes("圖號"));
  assert.ok(html.includes("1:"));
  assert.ok(await ev(() => +document.getElementById("drawsetModal").dataset.count >= 8));
  await page.click("#dsCancel");
});

test("工程圖流程沒有頁面錯誤", () => {
  assert.deepEqual(errors, []);
});
