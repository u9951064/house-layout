// 家具繪製與選取框
import { S, opt, state, view } from "../core/store.js";
import { TXT, el, itemLayer, uiLayer } from "../core/dom.js";
import { itemBox, unionBox } from "../core/geometry.js";
import { DRAW } from "../shapes/draw.js";
import { cur, selIds, selItems } from "./selection.js";
import { drawMeasure } from "../tools/measure.js";
import { drawCalib } from "../tools/calibrate.js";
import { drawBaseEditUI } from "../base-edit/base-edit.js";
import { renderSheets } from "../project/sheets.js";

export function inOutOfScope(it) {
  if (["text", "wall", "wallArc", "slideDoor", "slideDoorArc", "swingDoor", "doubleDoor", "pocketDoor", "foldDoor", "glassWall", "halfWall", "column", "dimension", "rug", "rugRound", "curtain", "ac", "upper", "screen"].includes(it.type)) return false;
  const b = itemBox(it);
  return (S.BASE && S.BASE.outOfScope || []).some(o => b.x1 < o.r[2] - 1 && b.x2 > o.r[0] + 1 && b.y1 < o.r[3] - 1 && b.y2 > o.r[1] + 1);
}
export function renderItems() {
  itemLayer.innerHTML = "";
  const order = { rug: -2, rugRound: -2, yogamat: -1, wall: 5, wallArc: 5, glassWall: 5, halfWall: 5, column: 5, slideDoor: 6, slideDoorArc: 6, swingDoor: 6, doubleDoor: 6, pocketDoor: 6, foldDoor: 6, upper: 7, ac: 7, screen: 7, curtain: 7, dimension: 8, text: 9 };
  const list = state.items.slice().sort((a, b) => (order[a.type] ?? 0) - (order[b.type] ?? 0) || (a.z ?? 0) - (b.z ?? 0));
  for (const it of list) {
    const g = el("g", { class: "item" + (it.locked ? " locked" : "") + (inOutOfScope(it) ? " bad" : ""), "data-id": it.id,
      transform: `translate(${it.x} ${it.y}) rotate(${it.rot} ${it.w / 2} ${it.d / 2})` + (it.flip ? ` translate(${it.w} 0) scale(-1 1)` : "") }, itemLayer);
    el("rect", { x: 0, y: 0, width: it.w, height: it.d, fill: "transparent", stroke: "none" }, g);   // 點擊範圍
    (DRAW[it.type] || DRAW.cabinet)(g, it.w, it.d, it);
    const showName = it.showName !== false, showSize = opt.size && !["text", "wall", "wallArc", "column", "dimension", "curtain", "tvwall"].includes(it.type);
    if (showName || showSize || it.type === "text") {
      const tg = el("g", { transform: (it.flip ? `translate(${it.w} 0) scale(-1 1) ` : "") + `rotate(${-it.rot} ${it.w / 2} ${it.d / 2})` }, g);
      const label = it.type === "text" ? (it.label || "文字") : it.type === "dimension" ? `${Math.round(it.w)} cm` : (it.label || "");
      const big = Math.min(14, Math.max(9, Math.min(it.w, it.d) * 0.22));
      if (it.type === "dimension") { const t = TXT(tg, it.w / 2, -6, label); t.style.fontSize = "12px"; t.style.fill = "#2563eb"; }
      else if ((showName && label) || it.type === "text") { const t = TXT(tg, it.w / 2, it.d / 2 - (showSize ? big * 0.45 : 0), label); t.style.fontSize = (it.type === "text" ? (it.fontSize || 16) : big) + "px"; }
      if (showSize) { const t = TXT(tg, it.w / 2, it.d / 2 + (showName && label ? big * 0.75 : 0), `${Math.round(it.w)}×${Math.round(it.d)}`, "sz"); t.style.fontSize = Math.max(8, big * 0.75) + "px"; }
    }
  }
  renderSelection();
  if (S.PROJ) renderSheets();
}
export function renderSelection() {
  uiLayer.innerHTML = ""; drawMeasure(); drawCalib(); if (S.mode === "base") { drawBaseEditUI(); return; }
  const kk = 1 / view.s, bb = S.BASE && S.BASE.bounds;
  for (const gd of S.snapGuides) {
    if (gd.x != null) el("line", { x1: gd.x, y1: bb.y, x2: gd.x, y2: bb.y + bb.h, stroke: "#f76707", "stroke-width": 1.2 * kk, "stroke-dasharray": `${5 * kk} ${4 * kk}` }, uiLayer);
    else el("line", { x1: bb.x, y1: gd.y, x2: bb.x + bb.w, y2: gd.y, stroke: "#f76707", "stroke-width": 1.2 * kk, "stroke-dasharray": `${5 * kk} ${4 * kk}` }, uiLayer);
  }
  if (S.boxSel) { const { a, b } = S.boxSel; el("rect", { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y), fill: "rgba(31,111,235,.08)", stroke: "#1f6feb", "stroke-width": kk, "stroke-dasharray": `${4 * kk} ${3 * kk}` }, uiLayer); }
  const ids = selIds();
  if (ids.length > 1) {
    for (const s0 of selItems()) { const g0 = el("g", { transform: `translate(${s0.x} ${s0.y}) rotate(${s0.rot} ${s0.w / 2} ${s0.d / 2})` }, uiLayer); el("rect", { x: -2 * kk, y: -2 * kk, width: s0.w + 4 * kk, height: s0.d + 4 * kk, class: "selbox", "stroke-width": 1.4 * kk }, g0); }
    const u = unionBox(selItems()); el("rect", { x: u.x1 - 6 * kk, y: u.y1 - 6 * kk, width: u.x2 - u.x1 + 12 * kk, height: u.y2 - u.y1 + 12 * kk, fill: "none", stroke: "#1f6feb", "stroke-width": kk, "stroke-opacity": .5 }, uiLayer);
    return;
  }
  const it = cur(); if (!it) return;
  const g = el("g", { transform: `translate(${it.x} ${it.y}) rotate(${it.rot} ${it.w / 2} ${it.d / 2})` }, uiLayer);
  const k = 1 / view.s;
  el("rect", { x: -3 * k, y: -3 * k, width: it.w + 6 * k, height: it.d + 6 * k, class: "selbox", "stroke-width": 1.4 * k }, g);
  if (it.locked) return;
  const hs = 9 * k;
  for (const [hx, hy, kind] of [[it.w, it.d / 2, "e"], [it.w / 2, it.d, "s"], [it.w, it.d, "se"], [0, it.d / 2, "w"], [it.w / 2, 0, "n"]]) {
    el("rect", { x: hx - hs / 2, y: hy - hs / 2, width: hs, height: hs, class: "handle", "data-h": kind, "stroke-width": 1.5 * k, style: `cursor:${{ e: "ew-resize", w: "ew-resize", s: "ns-resize", n: "ns-resize", se: "nwse-resize" }[kind]}` }, g);
  }
  el("line", { x1: it.w / 2, y1: 0, x2: it.w / 2, y2: -22 * k, stroke: "#1f6feb", "stroke-width": 1.2 * k }, g);
  el("circle", { cx: it.w / 2, cy: -26 * k, r: 6 * k, class: "rothandle", "data-h": "rot", "stroke-width": 1.5 * k }, g);
}
