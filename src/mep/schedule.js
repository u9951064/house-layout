// 水電空調數量估算與圖例
import { t } from "../core/i18n.js";
import { NS } from "../core/dom.js";
import { state } from "../core/store.js";
import { DEFAULTS } from "../shapes/library.js";
import { spec } from "../ext/heights.js";
import { layerOf } from "../ext/plans.js";
import { DUCT_TYPES, HVAC_TYPES, LIGHT_TYPES, MEP_TYPES, POLY_TYPES, POWER_TYPES, SWITCH_TYPES } from "./catalog.js";
import { DRAW2D } from "./draw2d.js";
import { DUCT_CODE, dropLen, polyLen, val, worldPts } from "./util.js";

const nameOf = type => (DEFAULTS[type] || {}).name || type;
const m = cm => Math.round(cm / 10) / 10; // cm → m（一位小數）

/** 數量估算表 rows：[{ group, item, spec, qty, unit, note }] */
export function mepRows() {
  const items = state.items,
    S = spec(),
    rows = [];
  const countBy = (set, group, unit, specOf = () => "") => {
    const map = new Map();
    for (const it of items)
      if (set.has(it.type)) {
        const k = it.type + "|" + specOf(it);
        const e = map.get(k) || { type: it.type, spec: specOf(it), qty: 0, circuits: new Set() };
        e.qty++;
        if (it.circuit) e.circuits.add(it.circuit);
        map.set(k, e);
      }
    for (const e of map.values())
      rows.push({
        group,
        item: nameOf(e.type),
        spec: e.spec,
        qty: e.qty,
        unit,
        note: [...e.circuits].sort().join(", "),
      });
  };
  countBy(LIGHT_TYPES, t("燈具"), t("盞"), it =>
    [
      val(it, "watt") ? val(it, "watt") + "W" : "",
      val(it, "cct") ? val(it, "cct") + "K" : "",
      it.type === "downlight" ? "Ø" + val(it, "dia") * 10 + "mm" : "",
    ]
      .filter(Boolean)
      .join(" "),
  );
  countBy(SWITCH_TYPES, t("開關"), t("組"));
  countBy(POWER_TYPES, t("插座・弱電"), t("組"), it => t("離地 {h} cm", { h: Math.round(dev(it)) }));
  // 迴路：設備數、總瓦數、配線長度（平面配線＋各設備到天花的垂直段）
  const cmap = new Map();
  for (const it of items) {
    if (!it.circuit || !MEP_TYPES.has(it.type)) continue;
    const e = cmap.get(it.circuit) || { dev: 0, watt: 0, len: 0 };
    if (it.type === "wire") e.len += polyLen(worldPts(it));
    else if (!POLY_TYPES.has(it.type)) {
      e.dev++;
      e.watt += LIGHT_TYPES.has(it.type) ? +val(it, "watt") || 0 : 0;
      e.len += dropLen(it, S.ceilH);
    }
    cmap.set(it.circuit, e);
  }
  for (const [c, e] of [...cmap].sort((a, b) => a[0].localeCompare(b[0])))
    rows.push({
      group: t("迴路"),
      item: c,
      spec: e.watt ? `${e.watt} W` : "",
      qty: m(e.len * 1.1),
      unit: "m",
      note: t("{n} 個設備・含 10% 損耗", { n: e.dev }),
    });
  // 風管：依種類與管徑
  const dmap = new Map();
  for (const it of items)
    if (DUCT_TYPES.includes(it.type)) {
      const k = it.type + "|" + val(it, "dia");
      dmap.set(k, (dmap.get(k) || 0) + polyLen(worldPts(it)));
    }
  for (const [k, len] of dmap) {
    const [type, dia] = k.split("|");
    rows.push({
      group: t("風管"),
      item: nameOf(type),
      spec: `${DUCT_CODE[type]} Ø${Math.round(dia * 10)} mm`,
      qty: m(len),
      unit: "m",
      note: "",
    });
  }
  countBy(new Set([...HVAC_TYPES].filter(k => !DUCT_TYPES.includes(k))), t("空調・全熱交換"), t("台"), it =>
    it.type === "ervUnit"
      ? `${val(it, "cmh")} m³/h`
      : it.type === "acIndoor"
        ? `${val(it, "kw")} kW`
        : it.type === "diffuser"
          ? { round: t("圓形"), square: t("方形"), linear: t("線型") }[val(it, "style")] || ""
          : "",
  );
  const wl = items.filter(i => i.type === "conduit").reduce((s, i) => s + polyLen(worldPts(i)), 0);
  if (wl) rows.push({ group: t("配管"), item: nameOf("conduit"), spec: "", qty: m(wl), unit: "m", note: "" });
  return rows;
}
function dev(it) {
  const d = DEFAULTS[it.type] || {};
  return it.elev ?? d.elev ?? 0;
}

