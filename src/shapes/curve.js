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

/** 折線總長 */
export const pathLen = pts =>
  pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
/** 風琴門：沿路徑 [0, upto] 產生左右交錯的折痕點（amp 為折深的一半，n 片） */
export function pleatPath(pts, amp, n, upto = pathLen(pts)) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const s = (upto * k) / n,
      seg = subPath(pts, Math.max(0, s - 0.5), Math.min(pathLen(pts), s + 0.5));
    if (seg.length < 2) continue;
    const [a, b] = [seg[0], seg[seg.length - 1]],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
      nx = -(b[1] - a[1]) / L,
      ny = (b[0] - a[0]) / L,
      o = k % 2 ? amp : -amp;
    out.push([(a[0] + b[0]) / 2 + nx * o, (a[1] + b[1]) / 2 + ny * o]);
  }
  return out;
}
/** 門元件的中心路徑（局部座標），給風琴門使用 */
export function doorPath(it) {
  const w = it.w,
    d = it.d;
  if (it.type === "curveSlide") return curveGeom(it).pts;
  if (it.type === "slideDoorArc") {
    const out = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * (Math.PI / 2);
      out.push([(w - 6) * Math.sin(a), d - (d - 6) * Math.cos(a)]);
    }
    return out;
  }
  if (it.type === "foldDoor")
    return [
      [0, -d / 2],
      [w, -d / 2],
    ];
  return [
    [0, d / 2],
    [w, d / 2],
  ];
}
