// 櫃體工程圖：正視（關門）、開門正視（內部）、A-A 剖面、平面、尺寸鏈、材質標示、圖框；裁切清單、五金、板材統計
import { t, LOCALE } from "../core/i18n.js";
import { S, state } from "../core/store.js";
import { NS, el, esc, toast } from "../core/dom.js";
import { setSel } from "../canvas/selection.js";
import { curDesign } from "../project/project.js";
import { download, safeName, stamp } from "../io/file.js";
import { getMat } from "../materials/index.js";
import { DEFAULTS } from "../shapes/library.js";
import { itemElev } from "../ext/heights.js";
import { onChange } from "../ext/registry.js";
import { boardSummary, cabCutList, cabFronts, cabHardware, cabLayout, cabParts, countertopOf, isCab } from "./model.js";
import { dimH, dimV, drawElev, drawPlan, drawSection, fmt, line, rect, text } from "./draw.js";

const SHEET_STYLE = `
.s{fill:#fff;stroke:#1f2328;stroke-width:1.3px;vector-effect:non-scaling-stroke}
.t{fill:none;stroke:#1f2328;stroke-width:.8px;vector-effect:non-scaling-stroke}
.d{fill:none;stroke:#1f2328;stroke-width:.8px;stroke-dasharray:5 3;vector-effect:non-scaling-stroke}
.f{fill:#1f2328;stroke:none}.g{fill:#f3f4f6;stroke:#1f2328;stroke-width:1px;vector-effect:non-scaling-stroke}
text{font-family:-apple-system,"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif}`;

export const cabinets = () => state.items.filter(isCab);
const nameOf = it => it.label || (DEFAULTS[it.type] || {}).name || it.type;

