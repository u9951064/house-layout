// 櫃體屬性面板：板厚、踢腳、檯面、材質、把手、門板形式、分格編輯器、開關預覽
import { t } from "../core/i18n.js";
import { esc } from "../core/dom.js";
import { bindMatField, matFieldHTML } from "../materials/index.js";
import { KINDS, MAT_CATS, cabLayout, ensureCab, resolveMat } from "./model.js";
import { setView } from "../ext/views.js";

const HANDLES = [
  ["bar", "一字把手"],
  ["knob", "圓頭把手"],
  ["edge", "鋁擠把手（上緣）"],
  ["groove", "隱藏式把手（開槽）"],
  ["push", "按壓式（無把手）"],
  ["none", "無"],
];
const S = (kind, n = 0, w = 0, extra = {}) => ({ w, kind, n, ...extra });
/** 分格預設組合 */
export const PRESETS = () => ({
  [t("雙開門＋層板")]: [S("door2", 2)],
  [t("抽屜＋雙開門")]: [S("drawer", 3, 60), S("door2", 1)],
  [t("全抽屜")]: [S("drawer", 3)],
  [t("開放層架")]: [S("open", 4)],
  [t("衣櫃：長吊＋層板＋短吊")]: [
    S("hang", 1, 0, { front: "door2" }),
    S("door1R", 5, 50),
    S("hang", 2, 0, { front: "door2" }),
  ],
  [t("衣櫃：吊衣＋下抽")]: [S("hang", 1, 0, { front: "door2", dr: 2 }), S("hang", 1, 0, { front: "door2", dr: 2 })],
  [t("衣櫃：拉門")]: [S("hang", 1, 0, { front: "slide" }), S("hang", 2, 0, { front: "slide" })],
  [t("電器櫃（抽屜＋電器＋上門）")]: [S("appliance", 0, 0, { dr: 2, upper: "door1L" })],
  [t("書櫃：開放＋玻璃門")]: [S("open", 4), S("glass", 4)],
  [t("電視櫃：抽屜＋凹槽")]: [S("drawer", 1), S("niche", 0, 60), S("drawer", 1)],
  [t("吊櫃：上掀門")]: [S("lift", 1)],
});

function sectionRows(it) {
  const c = it.cab,
    L = cabLayout(it);
  return c.sections
    .map((s, i) => {
      const kinds = KINDS.map(
        ([k, n]) => `<option value="${k}" ${k === s.kind ? "selected" : ""}>${t(n)}</option>`,
      ).join("");
      const front =
        s.kind === "hang"
          ? `<select data-sf="front" data-i="${i}" title="${t("吊衣區門板")}">${[
              ["door2", "雙開門"],
              ["door1L", "單開門（左鉸）"],
              ["door1R", "單開門（右鉸）"],
              ["slide", "拉門"],
              ["none", "無門"],
            ]
              .map(([k, n]) => `<option value="${k}" ${k === (s.front || "door2") ? "selected" : ""}>${t(n)}</option>`)
              .join("")}</select>`
          : "";
      const nLabel = s.kind === "drawer" ? t("抽數") : s.kind === "hang" ? t("吊桿") : t("層板");
      return `<div class="cabsec" data-i="${i}">
        <div class="cabsec-h"><b>${i + 1}</b><select data-sf="kind" data-i="${i}">${kinds}</select>
          <button data-sa="up" data-i="${i}" title="${t("往左移")}" ${i ? "" : "disabled"}>◀</button><button data-sa="down" data-i="${i}" title="${t("往右移")}" ${i < c.sections.length - 1 ? "" : "disabled"}>▶</button><button data-sa="del" data-i="${i}" title="${t("刪除分格")}" ${c.sections.length > 1 ? "" : "disabled"}>✕</button></div>
        <div class="cabsec-b"><label>${t("寬")}<input data-sf="w" data-i="${i}" type="number" min="0" step="1" value="${+s.w || ""}" placeholder="${Math.round(L.widths[i])}"></label>
          ${["niche", "knee", "appliance"].includes(s.kind) ? "" : `<label>${nLabel}<input data-sf="n" data-i="${i}" type="number" min="0" max="12" step="1" value="${+s.n || 0}"></label>`}
          ${["drawer", "knee", "niche"].includes(s.kind) ? "" : `<label>${t("下抽")}<input data-sf="dr" data-i="${i}" type="number" min="0" max="6" step="1" value="${+s.dr || 0}"></label>`}
          ${front}</div></div>`;
    })
    .join("");
}

