// 圖紙引擎：A3 橫式圖框（標題欄、比例、日期、設計者、修訂表、指北針、圖例）與各類圖紙
import { LOCALE, t } from "../core/i18n.js";
import { S, state } from "../core/store.js";
import { $, NS, el } from "../core/dom.js";
import { DEFAULTS } from "../shapes/library.js";
import { DRAW } from "../shapes/draw.js";
import { renderItems } from "../canvas/items.js";
import { EXT } from "../ext/registry.js";
import { layerOf, showState } from "../ext/plans.js";
import { curDesign } from "../project/project.js";
import { drawElevation } from "./elevation.js";
import { drawNotes } from "./notes.js";
import { faceTitle } from "./walls.js";

export const PAPER = { w: 420, h: 297 }; // A3 橫式（mm）
const AREA = { x: 12, y: 12, w: 323, h: 273 }; // 圖面區
const STRIP = { x: 341, y: 12, w: 67, h: 273 }; // 右側標題欄
const SCALES = [10, 20, 30, 50, 75, 100, 150, 200, 300];

/** 收集匯出用的 CSS（平面圖、物件圖例、立面圖） */
export function collectCSS() {
  return (
    [...document.styleSheets]
      .flatMap(sh => {
        try {
          return [...sh.cssRules];
        } catch (e) {
          return [];
        }
      })
      .filter(r => /^\.(wall|win|door|base|hatch|oos|room|dim|item|gridline|ev-|sh-)/.test(r.selectorText || ""))
      .map(r => r.cssText)
      .join("\n")
      .replace(/var\(--line\)/g, "#222")
      .replace(/var\(--danger\)/g, "#d1242f") +
    "\ntext{font-family:-apple-system,'PingFang TC','Noto Sans TC','Microsoft JhengHei',sans-serif}"
  );
}
export function fitScale(bbox, area = AREA) {
  for (const d of SCALES) if ((bbox.w * 10) / d <= area.w && (bbox.h * 10) / d <= area.h) return d;
  return SCALES[SCALES.length - 1];
}
function T(g, x, y, s, size, opts = {}) {
  const e = el("text", { x, y, "font-size": size, class: "sh-text", ...opts }, g);
  e.textContent = s;
  return e;
}
function revisions() {
  const r = state.spec && Array.isArray(state.spec.revisions) ? state.spec.revisions : [];
  return r.length ? r : [{ rev: "0", date: new Date().toLocaleDateString(LOCALE), note: t("初版") }];
}

/**
 * 建立一張圖紙。
 * opts: { title, no, den（比例分母，null＝不依比例）, north, legend: [{ type?, name, draw?(g, size) }],
 *         draw(g, root) → 繪製內容（單位 cm），回傳 { bbox }；或 node: { el, bbox }（已建好的節點） }
 */
export function makeSheet(opts) {
  const root = document.createElementNS(NS, "svg");
  root.setAttribute("xmlns", NS);
  root.setAttribute("viewBox", `0 0 ${PAPER.w} ${PAPER.h}`);
  root.setAttribute("width", PAPER.w + "mm");
  root.setAttribute("height", PAPER.h + "mm");
  root.setAttribute("class", "sh-sheet");
  const style = document.createElementNS(NS, "style");
  style.textContent = collectCSS();
  root.appendChild(style);
  el("defs", {}, root);
  el("rect", { x: 0, y: 0, width: PAPER.w, height: PAPER.h, fill: "#fff" }, root);
  // 圖框
  el("rect", { x: 6, y: 6, width: PAPER.w - 12, height: PAPER.h - 12, class: "sh-frame" }, root);
  el("line", { x1: STRIP.x - 3, y1: 6, x2: STRIP.x - 3, y2: PAPER.h - 6, class: "sh-frame" }, root);

  // 內容
  let den = opts.den;
  if (opts.draw || opts.node) {
    const holder = el("g", {}, root);
    let content, bbox;
    if (opts.node) {
      content = opts.node.el;
      bbox = opts.node.bbox;
      holder.appendChild(content);
    } else {
      content = el("g", {}, holder);
      if (den) bbox = opts.draw(content, root, den).bbox;
      else {
        // 字級與比例有關：由大比例往小試，取第一個放得下的
        for (const d of SCALES) {
          content.innerHTML = "";
          bbox = opts.draw(content, root, d).bbox;
          den = d;
          if ((bbox.w * 10) / d <= AREA.w && (bbox.h * 10) / d <= AREA.h) break;
        }
      }
    }
    if (!den) den = fitScale(bbox);
    const k = opts.fitArea ? Math.min(AREA.w / bbox.w, AREA.h / bbox.h) : 10 / den;
    const tx = AREA.x + (AREA.w - bbox.w * k) / 2 - bbox.x * k,
      ty = AREA.y + (AREA.h - bbox.h * k) / 2 - bbox.y * k;
    holder.setAttribute("transform", `translate(${tx} ${ty}) scale(${k})`);
    if (opts.fitArea) den = null;
  } else if (opts.html) {
    const fo = el("foreignObject", { x: AREA.x, y: AREA.y, width: AREA.w, height: AREA.h }, root);
    fo.innerHTML = `<div xmlns="http://www.w3.org/1999/xhtml" class="sh-html">${opts.html}</div>`;
  } else if (opts.rows) drawTable(root, opts.rows);
  titleBlock(root, { ...opts, den });
  return root;
}