/** 櫃體工程圖（SVG 元素）。opts.doors："open"（預設，開門圖畫門扇打開）| "interior"（拆門內部）；opts.tables 是否附裁切清單 */
export function cabSheet(it, opts = {}) {
  const L = cabLayout(it),
    { w, d, h } = L;
  const E = itemElev(it);
  const fs = Math.max(2.6, Math.min(8, Math.max(w, h + E) / 26));
  const gap = Math.max(fs * 14, w * 0.35);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("xmlns", NS);
  const style = document.createElementNS(NS, "style");
  style.textContent = SHEET_STYLE;
  svg.appendChild(style);
  const root = el("g", {}, svg);
  const floor = (g, x1, x2) => line(g, x1 - fs * 2, 0, x2 + fs * 2, 0, { "stroke-width": 1.4 });
  const title = (g, x, y, s) => text(g, x, y, s, fs * 1.05, { "font-weight": 700 });
  const top = -(E + h);
  // A 正視（關門）
  const gA = el("g", {}, root);
  floor(gA, 0, w);
  drawElev(gA, it, { doors: "closed", fs });
  dimH(gA, 0, w, top - fs * 4, fmt(w), fs);
  const { xs } = L;
  if (xs.length > 2)
    for (let i = 0; i < xs.length - 1; i++)
      dimH(gA, xs[i], xs[i + 1], top - fs * 1.8, fmt(xs[i + 1] - xs[i]), fs * 0.8);
  dimV(gA, -fs * 4, -E, top, fmt(h), fs);
  if (E > 0) dimV(gA, -fs * 4, 0, -E, fmt(E), fs);
  if (L.toe > 0) dimV(gA, -fs * 1.8, -E, -E - L.toe, fmt(L.toe), fs * 0.75);
  if (L.topT > 0) dimV(gA, w + fs * 1.8, top + L.topT, top, fmt(L.topT), fs * 0.75);
  title(gA, w / 2, fs * 3, t("正視圖（關門）"));
  // B 開門正視（內部）
  const ox = w + gap;
  const gB = el("g", { transform: `translate(${ox} 0)` }, root);
  floor(gB, 0, w);
  drawElev(gB, it, opts.doors === "interior" ? { interior: true, fs } : { doors: "open", fs });
  // 每格的內部高度尺寸鏈
  const parts = cabParts(it);
  const { drawers } = cabFronts(it);
  for (let i = 0; i < L.c.sections.length; i++) {
    const ys = new Set([L.yb, L.yt]);
    for (const p of parts) if (p.section === i && p.role === "shelf") ys.add(p.y).add(p.y + p.sy);
    for (const o of drawers) if (o.sec === i) ys.add(o.y1).add(o.y2);
    const arr = [...ys].sort((a, b) => a - b).filter((v, k, a) => !k || v - a[k - 1] > 0.5);
    const x = xs[i + 1] - (i === L.c.sections.length - 1 ? L.T : L.T / 2) - fs * 1.2;
    for (let k = 0; k < arr.length - 1; k++)
      if (arr[k + 1] - arr[k] > fs * 1.2)
        dimV(gB, x, -(E + arr[k]), -(E + arr[k + 1]), fmt(arr[k + 1] - arr[k]), fs * 0.65);
  }
  dimH(gB, 0, w, top - fs * 4, fmt(w), fs);
  title(gB, w / 2, fs * 3, opts.doors === "interior" ? t("內部正視（拆門）") : t("開門正視（內部）"));
  // C A-A 剖面
  const cx = 2 * (w + gap);
  const gC = el("g", { transform: `translate(${cx} 0)` }, root);
  floor(gC, 0, d);
  drawSection(gC, it, {
    section: Math.max(
      0,
      L.c.sections.findIndex(s => s.kind !== "knee"),
    ),
  });
  dimH(gC, 0, d, fs * 1.8, fmt(d), fs);
  if (Math.abs(L.cd - d) > 0.5) dimH(gC, 0, L.cd, top - fs * 1.8, fmt(L.cd), fs * 0.8);
  dimV(gC, d + fs * 3, -E, top, fmt(h), fs);
  title(gC, d / 2, fs * 4.6, t("A-A 剖面"));
  // D 平面
  const py = fs * 8;
  const gD = el("g", { transform: `translate(0 ${py})` }, root);
  const gp = el("g", {}, gD);
  drawPlan(gp, w, d, it);
  dimH(gD, 0, w, d + fs * 3, fmt(w), fs);
  dimV(gD, -fs * 3, d, 0, fmt(d), fs);
  title(gD, w / 2, d + fs * 6.5, t("平面圖"));
  // 圖框與材質標示
  const totalW = cx + d + fs * 6;
  const by = py + d + fs * 9;
  const c = L.c;
  const tb = el("g", { transform: `translate(${-fs * 6} ${by})` }, root);
  const TW = totalW + fs * 6,
    TH = fs * 9;
  rect(tb, 0, 0, TW, TH, { "stroke-width": 1.4, fill: "#fff" });
  line(tb, TW * 0.55, 0, TW * 0.55, TH);
  const pj = (S.PROJ && S.PROJ.name) || "";
  const dn = S.PROJ ? curDesign().name : "";
  text(tb, fs, fs * 1.6, `${pj}｜${dn}`, fs * 0.9, { "text-anchor": "start" });
  text(
    tb,
    fs,
    fs * 3.4,
    `${nameOf(it)}\u3000${fmt(w)}×${fmt(d)}×${fmt(h)} cm${E ? `\u3000${t("離地")} ${fmt(E)}` : ""}`,
    fs * 1.2,
    {
      "text-anchor": "start",
      "font-weight": 700,
    },
  );
  text(tb, fs, fs * 5.2, `${t("櫃體工程圖")}\u3000S = 1:20\u3000${new Date().toLocaleDateString(LOCALE)}`, fs * 0.85, {
    "text-anchor": "start",
  });
  text(
    tb,
    fs,
    fs * 7,
    `${t("板厚")} ${c.thk}\u3000${t("背板厚")} ${c.backThk}\u3000${t("踢腳高")} ${c.toe}\u3000${c.overlay === "inset" ? t("內嵌") : t("全蓋")}`,
    fs * 0.8,
    {
      "text-anchor": "start",
    },
  );
  const mats = [
    [t("櫃身"), c.carcassMat],
    [t("門板"), c.doorMat],
    [t("內部"), c.interiorMat],
    [t("五金"), c.handleMat],
    ...(c.top ? [[t("檯面"), c.top.mat]] : []),
  ];
  mats.forEach(([k, id], i) => {
    const x = TW * 0.57 + (i % 2) * TW * 0.22,
      y = fs * (1.8 + Math.floor(i / 2) * 2.2);
    rect(tb, x, y - fs * 0.9, fs * 1.1, fs * 1.1, { fill: getMat(id).color || "#ccc", "stroke-width": 0.6 });
    text(tb, x + fs * 1.6, y, `${k}：${getMat(id).name}`, fs * 0.8, { "text-anchor": "start" });
  });
  let maxY = by + TH;
  if (opts.tables) {
    const rows = cabCutList(it);
    const tg = el("g", { transform: `translate(${-fs * 6} ${maxY + fs * 2})` }, root);
    const cols = [t("板件"), t("數量"), t("長"), t("寬"), t("厚"), t("材質"), t("封邊"), t("紋路")];
    const cw = [0.18, 0.07, 0.08, 0.08, 0.06, 0.3, 0.12, 0.11].map(v => v * TW);
    const rh = fs * 1.5;
    const row = (vals, y, bold) => {
      let x = 0;
      vals.forEach((v, i) => {
        text(tg, x + fs * 0.4, y, String(v), fs * 0.75, {
          "text-anchor": "start",
          ...(bold ? { "font-weight": 700 } : {}),
        });
        x += cw[i];
      });
      line(tg, 0, y + fs * 0.5, TW, y + fs * 0.5, { "stroke-width": 0.4 });
    };
    row(cols, rh, true);
    rows.forEach((r, i) => row([r.part, r.qty, r.L, r.W, r.T, r.matName, r.edge, r.grain], rh * (i + 2)));
    maxY += fs * 2 + rh * (rows.length + 2);
  }
  const minX = -fs * 7,
    minY = top - fs * 7;
  svg.setAttribute("viewBox", `${minX} ${minY} ${totalW - minX + fs} ${maxY - minY + fs}`);
  svg.setAttribute("class", "cabsheet");
  return svg;
}
/** 櫃體工程圖 SVG 字串（給施工圖集匯出用） */
export function cabSheetSVG(it, opts = {}) {
  const s = cabSheet(it, { tables: true, ...opts });
  const vb = s.getAttribute("viewBox").split(" ").map(Number);
  s.setAttribute("width", Math.round(vb[2] * 4));
  s.setAttribute("height", Math.round(vb[3] * 4));
  return new XMLSerializer().serializeToString(s);
}

