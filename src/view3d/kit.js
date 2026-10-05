// 3D 建模小工具：方塊、擠出、cm 為單位的 UV、內建通用材質（three 由呼叫端傳入，不在這裡 import）

export function makeKit(THREE) {
  const setUV = (geom, ox = 0, oy = 0, oz = 0) => {
    const p = geom.attributes.position,
      n = geom.attributes.normal;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + ox,
        y = p.getY(i) + oy,
        z = p.getZ(i) + oz,
        ax = Math.abs(n.getX(i)),
        ay = Math.abs(n.getY(i)),
        az = Math.abs(n.getZ(i));
      if (ax >= ay && ax >= az) {
        uv[i * 2] = z;
        uv[i * 2 + 1] = y;
      } else if (ay >= az) {
        uv[i * 2] = x;
        uv[i * 2 + 1] = z;
      } else {
        uv[i * 2] = x;
        uv[i * 2 + 1] = y;
      }
    }
    geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return geom;
  };
  const shadow = m => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  /** 方塊：幾何範圍 [0,sx]×[0,sy]×[0,sz]（最小角在原點），UV 為 cm；mat 可為材質陣列 */
  const box = (sx, sy, sz, mat) => {
    const g = new THREE.BoxGeometry(Math.max(sx, 0.1), Math.max(sy, 0.1), Math.max(sz, 0.1));
    g.translate(sx / 2, sy / 2, sz / 2);
    setUV(g);
    return shadow(new THREE.Mesh(g, mat));
  };
  /** 放在 (x,y,z)（最小角）的方塊 */
  const boxAt = (parent, x, y, z, sx, sy, sz, mat) => {
    const m = box(sx, sy, sz, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  /** 圓柱：底面中心 (x,y,z)，半徑 rx/rz 可不同（橢圓） */
  const cyl = (parent, x, y, z, rx, h, mat, rz = rx, seg = 24, rTop = null) => {
    const g = new THREE.CylinderGeometry(rTop == null ? 1 : rTop, 1, h, seg);
    g.translate(0, h / 2, 0);
    const m = shadow(new THREE.Mesh(g, mat));
    m.scale.set(rx, 1, rz);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const sphere = (parent, x, y, z, rx, ry, rz, mat) => {
    const m = shadow(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat));
    m.scale.set(rx, ry, rz);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  /** 平面多邊形（平面座標 [x, z]）往上擠出 h，底面在 y0 */
  const extrude = (parent, pts, h, mat, y0 = 0) => {
    const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(h, 0.1), bevelEnabled: false, curveSegments: 24 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, y0, 0);
    g.computeVertexNormals();
    setUV(g);
    const m = shadow(new THREE.Mesh(g, mat));
    if (parent) parent.add(m);
    return m;
  };
  /** 沿中心線 pts（平面座標）做寬 t 的帶狀擠出 */
  const strip = (parent, pts, t, h, mat, y0 = 0) => {
    if (pts.length < 2) return null;
    const L = [],
      R = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)],
        b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0],
        dz = b[1] - a[1];
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      L.push([pts[i][0] - (dz * t) / 2, pts[i][1] + (dx * t) / 2]);
      R.push([pts[i][0] + (dz * t) / 2, pts[i][1] - (dx * t) / 2]);
    }
    return extrude(parent, [...L, ...R.reverse()], h, mat, y0);
  };
  return { THREE, setUV, box, boxAt, cyl, sphere, extrude, strip, shadow };
}

/** 通用材質（家具預設色）；每個檢視一份，卸載時 dispose */
export function makeMats(THREE) {
  const std = (color, rough = 0.8, metal = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  const glass = (color, opacity, rough = 0.05) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: rough,
      metalness: 0.1,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  return {
    fabric: std("#8d929a", 0.95),
    fabricLight: std("#d9d4ca", 0.95),
    fabricWarm: std("#b9a58c", 0.95),
    cushion: std("#a9adb4", 0.95),
    wood: std("#b48b5e", 0.65),
    woodDark: std("#6b4f36", 0.6),
    woodLight: std("#d8c3a0", 0.65),
    white: std("#f2f1ec", 0.6),
    offwhite: std("#e7e4dc", 0.7),
    mattress: std("#f6f4ef", 0.9),
    pillow: std("#ebe8e1", 0.9),
    metal: std("#a3a8ae", 0.35, 0.8),
    steel: std("#d4d7da", 0.25, 0.9),
    black: std("#2b2b2b", 0.5),
    screen: std("#121417", 0.2, 0.3),
    plant: std("#4f7d3a", 0.8),
    plant2: std("#6a9a49", 0.8),
    pot: std("#b5653b", 0.85),
    rug: std("#cdbfa8", 1),
    tatami: std("#cdc38c", 0.9),
    purple: std("#7c5cbf", 0.9),
    frame: std("#c9ccd0", 0.4, 0.6),
    frameDark: std("#3a3d42", 0.45, 0.5),
    door: std("#efece5", 0.6),
    groove: std("#5b5b5b", 0.8),
    handle: std("#8a8f96", 0.3, 0.9),
    mirror: std("#dfe7ec", 0.03, 1),
    wallTop: std("#3f3f41", 0.9),
    column: std("#e9e7e2", 0.9),
    canopy: std("#c8ccd2", 0.8),
    oos: std("#d5d7db", 0.9),
    ground: std("#e8e5df", 1),
    lampShade: std("#fff3d6", 0.8, 0, { emissive: "#ffe2a8", emissiveIntensity: 0.25 }),
    glassClear: glass("#cfe6f2", 0.22),
    glassFrosted: glass("#eef3f5", 0.78, 0.6),
    glassReeded: glass("#dceaf0", 0.62, 0.35),
    glassLowe: glass("#a9c7d6", 0.32),
    glassDoor: glass("#d7e9f2", 0.3),
  };
}
