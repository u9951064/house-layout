// 施工圖集：勾選平面各圖面別、立面、櫃體圖、數量表 → 一份 A3 多頁、可列印或下載成單一 HTML 檔（全部在瀏覽器內產生）
import { LOCALE, t } from "../core/i18n.js";
import { S, state } from "../core/store.js";
import { $, esc, toast } from "../core/dom.js";
import { commit } from "../core/history.js";
import { EXT } from "../ext/registry.js";
import { layerOf } from "../ext/plans.js";
import { download, safeName, stamp } from "../io/file.js";
import { curDesign } from "../project/project.js";
import { ROWS_PER_SHEET, cabinetSheets, elevationSheet, makeSheet, planSheet } from "./sheet.js";
import { allSections, sheetRows } from "./schedule.js";
import { allFaces } from "./walls.js";
import { itemsInFront } from "./elevation.js";
import { notesOf } from "./notes.js";

const PAGE_CSS =
  "@page{size:A3 landscape;margin:0}html,body{margin:0;background:#e5e7eb}.pg{width:420mm;height:297mm;margin:0 auto 8mm;background:#fff;box-shadow:0 2px 8px #0002;overflow:hidden;page-break-after:always;break-after:page}.pg svg{width:420mm;height:297mm;display:block}@media print{html,body{background:#fff}.pg{margin:0;box-shadow:none}}";

