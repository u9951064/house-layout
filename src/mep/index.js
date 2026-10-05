// 水電空調模組：燈具、開關、插座弱電、電箱、配線（迴路）、全熱交換機與風管、出回風口、吊隱式冷氣
//
// 對外 API：
// - mepRows() → 數量估算表 rows（也已用 registerSchedule 註冊為「水電空調」）
// - mepLegend(plan, { x, y, cols, title }) → { svg, w, h, count }：圖例 SVG 片段（行內樣式，可直接嵌入圖紙），
//   只列出目前方案用到、且屬於該圖面別圖層（light／power／hvac／ceiling／all）的元件
// - fitPts(it, worldPts?)：折線物件正規化（pts 相對左上角、外框重算、rot/flip 歸零）
// - worldPts(it)、polyLen(pts)：折線世界座標與長度
// - linkSwitch(switchItem, lightIds) → 條數：從開關產生到各燈具的配線並設為同一迴路
// - TOOL_OPT：走線／風管工具目前的選項
// 資料欄位：it.circuit 迴路、it.watt、it.cct、it.dia（cm，風管管徑／嵌燈開孔）、it.drop、it.kind（light|power|data）、
//   it.pts（折線節點，相對 it.x/it.y）、it.elev（牆面設備＝面板中心高度；吸頂設備預設跟著天花高度；風管＝中心線高度）
import { t } from "../core/i18n.js";
import { S, state } from "../core/store.js";
import { $ } from "../core/dom.js";
import { registerCatalog } from "../shapes/library.js";
import { cur } from "../canvas/selection.js";
import { setTool } from "../canvas/interact.js";
import { EXT, onChange, registerMenu, registerSchedule } from "../ext/registry.js";
import { MEP_TYPES, POLY_TYPES, catalogs } from "./catalog.js";
import { DRAW2D } from "./draw2d.js";
import { build3d, elev2d } from "./build3d.js";
import { linkSwitch, registerProps } from "./props.js";
import { mepLegend, mepRows } from "./schedule.js";
import { TOOL_OPT, applyPreset, kindOf, registerTools, renderToolOpts, toggleTool, toolBarHTML } from "./tools.js";
import { defaultPts, fillParams, fitPts, isPoly, polyLen, worldPts } from "./util.js";

export { TOOL_OPT, fitPts, linkSwitch, mepLegend, mepRows, polyLen, worldPts };

export function register() {
  for (const c of catalogs()) {
    for (const def of c.items) def.init = initItem;
    registerCatalog(c);
  }
  for (const type of MEP_TYPES) {
    EXT.noSize.add(type);
    EXT.draw2d[type] = DRAW2D[type];
    EXT.build3d[type] = build3d;
    EXT.elev2d[type] = elev2d;
    EXT.noScopeCheck.add(type);
  }
  for (const type of POLY_TYPES) {
    EXT.noResize.add(type);
    EXT.noHit.add(type);
  }
  registerProps();
  registerTools();
  registerSchedule({ id: "mep", name: t("水電空調"), rows: mepRows });
  registerMenu("design", () => {
    const c = cur();
    return [
      { h: t("水電空調") },
      { t: "〰 " + t("畫走線（配線）"), c: kindOf(S.tool) === "wire", f: () => toggleTool("wire"), off: !S.BASE },
      { t: "▭ " + t("畫風管"), c: kindOf(S.tool) === "duct", f: () => toggleTool("duct"), off: !S.BASE },
      { t: "✎ " + t("編輯折線節點"), f: () => setTool("editPts"), off: !(c && isPoly(c)) },
    ];
  });
}

/** 新物件（addItem 呼叫 def.init）與舊檔物件：補齊預設參數、隱藏名稱、折線補節點 */
function initItem(it) {
  fillParams(it);
  if (it.showName == null) it.showName = false;
  if (POLY_TYPES.has(it.type) && !(Array.isArray(it.pts) && it.pts.length >= 2)) it.pts = defaultPts(it);
  if (it.type === "wire" && !it.layer) it.layer = it.kind === "light" || !it.kind ? "light" : "power";
}
function normalize() {
  for (const it of state.items) {
    if (!MEP_TYPES.has(it.type) || it._mepOk) continue;
    initItem(it);
    Object.defineProperty(it, "_mepOk", { value: true, enumerable: false, configurable: true });
  }
}

export function init() {
  const slot = $("toolSlot");
  if (slot && !$("mepTools")) {
    slot.insertAdjacentHTML("beforeend", toolBarHTML());
    $("tbWire").onclick = () => toggleTool("wire");
    $("tbDuct").onclick = () => toggleTool("duct");
  }
  if (!$("mepBar")) {
    const bar = document.createElement("div");
    bar.id = "mepBar";
    bar.hidden = true;
    $("stage").appendChild(bar);
  }
  onChange(why => {
    if (why === "items") normalize();
    if (why === "tool") {
      applyPreset(S.tool);
      renderToolOpts();
    }
  });
}
