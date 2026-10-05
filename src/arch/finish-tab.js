// 右側「裝修」分頁：方案設計規格（高度、預設材質、踢腳板）與逐面牆面裝修
import { isEn, t } from "../core/i18n.js";
import { S, state } from "../core/store.js";
import { esc } from "../core/dom.js";
import { renderItems } from "../canvas/items.js";
import { SPEC_DEFAULTS, spec } from "../ext/heights.js";
import { bindMatField, getMat, matFieldHTML } from "../materials/index.js";
import { faceInside, faceRoom, wallFaceMat } from "./helpers.js";

const NUMS = [
  ["slabH", "樓板高度（結構）", 200, 600],
  ["ceilH", "天花板高度（CH）", 180, 500],
  ["doorH", "門預設高度", 150, 300],
  ["winSill", "窗台預設高度", 0, 200],
  ["winHead", "窗頂預設高度", 50, 400],
  ["skirtH", "踢腳板高度（0＝不做）", 0, 30],
];
const MATS = [
  ["floorMat", "預設地坪", ["floor", "tile", "stone", "wood"]],
  ["wallMat", "預設牆面", ["paint", "wallpaper", "wood", "laminate", "brick", "stone", "tile"]],
  ["ceilMat", "預設天花", ["ceiling", "paint"]],
  ["skirtMat", "踢腳板材質", ["wood", "laminate", "paint", "metal", "stone"]],
];
const WALL_CATS = MATS[1][2];

function setSpec(key, v) {
  if (!state.spec || typeof state.spec !== "object") state.spec = {};
  if (v === undefined) delete state.spec[key];
  else state.spec[key] = v;
}

export const FINISH_TAB = {
  id: "finish",
  get name() {
    return t("裝修");
  },
  html() {
    if (!S.BASE) return `<div class="empty">${t("尚未匯入底圖。")}</div>`;
    const sp = spec(),
      walls = S.BASE.walls || [];
    let h = `<div class="arch-tab"><b class="arch-h">${t("高度")}</b>`;
    for (const [k, label, mn, mx] of NUMS)
      h += `<div class="row"><span>${t(label)}</span><input id="sp_${k}" type="number" min="${mn}" max="${mx}" step="1" value="${sp[k]}"></div>`;
    h += `<b class="arch-h">${t("預設材質")}</b>`;
    for (const [k, label] of MATS) h += matFieldHTML("sp_" + k, sp[k], t(label));
    h += `<b class="arch-h">${t("牆面裝修（逐面）")}</b>
      <div class="muted arch-hint">${t("每面牆分兩側；未指定的面使用預設牆面材質。室外側預設隱藏。")}</div>
      <label class="toggle"><input id="spShowOut" type="checkbox" ${S.archShowOut ? "checked" : ""}>${t("顯示室外側")}</label>
      <div class="arch-walls">`;
    walls.forEach((w, i) => {
      for (const face of [1, -1]) {
        const inside = faceInside(w, face);
        if (!inside && !S.archShowOut) continue;
        const key = `${i}:${face}`,
          set = !!(sp.wallFin && sp.wallFin[key]),
          room = faceRoom(w, face),
          len = Math.round(Math.hypot(w[2] - w[0], w[3] - w[1]));
        const label = `${t("牆 {i}", { i: i + 1 })}${room ? "・" + room : ""}${inside ? "" : "・" + t("室外側")}${isEn ? ` (${len} cm)` : `（${len} cm）`}`;
        h += `<div class="arch-wall${set ? " set" : ""}" data-wall="${i}">${matFieldHTML("wf_" + key.replace(":", "_").replace("-", "m"), wallFaceMat(i, face), label)}${
          set ? `<button class="arch-clear" data-clear="${key}" title="${t("改回預設")}">↺</button>` : ""
        }</div>`;
      }
    });
    h += `</div><div class="actions"><button id="spResetWalls">${t("全部套用預設")}</button><button id="spResetAll">${t("規格還原預設值")}</button></div>`;
    h += `<div class="muted arch-hint">${t("預設牆面：{name}", { name: esc(getMat(sp.wallMat).name) })}</div></div>`;
    return h;
  },
  bind(api) {
    const root = document.getElementById("propBody");
    if (!root || !S.BASE) return;
    const done = () => {
      api.commit();
      renderItems();
      api.rerender();
    };
    for (const [k, , mn, mx] of NUMS) {
      const e = api.$("sp_" + k);
      if (e)
        e.onchange = () => {
          const v = parseFloat(e.value);
          if (isNaN(v)) return;
          setSpec(k, Math.max(mn, Math.min(mx, v)));
          done();
        };
    }
    for (const [k, , cats] of MATS)
      bindMatField(root, "sp_" + k, cats, id => {
        setSpec(k, id);
        done();
      });
    (S.BASE.walls || []).forEach((w, i) => {
      for (const face of [1, -1]) {
        const key = `${i}:${face}`;
        bindMatField(root, "wf_" + key.replace(":", "_").replace("-", "m"), WALL_CATS, id => {
          setSpec("wallFin", { ...(spec().wallFin || {}), [key]: id });
          done();
        });
      }
    });
    root.querySelectorAll("[data-clear]").forEach(
      b =>
        (b.onclick = () => {
          const wf = { ...(spec().wallFin || {}) };
          delete wf[b.dataset.clear];
          setSpec("wallFin", wf);
          done();
        }),
    );
    const so = api.$("spShowOut");
    if (so)
      so.onchange = () => {
        S.archShowOut = so.checked;
        api.rerender();
      };
    const rw = api.$("spResetWalls");
    if (rw)
      rw.onclick = () => {
        setSpec("wallFin", {});
        done();
      };
    const ra = api.$("spResetAll");
    if (ra)
      ra.onclick = () => {
        for (const k of Object.keys(SPEC_DEFAULTS)) setSpec(k, undefined);
        done();
      };
  },
};