function tablesHTML(it) {
  const cut = cabCutList(it),
    hw = cabHardware(it),
    bs = boardSummary(it),
    ct = countertopOf(it);
  const th = a => `<tr>${a.map(x => `<th>${x}</th>`).join("")}</tr>`;
  const td = a => `<tr>${a.map(x => `<td>${esc(x)}</td>`).join("")}</tr>`;
  return `<h3>${t("裁切清單")}</h3><table class="cabtbl">${th([t("板件"), t("數量"), t("長"), t("寬"), t("厚"), t("材質"), t("封邊"), t("紋路"), t("備註")])}${cut
    .map(r => td([r.part, r.qty, r.L, r.W, r.T, r.matName, r.edge, r.grain, r.note]))
    .join("")}</table>
  <h3>${t("五金清單")}</h3><table class="cabtbl">${th([t("品項"), t("規格"), t("數量"), t("單位"), t("備註")])}${hw.map(r => td([r.item, r.spec, r.qty, r.unit, r.note])).join("")}</table>
  <h3>${t("板材統計")}</h3><table class="cabtbl">${th([t("材質"), t("厚"), t("面積 (m²)"), t("估計板數（4×8 尺）")])}${bs.rows
    .map(r => td([r.matName, r.T, r.area, r.sheets]))
    .join("")}</table>
  <p class="muted">${t("封邊總長 {m} m；板數已含 {p}% 損耗。", { m: bs.edge, p: Math.round((bs.waste - 1) * 100) })}${
    ct ? ` ${t("檯面：{mat} {l}×{w}×{t} cm", { mat: ct.matName, l: fmt(ct.L), w: fmt(ct.W), t: fmt(ct.T) })}` : ""
  }</p>`;
}

/** 裁切清單＋五金 CSV（含 UTF-8 BOM，Excel 可直接開） */
export function cabCSV(its) {
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [];
  for (const it of [].concat(its)) {
    lines.push([q(nameOf(it)), q(`${fmt(it.w)}×${fmt(it.d)}×${fmt(cabLayout(it).h)}`)].join(","));
    lines.push(
      [t("板件"), t("數量"), t("長"), t("寬"), t("厚"), t("材質"), t("封邊"), t("紋路"), t("備註")].map(q).join(","),
    );
    for (const r of cabCutList(it))
      lines.push([r.part, r.qty, r.L, r.W, r.T, r.matName, r.edge, r.grain, r.note].map(q).join(","));
    lines.push("");
    lines.push([t("品項"), t("規格"), t("數量"), t("單位"), t("備註")].map(q).join(","));
    for (const r of cabHardware(it)) lines.push([r.item, r.spec, r.qty, r.unit, r.note].map(q).join(","));
    lines.push("");
  }
  return "﻿" + lines.join("\r\n");
}