function titleBlock(root, o) {
  const g = el("g", { class: "sh-tb" }, root),
    { x, w } = STRIP;
  let y = STRIP.y;
  // 圖例
  if (o.legend && o.legend.length) {
    T(g, x, y + 4, t("圖例"), 3.4, { "font-weight": 700 });
    y += 7;
    const max = Math.floor((STRIP.h - 120) / 6.2);
    for (const lg of o.legend.slice(0, max)) {
      const box = el("svg", { x, y: y - 0.5, width: 7, height: 5, overflow: "visible" }, g);
      drawLegendIcon(box, lg);
      T(g, x + 9, y + 3.6, lg.name, 2.6);
      y += 6.2;
    }
    if (o.legend.length > max) T(g, x, y + 3, t("…等 {n} 項", { n: o.legend.length }), 2.4, { fill: "#666" });
  }
  // 指北針
  if (o.north) {
    const cx = x + w - 10,
      cy = STRIP.y + (o.legend && o.legend.length ? 8 : 10);
    el("circle", { cx, cy, r: 6, class: "sh-line" }, g);
    el(
      "path",
      { d: `M${cx} ${cy - 6} L${cx + 2.6} ${cy + 3} L${cx} ${cy + 1.5} L${cx - 2.6} ${cy + 3} Z`, fill: "#111" },
      g,
    );
    T(g, cx, cy - 7.5, "N", 3, { "text-anchor": "middle", "font-weight": 700 });
  }
  // 標題欄（下方）
  const rows = [
    [t("專案名稱"), (S.PROJ && S.PROJ.name) || (S.BASE && S.BASE.name) || ""],
    [t("方案"), S.PROJ ? curDesign().name : ""],
    [t("圖名"), o.title || ""],
    [t("圖號"), o.no || ""],
    [t("比例"), o.den ? `1:${o.den}` : "NTS"],
    [t("日期"), new Date().toLocaleDateString(LOCALE)],
    [t("設計者"), (state.spec && state.spec.designer) || ""],
  ];
  const rh = 9.5,
    revs = revisions().slice(-4),
    revH = 6 + revs.length * 4.6;
  let yy = STRIP.y + STRIP.h - rows.length * rh - revH - 12;
  // 修訂表
  el("rect", { x, y: yy, width: w, height: revH, class: "sh-line" }, g);
  T(g, x + 1.5, yy + 4, t("修訂"), 2.6, { "font-weight": 700 });
  revs.forEach((r, k) => {
    const ry = yy + 8.6 + k * 4.6;
    T(g, x + 1.5, ry, String(r.rev ?? k), 2.4);
    T(g, x + 7, ry, String(r.date || ""), 2.4);
    T(g, x + 27, ry, String(r.note || "").slice(0, 22), 2.4);
  });
  yy += revH + 2;
  for (const [k, v] of rows) {
    el("rect", { x, y: yy, width: w, height: rh, class: "sh-line" }, g);
    T(g, x + 1.5, yy + 3.2, k, 2.2, { fill: "#666" });
    const big = k === t("圖名") || k === t("圖號");
    T(g, x + 1.5, yy + 7.6, String(v).slice(0, big ? 26 : 32), big ? 3.4 : 2.9, big ? { "font-weight": 700 } : {});
    yy += rh;
  }
  T(g, x, STRIP.y + STRIP.h + 1, "House Layout", 2.6, { fill: "#888" });
}

