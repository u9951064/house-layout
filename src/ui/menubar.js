// 選單列（檔案／編輯／檢視／底圖／說明）
import { S, state } from "../core/store.js";
import { $, KEY, esc } from "../core/dom.js";
import { redo, undo } from "../core/history.js";
import { fit, zoomBy } from "../canvas/view.js";
import { selIds, setSel } from "../canvas/selection.js";
import { setMeasure } from "../tools/measure.js";
import { startCalib } from "../tools/calibrate.js";
import { copySel, getClip, pasteClip } from "../edit/clipboard.js";
import { delSel, dupSel, flipSel, rotSel } from "../edit/actions.js";
import { setMode } from "../base-edit/base-edit.js";
import { readIndex, switchProject } from "../project/project.js";
import { openCompare } from "../project/compare.js";
import { openProjMgr } from "../project/manager.js";
import { baseData, download, safeName, saveFile } from "../io/file.js";
import { showGate } from "./gate.js";
import { openAI } from "./ai.js";

export function chk(id) {
  return $(id).checked;
}
export function toggleChk(id) {
  $(id).click();
}
export function menuItems(name) {
  const has = !!S.BASE,
    sel = selIds().length > 0,
    design = S.mode !== "base";
  const ix = readIndex();
  if (name === "file")
    return [
      { t: "新專案…", f: () => showGate("new") },
      { t: "開啟檔案…", k: KEY + "O", f: () => $("fileIn").click() },
      { t: "儲存檔案", k: KEY + "S", f: saveFile, off: !has },
      "-",
      { h: "切換專案" },
      ...ix.projects
        .slice(0, 8)
        .map(q => ({ t: "📁 " + q.name, c: S.PROJ && q.id === S.PROJ.id, f: () => switchProject(q.id) })),
      { t: "專案管理…", f: openProjMgr },
      "-",
      { t: "匯出 PNG 圖片", f: () => $("btnPNG").click(), off: !has },
      { t: "匯出 SVG（1:50 實際比例）", f: () => $("btnSVG").click(), off: !has },
      { t: "列印…", k: KEY + "P", f: () => $("btnPrint").click(), off: !has },
    ];
  if (name === "edit")
    return [
      { t: "復原", k: KEY + "Z", f: undo, off: !S.undoStack.length },
      { t: "重做", k: "⇧" + KEY + "Z", f: redo, off: !S.redoStack.length },
      "-",
      { t: "剪下", k: KEY + "X", f: () => copySel(true), off: !sel || !design },
      { t: "複製", k: KEY + "C", f: () => copySel(false), off: !sel || !design },
      { t: "貼上", k: KEY + "V", f: () => pasteClip(null), off: !getClip() || !has || !design },
      { t: "再製", k: KEY + "D", f: dupSel, off: !sel || !design },
      { t: "刪除", k: "Delete", f: delSel, off: !sel || !design },
      "-",
      { t: "全選", k: KEY + "A", f: () => setSel(state.items.map(i => i.id)), off: !state.items.length || !design },
      { t: "旋轉 90°", k: "R", f: () => rotSel(90), off: !sel || !design },
      { t: "左右鏡像", k: "F", f: flipSel, off: !sel || !design },
    ];
  if (name === "view")
    return [
      { t: "格線", c: chk("chkGrid"), f: () => toggleChk("chkGrid") },
      { t: "顯示家具尺寸", c: chk("chkSize"), f: () => toggleChk("chkSize") },
      { t: "顯示牆面尺寸標註", c: chk("chkDims"), f: () => toggleChk("chkDims") },
      "-",
      { t: "全圖顯示", f: fit, off: !has },
      { t: "放大", k: "滾輪", f: () => zoomBy(1.25), off: !has },
      { t: "縮小", f: () => zoomBy(0.8), off: !has },
      "-",
      { t: "並排比較所有方案…", f: openCompare, off: !S.PROJ },
    ];
  if (name === "base")
    return [
      {
        t: S.mode === "base" ? "完成底圖編輯" : "編輯底圖",
        c: S.mode === "base",
        f: () => setMode(S.mode === "base" ? "design" : "base"),
        off: !has,
      },
      { t: "底圖設定（名稱、透明度）", f: () => $("btnBase").click(), off: !has },
      "-",
      { t: "更換底圖…", f: () => showGate("replace"), off: !has },
      {
        t: "🤖 AI 產生底圖…",
        f: () => {
          S.gateIntent = has ? "replace" : "new";
          openAI();
        },
      },
      { t: "重新校正圖片比例", f: startCalib, off: !(has && S.BASE.image) },
      {
        t: "匯出底圖檔",
        f: () =>
          download(
            `${safeName()}-底圖.json`,
            new Blob([JSON.stringify(baseData(), null, 1)], { type: "application/json" }),
          ),
        off: !has,
      },
    ];
  if (name === "tools")
    return [
      { t: "量測距離", k: "M", c: S.measureMode, f: () => setMeasure(!S.measureMode), off: !has },
      "-",
      { t: "拖曳時貼齊邊緣", c: chk("chkEdge"), f: () => toggleChk("chkEdge") },
      { t: "吸附格線", c: chk("chkSnap"), f: () => toggleChk("chkSnap") },
      { h: "吸附精度" },
      ...[1, 5, 10].map(v => ({
        t: `${v} cm`,
        c: +$("selSnap").value === v,
        f: () => {
          $("selSnap").value = String(v);
          $("selSnap").dispatchEvent(new Event("change"));
        },
      })),
    ];
  if (name === "help")
    return [
      { t: "📖 使用教學（完整介紹）", k: "↗", f: () => window.open("guide.html", "_blank", "noopener") },
      {
        t: "顯示操作提示",
        f: () => {
          $("tipCard").hidden = false;
          localStorage.removeItem("hl-tip-off");
        },
      },
      "-",
      { t: "關於 House Layout…", f: () => $("aboutModal").classList.add("show") },
      "-",
      {
        t: "GitHub 原始碼",
        k: "↗",
        f: () => window.open("https://github.com/u9951064/house-layout", "_blank", "noopener"),
      },
      {
        t: "回報問題／建議",
        k: "↗",
        f: () => window.open("https://github.com/u9951064/house-layout/issues/new", "_blank", "noopener"),
      },
      { t: "AI 底圖提示詞（PROMPT.md）", k: "↗", f: () => window.open("PROMPT.md", "_blank", "noopener") },
    ];
  return [];
}
export function openMenu(name, btn) {
  const M = $("menuPop"),
    items = menuItems(name);
  M.innerHTML = items
    .map((m, i) =>
      m === "-"
        ? "<hr>"
        : m.h
          ? `<div class="mh">${esc(m.h)}</div>`
          : `<div class="mi${m.off ? " off" : ""}" data-i="${i}"><span class="c">${m.c ? "✓" : ""}</span><span>${esc(m.t)}</span><span class="k">${m.k || ""}</span></div>`,
    )
    .join("");
  const r = btn.getBoundingClientRect();
  M.style.left = r.left + "px";
  M.style.top = r.bottom + 4 + "px";
  M.classList.add("show");
  document.querySelectorAll("#menubar .mb").forEach(b => b.classList.toggle("open", b === btn));
  S.menuOpen = name;
  M.querySelectorAll(".mi[data-i]").forEach(
    d =>
      (d.onclick = () => {
        closeMenu();
        items[+d.dataset.i].f();
      }),
  );
}
export function closeMenu() {
  $("menuPop").classList.remove("show");
  document.querySelectorAll("#menubar .mb").forEach(b => b.classList.remove("open"));
  S.menuOpen = null;
}

export function init() {
  $("aboutClose").onclick = () => $("aboutModal").classList.remove("show");
  $("aboutModal").addEventListener("click", e => {
    if (e.target.id === "aboutModal") $("aboutModal").classList.remove("show");
  });
  document.querySelectorAll("#menubar .mb").forEach(b => {
    b.onclick = e => {
      e.stopPropagation();
      S.menuOpen === b.dataset.menu ? closeMenu() : openMenu(b.dataset.menu, b);
    };
    b.onmouseenter = () => {
      if (S.menuOpen && S.menuOpen !== b.dataset.menu) openMenu(b.dataset.menu, b);
    };
  });
  document.addEventListener("pointerdown", e => {
    if (S.menuOpen && !e.target.closest("#menuPop, #menubar")) closeMenu();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && S.menuOpen) closeMenu();
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "o") {
      e.preventDefault();
      $("fileIn").click();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p" && S.BASE) {
      e.preventDefault();
      $("btnPrint").click();
    }
  });
}
