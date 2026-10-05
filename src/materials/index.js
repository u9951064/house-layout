// 材質模組（暫行版：API 已定，完整材質庫與挑選器由材質模組實作）
import { S } from "../core/store.js";

const BUILTIN = [
  {
    id: "floor-oak-natural",
    name: "超耐磨木地板・自然橡木",
    cat: "floor",
    color: "#c8a678",
    pattern: "wood",
    size: 120,
  },
  { id: "paint-white", name: "乳膠漆・白", cat: "paint", color: "#f4f2ee", pattern: "plain", size: 100 },
  { id: "ceil-white", name: "矽酸鈣板・白漆", cat: "ceiling", color: "#fafafa", pattern: "plain", size: 100 },
  { id: "wood-white", name: "白色木作", cat: "wood", color: "#f1efe9", pattern: "plain", size: 100 },
];
const FALLBACK = {
  id: "?",
  name: "?",
  cat: "paint",
  color: "#cccccc",
  pattern: "plain",
  size: 100,
  rough: 0.8,
  metal: 0,
};

export function allMats(cats) {
  const list = [...BUILTIN, ...((S.PROJ && S.PROJ.materials) || [])];
  return cats ? list.filter(m => cats.includes(m.cat)) : list;
}
export function getMat(id) {
  return allMats().find(m => m.id === id) || { ...FALLBACK, id };
}
export function matSwatchURL(id) {
  const m = getMat(id);
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${m.color}"/></svg>`)}`;
}
const cache = new Map();
export function threeMaterial(THREE, id) {
  if (!cache.has(id)) {
    const m = getMat(id);
    cache.set(
      id,
      new THREE.MeshStandardMaterial({
        color: m.color,
        roughness: m.rough ?? 0.8,
        metalness: m.metal ?? 0,
        transparent: (m.opacity ?? 1) < 1,
        opacity: m.opacity ?? 1,
      }),
    );
  }
  return cache.get(id);
}
export function svgPattern(svgRoot, id) {
  return getMat(id).color;
}
export async function openMatPicker({ value, cats } = {}) {
  const list = allMats(cats);
  const i = list.findIndex(m => m.id === value);
  return list[(i + 1) % list.length]?.id ?? null;
}
export function matFieldHTML(key, id, label) {
  const m = getMat(id);
  return `<div class="row"><span>${label}</span><button type="button" data-matfield="${key}" title="${m.name}"><span style="display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;background:${m.color};border:1px solid #0002"></span> ${m.name}</button></div>`;
}
export function bindMatField(root, key, cats, onPick) {
  const b = root.querySelector(`[data-matfield="${key}"]`);
  if (b)
    b.onclick = async () => {
      const id = await openMatPicker({ cats });
      if (id) onPick(id);
    };
}
export function register() {}
export function init() {}
