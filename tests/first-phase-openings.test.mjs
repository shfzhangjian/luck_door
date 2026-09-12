import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../dist/assets/vendor/three/three.module.min.js";
import { defaultCatalog } from "../dist/assets/catalog.js";
import { calculateProjectBom } from "../dist/assets/calculation.js";
import {
  OPERABLE_TYPES,
  applyOpeningTransform,
  cornerSlidingMotionVectors,
  foldingPlanProjections,
  normalizeOpeningAssembly,
  normalizeOpening,
  openingAssemblySummary,
  openingPlanProjection,
  openingTransformState,
  openingOptionsForType
} from "../dist/assets/openings.js";

const cases = [
  ["turn", "left_in"],
  ["turn_tilt", "right_in"],
  ["top_hung", "top_out"],
  ["bottom_hung", "bottom_in"],
  ["sliding", "slide_left"],
  ["lift_slide", "lift_slide_right"],
  ["psk", "psk_left"],
  ["parallel_slide", "parallel_slide_right"],
  ["parallel_project", "parallel_out"],
  ["pocket_slide", "pocket_both"],
  ["corner_slide", "corner_both"],
  ["vertical_slide", "slide_up"],
  ["folding", "fold_left"],
  ["door", "right_out"]
];

assert.deepEqual(cases.map(([type]) => type), [...OPERABLE_TYPES]);

const schema = JSON.parse(readFileSync(new URL("../docs/door-window-design.v1.schema.json", import.meta.url), "utf8"));
const schemaTypes = new Set(schema.$defs.cell.properties.type.enum);
const schemaOpenings = new Set(schema.$defs.cell.properties.opening.enum);
const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
assert.ok(schema.$defs.cell.properties.openingAssembly, "cells should expose the opening assembly JSON contract");
assert.ok(schema.$defs.openingAssembly, "schema should define opening assemblies");
[
  "assemblyPanelCount",
  "assemblyActivePanelCount",
  "assemblyTrackCount",
  "assemblyStackSide",
  "assemblyPrimarySide",
  "assemblyMullionMode",
  "assemblyOpenPlane",
  "assemblyOperationPriority",
  "assemblyVentilationMode",
  "assemblyTrafficDoor",
  "assemblyScreenMode",
  "assemblyCornerAngle",
  "assemblyCornerPostMode",
  "assemblyPocketDepth"
].forEach(id => assert.ok(html.includes(`id="${id}"`), `${id} should be present in the selected-component inspector`));

for (const [type, opening] of cases) {
  const options = openingOptionsForType(type);
  assert.ok(schemaTypes.has(type), `${type} should be part of the design JSON schema`);
  assert.ok(html.includes(`data-cell-preset="${type}"`), `${type} should be available in the drawing palette`);
  options.forEach(item => assert.ok(schemaOpenings.has(item.value), `${item.value} should be part of the design JSON schema`));
  assert.ok(options.some(item => item.value === opening), `${type} should expose ${opening}`);
  assert.equal(normalizeOpening(type, "invalid"), options[0].value);

  const object = new THREE.Group();
  const foldSegments = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  const part = {
    type,
    cell: { opening },
    object,
    closedPosition: object.position.clone(),
    width: 2,
    height: 1.6,
    travel: 0.8,
    travelVector: { x: 0.5, z: -0.5 },
    liftHeight: 0.06,
    releaseDepth: 0.08,
    projectDepth: 0.3,
    direction: opening.endsWith("right") || opening === "slide_up" ? 1 : -1,
    foldSegments,
    motionMode: ["turn_tilt", "psk"].includes(type) ? "tilt" : "primary"
  };
  applyOpeningTransform(part, 0.7);
  const rotated = Math.abs(object.rotation.x) + Math.abs(object.rotation.y) + Math.abs(object.rotation.z) > 0.000001;
  const moved = object.position.lengthSq() > 0.000001 || rotated;
  const folded = foldSegments.some(segment => Math.abs(segment.rotation.y) > 0.001);
  assert.ok(moved || folded, `${type} should change its 3D transform`);
}

