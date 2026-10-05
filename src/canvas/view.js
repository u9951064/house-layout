// 畫布縮放平移與座標轉換
import { t } from "../core/i18n.js";
import { S, view } from "../core/store.js";
import { $, svg, vp } from "../core/dom.js";
import { drawGrid } from "./base-render.js";
import { renderSelection } from "./items.js";
import { syncZoom } from "../ui/zoombar.js";

export function applyView() {
  vp.setAttribute("transform", `translate(${view.x} ${view.y}) scale(${view.s})`);
  clearTimeout(S.gridT);
  S.gridT = setTimeout(() => {
    if (typeof drawGrid === "function") drawGrid();
  }, 120);
  $("zoomInfo").textContent = t("縮放 {p}%（1 m ≈ {p} px）", { p: Math.round(view.s * 100) });
  if (typeof syncZoom === "function") syncZoom();
}
export function toWorld(cx, cy) {
  const r = svg.getBoundingClientRect();
  return { x: (cx - r.left - view.x) / view.s, y: (cy - r.top - view.y) / view.s };
}
export function fit() {
  if (!S.BASE) return;
  const r = svg.getBoundingClientRect(),
    b = S.BASE.bounds,
    pad = 30;
  const H = r.height - 40; // 扣掉下方分頁列
  view.s = Math.min((r.width - pad * 2) / b.w, (H - pad * 2) / b.h);
  view.x = (r.width - b.w * view.s) / 2 - b.x * view.s;
  view.y = (H - b.h * view.s) / 2 - b.y * view.s;
  applyView();
}
export function zoomBy(k) {
  const r = svg.getBoundingClientRect(),
    cx = r.width / 2,
    cy = r.height / 2,
    px = (cx - view.x) / view.s,
    py = (cy - view.y) / view.s;
  view.s = Math.min(6, Math.max(0.15, view.s * k));
  view.x = cx - px * view.s;
  view.y = cy - py * view.s;
  applyView();
  renderSelection();
}

export function init() {
  svg.addEventListener(
    "wheel",
    e => {
      e.preventDefault();
      const p = toWorld(e.clientX, e.clientY),
        k = Math.exp(-e.deltaY * 0.0015);
      view.s = Math.min(6, Math.max(0.15, view.s * k));
      const r = svg.getBoundingClientRect();
      view.x = e.clientX - r.left - p.x * view.s;
      view.y = e.clientY - r.top - p.y * view.s;
      applyView();
    },
    { passive: false },
  );
}
