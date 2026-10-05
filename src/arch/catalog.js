// 裝修元件庫：地坪、天花、牆面、窗簾
import { t } from "../core/i18n.js";
import { DEFAULTS } from "../shapes/library.js";
import { spec } from "../ext/heights.js";

/** 物件參數：it[key] → 元件定義的預設值 */
export function P(it, key) {
  return it[key] ?? (DEFAULTS[it.type] || {})[key];
}
// 高度隨方案的天花高度變化的預設值（getter，讀取時才計算）
const ceilAt = drop => ({
  get elev() {
    return spec().ceilH - drop;
  },
});
const toCeil = (elev = 1) => ({
  elev,
  get h() {
    return Math.max(10, spec().ceilH - elev);
  },
});
const def = (o, extra) => Object.defineProperties(o, Object.getOwnPropertyDescriptors(extra || {}));

const FLOOR = ["floor", "tile", "stone", "wood"];
const CEIL = ["ceiling", "paint"];
const FABRIC = ["fabric"];

export const CATALOGS = [
  {
    cat: t("地坪"),
    layer: "floor",
    items: [
      { type: "floorZone", name: t("地坪區域"), w: 300, d: 300, h: 1, elev: 0, matPref: ["floor-oak-natural", FLOOR] },
      {
        type: "floorRaised",
        name: t("架高木地板／和室"),
        w: 240,
        d: 180,
        h: 40,
        elev: 0,
        matPref: ["floor-oak-natural", FLOOR],
      },
      {
        type: "threshold",
        name: t("門檻石"),
        w: 90,
        d: 12,
        h: 1.5,
        elev: 0,
        matPref: ["stone-carrara", ["stone", "tile"]],
      },
    ],
  },
  {
    cat: t("天花"),
    layer: "ceiling",
    items: [
      def({ type: "ceilFlat", name: t("平釘天花"), w: 300, d: 300, h: 2, matPref: ["ceil-white", CEIL] }, ceilAt(0)),
      def(
        { type: "ceilDrop", name: t("降板造型天花"), w: 240, d: 120, h: 2, matPref: ["ceil-white", CEIL] },
        ceilAt(20),
      ),
      def(
        { type: "ceilCove", name: t("間接照明天花"), w: 300, d: 300, h: 2, cove: 20, matPref: ["ceil-white", CEIL] },
        ceilAt(15),
      ),
      def(
        { type: "ceilBeam", name: t("包樑／假樑"), w: 300, d: 40, matPref: ["ceil-white", CEIL] },
        {
          get elev() {
            return spec().ceilH - 40;
          },
          get h() {
            return Math.max(1, spec().slabH - (spec().ceilH - 40));
          },
        },
      ),
      def(
        { type: "curtainBox", name: t("窗簾盒"), w: 200, d: 15, h: 2, matPref: ["ceil-white", CEIL] },
        {
          get elev() {
            return spec().ceilH + 15;
          },
        },
      ),
      def(
        {
          type: "ceilGrille",
          name: t("格柵天花"),
          w: 240,
          d: 120,
          h: 8,
          gap: 10,
          matPref: ["wood-white", ["wood", "metal"]],
        },
        ceilAt(10),
      ),
    ],
  },
  {
    cat: t("牆面裝修"),
    layer: "finish",
    items: [
      {
        type: "wallPanel",
        name: t("造型牆／木作牆板"),
        w: 240,
        d: 3,
        h: 240,
        elev: 0,
        style: "slat",
        matPref: ["wood-oak", ["wood", "laminate"]],
      },
      {
        type: "wallStone",
        name: t("文化石牆面"),
        w: 240,
        d: 3,
        h: 240,
        elev: 0,
        matPref: ["brick-white", ["brick", "stone"]],
      },
      {
        type: "wallpaper",
        name: t("壁紙區段"),
        w: 240,
        d: 1,
        h: 240,
        elev: 0,
        matPref: ["wallpaper-linen", ["wallpaper", "paint"]],
      },
      {
        type: "wainscot",
        name: t("腰板"),
        w: 240,
        d: 2,
        h: 90,
        elev: 0,
        style: "panel",
        matPref: ["wood-white", ["wood", "laminate"]],
      },
      {
        type: "mirrorWall",
        name: t("鏡面牆"),
        w: 120,
        d: 1,
        h: 200,
        elev: 20,
        matPref: ["glass-mirror", ["glass", "metal"]],
      },
    ],
  },
  {
    cat: t("窗簾"),
    layer: "finish",
    items: [
      def(
        {
          type: "curtainDouble",
          name: t("雙層簾（布＋紗）"),
          w: 200,
          d: 15,
          open: 0.3,
          track: "ceiling",
          matPref: ["fabric-linen", FABRIC],
          mat2Pref: ["fabric-sheer", FABRIC],
        },
        toCeil(1),
      ),
      def(
        {
          type: "curtainSheer",
          name: t("紗簾"),
          w: 200,
          d: 10,
          open: 0.2,
          track: "ceiling",
          matPref: ["fabric-sheer", FABRIC],
        },
        toCeil(1),
      ),
      def(
        {
          type: "curtainBlackout",
          name: t("遮光簾"),
          w: 200,
          d: 12,
          open: 0.3,
          track: "ceiling",
          matPref: ["fabric-blackout", FABRIC],
        },
        toCeil(1),
      ),
      {
        type: "curtainRoman",
        name: t("羅馬簾"),
        w: 120,
        d: 8,
        h: 150,
        elev: 80,
        open: 0.4,
        track: "wall",
        matPref: ["fabric-linen", FABRIC],
      },
      {
        type: "curtainRoller",
        name: t("捲簾"),
        w: 120,
        d: 8,
        h: 150,
        elev: 80,
        open: 0.3,
        track: "wall",
        matPref: ["fabric-blackout", FABRIC],
      },
      {
        type: "blindsVenetian",
        name: t("百葉簾"),
        w: 120,
        d: 8,
        h: 150,
        elev: 80,
        open: 0,
        track: "wall",
        matPref: ["wood-white", ["wood", "metal"]],
      },
    ],
  },
];
