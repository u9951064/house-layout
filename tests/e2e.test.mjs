// House Layout 端對端測試：以無頭瀏覽器操作真實頁面
// 執行：npm test（會自動啟動靜態伺服器）
import { test } from "node:test";
import assert from "node:assert/strict";
import { serve } from "../scripts/serve.mjs";
import { chromium } from "playwright";

const PORT = 4199,
  URL = `http://127.0.0.1:${PORT}/index.html`;
const SAMPLE = {
  app: "house-layout-base",
  version: 1,
  unit: "cm",
  name: "測試小套房",
  walls: [
    [0, 0, 600, 0, 20, [[90, 210, "win"]]],
    [600, 0, 600, 500, 20, []],
    [600, 500, 0, 500, 20, [[460, 555, "door", { hinge: "b", side: -1 }]]],
    [0, 500, 0, 0, 20, []],
    [300, 0, 300, 300, 12, [[200, 280, "door", { hinge: "a", side: 1 }]]],
  ],
  columns: [[560, 460, 600, 500]],
  outOfScope: [{ name: "衛浴", r: [306, 306, 450, 494] }],
  rooms: [{ n: "客廳", s: "", x: 150, y: 260 }],
  fixtures: [{ type: "counter", x: 30, y: 430, w: 180, d: 60, rot: 180, label: "流理台" }],
};

let server, browser, page;
const errors = [];
test.before(async () => {
  server = await serve(PORT);
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

test("首次開啟顯示匯入畫面，且沒有任何專案", async () => {
  assert.equal(await ev(() => document.getElementById("gate").classList.contains("hidden")), false);
  assert.equal(await ev(() => window.__fp.base), null);
});

test("匯入底圖檔 → 建立新專案", async () => {
  await ev(b => window.__fp.loadData(b, "sample"), SAMPLE);
  const r = await ev(() => ({
    walls: window.__fp.base.walls.length,
    proj: window.__fp.proj.name,
    gate: document.getElementById("gate").classList.contains("hidden"),
  }));
  assert.equal(r.walls, 5);
  assert.equal(r.gate, true);
  assert.ok(r.proj);
});

test("新增家具、多選、對齊與水平貼合", async () => {
  const r = await ev(() => {
    const f = window.__fp,
      D = f.DEFAULTS;
    const a = f.addItem(D.fridge, 100, 100),
      b = f.addItem(D.appliance, 230, 140),
      c = f.addItem(D.cabinet, 380, 120);
    f.state.sel = c.id;
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "a", metaKey: true, bubbles: true }));
    document.querySelector('[data-al="top"]').click();
    document.querySelector('[data-al="packh"]').click();
    const its = [a, b, c].map(x => f.state.items.find(i => i.id === x.id));
    return {
      tops: its.map(i => i.y),
      gaps: [its[1].x - (its[0].x + its[0].w), its[2].x - (its[1].x + its[1].w)],
      title: document.querySelector("#props h2").textContent,
    };
  });
  assert.match(r.title, /已選取 3 個/);
  assert.equal(new Set(r.tops).size, 1);
  assert.deepEqual(r.gaps, [0, 0]);
});

test("複製貼上與復原", async () => {
  const r = await ev(() => {
    const f = window.__fp,
      n = f.state.items.length,
      key = (k, x = {}) =>
        document.body.dispatchEvent(new KeyboardEvent("keydown", { key: k, metaKey: true, bubbles: true, ...x }));
    key("c");
    key("v");
    const pasted = f.state.items.length - n;
    key("z");
    return { pasted, undone: f.state.items.length - n };
  });
  assert.equal(r.pasted, 3);
  assert.equal(r.undone, 0);
});