function drawLegendIcon(box, lg) {
  if (lg.draw) return lg.draw(box);
  if (lg.svg) {
    const doc = new DOMParser().parseFromString(
      String(lg.svg).trim().startsWith("<svg") ? lg.svg : `<svg xmlns="${NS}">${lg.svg}</svg>`,
      "image/svg+xml",
    );
    const s = doc.documentElement;
    if (s && s.nodeName === "svg") {
      for (const c of [...s.childNodes]) box.appendChild(document.importNode(c, true));
      if (s.getAttribute("viewBox")) box.setAttribute("viewBox", s.getAttribute("viewBox"));
    }
    return;
  }
  const def = DEFAULTS[lg.type];
  const f = lg.type && (DRAW[lg.type] || EXT.draw2d[lg.type]);
  if (!def || !f) return;
  const pad = 6,
    m = Math.max(def.w, def.d) + pad * 2;
  box.setAttribute("viewBox", `${-pad - (m - pad * 2 - def.w) / 2} ${-pad - (m - pad * 2 - def.d) / 2} ${m} ${m}`);
  box.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const g = el("g", { class: "item" }, box);
  try {
    f(g, def.w, def.d, { ...def });
  } catch (e) {}
}

/** 一般圖例：目前圖面顯示中的元件類型 */
export function genericLegend(planId) {
  const save = S.plan;
  S.plan = planId;
  const types = [];
  for (const it of state.items)
    if (!["text", "dimension"].includes(it.type) && showState(it) === "on" && !types.includes(it.type))
      types.push(it.type);
  S.plan = save;
  return types.map(type => ({ type, name: DEFAULTS[type]?.name || type }));
}
async function legendFor(planId) {
  try {
    const ns = await import("../mep/index.js");
    if (typeof ns.mepLegend === "function") {
      const r = ns.mepLegend(planId);
      if (Array.isArray(r) && r.length) {
        const gen = genericLegend(planId).filter(x => !r.some(y => y.type === x.type));
        return [...r, ...gen];
      }
    }
  } catch (e) {}
  return genericLegend(planId);
}

