// 櫃體元件庫：參數化系統櫃／木作櫃（下櫃、吊櫃、高櫃、衣櫃、電視櫃、鞋櫃、書櫃…）
import { t } from "../core/i18n.js";

/** 櫃體預設參數（每種櫃型可覆寫） */
export const CAB_DEFAULTS = {
  thk: 1.8, // 板厚
  backThk: 0.8, // 背板厚
  doorThk: 1.8, // 門板厚
  toe: 10, // 踢腳高（0＝無踢腳，例如吊櫃）
  toeSet: 5, // 踢腳內縮
  top: null, // 檯面 { mat, thk, overhang }
  carcassMat: "lam-white",
  doorMat: "lam-light-wood",
  interiorMat: "lam-white",
  handleMat: "metal-black",
  glassMat: "glass-clear",
  handle: "bar", // none | bar | knob | groove | push | edge
  gap: 0.3, // 門縫
  overlay: "full", // full 全蓋 | inset 內嵌
  fillerL: 0,
  fillerR: 0,
  lightStrip: false,
  sections: [{ w: 0, kind: "door2", n: 2 }],
};

const cab = (o, sections) => ({ ...JSON.parse(JSON.stringify(CAB_DEFAULTS)), ...o, sections });
const S = (kind, n = 0, w = 0, extra = {}) => ({ w, kind, n, ...extra });

export const CAB_CATALOG = {
  cat: t("櫃體（參數化）"),
  layer: "cabinet",
  items: [
    {
      type: "cabBase",
      name: t("廚房下櫃"),
      w: 120,
      d: 60,
      h: 86,
      elev: 0,
      cab: cab({ toe: 10, top: { mat: "ct-quartz-white", thk: 2, overhang: 2 }, doorMat: "lam-white" }, [
        S("drawer", 3, 60),
        S("door2", 1),
      ]),
    },
    {
      type: "cabWall",
      name: t("廚房吊櫃"),
      w: 120,
      d: 35,
      h: 70,
      elev: 150,
      cab: cab({ toe: 0, doorMat: "lam-white", handle: "edge" }, [S("door2", 1), S("lift", 1, 60)]),
    },
    {
      type: "cabTall",
      name: t("高櫃／電器櫃"),
      w: 60,
      d: 60,
      h: 230,
      elev: 0,
      cab: cab({ toe: 10, doorMat: "lam-white" }, [S("appliance", 0, 0, { dr: 2, upper: "door1L" })]),
    },
    {
      type: "cabWardrobe",
      name: t("系統衣櫃"),
      w: 180,
      d: 60,
      h: 240,
      elev: 0,
      cab: cab({ toe: 8 }, [
        S("hang", 1, 0, { front: "door2", dr: 2 }),
        S("door1R", 5, 60),
        S("hang", 2, 0, { front: "door2" }),
      ]),
    },
    {
      type: "cabTV",
      name: t("懸浮電視櫃"),
      w: 180,
      d: 45,
      h: 40,
      elev: 20,
      cab: cab({ toe: 0, handle: "groove", lightStrip: true }, [S("drawer", 1), S("niche", 0, 60), S("drawer", 1)]),
    },
    {
      type: "cabShoe",
      name: t("鞋櫃"),
      w: 120,
      d: 35,
      h: 110,
      elev: 0,
      cab: cab({ toe: 8, handle: "push" }, [S("door2", 5), S("door1R", 5, 40)]),
    },
    {
      type: "cabBook",
      name: t("書櫃／展示櫃"),
      w: 120,
      d: 35,
      h: 200,
      elev: 0,
      cab: cab({ toe: 8, lightStrip: true }, [S("open", 4), S("glass", 4)]),
    },
    {
      type: "cabIsland",
      name: t("中島櫃"),
      w: 160,
      d: 90,
      h: 90,
      elev: 0,
      cab: cab({ toe: 10, top: { mat: "ct-quartz-white", thk: 3, overhang: 25 } }, [
        S("drawer", 3),
        S("door2", 1),
        S("drawer", 3),
      ]),
    },
    {
      type: "cabVanity",
      name: t("浴櫃／洗手台"),
      w: 80,
      d: 50,
      h: 82,
      elev: 0,
      cab: cab({ toe: 0, top: { mat: "ct-quartz-white", thk: 2, overhang: 0 }, handle: "groove" }, [S("drawer", 2)]),
    },
    {
      type: "cabDesk",
      name: t("書桌櫃"),
      w: 140,
      d: 60,
      h: 75,
      elev: 0,
      cab: cab({ toe: 0, handle: "edge" }, [S("drawer", 3, 45), S("knee", 0)]),
    },
    {
      type: "cabBench",
      name: t("臥榻收納"),
      w: 160,
      d: 55,
      h: 45,
      elev: 0,
      cab: cab({ toe: 5, handle: "push" }, [S("drawer", 1), S("drawer", 1)]),
    },
    {
      type: "cabFull",
      name: t("整面收納牆"),
      w: 300,
      d: 45,
      h: 240,
      elev: 0,
      cab: cab({ toe: 8, handle: "push" }, [
        S("door2", 5, 80),
        S("open", 3, 70, { dr: 2 }),
        S("door2", 5, 80),
        S("hang", 1, 0, { front: "door1L" }),
      ]),
    },
  ],
};
