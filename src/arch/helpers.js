// 裝修模組共用工具：預設材質、牆面裝修、開口規格、室內面積估算
import { S, state } from "../core/store.js";
import { DEFAULTS } from "../shapes/library.js";
import { spec } from "../ext/heights.js";
import { allMats } from "../materials/index.js";

/** 依偏好 id 或材質類別挑一個存在的材質（材質庫尚未有偏好 id 時退回同類第一個） */
export function pickMat(pref, cats) {
  const list = allMats();
  if (pref && list.some(m => m.id === pref)) return pref;
  const c = cats && cats.length ? allMats(cats) : [];
  return (c[0] && c[0].id) || pref;
}
/** 物件的主材質：it.mat → 元件定義的偏好材質 */
export function itemMat(it, key = "mat") {
  if (it[key]) return it[key];
  const def = DEFAULTS[it.type] || {};
  const pref = def[key + "Pref"];
  return pref ? pickMat(pref[0], pref[1]) : spec().wallMat;
}

/** 牆面某一面的裝修材質（face: 1 | -1，定義見 docs/ARCHITECTURE-3D.md） */
export function wallFaceMat(i, face) {
  const sp = spec();
  return (sp.wallFin && sp.wallFin[`${i}:${face}`]) || sp.wallMat;
}
/** 牆的單位法向量（面 1） */
export function wallNormal(w) {
  const dx = w[2] - w[0],
    dy = w[3] - w[1],
    l = Math.hypot(dx, dy) || 1;
  return [-dy / l, dx / l];
}

const WIN_STYLES = ["slide2", "slide3", "casement", "fixed", "awning", "bay"];
const LEAF_STYLES = ["flat", "panel", "glass", "groove", "louver"];
export { LEAF_STYLES, WIN_STYLES };
/** 開口規格：合併 opts 與方案預設（窗台、窗頂、門高） */
export function openingSpec(op) {
  const sp = spec(),
    o = (op && op[3]) || {},
    k = op && op[2];
  if (k === "win")
    return {
      kind: "win",
      sill: o.sill ?? sp.winSill,
      head: o.head ?? sp.winHead,
      style: WIN_STYLES.includes(o.style) ? o.style : "slide2",
      glass: o.glass || "clear",
      frameMat: o.frameMat || null,
      side: o.side === -1 ? -1 : 1,
    };
  if (k === "door")
    return {
      kind: "door",
      sill: 0,
      head: o.head ?? sp.doorH,
      hinge: o.hinge === "b" ? "b" : "a",
      side: o.side === -1 ? -1 : 1,
      leafStyle: LEAF_STYLES.includes(o.leafStyle) ? o.leafStyle : "flat",
      leafMat: o.leafMat || null,
      frameMat: o.frameMat || null,
    };
  return { kind: "open", sill: 0, head: o.head ?? sp.doorH };
}

/** 牆面座標的外框（所有牆端點的範圍） */
export function wallBBox() {
  const ws = (S.BASE && S.BASE.walls) || [];
  if (!ws.length) return null;
  const xs = ws.flatMap(w => [w[0], w[2]]),
    ys = ws.flatMap(w => [w[1], w[3]]);
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}
/** 室內面積概估（m²）：牆外框 − 不在範圍區 */
export function interiorArea() {
  const b = wallBBox();
  if (!b) return 0;
  let a = (b.x2 - b.x1) * (b.y2 - b.y1);
  for (const o of (S.BASE && S.BASE.outOfScope) || []) a -= Math.abs((o.r[2] - o.r[0]) * (o.r[3] - o.r[1]));
  return Math.max(0, a) / 1e4;
}
/** 牆面這一面是否朝向室內（法向量往外 20 cm 的點仍在牆外框內） */
export function faceInside(w, face) {
  const b = wallBBox();
  if (!b) return true;
  const [nx, ny] = wallNormal(w),
    off = w[4] / 2 + 20,
    mx = (w[0] + w[2]) / 2 + nx * face * off,
    my = (w[1] + w[3]) / 2 + ny * face * off;
  return mx > b.x1 && mx < b.x2 && my > b.y1 && my < b.y2;
}
/** 這一面最近的房間名稱（找不到回傳空字串） */
export function faceRoom(w, face) {
  const rooms = (S.BASE && S.BASE.rooms) || [];
  if (!rooms.length) return "";
  const [nx, ny] = wallNormal(w),
    off = w[4] / 2 + 60,
    mx = (w[0] + w[2]) / 2 + nx * face * off,
    my = (w[1] + w[3]) / 2 + ny * face * off;
  let best = null,
    bd = Infinity;
  for (const r of rooms) {
    const d = Math.hypot(r.x - mx, r.y - my);
    // 房間標籤要在這一面的同一側
    if ((r.x - (w[0] + w[2]) / 2) * nx * face + (r.y - (w[1] + w[3]) / 2) * ny * face <= 0) continue;
    if (d < bd) {
      bd = d;
      best = r;
    }
  }
  return best ? best.n : "";
}
/** 目前方案中某個圖層類型的物件 */
export function itemsOf(types) {
  return state.items.filter(i => types.includes(i.type));
}
/** 位在 (x, y) 的地坪區域（最上層者優先），沒有則 null */
export function floorZonesAt(x, y) {
  return state.items
    .filter(i => FLOOR_TYPES.includes(i.type) && x >= i.x && x <= i.x + i.w && y >= i.y && y <= i.y + i.d)
    .sort((a, b) => (b.z || 0) - (a.z || 0));
}
export const FLOOR_TYPES = ["floorZone", "floorRaised", "threshold"];
export const CEIL_TYPES = ["ceilFlat", "ceilDrop", "ceilCove", "ceilBeam", "curtainBox", "ceilGrille"];
export const WALLFIN_TYPES = ["wallPanel", "wallStone", "wallpaper", "wainscot", "mirrorWall"];
export const CURTAIN_TYPES = [
  "curtainDouble",
  "curtainSheer",
  "curtainBlackout",
  "curtainRoman",
  "curtainRoller",
  "blindsVenetian",
];
export const DOOR_TYPES = [
  "swingDoor",
  "doubleDoor",
  "slideDoor",
  "pocketDoor",
  "foldDoor",
  "slideDoorArc",
  "curveSlide",
];