/** 擷取某圖面別的平面圖（複製主畫布） */
export function capturePlan(planId) {
  const save = { plan: S.plan, sel: state.sel, msel: S.msel };
  S.plan = planId;
  state.sel = null;
  S.msel = [];
  renderItems();
  const vp = $("viewport").cloneNode(true);
  const defs = $("svg").querySelector("defs");
  S.plan = save.plan;
  state.sel = save.sel;
  S.msel = save.msel;
  renderItems();
  vp.removeAttribute("transform");
  vp.removeAttribute("id");
  for (const id of ["uiLayer", "ghostLayer", "gridLayer"]) {
    const n = vp.querySelector("#" + id);
    if (n) n.remove();
  }
  vp.querySelectorAll("[id]").forEach(n => n.removeAttribute("id"));
  const b = S.BASE.bounds;
  return {
    el: vp,
    defs: defs ? defs.cloneNode(true) : null,
    bbox: { x: b.x - 20, y: b.y - 20, w: b.w + 40, h: b.h + 40 },
  };
}
/** 平面圖選項：swings＝false 不畫開門弧線與門片線；labels＝false 不畫物件文字；cabOutline＝true 櫃體只畫外框 */
export async function planSheet(plan, no, opts = {}) {
  const cap = capturePlan(plan.id);
  const hide = [];
  if (opts.swings === false) hide.push(".door-arc", ".door-leaf", ".swing");
  if (opts.labels === false) hide.push(".item text");
  if (opts.cabOutline) hide.push(".cab-detail");
  if (hide.length) cap.el.querySelectorAll(hide.join(",")).forEach(n => n.remove());
  const legend = await legendFor(plan.id);
  const den = fitScale(cap.bbox);
  const root = makeSheet({ title: plan.name, no, den, north: true, legend, node: cap });
  if (cap.defs) for (const c of [...cap.defs.childNodes]) root.querySelector("defs").appendChild(c.cloneNode(true));
  return root;
}
export function elevationSheet(f, no, opts = {}) {
  return makeSheet({
    title: faceTitle(f),
    no,
    den: opts.den || null,
    draw: (g, root, den) => {
      const r = drawElevation(g, f.i, f.face, { den, root, doors: opts.doors, depth: opts.depth });
      drawNotes(g, f.i, f.face, 0.3 * den, root);
      return r;
    },
  });
}
/** 櫃體圖：若櫃體模組提供 cabSheetSVG(it) 則嵌入 */
export async function cabinetSheets(startNo) {
  let ns = null;
  try {
    ns = await import("../cabinet/index.js");
  } catch (e) {}
  if (!ns || typeof ns.cabSheetSVG !== "function") return [];
  const out = [];
  let n = startNo;
  for (const it of state.items.filter(i => layerOf(i) === "cabinet")) {
    let svgStr = null;
    try {
      svgStr = ns.cabSheetSVG(it);
    } catch (e) {
      console.error(e);
    }
    if (!svgStr) continue;
    const s =
      typeof svgStr === "string" ? new DOMParser().parseFromString(svgStr, "image/svg+xml").documentElement : svgStr;
    if (!s || s.nodeName !== "svg") continue;
    const vb = (s.getAttribute("viewBox") || "0 0 400 280").split(/[\s,]+/).map(Number);
    const node = document.importNode(s, true);
    node.setAttribute("x", vb[0]);
    node.setAttribute("y", vb[1]);
    node.setAttribute("width", vb[2]);
    node.setAttribute("height", vb[3]);
    out.push(
      makeSheet({
        title: `${t("櫃體圖")}｜${it.label || DEFAULTS[it.type]?.name || it.type}`,
        no: `C-${String(n++).padStart(2, "0")}`,
        node: { el: node, bbox: { x: vb[0], y: vb[1], w: vb[2], h: vb[3] } },
        fitArea: true,
      }),
    );
  }
  return out;
}
/** 表格圖紙（數量表） */
function drawTable(root, rows) {
  const g = el("g", { class: "sh-table" }, root);
  const cols = [
    [t("群組"), 40],
    [t("項目"), 92],
    [t("規格"), 88],
    [t("數量"), 26],
    [t("單位"), 18],
    [t("備註"), 59],
  ];
  let y = AREA.y + 6;
  const row = (vals, opt = {}) => {
    let x = AREA.x;
    if (opt.head || opt.sec)
      el("rect", { x: AREA.x, y: y - 4.2, width: AREA.w, height: 5.8, fill: opt.sec ? "#eef2f7" : "#f3f4f6" }, g);
    vals.forEach((v, k) => {
      const anchor = k === 3 ? "end" : "start";
      T(g, k === 3 ? x + cols[k][1] - 2 : x + 1.5, y, String(v ?? "").slice(0, Math.floor(cols[k][1] / 2.3)), 2.7, {
        "text-anchor": anchor,
        ...(opt.head || opt.sec || opt.sub ? { "font-weight": 700 } : {}),
      });
      x += cols[k][1];
    });
    el("line", { x1: AREA.x, y1: y + 1.6, x2: AREA.x + AREA.w, y2: y + 1.6, class: "sh-thin" }, g);
    y += 5.8;
  };
  row(
    cols.map(c => c[0]),
    { head: true },
  );
  for (const r of rows) {
    if (r.sec) row([r.sec, "", "", "", "", ""], { sec: true });
    else row([r.group, r.item, r.spec, r.qty, r.unit, r.note], { sub: r.sub });
  }
}
export const ROWS_PER_SHEET = 44;
