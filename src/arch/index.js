// 裝修模組：地坪、天花（平釘／降板／間照／假樑／窗簾盒／格柵）、牆面裝修、窗簾、門片、「裝修」分頁、數量估算
import { t } from "../core/i18n.js";
import { DEFAULTS, LIB, registerCatalog } from "../shapes/library.js";
import { EXT, registerPTab, registerSchedule } from "../ext/registry.js";
import { CATALOGS } from "./catalog.js";
import { DRAW2D } from "./draw2d.js";
import { BUILD3D } from "./build3d.js";
import { ELEV2D } from "./elev.js";
import { registerProps } from "./props.js";
import { FINISH_TAB } from "./finish-tab.js";
import { archRows } from "./schedule.js";
import { CEIL_TYPES, CURTAIN_TYPES, DOOR_TYPES, FLOOR_TYPES, WALLFIN_TYPES } from "./helpers.js";

export {
  floorZonesAt,
  interiorArea,
  itemMat,
  openingSpec,
  wallFaceMat,
  wallNormal,
  faceInside,
  faceRoom,
} from "./helpers.js";
export { cmBox, box, ribbon } from "./build3d.js";
export { archRows } from "./schedule.js";

export const ARCH_TYPES = [...FLOOR_TYPES, ...CEIL_TYPES, ...WALLFIN_TYPES, ...CURTAIN_TYPES];

import { rollTableProps } from "./rolltable.js";
export function register() {
  // 元件庫：放在家具之後、門牆標示之前
  const di = LIB.findIndex(c => c.items.some(i => i.type === "swingDoor")),
    at = di < 0 ? LIB.length : di;
  CATALOGS.forEach((c, k) => registerCatalog(c, at + k));
  Object.assign(EXT.draw2d, DRAW2D);
  // 門類元件已有平面圖例（draw.js），這裡只補 3D 與立面
  Object.assign(EXT.build3d, BUILD3D);
  Object.assign(EXT.elev2d, ELEV2D);
  for (const k of ARCH_TYPES) EXT.noScopeCheck.add(k);
  // 門元件的預設門片／門框材質
  for (const k of DOOR_TYPES) {
    const d = DEFAULTS[k];
    if (!d) continue;
    d.leafMatPref ||= ["wood-oak", ["wood", "laminate"]];
    d.frameMatPref ||= ["wood-white", ["wood", "laminate", "metal"]];
  }
  registerProps(EXT);
  EXT.props.rollTable = rollTableProps;
  registerPTab(FINISH_TAB);
  registerSchedule({ id: "arch", name: t("裝修工程"), rows: archRows });
}
export function init() {}
