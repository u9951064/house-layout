// 立體尺寸：每種元件的預設高度與離地高度（cm），物件可用 it.h / it.elev 覆寫
import { state } from "../core/store.js";
import { DEFAULTS } from "../shapes/library.js";

/** type → [高度, 離地高度] */
export const H3D = {
  bed2: [50, 0],
  bed1: [50, 0],
  bunk: [170, 0],
  crib: [95, 0],
  mattress: [25, 0],
  tatami: [40, 0],
  nightstand: [55, 0],
  wardrobe: [240, 0],
  wardrobeSlide: [240, 0],
  wardrobeL: [240, 0],
  rack: [170, 0],
  mirror: [160, 10],
  vanity: [76, 0],
  vanityArc: [76, 0],
  sofa: [85, 0],
  sofaL: [85, 0],
  sofabed: [85, 0],
  chaise: [80, 0],
  armchair: [80, 0],
  beanbag: [60, 0],
  ottoman: [42, 0],
  coffee: [42, 0],
  side: [50, 0],
  tv: [50, 0],
  tvwall: [72, 100],
  screen: [5, 230],
  rug: [1, 0],
  rugRound: [1, 0],
  plant: [120, 0],
  floorLamp: [160, 0],
  fridge: [180, 0],
  appliance: [210, 0],
  counter: [90, 0],
  island: [90, 0],
  dining: [75, 0],
  rollTable: [75, 0],
  toilet: [75, 0],
  wallBasin: [85, 0],
  showerBox: [200, 0],
  washer: [90, 0],
  laundrySink: [85, 0],
  waterHeater: [60, 140],
  dryingRack: [5, 210],
  diningRound: [75, 0],
  dchair: [85, 0],
  benchSeat: [45, 0],
  stool: [75, 0],
  sideboard: [85, 0],
  trash: [60, 0],
  desk: [75, 0],
  deskLift: [75, 0],
  deskFixed: [75, 0],
  deskL: [75, 0],
  chair: [110, 0],
  bookshelf: [200, 0],
  drawer: [60, 0],
  cabinet: [210, 0],
  lowcab: [85, 0],
  upper: [70, 150],
  display: [180, 0],
  screenCab: [200, 0],
  shoe: [110, 0],
  openShelf: [180, 0],
  bench: [45, 0],
  cabinetArc: [85, 0],
  yogamat: [1, 0],
  treadmill: [140, 0],
  bike: [120, 0],
  dumbbell: [80, 0],
  petbed: [25, 0],
  ac: [30, 220],
  curtain: [250, 0],
  swingDoor: [210, 0],
  doubleDoor: [210, 0],
  slideDoor: [210, 0],
  pocketDoor: [210, 0],
  foldDoor: [210, 0],
  slideDoorArc: [210, 0],
  curveSlide: [210, 0],
  wall: [null, 0],
  wallArc: [null, 0],
  curveWall: [null, 0],
  glassWall: [null, 0],
  curveGlass: [null, 0],
  halfWall: [110, 0],
  column: [null, 0],
  dimension: [0, 0],
  text: [0, 0],
};

/** 每個方案的設計規格（state.spec）預設值 */
export const SPEC_DEFAULTS = {
  slabH: 300, // 樓板到樓板（結構高度）
  ceilH: 270, // 完成面天花板高度（平釘）
  floorMat: "floor-oak-natural",
  wallMat: "paint-white",
  ceilMat: "ceil-white",
  skirtH: 8, // 踢腳板高度，0＝不做
  skirtMat: "wood-white",
  wallFin: {}, // "牆索引:面(1|-1)" → 材質 id
  doorH: 210, // 門預設高度
  winSill: 90, // 窗台預設高度
  winHead: 220, // 窗頂預設高度
};
export function spec() {
  return { ...SPEC_DEFAULTS, ...(state.spec || {}) };
}

/** 物件高度：it.h → def.h → 對照表；null 代表到天花板 */
export function itemH(it) {
  if (it.h != null) return it.h;
  const def = DEFAULTS[it.type] || {};
  if (def.h != null) return def.h;
  const v = (H3D[it.type] || [75, 0])[0];
  return v == null ? spec().ceilH : v;
}
export function itemElev(it) {
  if (it.elev != null) return it.elev;
  const def = DEFAULTS[it.type] || {};
  if (def.elev != null) return def.elev;
  return (H3D[it.type] || [75, 0])[1];
}
