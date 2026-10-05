// 數量估算表：彙整各模組的 EXT.schedules 與基本資料（家具、隔間門、牆長、門窗、房間），可匯出 CSV、列印
import { t } from "../core/i18n.js";
import { S, state } from "../core/store.js";
import { esc } from "../core/dom.js";
import { DEFAULTS } from "../shapes/library.js";
import { EXT } from "../ext/registry.js";
import { layerOf } from "../ext/plans.js";
import { download, safeName, stamp } from "../io/file.js";

const r1 = v => Math.round(v * 100) / 100;

/** 基本資料列 */
export function coreRows() {
  const rows = [];
  const count = (layer, group) => {
    const m = new Map();
    for (const it of state.items.filter(i => layerOf(i) === layer && !["text", "dimension"].includes(i.type))) {
      const name = DEFAULTS[it.type]?.name || it.type,
        key = `${name}|${Math.round(it.w)}×${Math.round(it.d)}`;
      const e = m.get(key) || {
        group,
        item: name,
        spec: `${Math.round(it.w)}×${Math.round(it.d)} cm`,
        qty: 0,
        unit: t("件"),
        note: "",
      };
      e.qty++;
      m.set(key, e);
    }
    rows.push(...[...m.values()].sort((a, b) => a.item.localeCompare(b.item)));
  };
  count("furniture", t("家具"));
  count("partition", t("隔間・門"));
  if (S.BASE) {
    const byT = new Map();
    let win = 0,
      door = 0,
      open = 0,
      winW = 0,
      doorW = 0;
    for (const w of S.BASE.walls || []) {
      const L = Math.hypot(w[2] - w[0], w[3] - w[1]) / 100,
        th = w[4] || 12;
      byT.set(th, (byT.get(th) || 0) + L);
      for (const op of w[5] || []) {
        const ww = Math.abs(op[1] - op[0]);
        if (op[2] === "win") {
          win++;
          winW += ww;
        } else if (op[2] === "door") {
          door++;
          doorW += ww;
        } else open++;
      }
    }
    for (const [th, L] of [...byT].sort((a, b) => b[0] - a[0]))
      rows.push({
        group: t("底圖"),
        item: t("牆（中心線長）"),
        spec: t("厚 {t} cm", { t: th }),
        qty: r1(L),
        unit: "m",
        note: "",
      });
    if (win)
      rows.push({
        group: t("底圖"),
        item: t("窗"),
        spec: t("合計寬 {w} cm", { w: Math.round(winW) }),
        qty: win,
        unit: t("樘"),
        note: "",
      });
    if (door)
      rows.push({
        group: t("底圖"),
        item: t("門"),
        spec: t("合計寬 {w} cm", { w: Math.round(doorW) }),
        qty: door,
        unit: t("樘"),
        note: "",
      });
    if (open) rows.push({ group: t("底圖"), item: t("開口"), spec: "", qty: open, unit: t("處"), note: "" });
    for (const r of S.BASE.rooms || [])
      rows.push({ group: t("房間"), item: r.n, spec: r.s || "", qty: 1, unit: t("間"), note: "" });
  }
  return rows;
}
/** 所有區塊：[{ id, name, rows }] */
export function allSections() {
  const secs = [{ id: "core", name: t("基本資料"), rows: coreRows() }];
  for (const s of EXT.schedules) {
    let rows = [];
    try {
      rows = s.rows() || [];
    } catch (e) {
      console.error(e);
    }
    if (rows.length) secs.push({ id: s.id, name: s.name, rows });
  }
  return secs;
}
/** 依群組排列並加上小計（同單位加總） */
export function withSubtotals(rows) {
  const groups = new Map();
  for (const r of rows) (groups.get(r.group || "") || groups.set(r.group || "", []).get(r.group || "")).push(r);
  const out = [];
  for (const [g, rs] of groups) {
    out.push(...rs.map(r => ({ ...r, group: g })));
    const units = new Map();
    for (const r of rs) if (typeof r.qty === "number") units.set(r.unit || "", (units.get(r.unit || "") || 0) + r.qty);
    if (rs.length > 1)
      for (const [u, q] of units)
        out.push({ group: g, item: t("小計"), spec: "", qty: r1(q), unit: u, note: "", sub: true });
  }
  return out;
}
export function scheduleHTML(secs = allSections()) {
  return secs
    .map(
      s =>
        `<section class="sc-sec"><h3>${esc(s.name)}</h3><table class="sc-table"><thead><tr><th>${t("群組")}</th><th>${t("項目")}</th><th>${t("規格")}</th><th class="num">${t("數量")}</th><th>${t("單位")}</th><th>${t("備註")}</th></tr></thead><tbody>${withSubtotals(
          s.rows,
        )
          .map(
            r =>
              `<tr class="${r.sub ? "sub" : ""}"><td>${esc(r.group ?? "")}</td><td>${esc(r.item ?? "")}</td><td>${esc(r.spec ?? "")}</td><td class="num">${esc(r.qty ?? "")}</td><td>${esc(r.unit ?? "")}</td><td>${esc(r.note ?? "")}</td></tr>`,
          )
          .join("")}</tbody></table></section>`,
    )
    .join("");
}
const csvCell = v => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function scheduleCSV(secs = allSections()) {
  const lines = [[t("分類"), t("群組"), t("項目"), t("規格"), t("數量"), t("單位"), t("備註")].join(",")];
  for (const s of secs)
    for (const r of withSubtotals(s.rows))
      lines.push([s.name, r.group, r.item, r.spec, r.qty, r.unit, r.note].map(csvCell).join(","));
  return "﻿" + lines.join("\r\n");
}
export function exportCSV() {
  download(
    `${safeName()}-${t("數量表")}-${stamp()}.csv`,
    new Blob([scheduleCSV()], { type: "text/csv;charset=utf-8" }),
  );
}
/** 平面化列（給圖紙表格用，含區塊標題） */
export function sheetRows(secs = allSections()) {
  return secs.flatMap(s => [{ sec: s.name }, ...withSubtotals(s.rows)]);
}

let host = null;
function render() {
  if (!host) return;
  if (!S.BASE) {
    host.innerHTML = `<div class="sc-empty">${t("尚未匯入底圖。")}</div>`;
    return;
  }
  const secs = allSections();
  host.innerHTML = `<div class="sc-wrap"><div class="sc-bar"><b>${t("數量估算表")}</b><span class="grow"></span><button id="scCSV">${t("匯出 CSV")}</button><button id="scPrint">${t("列印")}</button></div>
    <p class="muted sc-note">${t("數量依目前方案自動計算，僅供估價參考；實際請以現場丈量為準。")}</p>${scheduleHTML(secs)}</div>`;
  host.querySelector("#scCSV").onclick = exportCSV;
  host.querySelector("#scPrint").onclick = () =>
    printHTML(`<h2>${esc(t("數量估算表"))}</h2>${scheduleHTML(secs)}`, t("數量估算表"));
}
export function printHTML(body, title) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:13px -apple-system,'PingFang TC','Noto Sans TC',sans-serif;margin:16mm}table{border-collapse:collapse;width:100%;margin:6px 0 16px}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}th{background:#f3f4f6}td.num,th.num{text-align:right}tr.sub td{font-weight:700;background:#fafafa}</style></head><body>${body}</body></html>`,
  );
  w.document.close();
  setTimeout(() => w.print(), 200);
}
export const schedView = {
  id: "sched",
  name: t("數量表"),
  icon: "▤",
  mount(el) {
    host = el;
    render();
  },
  unmount() {
    host = null;
  },
  refresh: render,
};