const assemblyOverrides = {
  turn: { panelCount: 2, activePanelCount: 2, primarySide: "right", mullionMode: "flying_mullion", screenMode: "swing" },
  turn_tilt: { operationPriority: "tilt_first", ventilationMode: "micro" },
  sliding: { panelCount: 6, activePanelCount: 4, trackCount: 4, stackSide: "both", screenMode: "sliding" },
  lift_slide: { panelCount: 4, activePanelCount: 3, trackCount: 3, stackSide: "right" },
  psk: { panelCount: 2, activePanelCount: 1, operationPriority: "slide_first", ventilationMode: "tilt" },
  parallel_slide: { panelCount: 3, activePanelCount: 2, trackCount: 2, stackSide: "right" },
  pocket_slide: { panelCount: 2, activePanelCount: 2, trackCount: 1, stackSide: "both", pocketDepthMm: 1200 },
  corner_slide: { panelCount: 6, activePanelCount: 4, trackCount: 2, stackSide: "both", cornerAngleDeg: 135, cornerPostMode: "postless" },
  vertical_slide: { activePanelCount: 2, stackSide: "both" },
  folding: { panelCount: 8, stackSide: "both", openPlane: "out", trafficDoor: "left", screenMode: "retractable" }
};
const cells = cases.map(([type, opening]) => ({
  type,
  opening,
  openingAssembly: normalizeOpeningAssembly(type, opening, assemblyOverrides[type])
}));

assert.deepEqual(cells[0].openingAssembly.operationSequence, ["P2", "P1"], "right master sash should operate before the left secondary sash");
assert.equal(cells[4].openingAssembly.panelCount, 6, "sliding assemblies should support six panels");
assert.equal(cells[4].openingAssembly.trackCount, 4, "sliding assemblies should support four tracks");
assert.deepEqual(cells[4].openingAssembly.operationSequence, ["P3", "P2", "P4", "P5"], "double-stack sliding should open from the center toward both fixed outer panels");
assert.equal(cells[4].openingAssembly.panels[0].movable, false, "double-stack sliding should retain the left outer fixed panel");
assert.equal(cells[4].openingAssembly.panels[5].movable, false, "double-stack sliding should retain the right outer fixed panel");
const cellByType = Object.fromEntries(cells.map(cell => [cell.type, cell]));
const sourceId = type => `cell.1.${cases.findIndex(([candidate]) => candidate === type) + 1}`;
assert.equal(cellByType.vertical_slide.openingAssembly.activePanelCount, 2, "vertical sliding assemblies should support double-hung motion");
assert.equal(cellByType.folding.openingAssembly.activePanelCount, 8, "all folding panels should remain active");
assert.equal(cellByType.psk.openingAssembly.operationPriority, "slide_first", "PSK should preserve slide-first handle logic");
assert.equal(cellByType.corner_slide.openingAssembly.cornerAngleDeg, 135, "corner sliding should preserve the configured angle");
assert.equal(cellByType.corner_slide.openingAssembly.cornerPostMode, "postless", "corner sliding should preserve postless construction");
assert.equal(cellByType.pocket_slide.openingAssembly.pocketDepthMm, 1200, "pocket sliding should preserve the wall-cavity depth");
assert.match(openingAssemblySummary("folding", cellByType.folding.openingAssembly), /8扇.*双向收.*卷轴纱/);
assert.match(openingAssemblySummary("corner_slide", cellByType.corner_slide.openingAssembly), /135°转角.*无转角柱/);
const project = {
  catalog: structuredClone(defaultCatalog),
  calculation: { status: "calculated", mbomVersion: 1 },
  windows: [{
    windowId: "W-TEST",
    mark: "C-TEST",
    quantity: 1,
    widthMm: 8400,
    heightMm: 1800,
    seriesId: "AL70",
    colorInside: "RAL9016",
    colorOutside: "RAL7016",
    defaultGlassTypeId: "GL-LOWE-24",
    defaultHardwareSetId: "HW-TURN-STD",
    layout: {
      columns: cells.map(() => 1),
      rows: [1],
      cells
    }
  }]
};

const bom = calculateProjectBom(project);
for (const type of OPERABLE_TYPES) {
  assert.ok(bom.ebom.some(item => item.type === type), `${type} should be represented in EBOM`);
}

