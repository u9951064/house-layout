// 畫布工具：畫走線（配線）、畫風管、編輯折線節點
import { t } from "../core/i18n.js";
import { S, state, view } from "../core/store.js";
import { $, el, toast } from "../core/dom.js";
import { commit } from "../core/history.js";
import { snapV } from "../core/geometry.js";
import { DEFAULTS } from "../shapes/library.js";
import { renderItems, renderSelection } from "../canvas/items.js";
import { cur } from "../canvas/selection.js";
import { setTool } from "../canvas/interact.js";
import { renderProps } from "../ui/props.js";
import { registerTool } from "../ext/registry.js";
import { DUCT_TYPES, MEP_TYPES, POLY_TYPES } from "./catalog.js";
import { DUCT_COLOR, centerOf, circuitColor, circuits, fitPts, isPoly, toWorldPt, worldPts } from "./util.js";

/** 工具選項（跨次使用保留） */
export const TOOL_OPT = { duct: "ductSupply", dia: 10, wire: "wire", kind: "light", circuit: "L1" };
/** 工具名稱可帶預設類型：duct、duct:ductReturn、wire、wire:conduit（元件庫卡片的 def.tool） */
export const kindOf = name => String(name || "").split(":")[0];
/** 啟用工具時套用名稱裡的預設類型 */
export function applyPreset(name) {
  const [k, sub] = String(name || "").split(":");
  if (k === "duct" && sub && DEFAULTS[sub]) {
    TOOL_OPT.duct = sub;
    TOOL_OPT.dia = DEFAULTS[sub].dia || TOOL_OPT.dia;
  }
  if (k === "wire") {
    TOOL_OPT.wire = sub === "conduit" ? "conduit" : "wire";
    if (TOOL_OPT.wire === "conduit") TOOL_OPT.kind = "power";
  }
}
let pts = [],
  hover = null,
  lastDown = 0;

/** 吸附目標：水電設備中心、全熱交換機的四個風口 */
function snapTargets() {
  const out = [];
  for (const it of state.items) {
    if (!MEP_TYPES.has(it.type) || POLY_TYPES.has(it.type)) continue;
    if (it.type === "ervUnit") {
      for (const [px, py] of [
        [0, it.d * 0.27],
        [0, it.d * 0.73],
        [it.w, it.d * 0.27],
        [it.w, it.d * 0.73],
      ])
        out.push(toWorldPt(it, [px, py]));
    } else out.push(centerOf(it));
  }
  // 其他折線的端點（接續畫）
  for (const it of state.items) if (isPoly(it)) for (const p of worldPts(it)) out.push(p);
  return out;
}
function snapPoint(p, e) {
  const tol = 14 / view.s;
  let best = null,
    bd = tol;
  for (const q of snapTargets()) {
    const dd = Math.hypot(q[0] - p.x, q[1] - p.y);
    if (dd < bd) [best, bd] = [q, dd];
  }
  let x = best ? best[0] : snapV(p.x),
    y = best ? best[1] : snapV(p.y);
  const last = pts[pts.length - 1];
  if (last && e && e.shiftKey) {
    if (Math.abs(x - last[0]) >= Math.abs(y - last[1])) y = last[1];
    else x = last[0];
  }
  return [x, y];
}

function finish(kind) {
  if (pts.length < 2) {
    pts = [];
    return;
  }
  const type = kind === "duct" ? TOOL_OPT.duct : TOOL_OPT.wire,
    def = DEFAULTS[type] || {};
  const it = {
    id: state.nextId++,
    type,
    label: def.name,
    x: 0,
    y: 0,
    w: 1,
    d: 1,
    rot: 0,
    z: state.nextId,
    showName: false,
  };
  if (kind === "duct") it.dia = TOOL_OPT.dia;
  else {
    it.kind = TOOL_OPT.kind;
    it.layer = TOOL_OPT.kind === "light" && type === "wire" ? "light" : "power";
    if (TOOL_OPT.circuit) it.circuit = TOOL_OPT.circuit;
  }
  fitPts(it, pts);
  state.items.push(it);
  state.sel = it.id;
  S.msel = [];
  pts = [];
  renderItems();
  renderProps();
  commit();
  toast(t("已加入「{name}」（{n} 個節點），可繼續畫下一段，Esc 結束", { name: def.name, n: it.pts.length }));
}

