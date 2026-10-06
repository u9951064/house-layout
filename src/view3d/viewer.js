// 3D 檢視器：three.js 渲染、環繞／俯視／漫遊、剖切、牆體透明、夜間模式、點選、材質刷、門片開關、匯出圖片
// 這個檔案靜態 import three，只會在開啟 3D 檢視時以 import() 載入（正式版拆成獨立 chunk）
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { t } from "../core/i18n.js";
import { state } from "../core/store.js";
import { esc, toast } from "../core/dom.js";
import { commit } from "../core/history.js";
import { renderItems } from "../canvas/items.js";
import { setSel } from "../canvas/selection.js";
import { LAYERS, onChange } from "../ext/registry.js";
import { spec } from "../ext/heights.js";
import { getMat, openMatPicker } from "../materials/index.js";
import { download, safeName, stamp } from "../io/file.js";
import { dname } from "../project/project.js";
import { makeMats } from "./kit.js";
import { buildScene, disposeTree } from "./scene.js";

const LAYER_NAMES = {
  furniture: "家具",
  partition: "隔間與門",
  cabinet: "櫃體",
  floor: "地坪",
  ceiling: "天花",
  finish: "牆面與窗簾",
  light: "燈具開關",
  power: "插座弱電",
  hvac: "空調風管",
};
const OPT_KEY = "hl-3d";
// 資料變動通知：registry 沒有取消訂閱，所以只註冊一次，轉給目前掛載中的檢視器
let listener = null;
onChange(why => listener && listener(why));
function loadOpts() {
  const d = {
    mode: "orbit",
    doors: 0,
    cut: false,
    cutH: 200,
    hideCeil: true,
    doll: true,
    night: false,
    shadows: true,
    labels: false,
    wallTop: "ceil",
    eye: 160,
    layers: Object.fromEntries(LAYERS.map(k => [k, true])),
  };
  try {
    const o = JSON.parse(localStorage.getItem(OPT_KEY) || "{}");
    return { ...d, ...o, layers: { ...d.layers, ...(o.layers || {}) } };
  } catch (e) {
    return d;
  }
}

