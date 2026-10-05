// 程序化材質紋理：以 canvas 繪製可無縫拼接的紋理（固定亂數種子，不需外部圖片）
// 畫布邊長 px 代表材質的 size（cm），所有圖案的週期都整除 size，貼圖重複時不會有接縫

/** 由字串產生固定的亂數產生器 */
export function rng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function hex2rgb(c) {
  const rgb = /^rgba?\(([^)]+)\)/.exec(String(c));
  if (rgb)
    return rgb[1]
      .split(",")
      .slice(0, 3)
      .map(v => +v || 0);
  let s = String(c || "#cccccc").replace("#", "");
  if (s.length === 3) s = [...s].map(x => x + x).join("");
  const n = parseInt(s, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** 調整明度：amt > 0 變亮、< 0 變暗（-1～1） */
export function shade(c, amt, alpha = 1) {
  const [r, g, b] = hex2rgb(c).map(v => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)));
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}
function luminance(c) {
  const [r, g, b] = hex2rgb(c);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** 可拼接的值雜訊（週期 period 格） */
function periodicNoise(rand, period) {
  const grid = Array.from({ length: period * period }, rand);
  const at = (i, j) => grid[(((j % period) + period) % period) * period + (((i % period) + period) % period)];
  const sm = x => x * x * (3 - 2 * x);
  return (u, v) => {
    const x = u * period,
      y = v * period,
      i = Math.floor(x),
      j = Math.floor(y),
      fx = sm(x - i),
      fy = sm(y - j);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * fx,
      b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fx;
    return a + (b - a) * fy;
  };
}
/** 多層雜訊（0～1），u、v 為 0～1 的紋理座標 */
function fbm(rand, base = 4, oct = 4) {
  const ns = Array.from({ length: oct }, (_, k) => periodicNoise(rand, base << k));
  return (u, v) => {
    let s = 0,
      w = 0.5,
      tw = 0;
    for (const n of ns) {
      s += n(u, v) * w;
      tw += w;
      w *= 0.5;
    }
    return s / tw;
  };
}
/** 以雜訊逐像素調整明度 */
function noiseLayer(ctx, S, rand, strength, base = 4, oct = 4, streak = 0) {
  const img = ctx.getImageData(0, 0, S, S),
    d = img.data,
    n = fbm(rand, base, oct);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const v = (n(x / S, streak ? (y / S) * 0.15 + n(x / S, y / S) * 0.05 : y / S) - 0.5) * strength * 255;
      const i = (y * S + x) * 4;
      d[i] += v;
      d[i + 1] += v;
      d[i + 2] += v;
    }
  ctx.putImageData(img, 0, 0);
}
/** 以 (±S) 平移重複繪製，讓跨越邊界的圖形也能無縫 */
function wrapDraw(S, fn) {
  for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) fn(ox, oy);
}

