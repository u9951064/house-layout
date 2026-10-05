// 3D 檢視測試：開啟 3D、場景有模型、點選物件、材質刷、門片開關、匯出圖片、切回平面圖
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { serve } from "../scripts/serve.mjs";
import { chromium } from "playwright";

const PORT = (+process.env.TEST_PORT || 4199) + 5,
  URL = `http://127.0.0.1:${PORT}/index.html`;
const BASE = {
  app: "house-layout-base",
  version: 1,
  unit: "cm",
  name: "3D 測試",
  walls: [
    [0, 0, 600, 0, 20, [[90, 210, "win", { style: "slide2" }]]],
    [600, 0, 600, 500, 20, [[100, 220, "win", { style: "casement", sill: 100 }]]],
    [600, 500, 0, 500, 20, [[460, 555, "door", { hinge: "b", side: -1 }]]],
    [0, 500, 0, 0, 20, [[150, 330, "win", { style: "bay" }]]],
    [300, 0, 300, 300, 12, [[200, 280, "door", { hinge: "a", side: 1, leafStyle: "panel" }]]],
  ],
  columns: [[560, 460, 600, 500]],
  outOfScope: [{ name: "衛浴", r: [306, 306, 450, 494] }],
  rooms: [{ n: "客廳", s: "", x: 150, y: 260 }],
  fixtures: [{ type: "counter", x: 30, y: 430, w: 180, d: 60, rot: 180, label: "流理台" }],
};

let server, browser, page;
const errors = [];
test.before(async () => {
  server = await serve(PORT, process.env.TEST_ROOT ? path.resolve(process.env.TEST_ROOT) : undefined);
  browser = await chromium.launch({
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => {
    if (m.type() === "error" && !/favicon/.test(m.text())) errors.push(m.text());
  });
  page.on("dialog", d => d.accept(d.type() === "prompt" ? d.defaultValue() || "3D" : undefined));
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});
test.after(async () => {
  await browser?.close();
  server?.close();
});
const ev = (fn, arg) => page.evaluate(fn, arg);

test("開啟 3D 檢視並建立場景", async () => {
  await ev(b => window.__fp.loadData(b, "3d"), BASE);
  const ids = await ev(() => {
    const f = window.__fp;
    return ["sofa", "bed2", "dining", "wardrobe", "plant", "swingDoor", "curveSlide", "wallArc"].map(
      (k, i) => f.addItem(f.DEFAULTS[k], 120 + (i % 3) * 150, 120 + Math.floor(i / 3) * 130).id,
    );
  });
  assert.equal(ids.length, 8);
  await page.click('[data-view="3d"]');
  await page.waitForFunction(() => window.__fp3d && window.__fp3d.meshCount() > 0, null, { timeout: 30000 });
  const r = await ev(() => ({
    canvas: !!document.querySelector("#viewHost canvas"),
    hostShown: !document.getElementById("viewHost").hidden,
    meshes: window.__fp3d.meshCount(),
    walls: window.__fp3d.built.walls.length,
  }));
  assert.equal(r.canvas, true);
  assert.equal(r.hostShown, true);
  assert.ok(r.meshes > 60, "meshes " + r.meshes);
  assert.equal(r.walls, 5);
});

test("俯視時點選物件會選取並顯示屬性", async () => {
  await ev(() => window.__fp3d.setMode("top", true));
  await page.waitForTimeout(300);
  const id = await ev(() => window.__fp.state.items.find(i => i.type === "bed2").id);
  const p = await ev(i => window.__fp3d.screenOf(i), id);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(100);
  assert.equal(await ev(() => window.__fp.state.sel), id);
  assert.ok(await ev(() => !!document.getElementById("pLabel")));
});

test("材質刷：牆面、地板套用材質並可復原", async () => {
  const ok = await ev(() => window.__fp3d.apply({ kind: "wall", i: 0, face: 1 }, "wood-white"));
  assert.equal(ok, true);
  assert.equal(await ev(() => window.__fp.state.spec.wallFin["0:1"]), "wood-white");
  // 真的點一下地板（空白角落）
  await ev(() => window.__fp3d.setBrush("ceil-white"));
  const p = await ev(() => window.__fp3d.project(40, 0, 40));
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(100);
  assert.equal(await ev(() => window.__fp.state.spec.floorMat), "ceil-white");
  await page.keyboard.press("Escape");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  assert.notEqual(await ev(() => window.__fp.state.spec.floorMat), "ceil-white");
});

test("門片開關、夜間模式、剖切不會出錯", async () => {
  await ev(() => window.__fp3d.setDoors(1));
  await page.selectOption("#v3Doors", "0.5");
  await page.check("#v3Night");
  await page.check("#v3Cut");
  await page.waitForTimeout(400);
  const r = await ev(() => ({ doors: window.__fp3d.opts.doors, night: window.__fp3d.opts.night }));
  assert.equal(r.doors, 0.5);
  assert.equal(r.night, true);
  await page.uncheck("#v3Night");
  await page.uncheck("#v3Cut");
  await ev(() => window.__fp3d.setMode("walk", true));
  await page.waitForTimeout(200);
  await ev(() => window.__fp3d.setMode("orbit", true));
});

test("匯出 3D 圖片", async () => {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#v3Shot")]);
  assert.match(dl.suggestedFilename(), /3D.*\.png$/);
});

test("切回平面圖會卸載 3D 檢視", async () => {
  await page.click('[data-view="plan"]');
  const r = await ev(() => ({ hidden: document.getElementById("viewHost").hidden, hook: !!window.__fp3d }));
  assert.equal(r.hidden, true);
  assert.equal(r.hook, false);
});

test("3D 流程沒有頁面錯誤", () => {
  assert.deepEqual(errors, []);
});