let host = null,
  selId = null,
  openMode = "open",
  timer = 0;
function render() {
  if (!host) return;
  const list = cabinets();
  if (state.sel && list.some(i => i.id === state.sel)) selId = state.sel;
  if (!list.some(i => i.id === selId)) selId = list[0] ? list[0].id : null;
  const it = list.find(i => i.id === selId);
  host.innerHTML = `<div class="cabview"><aside class="cablist"><b>${t("櫃體（{n}）", { n: list.length })}</b>${list
    .map(
      i =>
        `<div data-id="${i.id}" class="${i.id === selId ? "sel" : ""}"><span>${esc(nameOf(i))}</span><small>${fmt(i.w)}×${fmt(i.d)}×${fmt(cabLayout(i).h)}</small></div>`,
    )
    .join(
      "",
    )}${list.length ? "" : `<p class="muted">${t("這個方案還沒有櫃體。從左側「櫃體（參數化）」拖拉到圖上即可加入。")}</p>`}</aside>
    <section class="cabmain">${
      it
        ? `<div class="cabbar"><b>${esc(nameOf(it))}</b><span class="grow"></span>
        <select id="cabOpenMode" title="${t("開門正視的畫法")}"><option value="open" ${openMode === "open" ? "selected" : ""}>${t("開門圖：門扇打開")}</option><option value="interior" ${openMode === "interior" ? "selected" : ""}>${t("開門圖：拆門看內部")}</option></select>
        <button id="cabPrint">🖨 ${t("列印")}</button><button id="cabSvg">${t("匯出 SVG")}</button><button id="cabCsv">${t("匯出裁切清單 CSV")}</button><button id="cabCsvAll">${t("全部櫃體 CSV")}</button></div>
        <div class="cabsheetwrap" id="cabSheetWrap"></div><div class="cabtables">${tablesHTML(it)}</div>`
        : ""
    }</section></div>`;
  host.querySelectorAll(".cablist div[data-id]").forEach(
    d =>
      (d.onclick = () => {
        selId = +d.dataset.id;
        setSel([selId]);
        render();
      }),
  );
  if (!it) return;
  host.querySelector("#cabSheetWrap").appendChild(cabSheet(it, { doors: openMode }));
  host.querySelector("#cabOpenMode").onchange = e => {
    openMode = e.target.value;
    render();
  };
  const fname = ext => `${safeName()}-${nameOf(it).replace(/[\\/:*?"<>|]/g, "_")}-${t("櫃體工程圖")}-${stamp()}.${ext}`;
  host.querySelector("#cabSvg").onclick = () =>
    download(fname("svg"), new Blob([cabSheetSVG(it, { doors: openMode })], { type: "image/svg+xml" }));
  host.querySelector("#cabCsv").onclick = () =>
    download(fname("csv"), new Blob([cabCSV(it)], { type: "text/csv;charset=utf-8" }));
  host.querySelector("#cabCsvAll").onclick = () =>
    download(
      `${safeName()}-${t("裁切清單")}-${stamp()}.csv`,
      new Blob([cabCSV(cabinets())], { type: "text/csv;charset=utf-8" }),
    );
  host.querySelector("#cabPrint").onclick = () => printSheet(it);
}
function printSheet(it) {
  const w = window.open("", "_blank");
  if (!w) {
    toast(t("瀏覽器擋住了列印視窗，請允許彈出視窗"));
    return;
  }
  w.document.write(
    `<!doctype html><meta charset="utf-8"><title>${esc(nameOf(it))}</title><style>body{font:12px -apple-system,"PingFang TC",sans-serif;margin:12mm}svg{width:100%;height:auto}table{border-collapse:collapse;width:100%;margin:6px 0}td,th{border:1px solid #999;padding:2px 5px;text-align:left}h3{margin:10px 0 4px;font-size:13px}@page{size:A3 landscape}</style>` +
      new XMLSerializer().serializeToString(cabSheet(it, { doors: openMode })) +
      tablesHTML(it),
  );
  w.document.close();
  setTimeout(() => w.print(), 300);
}

export const cabView = {
  id: "cab",
  icon: "🗄",
  get name() {
    return t("櫃體工程圖");
  },
  mount(el0) {
    host = el0;
    render();
  },
  unmount() {
    host = null;
  },
  refresh() {
    render();
  },
};
export function initView() {
  onChange(why => {
    if (!host || why === "view") return;
    clearTimeout(timer);
    timer = setTimeout(render, 150);
  });
}
