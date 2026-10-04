// 方案分頁（Excel 工作表式）
import { S, state } from "../core/store.js";
import { $, esc, toast } from "../core/dom.js";
import { snapshot, updateButtons } from "../core/history.js";
import { renderItems } from "../canvas/items.js";
import { autosave, curDesign, syncDesign, uid } from "./project.js";
import { openCompare, renderGhost } from "./compare.js";
import { renderProps } from "../ui/props.js";

export function switchDesign(k) {
  if (!S.PROJ || k < 0 || k >= S.PROJ.designs.length) return;
  if (k !== S.PROJ.cur) { syncDesign(); S.PROJ.cur = k; }
  const d = curDesign(); state.items = d.items; state.nextId = d.nextId; state.sel = null;
  if (S.ghostId === d.id) S.ghostId = null;
  S.undoStack = []; S.redoStack = []; S.lastSnap = snapshot();
  renderItems(); renderGhost(); renderProps(); updateButtons(); autosave();
}
export function nextName() { const used = new Set(S.PROJ.designs.map(d => d.name)); for (let i = 0; i < 52; i++) { const n = `方案 ${i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(65 + i - 26) + "2"}`; if (!used.has(n)) return n; } return `方案 ${S.PROJ.designs.length + 1}`; }
export function addDesign(copyIdx) {
  syncDesign();
  const src = copyIdx != null ? S.PROJ.designs[copyIdx] : null;
  const name = prompt("新方案名稱", src ? `${src.name} 複本` : nextName()); if (name === null) return;
  const d = { id: uid(), name: name.trim() || nextName(), items: src ? JSON.parse(JSON.stringify(src.items)) : [], nextId: src ? src.nextId : 1 };
  S.PROJ.designs.splice(copyIdx != null ? copyIdx + 1 : S.PROJ.designs.length, 0, d);
  switchDesign(S.PROJ.designs.indexOf(d)); toast(src ? `已複製成「${d.name}」` : `已新增「${d.name}」`);
}
export function renameDesign(k) { const d = S.PROJ.designs[k], n = prompt("方案名稱", d.name); if (n === null || !n.trim()) return; d.name = n.trim(); renderSheets(); autosave(); }
export function deleteDesign(k) {
  if (S.PROJ.designs.length <= 1) { toast("至少要保留一個方案"); return; }
  const d = S.PROJ.designs[k]; if (!confirm(`刪除方案「${d.name}」（${(k === S.PROJ.cur ? state.items : d.items).length} 個物件）？`)) return;
  syncDesign(); S.PROJ.designs.splice(k, 1); if (S.ghostId === d.id) S.ghostId = null;
  const nk = k < S.PROJ.cur ? S.PROJ.cur - 1 : Math.min(S.PROJ.cur, S.PROJ.designs.length - 1); S.PROJ.cur = -1; S.PROJ.cur = nk;
  const nd = curDesign(); state.items = nd.items; state.nextId = nd.nextId; switchDesign(nk);
}
export function moveDesign(k, dir) {
  const j = k + dir; if (j < 0 || j >= S.PROJ.designs.length) return; syncDesign();
  const cid = curDesign().id; [S.PROJ.designs[k], S.PROJ.designs[j]] = [S.PROJ.designs[j], S.PROJ.designs[k]];
  S.PROJ.cur = S.PROJ.designs.findIndex(d => d.id === cid); renderSheets(); autosave();
}
export function moveDesignTo(from, to) {   // to：插入位置（0…n），以移動前的索引計
  if (to === from || to === from + 1) return;
  syncDesign(); const cid = curDesign().id, [d] = S.PROJ.designs.splice(from, 1);
  S.PROJ.designs.splice(to > from ? to - 1 : to, 0, d);
  S.PROJ.cur = S.PROJ.designs.findIndex(x => x.id === cid); renderSheets(); autosave(); toast(`已移動「${d.name}」`);
}
export function copyDesignTo(from, to) {
  syncDesign(); const src = S.PROJ.designs[from], used = new Set(S.PROJ.designs.map(d => d.name));
  let n = 2, name = `${src.name} (${n})`; while (used.has(name)) name = `${src.name} (${++n})`;
  const d = { id: uid(), name, items: JSON.parse(JSON.stringify(from === S.PROJ.cur ? state.items : src.items)), nextId: src.nextId };
  S.PROJ.designs.splice(to, 0, d); switchDesign(S.PROJ.designs.indexOf(d)); toast(`已複製成「${name}」`);
}
export function renderSheets() {
  const T = $("sheets"); if (!S.PROJ) { T.innerHTML = ""; return; }
  T.innerHTML = S.PROJ.designs.map((d, k) => `<button class="sh${k === S.PROJ.cur ? " on" : ""}${d.id === S.ghostId ? " ghost" : ""}" data-k="${k}" draggable="true" title="點選切換｜雙擊重新命名｜拖曳排序（按住 ⌥／Ctrl 拖曳＝複製）｜右鍵更多">${esc(d.name)} <small>${(k === S.PROJ.cur ? state.items : d.items).length}</small></button>`).join("")
    + `<button class="sh add" id="shAdd" title="新增空白方案">＋</button><span class="grow"></span>
    <span class="ctl">疊圖<select id="selGhost" title="把另一個方案以紅色半透明疊在目前畫布上"><option value="">（無）</option>${S.PROJ.designs.map((d, k) => k === S.PROJ.cur ? "" : `<option value="${d.id}" ${d.id === S.ghostId ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select>
    <button id="shCmp" title="並排比較所有方案">並排比較</button></span>`;
  T.querySelectorAll(".sh[data-k]").forEach(b => {
    const k = +b.dataset.k;
    b.onclick = () => switchDesign(k); b.ondblclick = () => renameDesign(k);
    b.oncontextmenu = e => { e.preventDefault(); sheetMenu(k, e.clientX, e.clientY); };
  });
  $("shAdd").onclick = () => addDesign(null);
  const tabs = [...T.querySelectorAll(".sh[data-k]")], clear = () => tabs.forEach(t => t.classList.remove("dropL", "dropR"));
  tabs.forEach(b => {
    const k = +b.dataset.k;
    b.addEventListener("dragstart", e => { S.sheetDrag = k; e.dataTransfer.setData("text/x-sheet", String(k)); e.dataTransfer.effectAllowed = "copyMove"; b.classList.add("dragging"); });
    b.addEventListener("dragend", () => { S.sheetDrag = null; b.classList.remove("dragging"); clear(); });
    b.addEventListener("dragover", e => {
      if (S.sheetDrag == null) return; e.preventDefault();
      const copy = e.altKey || e.ctrlKey || e.metaKey; e.dataTransfer.dropEffect = copy ? "copy" : "move";
      const r = b.getBoundingClientRect(), left = e.clientX < r.left + r.width / 2; clear(); b.classList.add(left ? "dropL" : "dropR");
    });
    b.addEventListener("dragleave", () => b.classList.remove("dropL", "dropR"));
    b.addEventListener("drop", e => {
      if (S.sheetDrag == null) return; e.preventDefault();
      const r = b.getBoundingClientRect(), to = e.clientX < r.left + r.width / 2 ? k : k + 1, from = S.sheetDrag; S.sheetDrag = null; clear();
      if (e.altKey || e.ctrlKey || e.metaKey) copyDesignTo(from, to); else moveDesignTo(from, to);
    });
  });
  $("selGhost").onchange = e => { S.ghostId = e.target.value || null; renderGhost(); renderSheets(); autosave(); };
  $("shCmp").onclick = openCompare;
}
export function sheetMenu(k, x, y) {
  const M = $("sheetMenu"), n = S.PROJ.designs.length;
  M.innerHTML = `<div data-a="ren">重新命名</div><div data-a="dup">複製方案</div><div data-a="new">新增空白方案</div><hr>
    <div data-a="left" ${k === 0 ? 'style="opacity:.4"' : ""}>往左移（也可直接拖曳分頁）</div><div data-a="right" ${k === n - 1 ? 'style="opacity:.4"' : ""}>往右移</div>
    <div data-a="ghost">${S.PROJ.designs[k].id === S.ghostId ? "取消疊圖" : "疊在目前畫布上比較"}</div><hr><div data-a="del" class="danger">刪除方案</div>`;
  M.style.left = x + "px"; M.style.top = Math.max(8, y - 250) + "px"; M.classList.add("show");
  M.querySelectorAll("div[data-a]").forEach(it => it.onclick = () => {
    M.classList.remove("show"); const a = it.dataset.a;
    if (a === "ren") renameDesign(k); if (a === "dup") copyDesignTo(k, k + 1); if (a === "new") addDesign(null);
    if (a === "left") moveDesign(k, -1); if (a === "right") moveDesign(k, 1); if (a === "del") deleteDesign(k);
    if (a === "ghost") { if (k === S.PROJ.cur) { toast("不能疊目前的方案"); return; } S.ghostId = S.PROJ.designs[k].id === S.ghostId ? null : S.PROJ.designs[k].id; renderGhost(); renderSheets(); autosave(); }
  });
}

export function init() {
  document.addEventListener("pointerdown", e => { if (!e.target.closest || !e.target.closest("#sheetMenu")) $("sheetMenu").classList.remove("show"); });
}
