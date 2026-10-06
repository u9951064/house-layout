// 裝修元件與門的屬性面板區塊
import { t } from "../core/i18n.js";
import { matFieldHTML, bindMatField } from "../materials/index.js";
import { P } from "./catalog.js";
import { CEIL_TYPES, CURTAIN_TYPES, DOOR_TYPES, FLOOR_TYPES, LEAF_STYLES, WALLFIN_TYPES, itemMat } from "./helpers.js";

const FLOOR_CATS = ["floor", "tile", "stone", "wood"],
  CEIL_CATS = ["ceiling", "paint", "wood", "metal"],
  WALL_CATS = ["wood", "laminate", "paint", "wallpaper", "brick", "stone", "tile", "glass", "metal"],
  FABRIC_CATS = ["fabric"],
  LEAF_CATS = ["wood", "laminate", "paint", "glass", "metal"];

const hint = s => `<div class="muted arch-hint">${s}</div>`;
const sel = (id, v, opts) =>
  `<select id="${id}">${opts.map(([k, l]) => `<option value="${k}" ${String(v) === String(k) ? "selected" : ""}>${l}</option>`).join("")}</select>`;
const row = (label, inner) => `<div class="row"><span>${label}</span>${inner}</div>`;
const numIn = (id, v, attrs = "") =>
  `<input id="${id}" type="number" ${attrs} value="${Math.round((+v || 0) * 10) / 10}">`;

/** 數字欄位綁定（空白＝清除，回到預設） */
function bindNum(api, it, id, key, fn = v => v) {
  const e = api.$(id);
  if (!e) return;
  e.onchange = () => {
    if (e.value === "") delete it[key];
    else {
      const v = parseFloat(e.value);
      if (isNaN(v)) return;
      it[key] = fn(v);
    }
    api.commit();
    api.rerender();
  };
}
function bindSel(api, it, id, key, num = false) {
  const e = api.$(id);
  if (e)
    e.onchange = () => {
      it[key] = num ? +e.value : e.value;
      api.commit();
      api.rerender();
    };
}
function bindMat(api, it, key, cats) {
  bindMatField(document.getElementById("propBody") || document, key, cats, id => {
    it[key] = id;
    api.commit();
    api.rerender();
  });
}

