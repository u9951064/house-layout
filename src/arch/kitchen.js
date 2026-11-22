// 廚房設備：嵌入式水槽、IH 爐、嵌入式洗碗機（平面圖例、3D）
// 水槽與 IH 爐放在檯面上（elev = 檯面高），洗碗機嵌在下櫃開口內。
import { t } from "../core/i18n.js";
import { C, L, R, el } from "../core/dom.js";
import { itemElev, itemH } from "../ext/heights.js";
import { box } from "./build3d.js";

export const KITCHEN_CATALOG = {
  cat: t("廚房設備"),
  layer: "furniture",
  items: [
    { type: "kitchenSink", name: t("嵌入式水槽"), w: 70, d: 45, h: 2, elev: 88 },
    { type: "ihCooktop", name: t("IH 雙口爐"), w: 59, d: 50, h: 1, elev: 88 },
    { type: "dishwasher", name: t("嵌入式洗碗機"), w: 60, d: 55, h: 84 },
  ],
};
export const KITCHEN_TYPES = KITCHEN_CATALOG.items.map(i => i.type);

// —— 平面圖例（正面朝 +y）——
export const KITCHEN_DRAW = {
  kitchenSink(g, w, d) {
    R(g, 0, 0, w, d, "s", 2);
    R(g, 4, d * 0.22, w - 8, d * 0.7, "t", 4);
    C(g, w / 2, d * 0.1, 1.8, "t");
    C(g, w / 2, d * 0.6, 1.5, "t");
  },
  ihCooktop(g, w, d) {
    R(g, 0, 0, w, d, "s", 1);
    const r = Math.min(w / 4, d / 2.6);
    C(g, w * 0.28, d * 0.45, r, "t");
    C(g, w * 0.72, d * 0.45, r, "t");
    L(g, w * 0.3, d * 0.9, w * 0.7, d * 0.9, "t");
  },
  dishwasher(g, w, d) {
    R(g, 0, 0, w, d, "s", 1);
    L(g, 0, d - 4, w, d - 4, "t");
    el("text", { x: w / 2, y: d / 2 + 3, "font-size": 9, "text-anchor": "middle", fill: "#475569" }, g).textContent =
      "DW";
  },
};

// —— 3D（局部座標：x∈[0,w]、z∈[0,d]，地面 y=0，自行套用離地）——
const mats = THREE => ({
  steel: new THREE.MeshStandardMaterial({ color: "#c7cacd", roughness: 0.25, metalness: 0.85 }),
  steelDark: new THREE.MeshStandardMaterial({ color: "#8e9295", roughness: 0.3, metalness: 0.8 }),
  glassBlack: new THREE.MeshStandardMaterial({ color: "#141414", roughness: 0.08, metalness: 0.2 }),
  ring: new THREE.MeshStandardMaterial({ color: "#6b6b6b", roughness: 0.4 }),
  panel: new THREE.MeshStandardMaterial({ color: "#eeeeec", roughness: 0.5 }),
  dark: new THREE.MeshStandardMaterial({ color: "#3a3a3a", roughness: 0.6 }),
});
const cyl = (THREE, g, x, y, z, r, h, m, seg = 28) => {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
  c.position.set(x, y + h / 2, z);
  c.castShadow = true;
  g.add(c);
  return c;
};
export const KITCHEN_BUILD3D = {
  kitchenSink(it, ctx) {
    const { THREE } = ctx,
      g = new THREE.Group(),
      M = mats(THREE),
      w = it.w,
      d = it.d,
      y = itemElev(it),
      depth = 20,
      rim = 3;
    // 槽口（四邊框）與下凹槽體（槽底在檯面下 20 cm）
    box(THREE, g, 0, y, 0, w, 0.6, rim, M.steel);
    box(THREE, g, 0, y, d - rim, w, 0.6, rim, M.steel);
    box(THREE, g, 0, y, 0, rim, 0.6, d, M.steel);
    box(THREE, g, w - rim, y, 0, rim, 0.6, d, M.steel);
    box(THREE, g, rim, y - depth, rim, w - 2 * rim, 0.6, d - 2 * rim, M.steelDark);
    box(THREE, g, rim, y - depth, rim, 0.6, depth, d - 2 * rim, M.steel);
    box(THREE, g, w - rim - 0.6, y - depth, rim, 0.6, depth, d - 2 * rim, M.steel);
    box(THREE, g, rim, y - depth, rim, w - 2 * rim, depth, 0.6, M.steel);
    box(THREE, g, rim, y - depth, d - rim - 0.6, w - 2 * rim, depth, 0.6, M.steel);
    // 鵝頸龍頭（靠背側）
    cyl(THREE, g, w / 2, y, 1.5, 1.6, 32, M.steel);
    box(THREE, g, w / 2 - 1, y + 30, 1.5, 2, 2, 16, M.steel);
    cyl(THREE, g, w / 2, y + 24, 16.5, 1, 6, M.steel);
    return g;
  },
  ihCooktop(it, ctx) {
    const { THREE } = ctx,
      g = new THREE.Group(),
      M = mats(THREE),
      w = it.w,
      d = it.d,
      y = itemElev(it),
      h = Math.max(itemH(it), 0.6);
    box(THREE, g, 0, y, 0, w, h, d, M.glassBlack);
    const r = Math.min(w / 4, d / 2.6);
    for (const x of [w * 0.28, w * 0.72]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.35, 8, 40), M.ring);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, y + h + 0.05, d * 0.45);
      g.add(ring);
    }
    box(THREE, g, w * 0.3, y + h, d * 0.86, w * 0.4, 0.1, 2, M.ring);
    return g;
  },
  dishwasher(it, ctx) {
    const { THREE } = ctx,
      g = new THREE.Group(),
      M = mats(THREE),
      w = it.w,
      d = it.d,
      y = itemElev(it),
      h = itemH(it),
      panel = it.mat ? ctx.mat(it.mat) : M.panel;
    // 機身（略內縮）＋門板（正面 z=d）、上方控制條與把手
    box(THREE, g, 0.5, y, 0, w - 1, h - 2, d - 2, M.steelDark);
    box(THREE, g, 0, y + 10, d - 2, w, h - 12, 2, panel);
    box(THREE, g, 0, y + h - 2, d - 2, w, 2, 2, M.dark);
    box(THREE, g, w * 0.3, y + h - 12, d, w * 0.4, 1.2, 1.5, M.steel);
    return g;
  },
};
