// 右下角縮放列
import { S, view } from "../core/store.js";
import { $ } from "../core/dom.js";
import { fit, zoomBy } from "../canvas/view.js";
import { showCtx } from "./context-menu.js";

export var ZMIN = 0.15, ZMAX = 6;
export function s2r(sc) { return Math.round(1000 * Math.log(sc / ZMIN) / Math.log(ZMAX / ZMIN)); }
export function r2s(r) { return ZMIN * Math.pow(ZMAX / ZMIN, r / 1000); }
export function setZoom(sc) { if (!S.BASE) return; zoomBy(Math.min(ZMAX, Math.max(ZMIN, sc)) / view.s); }
export function syncZoom() {
  if (document.activeElement !== $("zbRange")) $("zbRange").value = s2r(view.s);
  if (document.activeElement !== $("zbPct")) $("zbPct").value = Math.round(view.s * 100);
}

export function init() {
  $("zbRange").oninput = e => setZoom(r2s(+e.target.value));
  $("zbOut").onclick = () => zoomBy(0.8);
  $("zbIn").onclick = () => zoomBy(1.25);
  $("zbFit").onclick = fit;
  $("zbPct").onkeydown = e => { if (e.key === "Enter") { const v = parseFloat(e.target.value); if (v > 0) setZoom(v / 100); e.target.blur(); } if (e.key === "Escape") e.target.blur(); };
  $("zbPct").onblur = () => syncZoom();
  $("zbPct").onfocus = e => e.target.select();
  $("zbMenu").onclick = e => {
    const r = $("zbMenu").getBoundingClientRect();
    showCtx(r.right - 160, r.top - 230, [...[20, 40, 60, 80, 100].map(v => ({ t: `${v}%`, k: Math.round(view.s * 100) === v ? "✓" : "", f: () => setZoom(v / 100) })), "-", { t: "全圖顯示", k: "⤢", f: fit }]);
    e.stopPropagation();
  };
  syncZoom();
}
