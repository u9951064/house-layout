// 進入點：初始化各模組並還原上次的專案
import { S, state } from "./core/store.js";
import { $ } from "./core/dom.js";
import { snapshot, updateButtons } from "./core/history.js";
import { DEFAULTS } from "./shapes/library.js";
import { setBase, validBase } from "./model/base.js";
import { fit } from "./canvas/view.js";
import { renderItems } from "./canvas/items.js";
import { addItem } from "./edit/actions.js";
import {
  PKEY,
  STORE_KEY,
  parseDesigns,
  projectData,
  readIndex,
  renderProjSelect,
  switchProject,
  uid,
  writeIndex,
} from "./project/project.js";
import { addDesign, switchDesign } from "./project/sheets.js";
import { loadData } from "./io/file.js";
import { exportSVGString } from "./io/export.js";
import { buildPalette } from "./ui/palette.js";
import { renderProps } from "./ui/props.js";
import { showGate } from "./ui/gate.js";
import { init as init_project_project } from "./project/project.js";
import { init as init_canvas_view } from "./canvas/view.js";
import { init as init_canvas_interact } from "./canvas/interact.js";
import { init as init_ui_palette } from "./ui/palette.js";
import { init as init_ui_props } from "./ui/props.js";
import { init as init_base_edit_base_edit } from "./base-edit/base-edit.js";
import { init as init_ui_keyboard } from "./ui/keyboard.js";
import { init as init_io_file } from "./io/file.js";
import { init as init_io_export } from "./io/export.js";
import { init as init_ui_toolbar } from "./ui/toolbar.js";
import { init as init_ui_gate } from "./ui/gate.js";
import { init as init_ui_ai } from "./ui/ai.js";
import { init as init_project_sheets } from "./project/sheets.js";
import { init as init_project_compare } from "./project/compare.js";
import { init as init_project_manager } from "./project/manager.js";
import { init as init_ui_menubar } from "./ui/menubar.js";
import { init as init_ui_zoombar } from "./ui/zoombar.js";

S.lastSnap = snapshot();
buildPalette(); // 先建好元件庫，收合狀態（palette init）才套得上

// 初始化各模組（綁定事件）
init_project_project();
init_canvas_view();
init_canvas_interact();
init_ui_palette();
init_ui_props();
init_base_edit_base_edit();
init_ui_keyboard();
init_io_file();
init_io_export();
init_ui_toolbar();
init_ui_gate();
init_ui_ai();
init_project_sheets();
init_project_compare();
init_project_manager();
init_ui_menubar();
init_ui_zoombar();

(function boot() {
  let ix = readIndex();
  if (!ix.projects.length) {
    // 舊版暫存（單一設計）轉成專案
    try {
      const old = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (old && old.base && validBase(old.base)) {
        const id = uid(),
          name = old.base.name || "我的專案";
        localStorage.setItem(PKEY(id), JSON.stringify({ ...old, name, designs: parseDesigns(old), cur: 0 }));
        ix = { projects: [{ id, name, updatedAt: Date.now() }], current: id };
        writeIndex(ix);
      }
    } catch (e) {}
  }
  const id = ix.projects.some(q => q.id === ix.current) ? ix.current : (ix.projects[0] || {}).id;
  if (id) switchProject(id);
})();
renderProjSelect();
if (!S.BASE) showGate("new");
renderItems();
renderProps();
updateButtons();
// 左下角提示卡：第一次出現，關掉後不再顯示（可從「說明」再打開）
if (!localStorage.getItem("hl-tip-off")) $("tipCard").hidden = false;
$("tipClose").onclick = () => {
  $("tipCard").hidden = true;
  localStorage.setItem("hl-tip-off", "1");
};
window.addEventListener("resize", () => {
  if (S.BASE) fit();
});
// 測試用掛勾（e2e 測試會使用）
window.__fp = {
  state,
  addItem,
  DEFAULTS,
  loadData,
  projectData,
  exportSVGString,
  setBase,
  switchDesign,
  addDesign,
  switchProject,
  get base() {
    return S.BASE;
  },
  get proj() {
    return S.PROJ;
  },
};