const floorProps = {
  html: it =>
    `<b class="arch-h">${t("地坪")}</b>` +
    matFieldHTML("mat", itemMat(it), t("材質")) +
    row(t("拼貼方向 (°)"), numIn("aAng", it.angle || 0, 'step="15"')) +
    hint(t("高度＝完成面厚度或架高高度；架高 ≥ 5 cm 會在 3D 與數量表計為架高地板。")),
  bind(it, api) {
    bindMat(api, it, "mat", FLOOR_CATS);
    bindNum(api, it, "aAng", "angle", v => ((v % 360) + 360) % 360);
  },
};
const ceilProps = {
  html: it =>
    `<b class="arch-h">${t("天花")}</b>` +
    matFieldHTML("mat", itemMat(it), t("材質")) +
    (it.type === "ceilCove" ? row(t("燈槽寬 (cm)"), numIn("aCove", P(it, "cove"), 'min="5" step="1"')) : "") +
    (it.type === "ceilGrille" ? row(t("格柵間距 (cm)"), numIn("aGap", P(it, "gap"), 'min="4" step="1"')) : "") +
    hint(
      it.type === "ceilBeam"
        ? t("離地＝包樑底面高度，樑體會做到樓板。")
        : it.type === "curtainBox"
          ? t("離地＝窗簾盒內頂高度（高於天花）。")
          : t("離地＝天花板底面高度（CH）；空白則依方案天花高度。"),
    ),
  bind(it, api) {
    bindMat(api, it, "mat", CEIL_CATS);
    bindNum(api, it, "aCove", "cove", v => Math.max(5, v));
    bindNum(api, it, "aGap", "gap", v => Math.max(4, v));
  },
};
const wallFinProps = {
  html: it =>
    `<b class="arch-h">${t("牆面裝修")}</b>` +
    matFieldHTML("mat", itemMat(it), t("材質")) +
    (["wallPanel", "wainscot"].includes(it.type)
      ? row(
          t("樣式"),
          sel("aStyle", P(it, "style") || "flat", [
            ["flat", t("平板")],
            ["slat", t("格柵條")],
            ["screen", t("格柵屏風（透空）")],
            ["panel", t("線板框")],
            ["groove", t("溝縫")],
          ]),
        )
      : "") +
    hint(t("沿牆面放置：寬＝長度、深＝厚度；高度與離地決定立面範圍。")),
  bind(it, api) {
    bindMat(api, it, "mat", WALL_CATS);
    bindSel(api, it, "aStyle", "style");
  },
};
const curtainProps = {
  html: it =>
    `<b class="arch-h">${t("窗簾")}</b>` +
    matFieldHTML("mat", itemMat(it), it.type === "blindsVenetian" ? t("葉片材質") : t("布料")) +
    (it.type === "curtainDouble" ? matFieldHTML("mat2", itemMat(it, "mat2"), t("紗簾布料")) : "") +
    row(t("開啟程度"), `<input id="aOpen" type="range" min="0" max="1" step="0.05" value="${P(it, "open") ?? 0}">`) +
    row(
      t("安裝方式"),
      sel("aTrack", P(it, "track") || "ceiling", [
        ["ceiling", t("天花軌道")],
        ["wall", t("壁掛")],
      ]),
    ),
  bind(it, api) {
    bindMat(api, it, "mat", FABRIC_CATS.concat(it.type === "blindsVenetian" ? ["wood", "metal"] : []));
    bindMat(api, it, "mat2", FABRIC_CATS);
    const o = api.$("aOpen");
    if (o)
      o.onchange = () => {
        it.open = +o.value;
        api.commit();
      };
    bindSel(api, it, "aTrack", "track");
  },
};
export const LEAF_LABELS = () => ({
  flat: t("平板門"),
  panel: t("線板門"),
  glass: t("玻璃門"),
  groove: t("溝縫門"),
  louver: t("百葉門"),
  accordion: t("風琴門"),
});
const doorProps = {
  test: it => DOOR_TYPES.includes(it.type),
  html: it =>
    `<b class="arch-h">${t("門片")}</b>` +
    row(
      t("門片樣式"),
      sel(
        "aLeaf",
        P(it, "leafStyle") || "flat",
        LEAF_STYLES.map(k => [k, LEAF_LABELS()[k]]),
      ),
    ) +
    matFieldHTML("leafMat", it.leafMat || itemMat(it, "leafMat"), t("門片材質")) +
    matFieldHTML("frameMat", it.frameMat || itemMat(it, "frameMat"), t("門框材質")) +
    row(
      t("把手"),
      sel("aHandle", P(it, "handle") || "lever", [
        ["lever", t("水平把手")],
        ["bar", t("長把手")],
        ["knob", t("喇叭鎖")],
        ["none", t("無（隱藏式）")],
      ]),
    ) +
    (["swingDoor", "doubleDoor"].includes(it.type)
      ? row(t("3D 開啟角度 (°)"), numIn("aDeg", P(it, "openDeg") ?? 15, 'min="0" max="90" step="5"'))
      : ""),
  bind(it, api) {
    bindSel(api, it, "aLeaf", "leafStyle");
    bindSel(api, it, "aHandle", "handle");
    bindMat(api, it, "leafMat", LEAF_CATS);
    bindMat(api, it, "frameMat", LEAF_CATS);
    bindNum(api, it, "aDeg", "openDeg", v => Math.max(0, Math.min(90, v)));
  },
};

export function registerProps(EXT) {
  for (const k of FLOOR_TYPES) EXT.props[k] = floorProps;
  for (const k of CEIL_TYPES) EXT.props[k] = ceilProps;
  for (const k of WALLFIN_TYPES) EXT.props[k] = wallFinProps;
  for (const k of CURTAIN_TYPES) EXT.props[k] = curtainProps;
  EXT.propsAny.push(doorProps);
}
