// 材質模組：內建材質庫、程序化紋理、3D／SVG 材質、材質挑選器與自訂材質
// API 契約見 docs/ARCHITECTURE-3D.md 的「材質」一節
import { t } from "../core/i18n.js";
import { S } from "../core/store.js";
import { esc } from "../core/dom.js";
import { registerMenu } from "../ext/registry.js";
import { BUILTIN, CATS, catName } from "./library.js";
import { paintTexture } from "./textures.js";
import { openPicker } from "./picker.js";

export { CATS, catName };
const FALLBACK = {
  name: "?",
  cat: "paint",
  color: "#cccccc",
  pattern: "plain",
  size: 100,
  rough: 0.8,
  metal: 0,
  opacity: 1,
};

/** 自訂材質（專案共用，存在 S.PROJ.materials） */
export function customMats() {
  return (S.PROJ && S.PROJ.materials) || [];
}
/** 全部材質（內建＋自訂），可依分類過濾 */
export function allMats(cats) {
  const list = [...BUILTIN, ...customMats()];
  return cats && cats.length ? list.filter(m => cats.includes(m.cat)) : list;
}
/** 取得材質；找不到時回傳灰色預設（id 保留，方便顯示） */
export function getMat(id) {
  return BUILTIN.find(m => m.id === id) || customMats().find(m => m.id === id) || { ...FALLBACK, id: id || "?" };
}
/** 材質內容的指紋：自訂材質修改後，快取會自動更新 */
const keyOf = m =>
  `${m.id}|${m.color}|${m.pattern}|${m.size}|${m.rough}|${m.metal}|${m.opacity}|${m.img ? m.img.length + m.img.slice(-24) : ""}`;

// ---- 紋理快取 ----
const texCache = new Map(); // key → canvas
const imgCache = new Map(); // dataURL → HTMLImageElement
function loadImg(src, onload) {
  let im = imgCache.get(src);
  if (!im) {
    im = new Image();
    im.src = src;
    imgCache.set(src, im);
  }
  if (onload) {
    if (im.complete && im.naturalWidth) onload(im);
    else im.addEventListener("load", () => onload(im), { once: true });
  }
  return im;
}
/** 材質紋理畫布（預設 512px，代表 size cm）；自訂圖片會畫進畫布（尚未載入時先用底色） */
export function matTexCanvas(id, px = 512) {
  const m = getMat(id),
    key = keyOf(m) + "@" + px;
  if (texCache.has(key)) return texCache.get(key);
  let c;
  if (m.img) {
    c = document.createElement("canvas");
    c.width = c.height = px;
    const ctx = c.getContext("2d");
    ctx.fillStyle = m.color || "#ccc";
    ctx.fillRect(0, 0, px, px);
    loadImg(m.img, im => ctx.drawImage(im, 0, 0, px, px));
  } else c = paintTexture(m, px);
  texCache.set(key, c);
  return c;
}

const swatchCache = new Map();
/** 色票圖（data URL，小尺寸） */
export function matSwatchURL(id, px = 96) {
  const m = getMat(id),
    key = keyOf(m) + "@" + px;
  if (m.img) return m.img; // 自訂圖片直接當色票
  if (!swatchCache.has(key)) swatchCache.set(key, paintTexture(m, px).toDataURL("image/png"));
  return swatchCache.get(key);
}

// ---- three.js 材質 ----
const threeCache = new Map();
/**
 * 取得 MeshStandardMaterial（快取）。幾何 UV 以 cm 為單位，紋理每 size cm 重複一次。
 * 回傳的材質會共用，請勿直接修改；要改顏色請 clone()。
 */
export function threeMaterial(THREE, id) {
  const m = getMat(id),
    key = keyOf(m);
  if (threeCache.has(key)) return threeCache.get(key);
  const opacity = m.opacity ?? 1,
    glass = m.cat === "glass" || opacity < 1;
  const mat = new THREE.MeshStandardMaterial({
    roughness: m.rough ?? 0.7,
    metalness: m.metal ?? 0,
    transparent: opacity < 1,
    opacity,
    side: glass ? THREE.DoubleSide : THREE.FrontSide,
    depthWrite: opacity >= 0.95,
  });
  if (m.pattern === "plain" && !m.img) mat.color.setStyle(m.color, THREE.SRGBColorSpace);
  else {
    const tex = new THREE.CanvasTexture(matTexCanvas(id));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1 / (m.size || 100), 1 / (m.size || 100));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    if (m.img) loadImg(m.img, () => (tex.needsUpdate = true));
    mat.map = tex;
  }
  mat.name = m.name;
  mat.userData.matId = m.id;
  threeCache.set(key, mat);
  return mat;
}