const expectedHardware = [
  "HW-BS-02",
  "HW-BS-01",
  "HW-HUNG-HANDLE",
  "HW-SL-01",
  "HW-LS-HANDLE",
  "HW-PSK-HANDLE",
  "HW-PS-HANDLE",
  "HW-PP-HANDLE",
  "HW-PK-HANDLE",
  "HW-CS-HANDLE",
  "HW-VS-LOCK",
  "HW-FOLD-HANDLE",
  "HW-LOCK-01"
];
const hardwareCodes = new Set(bom.mbom.lines.filter(line => line.category === "hardware").map(line => line.materialCode));
expectedHardware.forEach(code => assert.ok(hardwareCodes.has(code), `${code} should be present in MBOM`));

const foldingGlass = bom.mbom.lines.find(line => line.sourceComponentId === `${sourceId("folding")}.glass`);
assert.equal(foldingGlass?.quantity, 8, "folding cells should calculate the configured glazed panels");

const expectedGlassPanels = new Map([
  [`${sourceId("turn")}.glass`, 2],
  [`${sourceId("sliding")}.glass`, 6],
  [`${sourceId("lift_slide")}.glass`, 4],
  [`${sourceId("psk")}.glass`, 2],
  [`${sourceId("parallel_slide")}.glass`, 3],
  [`${sourceId("parallel_project")}.glass`, 1],
  [`${sourceId("pocket_slide")}.glass`, 2],
  [`${sourceId("corner_slide")}.glass`, 6],
  [`${sourceId("vertical_slide")}.glass`, 2]
]);
expectedGlassPanels.forEach((quantity, sourceComponentId) => {
  const line = bom.mbom.lines.find(item => item.sourceComponentId === sourceComponentId);
  assert.equal(line?.quantity, quantity, `${sourceComponentId} should use the configured panel count`);
});

const expectedTracks = new Map([
  [`${sourceId("sliding")}.track`, 4],
  [`${sourceId("lift_slide")}.track`, 3],
  [`${sourceId("psk")}.track`, 1],
  [`${sourceId("parallel_slide")}.track`, 2],
  [`${sourceId("pocket_slide")}.track`, 1],
  [`${sourceId("corner_slide")}.track`, 4],
  [`${sourceId("vertical_slide")}.track`, 2],
  [`${sourceId("folding")}.track`, 1]
]);
expectedTracks.forEach((quantity, sourceComponentId) => {
  const line = bom.mbom.lines.find(item => item.sourceComponentId === sourceComponentId);
  assert.equal(line?.quantity, quantity, `${sourceComponentId} should use the configured track count`);
});

assert.equal(bom.mbom.lines.find(line => line.sourceComponentId === `${sourceId("turn")}.handle`)?.quantity, 2, "double casement should calculate two handle sets");
assert.ok(bom.mbom.lines.some(line => line.sourceComponentId === `${sourceId("turn")}.flyingMullion`), "double casement should calculate a flying mullion");
assert.ok(bom.mbom.lines.some(line => line.materialCode === "ACC-SCREEN-SWING"), "swing screens should be included in MBOM");
assert.ok(bom.mbom.lines.some(line => line.materialCode === "ACC-SCREEN-SLIDE"), "sliding screens should be included in MBOM");
assert.ok(bom.mbom.lines.some(line => line.materialCode === "ACC-SCREEN-ROLL"), "retractable screens should be included in MBOM");
assert.ok(bom.mbom.lines.some(line => line.materialCode === "HW-VENT-MICRO"), "micro-ventilation hardware should be included in MBOM");
assert.ok(bom.mbom.lines.some(line => line.materialCode === "HW-FOLD-TRAFFIC"), "folding traffic-door hardware should be included in MBOM");
assert.ok(bom.mbom.lines.some(line => line.materialCode === "ACC-POCKET-CASSETTE"), "pocket cassettes should be included in MBOM");
assert.ok(bom.mbom.lines.some(line => line.materialCode === "HW-CORNER-SEAL"), "postless corner seals should be included in MBOM");
assert.equal(bom.ebom.find(item => item.sourceComponentId === sourceId("sliding"))?.openingAssembly.trackCount, 4, "EBOM should retain opening assembly semantics");

const retractable = new THREE.Group();
const retractablePart = {
  motionType: "retractable_screen",
  object: retractable,
  closedPosition: retractable.position.clone(),
  closedScale: retractable.scale.clone(),
  direction: 1,
  width: 2
};
applyOpeningTransform(retractablePart, 1);
assert.ok(retractable.scale.x < 0.1 && retractable.position.x > 0, "retractable screens should roll toward their cassette");

