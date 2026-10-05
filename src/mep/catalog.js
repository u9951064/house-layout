// 水電空調元件定義：燈具、開關、插座弱電、空調全熱交換、走線
import { t } from "../core/i18n.js";
import { spec } from "../ext/heights.js";

/** 天花板高度（動態，依方案設計規格） */
const ceilH = () => spec().ceilH;
/** 天花板內（樓板與天花之間）是否放得下設備；放不下就外露在天花下 */
export function plenumElev(h) {
  const s = spec();
  return s.slabH - s.ceilH >= h + 4 ? s.ceilH + 2 : s.ceilH - h - 2;
}
/** 風管中心線預設高度 */
export function ductElev(dia) {
  const s = spec();
  return s.slabH - s.ceilH >= dia + 6 ? s.ceilH + 3 + dia / 2 : s.ceilH - 3 - dia / 2;
}
/** 吸頂設備：elev 會跟著天花高度變（getter） */
function ceil(def, mount = "ceil") {
  Object.defineProperty(def, "elev", {
    enumerable: true,
    configurable: true,
    get: () =>
      mount === "plenum" ? plenumElev(def.h || 0) : mount === "duct" ? ductElev(def.dia || 10) : ceilH() - (def.h || 0),
  });
  def.mount = mount;
  return def;
}

export const LIGHTS = [
  ceil({ type: "downlight", name: t("嵌燈"), w: 12, d: 12, h: 3, dia: 12, watt: 10, cct: 3000 }),
  ceil({ type: "spot", name: t("投射燈"), w: 10, d: 10, h: 8, watt: 7, cct: 3000 }),
  ceil({ type: "ceilingLight", name: t("吸頂燈"), w: 45, d: 45, h: 10, watt: 36, cct: 4000 }),
  ceil({ type: "pendant", name: t("吊燈"), w: 40, d: 40, h: 25, drop: 70, watt: 20, cct: 2700 }),
  ceil({ type: "trackLight", name: t("軌道燈"), w: 150, d: 6, h: 4, watt: 40, cct: 3000, heads: 4 }),
  ceil({ type: "lineLight", name: t("線型燈"), w: 120, d: 5, h: 4, watt: 18, cct: 4000 }),
  ceil({ type: "coveStrip", name: t("間照燈條"), w: 200, d: 4, h: 2, watt: 20, cct: 3000 }),
  { type: "wallLight", name: t("壁燈"), w: 20, d: 12, h: 20, elev: 180, watt: 8, cct: 3000 },
  ceil({ type: "fanLight", name: t("吊扇燈"), w: 120, d: 120, h: 40, watt: 45, cct: 3000 }),
  ceil({ type: "bathFan", name: t("浴室抽風機"), w: 30, d: 30, h: 20, watt: 25 }),
  ceil({ type: "sensorLight", name: t("感應燈"), w: 12, d: 12, h: 4, watt: 8, cct: 4000 }),
  ceil({ type: "smoke", name: t("偵煙器"), w: 12, d: 12, h: 4 }),
];
export const SWITCHES = [
  { type: "sw1", name: t("單切開關"), w: 16, d: 10, h: 12, elev: 120, gang: 1 },
  { type: "sw2", name: t("雙切開關"), w: 16, d: 10, h: 12, elev: 120, gang: 2 },
  { type: "sw3", name: t("三切開關"), w: 16, d: 10, h: 12, elev: 120, gang: 3 },
  { type: "sw4", name: t("四切開關"), w: 16, d: 10, h: 12, elev: 120, gang: 4 },
  { type: "sw3way", name: t("三路開關"), w: 16, d: 10, h: 12, elev: 120, gang: 1 },
  { type: "dimmer", name: t("調光開關"), w: 16, d: 10, h: 12, elev: 120, gang: 1 },
  { type: "smartSw", name: t("智慧開關"), w: 16, d: 10, h: 12, elev: 120, gang: 2 },
];
export const POWER = [
  { type: "outlet2", name: t("雙插座 110V"), w: 22, d: 12, h: 12, elev: 30 },
  { type: "outlet220", name: t("220V 插座"), w: 22, d: 12, h: 12, elev: 30 },
  { type: "outletGFCI", name: t("防水插座"), w: 22, d: 12, h: 12, elev: 110 },
  { type: "outletUSB", name: t("USB 插座"), w: 22, d: 12, h: 12, elev: 30 },
  { type: "outletFloor", name: t("地插"), w: 14, d: 14, h: 2, elev: 0 },
  { type: "outletHigh", name: t("高處插座"), w: 22, d: 12, h: 12, elev: 220 },
  { type: "ACoutlet", name: t("冷氣專用插座"), w: 22, d: 12, h: 12, elev: 220 },
  { type: "dataRJ45", name: t("網路插座"), w: 18, d: 12, h: 12, elev: 30 },
  { type: "tvOut", name: t("電視插座"), w: 18, d: 12, h: 12, elev: 30 },
  { type: "phone", name: t("電話插座"), w: 18, d: 12, h: 12, elev: 30 },
  { type: "panel", name: t("電箱（分電盤）"), w: 45, d: 15, h: 60, elev: 150 },
  { type: "weakBox", name: t("弱電箱"), w: 40, d: 12, h: 50, elev: 30 },
  { type: "doorbell", name: t("門鈴"), w: 12, d: 10, h: 10, elev: 150 },
  { type: "intercom", name: t("對講機"), w: 16, d: 8, h: 22, elev: 145 },
];
export const HVAC = [
  ceil({ type: "ervUnit", name: t("全熱交換機"), w: 90, d: 60, h: 27, cmh: 250 }, "plenum"),
  ceil({ type: "ductSupply", name: t("送風管（SA）"), w: 150, d: 10, dia: 10, tool: "duct:ductSupply" }, "duct"),
  ceil({ type: "ductReturn", name: t("回風管（RA）"), w: 150, d: 10, dia: 10, tool: "duct:ductReturn" }, "duct"),
  ceil({ type: "ductFresh", name: t("新風管（OA）"), w: 150, d: 15, dia: 15, tool: "duct:ductFresh" }, "duct"),
  ceil({ type: "ductExhaust", name: t("排風管（EA）"), w: 150, d: 15, dia: 15, tool: "duct:ductExhaust" }, "duct"),
  ceil({ type: "diffuser", name: t("出風口"), w: 30, d: 30, h: 3, style: "round" }),
  ceil({ type: "grille", name: t("回風口"), w: 40, d: 20, h: 3 }),
  { type: "wallCap", name: t("外牆防風罩"), w: 16, d: 10, h: 16, elev: 280 },
  ceil({ type: "acIndoor", name: t("吊隱式冷氣室內機"), w: 100, d: 50, h: 25, kw: 3.6 }, "plenum"),
  ceil({ type: "acDuct", name: t("冷氣風管"), w: 150, d: 20, dia: 20, tool: "duct:acDuct" }, "duct"),
];
export const WIRES = [
  { type: "wire", name: t("配線（迴路）"), w: 150, d: 10, kind: "light", no3d: true, tool: "wire:wire" },
  { type: "conduit", name: t("配管"), w: 150, d: 10, kind: "power", no3d: true, tool: "wire:conduit" },
];

