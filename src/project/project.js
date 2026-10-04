// 專案：建立、切換、暫存（localStorage）
import { S, state } from "../core/store.js";
import { $, esc, toast } from "../core/dom.js";
import { snapshot, updateButtons } from "../core/history.js";
import { setBase, validBase } from "../model/base.js";
import { setMode } from "../base-edit/base-edit.js";
import { renderSheets } from "./sheets.js";
import { renderGhost } from "./compare.js";

export const STORE_KEY = "house-layout-v1";
export function autosave() {
  if (!S.BASE || !S.PROJ) return;
  try {
    localStorage.setItem(PKEY(S.PROJ.id), JSON.stringify(projectData()));
    const ix = readIndex(),
      meta = { id: S.PROJ.id, name: S.PROJ.name, updatedAt: Date.now() },
      e0 = ix.projects.find(q => q.id === S.PROJ.id);
    if (e0) Object.assign(e0, meta);
    else ix.projects.push(meta);
    ix.current = S.PROJ.id;
    writeIndex(ix);
  } catch (e) {
    if (!S.quotaWarned) {
      S.quotaWarned = true;
      toast("瀏覽器暫存空間不足（底圖圖片較大），請記得用「儲存檔案」存檔");
    }
  }
}
export function projectData() {
  syncDesign();
  return {
    app: "house-layout",
    version: 3,
    savedAt: new Date().toISOString(),
    name: S.PROJ ? S.PROJ.name : (S.BASE && S.BASE.name) || "",
    base: S.BASE,
    designs: S.PROJ
      ? S.PROJ.designs.map(d => ({ id: d.id, name: d.name, items: d.items, nextId: d.nextId }))
      : [{ id: "d1", name: "方案 A", items: state.items, nextId: state.nextId }],
    cur: S.PROJ ? S.PROJ.cur : 0,
    ghost: S.ghostId || null,
  };
}
export const IDX_KEY = "house-layout-index-v2";
export function PKEY(id) {
  return "hl-p-" + id;
}
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
export function curDesign() {
  return S.PROJ.designs[S.PROJ.cur];
}
export function dname() {
  return S.PROJ ? curDesign().name.replace(/[\\/:*?"<>|]/g, "_") : "方案";
}
export function syncDesign() {
  if (!S.PROJ) return;
  const d = curDesign();
  d.items = state.items;
  d.nextId = state.nextId;
}
export function readIndex() {
  try {
    return JSON.parse(localStorage.getItem(IDX_KEY) || "null") || { projects: [], current: null };
  } catch (e) {
    return { projects: [], current: null };
  }
}
export function writeIndex(ix) {
  try {
    localStorage.setItem(IDX_KEY, JSON.stringify(ix));
  } catch (e) {}
}
export function cleanItems(items) {
  return (items || [])
    .filter(i => i && typeof i.type === "string" && [i.x, i.y, i.w, i.d].every(v => isFinite(v)))
    .map(i => ({ ...i, rot: +i.rot || 0, label: i.label != null ? String(i.label) : "" }));
}
export function parseDesigns(o) {
  const src = Array.isArray(o.designs) && o.designs.length ? o.designs : [{ name: "方案 A", items: o.items }];
  return src.map((d, k) => {
    const items = cleanItems(d.items);
    return {
      id: d.id || uid(),
      name: String(d.name || `方案 ${String.fromCharCode(65 + k)}`),
      items,
      nextId: Math.max(d.nextId || 1, 1, ...items.map(i => (i.id || 0) + 1)),
    };
  });
}
export function askName(def) {
  const n = prompt("專案名稱", def || "我的新家");
  return n === null ? null : n.trim() || def || "未命名專案";
}
export function openProject(pj) {
  if (S.PROJ) {
    syncDesign();
    autosave();
  }
  if (typeof S.mode !== "undefined" && S.mode === "base") setMode("design");
  S.PROJ = {
    id: pj.id,
    name: pj.name,
    designs: pj.designs,
    cur: Math.min(Math.max(0, pj.cur || 0), pj.designs.length - 1),
  };
  S.ghostId = pj.designs.some(d => d.id === pj.ghost) ? pj.ghost : null;
  S.lastAIWarn = [];
  const d = curDesign();
  state.items = d.items;
  state.nextId = d.nextId;
  state.sel = null;
  S.BASE = null;
  setBase({ ...pj.base, name: pj.name }, true);
  S.undoStack = [];
  S.redoStack = [];
  S.lastSnap = snapshot();
  updateButtons();
  renderGhost();
  renderSheets();
  renderProjSelect();
}
export function newProject(name, base, designs, cur = 0, ghost = null) {
  if (!validBase(base)) throw new Error("底圖格式不正確");
  openProject({
    id: uid(),
    name,
    base,
    designs: designs || [{ id: uid(), name: "方案 A", items: [], nextId: 1 }],
    cur,
    ghost,
  });
  autosave();
  renderProjSelect();
  toast(`已建立專案「${name}」（${S.PROJ.designs.length} 個方案分頁）`);
}
export function applyGateBase(b, suggested) {
  if (!validBase(b)) throw new Error("底圖格式不正確（需要 walls 牆面資料或 image 圖片）");
  if (S.gateIntent === "replace" && S.BASE) {
    if (
      (state.items.length || (S.BASE.walls || []).length) &&
      !confirm(`更換「${S.PROJ.name}」的底圖？所有方案的家具保留在原座標，可用「復原」還原。`)
    )
      return false;
    S.undoStack.push(S.lastSnap);
    S.redoStack = [];
    setBase({ ...b, name: S.BASE.name }, true);
    S.lastSnap = snapshot();
    updateButtons();
    return true;
  }
  const name = askName(suggested);
  if (name === null) return false;
  newProject(name, b);
  return true;
}
export function switchProject(id) {
  if (S.PROJ && id === S.PROJ.id) return;
  let pj = null;
  try {
    pj = JSON.parse(localStorage.getItem(PKEY(id)) || "null");
  } catch (e) {}
  if (!pj || !validBase(pj.base)) {
    alert("無法讀取這個專案");
    renderProjSelect();
    return;
  }
  openProject({
    id,
    name: pj.name || pj.base.name || "未命名專案",
    base: pj.base,
    designs: parseDesigns(pj),
    cur: pj.cur || 0,
    ghost: pj.ghost,
  });
  autosave();
  toast(`已開啟專案「${S.PROJ.name}」`);
}
export function renderProjSelect() {
  const ix = readIndex(),
    S = $("selProj");
  S.innerHTML = ix.projects.length
    ? ix.projects
        .map(
          q => `<option value="${q.id}" ${S.PROJ && q.id === S.PROJ.id ? "selected" : ""}>📁 ${esc(q.name)}</option>`,
        )
        .join("")
    : `<option value="">（尚無專案）</option>`;
}

export function init() {
  $("selProj").onchange = e => {
    if (e.target.value) switchProject(e.target.value);
  };
}