const pskPrimary = new THREE.Group();
applyOpeningTransform({
  type: "psk",
  openPlane: "in",
  motionMode: "primary",
  object: pskPrimary,
  closedPosition: pskPrimary.position.clone(),
  width: 2,
  height: 1.6,
  travel: 0.8,
  releaseDepth: 0.1,
  direction: -1
}, 1);
assert.ok(pskPrimary.position.x < 0 && pskPrimary.position.z < 0, "PSK primary motion should release toward the interior before sliding");

const topHungOut = new THREE.Group();
applyOpeningTransform({
  type: "top_hung",
  cell: { opening: "top_out" },
  object: topHungOut,
  closedPosition: topHungOut.position.clone(),
  width: 1.2,
  height: 1.4
}, 1);
assert.ok(topHungOut.position.z > 0, "top-hung outward opening should move toward the exterior +Z side");

const bottomHungIn = new THREE.Group();
applyOpeningTransform({
  type: "bottom_hung",
  cell: { opening: "bottom_in" },
  object: bottomHungIn,
  closedPosition: bottomHungIn.position.clone(),
  width: 1.2,
  height: 1.4
}, 1);
assert.ok(bottomHungIn.position.z < 0, "bottom-hung inward opening should move toward the interior -Z side");

const parallelProject = new THREE.Group();
let parallelMechanismRatio = -1;
applyOpeningTransform({
  type: "parallel_project",
  object: parallelProject,
  closedPosition: parallelProject.position.clone(),
  projectDepth: 0.3,
  updateMechanism: ratio => {
    parallelMechanismRatio = ratio;
  }
}, 1);
assert.equal(parallelProject.position.z, 0.3, "parallel-project sashes should move toward the exterior +Z side when viewed from indoors");
assert.equal(parallelMechanismRatio, 1, "parallel-project sash motion should update its frame-mounted linkage at every opening ratio");

const cornerPanel = new THREE.Group();
cornerPanel.rotation.y = Math.PI / 2;
const rightCornerMotion = cornerSlidingMotionVectors(90, true, 0.8, 0.04);
applyOpeningTransform({
  type: "corner_slide",
  object: cornerPanel,
  closedPosition: cornerPanel.position.clone(),
  closedRotation: cornerPanel.rotation.clone(),
  ...rightCornerMotion
}, 1);
assert.ok(Math.abs(cornerPanel.rotation.y - Math.PI / 2) < 0.000001, "corner panels should retain their closed wing angle during translation");
assert.ok(cornerPanel.position.z < 0, "corner panels should translate along their wing vector");
assert.ok(cornerPanel.position.x > 0, "the right wing should release along its rotated local normal");
assert.ok(Math.abs(rightCornerMotion.travelVector.x * rightCornerMotion.releaseVector.x + rightCornerMotion.travelVector.z * rightCornerMotion.releaseVector.z) < 0.000001, "right-wing travel and release vectors should remain perpendicular");
const obliqueCornerMotion = cornerSlidingMotionVectors(135, true, 0.8, 0.04);
assert.ok(obliqueCornerMotion.travelVector.x < 0 && obliqueCornerMotion.travelVector.z < 0, "a 135-degree right wing should travel away from the corner along its own rail");
assert.ok(Math.abs(obliqueCornerMotion.travelVector.x * obliqueCornerMotion.releaseVector.x + obliqueCornerMotion.travelVector.z * obliqueCornerMotion.releaseVector.z) < 0.000001, "oblique right-wing release should remain normal to its rail");

const sharedTurnPart = {
  type: "turn",
  cell: { opening: "left_out" },
  width: 1.2,
  height: 1.5,
  depth: 0.08,
  closedPosition: { x: 2, y: 0, z: 0 }
};
const sharedTurnState = openingTransformState(sharedTurnPart, 1);
const sharedTurnObject = new THREE.Group();
sharedTurnObject.position.set(2, 0, 0);
applyOpeningTransform({ ...sharedTurnPart, object: sharedTurnObject }, 1);
assert.ok(Math.abs(sharedTurnObject.position.x - sharedTurnState.position.x) < 0.000001, "3D transforms should use the shared kinematic position");
assert.ok(Math.abs(sharedTurnObject.rotation.y - sharedTurnState.rotation.y) < 0.000001, "3D transforms should use the shared kinematic rotation");
const turnPlan = openingPlanProjection(sharedTurnPart, 1);
assert.equal(turnPlan.corners.length, 4, "a projected sash should expose a four-corner plan footprint");
assert.ok(Math.max(...turnPlan.corners.map(point => point.z)) > 0.9, "an outward casement should visibly project beyond the wall in plan");

