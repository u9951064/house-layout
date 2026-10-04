// 元件庫定義（分類、預設尺寸）
import { CURVE_TYPES, applyCurve } from "./curve.js";

export const LIB = [
  {
    cat: "床與寢具",
    items: [
      { type: "bed2", name: "雙人床", w: 152, d: 188 },
      { type: "bed2", name: "加大雙人床", w: 182, d: 188 },
      { type: "bed1", name: "單人床", w: 106, d: 188 },
      { type: "bed1", name: "兒童床", w: 90, d: 170 },
      { type: "bunk", name: "上下舖", w: 100, d: 200 },
      { type: "crib", name: "嬰兒床", w: 70, d: 130 },
      { type: "mattress", name: "床墊／軟床墊", w: 106, d: 188 },
      { type: "tatami", name: "架高和室", w: 180, d: 180 },
      { type: "nightstand", name: "床頭櫃", w: 45, d: 40 },
    ],
  },
  {
    cat: "衣物收納",
    items: [
      { type: "wardrobe", name: "衣櫃（開門）", w: 180, d: 60 },
      { type: "wardrobeSlide", name: "衣櫃（拉門）", w: 180, d: 65 },
      { type: "wardrobeL", name: "L 型轉角衣櫃", w: 180, d: 180 },
      { type: "rack", name: "開放式吊衣桿", w: 120, d: 50 },
      { type: "mirror", name: "穿衣鏡", w: 50, d: 6 },
      { type: "vanity", name: "化妝台", w: 90, d: 45 },
      { type: "vanityArc", name: "轉角弧形化妝台", w: 90, d: 90 },
    ],
  },
  {
    cat: "客廳",
    items: [
      { type: "sofa", name: "雙人沙發", w: 160, d: 85, seats: 2 },
      { type: "sofa", name: "三人沙發", w: 210, d: 90, seats: 3 },
      { type: "sofaL", name: "L 型沙發", w: 240, d: 160 },
      { type: "sofabed", name: "沙發床", w: 190, d: 90 },
      { type: "chaise", name: "躺椅", w: 70, d: 150 },
      { type: "armchair", name: "單椅", w: 75, d: 75 },
      { type: "beanbag", name: "懶骨頭", w: 80, d: 80 },
      { type: "ottoman", name: "腳凳／坐墩", w: 45, d: 45 },
      { type: "coffee", name: "茶几", w: 100, d: 50 },
      { type: "side", name: "邊几", w: 45, d: 45 },
      { type: "tv", name: "電視櫃", w: 150, d: 40 },
      { type: "tvwall", name: "壁掛電視", w: 125, d: 8 },
      { type: "screen", name: "投影布幕（上方）", w: 220, d: 8 },
      { type: "rug", name: "地毯", w: 200, d: 140 },
      { type: "rugRound", name: "圓地毯", w: 160, d: 160 },
      { type: "plant", name: "植栽", w: 45, d: 45 },
      { type: "floorLamp", name: "落地燈", w: 40, d: 40 },
    ],
  },
  {
    cat: "餐廚",
    items: [
      { type: "fridge", name: "冰箱", w: 70, d: 70 },
      { type: "appliance", name: "電器櫃", w: 60, d: 60 },
      { type: "counter", name: "流理台", w: 210, d: 60 },
      { type: "island", name: "中島／吧檯", w: 140, d: 70 },
      { type: "dining", name: "方餐桌", w: 120, d: 75, chairs: 4 },
      { type: "diningRound", name: "圓餐桌", w: 90, d: 90, chairs: 4 },
      { type: "dchair", name: "餐椅", w: 45, d: 48 },
      { type: "benchSeat", name: "長凳", w: 110, d: 35 },
      { type: "stool", name: "吧檯椅", w: 38, d: 38 },
      { type: "sideboard", name: "餐邊櫃", w: 120, d: 45 },
      { type: "trash", name: "垃圾桶", w: 35, d: 30 },
    ],
  },
  {
    cat: "書房・工作",
    items: [
      { type: "desk", name: "活動書桌", w: 120, d: 60 },
      { type: "deskLift", name: "升降桌", w: 120, d: 60 },
      { type: "deskFixed", name: "固定書桌", w: 160, d: 60 },
      { type: "deskL", name: "L 型書桌", w: 160, d: 140 },
      { type: "chair", name: "辦公椅", w: 55, d: 55 },
      { type: "bookshelf", name: "書櫃", w: 120, d: 35 },
      { type: "drawer", name: "活動抽屜櫃", w: 40, d: 50 },
    ],
  },
  {
    cat: "櫃體與收納",
    items: [
      { type: "cabinet", name: "儲物櫃（高櫃）", w: 90, d: 45 },
      { type: "lowcab", name: "矮櫃", w: 120, d: 40 },
      { type: "upper", name: "吊櫃（上方）", w: 120, d: 35 },
      { type: "display", name: "展示櫃（玻璃門）", w: 90, d: 40 },
      { type: "screenCab", name: "屏風櫃／雙面櫃", w: 135, d: 30 },
      { type: "shoe", name: "鞋櫃", w: 120, d: 35 },
      { type: "openShelf", name: "開放層架", w: 90, d: 35 },
      { type: "bench", name: "臥榻／卡座", w: 120, d: 45 },
      { type: "cabinetArc", name: "轉角弧形櫃", w: 60, d: 60 },
    ],
  },
  {
    cat: "運動・生活",
    items: [
      { type: "yogamat", name: "瑜伽墊", w: 61, d: 183 },
      { type: "treadmill", name: "跑步機", w: 75, d: 170 },
      { type: "bike", name: "飛輪／健身車", w: 55, d: 120 },
      { type: "dumbbell", name: "啞鈴架", w: 60, d: 40 },
      { type: "petbed", name: "寵物窩", w: 60, d: 50 },
      { type: "ac", name: "冷氣室內機（上方）", w: 90, d: 22 },
      { type: "curtain", name: "窗簾", w: 160, d: 12 },
    ],
  },
  {
    cat: "門・牆・標示",
    items: [
      { type: "swingDoor", name: "單開門", w: 80, d: 80 },
      { type: "doubleDoor", name: "雙開門", w: 140, d: 70 },
      { type: "slideDoor", name: "拉門", w: 160, d: 12 },
      { type: "pocketDoor", name: "推入式拉門", w: 90, d: 12 },
      { type: "foldDoor", name: "折門", w: 120, d: 30 },
      { type: "slideDoorArc", name: "弧形拉門", w: 120, d: 120 },
      { type: "curveSlide", name: "直線＋弧形拉門", a: 100, r: 60, ang: 90, turn: -1, b: 0, t: 12 },
      { type: "wall", name: "隔間牆", w: 120, d: 12 },
      { type: "wallArc", name: "弧形牆", w: 100, d: 100, thick: 12 },
      { type: "curveWall", name: "直線＋弧形牆", a: 100, r: 60, ang: 90, turn: -1, b: 0, t: 12 },
      { type: "glassWall", name: "玻璃隔間", w: 120, d: 8 },
      { type: "curveGlass", name: "直線＋弧形玻璃", a: 100, r: 60, ang: 90, turn: -1, b: 0, t: 8 },
      { type: "halfWall", name: "半高牆", w: 120, d: 12 },
      { type: "column", name: "柱子", w: 40, d: 40 },
      { type: "dimension", name: "尺寸標註線", w: 100, d: 10 },
      { type: "text", name: "文字標籤", w: 80, d: 24 },
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
