import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import vm from "node:vm";
import * as assemblies from "../dist/assets/assemblies.js";
import * as openings from "../dist/assets/openings.js";
import * as joints from "../dist/assets/joints.js";

// Run the shipped app functions with controlled state and DOM/rendering adapters.
const source = readFileSync(new URL("../dist/assets/app.js", import.meta.url), "utf8");
function appFunction(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.ok(start >= 0, `Missing function ${name}`);
  const next = source.slice(start + 1).search(/^    (?:async )?function /m);
  return source.slice(start, start + 1 + next);
}
const noop = () => {};
function context(extra = {}, names = []) {
  const ctx = vm.createContext({
    ...assemblies, ...openings, ...joints, Math, Number, Set, Map,
    project: { windows: [], joints: [], assemblies: [], viewOptions: { showOpenState: true, showPlanView: true } },
    selectedWindowId: "A", selectedJointId: "J", selectedPlacementId: "", selectedMemberId: "", selectedMarkupId: "",
    selectedDivider: { windowId: "", axis: "", index: -1 },
    selectedAssemblyId: "AS", selectedCell: { row: 0, col: 0 }, activeInspectorTab: "joint", drawingMode: "assembly",
    canvasCommand: { mode: "" }, activeModule: "design", bom: null,
    currentSeries: () => ({ faceWidthMm: 70, frameDepthMm: 70 }),
    hideJointContextMenu: noop, markDirty: noop, showToast: noop, updateHistoryControls: noop,
    sum: values => values.reduce((a, b) => a + b, 0), cellIndex: (r, c, cols) => r * cols + c,
    escapeHtml: value => String(value ?? ""), setValue: noop,
    ...extra
  });
  ctx.currentJoint = () => ctx.project.joints.find(j => j.jointId === ctx.selectedJointId);
  ctx.switchInspector = tab => { ctx.activeInspectorTab = tab; };
  ctx.clearDividerSelection = () => { ctx.selectedDivider = { windowId: "", axis: "", index: -1 }; };
  ctx.currentThroughDivider = () => null;
  names.forEach(name => vm.runInContext(appFunction(name), ctx));
  return ctx;
}
function windowObject(id, width = 1000, type = "fixed_glass") {
  return { windowId: id, mark: id, widthMm: width, heightMm: 1500,
    layout: { columns: [1], rows: [1], cells: [{ cellId: `${id}-cell`, type, opening: openings.defaultOpeningForType(type) }] } };
}
function fixture(dock = "right", type = "splice", width = 300) {
  const windows = [windowObject("A", 1200), windowObject("B")];
  const joint = { jointId: "J", type, hostWindowId: "A", hostEdge: dock, legWidthAMm: width, legWidthBMm: 50,
    angleDeg: 90, orientation: "normal", style: "standard", span: { startRatio: 0, endRatio: 1 }, connectedWindowIds: ["A", "B"] };
  const placement = assemblies.createAssemblyPlacement("B", "A", dock, { jointId: "J", gapMm: width, rotationDeg: type === "corner" ? 90 : 0 });
  const assembly = { assemblyId: "AS", rootWindowId: "A", name: "Assembly", placements: [placement] };
  return { windows, joints: [joint], assemblies: [assembly], viewOptions: { showPlanView: true, showOpenState: true } };
}

for (const dock of ["left", "right", "top", "bottom"]) {
  const ctx = context({ project: fixture(dock, "corner") }, ["deleteSelectedJoint", "resolveAssemblyElevationLayout"]);
  ctx.deleteSelectedJoint();
  const assembly = ctx.project.assemblies[0];
  assert.equal(ctx.project.joints.length, 0);
  assert.equal(assembly.placements[0].gapMm, 0);
  assert.equal(assembly.placements[0].rotationDeg, 0);
  const restored = assemblies.resolveAssemblyLayout(assembly, ctx.project.windows);
  assert.equal(restored[1].rotationDeg, 0);
  const bounds = assemblies.assemblyBounds(restored);
  assert.equal(bounds.depthMm, 0);
  assert.equal(dock === "left" || dock === "right" ? bounds.widthMm : bounds.heightMm, dock === "left" || dock === "right" ? 2200 : 3000);
  assert.equal(ctx.resolveAssemblyElevationLayout(assembly, ctx.project.windows).connectors.length, 0, "Deleted connectors must not leave a visible profile");
  const restoredProject = JSON.parse(JSON.stringify(ctx.project));
  assert.equal(assemblies.resolveAssemblyLayout(restoredProject.assemblies[0], restoredProject.windows)[1].rotationDeg, 0);
}

