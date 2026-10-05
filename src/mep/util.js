// 水電空調共用工具：折線座標轉換、長度、迴路顏色
import { state } from "../core/store.js";
import { DEFAULTS } from "../shapes/library.js";
import { itemElev } from "../ext/heights.js";
import { DUCT_TYPES, PARAM_KEYS, POLY_TYPES, isCeilDev } from "./catalog.js";

/** 物件參數（物件沒有就用定義的預設值） */
export const val = (it, k) => it[k] ?? (DEFAULTS[it.type] || {})[k];

/** 折線預設點（從元件庫直接加入時）：一條沿寬度的直線 */
export const defaultPts = it => [
  [0, it.d / 2],
  [it.w, it.d / 2],
];
export const ptsOf = it => (Array.isArray(it.pts) && it.pts.length >= 2 ? it.pts : defaultPts(it));

/** 物件局部座標 → 世界座標（考慮旋轉與鏡像） */
export function toWorldPt(it, [px, py]) {
  const lx = it.flip ? it.w - px : px;
  const a = ((it.rot || 0) * Math.PI) / 180,
    cx = it.w / 2,
    cy = it.d / 2,
    dx = lx - cx,
    dy = py - cy;
  return [it.x + cx + dx * Math.cos(a) - dy * Math.sin(a), it.y + cy + dx * Math.sin(a) + dy * Math.cos(a)];
}
export function toLocalPt(it, [wx, wy]) {
  const a = ((it.rot || 0) * Math.PI) / 180,
    cx = it.w / 2,
    cy = it.d / 2,
    dx = wx - it.x - cx,
    dy = wy - it.y - cy;
  const lx = cx + dx * Math.cos(a) + dy * Math.sin(a),
    ly = cy - dx * Math.sin(a) + dy * Math.cos(a);
  return [it.flip ? it.w - lx : lx, ly];
}
export const worldPts = it => ptsOf(it).map(p => toWorldPt(it, p));

/** 折線正規化：以世界座標重算外框，rot/flip 歸零，pts 改為相對左上角 */
export function fitPts(it, world = worldPts(it)) {
  const xs = world.map(p => p[0]),
    ys = world.map(p => p[1]);
  const x1 = Math.min(...xs),
    y1 = Math.min(...ys);
  it.x = Math.round(x1 * 10) / 10;
  it.y = Math.round(y1 * 10) / 10;
  it.w = Math.max(Math.max(...xs) - x1, 1);
  it.d = Math.max(Math.max(...ys) - y1, 1);
  it.rot = 0;
  it.flip = false;
  it.pts = world.map(([x, y]) => [Math.round((x - it.x) * 10) / 10, Math.round((y - it.y) * 10) / 10]);
  return it;
}
export function polyLen(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}
export const isPoly = it => POLY_TYPES.has(it.type);
export const isDuct = it => DUCT_TYPES.includes(it.type);
/** 物件中心（世界座標） */
export const centerOf = it => toWorldPt(it, [it.w / 2, it.d / 2]);

/** 迴路顏色（同一迴路同色） */
const COLORS = ["#d1242f", "#1f6feb", "#1a7f37", "#9a6700", "#8250df", "#bf3989", "#0a7ea4", "#cf6a00"];
export function circuitColor(c) {
  if (!c) return "#6b7280";
  let h = 0;
  for (const ch of String(c)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}
export const DUCT_COLOR = {
  ductSupply: "#2563eb",
  ductReturn: "#16a34a",
  ductFresh: "#0891b2",
  ductExhaust: "#ea580c",
  acDuct: "#7c3aed",
};
export const DUCT_CODE = { ductSupply: "SA", ductReturn: "RA", ductFresh: "OA", ductExhaust: "EA", acDuct: "AC" };

/** 目前方案用到的迴路編號 */
export function circuits() {
  return [...new Set(state.items.map(i => i.circuit).filter(Boolean))].sort();
}
/** 設備與天花之間的垂直配線長度（cm） */
export function dropLen(it, ceilH) {
  if (isCeilDev(it.type)) return 0;
  return Math.max(0, ceilH - itemElev(it));
}
/** 從定義補齊參數（新加入的物件） */
export function fillParams(it) {
  const def = DEFAULTS[it.type] || {};
  for (const k of PARAM_KEYS) if (it[k] == null && def[k] != null) it[k] = def[k];
}
