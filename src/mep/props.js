// 水電空調的屬性面板區塊
import { t } from "../core/i18n.js";
import { state } from "../core/store.js";
import { esc, toast } from "../core/dom.js";
import { DEFAULTS } from "../shapes/library.js";
import { setTool } from "../canvas/interact.js";
import { EXT } from "../ext/registry.js";
import { DUCT_TYPES, LIGHT_TYPES, MEP_TYPES, POLY_TYPES, POWER_TYPES, SWITCH_TYPES } from "./catalog.js";
import { centerOf, circuits, fitPts, polyLen, val, worldPts } from "./util.js";

const row = (label, inner) => `<div class="row"><span>${label}</span>${inner}</div>`;
const sel = (id, opts, v) =>
  `<select id="${id}">${opts.map(([k, l]) => `<option value="${k}" ${String(v) === String(k) ? "selected" : ""}>${l}</option>`).join("")}</select>`;
const num = (id, v, attrs = "") => `<input id="${id}" type="number" value="${v ?? ""}" ${attrs}>`;
function circuitRow(it) {
  return row(
    t("迴路"),
    `<input id="mCircuit" list="mCircuitList" value="${esc(it.circuit || "")}" placeholder="L1 / P1"><datalist id="mCircuitList">${circuits()
      .map(c => `<option value="${esc(c)}">`)
      .join("")}</datalist>`,
  );
}
const noteRow = it =>
  row(t("備註"), `<input id="mNote" type="text" value="${esc(it.note || "")}" placeholder="${t("例如：品牌型號")}">`);

function bindCommon(it, api) {
  const $ = api.$;
  const on = (id, fn, ev = "change") => {
    const e = $(id);
    if (e)
      e.addEventListener(ev, () => {
        fn(e.value, e);
        api.commit();
        api.rerender();
      });
  };
  on("mCircuit", v => (it.circuit = v.trim() || undefined));
  on("mNote", v => (it.note = v || undefined));
  on("mWatt", v => (it.watt = Math.max(0, +v || 0)));
  on("mCct", v => (it.cct = +v));
  on("mDrop", v => (it.drop = Math.max(0, +v || 0)));
  on("mHeads", v => (it.heads = Math.max(1, Math.round(+v || 1))));
  on("mCmh", v => (it.cmh = Math.max(0, +v || 0)));
  on("mKw", v => (it.kw = Math.max(0, +v || 0)));
  on("mStyle", v => (it.style = v));
  on("mDia", v => {
    if (it.type === "downlight") {
      const cx = it.x + it.w / 2,
        cy = it.y + it.d / 2;
      it.dia = +v;
      it.w = it.d = +v;
      it.x = cx - it.w / 2;
      it.y = cy - it.d / 2;
    } else it.dia = +v;
  });
  on("mDuctType", v => {
    it.type = v;
    it.label = DEFAULTS[v].name;
  });
  on("mKind", v => {
    it.kind = v;
    it.layer = v === "light" ? "light" : "power";
  });
  on("mStraight", (v, e) => (it.straight = e.checked || undefined));
  const ep = $("mEditPts");
  if (ep) ep.onclick = () => setTool("editPts");
  const rv = $("mReverse");
  if (rv)
    rv.onclick = () => {
      fitPts(it, worldPts(it).reverse());
      api.commit();
      api.rerender();
    };
}

const lightProps = {
  html(it) {
    return (
      `<b style="display:block;margin-top:10px">${t("燈具")}</b>` +
      (it.type === "downlight"
        ? row(
            t("開孔尺寸"),
            sel(
              "mDia",
              [
                [9, "9 cm"],
                [12, "12 cm"],
                [15, "15 cm"],
              ],
              val(it, "dia"),
            ),
          )
        : "") +
      (it.type !== "smoke" ? row(t("瓦數 (W)"), num("mWatt", val(it, "watt"), 'min="0" step="1"')) : "") +
      (val(it, "cct") != null
        ? row(
            t("色溫"),
            sel(
              "mCct",
              [2700, 3000, 3500, 4000, 5000, 6500].map(k => [k, k + "K"]),
              val(it, "cct"),
            ),
          )
        : "") +
      (it.type === "pendant" ? row(t("吊線長 (cm)"), num("mDrop", val(it, "drop"), 'min="0"')) : "") +
      (it.type === "trackLight" ? row(t("燈頭數"), num("mHeads", val(it, "heads"), 'min="1" max="20"')) : "") +
      circuitRow(it) +
      noteRow(it)
    );
  },
  bind: bindCommon,
};