function polyTool(kind) {
  return {
    cursor: "crosshair",
    down(p, e) {
      const q = snapPoint(p, e),
        last = pts[pts.length - 1],
        now = Date.now();
      if (last && Math.hypot(q[0] - last[0], q[1] - last[1]) < 0.5) {
        if (now - lastDown < 450) finish(kind);
      } else pts.push(q);
      lastDown = now;
    },
    move(p, e) {
      hover = snapPoint(p, e);
    },
    key(e) {
      if (e.key === "Enter") {
        finish(kind);
        return true;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        pts.pop();
        return true;
      }
      return false;
    },
    draw(layer, kk) {
      const col = kind === "duct" ? DUCT_COLOR[TOOL_OPT.duct] : circuitColor(TOOL_OPT.circuit);
      const all = hover ? [...pts, hover] : pts;
      if (all.length >= 2)
        el(
          "path",
          {
            d: "M" + all.map(q => q.join(" ")).join(" L"),
            fill: "none",
            stroke: col,
            "stroke-width": kind === "duct" ? TOOL_OPT.dia : 1.6 * kk,
            "stroke-opacity": kind === "duct" ? 0.35 : 0.9,
            "stroke-linejoin": "round",
          },
          layer,
        );
      for (const q of pts) el("circle", { cx: q[0], cy: q[1], r: 3 * kk, fill: col }, layer);
      if (hover)
        el(
          "circle",
          { cx: hover[0], cy: hover[1], r: 5 * kk, fill: "none", stroke: col, "stroke-width": 1.2 * kk },
          layer,
        );
    },
    cancel() {
      if (pts.length >= 2) finish(kind);
      pts = [];
      hover = null;
    },
  };
}

/** 編輯選取折線的節點：拖曳節點移動、點線段新增節點、Alt＋點節點刪除 */
let drag = null;
const editTool = {
  cursor: "default",
  down(p, e) {
    const it = cur();
    if (!it || !isPoly(it)) return setTool(null);
    const wp = worldPts(it),
      tol = 8 / view.s;
    const i = wp.findIndex(q => Math.hypot(q[0] - p.x, q[1] - p.y) < tol);
    if (i >= 0) {
      if (e.altKey && wp.length > 2) {
        wp.splice(i, 1);
        fitPts(it, wp);
        renderItems();
        commit();
        return;
      }
      drag = { it, i, wp };
      return;
    }
    // 點在線段上：插入節點
    for (let k = 1; k < wp.length; k++) {
      const [x1, y1] = wp[k - 1],
        [x2, y2] = wp[k],
        L2 = (x2 - x1) ** 2 + (y2 - y1) ** 2,
        u = L2 ? Math.max(0, Math.min(1, ((p.x - x1) * (x2 - x1) + (p.y - y1) * (y2 - y1)) / L2)) : 0,
        dx = x1 + u * (x2 - x1) - p.x,
        dy = y1 + u * (y2 - y1) - p.y;
      if (Math.hypot(dx, dy) < tol) {
        wp.splice(k, 0, [snapV(p.x), snapV(p.y)]);
        fitPts(it, wp);
        renderItems();
        drag = { it, i: k, wp: worldPts(it) };
        return;
      }
    }
    setTool(null);
  },
  move(p, e) {
    if (!drag) return;
    const last = drag.wp[drag.i - 1] || drag.wp[drag.i + 1];
    let x = snapV(p.x),
      y = snapV(p.y);
    if (e.shiftKey && last) {
      if (Math.abs(x - last[0]) >= Math.abs(y - last[1])) y = last[1];
      else x = last[0];
    }
    drag.wp[drag.i] = [x, y];
    fitPts(drag.it, drag.wp);
    renderItems();
  },
  up() {
    if (!drag) return;
    drag = null;
    commit();
    renderProps();
  },
  draw(layer, kk) {
    const it = cur();
    if (!it || !isPoly(it)) return;
    for (const [x, y] of worldPts(it))
      el(
        "rect",
        {
          x: x - 4 * kk,
          y: y - 4 * kk,
          width: 8 * kk,
          height: 8 * kk,
          fill: "#fff",
          stroke: "#1f6feb",
          "stroke-width": 1.5 * kk,
        },
        layer,
      );
  },
  cancel() {
    drag = null;
  },
};