/** 木紋：沿長邊方向的細直紋（帶輕微起伏與色帶），可夾帶小節眼；長邊為垂直時自動轉向 */
function grain(ctx, x0, y0, w, h, color, rand, density = 1) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();
  if (h > w * 1.2) {
    // 直向木片：轉 90° 後以相同方式畫
    ctx.translate(x0 + w, y0);
    ctx.rotate(Math.PI / 2);
    [w, h] = [h, w];
    x0 = 0;
    y0 = 0;
  }
  // 色帶（早材／晚材）
  const bands = Math.max(2, Math.round(h / 6));
  for (let k = 0; k < bands; k++) {
    ctx.fillStyle = shade(color, (rand() - 0.5) * 0.1, 0.3);
    ctx.fillRect(x0, y0 + (k / bands) * h, w, h / bands + 0.5);
  }
  const lines = Math.max(5, Math.round((h / 2.2) * density));
  const ph = rand() * 10,
    amp = Math.min(h * 0.04, 2.2),
    cyc = 1 + Math.floor(rand() * 2);
  for (let k = 0; k < lines; k++) {
    const yy = y0 + (k + rand() * 0.8) * (h / lines);
    ctx.strokeStyle = shade(color, -0.15 - rand() * 0.18, 0.1 + rand() * 0.16);
    ctx.lineWidth = 0.3 + rand() * 0.7;
    ctx.beginPath();
    const kph = ph + rand() * 2;
    for (let x = x0; x <= x0 + w + 4; x += 4) {
      const y = yy + Math.sin(((x - x0) / w) * Math.PI * 2 * cyc + kph) * amp + Math.sin((x - x0) * 0.09 + k) * 0.4;
      x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  if (rand() < 0.18) {
    const kx = x0 + rand() * w,
      ky = y0 + h * (0.25 + rand() * 0.5),
      kr = Math.min(h * 0.08, 4);
    ctx.fillStyle = shade(color, -0.35, 0.35);
    ctx.beginPath();
    ctx.ellipse(kx, ky, kr * 2.2, kr, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const PAINTERS = {
  plain(ctx, S, m, rand) {
    ctx.fillStyle = m.color;
    ctx.fillRect(0, 0, S, S);
    noiseLayer(ctx, S, rand, 0.035, 8, 3);
  },
  wood(ctx, S, m, rand) {
    ctx.fillStyle = m.color;
    ctx.fillRect(0, 0, S, S);
    noiseLayer(ctx, S, rand, 0.06, 4, 3, 1);
    // 木皮：直紋為主（沿 x）
    grain(ctx, 0, 0, S, S, m.color, rand, 2.2);
  },
  plank(ctx, S, m, rand) {
    const pw = Math.max(2, ((m.pw || 19) / m.size) * S);
    const rows = Math.max(1, Math.round(S / pw)),
      rh = S / rows;
    ctx.fillStyle = m.color;
    ctx.fillRect(0, 0, S, S);
    for (let r = 0; r < rows; r++) {
      // 每列錯縫，片長 = 整張寬（一片接一片）或一半
      const off = ((r * 0.37) % 1) * S,
        n = rand() < 0.5 ? 1 : 2,
        len = S / n;
      for (let k = 0; k < n; k++) {
        const x0 = (off + k * len) % S,
          col = shade(m.color, (rand() - 0.5) * 0.16),
          key = `${m.id}p${r},${k}`;
        for (const dx of [0, -S]) {
          const xx = x0 + dx;
          if (xx + len < 0 || xx > S) continue;
          ctx.fillStyle = col;
          ctx.fillRect(xx, r * rh, len, rh);
          grain(ctx, xx, r * rh, len, rh, col, rng(key), 1);
          ctx.fillStyle = shade(m.color, -0.45, 0.55);
          ctx.fillRect(xx, r * rh, 1.2, rh);
        }
      }
      ctx.fillStyle = shade(m.color, -0.45, 0.6);
      ctx.fillRect(0, r * rh, S, 1.2);
    }
  },
  herringbone(ctx, S, m, rand) {
    // 軸向人字拼：片長 L = 4W，週期 2L = S
    const W = S / 8,
      L = 4 * W;
    ctx.fillStyle = shade(m.color, -0.4);
    ctx.fillRect(0, 0, S, S);
    const plankAt = (x, y, w, h, key) => {
      const col = shade(m.color, (rng(key)() - 0.5) * 0.18);
      wrapDraw(S, (ox, oy) => {
        const xx = x + ox,
          yy = y + oy;
        if (xx > S || yy > S || xx + w < 0 || yy + h < 0) return;
        ctx.fillStyle = col;
        ctx.fillRect(xx + 0.6, yy + 0.6, w - 1.2, h - 1.2);
        grain(ctx, xx + 0.6, yy + 0.6, w - 1.2, h - 1.2, col, rng(key + "g"), 0.8);
      });
    };
    for (let a = -8; a <= 8; a++)
      for (let b = -2; b <= 2; b++) {
        const ox = a * W + b * L,
          oy = a * W - b * L;
        // 只保留一個週期內的代表（其餘由 wrapDraw 補）
        const px = ((ox % S) + S) % S,
          py = ((oy % S) + S) % S;
        if (Math.abs(px - ox) > 1e-6 || Math.abs(py - oy) > 1e-6) continue;
        plankAt(ox, oy, L, W, `${m.id}h${a},${b}`);
        plankAt(ox, oy + W, W, L, `${m.id}v${a},${b}`);
      }
  },
  chevron(ctx, S, m, rand) {
    // 魚骨拼：每欄平行四邊形，左右欄斜向相反
    const cols = 4,
      cw = S / cols,
      ph = S / 6;
    ctx.fillStyle = shade(m.color, -0.4);
    ctx.fillRect(0, 0, S, S);
    for (let c = 0; c < cols; c++) {
      const dir = c % 2 ? 1 : -1;
      for (let r = -2; r < 8; r++) {
        const y = r * ph,
          x = c * cw,
          col = shade(m.color, (rand() - 0.5) * 0.18);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x + 0.6, y + (dir < 0 ? cw : 0));
        ctx.lineTo(x + cw - 0.6, y + (dir < 0 ? 0 : cw));
        ctx.lineTo(x + cw - 0.6, y + (dir < 0 ? 0 : cw) + ph - 1.2);
        ctx.lineTo(x + 0.6, y + (dir < 0 ? cw : 0) + ph - 1.2);
        ctx.closePath();
        ctx.fill();
      }
    }
  },
  tile(ctx, S, m, rand) {
    const tw = ((m.tw || m.size / 2) / m.size) * S,
      th = ((m.th || m.tw || m.size / 2) / m.size) * S,
      gw = Math.max(1, S / 300);
    const dark = luminance(m.color) > 0.5;
    ctx.fillStyle = m.grout || shade(m.color, dark ? -0.12 : 0.15);
    ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S - 0.5; y += th)
      for (let x = 0; x < S - 0.5; x += tw) {
        ctx.fillStyle = shade(m.color, (rand() - 0.5) * 0.05);
        ctx.fillRect(x + gw / 2, y + gw / 2, tw - gw, th - gw);
      }
    noiseLayer(ctx, S, rand, 0.04 * (m.noise || 0.6), 8, 4);
    if (m.rough < 0.3) {
      // 拋光磚：淡淡的石紋
      PAINTERS.marble(ctx, S, { ...m, vein: shade(m.color, -0.25) }, rand, 0.35);
      ctx.fillStyle = m.grout || shade(m.color, dark ? -0.12 : 0.15);
      for (let y = 0; y < S - 0.5; y += th) ctx.fillRect(0, y - gw / 2, S, gw);
      for (let x = 0; x < S - 0.5; x += tw) ctx.fillRect(x - gw / 2, 0, gw, S);
    }
  },
  hex(ctx, S, m, rand) {
    // 尖頂六角形：兩欄、兩組列為一個週期（以水平、垂直不同比例壓縮）
    ctx.fillStyle = m.grout || shade(m.color, -0.15);
    ctx.fillRect(0, 0, S, S);
    // 7 欄 × 8 列幾乎是正六角形（誤差約 1%），且可無縫拼接
    const NC = 7,
      NR = 8,
      cw = S / NC,
      rh = S / NR,
      rx = cw / Math.sqrt(3),
      ry = rh / 1.5;
    wrapDraw(S, (ox, oy) => {
      for (let r = 0; r < NR; r++)
        for (let c = 0; c < NC; c++) {
          const cx = ox + c * cw + (r % 2 ? cw / 2 : 0) + cw / 2,
            cy = oy + r * rh + rh / 2;
          ctx.fillStyle = shade(m.color, (rand() - 0.5) * 0.06);
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = Math.PI / 6 + (k * Math.PI) / 3;
            ctx.lineTo(cx + Math.cos(a) * rx * 0.965, cy + Math.sin(a) * ry * 0.965);
          }
          ctx.closePath();
          ctx.fill();
        }
    });
    if (m.id && m.id.includes("terrazzo")) PAINTERS.terrazzo(ctx, S, { ...m, fine: 1, overlay: 1 }, rand);
  },
  mosaic(ctx, S, m, rand) {
    const n = 12,
      s = S / n;
    ctx.fillStyle = "#f2f2ee";
    ctx.fillRect(0, 0, S, S);
    const pal = [m.color, shade(m.color, 0.35), shade(m.color, -0.2), "#f4f4f1", shade(m.color, 0.6)];
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = pal[Math.floor(rand() * pal.length)];
        ctx.fillRect(x * s + s * 0.06, y * s + s * 0.06, s * 0.88, s * 0.88);
      }
  },
  marble(ctx, S, m, rand, overlay) {
    if (!overlay) {
      ctx.fillStyle = m.color;
      ctx.fillRect(0, 0, S, S);
      noiseLayer(ctx, S, rand, 0.08, 3, 5);
    }
    const vein = m.vein || shade(m.color, -0.4);
    for (let v = 0; v < (overlay ? 4 : 7); v++) {
      let x = rand() * S,
        y = rand() * S,
        a = rand() * Math.PI * 2;
      const pts = [[x, y]];
      for (let k = 0; k < 60; k++) {
        a += (rand() - 0.5) * 0.7;
        x += Math.cos(a) * S * 0.025;
        y += Math.sin(a) * S * 0.025;
        pts.push([x, y]);
      }
      const width = (v < 2 ? 2.4 : 0.9) * (S / 256),
        alpha = (overlay || 1) * (0.25 + rand() * 0.45) * (v < 2 ? 1 : 0.7);
      wrapDraw(S, (ox, oy) => {
        ctx.strokeStyle = vein;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = width;
        ctx.beginPath();
        pts.forEach(([px, py], i) => (i ? ctx.lineTo(px + ox, py + oy) : ctx.moveTo(px + ox, py + oy)));
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }
  },
  concrete(ctx, S, m, rand) {
    ctx.fillStyle = m.color;
    ctx.fillRect(0, 0, S, S);
    noiseLayer(ctx, S, rand, m.fine ? 0.08 : 0.16, m.fine ? 16 : 4, 5, m.streak ? 1 : 0);
    // 細小氣孔
    for (let k = 0; k < S * 0.6; k++) {
      ctx.fillStyle = shade(m.color, -0.3, 0.35);
      ctx.fillRect(rand() * S, rand() * S, 1, 1);
    }
  },
  terrazzo(ctx, S, m, rand) {
    if (!m.overlay) {
      ctx.fillStyle = m.color;
      ctx.fillRect(0, 0, S, S);
      noiseLayer(ctx, S, rand, 0.04, 8, 3);
    }
    const pal = ["#6b6b6b", "#ffffff", "#a8a29a", shade(m.color, -0.35), "#c9b9a0", "#2f2f2f"];
    const n = m.fine ? S * 1.2 : S * 0.25,
      rmax = (m.fine ? 1.6 : 6) * (S / 256);
    for (let k = 0; k < n; k++) {
      const x = rand() * S,
        y = rand() * S,
        r = rmax * (0.3 + rand() * 0.7),
        col = pal[Math.floor(rand() * pal.length)],
        sides = 4 + Math.floor(rand() * 3),
        rot = rand() * 6;
      wrapDraw(S, (ox, oy) => {
        if (x + ox < -r || x + ox > S + r || y + oy < -r || y + oy > S + r) return;
        ctx.fillStyle = col;
        ctx.beginPath();
        for (let s = 0; s < sides; s++) {
          const a = rot + (s / sides) * Math.PI * 2,
            rr = r * (0.7 + ((s * 37) % 10) / 30);
          ctx.lineTo(x + ox + Math.cos(a) * rr, y + oy + Math.sin(a) * rr);
        }
        ctx.fill();
      });
    }
  },
  fabric(ctx, S, m, rand) {
    ctx.fillStyle = m.color;
    ctx.fillRect(0, 0, S, S);
    const n = m.fine ? 64 : 32,
      s = S / n;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = shade(m.color, -0.08 - rand() * 0.06, 0.5);
      ctx.fillRect(0, i * s, S, s * 0.45);
      ctx.fillStyle = shade(m.color, 0.06 + rand() * 0.04, 0.4);
      ctx.fillRect(i * s, 0, s * 0.4, S);
    }
    noiseLayer(ctx, S, rand, 0.05, 8, 3);
  },
  brick(ctx, S, m, rand) {
    const bw = ((m.tw || 23) / m.size) * S,
      bh = ((m.th || 6) / m.size) * S,
      mw = Math.max(1, ((m.joint ?? (m.cat === "tile" ? 0.3 : 1)) / m.size) * S);
    ctx.fillStyle = m.grout || shade(m.color, 0.4);
    ctx.fillRect(0, 0, S, S);
    const rows = Math.round(S / bh),
      rh = S / rows,
      cols = Math.max(1, Math.round(S / bw)),
      cw = S / cols;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? cw / 2 : 0;
      for (let c = -1; c < cols; c++) {
        const x = c * cw + off,
          col = shade(m.color, (rand() - 0.5) * (m.id && m.id.includes("tile") ? 0.03 : 0.22));
        ctx.fillStyle = col;
        ctx.fillRect(x + mw / 2, r * rh + mw / 2, cw - mw, rh - mw);
        if (x + cw > S) ctx.fillRect(x - S + mw / 2, r * rh + mw / 2, cw - mw, rh - mw);
      }
    }
    noiseLayer(ctx, S, rand, m.cat === "tile" ? 0.015 : 0.06, 16, 3);
  },
  stone(ctx, S, m, rand) {
    // 文化石（層板石）：高低不一的長條石片
    ctx.fillStyle = shade(m.color, -0.35);
    ctx.fillRect(0, 0, S, S);
    const rows = 6,
      rh = S / rows;
    for (let r = 0; r < rows; r++) {
      let x = rand() * S * 0.3 - S * 0.3;
      while (x < S) {
        const w = S * (0.15 + rand() * 0.3),
          h = rh * (0.75 + rand() * 0.2),
          y = r * rh + (rh - h) / 2,
          col = shade(m.color, (rand() - 0.5) * 0.18);
        for (const dx of [0, -S]) {
          ctx.fillStyle = col;
          ctx.fillRect(x + dx + 1, y, w - 2, h);
          ctx.fillStyle = shade(col, 0.15, 0.5);
          ctx.fillRect(x + dx + 1, y, w - 2, h * 0.18);
        }
        x += w;
      }
    }
    noiseLayer(ctx, S, rand, 0.12, 16, 3);
  },
  slat(ctx, S, m, rand) {
    const n = 5,
      s = S / n,
      gap = m.gap ?? 0.4;
    ctx.fillStyle = shade(m.color, -0.6);
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < n; i++) {
      const col = shade(m.color, (rand() - 0.5) * 0.12);
      ctx.fillStyle = col;
      ctx.fillRect(i * s, 0, s * (1 - gap), S);
      ctx.fillStyle = shade(col, 0.18, 0.6);
      ctx.fillRect(i * s, 0, s * (1 - gap) * 0.12, S);
      if (!m.metal) grain(ctx, i * s, 0, s * (1 - gap), S, col, rand, 1);
    }
  },
  brushed(ctx, S, m, rand) {
    ctx.fillStyle = m.color;
    ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y++) {
      ctx.fillStyle = shade(m.color, (rand() - 0.5) * 0.18, 0.6);
      ctx.fillRect(0, y, S, 1);
    }
  },
  reeded(ctx, S, m, rand) {
    const n = 4,
      s = S / n;
    for (let i = 0; i < n; i++) {
      const g = ctx.createLinearGradient(i * s, 0, (i + 1) * s, 0);
      g.addColorStop(0, shade(m.color, -0.18));
      g.addColorStop(0.5, shade(m.color, 0.35));
      g.addColorStop(1, shade(m.color, -0.18));
      ctx.fillStyle = g;
      ctx.fillRect(i * s, 0, s, S);
    }
    void rand;
  },
};

/** 產生紋理畫布（px 邊長代表 m.size cm）；有自訂圖片時回傳 null（由呼叫端用圖片） */
export function paintTexture(m, px = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const fn = PAINTERS[m.pattern] || PAINTERS.plain;
  fn(ctx, px, m, rng(String(m.id) + m.pattern + m.color));
  return c;
}
export const PATTERN_KEYS = Object.keys(PAINTERS);