const switchProps = {
  html(it) {
    const lights = state.items.filter(i => LIGHT_TYPES.has(i.type));
    return (
      `<b style="display:block;margin-top:10px">${t("開關")}</b>` +
      circuitRow(it) +
      noteRow(it) +
      `<b style="display:block;margin-top:10px">${t("連到燈具")}</b>` +
      (lights.length
        ? `<div class="mep-pick">${lights
            .map(
              l =>
                `<label><input type="checkbox" data-light="${l.id}" ${it.circuit && l.circuit === it.circuit ? "checked" : ""}> ${esc(l.label || DEFAULTS[l.type].name)} #${l.id}${l.circuit ? ` <small>${esc(l.circuit)}</small>` : ""}</label>`,
            )
            .join("")}</div>
           <div class="actions"><button id="mLink">〰 ${t("產生配線")}</button></div>
           <div class="muted" style="font-size:12px">${t("勾選燈具後產生從開關到各燈具的配線，並設為同一迴路。")}</div>`
        : `<div class="muted" style="font-size:12px">${t("還沒有燈具。先從元件庫加入燈具。")}</div>`)
    );
  },
  bind(it, api) {
    bindCommon(it, api);
    const b = api.$("mLink");
    if (b)
      b.onclick = () => {
        const ids = [...document.querySelectorAll("#propBody [data-light]:checked")].map(e => +e.dataset.light);
        const n = linkSwitch(it, ids);
        if (n) toast(t("已產生 {n} 條配線（迴路 {c}）", { n, c: it.circuit }));
        api.commit();
        api.rerender();
      };
  },
};

/** 開關 → 燈具：產生弧線配線並設定同一迴路，回傳產生的條數 */
export function linkSwitch(sw, lightIds) {
  if (!lightIds.length) return 0;
  if (!sw.circuit) {
    const used = new Set(circuits());
    let k = 1;
    while (used.has("L" + k)) k++;
    sw.circuit = "L" + k;
  }
  const a = centerOf(sw);
  let prev = a,
    n = 0;
  // 依距離排序串接（開關 → 最近的燈 → 下一盞）
  const lights = lightIds.map(id => state.items.find(i => i.id === id)).filter(Boolean);
  const left = [...lights];
  while (left.length) {
    left.sort((p, q) => dist(centerOf(p), prev) - dist(centerOf(q), prev));
    const l = left.shift(),
      b = centerOf(l);
    l.circuit = sw.circuit;
    const w = {
      id: state.nextId++,
      type: "wire",
      label: DEFAULTS.wire.name,
      x: 0,
      y: 0,
      w: 1,
      d: 1,
      rot: 0,
      z: state.nextId,
      kind: "light",
      layer: "light",
      circuit: sw.circuit,
      showName: false,
      from: prev === a ? sw.id : undefined,
      to: l.id,
    };
    fitPts(w, [prev, b]);
    state.items.push(w);
    prev = b;
    n++;
  }
  return n;
}
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

const powerProps = {
  html(it) {
    return `<b style="display:block;margin-top:10px">${t("插座・弱電")}</b>` + circuitRow(it) + noteRow(it);
  },
  bind: bindCommon,
};

const ductProps = {
  html(it) {
    const L = polyLen(worldPts(it));
    return (
      `<b style="display:block;margin-top:10px">${t("風管")}</b>` +
      row(
        t("種類"),
        sel(
          "mDuctType",
          DUCT_TYPES.map(k => [k, DEFAULTS[k].name]),
          it.type,
        ),
      ) +
      row(
        t("管徑"),
        sel(
          "mDia",
          [7.5, 10, 15, 20, 25].map(v => [v, `Ø${v * 10} mm`]),
          val(it, "dia"),
        ),
      ) +
      `<div class="muted" style="font-size:12px">${t("長度 {l} m・{n} 個節點・中心高度請用上方「離地」", { l: (L / 100).toFixed(2), n: it.pts ? it.pts.length : 2 })}</div>` +
      `<div class="actions"><button id="mEditPts">✎ ${t("編輯節點")}</button><button id="mReverse">⇄ ${t("反轉方向")}</button></div>` +
      noteRow(it)
    );
  },
  bind: bindCommon,
};

const wireProps = {
  html(it) {
    const L = polyLen(worldPts(it));
    return (
      `<b style="display:block;margin-top:10px">${it.type === "conduit" ? t("配管") : t("配線")}</b>` +
      (it.type === "wire"
        ? row(
            t("類別"),
            sel(
              "mKind",
              [
                ["light", t("燈具迴路")],
                ["power", t("插座迴路")],
                ["data", t("弱電")],
              ],
              val(it, "kind"),
            ),
          )
        : "") +
      circuitRow(it) +
      `<div class="muted" style="font-size:12px">${t("長度 {l} m", { l: (L / 100).toFixed(2) })}</div>` +
      (it.type === "wire"
        ? `<label class="toggle" style="margin-top:6px"><input id="mStraight" type="checkbox" ${it.straight ? "checked" : ""}>${t("直線（不畫弧線）")}</label>`
        : "") +
      `<div class="actions"><button id="mEditPts">✎ ${t("編輯節點")}</button></div>` +
      noteRow(it)
    );
  },
  bind: bindCommon,
};

const hvacProps = {
  html(it) {
    return (
      `<b style="display:block;margin-top:10px">${t("空調・全熱交換")}</b>` +
      (it.type === "ervUnit" ? row(t("風量 (m³/h)"), num("mCmh", val(it, "cmh"), 'min="0" step="10"')) : "") +
      (it.type === "acIndoor" ? row(t("能力 (kW)"), num("mKw", val(it, "kw"), 'min="0" step="0.1"')) : "") +
      (it.type === "diffuser"
        ? row(
            t("樣式"),
            sel(
              "mStyle",
              [
                ["round", t("圓形")],
                ["square", t("方形")],
                ["linear", t("線型")],
              ],
              val(it, "style"),
            ),
          )
        : "") +
      noteRow(it)
    );
  },
  bind: bindCommon,
};

export function registerProps() {
  for (const type of MEP_TYPES) {
    if (LIGHT_TYPES.has(type)) EXT.props[type] = lightProps;
    else if (SWITCH_TYPES.has(type)) EXT.props[type] = switchProps;
    else if (POWER_TYPES.has(type)) EXT.props[type] = powerProps;
    else if (DUCT_TYPES.includes(type)) EXT.props[type] = ductProps;
    else if (POLY_TYPES.has(type)) EXT.props[type] = wireProps;
    else EXT.props[type] = hvacProps;
  }
}