// ---- SVG 填色 ----
const SVGNS = "http://www.w3.org/2000/svg";
const svgImgCache = new Map();
function svgImageURL(id) {
  const m = getMat(id),
    key = keyOf(m);
  if (m.img) return m.img;
  if (!svgImgCache.has(key)) {
    const c = matTexCanvas(id, 256),
      opaque = (m.opacity ?? 1) >= 1;
    svgImgCache.set(key, c.toDataURL(opaque ? "image/jpeg" : "image/png", 0.86));
  }
  return svgImgCache.get(key);
}
/**
 * 在 svgRoot 的 <defs> 建立（或重用）材質圖樣，回傳可用於 fill 的值（"url(#…)"）。
 * 素色材質直接回傳顏色。svgRoot 可以是 <svg> 或其中任何元素。
 * opts.angle：圖樣旋轉角度（度）；opts.scale：放大倍率
 */
export function svgPattern(svgRoot, id, opts = {}) {
  const m = getMat(id);
  if ((m.pattern === "plain" && !m.img) || !svgRoot) return m.color;
  const root =
    svgRoot.tagName && svgRoot.tagName.toLowerCase() !== "svg" && svgRoot.ownerSVGElement
      ? svgRoot.ownerSVGElement
      : svgRoot;
  let defs = [...root.children].find(c => c.tagName.toLowerCase() === "defs");
  if (!defs) {
    defs = document.createElementNS(SVGNS, "defs");
    root.insertBefore(defs, root.firstChild);
  }
  const angle = +opts.angle || 0,
    scale = +opts.scale || 1,
    size = (m.size || 100) * scale;
  let h = 0;
  for (const ch of keyOf(m)) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const pid = `mat-${String(m.id).replace(/[^\w-]/g, "_")}-${Math.round(angle)}-${Math.round(scale * 100)}-${(h >>> 0).toString(36)}`;
  if (![...defs.children].some(c => c.id === pid)) {
    const p = document.createElementNS(SVGNS, "pattern");
    p.setAttribute("id", pid);
    p.setAttribute("patternUnits", "userSpaceOnUse");
    p.setAttribute("width", size);
    p.setAttribute("height", size);
    if (angle) p.setAttribute("patternTransform", `rotate(${angle})`);
    const im = document.createElementNS(SVGNS, "image");
    im.setAttribute("href", svgImageURL(id));
    im.setAttribute("width", size);
    im.setAttribute("height", size);
    im.setAttribute("preserveAspectRatio", "none");
    if ((m.opacity ?? 1) < 1) im.setAttribute("opacity", Math.max(0.35, m.opacity));
    p.appendChild(im);
    defs.appendChild(p);
  }
  return `url(#${pid})`;
}

// ---- 挑選器與屬性欄位 ----
/**
 * 開啟材質挑選器：回傳選到的材質 id，取消回傳 null。
 * opts：{ value, cats: [分類], title, browse }；browse:true 為瀏覽／管理模式（回傳 null）
 */
export function openMatPicker(opts = {}) {
  return openPicker(opts);
}
/** 屬性面板裡的材質欄位（按鈕帶 data-matfield 與目前的 data-matid） */
export function matFieldHTML(key, id, label) {
  const m = getMat(id);
  return `<div class="row matrow"><span>${esc(label)}</span><button type="button" class="matfield" data-matfield="${esc(key)}" data-matid="${esc(m.id)}" title="${esc(m.name)}${m.code ? " ・" + esc(m.code) : ""}"><img alt="" src="${matSwatchURL(m.id, 48)}"><span>${esc(m.name)}</span></button></div>`;
}
/** 綁定材質欄位：點擊開啟挑選器，選好不同材質後呼叫 onPick(id) */
export function bindMatField(root, key, cats, onPick) {
  const b = (root || document).querySelector(`[data-matfield="${CSS.escape(key)}"]`);
  if (!b) return;
  b.onclick = async () => {
    const id = await openMatPicker({ value: b.dataset.matid, cats, title: b.previousElementSibling?.textContent });
    if (id && id !== b.dataset.matid) onPick(id);
  };
}

export function register() {}
export function init() {
  registerMenu("design", () => [{ t: t("材質庫…"), f: () => openMatPicker({ browse: true }) }]);
  // 測試與其他模組除錯用
  window.__materials = { getMat, allMats, customMats, threeMaterial, svgPattern, matSwatchURL, openMatPicker, CATS };
}
