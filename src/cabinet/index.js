// 櫃體模組進入點：參數化櫃體（元件庫、平面圖例、3D、立面、屬性面板）、櫃體工程圖、數量表
import { t } from "../core/i18n.js";
import { registerCatalog } from "../shapes/library.js";
import { EXT, registerMenu, registerSchedule, registerView } from "../ext/registry.js";
import { setView } from "../ext/views.js";
import { getMat } from "../materials/index.js";
import { CAB_CATALOG } from "./catalog.js";
import {
  CAB_TYPES,
  boardSummary,
  cabCutList,
  cabHardware,
  cabLayout,
  cabParts,
  countertopOf,
  ensureCab,
} from "./model.js";
import { drawElev, drawPlan } from "./draw.js";
import { buildCab3D } from "./build3d.js";
import { cabProps } from "./props.js";
import { cabCSV, cabSheet, cabSheetSVG, cabView, cabinets, initView } from "./view.js";

export {
  cabParts,
  cabCutList,
  cabHardware,
  boardSummary,
  cabLayout,
  ensureCab,
  cabSheet,
  cabSheetSVG,
  cabCSV,
  cabinets,
};

export function register() {
  registerCatalog(CAB_CATALOG);
  for (const type of CAB_TYPES) {
    EXT.draw2d[type] = (g, w, d, it) => drawPlan(g, w, d, it);
    EXT.build3d[type] = (it, ctx) => buildCab3D(it, ctx);
    EXT.elev2d[type] = (g, it, ctx) => drawElev(g, it, ctx);
    EXT.props[type] = cabProps;
    EXT.noScopeCheck.add(type);
  }
}

export function init() {
  // 測試用掛勾（e2e 測試在 dist 版也能取用）
  window.__cab = {
    cabParts,
    cabCutList,
    cabHardware,
    boardSummary,
    cabLayout,
    ensureCab,
    cabSheetSVG,
    drawElev,
    buildCab3D,
    three: () => import("three"),
    scheduleRows,
  };
  registerView(cabView);
  initView();
  registerMenu("design", () => [{ t: t("櫃體工程圖…"), f: () => setView("cab") }]);
  registerSchedule({
    id: "cabinet",
    get name() {
      return t("櫃體");
    },
    rows: scheduleRows,
  });
}

/** 數量估算表：櫃體座數、板材面積與板數、封邊、檯面、五金合計 */
export function scheduleRows() {
  const list = cabinets();
  if (!list.length) return [];
  const rows = list.map(it => ({
    group: t("櫃體"),
    item: it.label || it.type,
    spec: `${Math.round(it.w)}×${Math.round(it.d)}×${Math.round(cabLayout(it).h)} cm`,
    qty: 1,
    unit: t("座"),
    note: getMat(ensureCab(it).doorMat).name,
  }));
  const bs = boardSummary(list);
  for (const r of bs.rows)
    rows.push({
      group: t("板材"),
      item: r.matName,
      spec: `T${r.T}`,
      qty: r.area,
      unit: "m²",
      note: t("約 {n} 片 4×8 尺", { n: r.sheets }),
    });
  rows.push({ group: t("板材"), item: t("封邊"), spec: "", qty: bs.edge, unit: "m", note: "" });
  const ct = new Map();
  for (const it of list) {
    const c = countertopOf(it);
    if (!c) continue;
    const k = c.mat + "|" + c.T;
    const m = ct.get(k) || { ...c, area: 0 };
    m.area += (c.L * c.W) / 10000;
    ct.set(k, m);
  }
  for (const c of ct.values())
    rows.push({
      group: t("檯面"),
      item: c.matName,
      spec: `T${c.T}`,
      qty: Math.round(c.area * 100) / 100,
      unit: "m²",
      note: "",
    });
  const hw = new Map();
  for (const it of list)
    for (const r of cabHardware(it)) {
      const k = r.item + "|" + r.spec + "|" + r.unit;
      const m = hw.get(k) || { ...r, qty: 0 };
      m.qty += r.qty;
      hw.set(k, m);
    }
  for (const r of hw.values())
    rows.push({ group: t("五金"), item: r.item, spec: r.spec, qty: r.qty, unit: r.unit, note: r.note });
  return rows;
}
