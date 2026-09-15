import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAssemblyPlacement, createWindowAssembly, resolveAssemblyLayout } from "../dist/assets/assemblies.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const app = fs.readFileSync(path.join(root, "dist", "assets", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "dist", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "dist", "assets", "app.css"), "utf8");
const schema = JSON.parse(fs.readFileSync(path.join(root, "docs", "door-window-design.v2.schema.json"), "utf8"));

assert.ok(
  app.includes('if (!["add_window_from_joint", "add_joint"].includes(canvasCommand.mode) || drawingMode !== "window") return "";'),
  "Cell overlay tools must not display assembly side-placement zones."
);
assert.ok(
  app.includes("renderAssemblyWindowCells") &&
  app.includes("openCellElevation") &&
  app.includes("openingSymbol"),
  "Opening sashes must remain visible in elevation and plan after windows are assembled."
);
assert.ok(
  app.includes("renderAssemblyInternalJointZones") &&
  app.includes('data-placement-id="${escapeHtml(item.placementId)}"') &&
  app.includes("insertEngineeringJointAtPlacement"),
  "A gapless unconnected interface must expose a selectable insertion zone for a joint."
);
assert.ok(
  app.includes("renderWindowGeometryHandles") &&
  app.includes("bindCanvasGeometryDrag") &&
  app.includes('data-geometry-kind="window"') &&
  app.includes('data-geometry-kind="divider"'),
  "Window width, height, and mullion ratios must expose drag handles and commit geometry changes."
);
assert.ok(
  html.includes('id="btnLockHardware"') &&
  app.includes('lock: "锁具"') &&
  app.includes('class="cell-lock-body"') &&
  app.includes('mountType = "cell-lock"') &&
  app.includes("mountThreeCellHostedObjects") &&
  app.includes("addThreeCellHostedObjects(support.object"),
  "Lock hardware must be placeable in a cell and rendered in both 2D and 3D."
);
assert.ok(
  app.includes("frameShapePath(win, topLeft.x, topLeft.y, drawW, drawH, face)") &&
  app.includes('class="assembly-window-frame"'),
  "Every assembled frame must retain its selected frame-shape geometry."
);
assert.ok(
  app.includes('hostType: "cell"') &&
  app.includes("hostWindowId") &&
  app.includes("hostCellId") &&
  app.includes('["text", "circle_hole", "square_hole", "lock"].includes(value.kind)') &&
  app.includes('markup.kind === "circle_hole"'),
  "Holes and hardware must be attached to a concrete window cell."
);
assert.ok(
  !html.includes('data-preview-select-mode="single"') &&
  !html.includes("preview-mode-fixed") &&
  !html.includes("多选模式") &&
  app.includes('preview3d.selectionMode = "multiple"'),
  "3D selection must remain multi-select capable without showing the old multi-select mode banner."
);
assert.ok(
  html.includes('id="previewShowDimensions"') &&
  html.includes('id="previewShowMarkups"') &&
  html.includes('id="previewShowOrientation"') &&
  app.includes("addThreeDimensionGuides") &&
  app.includes("addThreeCellHostedObjects") &&
  app.includes("addThreeOrientationLabels") &&
  app.includes('createThreeGroundSideLabel("室外"') &&
  app.includes('createThreeGroundSideLabel("室内"'),
  "3D dimensions, hosted objects, and indoor/outdoor labels must have visibility controls."
);
assert.ok(
  app.includes("function threeOperablePocket(rect)") &&
  app.includes("function addThreeFrameRebate(parent, rect, mats)") &&
  app.includes('userData.mountType = "frame-rebate-stop"') &&
  app.includes("hingeRoot.position.set(hingeX, pocket.y, pocket.z)") &&
  app.includes("hingeRoot.position.set(pocket.x, hingeY, pocket.z)") &&
  app.includes("addSashFrame(sash, 0, 0, sashWidth, sashHeight, pocket.face, pocket.depth, mats.profile)") &&
  app.includes('hingeRoot.userData.mountType = "side-hinged-mechanism"') &&
  app.includes('hingeAxis: "side"') &&
  app.includes('addFixedVerticalHingePlates') &&
  app.includes("function ensurePreviewPartSelection()"),
  "3D sash geometry must sit in a frame rebate pocket, stay selected by default, and rotate from a frame-mounted hinge mechanism."
);
assert.ok(css.includes(".geometry-drag-handle") && css.includes(".internal-joint-zone"), "Canvas geometry and internal-joint hit targets must be styled and discoverable.");
assert.ok(
  html.includes("canvasDimensionEditor") &&
  html.includes("btnApplyCanvasDimension") &&
  app.includes("function applyGeometryDragDelta") &&
  app.includes("document.addEventListener(\"pointermove\", move, true)") &&
  app.includes("render();") &&
  app.includes('bindById("btnApplyCanvasDimension", "click", commitCanvasDimensionEditor)') &&
  !app.includes('bindById("canvasDimensionInput", "blur", commitCanvasDimensionEditor)'),
  "Canvas dimension dragging must live-update the whole window, and double-click editing must require explicit confirmation."
);
assert.ok(
  app.includes("const hingeX = left ? item.x + inset : item.x + item.w - inset") &&
  app.includes("M${hingeX} ${hingeY} L${openX} ${topEdge} M${hingeX} ${hingeY} L${openX} ${bottomEdge}"),
  "Side-hung 2D symbols must use the reference V-shaped opening mark instead of a single diagonal triangle."
);
assert.ok(
  app.includes("function localMullionExists") &&
  app.includes("function addSegmentedLocalMullion") &&
  app.includes("已有竖向分隔，已在选中窗格加入局部横梃，未切穿竖梃。") &&
  app.includes("已有横向分隔，已在选中窗格加入局部竖梃，未切穿横梃。") &&
  app.includes("该窗格已有局部${localMullionName(orientation)}，未重复叠加。"),
  "Adding a mullion into an already divided window must create a local segmented mullion and avoid duplicate overlay."
);
assert.ok(
  app.includes("function openingDirectionText") &&
  app.includes('return "外开";') &&
  app.includes('return "内开";') &&
  css.includes(".opening-direction-label"),
  "2D opening sashes and symbols must show inward/outward direction labels."
);
assert.ok(
  app.includes("function renderProfileBevel") &&
  app.includes("function renderProfileDividerBevel") &&
  app.includes("renderProfileBevel(x, y, drawW, drawH, face)") &&
  app.includes("renderProfileDividerBevel(dividerX, dividerY, dividerW, dividerH)") &&
  css.includes(".profile-bevel-highlight") &&
  css.includes(".profile-bevel-shadow"),
  "Frame and mullion profiles must render material depth with bevel/highlight layers."
);
assert.ok(css.includes('.preview-visibility input[type="checkbox"]') && css.includes("flex: 0 0 16px"), "3D visibility checkboxes must override the global full-width form-input rule.");
assert.ok(!css.includes(".preview-mode-fixed"), "The obsolete 3D multi-select banner style must be removed.");

