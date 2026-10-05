// 內建材質庫（台灣常見的室內裝修材料）
// size：紋理一格代表的實際 cm；tw/th：磁磚、磚的單片尺寸；pw：木地板單片寬；vein：石紋顏色；grout：填縫顏色
import { t } from "../core/i18n.js";

/** 材質分類（順序即挑選器分頁順序） */
export const CATS = [
  ["floor", t("地板")],
  ["tile", t("磁磚")],
  ["stone", t("石材")],
  ["wood", t("木皮・木作")],
  ["laminate", t("系統板・美耐板・烤漆")],
  ["paint", t("塗料")],
  ["wallpaper", t("壁紙")],
  ["brick", t("磚・文化石")],
  ["ceiling", t("天花")],
  ["countertop", t("檯面")],
  ["metal", t("金屬")],
  ["glass", t("玻璃・鏡面")],
  ["fabric", t("布料・皮革")],
];
export const catName = id => (CATS.find(c => c[0] === id) || [id, id])[1];

/** 紋理類型 */
export const PATTERNS = [
  ["plain", t("素色")],
  ["wood", t("木紋")],
  ["plank", t("木地板（錯縫）")],
  ["herringbone", t("人字拼")],
  ["chevron", t("魚骨拼")],
  ["tile", t("磁磚（填縫）")],
  ["hex", t("六角磚")],
  ["mosaic", t("馬賽克")],
  ["marble", t("大理石紋")],
  ["concrete", t("水泥・礦物")],
  ["terrazzo", t("磨石子")],
  ["fabric", t("布紋")],
  ["brick", t("磚牆（丁順）")],
  ["stone", t("文化石")],
  ["slat", t("格柵")],
  ["brushed", t("髮絲紋")],
  ["reeded", t("長虹紋")],
];

const M = (id, name, cat, color, pattern, size, o = {}) => ({
  id,
  name,
  cat,
  color,
  pattern,
  size,
  rough: 0.7,
  metal: 0,
  opacity: 1,
  ...o,
});
const plank = (pw, o = {}) => ({ pw, rough: 0.55, code: `${pw}×120 cm`, ...o });