test("方案分頁：新增、複製、拖曳排序、疊圖與並排比較", async () => {
  const r = await ev(() => {
    const f = window.__fp,
      names = () =>
        [...document.querySelectorAll("#sheets .sh[data-k]")].map(b => b.textContent.trim().replace(/\s+\d+$/, ""));
    f.addDesign(null);
    f.addItem(f.DEFAULTS.bed2, 450, 150);
    const tabs = () => [...document.querySelectorAll("#sheets .sh[data-k]")];
    const drag = (from, to, alt) => {
      const a = tabs()[from],
        b = tabs()[to],
        rc = b.getBoundingClientRect(),
        dt = new DataTransfer(),
        o = {
          dataTransfer: dt,
          clientX: rc.right - 3,
          clientY: rc.top + 5,
          altKey: alt,
          bubbles: true,
          cancelable: true,
        };
      a.dispatchEvent(new DragEvent("dragstart", o));
      b.dispatchEvent(new DragEvent("dragover", o));
      b.dispatchEvent(new DragEvent("drop", o));
      a.dispatchEvent(new DragEvent("dragend", o));
    };
    const before = names();
    drag(0, 1, false);
    const moved = names();
    drag(0, 0, true);
    const copied = names();
    const sel = document.getElementById("selGhost");
    sel.value = sel.options[1].value;
    sel.dispatchEvent(new Event("change"));
    const ghost = document.getElementById("ghostLayer").children.length;
    document.getElementById("shCmp").click();
    const cards = document.querySelectorAll(".cmpCard").length;
    document.getElementById("cmpClose").click();
    return { before, moved, copied, ghost, cards };
  });
  assert.deepEqual(r.moved, [r.before[1], r.before[0]]);
  assert.equal(r.copied.length, 3);
  assert.ok(r.ghost > 0);
  assert.equal(r.cards, 3);
});

test("存檔內容（v3）與開檔成新專案", async () => {
  const r = await ev(() => {
    const f = window.__fp,
      data = JSON.parse(JSON.stringify(f.projectData()));
    f.loadData(data, "copy");
    return {
      version: data.version,
      designs: data.designs.length,
      reopened: f.proj.designs.length,
      projects: document.querySelectorAll("#selProj option").length,
    };
  });
  assert.equal(r.version, 3);
  assert.equal(r.reopened, r.designs);
  assert.equal(r.projects, 2);
});

test("底圖編輯：左側換成底圖工具、畫牆、加窗、復原", async () => {
  const r = await ev(() => {
    const f = window.__fp,
      svg = document.getElementById("svg");
    document.querySelector('#menubar .mb[data-menu="base"]').click();
    [...document.querySelectorAll("#menuPop .mi")].find(d => d.textContent.includes("編輯底圖")).click();
    const pal = {
      furniture: document.getElementById("palette").offsetParent === null,
      tools: document.querySelectorAll("#basePal .btool").length,
    };
    const vp = () => {
      const m = document
        .getElementById("viewport")
        .getAttribute("transform")
        .match(/translate\(([-\d.e]+) ([-\d.e]+)\) scale\(([-\d.e]+)\)/);
      return m.slice(1).map(Number);
    };
    const pe = (t, x, y) => {
      const [vx, vy, s] = vp(),
        rc = svg.getBoundingClientRect();
      svg.dispatchEvent(
        new PointerEvent(t, {
          clientX: rc.left + vx + x * s,
          clientY: rc.top + vy + y * s,
          bubbles: true,
          pointerId: 1,
          button: 0,
        }),
      );
    };
    const click = (x, y) => {
      pe("pointerdown", x, y);
      pe("pointerup", x, y);
    };
    const n0 = f.base.walls.length;
    document.querySelector('#basePal [data-tool="wall"]').click();
    click(450, 300);
    click(450, 500);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const added = f.base.walls.length - n0;
    document.querySelector('#basePal [data-tool="win"]').click();
    click(0, 120);
    const win = f.base.walls[3][5].length;
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true }));
    const winUndo = f.base.walls[3][5].length;
    document.getElementById("basePalDone").click();
    return { pal, added, win, winUndo, back: document.getElementById("palette").offsetParent !== null };
  });
  assert.equal(r.pal.furniture, true);
  assert.equal(r.pal.tools, 9);
  assert.equal(r.added, 1);
  assert.equal(r.win, 1);
  assert.equal(r.winUndo, 0);
  assert.equal(r.back, true);
});

test("AI 底圖：容錯解析並自動修正歪斜的牆", async () => {
  const r = await ev(s => {
    const messy =
      "以下是結果：\n```json\n" +
      JSON.stringify({ ...s, walls: [[0, 0, 600, 1.5, 20, []], ...s.walls.slice(1)] }).replace(/}$/, ",}") +
      "\n```";
    document.querySelector('#menubar .mb[data-menu="base"]').click();
    [...document.querySelectorAll("#menuPop .mi")].find(d => d.textContent.includes("AI 產生底圖")).click();
    document.getElementById("aiText").value = messy;
    document.getElementById("aiApply").click();
    return {
      y2: window.__fp.base.walls[0][3],
      warn: document.getElementById("props").innerText.includes("AI 底圖提醒"),
    };
  }, SAMPLE);
  assert.equal(r.y2, 0);
  assert.equal(r.warn, true);
});

