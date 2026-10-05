// 3D 檢視模組：註冊「3D」檢視與選單；three.js 只在第一次開啟 3D 檢視時以 import() 載入
import { t } from "../core/i18n.js";
import { S } from "../core/store.js";
import { toast } from "../core/dom.js";
import { registerMenu, registerView } from "../ext/registry.js";
import { setView } from "../ext/views.js";
import { buildScene } from "./scene.js";

export { buildItem, makeCtx, placeItem } from "./scene.js";

/**
 * 建立整個場景內容（牆、地板、天花、門窗、所有物件）供其他功能重複使用，例如匯出或縮圖。
 * THREE：three.js 模組；opts 同 buildScene（layers、wallTop、doors、labels、night）。回傳 THREE.Group。
 * 模組的 EXT.build3d(it, ctx) 會收到的 ctx 說明見 scene.js 的 makeCtx。
 */
export function buildSceneGroup(THREE, opts = {}) {
  return buildScene(THREE, opts).group;
}

let viewer = null,
  token = 0,
  ready = null;

async function mount(el) {
  const my = ++token;
  el.innerHTML = `<div class="v3d-loading">${t("正在載入 3D 引擎…")}</div>`;
  ready = (async () => {
    try {
      const mod = await import("./viewer.js");
      if (my !== token) return null;
      if (!S.BASE) {
        el.innerHTML = `<div class="v3d-loading">${t("請先匯入底圖，才能檢視 3D。")}</div>`;
        return null;
      }
      viewer = mod.mountViewer(el);
      return viewer;
    } catch (e) {
      console.warn(e);
      el.innerHTML = `<div class="v3d-loading">${t("無法啟動 3D 檢視（瀏覽器可能不支援 WebGL）")}</div>`;
      return null;
    }
  })();
  return ready;
}
function unmount() {
  token++;
  if (viewer) viewer.destroy();
  viewer = null;
  ready = null;
}

export function register() {
  registerView({
    id: "3d",
    name: t("3D"),
    icon: "🧊",
    mount,
    unmount,
    refresh: () => viewer && viewer.refresh(),
  });
  registerMenu("design", () => [
    { h: t("3D") },
    { t: t("開啟 3D 檢視"), f: () => setView("3d"), off: !S.BASE, c: S.view === "3d" },
    {
      t: t("匯出 3D 圖片"),
      off: !S.BASE,
      f: async () => {
        if (S.view !== "3d") setView("3d");
        const v = await ready;
        if (v) setTimeout(() => v.exportPNG(), 300);
        else toast(t("無法啟動 3D 檢視（瀏覽器可能不支援 WebGL）"));
      },
    },
  ]);
}
export function init() {}
