// 由專案資料建立 3D 場景（不 import three：THREE 由呼叫端傳入，讓 three.js 只在開啟 3D 檢視時才下載）
import { S, state } from "../core/store.js";
import { EXT } from "../ext/registry.js";
import { itemElev, itemH, spec } from "../ext/heights.js";
import { layerOf } from "../ext/plans.js";
import { threeMaterial } from "../materials/index.js";
import { makeKit, makeMats } from "./kit.js";
import { buildArch, roomLabels } from "./arch3d.js";
import { buildGeneric } from "./furniture.js";

/**
 * 建立給模組 build3d 用的 ctx：
 * {
 *   THREE,                 // three.js 模組
 *   spec,                  // 合併預設值後的設計規格（spec()）
 *   mat(id),               // 材質 id → MeshStandardMaterial（快取共用，請勿修改／dispose）
 *   itemH(it), itemElev(it),
 *   box(sx, sy, sz, mat),  // 方塊 Mesh，幾何範圍 [0,sx]×[0,sy]×[0,sz]，UV 以 cm 為單位
 *   K,                     // 其他工具：boxAt、cyl、sphere、extrude（平面多邊形往上擠出）、strip（沿中心線帶狀擠出）、setUV
 *   M,                     // 通用材質（fabric、wood、white、metal、glassClear…）
 *   doors,                 // 門片／櫃門開啟程度 0（關）～1（全開）；櫃體可用 it.cab.open 覆寫
 *   night,                 // 夜間模式（燈具可加自發光）
 * }
 * 回傳的 Object3D 用物件局部座標（原點＝平面左上角、x∈[0,w]、z∈[0,d]、地面 y=0，模組自己套用 elev）。
 */
export function makeCtx(THREE, M, opts = {}) {
  const K = makeKit(THREE);
  return {
    THREE,
    K,
    M,
    spec: spec(),
    mat: id => threeMaterial(THREE, id),
    itemH,
    itemElev,
    box: K.box,
    doors: opts.doors ?? 0,
    night: !!opts.night,
  };
}

/** 把局部模型放到平面位置：平移、繞中心旋轉（SVG 順時針 → 3D 繞 Y 負向）、左右鏡像 */
export function placeItem(THREE, obj, it) {
  const outer = new THREE.Group();
  outer.position.set(it.x + it.w / 2, 0, it.y + it.d / 2);
  outer.rotation.y = (-(it.rot || 0) * Math.PI) / 180;
  const inner = new THREE.Group();
  if (it.flip) {
    inner.scale.x = -1;
    inner.position.set(it.w / 2, 0, -it.d / 2);
  } else inner.position.set(-it.w / 2, 0, -it.d / 2);
  inner.add(obj);
  outer.add(inner);
  return outer;
}

/** 建立單一物件的模型（模組的 build3d 優先，否則用通用模型） */
export function buildItem(ctx, it) {
  const f = EXT.build3d[it.type];
  if (f) {
    try {
      const o = f(it, ctx);
      if (o) return o;
    } catch (e) {
      console.warn("build3d", it.type, e);
    }
  }
  try {
    return buildGeneric(it, ctx);
  } catch (e) {
    console.warn("3d generic", it.type, e);
    return null;
  }
}

/** 物件在平面上的四角（依 rot 繞中心旋轉） */
function footprint(it) {
  const cx = it.x + it.w / 2,
    cy = it.y + it.d / 2,
    a = ((it.rot || 0) * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) => {
    const dx = (sx * it.w) / 2,
      dy = (sy * it.d) / 2;
    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
  });
}

/**
 * 建立整個場景內容。opts：{ layers: { layer: bool }, wallTop: "ceil"|"slab", doors: 0..1, labels, night, M（通用材質，可省略） }
 * 回傳 { group, walls, rect, lights: [{ x, y, z, id }], ceilings: [Object3D] }
 */
export function buildScene(THREE, opts = {}) {
  const M = opts.M || makeMats(THREE);
  const ctx = makeCtx(THREE, M, opts);
  const layers = opts.layers || {};
  const group = new THREE.Group();
  const ceilHoles =
    layers.ceiling === false
      ? []
      : state.items.filter(it => it.type === "curtainBox" && itemElev(it) > ctx.spec.ceilH).map(footprint);
  const arch = buildArch(ctx, { ...opts, ceilHoles });
  group.add(arch.group);
  const ceilings = arch.ceiling ? [arch.ceiling] : [];
  const lights = [];
  // 底圖固定設備
  for (const f of (S.BASE && S.BASE.fixtures) || []) {
    const o = buildItem(ctx, { ...f, rot: f.rot || 0 });
    if (!o) continue;
    const p = placeItem(THREE, o, { ...f, rot: f.rot || 0 });
    p.userData.pick = { kind: "fixture" };
    group.add(p);
  }
  for (const it of state.items) {
    const layer = layerOf(it);
    if (layers[layer] === false) continue;
    const o = buildItem(ctx, it);
    if (!o) continue;
    const p = placeItem(THREE, o, it);
    p.userData.pick = { kind: "item", id: it.id };
    p.userData.itemId = it.id;
    if (layer === "ceiling") ceilings.push(p);
    if (layer === "light" && /light|lamp|pendant|down|track|strip|cove/i.test(it.type)) {
      const e = itemElev(it);
      lights.push({ x: it.x + it.w / 2, y: e > 0 ? e - 6 : ctx.spec.ceilH - 10, z: it.y + it.d / 2, id: it.id });
    }
    group.add(p);
  }
  if (opts.labels) group.add(roomLabels(ctx));
  return { group, walls: arch.walls, rect: arch.rect, lights, ceilings, M };
}

/** 釋放幾何與物件自己的材質（共用材質不動） */
export function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.userData && o.userData.ownMat && o.material) {
      if (o.material.map) o.material.map.dispose();
      o.material.dispose();
    }
  });
}