const PLAN_LAYERS = {
  light: ["light"],
  power: ["power"],
  hvac: ["hvac"],
  ceiling: ["light", "hvac"],
  all: ["light", "power", "hvac"],
  layout: ["light", "power", "hvac"],
};
/** 依 class 補上行內樣式，讓圖例 SVG 可獨立使用 */
function inlineStyles(root) {
  const S = {
    s: { fill: "#fff", stroke: "#262626", "stroke-width": 1.3 },
    t: { fill: "none", stroke: "#262626", "stroke-width": 0.8 },
    d: { fill: "none", stroke: "#262626", "stroke-width": 0.8, "stroke-dasharray": "4 3" },
    f: { fill: "#262626", stroke: "none" },
    g: { fill: "#f3f4f6", stroke: "#262626", "stroke-width": 1 },
  };
  root.querySelectorAll("[class]").forEach(e => {
    const st = S[e.getAttribute("class")];
    if (st) for (const k in st) if (!e.hasAttribute(k)) e.setAttribute(k, st[k]);
    if (e.tagName === "text") {
      e.setAttribute("text-anchor", "middle");
      e.setAttribute("dominant-baseline", "middle");
      e.setAttribute("font-family", "sans-serif");
    }
  });
  root.querySelectorAll("line:not([stroke])").forEach(e => {
    e.setAttribute("stroke", "#262626");
    e.setAttribute("stroke-width", 0.8);
  });
}

/**
 * 圖例：回傳 SVG 片段字串（`<g>…</g>`，行內樣式、可直接嵌入圖紙），只列出目前方案有用到的水電空調元件
 * @param {string} plan 圖面別 id（light／power／hvac／ceiling／all），決定列出哪些圖層
 * @param {{ x?: number, y?: number, cols?: number, title?: boolean }} [o] 位置（cm 或 px，與嵌入的座標系一致）
 * @returns {{ svg: string, w: number, h: number, count: number }} svg 片段、大約尺寸、列出的項目數
 */
export function mepLegend(plan = "all", o = {}) {
  const layers = PLAN_LAYERS[plan] || PLAN_LAYERS.all;
  const used = [];
  for (const it of state.items)
    if (MEP_TYPES.has(it.type) && layers.includes(layerOf(it)) && !used.some(u => u.type === it.type)) used.push(it);
  const cols = o.cols || 2,
    cw = 150,
    rh = 22,
    x0 = o.x || 0,
    y0 = o.y || 0;
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", "mep-legend");
  g.setAttribute("transform", `translate(${x0} ${y0})`);
  let y = 0;
  if (o.title !== false) {
    const tt = document.createElementNS(NS, "text");
    tt.setAttribute("x", 0);
    tt.setAttribute("y", 10);
    tt.setAttribute("font-size", 11);
    tt.setAttribute("font-weight", 700);
    tt.textContent = t("圖例");
    g.appendChild(tt);
    y = 18;
  }
  used.forEach((it, i) => {
    const cx = (i % cols) * cw,
      cy = y + Math.floor(i / cols) * rh;
    const box = document.createElementNS(NS, "g");
    const def = DEFAULTS[it.type] || {};
    const sample = POLY_TYPES.has(it.type)
      ? {
          ...it,
          w: 30,
          d: 10,
          pts: [
            [0, 5],
            [30, 5],
          ],
          rot: 0,
          flip: false,
          circuit: undefined,
        }
      : { ...def, ...it, rot: 0, flip: false, circuit: undefined };
    const w = sample.w,
      d = sample.d,
      k = Math.min(28 / Math.max(w, 1), 14 / Math.max(d, 1), 1.2);
    box.setAttribute("transform", `translate(${cx + 14 - (w * k) / 2} ${cy + 8 - (d * k) / 2}) scale(${k})`);
    (DRAW2D[it.type] || (() => {}))(box, w, d, sample);
    g.appendChild(box);
    const tx = document.createElementNS(NS, "text");
    tx.setAttribute("x", cx + 34);
    tx.setAttribute("y", cy + 12);
    tx.setAttribute("font-size", 10);
    tx.textContent = def.name || it.type;
    g.appendChild(tx);
  });
  inlineStyles(g);
  g.querySelectorAll("text").forEach(e => {
    if (e.parentNode === g) {
      e.setAttribute("text-anchor", "start");
      e.removeAttribute("dominant-baseline");
    }
  });
  const rowsN = Math.ceil(used.length / cols);
  return { svg: g.outerHTML, w: cols * cw, h: y + rowsN * rh, count: used.length };
}
