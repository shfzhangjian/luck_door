import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultCatalog } from "../dist/assets/catalog.js";
import { calculateProjectBom, buildInterfacePackage } from "../dist/assets/calculation.js";
import {
  assemblyBounds,
  assemblySummary,
  createAssemblyPlacement,
  hostEdgeForDock,
  normalizeWindowAssembly,
  placementGapForJoint,
  placementRotationForJoint,
  resolveAssemblyLayout
} from "../dist/assets/assemblies.js";
import { createEngineeringJoint } from "../dist/assets/joints.js";

function makeWindow(windowId, widthMm, heightMm) {
  return {
    windowId,
    mark: windowId,
    name: "组合窗",
    quantity: 1,
    widthMm,
    heightMm,
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

const windows = [
  makeWindow("W-A", 1800, 1500),
  makeWindow("W-B", 1200, 1200),
  makeWindow("W-C", 1000, 1200),
  makeWindow("W-D", 800, 600),
  makeWindow("W-E", 900, 900),
  makeWindow("W-F", 900, 900)
];
const series = defaultCatalog.profileSystems[0];
const cornerJoint = createEngineeringJoint("corner", windows[1], series);
Object.assign(cornerJoint, {
  jointId: "J-CORNER",
  connectedWindowIds: ["W-B", "W-C"],
  angleDeg: 90,
  legWidthAMm: 50,
  legWidthBMm: 100
});
const unrelatedJoint = createEngineeringJoint("splice", windows[0], series);
Object.assign(unrelatedJoint, {
  jointId: "J-UNRELATED",
  connectedWindowIds: ["W-A", "W-E"]
});

const sourceAssembly = {
  assemblyId: "WA-COURTYARD",
  name: "转角组合窗",
  rootWindowId: "W-A",
  placements: [
    { ...createAssemblyPlacement("W-B", "W-A", "right", { gapMm: 20 }), placementId: "WP-B" },
    { ...createAssemblyPlacement("W-C", "W-B", "right", { gapMm: 10, rotationDeg: 90, jointId: "J-CORNER" }), placementId: "WP-C" },
    { ...createAssemblyPlacement("W-D", "W-A", "top", { align: "start", gapMm: 30, offsetMm: 50 }), placementId: "WP-D" },
    { ...createAssemblyPlacement("W-E", "W-F", "right"), placementId: "WP-E-CYCLE" },
    { ...createAssemblyPlacement("W-F", "W-E", "right"), placementId: "WP-F-CYCLE" },
    { ...createAssemblyPlacement("W-B", "W-A", "left"), placementId: "WP-B-DUPLICATE" }
  ]
};

const assembly = normalizeWindowAssembly(sourceAssembly, windows, [cornerJoint, unrelatedJoint]);
assert.equal(assembly.placements.length, 3, "normalization should retain only unique placements connected to the root");
assert.deepEqual(new Set(assembly.placements.map(item => item.windowId)), new Set(["W-B", "W-C", "W-D"]));

const layout = resolveAssemblyLayout(assembly, windows);
const byWindow = new Map(layout.map(item => [item.windowId, item]));
assert.deepEqual(
  { xMm: byWindow.get("W-A").xMm, yMm: byWindow.get("W-A").yMm, zMm: byWindow.get("W-A").zMm },
  { xMm: 0, yMm: 0, zMm: 0 },
  "the root window should define the assembly origin"
);
assert.equal(byWindow.get("W-B").xMm, 1520, "right docking should include both half widths and the requested gap");
assert.equal(byWindow.get("W-C").rotationDeg, 90, "child rotation should be relative to its reference window");
assert.equal(byWindow.get("W-C").xMm, 2130);
assert.equal(Math.round(byWindow.get("W-C").zMm), -500);
assert.equal(byWindow.get("W-D").xMm, -450, "top docking should support start alignment and a horizontal offset");
assert.equal(byWindow.get("W-D").yMm, 1080);
assert.equal(hostEdgeForDock("left"), "left", "dock direction should map to the joint host edge");
assert.equal(placementGapForJoint(cornerJoint), 100, "joint material width should become the assembly gap");
assert.equal(placementRotationForJoint(cornerJoint), 90, "corner joint angle should drive placement rotation");
assert.equal(placementRotationForJoint({ ...cornerJoint, orientation: "reversed" }), -90, "reversed corner joints should rotate the adjacent frame back");

const bounds = assemblyBounds(layout);
assert.deepEqual(
  { widthMm: Math.round(bounds.widthMm), heightMm: Math.round(bounds.heightMm), depthMm: Math.round(bounds.depthMm) },
  { widthMm: 3030, heightMm: 2130, depthMm: 1000 },
  "assembly bounds should include rotated and vertically stacked windows"
);
const summary = assemblySummary(assembly, windows);
assert.deepEqual(summary.jointIds, ["J-CORNER"]);
assert.equal(summary.windowIds.length, 4);

const project = {
  schemaVersion: "cn-door-window-design.v2",
  project: { projectId: "P-ASSEMBLY", name: "组合测试" },
  order: { orderId: "SO-ASSEMBLY" },
  catalog: structuredClone(defaultCatalog),
  windows,
  joints: [cornerJoint, unrelatedJoint],
  assemblies: [assembly],
  calculation: { status: "calculated", mbomVersion: 2, events: [] }
};
const bom = calculateProjectBom(project);
assert.equal(bom.assemblies.length, 1, "BOM should expose a project-level assembly list");
assert.equal(bom.assemblies[0].placementCount, 3);
assert.ok(bom.assemblies[0].mbomLineIds.length > 0, "assembly output should trace to manufacturing BOM lines");
const assemblyLineIds = new Set(bom.assemblies[0].mbomLineIds);
assert.ok(
  bom.mbom.lines.some(line => assemblyLineIds.has(line.lineId) && line.sourceComponentId.startsWith("joint.J-CORNER.")),
  "assembly BOM should include the engineering joint selected by a placement"
);
assert.equal(
  bom.mbom.lines.some(line => assemblyLineIds.has(line.lineId) && line.sourceComponentId.startsWith("joint.J-UNRELATED.")),
  false,
  "assembly BOM should exclude unrelated project joints even when their host window belongs to the assembly"
);
assert.equal(bom.ebom.filter(item => item.type === "window_assembly").length, 1);

const interfacePackage = buildInterfacePackage(project, bom);
assert.deepEqual(interfacePackage.designModel.assemblies, project.assemblies);
assert.deepEqual(interfacePackage.designModel.joints, project.joints);
assert.equal(interfacePackage.assemblies[0].assemblyId, "WA-COURTYARD");

const schema = JSON.parse(readFileSync(new URL("../docs/door-window-design.v2.schema.json", import.meta.url), "utf8"));
assert.ok(schema.required.includes("assemblies"), "v2 projects should explicitly carry multi-window assemblies");
assert.ok(schema.$defs.windowAssembly);
assert.ok(schema.$defs.assemblyPlacement);

const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../dist/assets/app.js", import.meta.url), "utf8");
[
  "designerCapabilitySummary",
  "btnNewAssembly",
  "btnPlaceLeft",
  "btnPlaceRight",
  "btnPlaceTop",
  "btnPlaceBottom",
  "btnPlaceFree",
  "projectAssemblySelect",
  "inspector-assembly",
  "assemblyContextMenu",
  "jointPositionDialog",
  "btnCloseJointPosition"
].forEach(id => assert.ok(html.includes(`id="${id}"`), `${id} should be available in the drawing workbench`));
["top", "left", "right", "bottom", "free"].forEach(position => {
  assert.ok(html.includes(`data-joint-position="${position}"`), `${position} should be available in the joint position dialog`);
});
["btnWindowDrawingMode", "btnAssemblyDrawingMode", "多窗组合", "新建组合", "左侧组合", "右侧组合", "装配属性"].forEach(copy => {
  assert.equal(html.includes(copy), false, `${copy} should not appear in the joint-driven interaction`);
});
assert.equal(html.includes("palette-tile active"), false, "drawing tools should not remain visually selected by default");
["trapezoid_left", "trapezoid_peak", "notch_top_left", "notch_top_right", "custom_polygon"].forEach(shapeType => {
  assert.ok(html.includes(`data-shape-preset="${shapeType}"`) || html.includes(`value="${shapeType}"`), `${shapeType} should be exposed as a shape preset`);
});
assert.ok(html.includes('id="shapePoints"'), "DIY polygon frames should expose editable point coordinates");
assert.ok(html.includes('id="diyShapeDialog"'), "DIY polygon frames should open a dedicated modeling dialog");
assert.ok(html.includes('id="diyShapeCanvas"'), "DIY polygon frames should provide a blank drawing canvas");
assert.ok(html.includes('id="diyShapeName"'), "DIY polygon frames should require a user-provided saved element name");
assert.ok(html.includes('id="btnSaveDiyShape"'), "DIY polygon frames should save the drawn model as a named shape element");
assert.ok(html.includes('id="customShapeLibrary"'), "saved DIY polygon frames should appear in the drawing tool library");
assert.ok(app.includes("data-edit-custom-shape"), "saved DIY polygon frames should expose a maintenance/edit action");
assert.ok(app.includes("createConnectedWindow"), "joint-driven placement should auto-create the adjacent frame when needed");
assert.ok(app.includes("embeddedInWindowId"), "frames added through a connector should stay inside the current design");
assert.ok(app.includes("visibleDesignWindows().map"), "bottom cards should only show top-level window designs");
assert.ok(app.includes('canvasCommand = { mode: "add_joint"'), "adding a joint should enter the canvas edge hotspot mode");
assert.ok(app.includes("joint-placement-zone"), "joint and frame placement should use clickable canvas edge zones");
assert.ok(app.includes('mode: "add_window_from_joint"'), "choosing a frame preset with a selected joint should enter frame placement mode");
assert.ok(app.includes("canvasViewport"), "2D drawing canvas should keep a zoom viewport state");
assert.ok(app.includes("handleCanvasWheel"), "2D drawing canvas should support mouse-wheel zoom");
assert.ok(app.includes("passive: false"), "2D wheel zoom should prevent the page from scrolling while zooming the drawing");
assert.ok(html.includes('id="jointSettingsDialog"'), "corner connectors should open a dedicated settings dialog");
assert.ok(app.includes("openJointSettingsDialog"), "corner settings should use the reference-style modal workflow");
assert.ok(app.includes("renderJointSettingsPreview"), "corner settings should show a live connector preview");
assert.ok(app.includes("forceCreate: true"), "adding the next frame through a joint should create a new window");
assert.ok(app.includes("connectionWorkflow: \"joint_driven_auto_frame\""), "runtime capabilities should describe joint-driven frame assembly");
assert.ok(app.includes("interactionFlow: \"canvas_edge_hotspots\""), "runtime capabilities should describe the canvas hotspot flow");
assert.ok(app.includes("function renderAssemblyPlanView("), "connected frame assemblies should render a dedicated plan view");
assert.ok(app.includes("assembly-plan-window"), "assembly plan view should show every connected frame footprint");
assert.ok(app.includes("assembly-plan-joint"), "assembly plan view should show connector and corner relationships");
assert.ok(app.includes("project.viewOptions?.showPlanView"), "assembly drawing should respect the plan view toggle");
assert.ok(app.includes("function renderPlanEngineeringJoints("), "single-window plan view should render engineering connector sections");
assert.ok(app.includes("plan-joint-angle-arc"), "corner connectors should show their turn angle in the plan view");
assert.ok(app.includes("usedJointIds") && app.includes("joint.hostWindowId === item.windowId"), "assembly elevations should include end connectors even before a second frame is attached");
assert.ok(app.includes("project.assemblies?.some(assembly => assembly.placements?.length) ? \"assembly\" : \"window\""), "refreshing an assembled project should return to the combined drawing instead of the root window only");
assert.ok(app.includes("function resolveAssemblyElevationLayout("), "combined drawings should use a flat engineering elevation layout");
assert.ok(app.includes("assembly-elevation-joint-profile"), "combined elevations should render connector material bands between frames");
assert.ok(app.includes('svg.querySelectorAll(".assembly-elevation-joint")'), "connector bands in the combined elevation should be directly selectable");
assert.ok(app.includes("showJointContextMenu(event, group.dataset.jointId)"), "connector bands should expose the same right-click joint commands as the reference workflow");
assert.ok(app.includes("Math.round(maxX - minX)"), "combined elevation dimensions should be measured from the flat assembly span");
assert.equal(app.includes("worldZ * 0.42"), false, "combined elevation should not use pseudo-perspective projection");

console.log("Validated multi-window normalization, 3D placement geometry, combined BOM traceability, UI hooks, and the v2 JSON contract.");
