// 組合曲線元件（直線 A ＋ 弧形 ＋ 直線 B）：一個元件，外框由參數自動計算
export const CURVE_TYPES = new Set(["curveSlide", "curveWall", "curveGlass"]);
export const CURVE_KEYS = ["a", "r", "ang", "turn", "b", "t"];

/** 中心線（本地座標，已平移到外框內）、外框尺寸與總長 */
export function curveGeom(it) {
  const a = Math.max(0, +it.a || 0),
    r = Math.max(0, +it.r || 0),
    ang = (Math.max(0, Math.min(180, +it.ang || 0)) * Math.PI) / 180,
    s = it.turn === 1 ? 1 : -1,
    b = Math.max(0, +it.b || 0),
    t = Math.max(1, +it.t || 12);
  const pts = [[0, 0]];
  if (a > 0) pts.push([a, 0]);
  if (r > 0 && ang > 0) {
    const n = Math.max(8, Math.round((ang / Math.PI) * 48));
    for (let i = 1; i <= n; i++) {
      const p = (ang * i) / n;
      pts.push([a + r * Math.sin(p), s * r * (1 - Math.cos(p))]);
    }
  }
  if (b > 0) {
    const [ex, ey] = pts[pts.length - 1],
      A = r > 0 ? ang : 0;
    pts.push([ex + b * Math.cos(A), ey + s * b * Math.sin(A)]);
  }
  const xs = pts.map(p => p[0]),
    ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs) - t / 2,
    y0 = Math.min(...ys) - t / 2;
  const local = pts.map(([x, y]) => [x - x0, y - y0]);
  let len = 0;
  for (let i = 1; i < local.length; i++)
    len += Math.hypot(local[i][0] - local[i - 1][0], local[i][1] - local[i - 1][1]);
  return { pts: local, w: Math.max(...xs) - Math.min(...xs) + t, d: Math.max(...ys) - Math.min(...ys) + t, len, t };
}

/** 依參數更新外框寬深 */
export function applyCurve(it) {
  const g = curveGeom(it);
  it.w = Math.round(g.w * 10) / 10;
  it.d = Math.round(g.d * 10) / 10;
  return it;
}

/** 取中心線上 [s0, s1]（長度）的一段，並沿法線偏移 off */
export function subPath(pts, s0, s1, off = 0) {
  const out = [];
  let acc = 0;
  const push = (x, y, nx, ny) => out.push([x + nx * off, y + ny * off]);
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1],
      [x2, y2] = pts[i],
      L = Math.hypot(x2 - x1, y2 - y1);
    if (!L) continue;
    const nx = -(y2 - y1) / L,
      ny = (x2 - x1) / L;
    const a = Math.max(s0, acc),
      b = Math.min(s1, acc + L);
    if (b > a) {
      if (!out.length) push(x1 + ((x2 - x1) * (a - acc)) / L, y1 + ((y2 - y1) * (a - acc)) / L, nx, ny);
      push(x1 + ((x2 - x1) * (b - acc)) / L, y1 + ((y2 - y1) * (b - acc)) / L, nx, ny);
    }
    acc += L;
  }
  return out;
}

export const toPath = pts => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");
