// 共用狀態：目前設計的物件、檢視、選項，以及執行期可變狀態 S

/** 執行期可變狀態（原本的全域 let/var），統一放在 S 底下 */
export const S = {
  BASE: null,
  undoStack: [],
  redoStack: [],
  lastSnap: null,
  quotaWarned: false,
  gridT: undefined,
  msel: [],
  snapGuides: [],
  boxSel: null,
  drag: null,
  measureMode: false,
  measure: null,
  calib: null,
  CLIP: null,
  lastMouse: null,
  pasteN: 0,
  mode: "design",
  btool: "select",
  bsel: null,
  wallDraw: null,
  rectDraw: null,
  hoverPt: null,
  arrowT: undefined,
  lastAIWarn: [],
  PROJ: null,
  gateIntent: "new",
  ghostId: null,
  sheetDrag: null,
  menuOpen: null,
  propTab: "props",
  lastSelKey: "",
};
export const state = { items: [], sel: null, nextId: 1 };
export const view = { x: 0, y: 0, s: 1 };
export const opt = { snap: true, step: 1, grid: true, size: true, dims: false, edge: true };
