// 裝修數量估算：地坪、牆面、天花面積，踢腳板長度，窗簾、牆面裝修
import { t } from "../core/i18n.js";
import { S, state } from "../core/store.js";
import { itemElev, itemH, spec } from "../ext/heights.js";
import { getMat } from "../materials/index.js";
import { P } from "./catalog.js";
import {
  CEIL_TYPES,
  CURTAIN_TYPES,
  FLOOR_TYPES,
  WALLFIN_TYPES,
  faceInside,
  interiorArea,
  itemMat,
  openingSpec,
  wallFaceMat,
} from "./helpers.js";
import { DEFAULTS } from "../shapes/library.js";

const r2 = v => Math.round(v * 100) / 100;
const nameOf = it => it.label || (DEFAULTS[it.type] || {}).name || it.type;

/** 依材質加總 → rows */
function byMat(group, map, unit, note) {
  return [...map.entries()].map(([id, qty]) => ({
    group,
    item: getMat(id).name,
    spec: getMat(id).code || "",
    qty: r2(qty),
    unit,
    note,
  }));
}
function add(map, k, v) {
  map.set(k, (map.get(k) || 0) + v);
}

export function archRows() {
  if (!S.BASE) return [];
  const sp = spec(),
    rows = [],
    items = state.items;
  // 地坪
  const floor = new Map();
  let zoneArea = 0;
  for (const it of items.filter(i => FLOOR_TYPES.includes(i.type))) {
    const a = (it.w * it.d) / 1e4;
    if (it.type !== "threshold") zoneArea += a;
    add(floor, itemMat(it), a);
  }
  const rest = Math.max(0, interiorArea() - zoneArea);
  if (rest > 0) add(floor, sp.floorMat, rest);
  rows.push(...byMat(t("地坪"), floor, "m²", t("預設地坪以牆外框扣除不在範圍區概估")));
  const raised = items.filter(i => FLOOR_TYPES.includes(i.type) && itemH(i) >= 5);
  if (raised.length)
    rows.push({
      group: t("地坪"),
      item: t("架高地板"),
      spec: raised.map(i => `H${Math.round(itemH(i))}`).join("、"),
      qty: r2(raised.reduce((s, i) => s + (i.w * i.d) / 1e4, 0)),
      unit: "m²",
      note: "",
    });
  const th = items.filter(i => i.type === "threshold");
  if (th.length) rows.push({ group: t("地坪"), item: t("門檻石"), spec: "", qty: th.length, unit: t("處"), note: "" });

  // 牆面（逐面，扣除開口）＋踢腳板
  const wall = new Map();
  let skirt = 0;
  (S.BASE.walls || []).forEach((w, i) => {
    const len = Math.hypot(w[2] - w[0], w[3] - w[1]);
    let open = 0,
      doors = 0;
    for (const op of w[5] || []) {
      const o = openingSpec(op),
        ow = Math.abs(op[1] - op[0]);
      open += ow * Math.max(0, Math.min(sp.ceilH, o.head) - o.sill);
      if (o.kind !== "win") doors += ow;
    }
    for (const face of [1, -1]) {
      if (!faceInside(w, face)) continue;
      add(wall, wallFaceMat(i, face), Math.max(0, len * sp.ceilH - open) / 1e4);
      skirt += Math.max(0, len - doors);
    }
  });
  rows.push(...byMat(t("牆面"), wall, "m²", t("室內側面積，已扣門窗開口")));
  if (sp.skirtH > 0)
    rows.push({
      group: t("牆面"),
      item: t("踢腳板"),
      spec: `${getMat(sp.skirtMat).name} H${sp.skirtH}`,
      qty: r2(skirt / 100),
      unit: "m",
      note: t("扣除門洞"),
    });
  const fin = new Map();
  for (const it of items.filter(i => WALLFIN_TYPES.includes(i.type))) add(fin, itemMat(it), (it.w * itemH(it)) / 1e4);
  rows.push(...byMat(t("牆面裝修"), fin, "m²", ""));

  // 天花
  const ceil = new Map();
  let zoneC = 0,
    cove = 0;
  for (const it of items.filter(i => CEIL_TYPES.includes(i.type))) {
    const a = (it.w * it.d) / 1e4,
      label = `${(DEFAULTS[it.type] || {}).name}・${getMat(itemMat(it)).name}`;
    if (["ceilFlat", "ceilDrop", "ceilCove", "ceilGrille"].includes(it.type)) zoneC += a;
    add(ceil, label, a);
    if (it.type === "ceilCove")
      cove += (2 * (it.w + it.d) - 8 * Math.min(P(it, "cove") || 20, it.w / 3, it.d / 3)) / 100;
  }
  const restC = Math.max(0, interiorArea() - zoneC);
  if (restC > 0) add(ceil, `${t("平釘天花")}・${getMat(sp.ceilMat).name}`, restC);
  for (const [k, q] of ceil) rows.push({ group: t("天花"), item: k, spec: "", qty: r2(q), unit: "m²", note: "" });
  if (cove > 0) rows.push({ group: t("天花"), item: t("間接照明燈槽"), spec: "", qty: r2(cove), unit: "m", note: "" });

  // 窗簾
  for (const it of items.filter(i => CURTAIN_TYPES.includes(i.type)))
    rows.push({
      group: t("窗簾"),
      item: nameOf(it),
      spec: `${getMat(itemMat(it)).name}${it.type === "curtainDouble" ? " ＋ " + getMat(itemMat(it, "mat2")).name : ""}`,
      qty: 1,
      unit: t("組"),
      note: `${Math.round(it.w)}×${Math.round(itemH(it))} cm（${t("離地")} ${Math.round(itemElev(it))}）`,
    });
  return rows;
}
