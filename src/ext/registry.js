// 擴充註冊表：櫃體、水電、裝修、3D、工程圖等模組透過這裡掛進核心，不必修改核心檔案
// 規格說明見 docs/ARCHITECTURE-3D.md

/**
 * 圖層（layer）：每個元件定義（library def）都有 layer，決定在哪些圖面（plan）顯示
 * furniture 家具｜partition 隔間、門、標示｜cabinet 櫃體｜floor 地坪｜ceiling 天花｜finish 牆面裝修、窗簾
 * light 燈具、開關、燈具迴路｜power 插座、弱電、電箱｜hvac 空調、全熱交換、風管
 */
export const LAYERS = ["furniture", "partition", "cabinet", "floor", "ceiling", "finish", "light", "power", "hvac"];

export const EXT = {
  /** 平面圖例：type → (g, w, d, it) */
  draw2d: {},
  /** 3D 建模：type → (it, ctx) => THREE.Object3D（ctx 見 view3d） */
  build3d: {},
  /** 立面圖：type → (g, it, ctx) 在立面座標畫出正視圖（ctx 見 docs/elevation） */
  elev2d: {},
  /** 屬性面板額外區塊：type → { html(it) → string, bind(it, api) }（api: { commit, rerender, $ }） */
  props: {},
  /** 依條件套用的屬性區塊（例如所有門）：[{ test(it), html(it), bind(it, api) }] */
  propsAny: [],
  /** 不顯示縮放把手的類型（折線、參數化元件） */
  noResize: new Set(),
  /** 不檢查「放在不在範圍區」的類型 */
  noScopeCheck: new Set(),
  /** 畫布工具：name → { cursor?, down(p, e), move(p, e), up(p, e), key(e) → bool, draw(uiLayer, kk), cancel() } */
  tools: {},
  /** 主畫面檢視：[{ id, name, icon, mount(el), unmount?(), refresh?() }]，plan（平面圖）由核心提供 */
  views: [],
  /** 平面圖面別：[{ id, name, show: { layer: "on" | "dim" | "off" } }] */
  plans: [],
  /** 右側面板額外分頁：[{ id, name, html() → string, bind(api) }] */
  ptabs: [],
  /** 選單附加項目：menu 名稱（file/edit/view/base/design/help）→ [() => item | item[]] */
  menus: {},
  /** 每次 renderItems 之後呼叫（例如 3D 檢視需要同步） */
  onChange: [],
  /** 數量估算表區塊：[{ id, name, rows() → [{ group, item, qty, unit, note }] }] */
  schedules: [],
};

export function registerView(v) {
  EXT.views.push(v);
}
export function registerPlan(p) {
  EXT.plans.push(p);
}
export function registerTool(name, tool) {
  EXT.tools[name] = tool;
}
export function registerPTab(tab) {
  EXT.ptabs.push(tab);
}
export function registerMenu(menu, fn) {
  (EXT.menus[menu] ||= []).push(fn);
}
export function registerSchedule(s) {
  EXT.schedules.push(s);
}
export function onChange(fn) {
  EXT.onChange.push(fn);
}
export function emitChange(why) {
  for (const f of EXT.onChange) {
    try {
      f(why);
    } catch (e) {
      console.error(e);
    }
  }
}
