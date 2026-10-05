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
  view: "plan", // 主畫面檢視：plan 平面圖｜3d｜elev 立面圖｜cab 櫃體工程圖｜sched 數量表（見 ext/registry.js）
  plan: "layout", // 平面圖面別：layout 配置圖｜floor 地坪｜ceiling 天花｜light 燈具迴路｜power 插座弱電｜hvac 空調風管
  tool: null, // 目前的畫布工具（EXT.tools 的 key），null＝一般選取
};
/** 目前方案：物件、下一個 id、設計規格（天花高度、預設材質、牆面裝修…，見 ext/heights.js SPEC_DEFAULTS） */
export const state = { items: [], sel: null, nextId: 1, spec: {} };
export const view = { x: 0, y: 0, s: 1 };
export const opt = { snap: true, step: 1, grid: true, size: true, dims: false, edge: true };
