// 鍵盤快捷鍵
import { S, opt, state } from "../core/store.js";
import { $, toast } from "../core/dom.js";
import { commit, redo, undo } from "../core/history.js";
import { renderItems, renderSelection } from "../canvas/items.js";
import { cur, selItems, setSel } from "../canvas/selection.js";
import { setMeasure } from "../tools/measure.js";
import { copySel, pasteClip } from "../edit/clipboard.js";
import { delSel, dupSel, flipSel, rotSel } from "../edit/actions.js";
import { baseKey } from "../base-edit/base-edit.js";
import { saveFile } from "../io/file.js";
import { renderProps } from "./props.js";

export function init() {
  document.addEventListener("keydown", e => {
    if (e.target && e.target.matches && e.target.matches("input, textarea, select")) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
      return;
    }
    if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
      return;
    }
    if (mod && e.key.toLowerCase() === "d") {
      e.preventDefault();
      dupSel();
      return;
    }
    if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveFile();
      return;
    }
    if (
      mod &&
      S.mode !== "base" &&
      S.BASE &&
      ["c", "x", "v"].includes(e.key.toLowerCase()) &&
      !(window.getSelection && String(window.getSelection()))
    ) {
      const k = e.key.toLowerCase();
      if (k === "v") {
        e.preventDefault();
        pasteClip(S.lastMouse);
        return;
      }
      if (cur()) {
        e.preventDefault();
        copySel(k === "x");
        return;
      }
    }
    if (e.key === "Escape") $("sheetMenu").classList.remove("show");
    if (!mod && (e.key === "m" || e.key === "M")) {
      setMeasure(!S.measureMode);
      return;
    }
    if (e.key === "Escape" && S.measureMode) {
      setMeasure(false);
      return;
    }
    if (S.mode === "base") {
      baseKey(e);
      return;
    }
    if (mod && e.key.toLowerCase() === "a" && S.BASE) {
      e.preventDefault();
      setSel(state.items.map(i => i.id));
      toast(`已全選 ${state.items.length} 個物件`);
      return;
    }
    const it = cur();
    if (!it) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      delSel();
    } else if (e.key === "r" || e.key === "R") rotSel(e.shiftKey ? -90 : 90);
    else if (e.key === "f" || e.key === "F") flipSel();
    else if (e.key === "Escape") {
      S.msel = [];
      state.sel = null;
      renderSelection();
      renderProps();
    } else if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const st = (e.shiftKey ? 10 : 1) * (opt.snap ? opt.step : 1);
      for (const m of selItems().filter(i => !i.locked)) {
        if (e.key === "ArrowLeft") m.x -= st;
        if (e.key === "ArrowRight") m.x += st;
        if (e.key === "ArrowUp") m.y -= st;
        if (e.key === "ArrowDown") m.y += st;
      }
      renderItems();
      renderProps(true);
      clearTimeout(S.arrowT);
      S.arrowT = setTimeout(commit, 400);
    }
  });
}