export const cabProps = {
  html(it) {
    const c = ensureCab(it);
    const top = c.top;
    const presets = Object.keys(PRESETS());
    return `<div class="cabprops"><b>${t("櫃體參數")}</b>
      <div class="row2"><label>${t("板厚")}<input id="cbThk" type="number" min="0.8" max="5" step="0.1" value="${c.thk}"></label><label>${t("背板厚")}<input id="cbBack" type="number" min="0.3" max="3" step="0.1" value="${c.backThk}"></label></div>
      <div class="row2"><label>${t("踢腳高")}<input id="cbToe" type="number" min="0" max="20" step="1" value="${c.toe}"></label><label>${t("踢腳內縮")}<input id="cbToeSet" type="number" min="0" max="15" step="0.5" value="${c.toeSet}"></label></div>
      <div class="row2"><label>${t("門縫")}<input id="cbGap" type="number" min="0" max="1" step="0.1" value="${c.gap}"></label><label>${t("門板形式")}<select id="cbOverlay"><option value="full" ${c.overlay !== "inset" ? "selected" : ""}>${t("全蓋")}</option><option value="inset" ${c.overlay === "inset" ? "selected" : ""}>${t("內嵌")}</option></select></label></div>
      <div class="row2"><label>${t("左封板")}<input id="cbFL" type="number" min="0" max="30" step="0.5" value="${+c.fillerL || 0}"></label><label>${t("右封板")}<input id="cbFR" type="number" min="0" max="30" step="0.5" value="${+c.fillerR || 0}"></label></div>
      <div class="row"><span>${t("把手")}</span><select id="cbHandle">${HANDLES.map(([k, n]) => `<option value="${k}" ${k === c.handle ? "selected" : ""}>${t(n)}</option>`).join("")}</select></div>
      ${matFieldHTML("cbCarcass", c.carcassMat, t("櫃身"))}
      ${matFieldHTML("cbDoor", c.doorMat, t("門板"))}
      ${matFieldHTML("cbInterior", c.interiorMat, t("內部"))}
      ${matFieldHTML("cbHandleMat", c.handleMat, t("五金"))}
      ${c.sections.some(s => s.kind === "glass") ? matFieldHTML("cbGlass", c.glassMat, t("玻璃")) : ""}
      <label class="toggle" style="margin-top:6px"><input id="cbTop" type="checkbox" ${top ? "checked" : ""}>${t("檯面")}</label>
      ${
        top
          ? `<div class="row2"><label>${t("檯面厚")}<input id="cbTopT" type="number" min="0.5" max="10" step="0.5" value="${top.thk}"></label><label>${t("前凸")}<input id="cbTopO" type="number" min="0" max="40" step="0.5" value="${top.overhang}"></label></div>${matFieldHTML("cbTopMat", top.mat, t("檯面材質"))}`
          : ""
      }
      <label class="toggle" style="margin-top:6px"><input id="cbLed" type="checkbox" ${c.lightStrip ? "checked" : ""}>${t("LED 燈條")}</label>
      <div class="row" style="margin-top:8px"><span>${t("開關預覽")}</span><input id="cbOpen" type="range" min="0" max="1" step="0.5" value="${+c.open || 0}" title="${t("0＝關門、1＝全開（3D 與立面）")}"></div>
      <b style="display:block;margin-top:10px">${t("分格（由左至右）")}</b>
      <div id="cbSecs">${sectionRows(it)}</div>
      <div class="actions" style="margin-top:6px"><button id="cbAdd">＋ ${t("分格")}</button><button id="cbEq" title="${t("所有分格寬度改為自動平分")}">${t("平均分配")}</button>
        <select id="cbPreset"><option value="">${t("套用組合…")}</option>${presets.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join("")}</select></div>
      <div class="actions"><button id="cbSheet">📐 ${t("櫃體工程圖")}</button></div>
    </div>`;
  },
  bind(it, api) {
    const c = ensureCab(it),
      $ = api.$,
      root = document.getElementById("propBody") || document;
    const done = (rerender = true) => {
      api.commit();
      if (rerender) api.rerender();
    };
    const num = (id, fn) => {
      const e = $(id);
      if (e)
        e.onchange = () => {
          const v = parseFloat(e.value);
          if (!isNaN(v)) {
            fn(v);
            done();
          }
        };
    };
    num("cbThk", v => (c.thk = Math.max(0.8, v)));
    num("cbBack", v => (c.backThk = Math.max(0.3, v)));
    num("cbToe", v => (c.toe = Math.max(0, v)));
    num("cbToeSet", v => (c.toeSet = Math.max(0, v)));
    num("cbGap", v => (c.gap = Math.max(0, v)));
    num("cbFL", v => (c.fillerL = Math.max(0, v)));
    num("cbFR", v => (c.fillerR = Math.max(0, v)));
    num("cbTopT", v => c.top && (c.top.thk = Math.max(0.5, v)));
    num("cbTopO", v => c.top && (c.top.overhang = Math.max(0, v)));
    const sel = (id, fn) => {
      const e = $(id);
      if (e)
        e.onchange = () => {
          fn(e.value);
          done();
        };
    };
    sel("cbOverlay", v => (c.overlay = v));
    sel("cbHandle", v => (c.handle = v));
    if ($("cbTop"))
      $("cbTop").onchange = e => {
        c.top = e.target.checked ? { mat: resolveMat("ct-quartz-white", MAT_CATS.top), thk: 2, overhang: 2 } : null;
        done();
      };
    if ($("cbLed"))
      $("cbLed").onchange = e => {
        c.lightStrip = e.target.checked;
        done();
      };
    if ($("cbOpen"))
      $("cbOpen").onchange = e => {
        c.open = +e.target.value;
        done(false);
      };
    const mats = [
      ["cbCarcass", "carcassMat"],
      ["cbDoor", "doorMat"],
      ["cbInterior", "interiorMat"],
      ["cbHandleMat", "handleMat"],
      ["cbGlass", "glassMat"],
    ];
    for (const [key, field] of mats)
      bindMatField(root, key, MAT_CATS[field], id => {
        c[field] = id;
        done();
      });
    bindMatField(root, "cbTopMat", MAT_CATS.top, id => {
      if (c.top) c.top.mat = id;
      done();
    });
    // 分格編輯
    root.querySelectorAll("[data-sf]").forEach(e => {
      e.onchange = () => {
        const s = c.sections[+e.dataset.i],
          f = e.dataset.sf;
        if (f === "kind") {
          s.kind = e.value;
          if (s.kind === "drawer" && !(+s.n > 0)) s.n = 3;
          if (s.kind === "hang") s.n = Math.min(2, Math.max(1, +s.n || 1));
        } else if (f === "front") s.front = e.value;
        else {
          const v = parseFloat(e.value);
          s[f] = isNaN(v) ? 0 : Math.max(0, f === "w" ? v : Math.round(v));
        }
        done();
      };
    });
    root.querySelectorAll("[data-sa]").forEach(b => {
      b.onclick = () => {
        const i = +b.dataset.i,
          a = b.dataset.sa,
          ss = c.sections;
        if (a === "del" && ss.length > 1) ss.splice(i, 1);
        if (a === "up" && i > 0) [ss[i - 1], ss[i]] = [ss[i], ss[i - 1]];
        if (a === "down" && i < ss.length - 1) [ss[i + 1], ss[i]] = [ss[i], ss[i + 1]];
        done();
      };
    });
    if ($("cbAdd"))
      $("cbAdd").onclick = () => {
        c.sections.push({ w: 0, kind: "door1L", n: 2 });
        done();
      };
    if ($("cbEq"))
      $("cbEq").onclick = () => {
        c.sections.forEach(s => (s.w = 0));
        done();
      };
    if ($("cbPreset"))
      $("cbPreset").onchange = e => {
        const p = PRESETS()[e.target.value];
        if (!p) return;
        c.sections = JSON.parse(JSON.stringify(p));
        done();
      };
    if ($("cbSheet")) $("cbSheet").onclick = () => setView("cab");
  },
};
