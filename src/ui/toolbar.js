// 常用工具列與舊控制項同步
import { S, opt } from "../core/store.js";
import { $, toast } from "../core/dom.js";
import { redo, undo } from "../core/history.js";
import { fit } from "../canvas/view.js";
import { drawBase, drawGrid } from "../canvas/base-render.js";
import { renderItems } from "../canvas/items.js";
import { setMeasure } from "../tools/measure.js";
import { showGate } from "./gate.js";

export function syncToolbar() {
  document.querySelectorAll("#toolbar .tog").forEach(b => b.classList.toggle("on", $(b.dataset.chk).checked));
  document.querySelectorAll("#toolbar [data-step]").forEach(b => b.classList.toggle("on", $("selSnap").value === b.dataset.step));
  $("tbMeasure").classList.toggle("on", S.measureMode);
}

export function init() {
  $("btnNew").onclick = () => showGate("new");
  $("btnMeasure").onclick = () => setMeasure(!S.measureMode);
  $("btnUndo").onclick = undo;
  $("btnRedo").onclick = redo;
  $("btnFit").onclick = fit;
  $("chkSnap").onchange = e => opt.snap = e.target.checked;
  $("chkEdge").onchange = e => opt.edge = e.target.checked;
  $("selSnap").onchange = e => { opt.step = +e.target.value; drawGrid(); toast(`吸附精度：${opt.step} cm`); };
  $("chkGrid").onchange = e => { opt.grid = e.target.checked; drawGrid(); };
  $("chkSize").onchange = e => { opt.size = e.target.checked; renderItems(); };
  $("chkDims").onchange = e => { opt.dims = e.target.checked; drawBase(); };
  document.querySelectorAll("#toolbar .tog").forEach(b => b.onclick = () => { $(b.dataset.chk).click(); syncToolbar(); });
  document.querySelectorAll("#toolbar [data-step]").forEach(b => b.onclick = () => { $("selSnap").value = b.dataset.step; $("selSnap").dispatchEvent(new Event("change")); syncToolbar(); });
  $("tbMeasure").onclick = () => { if (S.BASE) setMeasure(!S.measureMode); };
  ["chkEdge", "chkSnap", "chkGrid", "chkSize", "chkDims", "selSnap"].forEach(id => $(id).addEventListener("change", syncToolbar));
  syncToolbar();
}