for (const width of [10, 50, 100, 300]) {
  const preview = { innerHTML: "" };
  const ctx = context({ project: fixture("right", "splice", width), document: { getElementById: () => preview } }, ["renderJointSettingsPreview", "renderJointDetailPreview", "syncPlacementsForJoint", "editJointLengthOrWidthFromMenu"]);
  ctx.renderJointSettingsPreview(ctx.currentJoint());
  assert.match(preview.innerHTML, new RegExp(`class="joint-settings-dim-text"[^>]*>${width}</text>`));
  ctx.renderJointDetailPreview(ctx.currentJoint());
  assert.match(preview.innerHTML, new RegExp(`>${width} mm</text>`));
  assert.equal(assemblies.placementGapForJoint(ctx.currentJoint()), width);
  ctx.promptJointNumericValue = () => width;
  ctx.editJointLengthOrWidthFromMenu();
  assert.equal(ctx.currentJoint().legWidthBMm, 50, "Width editing must not change depth");
  assert.equal(ctx.project.assemblies[0].placements[0].gapMm, width);

  const boxes = [];
  class Group {
    constructor() { this.position = { x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }); } }; }
  }
  const meshCtx = context({ project: fixture("right", "splice", width), threeLib: { Group },
    addBox: (parent, x, y, z, w, h, d) => { boxes.push({ parent, w, h, d }); return {}; }
  }, ["addThreeEngineeringJoints"]);
  meshCtx.addThreeEngineeringJoints({ add: noop }, meshCtx.project.windows[0], 1.2, 1.5, .07, .07, .001, {});
  assert.equal(boxes[0].w, width * .001, "3D face width must equal the configured splice width");
  assert.equal(boxes[0].d, .05);
  assert.equal(boxes[0].parent.position.x - boxes[0].w / 2, .6, "3D connector must begin at the host frame edge");
}

const planFunctions = ["computeCellRects", "rectsToEdges", "cellOpeningRatio", "assemblyPlanPoint", "assemblyPlanFootprint", "assemblyPlanOpenings", "buildPlanOpeningParts", "renderPlanCellTracks", "renderPlanPanelProjection", "renderPlanFoldingProjection", "renderPlanMotionGuide", "planProjectionPoints", "renderAssemblyPlanView"];
for (const type of ["turn", "turn_tilt", "top_hung", "bottom_hung", "sliding", "lift_slide", "psk", "parallel_slide", "parallel_project", "pocket_slide", "corner_slide", "vertical_slide", "folding"]) {
  const ctx = context({ project: fixture(), dimensionLine: () => "", normalizePlanVector: vector => vector }, planFunctions);
  const item = { window: windowObject("B", 1000, type), windowId: "B", xMm: 1400, zMm: 500, rotationDeg: 90 };
  const opened = ctx.assemblyPlanOpenings(item);
  assert.ok(opened.points.length > 0, `${type}: projection must exist in assembly plan`);
  assert.ok(opened.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.z)), `${type}: finite global projection points`);
  assert.match(opened.content, /plan-opening-projection/);
  assert.doesNotMatch(opened.content, /NaN|undefined/);
  ctx.project.viewOptions.showOpenState = false;
  const closed = ctx.assemblyPlanOpenings(item);
  assert.notEqual(opened.content, closed.content, `${type}: open-state toggle must update projection`);
  const layout = assemblies.resolveAssemblyLayout(ctx.project.assemblies[0], ctx.project.windows);
  ctx.project.joints = [];
  const plan = ctx.renderAssemblyPlanView(ctx.project.assemblies[0], layout, 900, 482, 244);
  assert.doesNotMatch(plan, /assembly-plan-joint-group/, "Deleted joint must not leave a plan node");
}

const renderNames = ["renderInputs", "renderSvg", "renderCellPalette", "renderCustomShapeLibrary", "renderThreePreview", "renderObjectTree", "renderSelectedObjectProperties", "renderTemplates", "renderBom", "renderStatus", "updateCanvasCommandControls", "saveProject"];
const global = context({ project: fixture(), normalizeProject: p => p, calculateProjectBom: () => ({}),
  ...Object.fromEntries(renderNames.map(name => [name, noop]))
}, ["render", "hasAssemblyScene", "syncAssemblyJointConnections"]);
for (const mode of ["apply_cell_preset", "add_cell_markup", "add_root_markup", "add_joint", "add_window_from_joint", ""]) {
  global.drawingMode = "window";
  global.canvasCommand = { mode };
  global.render();
  assert.equal(global.drawingMode, "assembly", `${mode}: tools must retain the whole assembly`);
}

