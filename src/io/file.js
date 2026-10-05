// 專案檔的儲存與開啟
import { t } from "../core/i18n.js";
import { S } from "../core/store.js";
import { $, toast } from "../core/dom.js";
import { validBase } from "../model/base.js";
import { applyGateBase, askName, newProject, parseDesigns, projectData, syncDesign } from "../project/project.js";
import { switchDesign } from "../project/sheets.js";

export function baseData() {
  const { bounds, ...b } = S.BASE;
  return { ...b, app: "house-layout-base", version: 1, unit: "cm" };
}
export const safeName = () => (S.BASE && S.BASE.name ? S.BASE.name : t("平面設計")).replace(/[\\/:*?"<>|]/g, "_");
export function download(name, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function stamp() {
  const d = new Date(),
    p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
export function saveFile() {
  if (!S.BASE) return;
  download(
    `${safeName()}-${t("專案")}-${stamp()}.json`,
    new Blob([JSON.stringify(projectData(), null, 1)], { type: "application/json" }),
  );
  toast(t("已存成一個專案檔（底圖＋{n} 個方案分頁）", { n: S.PROJ ? S.PROJ.designs.length : 1 }));
}
export function loadData(o, fname) {
  if (!o || typeof o !== "object") throw new Error(t("檔案格式不正確"));
  const isProject = Array.isArray(o.items) || Array.isArray(o.designs);
  if (!isProject) {
    // 純底圖檔
    if (!validBase(o)) throw new Error(t("底圖格式不正確（需要 walls 牆面資料或 image 圖片）"));
    applyGateBase(o, o.name || fname);
    return;
  }
  const designs = parseDesigns(o);
  if (!o.base || !validBase(o.base)) {
    // 舊版沒有底圖的專案檔：加到目前專案成為新分頁
    if (!S.BASE || !S.PROJ) throw new Error(t("這個檔案沒有包含底圖，請先建立專案並匯入底圖"));
    syncDesign();
    designs.forEach(d => S.PROJ.designs.push(d));
    switchDesign(S.PROJ.designs.length - 1);
    toast(t("已把 {n} 個方案加入目前專案", { n: designs.length }));
    return;
  }
  const name = askName(o.name || o.base.name || fname);
  if (name === null) return;
  newProject(name, o.base, designs, o.cur || 0, o.ghost || null);
}
export function openFile(file) {
  const rd = new FileReader();
  rd.onload = () => {
    try {
      loadData(JSON.parse(rd.result), file.name.replace(/\.json$/i, ""));
    } catch (err) {
      alert(t("無法開啟：") + err.message);
    }
  };
  rd.readAsText(file);
}

export function init() {
  $("fileIn").addEventListener("change", e => {
    S.gateIntent = "new";
    if (e.target.files[0]) openFile(e.target.files[0]);
    e.target.value = "";
  });
  document.addEventListener("dragover", e => {
    if ([...e.dataTransfer.types].includes("Files")) e.preventDefault();
  });
  document.addEventListener("drop", e => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && /\.json$/i.test(f.name)) {
      e.preventDefault();
      S.gateIntent = "new";
      openFile(f);
    }
  });
}
