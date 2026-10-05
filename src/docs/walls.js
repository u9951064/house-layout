// 立面圖用的牆面幾何：每面牆兩個面（face 1／-1），沿牆座標 s、離牆深度 n、所屬房間與立面索引（A/B/C/D）
import { t } from "../core/i18n.js";
import { S } from "../core/store.js";

/**
 * 牆面資訊。觀看者站在 face 那一側、面向牆：
 * r = 觀看者的右手方向（立面圖 x 軸），o = 立面圖 x=0 的平面點，n = 指向觀看者的法向量。
 */
export function faceInfo(i, face) {
  const w = S.BASE.walls[i];
  if (!w) return null;
  const [x1, y1, x2, y2, thk = 12, ops = []] = w;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1,
    ux = (x2 - x1) / len,
    uy = (y2 - y1) / len;
  const n = { x: -uy * face, y: ux * face };
  // 面 1：右手方向 = 牆方向；面 -1：反向，從終點開始
  const r = face === 1 ? { x: ux, y: uy } : { x: -ux, y: -uy };
  const o = face === 1 ? { x: x1, y: y1 } : { x: x2, y: y2 };
  const hz = Math.abs(y1 - y2) < 0.01;
  return { i, face, x1, y1, x2, y2, thk, ops, len, u: { x: ux, y: uy }, n, r, o, hz };
}
/** 平面點 → 立面座標 s（沿牆）與 dn（離牆面的距離，正值在觀看者這側） */
export function project(F, p) {
  const dx = p.x - F.o.x,
    dy = p.y - F.o.y;
  return { s: dx * F.r.x + dy * F.r.y, dn: dx * F.n.x + dy * F.n.y - F.thk / 2 };
}
/** 開口 [a, b] 是絕對座標（水平牆為 x、垂直牆為 y）→ 立面 s 範圍 */
export function opRange(F, op) {
  const pt = v => (F.hz ? { x: v, y: F.y1 } : { x: F.x1, y: v });
  const sa = project(F, pt(op[0])).s,
    sb = project(F, pt(op[1])).s;
  return [Math.min(sa, sb), Math.max(sa, sb)];
}
/** 端點相接的其他牆（取厚度畫剖面） */
export function endWalls(F) {
  const res = { start: null, end: null };
  const near = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) < Math.max(F.thk, 25);
  const end = { x: F.o.x + F.r.x * F.len, y: F.o.y + F.r.y * F.len };
  S.BASE.walls.forEach((w, j) => {
    if (j === F.i) return;
    const a = { x: w[0], y: w[1] },
      b = { x: w[2], y: w[3] };
    // 與這面牆幾乎平行者略過
    const ll = Math.hypot(w[2] - w[0], w[3] - w[1]) || 1;
    if (Math.abs(((w[2] - w[0]) * F.u.x + (w[3] - w[1]) * F.u.y) / ll) > 0.7) return;
    const onSeg = p => {
      const t0 = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (ll * ll);
      if (t0 < -0.05 || t0 > 1.05) return false;
      const qx = a.x + t0 * (b.x - a.x),
        qy = a.y + t0 * (b.y - a.y);
      return Math.hypot(p.x - qx, p.y - qy) < Math.max(F.thk, w[4] || 12);
    };
    if (!res.start && (near(F.o, a) || near(F.o, b) || onSeg(F.o))) res.start = w[4] || 12;
    if (!res.end && (near(end, a) || near(end, b) || onSeg(end))) res.end = w[4] || 12;
  });
  return res;
}
/** 牆面是否在建築外側（法向量方向離開所有牆的外框） */
function isExterior(F) {
  const b = S.BASE.bounds || { x: 0, y: 0, w: 0, h: 0 };
  const m = { x: (F.x1 + F.x2) / 2 + F.n.x * (F.thk / 2 + 30), y: (F.y1 + F.y2) / 2 + F.n.y * (F.thk / 2 + 30) };
  return m.x < b.x + 1 || m.y < b.y + 1 || m.x > b.x + b.w - 1 || m.y > b.y + b.h - 1;
}
/** 所有牆面，依最近的房間名稱分組並給立面索引字母 */
export function allFaces() {
  if (!S.BASE) return [];
  const rooms = S.BASE.rooms || [];
  const list = [];
  S.BASE.walls.forEach((w, i) => {
    for (const face of [1, -1]) {
      const F = faceInfo(i, face);
      if (F.len < 30) continue;
      const m = { x: (F.x1 + F.x2) / 2 + F.n.x * (F.thk / 2 + 40), y: (F.y1 + F.y2) / 2 + F.n.y * (F.thk / 2 + 40) };
      let room = null,
        best = Infinity;
      for (const r of rooms) {
        const d = Math.hypot(r.x - m.x, r.y - m.y);
        if (d < best) {
          best = d;
          room = r.n;
        }
      }
      const ext = isExterior(F);
      list.push({ i, face, F, room: ext ? t("外牆") : room || t("室內"), ext, mid: m });
    }
  });
  // 每個房間依視線方向排序：A 北（看向上方）→ B 東 → C 南 → D 西
  const groups = new Map();
  for (const f of list) (groups.get(f.room) || groups.set(f.room, []).get(f.room)).push(f);
  for (const fs of groups.values()) {
    const ang = f => {
      // 觀看方向 = −n；北（−y）為 0，順時針
      const a = (Math.atan2(-f.F.n.x, f.F.n.y) * 180) / Math.PI;
      return (a + 360) % 360;
    };
    fs.sort((a, b) => ang(a) - ang(b) || a.i - b.i);
    fs.forEach((f, k) => (f.letter = k < 26 ? String.fromCharCode(65 + k) : "Z" + (k - 25)));
  }
  return list;
}
export function faceKey(i, face) {
  return `${i}:${face}`;
}
export function faceTitle(f) {
  return `${f.room} ${t("立面")} ${f.letter}`;
}
