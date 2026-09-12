import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultCatalog } from "../dist/assets/catalog.js";
import { calculateProjectBom } from "../dist/assets/calculation.js";
import {
  createEngineeringJoint,
  jointLengthMm,
  jointStatus,
  normalizeEngineeringJoint,
  normalizeEngineeringJoints
} from "../dist/assets/joints.js";

function makeWindow(windowId, quantity = 2) {
  return {
    windowId,
    mark: windowId,
    name: "工程窗",
    quantity,
    widthMm: 1800,
    heightMm: 1500,
    seriesId: "AL70",
    colorInside: "RAL9016",
    colorOutside: "RAL7016",
    defaultGlassTypeId: "GL-LOWE-24",
    defaultHardwareSetId: "HW-TURN-STD",
    geometryMode: "grid",
    layout: {
      columns: [1],
      rows: [1],
      cells: [{ cellId: `${windowId}-CELL`, type: "fixed_glass", opening: "fixed" }]
    }
  };
}

const windows = [makeWindow("W-A"), makeWindow("W-B")];
const series = defaultCatalog.profileSystems[0];

const corner = createEngineeringJoint("corner", windows[0], series);
Object.assign(corner, {
  jointId: "J-CORNER",
  style: "universal",
  orientation: "reversed",
  connectedWindowIds: ["W-A", "W-B"],
  angleDeg: 135,
  fastenerSpacingMm: 300
});

const splice = createEngineeringJoint("splice", windows[0], series);
Object.assign(splice, {
  jointId: "J-SPLICE",
  hostEdge: "bottom",
  span: { startRatio: 0.1, endRatio: 0.9 },
  connectedWindowIds: ["W-A", "W-B"]
});

const postless = normalizeEngineeringJoint({
  ...corner,
  jointId: "J-POSTLESS",
  style: "curved",
  postMode: "postless",
  span: { startRatio: 0, endRatio: 0.5 }
}, new Set(windows.map(win => win.windowId)));

assert.equal(corner.profileId, "AL70-CORNER-90", "corner joints should inherit the series corner profile");
assert.equal(splice.profileId, "AL70-SPLICE", "splice joints should inherit the series splice profile");
assert.equal(jointLengthMm(corner, windows[0]), 1500, "vertical edge joints should use the window height");
assert.equal(jointLengthMm(splice, windows[0]), 1440, "horizontal partial joints should use the selected width span");
assert.equal(jointStatus(corner).label, "已连接2樘窗", "joint status should report connected windows");

const normalized = normalizeEngineeringJoints([
  corner,
  splice,
  postless,
  { ...splice, jointId: "J-ORPHAN", hostWindowId: "W-MISSING" },
  { ...splice, jointId: "J-SPLICE" }
], windows);
assert.equal(normalized.length, 3, "normalization should remove orphan and duplicate engineering joints");
assert.equal(normalized[0].angleDeg, 135, "corner angle should survive normalization");
assert.equal(normalized[1].angleDeg, 180, "splice joints should always normalize to 180 degrees");

const bom = calculateProjectBom({
  catalog: structuredClone(defaultCatalog),
  calculation: { status: "calculated", mbomVersion: 1 },
  windows,
  joints: normalized
});

const jointEbom = bom.ebom.filter(item => item.type === "engineering_joint");
assert.equal(jointEbom.length, 3, "each project joint should appear exactly once in EBOM");
assert.ok(jointEbom.every(item => item.ownership === "W-A"), "BOM ownership should stay with the host window");

const cornerProfile = bom.mbom.lines.find(line => line.sourceComponentId === "joint.J-CORNER.profile");
assert.equal(cornerProfile.materialCode, "AL70-CORNER-90");
assert.equal(cornerProfile.quantity, 2, "joint quantities should follow the owning window quantity");
assert.equal(cornerProfile.jointAngleDeg, 135);

const spliceProfile = bom.mbom.lines.find(line => line.sourceComponentId === "joint.J-SPLICE.profile");
assert.equal(spliceProfile.lengthMm, 1440);
assert.equal(spliceProfile.quantity, 2);

const cornerFasteners = bom.mbom.lines.find(line => line.sourceComponentId === "joint.J-CORNER.fastener");
assert.equal(cornerFasteners.quantity, 12, "fasteners should follow edge length, spacing, and window quantity");
const cornerSeal = bom.mbom.lines.find(line => line.sourceComponentId === "joint.J-CORNER.seal");
assert.equal(cornerSeal.quantity, 3, "corner seal should be measured in total metres");
assert.equal(
  bom.mbom.lines.some(line => line.sourceComponentId === "joint.J-POSTLESS.profile"),
  false,
  "postless corner joints should omit the profile line"
);
assert.ok(
  bom.mbom.lines.some(line => line.sourceComponentId === "joint.J-POSTLESS.seal" && line.materialCode === "SEAL-CORNER-POSTLESS"),
  "postless corner joints should retain their dedicated seal"
);

const schema = JSON.parse(readFileSync(new URL("../docs/door-window-design.v2.schema.json", import.meta.url), "utf8"));
assert.ok(schema.required.includes("joints"), "v2 projects should explicitly carry project-level joints");
assert.ok(schema.$defs.engineeringJoint, "v2 schema should define engineering joints");

const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
[
  "btnAddSpliceJoint",
  "btnAddCornerJoint",
  "inspector-joint",
  "jointDetailPreview",
  "jointContextMenu",
  "newSpliceCode",
  "newCornerCode"
].forEach(id => assert.ok(html.includes(`id="${id}"`), `${id} should be available in the drawing workbench`));

console.log("Validated engineering-joint normalization, project ownership, BOM quantities, UI hooks, and the v2 JSON contract.");
