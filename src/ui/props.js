// 右側屬性面板
import { CURVE_TYPES, applyCurve } from "../shapes/curve.js";
import { S, opt, state } from "../core/store.js";
import { $, KEY, esc } from "../core/dom.js";
import { commit } from "../core/history.js";
import { DEFAULTS } from "../shapes/library.js";
import { drawBase } from "../canvas/base-render.js";
import { inOutOfScope, renderItems, renderSelection } from "../canvas/items.js";
import { cur, selIds, selItems, setSel } from "../canvas/selection.js";
import { startCalib } from "../tools/calibrate.js";
import { copySel } from "../edit/clipboard.js";
import { delSel, dupSel, flipSel, rotSel } from "../edit/actions.js";
import { alignSel } from "../edit/align.js";
import { renderBaseProps, setMode } from "../base-edit/base-edit.js";
import { autosave, renderProjSelect } from "../project/project.js";
import { baseData, download, safeName } from "../io/file.js";
import { showGate } from "./gate.js";
import { openAI } from "./ai.js";

export function renderProps(light) {
  if (S.mode === "base") {
    if (!(light && document.activeElement && $("props").contains(document.activeElement))) renderBaseProps();
    return;
  }
  const it = cur();
  if (light && document.activeElement && $("props").contains(document.activeElement)) return;
  // 在畫布上選到物件時，若停在「底圖」頁就切回「屬性」
  const selKey = selIds().join(",");
  if (selKey && selKey !== S.lastSelKey && S.propTab === "base") S.propTab = "props";
  S.lastSelKey = selKey;
  renderTabs();
  const P = $("propBody");
  if (S.propTab === "list") {
    P.innerHTML = listHTML() || `<div class="empty">這個方案還沒有物件。從左側元件庫拖拉到圖上即可加入。</div>`;
    bindList();
    return;
  }
  if (S.propTab === "base") {
    P.innerHTML = baseTabHTML();
    bindBaseSection();
    if ($("bEdit")) $("bEdit").onclick = () => setMode("base");
    return;
  }
  if (selIds().length > 1) {
    renderMultiProps();
    return;
  }
  if (!it) {
    P.innerHTML = `<div class="empty">點選圖上的物件，即可設定尺寸、角度與名稱；Shift 點選或框選可多選並對齊。<br><br>操作提示在畫布左下角的 <b>!</b>。</div>`;
    return;
  }
  const def = DEFAULTS[it.type] || {};
  const bad = inOutOfScope(it);
  P.innerHTML = `<h2>${def.name || it.type}</h2>
    <div class="row"><span>名稱</span><input id="pLabel" type="text" value="${esc(it.label || "")}"></div>
    ${it.type === "text" ? `<div class="row"><span>字級</span><input id="pFont" type="number" min="8" max="60" value="${it.fontSize || 16}"></div>` : ""}
    ${
      CURVE_TYPES.has(it.type)
        ? `<div class="row"><span>直線 A</span><input id="cA" type="number" min="0" step="1" value="${it.a ?? 0}"></div>
    <div class="row"><span>弧半徑</span><input id="cR" type="number" min="0" step="1" value="${it.r ?? 0}"></div>
    <div class="row"><span>弧角度</span><input id="cAng" type="number" min="0" max="180" step="5" value="${it.ang ?? 90}"></div>
    <div class="row"><span>彎向</span><select id="cTurn"><option value="-1" ${it.turn !== 1 ? "selected" : ""}>往上彎</option><option value="1" ${it.turn === 1 ? "selected" : ""}>往下彎</option></select></div>
    <div class="row"><span>直線 B</span><input id="cB" type="number" min="0" step="1" value="${it.b ?? 0}"></div>
    <div class="row"><span>厚度</span><input id="cT" type="number" min="1" max="60" step="1" value="${it.t ?? 12}"></div>
    <div class="muted" style="font-size:12px">單位 cm。一個元件 = 直線 A → 弧形 → 直線 B；長度設 0 即省略該段。外框 ${Math.round(it.w)}×${Math.round(it.d)}。</div>`
        : `<div class="row"><span>寬 (cm)</span><input id="pW" type="number" min="5" step="1" value="${Math.round(it.w * 10) / 10}"></div>
    <div class="row"><span>深 (cm)</span><input id="pD" type="number" min="3" step="1" value="${Math.round(it.d * 10) / 10}"></div>`
    }
    <div class="row"><span>旋轉 (°)</span><input id="pRot" type="number" step="15" value="${it.rot}"></div>
    <div class="row2"><label>X (cm)<input id="pX" type="number" step="5" value="${Math.round(it.x)}"></label><label>Y (cm)<input id="pY" type="number" step="5" value="${Math.round(it.y)}"></label></div>
    ${it.type === "wallArc" ? `<div class="row"><span>牆厚 (cm)</span><input id="pThick" type="number" min="3" max="40" value="${it.thick || 12}"></div>` : ""}
    ${["wallArc", "slideDoorArc", "vanityArc", "cabinetArc"].includes(it.type) ? `<div class="muted" style="font-size:12px">弧形：寬＝水平半徑、深＝垂直半徑（兩者相同為正圓弧）。用旋轉或鏡像調整朝向。</div>` : ""}
    ${it.type === "sofa" ? `<div class="row"><span>座位數</span><input id="pSeats" type="number" min="1" max="5" value="${it.seats || 2}"></div>` : ""}
    ${["dining", "diningRound"].includes(it.type) ? `<div class="row"><span>椅子數</span><input id="pChairs" type="number" min="0" max="10" value="${it.chairs ?? 4}"></div>` : ""}
    <label class="toggle" style="margin-top:8px"><input id="pShow" type="checkbox" ${it.showName !== false ? "checked" : ""}>圖上顯示名稱</label>
    <label class="toggle" style="margin-top:6px"><input id="pLock" type="checkbox" ${it.locked ? "checked" : ""}>鎖定位置</label>
    ${bad ? `<div class="warn">⚠ 此物件放在衛浴或陽台內（不在設計範圍）</div>` : ""}
    <div class="actions">
      <button id="aRot">旋轉 90°</button><button id="aFlip">左右鏡像</button><button id="aDup">複製</button>
      <button id="aFront">移到上層</button><button id="aBack">移到下層</button><button id="aDel" style="color:#d1242f">刪除</button>
    </div>`;
  const num = (id, fn) => {
    const e = $(id);
    if (e)
      e.addEventListener("change", () => {
        const v = parseFloat(e.value);
        if (!isNaN(v)) {
          fn(v);
          renderItems();
          commit();
          renderProps();
        }
      });
  };
  $("pLabel").addEventListener("input", e => {
    it.label = e.target.value;
    renderItems();
  });
  $("pLabel").addEventListener("change", () => commit());
  num("pFont", v => (it.fontSize = Math.max(8, v)));
  num("pW", v => {
    const cx = it.x + it.w / 2;
    it.w = Math.max(5, v);
    it.x = cx - it.w / 2;
  });
  num("pD", v => {
    const cy = it.y + it.d / 2;
    it.d = Math.max(3, v);
    it.y = cy - it.d / 2;
  });
  num("pRot", v => (it.rot = ((v % 360) + 360) % 360));
  num("pX", v => (it.x = v));
  num("pY", v => (it.y = v));
  num("pThick", v => (it.thick = Math.max(3, v)));
  // 組合曲線：改參數後重算外框，維持中心位置
  const curveNum = (id, key, fn) =>
    num(id, v => {
      const cx = it.x + it.w / 2,
        cy = it.y + it.d / 2;
      it[key] = fn(v);
      applyCurve(it);
      it.x = Math.round((cx - it.w / 2) * 10) / 10;
      it.y = Math.round((cy - it.d / 2) * 10) / 10;
    });
  curveNum("cA", "a", v => Math.max(0, v));
  curveNum("cR", "r", v => Math.max(0, v));
  curveNum("cAng", "ang", v => Math.max(0, Math.min(180, v)));
  curveNum("cB", "b", v => Math.max(0, v));
  curveNum("cT", "t", v => Math.max(1, v));
  if ($("cTurn"))
    $("cTurn").onchange = e => {
      it.turn = +e.target.value;
      applyCurve(it);
      renderItems();
      commit();
      renderProps();
    };
  num("pSeats", v => (it.seats = Math.max(1, Math.round(v))));
  num("pChairs", v => (it.chairs = Math.max(0, Math.round(v))));
  $("pShow").addEventListener("change", e => {
    it.showName = e.target.checked;
    renderItems();
    commit();
  });
  $("pLock").addEventListener("change", e => {
    it.locked = e.target.checked;
    renderItems();
    commit();
  });
  $("aRot").onclick = () => rotSel(90);
  $("aFlip").onclick = flipSel;
  $("aDup").onclick = dupSel;
  $("aDel").onclick = delSel;
  $("aFront").onclick = () => {
    it.z = Math.max(...state.items.map(i => i.z || 0)) + 1;
    renderItems();
    commit();
  };
  $("aBack").onclick = () => {
    it.z = Math.min(...state.items.map(i => i.z || 0)) - 1;
    renderItems();
    commit();
  };
}
export function renderMultiProps() {
  const its = selItems(),
    n = its.length,
    P = $("propBody"),
    btn = (a, t, tip) => `<button data-al="${a}" title="${tip || t}">${t}</button>`;
  P.innerHTML = `<h2>已選取 ${n} 個物件</h2>
    <div class="muted" style="font-size:12px">Shift／${KEY.replace("+", "")} 點選加減選取；Shift 拖曳空白處框選；${KEY}A 全選。拖曳任一個會一起移動。</div>
    <b style="display:block;margin-top:12px">對齊</b>
    <div class="actions" style="margin-top:6px">${btn("left", "⇤ 靠左")}${btn("hcenter", "↔ 水平置中")}${btn("right", "靠右 ⇥")}${btn("top", "⤒ 靠上")}${btn("vcenter", "↕ 垂直置中")}${btn("bottom", "靠下 ⤓")}</div>
    <b style="display:block;margin-top:12px">平均分布</b>
    <div class="actions" style="margin-top:6px">${btn("disth", "水平平均", "左右間距相同（3 個以上）")}${btn("distv", "垂直平均", "上下間距相同（3 個以上）")}</div>
    <b style="display:block;margin-top:12px">邊緣貼合</b>
    <div class="row"><span>間距 cm</span><input id="mGap" type="number" min="0" step="1" value="${opt.gap || 0}"></div>
    <div class="actions" style="margin-top:6px">${btn("packh", "→ 水平貼合", "由左而右依序相接（保留上下位置）")}${btn("packv", "↓ 垂直貼合", "由上而下依序相接（保留左右位置）")}${btn("packhA", "→ 貼合並靠上", "相接並對齊上緣")}${btn("packvA", "↓ 貼合並靠左", "相接並對齊左緣")}</div>
    <b style="display:block;margin-top:12px">尺寸</b>
    <div class="actions" style="margin-top:6px">${btn("samew", "同寬", "寬度統一為最後選取的物件")}${btn("samed", "同深", "深度統一為最後選取的物件")}</div>
    <div class="actions" style="margin-top:14px"><button id="mRot">旋轉 90°</button><button id="mDup">再製</button><button id="mCopy">複製</button><button id="mDel" style="color:#d1242f">刪除</button></div>`;
  $("mGap").onchange = e => (opt.gap = Math.max(0, +e.target.value || 0));
  P.querySelectorAll("[data-al]").forEach(b => (b.onclick = () => alignSel(b.dataset.al)));
  $("mRot").onclick = () => rotSel(90);
  $("mDup").onclick = dupSel;
  $("mCopy").onclick = () => copySel(false);
  $("mDel").onclick = delSel;
}
const PTABS = [
  ["props", "屬性"],
  ["list", "物件"],
  ["base", "底圖"],
];
function renderTabs() {
  const count = { list: state.items.length, props: selIds().length || "" };
  $("props").innerHTML =
    `<div class="ptabs" role="tablist">` +
    PTABS.map(
      ([k, t]) =>
        `<button role="tab" data-ptab="${k}" class="${S.propTab === k ? "on" : ""}" aria-selected="${S.propTab === k}">${t}${count[k] ? ` <small>${count[k]}</small>` : ""}</button>`,
    ).join("") +
    `</div><div id="propBody"></div>`;
  $("props")
    .querySelectorAll("[data-ptab]")
    .forEach(
      b =>
        (b.onclick = () => {
          S.propTab = b.dataset.ptab;
          renderProps();
        }),
    );
}
function baseTabHTML() {
  if (!S.BASE) return `<div class="empty">尚未匯入底圖。</div>`;
  const B = S.BASE,
    n = k => (B[k] || []).length;
  return (
    `<div class="list" style="border-top:none;margin-top:0;padding-top:0"><b>${esc(B.name || "底圖")}</b>
      <div>牆 ${n("walls")} 面・柱子 ${n("columns")}・雨遮 ${n("canopies")}</div>
      <div>不在範圍 ${n("outOfScope")}・房間名稱 ${n("rooms")}・固定設備 ${n("fixtures")}</div>${B.image ? "<div>含底圖圖片</div>" : ""}</div>
    <button id="bEdit" class="primary" style="width:100%;margin:10px 0 0">✏️ 編輯底圖</button>` + renderBaseSection()
  );
}
export function listHTML() {
  if (!state.items.length) return "";
  return (
    `<div class="list"><b>物件清單（${state.items.length}）</b>` +
    state.items
      .map(
        i =>
          `<div data-id="${i.id}" class="${selIds().includes(i.id) ? "sel" : ""}"><span>${esc(i.label || DEFAULTS[i.type]?.name || i.type)}</span><span class="muted">${Math.round(i.w)}×${Math.round(i.d)}</span></div>`,
      )
      .join("") +
    "</div>"
  );
}
export function bindList() {
  document.querySelectorAll("#props .list div[data-id]").forEach(
    d =>
      (d.onclick = e => {
        const id = +d.getAttribute("data-id");
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          const ids = selIds();
          setSel(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
        } else setSel([id]);
      }),
  );
}
export function renderBaseSection() {
  if (!S.BASE) return "";
  const im = S.BASE.image;
  return `<div class="list"><b>底圖</b>
    <div class="row" style="display:grid"><span>專案名稱</span><input id="bName" type="text" value="${esc(S.BASE.name || "")}"></div>
    ${im ? `<div class="row" style="display:grid"><span>透明度</span><input id="bOp" type="range" min="0.1" max="1" step="0.05" value="${im.opacity ?? 0.6}"></div>` : ""}
    <div class="actions">${im ? `<button id="bCal">重新校正比例</button>` : ""}<button id="bExp">匯出底圖檔</button><button id="bChg">更換底圖</button><button id="bAI">🤖 AI 產生底圖</button></div>
    ${
      S.lastAIWarn.length
        ? `<div class="warn" style="color:#9a3412">AI 底圖提醒：<br>${S.lastAIWarn
            .slice(0, 8)
            .map(w => "・" + esc(w))
            .join("<br>")}${S.lastAIWarn.length > 8 ? `<br>…等 ${S.lastAIWarn.length} 則` : ""}</div>`
        : ""
    }</div>`;
}
export function bindBaseSection() {
  if (!$("bName")) return;
  $("bName").onchange = e => {
    S.BASE.name = e.target.value;
    if (S.PROJ) S.PROJ.name = e.target.value;
    autosave();
    renderProjSelect();
  };
  if ($("bOp"))
    $("bOp").oninput = e => {
      S.BASE.image.opacity = +e.target.value;
      drawBase();
      autosave();
    };
  if ($("bCal")) $("bCal").onclick = startCalib;
  $("bExp").onclick = () =>
    download(`${safeName()}-底圖.json`, new Blob([JSON.stringify(baseData(), null, 1)], { type: "application/json" }));
  $("bChg").onclick = () => showGate("replace");
  if ($("bAI"))
    $("bAI").onclick = () => {
      S.gateIntent = "replace";
      openAI();
    };
}

export function init() {
  $("btnBase").onclick = () => {
    state.sel = null;
    renderSelection();
    renderProps();
    if (!S.BASE) showGate();
  };
}
