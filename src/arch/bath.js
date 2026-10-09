// 衛浴與陽台設備：馬桶、壁掛面盆、淋浴間、洗衣機、洗衣槽、熱水器、曬衣架（平面圖例、3D、立面）
import { t } from "../core/i18n.js";
import { C, L, PATH, R, el } from "../core/dom.js";
import { itemElev, itemH } from "../ext/heights.js";
import { box } from "./build3d.js";

export const BATH_CATALOG = {
  cat: t("衛浴・陽台"),
  layer: "furniture",
  items: [
    { type: "toilet", name: t("馬桶"), w: 40, d: 70, h: 75 },
    { type: "wallBasin", name: t("壁掛面盆"), w: 60, d: 45, h: 85 },
    { type: "showerBox", name: t("淋浴間（玻璃）"), w: 90, d: 90, h: 200 },
    { type: "washer", name: t("洗衣機"), w: 60, d: 60, h: 90 },
    { type: "laundrySink", name: t("洗衣槽"), w: 60, d: 50, h: 85 },
    { type: "waterHeater", name: t("熱水器"), w: 40, d: 25, h: 60, elev: 140 },
    { type: "dryingRack", name: t("曬衣架（天花）"), w: 150, d: 40, h: 5, elev: 210 },
  ],
};
export const BATH_TYPES = BATH_CATALOG.items.map(i => i.type);

// —— 平面圖例（正面朝 +y）——
export const BATH_DRAW = {
  toilet(g, w, d) {
    R(g, 0, 0, w, d * 0.28, "s", 2);
    el("ellipse", { cx: w / 2, cy: d * 0.62, rx: w * 0.45, ry: d * 0.36, class: "s" }, g);
    el("ellipse", { cx: w / 2, cy: d * 0.64, rx: w * 0.3, ry: d * 0.25, class: "t" }, g);
  },
  wallBasin(g, w, d) {
    R(g, 0, 0, w, d, "s", 4);
    el("ellipse", { cx: w / 2, cy: d * 0.55, rx: w * 0.36, ry: d * 0.32, class: "t" }, g);
    C(g, w / 2, d * 0.18, 1.6, "t");
  },
  showerBox(g, w, d) {
    R(g, 0, 0, w, d, "g");
    L(g, 0, 0, w, d, "t");
    L(g, w, 0, 0, d, "t");
    C(g, w / 2, d / 2, 3, "t");
    // 玻璃門（正面）
    el("rect", { x: 0, y: d - 2, width: w, height: 2, fill: "#dbeafe", stroke: "#1e293b", "stroke-width": 0.6 }, g);
  },
  washer(g, w, d) {
    R(g, 0, 0, w, d, "s", 3);
    C(g, w / 2, d * 0.55, Math.min(w, d) * 0.32, "t");
    L(g, 4, d * 0.15, w - 4, d * 0.15, "t");
  },
  laundrySink(g, w, d) {
    R(g, 0, 0, w, d, "s", 2);
    R(g, 5, 8, w - 10, d - 13, "t", 3);
    C(g, w / 2, d * 0.55, 1.8, "t");
  },
  waterHeater(g, w, d) {
    R(g, 0, 0, w, d, "s", 2);
    PATH(g, `M${w * 0.3} ${d * 0.7} L${w * 0.5} ${d * 0.3} L${w * 0.7} ${d * 0.7}`, "t");
  },
  dryingRack(g, w, d) {
    for (const y of [d * 0.25, d * 0.5, d * 0.75]) L(g, 0, y, w, y, "d");
    L(g, 0, 0, 0, d, "t");
    L(g, w, 0, w, d, "t");
  },
};

