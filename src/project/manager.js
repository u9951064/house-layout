// 專案管理視窗
import { LOCALE, t } from "../core/i18n.js";
import { S, state } from "../core/store.js";
import { $, esc } from "../core/dom.js";
import { drawBase, drawGrid } from "../canvas/base-render.js";
import { renderItems } from "../canvas/items.js";
import { PKEY, autosave, readIndex, renderProjSelect, switchProject, writeIndex } from "./project.js";
import { renderSheets } from "./sheets.js";
import { renderGhost } from "./compare.js";
import { renderProps } from "../ui/props.js";
import { showGate } from "../ui/gate.js";

export function openProjMgr() {
  const ix = readIndex(),
    Lp = $("projList");
  Lp.innerHTML =
    ix.projects
      .slice()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map(
        q => `<div class="projRow"><div><b>📁 ${esc(q.name)}</b>${S.PROJ && q.id === S.PROJ.id ? ` <span class="muted">${t("（目前）")}</span>` : ""}<br><small class="muted">${t("最後修改：")}${q.updatedAt ? new Date(q.updatedAt).toLocaleString(LOCALE) : "-"}</small></div>
    <div class="actions" style="margin:0"><button data-a="open" data-id="${q.id}">${t("開啟")}</button><button data-a="ren" data-id="${q.id}">${t("重新命名")}</button><button data-a="del" data-id="${q.id}" style="color:#d1242f">${t("刪除")}</button></div></div>`,
      )
      .join("") || `<p class="muted">${t("尚無專案")}</p>`;
  Lp.querySelectorAll("button[data-a]").forEach(b => (b.onclick = () => projAction(b.dataset.a, b.dataset.id)));
  $("projModal").classList.add("show");
}
export function projAction(a, id) {
  const ix = readIndex(),
    m = ix.projects.find(q => q.id === id);
  if (!m) return;
  if (a === "open") {
    $("projModal").classList.remove("show");
    switchProject(id);
    return;
  }
  if (a === "ren") {
    const n = prompt(t("專案名稱"), m.name);
    if (n === null || !n.trim()) return;
    m.name = n.trim();
    writeIndex(ix);
    if (S.PROJ && S.PROJ.id === id) {
      S.PROJ.name = m.name;
      S.BASE.name = m.name;
      autosave();
      renderProps();
    } else {
      try {
        const pj = JSON.parse(localStorage.getItem(PKEY(id)));
        pj.name = m.name;
        if (pj.base) pj.base.name = m.name;
        localStorage.setItem(PKEY(id), JSON.stringify(pj));
      } catch (e) {}
    }
  }
  if (a === "del") {
    if (!confirm(t("刪除專案「{name}」？會從這個瀏覽器移除（建議先「儲存檔案」備份）。", { name: m.name }))) return;
    localStorage.removeItem(PKEY(id));
    ix.projects = ix.projects.filter(q => q.id !== id);
    if (S.PROJ && S.PROJ.id === id) {
      S.PROJ = null;
      ix.current = null;
      writeIndex(ix);
      if (ix.projects.length) switchProject(ix.projects[0].id);
      else {
        S.BASE = null;
        state.items = [];
        state.sel = null;
        S.ghostId = null;
        drawGrid();
        drawBase();
        renderItems();
        renderGhost();
        renderSheets();
        renderProps();
        $("projModal").classList.remove("show");
        renderProjSelect();
        showGate("new");
        return;
      }
    } else writeIndex(ix);
  }
  renderProjSelect();
  openProjMgr();
}

export function init() {
  $("btnProj").onclick = openProjMgr;
  $("projClose").onclick = () => $("projModal").classList.remove("show");
  $("projNew").onclick = () => {
    $("projModal").classList.remove("show");
    showGate("new");
  };
}