export const DUCT_TYPES = ["ductSupply", "ductReturn", "ductFresh", "ductExhaust", "acDuct"];
export const POLY_TYPES = new Set([...DUCT_TYPES, "wire", "conduit"]);
export const LIGHT_TYPES = new Set(LIGHTS.map(d => d.type));
export const SWITCH_TYPES = new Set(SWITCHES.map(d => d.type));
export const POWER_TYPES = new Set(POWER.map(d => d.type));
export const HVAC_TYPES = new Set(HVAC.map(d => d.type));
export const ALL_MEP = [...LIGHTS, ...SWITCHES, ...POWER, ...HVAC, ...WIRES];
export const MEP_TYPES = new Set(ALL_MEP.map(d => d.type));
/** 需要從定義複製到物件的參數 */
export const PARAM_KEYS = ["dia", "watt", "cct", "drop", "heads", "gang", "cmh", "style", "kind", "kw"];
/** 裝在天花板（或天花內）的設備 */
export const isCeilDev = type => !!(ALL_MEP.find(d => d.type === type) || {}).mount;

export function catalogs() {
  return [
    { cat: t("燈具"), layer: "light", items: LIGHTS },
    { cat: t("開關"), layer: "light", items: SWITCHES },
    { cat: t("插座・弱電"), layer: "power", items: POWER },
    { cat: t("空調・全熱交換"), layer: "hvac", items: HVAC },
    {
      cat: t("配線・配管"),
      layer: "light",
      items: WIRES.map(d => (d.type === "conduit" ? { ...d, layer: "power" } : d)),
    },
  ];
}
