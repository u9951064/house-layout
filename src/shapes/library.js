// 元件庫定義（分類、預設尺寸）
import { CURVE_TYPES, applyCurve } from "./curve.js";
import { t } from "../core/i18n.js";

export const LIB = [
  {
    cat: t("床與寢具"),
    items: [
      { type: "bed2", name: t("雙人床"), w: 152, d: 188 },
      { type: "bed2", name: t("加大雙人床"), w: 182, d: 188 },
      { type: "bed1", name: t("單人床"), w: 106, d: 188 },
      { type: "bed1", name: t("兒童床"), w: 90, d: 170 },
      { type: "bunk", name: t("上下舖"), w: 100, d: 200 },
      { type: "crib", name: t("嬰兒床"), w: 70, d: 130 },
      { type: "mattress", name: t("床墊／軟床墊"), w: 106, d: 188 },
      { type: "tatami", name: t("架高和室"), w: 180, d: 180 },
      { type: "nightstand", name: t("床頭櫃"), w: 45, d: 40 },
    ],
  },
  {
    cat: t("衣物收納"),
    items: [
      { type: "wardrobe", name: t("衣櫃（開門）"), w: 180, d: 60 },
      { type: "wardrobeSlide", name: t("衣櫃（拉門）"), w: 180, d: 65 },
      { type: "wardrobeL", name: t("L 型轉角衣櫃"), w: 180, d: 180 },
      { type: "rack", name: t("開放式吊衣桿"), w: 120, d: 50 },
      { type: "mirror", name: t("穿衣鏡"), w: 50, d: 6 },
      { type: "vanity", name: t("化妝台"), w: 90, d: 45 },
      { type: "vanityArc", name: t("轉角弧形化妝台"), w: 90, d: 90 },
    ],
  },
  {
    cat: t("客廳"),
    items: [
      { type: "sofa", name: t("雙人沙發"), w: 160, d: 85, seats: 2 },
      { type: "sofa", name: t("三人沙發"), w: 210, d: 90, seats: 3 },
      { type: "sofaL", name: t("L 型沙發"), w: 240, d: 160 },
      { type: "sofabed", name: t("沙發床"), w: 190, d: 90 },
      { type: "chaise", name: t("躺椅"), w: 70, d: 150 },
      { type: "armchair", name: t("單椅"), w: 75, d: 75 },
      { type: "beanbag", name: t("懶骨頭"), w: 80, d: 80 },
      { type: "ottoman", name: t("腳凳／坐墩"), w: 45, d: 45 },
      { type: "coffee", name: t("茶几"), w: 100, d: 50 },
      { type: "side", name: t("邊几"), w: 45, d: 45 },
      { type: "tv", name: t("電視櫃"), w: 150, d: 40 },
      { type: "tvwall", name: t("壁掛電視"), w: 125, d: 8 },
      { type: "screen", name: t("投影布幕（上方）"), w: 220, d: 8 },
      { type: "rug", name: t("地毯"), w: 200, d: 140 },
      { type: "rugRound", name: t("圓地毯"), w: 160, d: 160 },
      { type: "plant", name: t("植栽"), w: 45, d: 45 },
      { type: "floorLamp", name: t("落地燈"), w: 40, d: 40 },
    ],
  },
  {
    cat: t("餐廚"),
    items: [
      { type: "fridge", name: t("冰箱"), w: 70, d: 70 },
      { type: "appliance", name: t("電器櫃"), w: 60, d: 60 },
      { type: "counter", name: t("流理台"), w: 210, d: 60 },
      { type: "island", name: t("中島／吧檯"), w: 140, d: 70 },
      { type: "dining", name: t("方餐桌"), w: 120, d: 75, chairs: 4 },
      { type: "diningRound", name: t("圓餐桌"), w: 90, d: 90, chairs: 4 },
      { type: "dchair", name: t("餐椅"), w: 45, d: 48 },
      { type: "benchSeat", name: t("長凳"), w: 110, d: 35 },
      { type: "stool", name: t("吧檯椅"), w: 38, d: 38 },
      { type: "sideboard", name: t("餐邊櫃"), w: 120, d: 45 },
      { type: "trash", name: t("垃圾桶"), w: 35, d: 30 },
    ],
  },
  {
    cat: t("書房・工作"),
    items: [
      { type: "desk", name: t("活動書桌"), w: 120, d: 60 },
      { type: "deskLift", name: t("升降桌"), w: 120, d: 60 },
      { type: "deskFixed", name: t("固定書桌"), w: 160, d: 60 },
      { type: "deskL", name: t("L 型書桌"), w: 160, d: 140 },
      { type: "chair", name: t("辦公椅"), w: 55, d: 55 },
      { type: "bookshelf", name: t("書櫃"), w: 120, d: 35 },
      { type: "drawer", name: t("活動抽屜櫃"), w: 40, d: 50 },
    ],
  },
  {
    cat: t("櫃體與收納"),
    items: [
      { type: "cabinet", name: t("儲物櫃（高櫃）"), w: 90, d: 45 },
      { type: "lowcab", name: t("矮櫃"), w: 120, d: 40 },
      { type: "upper", name: t("吊櫃（上方）"), w: 120, d: 35 },
      { type: "display", name: t("展示櫃（玻璃門）"), w: 90, d: 40 },
      { type: "screenCab", name: t("屏風櫃／雙面櫃"), w: 135, d: 30 },
      { type: "shoe", name: t("鞋櫃"), w: 120, d: 35 },
      { type: "openShelf", name: t("開放層架"), w: 90, d: 35 },
      { type: "bench", name: t("臥榻／卡座"), w: 120, d: 45 },
      { type: "cabinetArc", name: t("轉角弧形櫃"), w: 60, d: 60 },
    ],
  },
  {
    cat: t("運動・生活"),
    items: [
      { type: "yogamat", name: t("瑜伽墊"), w: 61, d: 183 },
      { type: "treadmill", name: t("跑步機"), w: 75, d: 170 },
      { type: "bike", name: t("飛輪／健身車"), w: 55, d: 120 },
      { type: "dumbbell", name: t("啞鈴架"), w: 60, d: 40 },
      { type: "petbed", name: t("寵物窩"), w: 60, d: 50 },
      { type: "ac", name: t("冷氣室內機（上方）"), w: 90, d: 22 },
      { type: "curtain", name: t("窗簾"), w: 160, d: 12 },
    ],
  },
  {
    cat: t("門・牆・標示"),
    items: [
      { type: "swingDoor", name: t("單開門"), w: 80, d: 80 },
      { type: "doubleDoor", name: t("雙開門"), w: 140, d: 70 },
      { type: "slideDoor", name: t("拉門"), w: 160, d: 12 },
      { type: "pocketDoor", name: t("推入式拉門"), w: 90, d: 12 },
      { type: "foldDoor", name: t("折門"), w: 120, d: 30 },
      { type: "slideDoorArc", name: t("弧形拉門"), w: 120, d: 120 },
      { type: "curveSlide", name: t("直線＋弧形拉門"), a: 100, r: 60, ang: 90, turn: -1, b: 0, t: 12 },
      { type: "wall", name: t("隔間牆"), w: 120, d: 12 },
      { type: "wallArc", name: t("弧形牆"), w: 100, d: 100, thick: 12 },
      { type: "curveWall", name: t("直線＋弧形牆"), a: 100, r: 60, ang: 90, turn: -1, b: 0, t: 12 },
      { type: "glassWall", name: t("玻璃隔間"), w: 120, d: 8 },
      { type: "curveGlass", name: t("直線＋弧形玻璃"), a: 100, r: 60, ang: 90, turn: -1, b: 0, t: 8 },
      { type: "halfWall", name: t("半高牆"), w: 120, d: 12 },
      { type: "column", name: t("柱子"), w: 40, d: 40 },
      { type: "dimension", name: t("尺寸標註線"), w: 100, d: 10 },
      { type: "text", name: t("文字標籤"), w: 80, d: 24 },
    ],
  },
];
// 組合曲線元件的寬深依參數計算
LIB.forEach(c => c.items.forEach(it => CURVE_TYPES.has(it.type) && applyCurve(it)));
export const DEFAULTS = {};

LIB.forEach(c =>
  c.items.forEach(it => {
    if (!DEFAULTS[it.type]) DEFAULTS[it.type] = it;
  }),
);