/** 建立並掛載 3D 檢視器到 host；回傳 { destroy, refresh, exportPNG } */
export function mountViewer(host) {
  const opts = loadOpts();
  const saveOpts = () => {
    try {
      localStorage.setItem(OPT_KEY, JSON.stringify(opts));
    } catch (e) {}
  };
  host.innerHTML = toolbarHTML(opts);
  const stage = host.querySelector(".v3d-stage");
  const hint = host.querySelector(".v3d-hint");

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = opts.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x9d968a, 0.7);
  const amb = new THREE.AmbientLight(0xffffff, 0.25);
  const sun = new THREE.DirectionalLight(0xfff4e5, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 1.5;
  scene.add(hemi, amb, sun, sun.target);
  const M = makeMats(THREE);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.6;
  ground.receiveShadow = true;
  scene.add(ground);

  const persp = new THREE.PerspectiveCamera(50, 1, 5, 40000);
  const ortho = new THREE.OrthographicCamera(-500, 500, 500, -500, 1, 40000);
  let camera = persp;
  const controls = new OrbitControls(persp, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.maxPolarAngle = Math.PI * 0.495;

  const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), opts.cutH);
  let model = null,
    built = null,
    selBox = null,
    lastSel = undefined,
    nightLights = [],
    raf = 0,
    dirty = true,
    brush = null,
    centerInfo = { cx: 0, cz: 0, R: 600 };

  // —— 場景建立 ——
  function rebuild() {
    if (model) {
      scene.remove(model);
      disposeTree(model);
    }
    built = buildScene(THREE, { ...opts, M });
    model = built.group;
    scene.add(model);
    const r = built.rect;
    const cx = (r.x1 + r.x2) / 2,
      cz = (r.y1 + r.y2) / 2,
      R = Math.max(r.x2 - r.x1, r.y2 - r.y1, 300);
    const first = !centerInfo.ok;
    centerInfo = { cx, cz, R, ok: true, r };
    ground.scale.set(R * 6, R * 6, 1);
    ground.position.set(cx, -0.6, cz);
    sun.position.set(cx - R * 0.6, R * 1.6, cz + R * 0.9);
    sun.target.position.set(cx, 0, cz);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -R;
    sc.right = sc.top = R;
    sc.near = 10;
    sc.far = R * 5;
    sc.updateProjectionMatrix();
    applyNight();
    applyVisibility();
    lastSel = undefined;
    if (first) setMode(opts.mode, true);
    dirty = true;
    expose();
  }
  let tmr = 0;
  const rebuildSoon = () => {
    clearTimeout(tmr);
    tmr = setTimeout(rebuild, 150);
  };

  function applyNight() {
    for (const l of nightLights) (scene.remove(l), l.dispose && l.dispose());
    nightLights = [];
    const night = opts.night;
    sun.intensity = night ? 0.04 : 2.6;
    hemi.intensity = night ? 0.06 : 0.7;
    amb.intensity = night ? 0.03 : 0.12;
    scene.environmentIntensity = night ? 0.05 : 0.35;
    scene.background = new THREE.Color(night ? 0x161a24 : 0xeef1f5);
    if (night && built) {
      for (const L of built.lights.slice(0, 24)) {
        const p = new THREE.PointLight(0xffd59a, 2.2, 520, 1);
        p.position.set(L.x, L.y, L.z);
        scene.add(p);
        nightLights.push(p);
      }
      if (!nightLights.length) {
        const r = centerInfo;
        const p = new THREE.PointLight(0xffd59a, 2, r.R * 1.5, 1);
        p.position.set(r.cx, 230, r.cz);
        scene.add(p);
        nightLights.push(p);
      }
    }
    renderer.shadowMap.enabled = opts.shadows;
    sun.castShadow = opts.shadows;
    dirty = true;
  }
  function applyVisibility() {
    if (!built) return;
    const showCeil = !opts.hideCeil || opts.mode === "walk";
    for (const c of built.ceilings) c.visible = showCeil;
    renderer.clippingPlanes = opts.cut ? [cutPlane] : [];
    cutPlane.constant = opts.cutH;
    dirty = true;
  }

  // —— 相機模式 ——
  function setMode(mode, reset) {
    opts.mode = mode;
    const { cx, cz, R } = centerInfo;
    walk.active = mode === "walk";
    if (mode === "top") {
      camera = ortho;
      const a = stage.clientWidth / Math.max(1, stage.clientHeight),
        h = R * 0.62;
      ortho.left = -h * a;
      ortho.right = h * a;
      ortho.top = h;
      ortho.bottom = -h;
      ortho.zoom = 1;
      ortho.position.set(cx, R * 4, cz + 0.01);
      ortho.up.set(0, 1, 0);
      ortho.updateProjectionMatrix();
      controls.object = ortho;
      controls.target.set(cx, 0, cz);
      controls.enableRotate = false;
      controls.enabled = true;
    } else if (mode === "walk") {
      camera = persp;
      controls.enabled = false;
      if (reset || !walk.placed) {
        walk.pos.set(cx, opts.eye, cz + R * 0.25);
        walk.yaw = 0;
        walk.pitch = -0.05;
        walk.placed = true;
      }
      walk.pos.y = opts.eye;
    } else {
      camera = persp;
      controls.object = persp;
      controls.enableRotate = true;
      controls.enabled = true;
      if (reset || opts.mode !== mode || !controls._placed) preset("iso");
    }
    applyVisibility();
    resize();
    syncToolbar();
    saveOpts();
    dirty = true;
  }
  function preset(name) {
    const { cx, cz, R } = centerInfo;
    if (opts.mode !== "orbit") {
      opts.mode = "orbit";
      camera = persp;
      controls.object = persp;
      controls.enableRotate = true;
      controls.enabled = true;
      walk.active = false;
      applyVisibility();
      syncToolbar();
    }
    const D = R * 1.25;
    const pos = {
      front: [cx, R * 0.55, cz + D],
      back: [cx, R * 0.55, cz - D],
      left: [cx - D, R * 0.55, cz],
      right: [cx + D, R * 0.55, cz],
      iso: [cx - D * 0.65, R * 0.95, cz + D * 0.85],
    }[name] || [cx, R, cz + D];
    persp.position.set(...pos);
    controls.target.set(cx, 80, cz);
    controls._placed = true;
    controls.update();
    dirty = true;
  }

  // —— 漫遊 ——
  const walk = { active: false, pos: new THREE.Vector3(), yaw: 0, pitch: 0, keys: new Set(), placed: false };
  const onKey = (e, down) => {
    if (!walk.active || /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || "")) return;
    const k = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "q", "e", "shift"].includes(k)) {
      if (down) walk.keys.add(k);
      else walk.keys.delete(k);
      e.preventDefault();
    }
  };
  const kd = e => onKey(e, true),
    ku = e => onKey(e, false);
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);
  function stepWalk(dt) {
    const sp = (walk.keys.has("shift") ? 320 : 150) * dt;
    const f =
      (walk.keys.has("w") || walk.keys.has("arrowup") ? 1 : 0) -
      (walk.keys.has("s") || walk.keys.has("arrowdown") ? 1 : 0);
    const s = (walk.keys.has("d") ? 1 : 0) - (walk.keys.has("a") ? 1 : 0);
    const turn = (walk.keys.has("arrowleft") ? 1 : 0) - (walk.keys.has("arrowright") ? 1 : 0);
    walk.yaw += turn * dt * 1.6;
    // 前方 (−sin, −cos)、右方 (cos, −sin)
    const fx = -Math.sin(walk.yaw),
      fz = -Math.cos(walk.yaw);
    walk.pos.x += fx * f * sp + Math.cos(walk.yaw) * s * sp;
    walk.pos.z += fz * f * sp - Math.sin(walk.yaw) * s * sp;
    if (f || s || turn) dirty = true;
    persp.position.copy(walk.pos);
    const look = new THREE.Vector3(
      walk.pos.x - Math.sin(walk.yaw) * Math.cos(walk.pitch),
      walk.pos.y + Math.sin(walk.pitch),
      walk.pos.z - Math.cos(walk.yaw) * Math.cos(walk.pitch),
    );
    persp.lookAt(look);
  }

  // —— 牆體透明：視線（相機 → 目標）穿過的牆隱藏 ——
  const segX = (a, b, c, d) => {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
  };
  function updateDoll() {
    if (!built) return;
    const on = opts.doll && opts.mode === "orbit";
    const cam = [camera.position.x, camera.position.z],
      tg = [controls.target.x, controls.target.z];
    for (const w of built.walls) {
      const v = !(on && segX(cam, tg, w.p1, w.p2));
      if (w.group.visible !== v) {
        w.group.visible = v;
        dirty = true;
      }
    }
  }

  // —— 選取外框 ——
  function updateSel() {
    if (state.sel === lastSel && selBox) return;
    lastSel = state.sel;
    if (selBox) {
      scene.remove(selBox);
      selBox.geometry.dispose();
      selBox = null;
    }
    if (!model || state.sel == null) return;
    let obj = null;
    model.traverse(o => {
      if (!obj && o.userData.itemId === state.sel) obj = o;
    });
    if (obj) {
      selBox = new THREE.BoxHelper(obj, 0x1f6feb);
      selBox.material.depthTest = false;
      selBox.renderOrder = 20;
      scene.add(selBox);
    }
    dirty = true;
  }

  // —— 點選 ——
  const ray = new THREE.Raycaster();
  function pick(clientX, clientY) {
    if (!model) return null;
    const r = renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v, camera);
    const hits = ray.intersectObject(model, true);
    for (const h of hits) {
      if (opts.cut && h.point.y > opts.cutH + 0.01) continue;
      const o = h.object;
      let ok = true,
        info = null,
        holder = null;
      for (let p = o; p; p = p.parent) {
        if (!p.visible) ok = false;
        if (!info && p.userData && p.userData.pick) {
          info = p.userData.pick;
          holder = p;
        }
      }
      if (!ok || !info) continue;
      if (h.object.isSprite) continue;
      const out = { ...info, point: h.point.clone(), object: holder };
      if (info.kind === "wall" && h.face) {
        const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
        const dot = n.x * info.nx + n.z * info.nz;
        out.face = Math.abs(dot) < 0.5 ? 0 : dot > 0 ? 1 : -1;
      }
      return out;
    }
    return null;
  }
  function apply(info, id) {
    if (!info || !id) return false;
    state.spec ||= {};
    const sp = state.spec;
    if (info.kind === "wall") {
      if (!info.face) {
        toast(t("請點在牆的側面"));
        return false;
      }
      sp.wallFin = { ...(sp.wallFin || {}), [`${info.i}:${info.face}`]: id };
    } else if (info.kind === "floor") sp.floorMat = id;
    else if (info.kind === "ceiling") sp.ceilMat = id;
    else if (info.kind === "item") {
      const it = state.items.find(i => i.id === info.id);
      if (!it) return false;
      it.mat = id;
      renderItems();
    } else return false;
    commit();
    toast(t("已套用材質「{name}」", { name: getMat(id).name }));
    return true;
  }
  function eyedrop(info) {
    if (!info) return null;
    const sp = spec();
    if (info.kind === "wall" && info.face) return (sp.wallFin || {})[`${info.i}:${info.face}`] || sp.wallMat;
    if (info.kind === "floor") return sp.floorMat || null;
    if (info.kind === "ceiling") return sp.ceilMat || null;
    if (info.kind === "item") return (state.items.find(i => i.id === info.id) || {}).mat || null;
    return null;
  }

  const cv = renderer.domElement;
  let down = null;
  cv.addEventListener("pointerdown", e => {
    down = { x: e.clientX, y: e.clientY, yaw: walk.yaw, pitch: walk.pitch };
    if (walk.active) cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener("pointermove", e => {
    if (walk.active && down) {
      walk.yaw = down.yaw - (e.clientX - down.x) * 0.005;
      walk.pitch = Math.max(-1.3, Math.min(1.3, down.pitch - (e.clientY - down.y) * 0.004));
      dirty = true;
    }
  });
  cv.addEventListener("pointerup", async e => {
    const moved = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4;
    down = null;
    if (moved || e.button !== 0) return;
    const info = pick(e.clientX, e.clientY);
    if (brush) {
      if (e.altKey) {
        const id = eyedrop(info);
        if (id) {
          brush = id;
          syncToolbar();
          toast(t("已吸取材質「{name}」", { name: getMat(id).name }));
        }
        return;
      }
      apply(info, brush);
      return;
    }
    if (info && info.kind === "item") setSel([info.id]);
    else setSel([]);
    updateSel();
  });
  cv.addEventListener("dblclick", e => {
    const info = pick(e.clientX, e.clientY);
    if (!info || walk.active || opts.mode !== "orbit") return;
    const box = new THREE.Box3().setFromObject(info.object && info.kind === "item" ? info.object : model);
    const c = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3()).length();
    const dir = persp.position.clone().sub(controls.target).normalize();
    controls.target.copy(c);
    persp.position.copy(c.clone().add(dir.multiplyScalar(Math.max(size * 1.4, 150))));
    controls.update();
    dirty = true;
  });
  controls.addEventListener("change", () => (dirty = true));

  // —— 尺寸與迴圈 ——
  function resize() {
    const w = Math.max(1, stage.clientWidth),
      h = Math.max(1, stage.clientHeight);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + "px";
    renderer.domElement.style.height = h + "px";
    persp.aspect = w / h;
    persp.updateProjectionMatrix();
    if (camera === ortho) {
      const hh = (ortho.top - ortho.bottom) / 2;
      ortho.left = -hh * (w / h);
      ortho.right = hh * (w / h);
      ortho.updateProjectionMatrix();
    }
    dirty = true;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  let last = performance.now();
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (walk.active) stepWalk(dt);
    else if (controls.enabled) controls.update();
    updateDoll();
    updateSel();
    if (selBox) selBox.update();
    if (dirty || walk.keys.size) {
      renderer.render(scene, camera);
      dirty = false;
    }
  }

  // —— 門片動畫 ——
  let anim = 0;
  function animateDoors() {
    cancelAnimationFrame(anim);
    const from = opts.doors,
      to = from > 0.5 ? 0 : 1,
      t0 = performance.now(),
      dur = 700;
    let lastB = 0;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      opts.doors = from + (to - from) * (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
      if (now - lastB > 80 || k === 1) {
        lastB = now;
        rebuild();
      }
      if (k < 1) anim = requestAnimationFrame(step);
      else {
        opts.doors = to;
        syncToolbar();
        saveOpts();
      }
    };
    anim = requestAnimationFrame(step);
  }

  // —— 匯出 ——
  async function exportPNG() {
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL("image/png");
    const blob = await (await fetch(url)).blob();
    download(`${safeName()}-${dname()}-3D-${stamp()}.png`, blob);
    toast(t("已匯出 3D 圖片"));
  }

  // —— 工具列 ——
  function syncToolbar() {
    host.querySelectorAll("[data-v3mode]").forEach(b => b.classList.toggle("on", b.dataset.v3mode === opts.mode));
    const q = s => host.querySelector(s);
    q("#v3Doors").value = String(opts.doors <= 0.25 ? 0 : opts.doors >= 0.75 ? 1 : 0.5);
    q("#v3Cut").checked = opts.cut;
    q("#v3CutH").value = opts.cutH;
    q("#v3CutV").textContent = `${opts.cutH} cm`;
    q("#v3Ceil").checked = opts.hideCeil;
    q("#v3Doll").checked = opts.doll;
    q("#v3Night").checked = opts.night;
    q("#v3Shadow").checked = opts.shadows;
    q("#v3Labels").checked = opts.labels;
    q("#v3WallTop").value = opts.wallTop;
    q("#v3Eye").value = opts.eye;
    q("#v3EyeL").hidden = opts.mode !== "walk";
    const bb = q("#v3Brush");
    bb.classList.toggle("on", !!brush);
    bb.innerHTML = brush
      ? `🪣 <span class="sw" style="background:${esc(getMat(brush).color || "#ccc")}"></span>${esc(getMat(brush).name)}`
      : `🪣 ${t("材質刷")}`;
    stage.classList.toggle("brush", !!brush);
    hint.textContent = brush
      ? t("材質刷：點牆面、地板、天花或物件套用；按住 Alt 點選可吸取材質；Esc 結束")
      : opts.mode === "walk"
        ? t("漫遊：W／A／S／D 或方向鍵移動、拖曳轉頭、Shift 加速")
        : opts.mode === "top"
          ? t("俯視：拖曳平移、滾輪縮放；點選物件可在右側編輯")
          : t("環繞：左鍵拖曳旋轉、右鍵平移、滾輪縮放；雙擊聚焦；點選物件可在右側編輯");
  }
  const on = (sel, ev, fn) => host.querySelector(sel).addEventListener(ev, fn);
  host.querySelectorAll("[data-v3mode]").forEach(b => (b.onclick = () => setMode(b.dataset.v3mode, true)));
  host.querySelectorAll("[data-v3preset]").forEach(b => (b.onclick = () => preset(b.dataset.v3preset)));
  on("#v3Doors", "change", e => {
    opts.doors = +e.target.value;
    saveOpts();
    rebuild();
  });
  on("#v3Anim", "click", animateDoors);
  on("#v3Cut", "change", e => {
    opts.cut = e.target.checked;
    saveOpts();
    applyVisibility();
  });
  on("#v3CutH", "input", e => {
    opts.cutH = +e.target.value;
    if (!opts.cut) opts.cut = true;
    syncToolbar();
    applyVisibility();
  });
  on("#v3CutH", "change", saveOpts);
  on("#v3Ceil", "change", e => {
    opts.hideCeil = e.target.checked;
    saveOpts();
    applyVisibility();
  });
  on("#v3Doll", "change", e => {
    opts.doll = e.target.checked;
    saveOpts();
    dirty = true;
  });
  on("#v3Night", "change", e => {
    opts.night = e.target.checked;
    saveOpts();
    rebuild();
  });
  on("#v3Shadow", "change", e => {
    opts.shadows = e.target.checked;
    saveOpts();
    applyNight();
    rebuild();
  });
  on("#v3Labels", "change", e => {
    opts.labels = e.target.checked;
    saveOpts();
    rebuild();
  });
  on("#v3WallTop", "change", e => {
    opts.wallTop = e.target.value;
    saveOpts();
    rebuild();
  });
  on("#v3Eye", "change", e => {
    opts.eye = Math.max(30, Math.min(260, +e.target.value || 160));
    walk.pos.y = opts.eye;
    saveOpts();
    dirty = true;
  });
  host.querySelectorAll("[data-v3layer]").forEach(
    c =>
      (c.onchange = () => {
        opts.layers[c.dataset.v3layer] = c.checked;
        saveOpts();
        rebuild();
      }),
  );
  on("#v3Brush", "click", async () => {
    if (brush) {
      brush = null;
      syncToolbar();
      return;
    }
    const id = await openMatPicker({ value: null, title: t("選擇材質刷的材質") });
    if (id) {
      brush = id;
      syncToolbar();
    }
  });
  on("#v3Shot", "click", exportPNG);
  const escKey = e => {
    if (e.key === "Escape" && brush) {
      brush = null;
      syncToolbar();
    }
  };
  window.addEventListener("keydown", escKey);

  listener = why => {
    if (why === "view" || why === "tool") return;
    rebuildSoon();
  };
  function expose() {
    window.__fp3d = {
      scene,
      /** 立即渲染並回傳 PNG data URL（MCP 截圖用） */
      snapshot: () => {
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL("image/png");
      },
      get model() {
        return model;
      },
      get built() {
        return built;
      },
      camera: () => camera,
      opts,
      rebuild,
      pick,
      apply,
      setMode,
      preset,
      setDoors: v => {
        opts.doors = v;
        syncToolbar();
        rebuild();
      },
      setBrush: id => {
        brush = id;
        syncToolbar();
      },
      exportPNG,
      render: () => renderer.render(scene, camera),
      meshCount: () => {
        let n = 0;
        if (model) model.traverse(o => o.isMesh && n++);
        return n;
      },
      /** 世界座標點在螢幕上的位置（測試用） */
      project(x, y, z) {
        const c = new THREE.Vector3(x, y, z).project(camera);
        const r = renderer.domElement.getBoundingClientRect();
        return { x: r.left + ((c.x + 1) / 2) * r.width, y: r.top + ((1 - c.y) / 2) * r.height };
      },
      /** 物件在螢幕上的位置（測試用） */
      screenOf(id) {
        let obj = null;
        model.traverse(o => {
          if (!obj && o.userData.itemId === id) obj = o;
        });
        if (!obj) return null;
        const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3()).project(camera);
        const r = renderer.domElement.getBoundingClientRect();
        return { x: r.left + ((c.x + 1) / 2) * r.width, y: r.top + ((1 - c.y) / 2) * r.height };
      },
    };
  }

  resize();
  rebuild();
  syncToolbar();
  raf = requestAnimationFrame(loop);

  return {
    refresh: rebuild,
    exportPNG,
    destroy() {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(anim);
      clearTimeout(tmr);
      listener = null;
      ro.disconnect();
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("keydown", escKey);
      controls.dispose();
      if (model) disposeTree(model);
      if (selBox) selBox.geometry.dispose();
      for (const m of Object.values(M)) m.dispose();
      ground.geometry.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss && renderer.forceContextLoss();
      delete window.__fp3d;
      host.innerHTML = "";
    },
  };
}

