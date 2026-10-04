// 匯出 PNG／SVG／列印
import { S, opt, state } from "../core/store.js";
import { $, NS, svg, toast } from "../core/dom.js";
import { fit } from "../canvas/view.js";
import { renderSelection } from "../canvas/items.js";
import { curDesign, dname } from "../project/project.js";
import { download, safeName, saveFile, stamp } from "./file.js";

export function exportSVGString(scale = 1, label = S.PROJ ? curDesign().name : "") {
  if (!S.BASE) return ""; const b = S.BASE.bounds, clone = svg.cloneNode(true);
  clone.querySelector("#uiLayer").innerHTML = ""; clone.querySelector("#ghostLayer").innerHTML = ""; clone.querySelector("#viewport").removeAttribute("transform");
  if (!opt.grid) clone.querySelector("#gridLayer").innerHTML = "";
  clone.setAttribute("viewBox", `${b.x} ${b.y - 40} ${b.w} ${b.h + 40}`); clone.setAttribute("width", b.w * scale); clone.setAttribute("height", (b.h + 40) * scale);
  const style = document.createElementNS(NS, "style"); style.textContent = [...document.styleSheets].flatMap(sh => { try { return [...sh.cssRules]; } catch (e) { return []; } }).filter(r => /^\.(wall|win|door|base|hatch|oos|room|dim|item|gridline)/.test(r.selectorText || "") || /^\.item/.test(r.selectorText || "")).map(r => r.cssText).join("\n").replace(/var\(--line\)/g, "#222").replace(/var\(--danger\)/g, "#d1242f") + "\ntext{font-family:-apple-system,'PingFang TC','Noto Sans TC','Microsoft JhengHei',sans-serif}";
  clone.insertBefore(style, clone.firstChild);
  const bg = document.createElementNS(NS, "rect"); bg.setAttribute("x", b.x); bg.setAttribute("y", b.y - 40); bg.setAttribute("width", b.w); bg.setAttribute("height", b.h + 40); bg.setAttribute("fill", "#fff");
  clone.insertBefore(bg, clone.querySelector("#viewport"));
  const title = document.createElementNS(NS, "text"); title.setAttribute("x", b.x + 20); title.setAttribute("y", b.y - 10); title.setAttribute("font-size", "22"); title.setAttribute("font-weight", "600"); title.textContent = `${S.BASE.name}${label ? "｜" + label : ""}　平面配置圖（${new Date().toLocaleDateString("zh-TW")}）`;
  clone.appendChild(title);
  return new XMLSerializer().serializeToString(clone);
}

export function init() {
  $("btnSVG").onclick = () => {
    if (!S.BASE) return; const b = S.BASE.bounds; let s = exportSVGString();
    s = s.replace(/ width="[^"]*" height="[^"]*"/, ` width="${(b.w / 5).toFixed(1)}mm" height="${((b.h + 40) / 5).toFixed(1)}mm"`);   // 1:50
    download(`${safeName()}-${dname()}-1比50-${stamp()}.svg`, new Blob([s], { type: "image/svg+xml" }));
    toast("SVG 為 1:50 實際尺寸，列印時選 100%");
  };
  $("btnPNG").onclick = () => {
    if (!S.BASE) return; const s = exportSVGString(2), img = new Image(), b = S.BASE.bounds;
    img.onload = () => { const c = document.createElement("canvas"); c.width = b.w * 2; c.height = (b.h + 40) * 2; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0); c.toBlob(bl => download(`${safeName()}-${dname()}-${stamp()}.png`, bl)); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
  };
  $("btnPrint").onclick = () => { state.sel = null; renderSelection(); fit(); setTimeout(() => window.print(), 100); };
  $("btnSave").onclick = saveFile;
  $("selExport").onchange = e => { const id = e.target.value; e.target.value = ""; if (id) $(id).click(); };
}
