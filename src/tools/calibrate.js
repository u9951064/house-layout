// 圖片底圖的兩點比例校正
import { t } from "../core/i18n.js";
import { S, view } from "../core/store.js";
import { $, el, svg, toast, uiLayer } from "../core/dom.js";
import { fit } from "../canvas/view.js";
import { computeBounds, drawBase, drawGrid } from "../canvas/base-render.js";
import { renderSelection } from "../canvas/items.js";
import { autosave } from "../project/project.js";

export function startCalib() {
  if (!S.BASE || !S.BASE.image) {
    toast(t("只有圖片底圖需要校正比例"));
    return;
  }
  S.calib = { pts: [] };
  $("calbar").classList.add("show");
  svg.style.cursor = "crosshair";
}
export function endCalib() {
  S.calib = null;
  $("calbar").classList.remove("show");
  svg.style.cursor = "";
  renderSelection();
}
export function drawCalib() {
  if (!S.calib) return;
  const k = 1 / view.s;
  S.calib.pts.forEach(p => el("circle", { cx: p.x, cy: p.y, r: 6 * k, fill: "#ea580c" }, uiLayer));
  if (S.calib.pts.length === 2)
    el(
      "line",
      {
        x1: S.calib.pts[0].x,
        y1: S.calib.pts[0].y,
        x2: S.calib.pts[1].x,
        y2: S.calib.pts[1].y,
        stroke: "#ea580c",
        "stroke-width": 2 * k,
      },
      uiLayer,
    );
}
export function applyCalib() {
  const [a, b] = S.calib.pts,
    cur = Math.hypot(b.x - a.x, b.y - a.y);
  const v = prompt(t("這兩點的實際距離是幾公分？（目前量到 {n} 個單位）", { n: Math.round(cur) }), "300");
  const real = parseFloat(v);
  if (!real || real <= 0 || !cur) {
    endCalib();
    return;
  }
  const k = real / cur,
    im = S.BASE.image;
  im.x *= k;
  im.y *= k;
  im.w *= k;
  im.h *= k;
  S.BASE.bounds = computeBounds(S.BASE);
  endCalib();
  drawGrid();
  drawBase();
  fit();
  autosave();
  toast(t("比例已校正：圖上 {a} → 實際 {b} cm。可用「量測」再確認一次", { a: Math.round(cur), b: real }));
}