export const BUILTIN = [
  // 地板
  M("floor-oak-natural", t("超耐磨木地板・自然橡木"), "floor", "#c8a678", "plank", 120, plank(19)),
  M("floor-oak-light", t("超耐磨木地板・北歐淺橡"), "floor", "#dcc5a1", "plank", 120, plank(19)),
  M("floor-oak-smoke", t("超耐磨木地板・煙燻橡木"), "floor", "#8b7058", "plank", 120, plank(19)),
  M("floor-walnut", t("超耐磨木地板・胡桃木"), "floor", "#6b4a32", "plank", 120, plank(19)),
  M("floor-gray-oak", t("超耐磨木地板・灰橡"), "floor", "#a39a8e", "plank", 120, plank(19)),
  M("floor-spc-oak", t("SPC 石塑地板・橡木紋"), "floor", "#bf9e74", "plank", 120, plank(18, { rough: 0.65 })),
  M("floor-spc-stone", t("SPC 石塑地板・石紋"), "floor", "#b9b5ad", "tile", 120, {
    tw: 60,
    th: 30,
    grout: "#a5a199",
    code: "30×60 cm",
  }),
  M("floor-engineered-teak", t("海島型木地板・柚木"), "floor", "#9a6a3f", "plank", 180, {
    pw: 15,
    rough: 0.5,
    code: "15×180 cm",
  }),
  M("floor-solid-rosewood", t("實木地板・紫檀"), "floor", "#7a4330", "plank", 120, plank(12, { rough: 0.45 })),
  M("floor-herringbone", t("人字拼木地板・橡木"), "floor", "#c29b6c", "herringbone", 120, {
    pw: 15,
    rough: 0.5,
    code: "15×60 cm",
  }),
  M("floor-chevron", t("魚骨拼木地板・淺橡"), "floor", "#d0ad7f", "chevron", 120, {
    pw: 15,
    rough: 0.5,
    code: "15×60 cm 45°",
  }),
  M("floor-trowel", t("水泥粉光"), "floor", "#9e9c97", "concrete", 200, { rough: 0.85 }),
  M("floor-pandomo", t("磐多魔・暖灰"), "floor", "#c4beb4", "concrete", 200, { rough: 0.5 }),
  M("floor-terrazzo", t("磨石子・灰白"), "floor", "#d9d6d0", "terrazzo", 60, { rough: 0.35 }),
  // 磁磚
  M("tile-polish-60", t("拋光石英磚 60×60・白"), "tile", "#ecebe7", "tile", 120, {
    tw: 60,
    th: 60,
    rough: 0.15,
    code: "60×60 cm",
  }),
  M("tile-polish-80", t("拋光石英磚 80×80・米白"), "tile", "#e6dfd2", "tile", 160, {
    tw: 80,
    th: 80,
    rough: 0.15,
    code: "80×80 cm",
  }),
  M("tile-polish-60x120", t("拋光石英磚 60×120・淺灰"), "tile", "#d3d2cf", "tile", 120, {
    tw: 60,
    th: 120,
    rough: 0.15,
    code: "60×120 cm",
  }),
  M("tile-matte-60", t("霧面磚 60×60・水泥灰"), "tile", "#a9a7a2", "tile", 120, {
    tw: 60,
    th: 60,
    noise: 1,
    rough: 0.85,
    code: "60×60 cm",
  }),
  M("tile-slate", t("板岩磚 30×60・深灰"), "tile", "#5d5f60", "tile", 120, {
    tw: 60,
    th: 30,
    noise: 1.6,
    grout: "#4a4c4d",
    rough: 0.9,
    code: "30×60 cm",
  }),
  M("tile-wood", t("木紋磚 20×120"), "tile", "#b08d67", "plank", 120, plank(20, { rough: 0.5 })),
  M("tile-subway", t("地鐵磚 7.5×15・白"), "tile", "#f2f2ef", "brick", 30, {
    tw: 15,
    th: 7.5,
    grout: "#d6d6d2",
    rough: 0.2,
    code: "7.5×15 cm",
  }),
  M("tile-hex-white", t("六角磚・白"), "tile", "#f0efeb", "hex", 140, { grout: "#cfcdc7", rough: 0.4, code: "20 cm" }),
  M("tile-hex-terrazzo", t("六角磚・水磨石"), "tile", "#d8d2c8", "hex", 140, {
    grout: "#bdb6aa",
    rough: 0.4,
    code: "20 cm",
  }),
  M("tile-mosaic", t("馬賽克磚・藍白"), "tile", "#9fb8c8", "mosaic", 30, { rough: 0.3, code: "2.5×2.5 cm" }),
  // 石材
  M("stone-carrara", t("大理石・卡拉拉白"), "stone", "#eceae6", "marble", 120, { vein: "#8c8f94", rough: 0.2 }),
  M("stone-nero", t("大理石・黑金花"), "stone", "#1f1d1b", "marble", 120, { vein: "#c9a55b", rough: 0.2 }),
  M("stone-silver", t("大理石・雪白銀狐"), "stone", "#f3f1ee", "marble", 120, { vein: "#9a9a9a", rough: 0.2 }),
  M("stone-travertine", t("洞石・米黃"), "stone", "#d8c8a8", "concrete", 120, { rough: 0.6, streak: 1 }),
  M("stone-granite", t("花崗石・芝麻灰"), "stone", "#b7b5b2", "terrazzo", 30, { fine: 1, rough: 0.4 }),
  // 木皮・木作
  M("wood-white", t("白色木作"), "wood", "#f1efe9", "plain", 100, { rough: 0.5 }),
  M("wood-oak", t("木皮・白橡"), "wood", "#d2b48c", "wood", 60, { rough: 0.55 }),
  M("wood-walnut", t("木皮・胡桃"), "wood", "#5c3f2a", "wood", 60, { rough: 0.5 }),
  M("wood-teak", t("木皮・柚木"), "wood", "#a06b3c", "wood", 60, { rough: 0.5 }),
  M("wood-ash", t("木皮・梧桐"), "wood", "#cdb898", "wood", 60, { rough: 0.55 }),
  M("wood-slat", t("木格柵・橡木"), "wood", "#b8915f", "slat", 20, { gap: 0.4, rough: 0.6, code: "4/4 cm" }),
  M("skirt-white", t("踢腳板・白"), "wood", "#f4f4f2", "plain", 100, { rough: 0.4 }),
  M("skirt-oak", t("踢腳板・木紋"), "wood", "#c29b6c", "wood", 60, { rough: 0.5 }),
  // 系統板・美耐板・烤漆
  M("lam-white", t("系統板・白"), "laminate", "#f3f3f0", "plain", 100, { rough: 0.45, code: "18 mm" }),
  M("lam-light-wood", t("系統板・淺木紋"), "laminate", "#d6bf9b", "wood", 60, { rough: 0.5, code: "18 mm" }),
  M("lam-dark-wood", t("系統板・深木紋"), "laminate", "#6e4f39", "wood", 60, { rough: 0.5, code: "18 mm" }),
  M("lam-gray", t("系統板・水泥灰"), "laminate", "#9c9a96", "concrete", 100, { rough: 0.6, code: "18 mm" }),
  M("lam-hpl-white", t("美耐板・純白"), "laminate", "#f6f6f4", "plain", 100, { rough: 0.4, code: "HPL" }),
  M("lam-hpl-black", t("美耐板・霧黑"), "laminate", "#2a2a2a", "plain", 100, { rough: 0.6, code: "HPL" }),
  M("lacquer-white", t("烤漆・亮白"), "laminate", "#f7f7f5", "plain", 100, { rough: 0.12 }),
  M("lacquer-black", t("烤漆・霧黑"), "laminate", "#222222", "plain", 100, { rough: 0.5 }),
  M("lacquer-green", t("烤漆・墨綠"), "laminate", "#2f4a3e", "plain", 100, { rough: 0.3 }),
  // 塗料
  M("paint-white", t("乳膠漆・白"), "paint", "#f4f2ee", "plain", 100, { rough: 0.9 }),
  M("paint-warm-white", t("乳膠漆・暖白"), "paint", "#f1ebe0", "plain", 100, { rough: 0.9 }),
  M("paint-light-gray", t("乳膠漆・淺灰"), "paint", "#d9d8d4", "plain", 100, { rough: 0.9 }),
  M("paint-greige", t("乳膠漆・奶茶灰"), "paint", "#cfc4b5", "plain", 100, { rough: 0.9 }),
  M("paint-sage", t("乳膠漆・莫蘭迪鼠尾草綠"), "paint", "#a8b5a0", "plain", 100, { rough: 0.9 }),
  M("paint-dusty-blue", t("乳膠漆・莫蘭迪霧藍"), "paint", "#9fb0bf", "plain", 100, { rough: 0.9 }),
  M("paint-dusty-pink", t("乳膠漆・莫蘭迪乾燥玫瑰"), "paint", "#d4b2aa", "plain", 100, { rough: 0.9 }),
  M("paint-charcoal", t("乳膠漆・深炭灰"), "paint", "#3e4144", "plain", 100, { rough: 0.9 }),
  M("paint-navy", t("乳膠漆・深海藍"), "paint", "#2f3e55", "plain", 100, { rough: 0.9 }),
  M("paint-art-mineral", t("藝術塗料・礦物灰"), "paint", "#bdb6ab", "concrete", 150, { rough: 0.8 }),
  M("paint-microcement", t("礦物塗料・微水泥"), "paint", "#b8b2a8", "concrete", 150, { rough: 0.75 }),
  // 壁紙
  M("wp-plain", t("壁紙・素色米白"), "wallpaper", "#ede6da", "fabric", 8, { rough: 0.9, fine: 1 }),
  M("wp-linen", t("壁紙・布紋淺灰"), "wallpaper", "#cfcac2", "fabric", 12, { rough: 0.9 }),
  M("wp-sage", t("壁紙・布紋灰綠"), "wallpaper", "#b3b9a8", "fabric", 12, { rough: 0.9 }),
  // 磚・文化石
  M("brick-culture", t("文化石・白"), "brick", "#e8e4dc", "stone", 60, { rough: 0.95 }),
  M("brick-red", t("清水磚・紅磚"), "brick", "#a4553b", "brick", 60, {
    tw: 23,
    th: 6,
    grout: "#cfc8bd",
    rough: 0.95,
    code: "23×6 cm",
  }),
  M("brick-white", t("清水磚・白磚"), "brick", "#ece8e1", "brick", 60, {
    tw: 23,
    th: 6,
    grout: "#d2cdc4",
    rough: 0.9,
    code: "23×6 cm",
  }),
  // 天花
  M("ceil-white", t("矽酸鈣板・白漆"), "ceiling", "#fafafa", "plain", 100, { rough: 0.95 }),
  M("ceil-wood-panel", t("木作天花・木皮"), "ceiling", "#c9a57c", "wood", 60, { rough: 0.6 }),
  M("ceil-wood-grille", t("木格柵天花"), "ceiling", "#b38b5d", "slat", 20, { gap: 0.5, rough: 0.6 }),
  M("ceil-alu-grille", t("鋁格柵天花"), "ceiling", "#d5d7d9", "slat", 20, { gap: 0.5, rough: 0.4, metal: 0.6 }),
  // 檯面
  M("ct-quartz-white", t("石英石・純白"), "countertop", "#f1f0ec", "terrazzo", 30, { fine: 1, rough: 0.25 }),
  M("ct-quartz-calacatta", t("石英石・卡拉卡塔"), "countertop", "#f2efea", "marble", 120, {
    vein: "#b9a98f",
    rough: 0.2,
  }),
  M("ct-solid-surface", t("人造石・米白"), "countertop", "#ece6da", "plain", 100, { rough: 0.3 }),
  M("ct-steel", t("不鏽鋼檯面"), "countertop", "#c3c6c8", "brushed", 40, { rough: 0.35, metal: 0.9 }),
  M("ct-butcher", t("實木檯面・橡木拼板"), "countertop", "#c49a6c", "plank", 60, { pw: 6, rough: 0.5 }),
  // 金屬
  M("metal-black", t("黑鐵烤漆"), "metal", "#262626", "plain", 100, { rough: 0.5, metal: 0.5 }),
  M("metal-hairline", t("不鏽鋼髮絲紋"), "metal", "#b9bcbf", "brushed", 40, { rough: 0.35, metal: 0.9 }),
  M("metal-titanium", t("鍍鈦金"), "metal", "#c9a96e", "brushed", 40, { rough: 0.25, metal: 0.95 }),
  M("metal-alu", t("鋁框・霧銀"), "metal", "#c4c7ca", "plain", 100, { rough: 0.4, metal: 0.8 }),
  M("metal-alu-black", t("鋁框・消光黑"), "metal", "#333333", "plain", 100, { rough: 0.5, metal: 0.7 }),
  M("skirt-alu", t("踢腳板・鋁"), "metal", "#c4c7ca", "brushed", 40, { rough: 0.4, metal: 0.8 }),
  // 玻璃・鏡面
  M("glass-clear", t("清玻璃"), "glass", "#dcecee", "plain", 100, { rough: 0.05, opacity: 0.22, code: "5 mm" }),
  M("glass-frosted", t("霧面玻璃"), "glass", "#eef2f2", "plain", 100, { rough: 0.6, opacity: 0.6, code: "5 mm" }),
  M("glass-reeded", t("長虹玻璃"), "glass", "#e4eeee", "reeded", 6, { rough: 0.2, opacity: 0.5, code: "5 mm" }),
  M("glass-gray", t("灰玻"), "glass", "#6b7172", "plain", 100, { rough: 0.05, opacity: 0.4, code: "5 mm" }),
  M("glass-bronze", t("茶鏡"), "glass", "#6b5440", "plain", 100, { rough: 0.08, metal: 0.8 }),
  M("glass-mirror", t("明鏡"), "glass", "#dfe3e6", "plain", 100, { rough: 0.03, metal: 1 }),
  // 布料・皮革
  M("fab-linen", t("亞麻布・米"), "fabric", "#d9cfbf", "fabric", 10, { rough: 0.95 }),
  M("fab-blackout", t("遮光布・灰"), "fabric", "#6f7072", "fabric", 10, { rough: 0.95 }),
  M("fab-sheer", t("紗簾・白"), "fabric", "#f5f4f0", "fabric", 6, { rough: 0.95, opacity: 0.55, fine: 1 }),
  M("fab-velvet", t("絨布・墨綠"), "fabric", "#2f4f45", "fabric", 8, { rough: 1, fine: 1 }),
  M("fab-boucle", t("毛圈布・奶油白"), "fabric", "#ece5d8", "fabric", 8, { rough: 1 }),
  M("fab-leather", t("皮革・焦糖"), "fabric", "#9a5b34", "concrete", 40, { rough: 0.5, fine: 1 }),
];
