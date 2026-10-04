// 復原／重做（快照包含家具與底圖）
import { S, state } from "./store.js";
import { $ } from "./dom.js";
import { computeBounds, drawBase, drawGrid } from "../canvas/base-render.js";
import { renderItems } from "../canvas/items.js";
import { autosave } from "../project/project.js";
import { renderProps } from "../ui/props.js";

export function baseForSnap() {
  if (!S.BASE) return null;
  const { bounds, ...b } = S.BASE;
  return b.image ? { ...b, image: { ...b.image, src: "@img" } } : b;
}
export function snapshot() {
  return JSON.stringify({ items: state.items, nextId: state.nextId, base: baseForSnap() });
}
export function commit() {
  S.undoStack.push(S.lastSnap);
  if (S.undoStack.length > 200) S.undoStack.shift();
  S.redoStack = [];
  S.lastSnap = snapshot();
  autosave();
  updateButtons();
}
export function restore(snap) {
  const o = JSON.parse(snap);
  state.items = o.items;
  state.nextId = o.nextId;
  if (o.base) {
    const src = S.BASE && S.BASE.image && S.BASE.image.src;
    if (o.base.image && o.base.image.src === "@img") o.base.image.src = src;
    S.BASE = o.base;
    S.BASE.bounds = computeBounds(S.BASE);
    S.bsel = null;
    drawGrid();
    drawBase();
  }
  if (!state.items.find(i => i.id === state.sel)) state.sel = null;
  S.lastSnap = snap;
  renderItems();
  renderProps();
  autosave();
  updateButtons();
}
export function undo() {
  if (!S.undoStack.length) return;
  S.redoStack.push(S.lastSnap);
  restore(S.undoStack.pop());
}
export function redo() {
  if (!S.redoStack.length) return;
  S.undoStack.push(S.lastSnap);
  restore(S.redoStack.pop());
}
export function updateButtons() {
  $("btnUndo").disabled = !S.undoStack.length;
  $("btnRedo").disabled = !S.redoStack.length;
}