const projectPlan = openingPlanProjection({
  type: "parallel_project",
  width: 1.4,
  height: 1.5,
  depth: 0.08,
  projectDepth: 0.32,
  closedPosition: { x: 0, y: 0, z: 0 }
}, 1);
assert.ok(projectPlan.position.z >= 0.32, "parallel-project plan footprints should retain the full 3D projection depth");

const foldingPlan = foldingPlanProjections({
  type: "folding",
  panelCount: 3,
  panelWidth: 0.7,
  width: 2.1,
  height: 1.6,
  depth: 0.08,
  direction: 1,
  openPlane: "out",
  closedPosition: { x: -1.05, y: 0, z: 0 }
}, 1);
assert.equal(foldingPlan.panels.length, 3, "folding plan projection should preserve every individual sash");
assert.ok(foldingPlan.panels.some(panel => panel.corners.some(point => Math.abs(point.z) > 0.2)), "folding plan projection should show the opened stack outside the wall line");

const app = readFileSync(new URL("../dist/assets/app.js", import.meta.url), "utf8");
const appLf = app.replace(/\r\n/g, "\n");
assert.ok(app.includes("function addCornerTrackFrame("), "corner sliding should build fixed front and return-track frames before movable panels");
assert.ok(app.includes("returnFrame.rotation.y = angle"), "the return track must use the configured structural corner angle");
assert.ok(app.includes("function addCornerReturnWall("), "corner sliding should build a return wall around the side opening");
assert.ok(app.includes("wallCornerMode: surround.wallCornerMode"), "wall-corner structure should be resolved from installation data instead of window-post settings");
assert.ok(app.includes("function resolvePlanCornerMount("), "the indoor/outdoor plan view should resolve the same corner mount");
assert.ok(app.includes("const anchorX = item.x + item.w;"), "the 2D corner should start at the last cell boundary instead of splitting the cell in half");
assert.ok(app.includes("const anchorX = width / 2;"), "the 3D corner should start at the full window boundary");
assert.ok(app.includes("const returnSpan = frontWingSpan;"), "the return-wall opening should retain a full corner-wing width");
assert.ok(app.includes("renderPlanWallBase(x, planY, drawW, outlineColor, frameColor, cornerMount, section)"), "the 2D plan wall should fold with the corner structure");
assert.ok(app.includes("plan-frame-overhang"), "the 2D plan wall should mark frames that project beyond the wall face");
assert.ok(app.includes("function bandPolygon("), "corner plan walls and frames should be drawn as closed plan bands instead of centerline strokes");
assert.ok(app.includes("function addMiteredWallBand("), "the front and return wall bands should be generated as one mitered corner body");
assert.ok(app.includes('mesh.userData.mountType = "continuous-corner-wall"'), "the 3D wall corner should remain a continuous host around the opening");
assert.ok(!app.includes("const cornerBodyDepth = Math.max(wallDepth"), "a full-height wall block must not occupy the corner-window opening");
assert.ok(app.includes("function addThreeOrientationLabels("), "the 3D installation scene should label its indoor and outdoor spaces");
assert.ok(app.includes('createThreeGroundSideLabel("室外"'), "the 3D installation scene should expose a stable outdoor ground marker");
assert.ok(app.includes('createThreeGroundSideLabel("室内"'), "the 3D installation scene should expose a stable indoor ground marker");
assert.ok(app.includes("const planClearance = Math.max(118, cornerRise + 70, planExtents.outside + 54)"), "the plan view should reserve clearance for projected sashes and corner walls");
assert.ok(app.includes("renderPlanView(win, rects, x, planY"), "the plan view should use its dynamically resolved baseline");
assert.ok(app.includes("Math.max(110, extents.inside + 54)"), "the overall plan dimension should remain below inward-opening sash projections");
assert.ok(app.includes("function buildPlanOpeningParts("), "the plan view should build one shared-kinematics descriptor per movable sash");
assert.ok(app.includes('data-plan-panel="${label}"'), "the plan should expose each projected sash as a distinct drawing element");
assert.ok(app.includes("function renderPlanMotionGuide("), "the plan should show a clear motion guide from closed position to opened position");
assert.ok(app.includes('marker-end="url(#planMotionArrow)"'), "the plan opening guide should include a direction arrow");
assert.ok(app.includes("const SHAPE_PRESETS = Object.freeze"), "the designer should maintain a single supported-shape catalog");
assert.ok(app.includes("function normalizeWindowShape("), "window shape data should be normalized before drawing or saving");
assert.ok(app.includes("function polygonFramePath("), "custom shape presets should render as real frame paths instead of inert buttons");
assert.ok(app.includes("function parseShapePointsText("), "DIY polygon frames should parse editable point coordinates");
assert.ok(app.includes("function insetPolygonTowardCentroid("), "DIY polygon frames should generate an inner frame path from the outer outline");
assert.ok(app.includes("function renderCustomShapeAnnotations("), "DIY polygon frames should display edge lengths and vertex angles");
assert.ok(app.includes("function polygonVertexAngle("), "DIY polygon angle labels should be derived from adjacent edges");
assert.ok(app.includes("function openDiyShapeEditor("), "DIY polygon modeling should open a dedicated blank drawing canvas");
assert.ok(app.includes("function handleDiyShapePointerDown("), "DIY polygon modeling should create vertices directly on the dedicated canvas");
assert.ok(app.includes("function saveDiyShapeElement("), "saving the DIY canvas should store a named reusable shape element");
assert.ok(app.includes("diyShapeEditor.closed"), "DIY polygon modeling should require closing the outline back to its first point");
assert.ok(app.includes('valueOf("diyShapeName").trim()'), "saving a DIY polygon should require a user-provided name");
assert.ok(app.includes("function renderCustomShapeLibrary("), "saved DIY outlines should appear in the drawing tool library");
assert.ok(app.includes("function applyCustomShapeElement("), "saved DIY outlines should be applied only when the user chooses them from the tool library");
assert.ok(app.includes("project.customShapes.push"), "saved DIY outlines should be retained in the project as reusable shape elements");
assert.ok(app.includes("function normalizeCellCustomShape("), "DIY outlines applied to a design should be normalized as cell-level geometry");
assert.ok(app.includes("cell.customShape = normalizeCellCustomShape"), "a saved DIY outline should attach to the selected cell instead of repainting the whole window");
assert.ok(app.includes("function cellCustomShapePath("), "2D elevations should render the selected cell with its DIY outline");
assert.ok(app.includes("function addThreeCustomCellGeometry("), "3D preview should build profile and glass geometry from the DIY cell outline");
assert.ok(app.includes("function addThreeCustomOperableCell("), "3D preview should animate the DIY outline itself when the cell is operable");
assert.ok(app.includes("sashWidth - sashFace * 2.35"), "parallel-project glazing should use the sash rebate instead of an arbitrary undersized pane ratio");
assert.ok(app.includes("function addParallelProjectMechanism("), "parallel-project sashes should include frame-mounted support hardware");
assert.ok(app.includes("function updateParallelProjectMechanism("), "parallel-project linkage geometry should update throughout the opening motion");
assert.ok(app.includes('root.userData.mountType = "parallel-project-hardware"'), "parallel-project hardware must remain outside the moving sash hierarchy");
assert.ok(app.includes("mechanism.armLength ** 2 - depthGap ** 2"), "parallel-project linkage arms should retain a fixed mechanical length while their frame pivots slide");
assert.ok(app.includes("normalizeSurround(win.installation?.surround).wallThicknessMm * drawW"), "the 2D indoor/outdoor plan should derive wall thickness from installation data");
assert.ok(appLf.includes("cornerSlidingMotionVectors(assembly.cornerAngleDeg, rightWing, travel, 0)") || appLf.includes("cornerSlidingMotionVectors(\n          assembly.cornerAngleDeg,\n          rightWing,\n          travel,\n          0"), "corner sliding panels should stay on their rail without a free-space release offset");
assert.ok(appLf.includes("updatePreviewSelection();\n      updatePreviewMotionReadout();"), "opening a selected panel should immediately remove its viewport outline");

console.log(`Validated ${OPERABLE_TYPES.length} operable types, opening assemblies, 3D transforms, JSON contracts, and combination BOM mappings.`);
