// 量測工具
import { S, view } from "../core/store.js";
import { $, el, svg, uiLayer } from "../core/dom.js";
import { renderSelection } from "../canvas/items.js";
import { syncToolbar } from "../ui/toolbar.js";

export function setMeasure(on) { S.measureMode = on; $("btnMeasure").classList.toggle("primary", on); if (typeof syncToolbar === "function") syncToolbar(); svg.style.cursor = on ? "crosshair" : ""; if (!on) { S.measure = null; renderSelection(); } }
export function drawMeasure() {
  if (!S.measure) return; const k = 1 / view.s, { a, b } = S.measure, len = Math.hypot(b.x - a.x, b.y - a.y);
  const g = el("g", {}, uiLayer);
  el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: "#e8590c", "stroke-width": 2 * k }, g);
  for (const p of [a, b]) el("circle", { cx: p.x, cy: p.y, r: 4 * k, fill: "#e8590c" }, g);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  el("rect", { x: mx - 34 * k, y: my - 24 * k, width: 68 * k, height: 20 * k, rx: 4 * k, fill: "#e8590c" }, g);
  const t = el("text", { x: mx, y: my - 14 * k, fill: "#fff", "font-size": 13 * k, "text-anchor": "middle", "dominant-baseline": "middle" }, g);
  t.textContent = `${Math.round(len)} cm`;
}