const markupDef = schema.$defs?.cellMarkup;
assert.ok(markupDef, "Schema must define cell-hosted markup objects.");
assert.ok(markupDef.properties.kind.enum.includes("lock"), "Schema must accept lock hardware.");
assert.ok(markupDef.required.includes("hostWindowId"), "Schema must require an explicit host window.");
assert.ok(markupDef.required.includes("hostCellId"), "Schema must require an explicit host cell.");
assert.ok(app.includes("hostWindowId: copy.windowId") && app.includes("cellIdMap.set(oldCellId, cloned.cellId)"), "Duplicating a frame must regenerate cell and markup ownership instead of sharing IDs with the source frame.");

const left = { windowId: "W-LEFT", widthMm: 1200, heightMm: 1500 };
const right = { windowId: "W-RIGHT", widthMm: 1200, heightMm: 1500 };
const assembly = createWindowAssembly(left, "连续窗体");
assembly.placements.push(createAssemblyPlacement(right.windowId, left.windowId, "right", { gapMm: 0 }));
let layout = resolveAssemblyLayout(assembly, [left, right]);
let leftBox = layout.find(item => item.windowId === left.windowId);
let rightBox = layout.find(item => item.windowId === right.windowId);
assert.equal(leftBox.xMm + left.widthMm / 2, rightBox.xMm - right.widthMm / 2, "Unconnected adjacent frames must touch without a floating gap.");

assembly.placements[0].gapMm = 300;
layout = resolveAssemblyLayout(assembly, [left, right]);
leftBox = layout.find(item => item.windowId === left.windowId);
rightBox = layout.find(item => item.windowId === right.windowId);
assert.equal((rightBox.xMm - right.widthMm / 2) - (leftBox.xMm + left.widthMm / 2), 300, "An inserted 300 mm connector must create exactly a 300 mm interface.");

left.widthMm = 1500;
assembly.placements[0].gapMm = 0;
layout = resolveAssemblyLayout(assembly, [left, right]);
leftBox = layout.find(item => item.windowId === left.windowId);
rightBox = layout.find(item => item.windowId === right.windowId);
assert.equal(leftBox.xMm + left.widthMm / 2, rightBox.xMm - right.widthMm / 2, "Resizing a frame must recalculate the neighboring placement and preserve continuity.");

console.log("Physical global editing checks passed: global openings, segmented mullions, internal joints, geometry dragging, hosted holes/locks, frame material, and 3D visibility.");
