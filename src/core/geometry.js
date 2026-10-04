// 幾何計算：外框、距離、吸附
import { opt } from "./store.js";

export function itemBox(it) { // 旋轉後的外框（世界座標）
  const a = it.rot * Math.PI / 180, cx = it.x + it.w / 2, cy = it.y + it.d / 2;
  const pts = [[-it.w / 2, -it.d / 2], [it.w / 2, -it.d / 2], [it.w / 2, it.d / 2], [-it.w / 2, it.d / 2]].map(([px, py]) => [cx + px * Math.cos(a) - py * Math.sin(a), cy + px * Math.sin(a) + py * Math.cos(a)]);
  return { x1: Math.min(...pts.map(p => p[0])), y1: Math.min(...pts.map(p => p[1])), x2: Math.max(...pts.map(p => p[0])), y2: Math.max(...pts.map(p => p[1])) };
}
export function unionBox(items) { const bs = items.map(itemBox); return { x1: Math.min(...bs.map(b => b.x1)), y1: Math.min(...bs.map(b => b.y1)), x2: Math.max(...bs.map(b => b.x2)), y2: Math.max(...bs.map(b => b.y2)) }; }
export function snapAxis(edges, targets, tol) { let best = null; for (const e of edges) for (const t of targets) { const d = t - e; if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: t }; } return best; }
export const snapV = v => opt.snap ? Math.round(v / opt.step) * opt.step : Math.round(v * 10) / 10;
export function isAxis(w) { return Math.abs(w[0] - w[2]) < 0.01 || Math.abs(w[1] - w[3]) < 0.01; }
export function wallHz(w) { return Math.abs(w[1] - w[3]) < Math.abs(w[0] - w[2]); }
export function distSeg(p, x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy; let t = l ? ((p.x - x1) * dx + (p.y - y1) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - x1 - t * dx, p.y - y1 - t * dy); }
export function inRect(p, r) { const [x1, y1, x2, y2] = r; return p.x >= Math.min(x1, x2) && p.x <= Math.max(x1, x2) && p.y >= Math.min(y1, y2) && p.y <= Math.max(y1, y2); }
export function inFixture(p, f) { const a = -(f.rot || 0) * Math.PI / 180, cx = f.x + f.w / 2, cy = f.y + f.d / 2, dx = p.x - cx, dy = p.y - cy; const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a); return Math.abs(lx) <= f.w / 2 && Math.abs(ly) <= f.d / 2; }
