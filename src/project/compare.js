// 疊圖與並排比較
import { S, state } from "../core/store.js";
import { $, el, esc } from "../core/dom.js";
import { DEFAULTS } from "../shapes/library.js";
import { DRAW } from "../shapes/draw.js";
import { renderItems } from "../canvas/items.js";
import { curDesign, syncDesign } from "./project.js";
import { switchDesign } from "./sheets.js";
import { exportSVGString } from "../io/export.js";

export function renderGhost() {
  const Lg = $("ghostLayer"); Lg.innerHTML = ""; if (!S.PROJ || !S.ghostId) return;
  const d = S.PROJ.designs.find(x => x.id === S.ghostId); if (!d || d === curDesign()) { S.ghostId = null; return; }
  for (const it of d.items) {
    const g = el("g", { class: "item", transform: `translate(${it.x} ${it.y}) rotate(${it.rot} ${it.w / 2} ${it.d / 2})` + (it.flip ? ` translate(${it.w} 0) scale(-1 1)` : "") }, Lg);
    (DRAW[it.type] || DRAW.cabinet)(g, it.w, it.d, it);
  }
}
export function designSVG(d) {
  const keep = state.items, sel = state.sel, g0 = S.ghostId;
  state.items = d.items; state.sel = null; S.ghostId = null; renderItems(); renderGhost();
  const out = exportSVGString(1, d.name);
  state.items = keep; state.sel = sel; S.ghostId = g0; renderItems(); renderGhost();
  return out;
}
export function openCompare() {
  syncDesign(); const G = $("cmpGrid"); G.innerHTML = "";
  S.PROJ.designs.forEach((d, k) => {
    const counts = {}; d.items.forEach(i => { const n = i.label || (DEFAULTS[i.type] || {}).name || i.type; counts[n] = (counts[n] || 0) + 1; });
    const card = document.createElement("div"); card.className = "cmpCard";
    card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>${esc(d.name)}${k === S.PROJ.cur ? '　<span class="muted">（目前）</span>' : ""}</b><button>切換到此方案</button></div>
      <img alt="${esc(d.name)}" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(designSVG(d))}">
      <div class="muted" style="font-size:12px;line-height:1.6">${d.items.length} 個物件：${Object.entries(counts).map(([n, c]) => esc(n) + (c > 1 ? " ×" + c : "")).join("、") || "（空白）"}</div>`;
    card.querySelector("button").onclick = () => { $("cmpModal").classList.remove("show"); switchDesign(k); };
    G.appendChild(card);
  });
  $("cmpModal").classList.add("show");
}

export function init() {
  $("cmpClose").onclick = () => $("cmpModal").classList.remove("show");
}