test("工具列、縮放列與元件庫收合", async () => {
  const r = await ev(() => {
    document.querySelector('#toolbar [data-step="5"]').click();
    const step = document.getElementById("selSnap").value;
    document.getElementById("zbPct").value = "60";
    document.getElementById("zbPct").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    const zoom = document.getElementById("zbPct").value;
    document.querySelector('#palette [data-all="0"]').click();
    const visible = [...document.querySelectorAll("#palette .pal")].filter(e => e.offsetParent !== null).length;
    document.querySelector('#palette [data-all="1"]').click();
    document.querySelector('#toolbar [data-step="1"]').click();
    return {
      step,
      zoom,
      visible,
      header: document.querySelector("header").scrollWidth - document.querySelector("header").clientWidth,
    };
  });
  assert.equal(r.step, "5");
  assert.equal(r.zoom, "60");
  assert.equal(r.visible, 0);
  assert.equal(r.header, 0);
});

test("收合狀態在重新整理後會還原（含家具分類）", async () => {
  await ev(() => document.querySelector("#palette h3[data-key]").click());
  await page.reload();
  const collapsed = await ev(() => document.querySelector("#palette h3[data-key]").classList.contains("collapsed"));
  await ev(() => document.querySelector("#palette h3[data-key]").click());
  assert.equal(collapsed, true);
});

test("說明選單與關於視窗", async () => {
  const r = await ev(() => {
    document.querySelector('#menubar .mb[data-menu="help"]').click();
    document.querySelector("#menuPop .mi").click();
    return [...document.querySelectorAll("#aboutModal a")].map(a => a.getAttribute("href"));
  });
  assert.ok(r.includes("https://github.com/u9951064/house-layout"));
});

test("匯出 SVG 字串可被瀏覽器繪製", async () => {
  const ok = await ev(async () => {
    const s = window.__fp.exportSVGString(1);
    const img = new Image();
    return await new Promise(r => {
      img.onload = () => r(img.width > 0);
      img.onerror = () => r(false);
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
    });
  });
  assert.equal(ok, true);
});

test("組合曲線元件：一個元件、改參數重算外框、無拉伸把手", async () => {
  const r = await ev(() => {
    const f = window.__fp,
      it = f.addItem(f.DEFAULTS.curveSlide, 300, 300),
      w0 = it.w;
    const a = document.getElementById("cA");
    a.value = 40;
    a.dispatchEvent(new Event("change"));
    const now = f.state.items.find(i => i.id === it.id);
    return { w0, w1: now.w, handles: document.querySelectorAll("#uiLayer .handle").length, type: now.type };
  });
  assert.equal(r.type, "curveSlide");
  assert.equal(r.w0 - r.w1, 60);
  assert.equal(r.handles, 0);
});

test("範例專案可從匯入畫面開啟", async () => {
  await ev(() => {
    window.__fp.loadData;
    document.getElementById("gate").classList.remove("hidden");
    document.getElementById("gateSample").click();
  });
  await page.waitForFunction(() => window.__fp.proj && window.__fp.proj.name === "範例兩房");
  const r = await ev(() => ({ designs: window.__fp.proj.designs.length, items: window.__fp.state.items.length }));
  assert.equal(r.designs, 2);
  assert.ok(r.items > 5);
});

test("提示卡：第一次顯示、關閉後重新整理不再出現", async () => {
  await ev(() => localStorage.removeItem("hl-tip-off"));
  await page.reload();
  const shown = await ev(() => !document.getElementById("tipCard").hidden);
  await page.click("#tipClose");
  await page.reload();
  const after = await ev(() => document.getElementById("tipCard").hidden);
  assert.equal(shown, true);
  assert.equal(after, true);
});

test("使用教學頁與範例檔可存取，且圖片都存在", async () => {
  const html = await (await fetch(URL.replace("index.html", "guide.html"))).text();
  const imgs = [...html.matchAll(/src="(docs\/img\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(imgs.length >= 10);
  for (const src of imgs) assert.equal((await fetch(URL.replace("index.html", src))).status, 200, src);
  assert.equal((await fetch(URL.replace("index.html", "examples/sample-project.json"))).status, 200);
});

test("整個流程沒有任何頁面錯誤", () => {
  assert.deepEqual(errors, []);
});