// —— 3D（局部座標：x∈[0,w]、z∈[0,d]，地面 y=0，自行套用離地）——
const mats = THREE => ({
  porcelain: new THREE.MeshStandardMaterial({ color: "#f7f7f5", roughness: 0.25 }),
  metal: new THREE.MeshStandardMaterial({ color: "#c9ccd0", roughness: 0.3, metalness: 0.8 }),
  glass: new THREE.MeshStandardMaterial({ color: "#d6e6ef", roughness: 0.05, transparent: true, opacity: 0.3 }),
  white: new THREE.MeshStandardMaterial({ color: "#eeeeec", roughness: 0.5 }),
  dark: new THREE.MeshStandardMaterial({ color: "#3a3a3a", roughness: 0.6 }),
});
const cyl = (THREE, g, x, y, z, rx, rz, h, m) => {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, h, 28), m);
  c.scale.set(rx, 1, rz);
  c.position.set(x, y + h / 2, z);
  c.castShadow = true;
  g.add(c);
  return c;
};
export const BATH_BUILD3D = {
  toilet(it, ctx) {
    const { THREE } = ctx,
      g = new THREE.Group(),
      M = mats(THREE),
      w = it.w,
      d = it.d;
    box(THREE, g, w * 0.05, 40, 0, w * 0.9, 35, d * 0.25, M.porcelain);
    cyl(THREE, g, w / 2, 0, d * 0.45, w * 0.22, d * 0.15, 30, M.porcelain);
    cyl(THREE, g, w / 2, 30, d * 0.6, w * 0.45, d * 0.36, 12, M.porcelain);
    return g;
  },
  wallBasin(it, ctx) {
    const { THREE } = ctx,
      g = new THREE.Group(),
      M = mats(THREE),
      w = it.w,
      d = it.d,
      top = itemH(it);
    box(THREE, g, 0, top - 15, 0, w, 15, d, M.porcelain);
    box(THREE, g, w / 2 - 1.5, top, 2, 3, 18, 3, M.metal);
    box(
      THREE,
      g,
      0,
      top + 15,
      -1,
      w,
      70,
      1,
      new THREE.MeshStandardMaterial({ color: "#dfe7ee", metalness: 0.9, roughness: 0.05 }),
    );
    return g;
  },
  showerBox(it, ctx) {
    const { THREE } = ctx,
      g = new THREE.Group(),
      M = mats(THREE),
      w = it.w,
      d = it.d,
      h = itemH(it);
    box(THREE, g, 0, 0, 0, w, 3, d, M.white);
    box(THREE, g, 0, 3, d - 1, w, h - 3, 1, M.glass);
    box(THREE, g, w - 1, 3, 0, 1, h - 3, d, M.glass);
    box(THREE, g, 0, h, d - 2, w, 2, 2, M.metal);
    box(THREE, g, w * 0.5, 100, 2, 2, 90, 2, M.metal);
    return g;
  },
  washer(it, ctx) {
    const { THREE } = ctx,
      g = new THREE.Group(),
      M = mats(THREE),
      w = it.w,
      d = it.d,
      h = itemH(it);
    box(THREE, g, 0, 0, 0, w, h, d, M.white);
    cyl(THREE, g, w / 2, h, d * 0.55, w * 0.32, d * 0.32, 0.6, M.dark);
    return g;
  },
  laundrySink(it, ctx) {
    const { THREE } = ctx,
      g = new THREE.Group(),
      M = mats(THREE),
      w = it.w,
      d = it.d,
      h = itemH(it);
    box(THREE, g, 0, 0, 0, w, h - 25, d, M.white);
    box(THREE, g, 0, h - 25, 0, w, 25, d, M.porcelain);
    box(THREE, g, w / 2 - 1.5, h, 2, 3, 20, 3, M.metal);
    return g;
  },
  waterHeater(it, ctx) {
    const { THREE } = ctx,
      g = new THREE.Group(),
      M = mats(THREE);
    box(THREE, g, 0, itemElev(it), 0, it.w, itemH(it), it.d, M.white);
    return g;
  },
  dryingRack(it, ctx) {
    const { THREE } = ctx,
      g = new THREE.Group(),
      M = mats(THREE),
      y = itemElev(it);
    for (const z of [0.25, 0.5, 0.75]) box(THREE, g, 0, y, it.d * z - 1, it.w, 2, 2, M.metal);
    for (const x of [0, it.w - 2]) box(THREE, g, x, y, 0, 2, 30, 2, M.metal);
    return g;
  },
};