/** 有內容（開口、物件、註記）的牆面 */
export function contentFaces() {
  return allFaces().filter(
    f => !f.ext && ((f.F.ops || []).length || itemsInFront(f.F).length || notesOf(f.i, f.face).length),
  );
}
export function sheetsHTML(svgs, title) {
  const ser = new XMLSerializer();
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PAGE_CSS}</style></head><body>${svgs
    .map(s => `<div class="pg">${ser.serializeToString(s)}</div>`)
    .join("\n")}</body></html>`;
}
export function printSheets(svgs, title) {
  const w = window.open("", "_blank");
  if (!w) {
    toast(t("瀏覽器擋住了新視窗，請改用「下載 HTML」"));
    return;
  }
  w.document.write(sheetsHTML(svgs, title));
  w.document.close();
  setTimeout(() => w.print(), 300);
}

/** 依勾選建立所有圖紙 */
export async function buildSheets(sel) {
  const out = [];
  let n = 1;
  const no = p => `${p}-${String(n++).padStart(2, "0")}`;
  for (const p of EXT.plans) if (sel.plans.includes(p.id)) out.push(await planSheet(p, no("A"), sel.planOpts));
  n = 1;
  if (sel.elev) for (const f of contentFaces()) out.push(elevationSheet(f, no("E"), { doors: sel.doors }));
  if (sel.cab) out.push(...(await cabinetSheets(1)));
  if (sel.sched) {
    const rows = sheetRows(allSections());
    n = 1;
    for (let k = 0; k < rows.length; k += ROWS_PER_SHEET)
      out.push(makeSheet({ title: t("數量估算表"), no: no("Q"), rows: rows.slice(k, k + ROWS_PER_SHEET) }));
  }
  return out;
}

function modal() {
  let m = $("drawsetModal");
  if (m) return m;
  m = document.createElement("div");
  m.id = "drawsetModal";
  m.innerHTML = `<div class="gcard ds-card"><h2>📐 ${t("輸出施工圖集")}</h2><div id="dsBody"></div>
    <div class="actions" style="justify-content:flex-end"><button id="dsCancel">${t("關閉")}</button><button id="dsHTML">${t("下載 HTML")}</button><button id="dsPrint" class="primary">${t("預覽列印")}</button></div></div>`;
  document.body.appendChild(m);
  m.addEventListener("click", e => {
    if (e.target === m) m.classList.remove("show");
  });
  m.querySelector("#dsCancel").onclick = () => m.classList.remove("show");
  return m;
}
function readSel(m) {
  const q = s => m.querySelector(s);
  return {
    plans: [...m.querySelectorAll("[data-plan]:checked")].map(c => c.dataset.plan),
    elev: q("#dsElev").checked,
    cab: q("#dsCab") ? q("#dsCab").checked : false,
    sched: q("#dsSched").checked,
    doors: q("#dsDoors").checked ? "open" : "closed",
    planOpts: {
      swings: q("#dsSwings").checked,
      labels: q("#dsLabels").checked,
      cabOutline: q("#dsCabOutline").checked,
    },
  };
}
function saveMeta(m) {
  state.spec ||= {};
  const d = m.querySelector("#dsDesigner").value.trim(),
    note = m.querySelector("#dsRev").value.trim();
  let changed = false;
  if (d !== (state.spec.designer || "")) {
    state.spec.designer = d;
    changed = true;
  }
  if (note) {
    const revs = (state.spec.revisions ||= []);
    const last = revs[revs.length - 1];
    if (!last || last.note !== note) {
      revs.push({ rev: String(revs.length), date: new Date().toLocaleDateString(LOCALE), note });
      changed = true;
    }
    m.querySelector("#dsRev").value = "";
  }
  if (changed) commit();
}
export async function openDrawSet() {
  if (!S.BASE) return;
  const m = modal();
  const faces = contentFaces();
  const cabs = state.items.filter(i => layerOf(i) === "cabinet").length;
  let hasCab = false;
  try {
    hasCab = typeof (await import("../cabinet/index.js")).cabSheetSVG === "function";
  } catch (e) {}
  const rev = ((state.spec && state.spec.revisions) || []).slice(-1)[0];
  m.querySelector("#dsBody").innerHTML = `
    <div class="ds-cols"><div><b>${t("平面圖")}</b>${EXT.plans
      .filter(p => p.id !== "all")
      .map(p => `<label class="toggle"><input type="checkbox" data-plan="${p.id}" checked>${esc(p.name)}</label>`)
      .join("")}
      <b style="display:block;margin-top:10px">${t("平面圖選項")}</b>
      <label class="toggle"><input type="checkbox" id="dsSwings" checked>${t("顯示開門虛線")}</label>
      <label class="toggle"><input type="checkbox" id="dsLabels" checked>${t("顯示物件文字")}</label>
      <label class="toggle"><input type="checkbox" id="dsCabOutline">${t("櫃體只畫外框")}</label></div>
    <div><b>${t("其他圖面")}</b>
      <label class="toggle"><input type="checkbox" id="dsElev" ${faces.length ? "checked" : ""}>${t("立面圖（{n} 面）", { n: faces.length })}</label>
      <label class="toggle ds-sub"><input type="checkbox" id="dsDoors">${t("立面圖顯示櫃門打開")}</label>
      ${hasCab ? `<label class="toggle"><input type="checkbox" id="dsCab" ${cabs ? "checked" : ""}>${t("櫃體圖（{n} 座）", { n: cabs })}</label>` : ""}
      <label class="toggle"><input type="checkbox" id="dsSched" checked>${t("數量估算表")}</label>
      <b style="display:block;margin-top:10px">${t("圖框資料")}</b>
      <div class="row"><span>${t("設計者")}</span><input id="dsDesigner" type="text" value="${esc((state.spec && state.spec.designer) || "")}"></div>
      <div class="row"><span>${t("修訂說明")}</span><input id="dsRev" type="text" placeholder="${esc(rev ? rev.note : t("初版"))}"></div>
    </div></div>
    <p class="muted" id="dsInfo" style="font-size:12px">${t("A3 橫式，每張含圖框（專案、方案、圖名、圖號、比例、日期、設計者、修訂）。所有圖面都在你的瀏覽器裡產生。")}</p>`;
  const run = async mode => {
    saveMeta(m);
    const sel = readSel(m);
    const info = m.querySelector("#dsInfo");
    info.textContent = t("產生中…");
    const svgs = await buildSheets(sel);
    info.textContent = t("共 {n} 張圖", { n: svgs.length });
    m.dataset.count = svgs.length;
    const title = `${safeName()}-${S.PROJ ? curDesign().name : ""}-${t("施工圖集")}`;
    if (mode === "print") printSheets(svgs, title);
    else download(`${title}-${stamp()}.html`, new Blob([sheetsHTML(svgs, title)], { type: "text/html" }));
  };
  m.querySelector("#dsPrint").onclick = () => run("print");
  m.querySelector("#dsHTML").onclick = () => run("html");
  m.classList.add("show");
}
