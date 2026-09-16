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
  app.includes("function threeMarkupPositionFrom2dPercent") &&
  app.includes("function lockMarkupPointOnSashFrame") &&
  app.includes('markup.kind === "lock"') &&
  app.includes("lockMarkupPointOnSashFrame(cell, item, scale, markup)") &&
  app.includes('options.hingeAxis === "side"') &&
  app.includes('options.hingeAxis === "horizontal"') &&
  app.includes('x: leftHinged ? panelWidth : -panelWidth') &&
  app.includes('y: topHinged ? -panelHeight : panelHeight') &&
  app.includes("function cellHasHostedLockMarkup") &&
  app.includes("if (!cellHasHostedLockMarkup(cell)) addHandle") &&
  app.includes("const handleDirection = threeLockHandleDirection(options.mountCell || cell)"),
  "Lock hardware must snap to the sash/frame edge in both 2D and 3D and suppress duplicate generic handles."
);
assert.ok(
  app.includes("function defaultLockPositionForCell") &&
  app.includes("function ensureDefaultLockMarkup") &&
  app.includes("note: DEFAULT_LOCK_NOTE") &&
  app.includes("ensureDefaultLockMarkup(win, cell, { repositionExisting: true })") &&
  app.includes("ensureDefaultLockMarkup(win, cell, { repositionExisting: typeChanged || previousOpening !== cell.opening })"),
  "Operable cells must get one default hosted lock position when they are created or changed to an opening sash."
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
  app.includes("function selectMarkupObject") &&
  app.includes("function findWindowMarkup") &&
  app.includes("function findMarkupObject") &&
  app.includes("function deleteSelectedMarkup") &&
  app.includes("function showMarkupContextMenu") &&
  app.includes("function bindCanvasMarkupContextMenus") &&
  app.includes("function openMarkupContextMenuFromGroup") &&
  app.includes("markupGroupFromEvent(event)") &&
  app.includes("bindCanvasMarkupContextMenus(svg)") &&
  app.includes("hideMarkupContextMenu();") &&
  app.includes("[`编辑${label}`, () => openCanvasMarkupEditor(markupId, event)], [`删除${label}`, deleteSelectedMarkup]"),
  "Canvas text, holes, and locks must support canvas/tree right-click editing and deletion."
);
assert.ok(
  app.includes("function normalizeWindowMarkups") &&
  app.includes("function createWindowMarkup") &&
  app.includes("function startRootTextMarkupPlacement") &&
  app.includes('mode: "add_root_markup"') &&
  app.includes("function addRootTextMarkupFromEvent") &&
  app.includes("function renderWindowRootMarkups") &&
  app.includes('class="markup-layer root-markup-layer"') &&
  app.includes('data-markup-host="window"') &&
  app.includes("function rootMarkupPositionFromEvent") &&
  app.includes("文字标注已挂到窗体根节点"),
  "Text annotations must be hosted on the whole window root and stay freely movable."
);
assert.ok(
  !html.includes('data-preview-select-mode="single"') &&
  !html.includes("preview-mode-fixed") &&
  !html.includes("多选模式") &&
  app.includes('preview3d.selectionMode = "multiple"'),
  "3D selection must remain multi-select capable without showing the old multi-select mode banner."
);
assert.ok(
  html.includes('data-preview-view="outside"') &&
  html.includes('data-preview-view="top"') &&
  app.includes("function setThreePreviewView") &&
  app.includes("preview3d.controls.enablePan = true") &&
  app.includes("preview3d.controls.enableZoom = true") &&
  app.includes("preview3d.controls.minPolarAngle = 0") &&
  app.includes("preview3d.controls.maxPolarAngle = Math.PI") &&
  app.includes('indicator.textContent = "主立面：俯视观察"') &&
  css.includes(".preview-view-presets"),
  "3D preview must allow free orbit, pan, zoom, and preset top/inside/outside views."
);
assert.ok(
  html.includes('id="previewShowDimensions"') &&
  html.includes('id="previewShowMarkups"') &&
  html.includes('id="previewShowOrientation"') &&
  app.includes("addThreeDimensionGuides") &&
  app.includes("addThreeCellHostedObjects") &&
  app.includes("addThreeWindowRootMarkups") &&
  app.includes("addThreeOrientationLabels") &&
  app.includes('createThreeGroundSideLabel("室外"') &&
  app.includes('createThreeGroundSideLabel("室内"'),
  "3D dimensions, hosted objects, and indoor/outdoor labels must have visibility controls."
);
assert.ok(
  app.includes("function threeOperablePocket(rect, options = {})") &&
  app.includes("function addThreeFrameRebate(parent, rect, mats, options = {})") &&
  app.includes('userData.mountType = "frame-rebate-stop"') &&
  app.includes("function threeOpeningPlaneZ(cell, rect, assembly = null, pocket = null)") &&
  app.includes("rect.depth / 2 - clearance") &&
  app.includes("function threeSashLocalZ(rect, pocket, hingeZ)") &&
  app.includes("function threeSashClosedCenterZ(rect, pocket, hingeZ)") &&
  app.includes("function threeSashHardwareZ(rect, pocket, hingeZ)") &&
  app.includes("function threeOpeningSashBounds(pocket, rect, options = {})") &&
  app.includes("shaped ? 0.0008 : 0.003") &&
  app.includes("rect.face * (shaped ? 0.006 : 0.065)") &&
  app.includes("pocket.face * (shaped ? 0.012 : 0.16)") &&
  app.includes("pocket.w - clearance * 2") &&
  app.includes("pocket.h - clearance * 2") &&
  app.includes("function threeShapedSashGeometry(shapeData, pocket, rect)") &&
  app.includes("const insetPoints = insetPolygonTowardCentroid(modelPoints, clearance)") &&
  app.includes("points: normalizeShapePoints(normalizedPoints)") &&
  app.includes("const sashGeometry = threeShapedSashGeometry(shapeData, pocket, rect)") &&
  app.includes("const sashShapeData = sashGeometry.shapeData") &&
  app.includes("addThreeCustomShapeBody(sash, sashShapeData") &&
  app.includes("function addThreeCustomShapeHardware") &&
  app.includes("const handleInset = threeRectMm(rect, THREE_HARDWARE_HANDLE_INSET_MM)") &&
  app.includes("addThreeCustomShapeHardware(sash, cell, sashShapeData") &&
  app.includes("railZ: 0") &&
  app.includes("selectionZ: 0.006") &&
  app.includes("const railZ = Number.isFinite(Number(options.railZ))") &&
  app.includes("const sashBounds = threeOpeningSashBounds(pocket, rect") &&
  app.includes("const hingeZ = threeOpeningPlaneZ(cell, rect, assembly, pocket)") &&
  app.includes("const sashLocalZ = threeSashLocalZ(rect, pocket, hingeZ)") &&
  app.includes("const closedCenterZ = threeSashClosedCenterZ(rect, pocket, hingeZ)") &&
  app.includes("const hardwareZ = threeSashHardwareZ(rect, pocket, hingeZ)") &&
  app.includes("hingeRoot.position.set(hingeX, sashBounds.y, hingeZ)") &&
  app.includes("hingeRoot.position.set(sashBounds.x, hingeY, hingeZ)") &&
  app.includes("sash.position.set(sashBounds.x - hingeX, 0, sashLocalZ)") &&
  app.includes("sash.position.set(0, sashBounds.y - hingeY, sashLocalZ)") &&
  app.includes("closedPanelCenter = new threeLib.Vector3(sashBounds.x, sashBounds.y, closedCenterZ)") &&
  app.includes("addSashFrame(sash, 0, 0, sashWidth, sashHeight, pocket.face, pocket.depth, mats.profile)") &&
  app.includes('hingeRoot.userData.mountType = "side-hinged-mechanism"') &&
  app.includes('hingeAxis: "side"') &&
  app.includes("hardwareZ: support.hardwareZ") &&
  app.includes("addHandle(sash, (left ? 1 : -1) * sashWidth * 0.34, 0, hardwareZ") &&
  app.includes("addHorizontalHandle(sash, 0, handleY, hardwareZ") &&
  app.includes('addFixedVerticalHingePlates') &&
  app.includes("function ensurePreviewPartSelection()"),
  "3D sash geometry must sit in a frame rebate pocket, stay selected by default, and rotate from a frame-mounted hinge mechanism on the correct indoor/outdoor rebate plane."
);
assert.ok(
  app.includes("function primaryOpenableForCell") &&
  app.includes("function attachScreenToOpenable") &&
  app.includes('userData.mountType = "integrated-screen-follows-sash"') &&
  app.includes("if (host && attachScreenToOpenable(screen, host, rect)) return;"),
  "Integrated screens must attach to the host sash in 3D so screen opening follows the window opening."
);
assert.ok(
  app.includes("function windowShapeDataForThreeCell") &&
  app.includes("function windowShapeClipForThreeCell") &&
  app.includes("shapeData: clipped.shapeData") &&
  app.includes("function threeCellShapeData(cell, rect)") &&
  app.includes("function addThreeShapeGlassPane") &&
  app.includes("const THREE_GLASS_REBATE_OVERLAP_MM = 32") &&
  app.includes("offsetThreePolygon(basePoints, -glassOverlap)") &&
  app.includes('userData.mountType = "fixed-shaped-glass"') &&
  app.includes("addThreeCustomOperableCell(parent, cell, rect, mats, meta, assembly)") &&
  app.includes("frameShape: true") &&
  app.includes("embeddedShape: shapeData.frameShape") &&
  app.includes("suppressRectStops: shapeData.frameShape") &&
  app.includes("function addThreeShapeRebateStops") &&
  app.includes('userData.mountType = "shape-frame-rebate-stop"') &&
  app.includes("function addThreeShapeAnnotations") &&
  app.includes("addThreeShapeAnnotations(model, win, width, height, depth)") &&
  app.includes('userData.mountType = "three-shape-angle-label"') &&
  app.includes('{ boxed: false }') &&
  app.includes("integrated-screen-follows-open-sash") &&
  app.includes("function hungSashGeometry"),
  "2D and 3D operable sashes must inherit frame/custom shape geometry instead of falling back to rectangular panels."
);
assert.ok(
  app.includes("function normalizeMarkupRotation") &&
  app.includes("function parseMarkupTextRotation") &&
  app.includes("rotationDeg: normalizeMarkupRotation(value.rotationDeg ?? value.angleDeg)") &&
  app.includes('class="cell-markup-text-rotor"') &&
  app.includes('transform="rotate(${rotation} ${cx} ${cy})"') &&
  app.includes("label.rotation.z = -normalizeMarkupRotation(markup.rotationDeg) * Math.PI / 180") &&
  app.includes('["旋转", `${normalizeMarkupRotation(markup.markup.rotationDeg)}°`]'),
  "2D and 3D text markups must persist and render arbitrary rotation."
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
  app.includes("该窗格已有局部${localMullionName(orientation)}，未重复叠加。"),
  "Local mullions must remain scoped to one cell and avoid duplicate overlay."
);
assert.ok(
  app.includes('selectThroughDivider(win, "column", col)') &&
  app.includes('selectThroughDivider(win, "row", row)') &&
  app.includes("function applyThroughDividerPosition") &&
  app.includes("function deleteSelectedThroughDivider") &&
  app.includes("showThroughDividerContextMenu(event)") &&
  app.includes("data-object-divider-axis") &&
  app.includes("class=\"geometry-drag-hit\"") &&
  app.includes("const handleFace = Math.max(10, Number(currentSeries(win).faceWidthMm || 70) * scale)") &&
  !app.includes("Math.max(10, face * 0.7)") &&
  app.includes("function applyLocalMemberDragDelta") &&
  app.includes("localMemberPositionTarget(member.memberId)") &&
  !app.includes("已有竖向分隔，已在选中窗格加入局部横梃，未切穿竖梃。") &&
  !app.includes("已有横向分隔，已在选中窗格加入局部竖梃，未切穿横梃。"),
  "Through mullion tools must stay through-type, while both through and local mullions remain selectable and position-adjustable."
);
assert.ok(
  html.includes('aria-label="中梃操作"') &&
  app.includes('bindById("btnMemberMenuDelete", "click", deleteSelectedMullion)') &&
  app.includes("if (currentThroughDivider())") &&
  css.includes(".geometry-drag-hit"),
  "Mullion menus and delete commands must handle both through and local mullions before falling back to frame deletion."
);
assert.ok(
  html.includes("btnUndoProject") &&
  html.includes("btnRedoProject") &&
  app.includes("function undoProjectEdit") &&
  app.includes("function redoProjectEdit") &&
  app.includes("document.addEventListener(\"keydown\", handleHistoryShortcut)") &&
  app.includes("rememberEditHistory();"),
  "Global undo/redo must be available for canvas-changing operations."
);
assert.ok(
  app.includes("function renderThroughMullions") &&
  app.includes("renderThroughMullions(win, assemblyColEdges, assemblyRowEdges, face, frameColor, \"#26393e\", frameInfo)") &&
  app.includes("renderTopologyMembers(win, assemblyRenderRects, face, frameColor, \"#26393e\", frameInfo)") &&
  app.includes("function offsetPolygonPoints") &&
  app.includes("function clipPolygonToRectPoints") &&
  app.includes("bindAssemblyTopologyMembers(svg, assembly)") &&
  app.includes("data-member-window"),
  "Single-window and assembly views must share the same through/local mullion rendering and selection behavior, including shaped DIY geometry."
);
assert.ok(
  app.includes("createRootWindowFromCanvasCommand();") &&
  !app.includes("请在空画布点击放置第一樘窗。"),
  "Choosing a frame or first-cell preset on an empty canvas must immediately create the first frame."
);
assert.ok(
  html.includes('id="shapePlacementDialog"') &&
  html.includes('data-shape-placement="replace"') &&
  html.includes('data-shape-placement="top"') &&
  html.includes('data-shape-placement="left"') &&
  html.includes('data-shape-placement="right"') &&
  html.includes('data-shape-placement="bottom"') &&
  app.includes("function openShapePlacementDialog(type)") &&
  app.includes("function chooseShapePlacement(action)") &&
  app.includes("createWindowFromShapePreset(type, { replace: true })") &&
  app.includes("createWindowFromShapePreset(type, { dock: action })") &&
  app.includes("function insertionAnchorForSide(assembly, referenceWindow, requestedDock)") &&
  app.includes("function addAssemblyPlacementWithInsert(assembly, placement, referenceWindow, childWindow)") &&
  app.includes("occupiedPlacementsForInsert(assembly, referenceWindow, childWindow, placement.dock)") &&
  app.includes("openShapePlacementDialog(type)") &&
  app.includes('bindById("btnCloseShapePlacement", "click", closeShapePlacementDialog)'),
  "Clicking a frame drawing tool while a canvas frame is selected must ask whether to replace it or add around it."
);
assert.ok(
  app.includes("const remainingWindowIds = new Set(project.windows.filter(win => win.windowId !== windowId).map(win => win.windowId))") &&
  app.includes("const upstreamWindowId = removedPlacement?.referenceWindowId || rootWindowId") &&
  app.includes("referenceWindowId: upstreamWindowId") &&
  app.includes("jointId: removedJoint ? \"\" : placement.jointId") &&
  !app.includes("placement.windowId !== windowId && placement.referenceWindowId !== windowId"),
  "Deleting a middle frame from an assembly must reattach downstream frames instead of dropping them."
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
  app.includes("function renderShapedProfileBevel") &&
  app.includes("function renderProfileDividerBevel") &&
  app.includes("function renderSashProfileRect") &&
  app.includes("function windowOuterShapePoints(win, frame)") &&
  app.includes("function windowInnerShapePoints(win, frame)") &&
  app.includes("function windowInnerFillPath(win, frame)") &&
  app.includes("function resolveCellShapeGeometry(win, item, frame)") &&
  app.includes("function cellRenderItemWithShape(win, item, frame)") &&
  app.includes("function renderAssemblyWindowInternalDimensions(win, topLeft, drawW, drawH, colEdges, rowEdges)") &&
  app.includes("const innerShapePoints = windowInnerShapePoints(win, frame)") &&
  app.includes("const innerShape = windowInnerShapePoints(win, { x, y, w: width, h: height, face: handleFace })") &&
  app.includes("const clipped = clipPolygonToRectPoints(innerShapePoints, item)") &&
  app.includes("function renderOpenCellAboveFrame(cell)") &&
  app.includes("function renderWindowFrameOcclusion(win, x, y, width, height, face, frameColor, outlineColor") &&
  app.includes("function cellOpeningRatio") &&
  app.includes("function openingWithPlane") &&
  app.includes('event?.target?.id === "opening"') &&
  app.includes("function sideHungSashGeometry") &&
  app.includes("function closedSashElevation") &&
  app.includes("function closedDoubleSideHungElevation") &&
  app.includes("function closedSymbolicElevation") &&
  app.includes("function closedCellElevation") &&
  app.includes("function projectMarkupPointForOpenSash") &&
  app.includes("renderProfileBevel(x, y, drawW, drawH, face, win)") &&
  app.includes("function clipPolygonToPolygonPoints(points, clipPoints)") &&
  app.includes("function clipPolygonToPolygonPieces(points, clipPoints)") &&
  app.includes("function frameOuterClipPoints(win, frame)") &&
  app.includes("function memberStripPoints(axis, center, start, end, thickness)") &&
  app.includes("function clippedMemberPolygon2d(strip, clipPoints)") &&
  app.includes("function clippedMemberPolygons2d(strip, clipPoints)") &&
  app.includes('memberStripPoints("vertical", x, dividerY, dividerY + dividerH, face)') &&
  app.includes("renderProfileDividerBevel(x, y, width, height)") &&
  app.includes("const rowEdges = rectsToEdges([...win.layout.rows].reverse(), -innerH / 2, innerH)") &&
  app.includes('const lineRange = hasInnerShape ? polygonLineRangePoints(innerShape, "vertical", colEdges[index]) : null') &&
  app.includes('const lineRange = hasInnerShape ? polygonLineRangePoints(innerShape, "horizontal", rowEdges[index]) : null') &&
  app.includes("const memberOverlap = Math.max(connectorOverlap, face * 0.55)") &&
  app.includes("const windowShapePoints = isRectangularWindowShape(win) ? null : threeFrameOpeningPoints3d(win, frameW, frameH, face)") &&
  app.includes("const memberClipPoints = shapePoints ? (windowOuterPoints || shapePoints) : null") &&
  app.includes("function threeAxisAlignedBoxForPolygon(points)") &&
  app.includes("function isThreePolygonConvex(points)") &&
  app.includes("function clipThreePolygonToSimplePolygonPieces(points, clipPoints)") &&
  app.includes("clipThreePolygonToSimplePolygonPieces(strip, frameOuter)") &&
  app.includes("clipThreePolygonToSimplePolygonPieces(strip, memberClipPoints)") &&
  app.includes("frameOuterPoints: windowShapeClip ? windowShapePoints3d(win, width, height) : null") &&
  app.includes("clipThreePolygonToSimplePolygonPieces(expandedPoints, rect.frameOuterPoints)") &&
  app.includes('"through-mullion-clipped", depth * 0.018') &&
  app.includes('"local-mullion-clipped", depth * 0.026') &&
  app.includes("selectionObject: sash") &&
  app.includes("const shapeObject = part.selectionObject || part.object") &&
  app.includes("const selectionZ = Number.isFinite(Number(part.selectionZ))") &&
  app.includes("shapeObject.updateMatrixWorld(true)") &&
  app.includes("applyMatrix4(shapeObject.matrixWorld)") &&
  app.includes("mesh.position.z = zOffset") &&
  app.includes("mesh.renderOrder = zOffset > 0 ? 12 : 10") &&
  app.includes("closedCellElevation(cell, item, outlineColor, frameColor, scale)") &&
  app.includes("openingSymbol(cell, symbolItem, symbolInset)") &&
  app.includes("slidingSashElevation(cell, item, outlineColor, frameColor, scale, false)") &&
  app.includes("slidingSashElevation(cell, item, outlineColor, frameColor, scale, true)") &&
  app.includes("hungSashElevation(cell, item, outlineColor, frameColor, scale, true)") &&
  app.includes("const geometry = sideHungSashGeometry(cell, item, scale)") &&
  app.includes("const openSidePoint = projectMarkupPointForOpenSash(cell, item, scale, markup)") &&
  app.includes("const projected = markup.kind === \"lock\"") &&
  app.includes("const reveal = Math.max(1.5, Math.min(5") &&
  app.includes("function pointOnSegment(start, end, ratio)") &&
  app.includes("const openAngle = openRatio * 78 * Math.PI / 180") &&
  app.includes("const hingeX = fixedHingeX") &&
  app.includes("const sideProjection = Math.min(width * 0.055, Math.max(7, sashFace * 0.85)) * Math.sin(openAngle)") &&
  app.includes("const hingeReturnX = hingeX + sideDirection * sideProjection") &&
  app.includes("const openProjectedWidth = width * Math.max(0.38, Math.cos(openAngle))") &&
  app.includes("const freeX = leftHinged ? hingeX + openProjectedWidth : hingeX - openProjectedWidth") &&
  app.includes("const projectionOffsetY = (outward ? -1 : 1) * Math.min(58, Math.max(0, height * 0.14 * Math.sin(openAngle)))") &&
  app.includes("const topFreeY = top + projectionOffsetY") &&
  app.includes("const bottomFreeY = top + height + projectionOffsetY") &&
  !app.includes("function elevationHiddenLineForPlane(openPlane)") &&
  app.includes("function pointToward(from, to, distance)") &&
  app.includes("function renderOpenSashProfileBands") &&
  app.includes("function openSashInnerPolygon(outer, face)") &&
  app.includes("const outer = metrics.shapedPoints?.length") &&
  app.includes("metrics.shapedPoints.map(projectClosedPoint)") &&
  app.includes("function polygonSideEdgeByX(points, preferMax = true)") &&
  app.includes("function sideHungSymbolForPolygon(cell, points, leftHinged, labelY)") &&
  app.includes("const shapedFreeEdge = shapedSash ? polygonSideEdgeByX(outer, leftHinged) : null") &&
  app.includes("const freeTopPoint = shapedFreeEdge?.topPoint || (leftHinged ? rightTop : leftTop)") &&
  app.includes("const symbolTopPoint = pointToward(hingePoint, freeTopPoint, symbolInset)") &&
  app.includes("cellOpeningRatio(entry.part.cell)") &&
  app.includes("function overheadPlanProjection(part, ratio)") &&
  app.includes("function renderPlanOverheadProjection(part, ratio, planY)") &&
  html.includes('id="assemblyOpenPercent"') &&
  html.includes('id="assemblyOpenPlane"') &&
  app.includes("renderSashProfilePolygon(outer, sashFace, frameColor, outlineColor)") &&
  app.includes('class="open-sash-closed-footprint"') &&
  app.includes('class="sash-hinge-axis"') &&
  app.includes('class="sash-hinge-plate"') &&
  app.includes('class="sash-mechanism-link"') &&
  app.includes("renderWindowFrameOcclusion(win, x, y, drawW, drawH, face, frameColor, outlineColor)") &&
  app.includes("renderWindowFrameOcclusion(win, topLeft.x, topLeft.y, drawW, drawH, face, frameColor, \"#26393e\", \"assembly-window-frame-occlusion\")") &&
  app.includes("renderAssemblyWindowInternalDimensions(win, topLeft, drawW, drawH, assemblyColEdges, assemblyRowEdges)") &&
  app.includes("shapeAngleDeg: isAngledWindowShape(type) ? clampShapeAngle(type, value.shapeAngleDeg ?? value.angleDeg) : 0") &&
  app.includes('bindById(id, "change", updateWindowFromInputs)') &&
  html.includes('id="shapeAngle"') &&
  app.includes("foregroundOpenCells.push(openElevation)") &&
  app.includes('class="open-sash-side-face"') &&
  app.includes('class="open-sash-hinge-channel"') &&
  app.includes('<path class="opening-symbol-line" d="${openLine}" />') &&
  css.includes(".profile-bevel-highlight") &&
  css.includes(".profile-bevel-shadow") &&
  css.includes(".open-sash-closed-footprint") &&
  css.includes(".open-sash-side-face") &&
  css.includes(".open-sash-hinge-channel") &&
  css.includes(".open-sash-profile-band") &&
  css.includes(".open-sash-glass") &&
  css.includes(".window-frame-occlusion") &&
  css.includes(".assembly-window-frame-occlusion") &&
  css.includes(".open-sash-foreground-layer") &&
  css.includes(".sash-hinge-axis") &&
  css.includes(".sash-hinge-plate") &&
  css.includes(".sash-mechanism-link") &&
  css.includes(".open-sash-pocket-guide") &&
  css.includes(".sash-profile-body") &&
  css.includes(".opening-symbol-line"),
  "Frame, mullion, and operable sash profiles must separate symbolic closed drawings from real open-state drawings for every opening family."
);
assert.ok(
  app.includes("function sizeRatioLabel(sizeMm)") &&
  app.includes("return `${Math.round(sizeMm)} mm`;") &&
  app.includes("sizeRatioLabel(widthMm, win.layout.columns[c], colTotal)") &&
  app.includes("sizeRatioLabel(heightMm, win.layout.rows[r], rowTotal)"),
  "Single-window mullion dimensions must show absolute mm values without exposing percentages."
);
assert.ok(
  !/\.topology-member-profile\s*\{[^}]*fill:/s.test(css) &&
  !/\.topology-member-profile\s*\{[^}]*stroke:\s*var\(--profile-dark\)/s.test(css),
  "Local mullion profile CSS must not override the per-window frame color."
);
assert.ok(css.includes('.preview-visibility input[type="checkbox"]') && css.includes("flex: 0 0 16px"), "3D visibility checkboxes must override the global full-width form-input rule.");
assert.ok(!css.includes(".preview-mode-fixed"), "The obsolete 3D multi-select banner style must be removed.");

const markupDef = schema.$defs?.cellMarkup;
assert.ok(markupDef, "Schema must define cell-hosted markup objects.");
assert.ok(markupDef.properties.kind.enum.includes("lock"), "Schema must accept lock hardware.");
assert.ok(markupDef.required.includes("hostWindowId"), "Schema must require an explicit host window.");
assert.ok(markupDef.required.includes("hostCellId"), "Schema must require an explicit host cell.");
const rootMarkupDef = schema.$defs?.windowMarkup;
assert.ok(rootMarkupDef, "Schema must define window-root text markup objects.");
assert.equal(rootMarkupDef.properties.hostType.const, "window", "Root text markups must declare whole-window ownership.");
assert.ok(app.includes("copy.markups = normalizeWindowMarkups(copy.markups).map") && app.includes("hostWindowId: copy.windowId") && app.includes("cellIdMap.set(oldCellId, cloned.cellId)"), "Duplicating a frame must regenerate root, cell, and markup ownership instead of sharing IDs with the source frame.");

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

console.log("Physical global editing checks passed: global openings, through/local mullion adjustment, internal joints, geometry dragging, hosted holes/locks, frame material, and 3D visibility.");
