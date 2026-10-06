// 英文字典：key 為中文原文（含 {變數}），value 為英文
import ui from "./en/ui.js";
import edit from "./en/edit.js";
import library from "./en/library.js";
import page from "./en/page.js";
import core3d from "./en/core3d.js";
import materials from "./en/materials.js";
import arch from "./en/arch.js";
import cabinet from "./en/cabinet.js";
import mep from "./en/mep.js";
import view3d from "./en/view3d.js";
import docs from "./en/docs.js";
import mcp from "./en/mcp.js";

export const EN = {
  ...ui,
  ...edit,
  ...library,
  ...core3d,
  ...materials,
  ...arch,
  ...cabinet,
  ...mep,
  ...view3d,
  ...docs,
  ...mcp,
  ...page.text,
};
export const EN_HTML = page.html;