function toolbarHTML(o) {
  const mode = (id, label, tip) => `<button class="tb" data-v3mode="${id}" title="${t(tip)}">${t(label)}</button>`;
  const pre = (id, label) =>
    `<button class="tb" data-v3preset="${id}" title="${t("視角：{v}", { v: t(label) })}">${t(label)}</button>`;
  return `<div class="v3d">
  <div class="v3d-bar">
    <span class="seg">${mode("orbit", "🔄 環繞", "環繞檢視：拖曳旋轉、右鍵平移、滾輪縮放")}${mode("top", "⬇ 俯視", "由上往下看（平行投影）")}${mode("walk", "🚶 漫遊", "第一人稱漫遊：WASD 移動、拖曳轉頭")}</span>
    <span class="seg">${pre("front", "前")}${pre("back", "後")}${pre("left", "左")}${pre("right", "右")}${pre("iso", "等角")}</span>
    <label title="${t("門片與櫃門的開啟程度")}">${t("門片／櫃門")} <select id="v3Doors"><option value="0">${t("關")}</option><option value="0.5">${t("半開")}</option><option value="1">${t("全開")}</option></select></label>
    <button class="tb" id="v3Anim" title="${t("播放開關門動畫")}">▶ ${t("開關門")}</button>
    <span class="tsep"></span>
    <label title="${t("剖切高度：隱藏此高度以上的部分")}"><input type="checkbox" id="v3Cut"> ${t("剖切")} <input type="range" id="v3CutH" min="20" max="400" step="5"> <span id="v3CutV" class="muted"></span></label>
    <label><input type="checkbox" id="v3Ceil"> ${t("隱藏天花板")}</label>
    <label title="${t("視線前方的牆自動隱藏（娃娃屋檢視）")}"><input type="checkbox" id="v3Doll"> ${t("牆體透明")}</label>
    <label><input type="checkbox" id="v3Night"> ${t("夜間模式")}</label>
    <label><input type="checkbox" id="v3Shadow"> ${t("陰影")}</label>
    <label><input type="checkbox" id="v3Labels"> ${t("房間名稱")}</label>
    <label>${t("牆高")} <select id="v3WallTop"><option value="ceil">${t("到天花板")}</option><option value="slab">${t("到樓板")}</option></select></label>
    <label id="v3EyeL">${t("視角高度")} <input type="number" id="v3Eye" min="30" max="260" step="5" style="width:58px"> cm</label>
    <details class="v3layers"><summary>${t("圖層")}</summary><div>${LAYERS.map(
      k =>
        `<label><input type="checkbox" data-v3layer="${k}" ${o.layers[k] !== false ? "checked" : ""}> ${t(LAYER_NAMES[k])}</label>`,
    ).join("")}</div></details>
    <span class="tsep"></span>
    <button class="tb" id="v3Brush" title="${t("材質刷：選一個材質後點牆面、地板、天花或物件套用")}"></button>
    <button class="tb" id="v3Shot" title="${t("把目前畫面存成 PNG")}">📷 ${t("匯出圖片")}</button>
  </div>
  <div class="v3d-stage"><div class="v3d-hint"></div></div>
</div>`;
}