const svg = { setAttribute: noop, querySelectorAll: () => [], addEventListener: noop };
let rendered = "";
const selection = context({ project: fixture(), document: { getElementById: () => ({}) },
  dimensionLine: () => "", cellFill: () => "#e3f3fa", cellDecoration: () => "", integratedScreenDecoration: () => "",
  cellDrawingCode: () => "F1", renderCellMarkups: () => "", renderWindowRootMarkups: () => "", bindCanvasMarkupPlacement: noop, bindCanvasGeometryDrag: noop,
  frameShapePath: () => "M0 0Z", profileColor: () => "#7e8792", openCellElevation: () => "<g class=\"open-sash-elevation\"></g>",
  cellRenderItemWithShape: (_, item) => item, renderWindowFrameOcclusion: () => "", windowInnerFillPath: () => "",
  windowInnerShapePoints: () => [], polygonLineRangePoints: () => null,
  renderAssemblyWindowInternalDimensions: () => "", renderCustomShapeAnnotations: () => "",
  openingSymbol: () => "", renderProfileBevel: () => "", renderProfileDividerBevel: () => "",
  renderThroughMullions: () => "", renderTopologyMembers: () => "", bindAssemblyTopologyMembers: noop,
  bindCanvasMarkupContextMenus: noop, renderAssemblyCommandZones: () => "", setCanvasSvgContent: (_, parts) => { rendered = parts.join(""); }
}, [...planFunctions, "svgPlanDefs", "resolveAssemblyElevationLayout", "renderWindowGeometryHandles", "renderAssemblyWindowCells", "renderAssemblyInternalJointZones", "renderAssemblySvg"]);
selection.currentProjectAssembly = () => selection.project.assemblies[0];
selection.renderAssemblySvg(svg);
assert.match(rendered, /assembly-sill-height-label[^>]*>台高 0 mm</, "Assembly elevation must show the shared sill-height label");
assert.match(rendered, /class="assembly-elevation-joint selected"/);
assert.match(rendered, /assembly-plan-joint-group splice selected/);
assert.doesNotMatch(rendered, /class="assembly-window selected"|class="assembly-plan-window selected"|class="selected-stroke"/, "Selecting a joint must not highlight its host frame or glass");
selection.selectedJointId = "";
selection.selectedPlacementId = selection.project.assemblies[0].placements[0].placementId;
selection.selectedWindowId = "B";
selection.activeInspectorTab = "window";
selection.renderAssemblySvg(svg);
assert.match(rendered, /class="assembly-window selected" data-window-id="B"/);
assert.match(rendered, /class="assembly-plan-window selected"/);

// Reuse the actual tree click/context dispatch and retain expansion across renders.
const tree = context({ project: fixture(), collapsedObjectBranches: new Set(), renderObjectTree: noop, render: noop,
  hideCellContextMenu: noop, hideMemberContextMenu: noop, hideAssemblyContextMenu: noop
}, ["hasAssemblyScene", "handleObjectTreeClick", "handleObjectTreeContextMenu"]);
let menuJoint = "";
tree.showJointContextMenu = (_, id) => { menuJoint = id; };
function button(data) {
  return { dataset: data, closest(selector) {
    if (selector === ".object-tree-item") return this;
    const field = selector.slice(1, -1).replace(/^data-/, "").replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    return field in data ? this : null;
  } };
}
tree.handleObjectTreeContextMenu({ target: button({ objectJoint: "J" }), preventDefault: noop, stopPropagation: noop });
assert.equal(menuJoint, "J");
assert.equal(tree.selectedJointId, "J");
assert.equal(tree.activeInspectorTab, "joint");
assert.equal(tree.drawingMode, "assembly");
const caret = { closest: () => ({ dataset: { branchKey: "branch-A" } }) };
const caretEvent = { target: { closest: selector => selector === ".object-tree-caret" ? caret : null } };
tree.handleObjectTreeClick(caretEvent);
assert.ok(tree.collapsedObjectBranches.has("branch-A"));
tree.handleObjectTreeClick(caretEvent);
assert.ok(!tree.collapsedObjectBranches.has("branch-A"));
assert.equal(tree.selectedJointId, "J", "Collapsing a branch must preserve selected object");

if (process.argv.includes("--evidence")) {
  const folder = new URL("../outputs/global-canvas-20260914/", import.meta.url);
  mkdirSync(folder, { recursive: true });
  selection.project.windows[0] = windowObject("A", 1200, "turn");
  selection.project.windows[1] = windowObject("B", 1000, "folding");
  selection.selectedJointId = "J";
  selection.activeInspectorTab = "joint";
  selection.renderAssemblySvg(svg);
  const styles = readFileSync(new URL("../dist/assets/app.css", import.meta.url), "utf8");
  const evidence = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="800" viewBox="0 0 900 800"><style>${styles}</style><rect width="900" height="800" fill="white"/>${rendered}</svg>`;
  writeFileSync(new URL("selected-joint-open-plan.svg", folder), evidence);
  const { default: sharp } = await import("sharp");
  await sharp(Buffer.from(evidence)).png().toFile(new URL("selected-joint-open-plan.png", folder).pathname.replace(/^\/(\w:)/, "$1"));
}

console.log("Global canvas regression checks passed: deletion, width parity, 3D dimensions, 13 opening projections, global modes, exclusive highlights, tree context menus and collapse.");
