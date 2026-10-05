// 櫃體模組測試：參數化櫃體、板件、裁切清單、五金、分格編輯、櫃體工程圖
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { serve } from "../scripts/serve.mjs";
import { chromium } from "playwright";

const PORT = (+process.env.TEST_PORT || 4199) + 3,
  URL = `http://127.0.0.1:${PORT}/index.html`;
const SAMPLE = JSON.parse(fs.readFileSync(path.resolve("examples/sample-project.json"), "utf8"));
const TYPES = [
  "cabBase",
  "cabWall",
  "cabTall",
  "cabWardrobe",
  "cabTV",
  "cabShoe",
  "cabBook",
  "cabIsland",
  "cabVanity",
  "cabDesk",
  "cabBench",
  "cabFull",
];

let server, browser, page;
const errors = [];
test.before(async () => {
  server = await serve(PORT, process.env.TEST_ROOT ? path.resolve(process.env.TEST_ROOT) : undefined);
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => {
    if (m.type() === "error" && !/favicon|WebGL|GPU/i.test(m.text())) errors.push(m.text());
  });
  page.on("dialog", d => d.accept(d.type() === "prompt" ? d.defaultValue() || "測試" : undefined));
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(d => window.__fp.loadData(d, "櫃體測試"), SAMPLE);
  await page.waitForFunction(() => window.__fp.base);
});
test.after(async () => {
  await browser?.close();
  server?.close();
});
const ev = (fn, arg) => page.evaluate(fn, arg);

test("所有櫃型都在元件庫，加入後有櫃體參數", async () => {
  const r = await ev(types => {
    const f = window.__fp;
    return types.map(t => {
      const def = f.DEFAULTS[t];
      if (!def) return [t, "missing"];
      const it = f.addItem(def, 300, 300);
      return [t, def.layer, !!it];
    });
  }, TYPES);
  for (const [t, layer, ok] of r) {
    assert.equal(layer, "cabinet", t);
    assert.equal(ok, true, t);
  }
});

test("板件都在外框內、門數與分格一致、鉸鏈數量規則", async () => {
  const r = await page.evaluate(async types => {
    const m = window.__cab;
    const f = window.__fp;
    const out = [];
    for (const type of types) {
      const it = f.state.items.find(i => i.type === type);
      m.ensureCab(it);
      const L = m.cabLayout(it);
      const parts = m.cabParts(it);
      const bad = parts.filter(
        p =>
          p.x < -0.01 ||
          p.y < -0.01 ||
          p.z < -0.01 ||
          p.x + p.sx > it.w + 0.01 ||
          p.y + p.sy > L.h + 0.01 ||
          p.z + p.sz > it.d + 0.01 ||
          !(p.sx > 0 && p.sy > 0 && p.sz > 0),
      );
      const doors = parts.filter(p => p.role === "door" || p.role === "glass");
      let expected = 0;
      for (const s of it.cab.sections) {
        const k = s.kind === "hang" ? s.front || "door2" : s.kind === "appliance" ? s.upper || "" : s.kind;
        if (["door1L", "door1R", "lift"].includes(k)) expected += 1;
        if (["door2", "slide"].includes(k)) expected += 2;
      }
      const glass = it.cab.sections.filter(s => s.kind === "glass");
      const hw = m.cabHardware(it);
      const hinge = hw.find(h => h.item === "緩衝鉸鏈");
      const hingeExp = doors
        .filter(p => p.role === "door" && ["L", "R"].includes(p.hinge))
        .reduce((a, p) => a + (p.sy <= 100 ? 2 : p.sy <= 160 ? 3 : 4), 0);
      out.push({
        type,
        bad: bad.map(p => p.name),
        doors: doors.length,
        expected,
        glass: glass.length,
        hinge: hinge ? hinge.qty : 0,
        hingeExp,
        cut: m.cabCutList(it).length,
      });
    }
    return out;
  }, TYPES);
  for (const x of r) {
    assert.deepEqual(x.bad, [], x.type + " 板件超出外框");
    if (!x.glass) assert.equal(x.doors, x.expected, x.type + " 門數");
    assert.equal(x.hinge, x.hingeExp, x.type + " 鉸鏈");
    assert.ok(x.cut > 3, x.type + " 裁切清單");
  }
});

test("高門用 4 個鉸鏈；抽屜有滑軌；板材統計有板數", async () => {
  const r = await page.evaluate(async () => {
    const m = window.__cab;
    const it = window.__fp.state.items.find(i => i.type === "cabWardrobe");
    const hw = m.cabHardware(it);
    const bs = m.boardSummary(it);
    return {
      hinge: hw.find(h => h.item === "緩衝鉸鏈").qty,
      slides: hw.filter(h => h.item.startsWith("抽屜滑軌")).reduce((a, h) => a + h.qty, 0),
      rod: hw.find(h => h.item === "吊衣桿")?.qty,
      sheets: bs.rows.reduce((a, b) => a + b.sheets, 0),
      edge: bs.edge,
    };
  });
  assert.ok(r.hinge >= 16, "衣櫃 4 扇高門至少 16 個鉸鏈：" + r.hinge);
  assert.equal(r.slides, 2);
  assert.equal(r.rod, 3);
  assert.ok(r.sheets >= 2 && r.edge > 10);
});

