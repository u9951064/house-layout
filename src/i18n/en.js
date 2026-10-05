// 英文字典：key 為中文原文（含 {變數}），value 為英文
import ui from "./en/ui.js";
import edit from "./en/edit.js";
import library from "./en/library.js";
import page from "./en/page.js";

export const EN = { ...ui, ...edit, ...library, ...page.text };
export const EN_HTML = page.html;
