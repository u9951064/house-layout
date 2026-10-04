// DOM 與 SVG 小工具、提示訊息

export const NS = "http://www.w3.org/2000/svg";
export function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
export const R = (g, x, y, w, h, c = "s", rx = 0) => el("rect", { x, y, width: Math.max(w, 0.1), height: Math.max(h, 0.1), rx, class: c }, g);
export const L = (g, x1, y1, x2, y2, c = "t") => el("line", { x1, y1, x2, y2, class: c }, g);
export const C = (g, cx, cy, r, c = "s") => el("circle", { cx, cy, r: Math.max(r, 0.1), class: c }, g);
export const PATH = (g, d, c = "t") => el("path", { d, class: c }, g);
export const TXT = (g, x, y, s, c = "") => { const t = el("text", { x, y, class: c }, g); t.textContent = s; return t; };
export const svg = document.getElementById("svg"), vp = document.getElementById("viewport");
export const gridLayer = document.getElementById("gridLayer"), baseLayer = document.getElementById("baseLayer"), itemLayer = document.getElementById("itemLayer"), uiLayer = document.getElementById("uiLayer");
export const $ = id => document.getElementById(id);
export var KEY = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2200); }