test("分格編輯：改類型、加分格會存檔，且可復原", async () => {
  const id = await ev(() => {
    const f = window.__fp;
    const it = f.state.items.find(i => i.type === "cabBase");
    f.state.sel = it.id;
    document.querySelector('[data-ptab="props"]').click();
    return it.id;
  });
  await page.waitForSelector("#cbSecs");
  const n0 = await ev(id => window.__fp.state.items.find(i => i.id === id).cab.sections.length, id);
  await page.click("#cbAdd");
  await page.selectOption('#cbSecs select[data-sf="kind"][data-i="0"]', "open");
  const r = await ev(id => {
    const it = window.__fp.state.items.find(i => i.id === id);
    const saved = JSON.parse(JSON.stringify(window.__fp.projectData()));
    const sv = saved.designs[saved.cur].items.find(i => i.id === id);
    return { n: it.cab.sections.length, k: it.cab.sections[0].kind, saved: sv.cab.sections.length };
  }, id);
  assert.equal(r.n, n0 + 1);
  assert.equal(r.k, "open");
  assert.equal(r.saved, n0 + 1);
  await page.click("#btnUndo");
  await page.click("#btnUndo");
  const back = await ev(id => window.__fp.state.items.find(i => i.id === id).cab.sections, id);
  assert.equal(back.length, n0);
  assert.notEqual(back[0].kind, "open");
});

test("開關狀態：3D 門扇旋轉、抽屜拉出；立面開門圖不同於關門圖", async () => {
  const r = await page.evaluate(async () => {
    const THREE = await window.__cab.three();
    const m = window.__cab,
      d = window.__cab;
    const it = window.__fp.state.items.find(i => i.type === "cabBase");
    const ctx = { THREE, mat: () => new THREE.MeshStandardMaterial() };
    const box = o => new THREE.Box3().setFromObject(o);
    const closed = box(m.buildCab3D(it, { ...ctx, doors: "closed" }));
    const open = box(m.buildCab3D(it, { ...ctx, doors: "open" }));
    const NS = "http://www.w3.org/2000/svg";
    const g1 = document.createElementNS(NS, "g"),
      g2 = document.createElementNS(NS, "g");
    d.drawElev(g1, it, { doors: "closed" });
    d.drawElev(g2, it, { doors: "open" });
    return {
      cz: closed.max.z,
      oz: open.max.z,
      d: it.d,
      a: g1.innerHTML.length,
      b: g2.innerHTML.length,
      same: g1.innerHTML === g2.innerHTML,
    };
  });
  assert.ok(r.cz <= r.d + 0.5, "關門不超出深度");
  assert.ok(r.oz > r.d + 10, "開門後門扇與抽屜伸出正面");
  assert.equal(r.same, false);
});

test("櫃體工程圖：檢視可開啟，有圖、裁切清單與五金表；CSV 有 BOM", async () => {
  await ev(() => document.querySelector('#viewTabs [data-view="cab"]').click());
  await page.waitForSelector(".cabview svg.cabsheet");
  const r = await ev(() => ({
    list: document.querySelectorAll(".cablist div[data-id]").length,
    tables: document.querySelectorAll(".cabtables table").length,
    rows: document.querySelectorAll(".cabtables table:first-of-type tr").length,
    texts: document.querySelectorAll(".cabsheet text").length,
  }));
  assert.equal(r.list, 12);
  assert.equal(r.tables, 3);
  assert.ok(r.rows > 4 && r.texts > 10);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#cabCsv")]);
  const buf = fs.readFileSync(await dl.path());
  assert.equal(buf[0], 0xef);
  assert.equal(buf[1], 0xbb);
  assert.equal(buf[2], 0xbf);
  const svg = await ev(async () => {
    const m = window.__cab;
    return m.cabSheetSVG(
      window.__fp.state.items.find(i => i.type === "cabWardrobe"),
      { doors: "open" },
    );
  });
  assert.match(svg, /^<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  await ev(() => document.querySelector('#viewTabs [data-view="plan"]').click());
});

test("數量表與設計選單都有櫃體項目", async () => {
  const r = await page.evaluate(() => {
    const rows = window.__cab.scheduleRows();
    const mb = document.querySelector('#menubar .mb[data-menu="design"]');
    mb.click();
    const menu = [...document.querySelectorAll("#menuPop .mi")].some(d => d.textContent.includes("櫃體工程圖"));
    mb.click();
    return { n: rows.filter(r => r.group === "櫃體").length, board: rows.some(r => r.group === "板材"), menu };
  });
  assert.equal(r.n, 12);
  assert.ok(r.board);
  assert.ok(r.menu);
});

test("沒有頁面錯誤", () => {
  assert.deepEqual(errors, []);
});