export function registerTools() {
  const wire = polyTool("wire"),
    duct = polyTool("duct");
  for (const n of ["wire", "wire:wire", "wire:conduit"]) registerTool(n, wire);
  registerTool("duct", duct);
  for (const k of DUCT_TYPES) registerTool("duct:" + k, duct);
  registerTool("editPts", editTool);
}

/** 工具列按鈕與工具選項列 */
export function toolBarHTML() {
  return `<span id="mepTools"><button class="tb" id="tbWire" title="${t("畫配線：點擊放節點，雙擊或 Enter 完成，Backspace 刪上一點，Shift 鎖水平／垂直，Esc 結束")}">〰 ${t("走線")}</button><button class="tb" id="tbDuct" title="${t("畫風管：點擊放節點，雙擊或 Enter 完成，會吸附全熱交換機風口與出回風口")}">▭ ${t("風管")}</button></span>`;
}
export function renderToolOpts() {
  const bar = $("mepBar");
  if (!bar) return;
  const kind = kindOf(S.tool),
    on = kind === "wire" || kind === "duct";
  bar.hidden = !on;
  document
    .querySelectorAll("#tbWire,#tbDuct")
    .forEach(b => b.classList.toggle("on", kind === b.id.slice(2).toLowerCase()));
  if (!on) return;
  const cs = circuits();
  bar.innerHTML =
    kind === "duct"
      ? `<b>▭ ${t("風管")}</b>
      <select id="mepDuctType">${DUCT_TYPES.map(k => `<option value="${k}" ${TOOL_OPT.duct === k ? "selected" : ""}>${DEFAULTS[k].name}</option>`).join("")}</select>
      <label>Ø <select id="mepDia">${[7.5, 10, 15, 20, 25].map(v => `<option value="${v}" ${TOOL_OPT.dia === v ? "selected" : ""}>${v * 10} mm</option>`).join("")}</select></label>
      <span class="muted">${t("點擊放節點・雙擊／Enter 完成・Esc 結束")}</span>`
      : `<b>〰 ${t("走線")}</b>
      <select id="mepWire"><option value="wire" ${TOOL_OPT.wire === "wire" ? "selected" : ""}>${DEFAULTS.wire.name}</option><option value="conduit" ${TOOL_OPT.wire === "conduit" ? "selected" : ""}>${DEFAULTS.conduit.name}</option></select>
      <select id="mepKind"><option value="light" ${TOOL_OPT.kind === "light" ? "selected" : ""}>${t("燈具迴路")}</option><option value="power" ${TOOL_OPT.kind === "power" ? "selected" : ""}>${t("插座迴路")}</option><option value="data" ${TOOL_OPT.kind === "data" ? "selected" : ""}>${t("弱電")}</option></select>
      <label>${t("迴路")} <input id="mepCircuit" list="mepCircuits" value="${TOOL_OPT.circuit}" size="4"></label><datalist id="mepCircuits">${cs.map(c => `<option value="${c}">`).join("")}</datalist>
      <span class="muted">${t("點擊放節點・雙擊／Enter 完成・Esc 結束")}</span>`;
  if ($("mepDuctType")) $("mepDuctType").onchange = e => (TOOL_OPT.duct = e.target.value);
  if ($("mepDia")) $("mepDia").onchange = e => (TOOL_OPT.dia = +e.target.value);
  if ($("mepWire")) $("mepWire").onchange = e => (TOOL_OPT.wire = e.target.value);
  if ($("mepKind"))
    $("mepKind").onchange = e => {
      TOOL_OPT.kind = e.target.value;
      if (e.target.value === "power" && /^L/.test(TOOL_OPT.circuit)) TOOL_OPT.circuit = "P1";
      if (e.target.value === "light" && /^P/.test(TOOL_OPT.circuit)) TOOL_OPT.circuit = "L1";
      if (e.target.value === "data") TOOL_OPT.circuit = "D1";
      renderToolOpts();
    };
  if ($("mepCircuit")) $("mepCircuit").onchange = e => (TOOL_OPT.circuit = e.target.value.trim());
  renderSelection();
}
export function toggleTool(name) {
  setTool(kindOf(S.tool) === kindOf(name) ? null : name);
}
