// 櫃體 3D：由 cabParts 板件組成；支援開關狀態（門扇繞鉸鏈旋轉、抽屜拉出、拉門滑開、上掀門翻起）
import { getMat } from "../materials/index.js";
import { itemElev } from "../ext/heights.js";
import { cabHandles, cabLayout, cabParts } from "./model.js";
import { openRatio } from "./draw.js";

/** BoxGeometry 的 UV 改成以 cm 為單位（材質 repeat = 1/size） */
function cmBox(THREE, sx, sy, sz) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  const uv = g.attributes.uv;
  const dims = [
    [sz, sy],
    [sz, sy],
    [sx, sz],
    [sx, sz],
    [sx, sy],
    [sx, sy],
  ];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
    }
  uv.needsUpdate = true;
  return g;
}

/** EXT.build3d：局部座標原點＝平面左上角，地面 y=0，x∈[0,w]、z∈[0,d]（正面 z=d） */
export function buildCab3D(it, ctx) {
  const { THREE } = ctx;
  const E = itemElev(it);
  const ratio = openRatio(it, ctx);
  const L = cabLayout(it);
  const root = new THREE.Group();
  root.name = "cabinet";
  const matOf = (id, role) => {
    let m = ctx.mat ? ctx.mat(id) : new THREE.MeshStandardMaterial({ color: getMat(id).color });
    if (role === "glass" && !(m.transparent && m.opacity < 1)) {
      m = m.clone();
      m.transparent = true;
      m.opacity = 0.35;
      m.roughness = 0.05;
    }
    return m;
  };
  const mesh = (p, mat) => {
    const m = new THREE.Mesh(cmBox(THREE, p.sx, p.sy, p.sz), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  // 門抽的旋轉／平移群組
  const movers = new Map();
  const moverFor = p => {
    const key = `${p.role}|${p.x}|${p.y}|${p.z}`;
    return movers.get(key);
  };
  const parts = cabParts(it);
  const handles = cabHandles(it);
  for (const p of parts) {
    const m = mesh(p, matOf(p.mat, p.role));
    const cx = p.x + p.sx / 2,
      cy = E + p.y + p.sy / 2,
      cz = p.z + p.sz / 2;
    const isDoor = p.role === "door" || p.role === "glass";
    if (isDoor && ratio > 0.001) {
      const g = new THREE.Group();
      if (p.hinge === "L" || p.hinge === "R") {
        // 鉸鏈軸在門板外側的前緣
        const hx = p.hinge === "L" ? p.x : p.x + p.sx;
        g.position.set(hx, E + p.y, p.z + p.sz);
        m.position.set(cx - hx, p.sy / 2, -p.sz / 2);
        g.rotation.y = (p.hinge === "L" ? -1 : 1) * ratio * ((100 * Math.PI) / 180);
      } else if (p.hinge === "T") {
        g.position.set(p.x, E + p.y + p.sy, p.z + p.sz);
        m.position.set(p.sx / 2, -p.sy / 2, -p.sz / 2);
        g.rotation.x = -ratio * ((95 * Math.PI) / 180);
      } else {
        // 拉門：前軌往左、後軌往右滑
        const backTrack = p.z < L.cd + L.dt + 0.5;
        g.position.set((backTrack ? 1 : -1) * p.sx * 0.95 * ratio, 0, 0);
        m.position.set(cx, cy, cz);
      }
      g.add(m);
      movers.set(`${p.role}|${p.x}|${p.y}|${p.z}`, g);
      root.add(g);
    } else if ((p.role === "drawerFront" || p.role === "drawerSide" || p.role === "drawerBottom") && ratio > 0.001) {
      const pull = ratio * Math.min(0.6 * L.cd, L.cd - 5);
      m.position.set(cx, cy, cz + pull);
      root.add(m);
    } else {
      m.position.set(cx, cy, cz);
      root.add(m);
    }
  }
  // 把手：跟著門扇或抽屜一起動
  const hMat = matOf(L.c.handleMat, "handle");
  const { doors, drawers } = (() => {
    const ps = parts.filter(p => p.role === "door" || p.role === "glass");
    return { doors: ps, drawers: parts.filter(p => p.role === "drawerFront") };
  })();
  for (const h of handles) {
    const hm = new THREE.Mesh(cmBox(THREE, h.sx, h.sy, h.sz), hMat);
    hm.castShadow = true;
    const cx = h.x + h.sx / 2,
      cy = E + h.y + h.sy / 2,
      cz = h.z + h.sz / 2;
    const door = doors.find(
      p => h.x >= p.x - 0.5 && h.x <= p.x + p.sx + 0.5 && h.y >= p.y - 0.5 && h.y <= p.y + p.sy + 0.5,
    );
    const drw = drawers.find(
      p => h.x >= p.x - 0.5 && h.x <= p.x + p.sx + 0.5 && h.y >= p.y - 0.5 && h.y <= p.y + p.sy + 0.5,
    );
    const g = door && moverFor(door);
    if (g) {
      const inv = new THREE.Vector3(cx, cy, cz).sub(g.position);
      if (door.hinge === "S") inv.set(cx, cy, cz);
      hm.position.copy(inv);
      g.add(hm);
    } else {
      const pull = drw && ratio > 0.001 ? ratio * Math.min(0.6 * L.cd, L.cd - 5) : 0;
      hm.position.set(cx, cy, cz + pull);
      root.add(hm);
    }
  }
  // LED 燈條（發光細條，裝在頂板下前緣）
  if (L.c.lightStrip) {
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(L.W - 2 * L.T, 0.6, 1.2),
      new THREE.MeshStandardMaterial({ color: "#fff7e0", emissive: "#ffd98a", emissiveIntensity: 1.2 }),
    );
    led.position.set(L.x0 + L.W / 2, E + L.yt - 0.4, L.cd - 3);
    root.add(led);
  }
  root.userData.itemId = it.id;
  return root;
}
