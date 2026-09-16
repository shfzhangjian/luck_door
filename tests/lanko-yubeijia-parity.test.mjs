import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../dist/assets/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../dist/assets/app.css", import.meta.url), "utf8");
const joints = readFileSync(new URL("../dist/assets/joints.js", import.meta.url), "utf8");
const plan = readFileSync(new URL("../docs/lanko-yubeijia-parity-test-plan.md", import.meta.url), "utf8");

assert.ok(html.includes("<title>门窗云设计</title>"), "the parity branch should use the requested door-window cloud-design brand");
assert.ok(html.includes("<h1>门窗云设计</h1>"), "the visible brand should read 门窗云设计");
assert.equal(html.includes("豫贝家云设计"), false, "reference brand text should not be copied into the app shell");

[
  "转角设置",
  "修改料长",
  "修改角度 ▸",
  "修改角度 ▸ 90",
  "修改角度 ▸ 135",
  "修改角度 ▸ 180",
  "修改角度 ▸ 自定义",
  "转角形状 ▸",
  "弧形面转角",
  "万能转角",
  "矩形转角",
  "型材别名显示设置 ▸",
  "显示型材编码",
  "显示节点别名",
  "显示编码+别名",
  "隐藏型材文字",
  "更换转角料 ▸",
  "当前系列默认型材",
  "加强型材",
  "自定义输入"
].forEach(copy => assert.ok(html.includes(copy), `joint context menu should include ${copy}`));
assert.ok(html.includes("object-submenu"), "joint context menu should use reference-style nested submenu groups");

assert.ok(
  app.includes('canvasCommand = { mode: "add_joint", jointType: joint.type'),
  "adding one connector should keep the drawing command active for repeated edge placement"
);
assert.ok(
  app.includes("可继续点击其它边，右键退出添加"),
  "connector placement copy should match the reference repeated-placement workflow"
);
assert.ok(app.includes("function updateCanvasCommandControls()"), "tool buttons should reflect command mode");
assert.ok(css.includes(".palette-tile.command-active"), "command-mode tool state should be visually distinct");
assert.ok(html.includes("btnJointMenuShape"), "corner shape parent menu item should be present");
assert.ok(html.includes("btnJointMenuAlias"), "profile alias display parent menu item should be present");
assert.ok(app.includes("data-joint-style"), "corner shape submenu items should be wired");
assert.ok(app.includes("data-joint-alias"), "profile alias display submenu items should be wired");
assert.ok(app.includes("function setJointStyleFromMenu("), "corner shape submenu should update the joint style");
assert.ok(app.includes("function setJointAliasDisplayFromMenu("), "profile alias submenu should update persisted display mode");
assert.ok(app.includes("function setJointProfileFromMenu("), "profile replacement submenu should update the connector profile");
assert.ok(html.includes("jointSettingsPreviewWrap"), "corner settings should use a preview canvas wrapper like the reference modal");
assert.ok(html.includes("jointSettingsInlineInput"), "corner settings should support direct dimension editing in the preview");
assert.ok(app.includes("handleJointSettingsPreviewDoubleClick"), "corner settings preview should react to double-clicked dimensions");
assert.ok(app.includes("syncPlacementsForJoint(joint)"), "connector edits should synchronize attached frame placement and plan view");
assert.ok(html.includes('id="btnAddCornerJoint"'), "TC-08 left library should expose the 转角料 tool");
assert.ok(app.includes('startEngineeringJointPlacement("corner")'), "TC-08 clicking 转角料 should enter corner placement mode");
assert.ok(app.includes('canvasCommand = { mode: "add_joint", jointType: type === "corner" ? "corner" : "splice"'), "TC-08 corner placement should be a pending canvas command");
assert.ok(app.includes('const edges = canvasCommand.mode === "add_window_from_joint" ? [joint.hostEdge] : ["left", "right", "top", "bottom"]'), "TC-08 corner placement should expose all four edge zones on an existing frame");
assert.ok(app.includes('addEngineeringJointAtEdge(canvasCommand.jointType, edge)'), "TC-08 clicking an edge zone should add the corner to the existing frame");
assert.ok(app.includes('joint.type === "corner" ? `T${globalIndex + 1}` : `S${globalIndex + 1}`'), "TC-08 corner labels should display T1/T2 on the drawing");
assert.ok(app.includes('${Math.round(joint.legWidthAMm)}*${Math.round(joint.legWidthBMm)}'), "TC-08 corner annotation should show the section size as 100*100 after creation");
assert.ok(app.includes("内转"), "TC-08 default turn annotation should include 内转");
assert.ok(app.includes("右键退出"), "TC-08 right-click cancellation copy should be visible during placement");
assert.ok(app.includes("function showJointContextMenu(event, jointId)"), "TC-09 right-clicking a corner should open the joint context menu");
assert.ok(app.includes('item.classList.toggle("hidden", joint.type !== "corner")'), "TC-09 angle and shape submenus should only show for corner materials");
assert.ok(app.includes('item.classList.toggle("checked", joint.type === "corner" && Number(item.dataset.jointAngle) === Math.round(joint.angleDeg || 0))'), "TC-09 current corner angle should be checked in the right-click menu");
assert.ok(app.includes("function setJointAngleFromMenu(angleDeg)"), "TC-09 selecting an angle should call the menu angle handler");
assert.ok(app.includes("joint.angleDeg = Number(angleDeg);"), "TC-09 selecting 135 should persist the joint angle");
assert.ok(app.includes("syncPlacementsForJoint(joint);"), "TC-09 angle edits should synchronize connected frame placement");
assert.ok(app.includes("showToast(`转角角度已改为 ${joint.angleDeg}°。`)"), "TC-09 angle edits should confirm the new angle");
assert.ok(app.includes("${Math.round(joint.angleDeg || 180)}°"), "TC-09 elevation annotation should use the persisted corner angle");
assert.ok(app.includes("${Math.round(joint.angleDeg || 90)}°"), "TC-09 plan view annotation should use the persisted corner angle");
assert.ok(css.includes(".engineering-joint-selection") && css.includes("stroke: #e43928") && css.includes("stroke-dasharray: 7 5"), "TC-09 selected corner material should use a red dashed selection outline");
assert.ok(css.includes(".plan-engineering-joint.selected .plan-joint-profile"), "TC-09 selected plan corner material should expose a selected state");
assert.ok(html.includes('id="jointSettingsDialog"'), "TC-10 should include the dedicated corner settings dialog");
assert.ok(html.includes("选择转角样式") && html.includes("转角转向"), "TC-10 settings dialog should show style and orientation controls");
assert.ok(html.includes("保存") && html.includes("关闭"), "TC-10 settings dialog should show save and close actions");
assert.ok(html.includes("温馨提示") && html.includes("修改宽度：双击标尺修改转角料宽度；双击角度值可修改角度"), "TC-10 settings dialog should show the reference red tip copy");
assert.ok(joints.includes('{ value: "rectangular", label: "矩形转角" }'), "TC-10 settings style list should include 矩形转角");
assert.ok(joints.includes('{ value: "curved", label: "弧形面转角" }'), "TC-10 settings style list should include 弧形面转角");
assert.ok(joints.includes('{ value: "universal", label: "万能转角" }'), "TC-10 settings style list should include 万能转角");
assert.ok(joints.includes('{ value: "giant", label: "巨型转角" }'), "TC-10 settings style list should include 巨型转角");
assert.ok(html.includes('data-joint-style="giant"'), "TC-10 right-click shape submenu should also expose 巨型转角");
assert.ok(app.includes('renderSelect("jointSettingsStyle", JOINT_STYLE_OPTIONS[joint.type].map(item => [item.value, item.label]), joint.style)'), "TC-10 opening the dialog should populate style options from the engineering model");
assert.ok(app.includes('bindById("jointSettingsStyle", "change", applyJointSettingsDraft)'), "TC-10 style changes should update the preview immediately");
assert.ok(app.includes('bindById("jointSettingsOrientation", "change", applyJointSettingsDraft)'), "TC-10 orientation changes should update the preview immediately");
assert.ok(app.includes('const style = joint.style || "default"'), "TC-10 preview should branch by corner style");
assert.ok(app.includes('style === "giant"'), "TC-10 preview should render a distinct giant-corner state");
assert.ok(app.includes("joint-settings-style-mark"), "TC-10 preview should include visible style markers");
assert.ok(app.includes('if (setting === "angle" && joint.type === "corner") joint.angleDeg = nextValue;'), "TC-10 double-click angle editing should update the corner angle");
assert.ok(app.includes('if (setting === "legA") joint.legWidthAMm = nextValue;'), "TC-10 double-click dimension editing should update A-side width");
assert.ok(app.includes('if (setting === "legB") joint.legWidthBMm = nextValue;'), "TC-10 double-click dimension editing should update B-side width");
assert.ok(app.includes("function saveJointSettingsDialog()") && app.includes("markDirty();") && app.includes('showToast("连接件设置已保存。")'), "TC-10 saving the dialog should persist and rerender the drawing");
assert.ok(css.includes(".joint-settings-profile.giant"), "TC-10 giant-corner preview should have a distinct visual style");
assert.ok(html.includes('id="btnAddSpliceJoint"'), "TC-11 left library should expose the 拼接料 tool");
assert.ok(app.includes('startEngineeringJointPlacement("splice")'), "TC-11 clicking 拼接料 should enter splice placement mode");
assert.ok(app.includes("请在完整拼接图的虚线区域添加拼接料"), "TC-11 splice placement should use the complete assembly edge-click workflow");
assert.ok(app.includes('drawingMode = hasAssemblyScene() ? "assembly" : "window"'), "TC-11 splice/corner placement should stay on the complete assembled drawing when it exists");
assert.ok(app.includes('canvasCommand.mode !== "add_window_from_joint" && canvasCommand.mode !== "add_joint"'), "TC-11 assembly placement zones should support direct connector placement as well as connected-window placement");
assert.ok(app.includes('joint.type === "corner" ? "转角料" : "拼接料"'), "TC-11 splice placement should create a splice connector, not a corner material");
assert.ok(joints.includes('const defaultLegWidth = normalizedType === "corner" ? 100 : 50'), "TC-11 splice connectors should keep the reference 50 mm default width");
assert.ok(app.includes('function editJointLengthOrWidthFromMenu()'), "TC-11 right-click 修改料长 should have a splice-specific edit handler");
assert.ok(app.includes('if (joint.type !== "splice")'), "TC-11 width editing should distinguish splice connectors from corner materials");
assert.ok(app.includes('promptJointNumericValue("请输入拼接件宽度 mm", joint.legWidthAMm, 10, 300)'), "TC-11 right-click width editing should accept a 50 to 100 mm numeric change");
assert.ok(app.includes("joint.legWidthAMm = nextWidth;") && !app.includes("joint.legWidthBMm = nextWidth;"), "TC-11 width edits should preserve the independently configured section depth");
assert.ok(app.includes('showToast(`拼接件宽度已改为 ${Math.round(nextWidth)} mm。`)'), "TC-11 width edits should confirm the changed width");
assert.ok(app.includes('`宽${Math.round(joint.legWidthAMm)} · 长${Math.round(jointLengthMm(joint, win))}`'), "TC-11 elevation should label splice as width and length, not as a corner angle");
assert.ok(app.includes("Number(joint.legWidthAMm || 50) * (vertical ? mmToX : mmToDepth)"), "TC-11 plan view should derive splice section width from legWidthAMm");
assert.ok(app.includes('mode: "add_window_from_joint"'), "TC-12 selecting 四边框 with a selected connector should enter add-window-from-joint mode");
assert.ok(app.includes('addAssemblyPlacement(edge, { forceCreate: true, shapeType: pendingConnectedShapeType })'), "TC-12 clicking the connector zone should create a new attached frame, not replace the current frame");
assert.ok(app.includes("createConnectedWindow(referenceWindow, dock, useJoint, options.shapeType)"), "TC-12 connector-driven placement should create C2/C3 from the reference frame");
assert.ok(app.includes("embeddedInWindowId: rootWindowIdFor(referenceWindow)"), "TC-12 C2/C3 should stay inside the current door-window drawing");
assert.ok(app.includes("useJoint.connectedWindowIds = [...new Set(["), "TC-12 connectors should record the frames attached through them");
assert.ok(app.includes('drawingMode = "assembly";'), "TC-12 adding through a connector should switch to the combined drawing view");
assert.ok(app.includes('if (joint && type === "fixed_glass")') && app.includes("固定玻璃窗将通过当前连接点接出"), "TC-12 selected connector plus 固定玻璃 should enter connector-driven add-window flow");
assert.ok(app.includes("assembly-segment-dimension"), "TC-12 combined elevation should show per-frame segment dimensions as well as the total dimension");
assert.ok(app.includes("Math.round(item.w)"), "TC-12 segment dimensions should be based on each connected frame width");
assert.ok(app.includes("project.assemblies?.some(assembly => assembly.placements?.length) ? \"assembly\" : \"window\""), "TC-12 refresh should reopen the full assembly instead of a single window");
assert.ok(app.includes("function hasAssemblyScene(") && app.includes('if (hasAssemblyScene()) drawingMode = "assembly";'), "TC-12 canvas should keep the full assembly visible even while a drawing tool is active");
assert.ok(!html.includes('id="windowCards"') && !app.includes("function renderWindowCards("), "TC-12 bottom window cards should be removed rather than hidden");
assert.ok(app.includes("handleCanvasWheel"), "2D drawing canvas should support wheel zoom");
assert.ok(html.includes("canvasDimensionInput"), "2D drawing canvas should provide an inline dimension editor");
assert.ok(app.includes('data-dimension-edit="'), "2D dimension lines should expose direct edit targets");
assert.ok(css.includes(".dimension-hit"), "editable dimensions should expose a large hit area for real mouse double-clicks");
assert.ok(app.includes("function openCanvasDimensionEditor("), "2D dimension lines should open the inline editor on demand");
assert.ok(app.includes("function commitCanvasDimensionEditor("), "2D dimension edits should update the current window instead of creating a new one");
assert.ok(html.includes("俯视图"), "2D drawing options should keep the plan-view toggle visible");
assert.ok(app.includes('const showPlanView = Boolean(project.viewOptions?.showPlanView)'), "TC-13 plan view should be controlled by the 俯视图 toggle");
assert.ok(app.includes("function renderAssemblyPlanView("), "TC-13 assembled designs should render a plan view below the elevation");
assert.ok(app.includes("plan-side outside") && app.includes("室外") && app.includes("plan-side inside") && app.includes("室内"), "TC-13 plan view should label 室外/室内");
assert.ok(app.includes("assembly-plan-frame") && app.includes("assembly-plan-inner"), "TC-13 normal frames should show section profiles in the plan view");
assert.ok(app.includes("assembly-plan-corner-profile"), "TC-13 corner connectors should render an L-shaped plan profile");
assert.ok(app.includes("assembly-plan-joint-angle-arc"), "TC-13 corner connectors should render a plan angle arc");
assert.ok(app.includes("assembly-plan-joint-angle-label"), "TC-13 corner angle labels should update from the stored connector angle");
assert.ok(app.includes("assembly-plan-splice-profile"), "TC-13 splice connectors should render a straight post section");
assert.ok(app.includes("syncPlacementsForJoint(joint);"), "TC-13 angle/orientation edits should synchronize elevation and plan placement");
assert.ok(app.includes("canvasViewport") && app.includes("handleCanvasWheel"), "TC-13 wheel zoom should use one viewport for elevation and plan together");
assert.ok(html.includes('id="btnTextAnnotation"') && html.includes("文字标注"), "TC-14 top annotation toolbar should expose 文字标注");
assert.ok(html.includes('id="btnCircleHole"') && html.includes("圆孔"), "TC-14 top annotation toolbar should expose 圆孔");
assert.ok(html.includes('id="btnSquareHole"') && html.includes("方孔"), "TC-14 top annotation toolbar should expose 方孔");
assert.ok(html.includes('id="btnDuplicateWindow" class="toolbar-action"') && html.includes('id="btnDeleteWindow" class="toolbar-action danger"'), "Top edit toolbar buttons should use one icon-plus-text style");
assert.ok(html.includes('id="btnTextAnnotation" class="toolbar-action"') && html.includes('class="button-icon"'), "TC-14 annotation tools should use the same icon-plus-text toolbar style instead of vertical palette tiles");
assert.ok(css.includes(".toolbar-action.command-active"), "TC-14 active annotation tools should use toolbar command-active styling");
assert.ok(!html.includes('id="btnTextAnnotation" class="palette-tile"'), "TC-14 annotation tools should not reuse left-library tile styling in the top toolbar");
assert.ok(html.includes('id="canvasMarkupInput"'), "TC-14 double-click editing should use an in-canvas markup input");
assert.ok(app.includes('mode: "add_root_markup"') && app.includes('mode: "add_cell_markup"'), "TC-14 clicking text should enter root placement, while holes and hardware enter cell placement");
assert.ok(app.includes('createWindowMarkup("text"') && app.includes('hostType: "window"') && app.includes("hostCellId: \"\""), "TC-14 placing a text annotation should attach it to the whole window root instead of one glass cell");
assert.ok(app.includes("createCellMarkup(markupType, {") && app.includes('hostType: "cell"') && app.includes("hostCellId: cell.cellId"), "TC-14 placing holes or hardware should attach them to the concrete target cell instead of creating a new window");
assert.ok(app.includes("showMarkupPlacementPreview") && app.includes("markupPlacementPreview"), "TC-14 markup and hole tools should show a cursor-following placement preview");
assert.ok(app.includes("win.markups.push(markup)") && app.includes("cell.markups.push(markup)"), "TC-14 text should be stored on the window root while holes and hardware stay on the existing cell");
assert.ok(app.includes("function renderMarkupLayer(") && app.includes('id="markupLayer"'), "TC-14 elevation should render cell markups and glass holes on a dedicated markup layer");
assert.ok(app.includes("function renderWindowRootMarkups") && app.includes('class="markup-layer root-markup-layer"'), "TC-14 elevation should render root text annotations above the whole window");
assert.ok(app.includes('id="markupPreviewLayer"') && app.includes("previewLayer.append(preview)"), "TC-14 placement preview should be isolated from permanent markup objects");
assert.ok(app.includes('class="cell-markup ${markup.kind}') && app.includes("cell-markup-text"), "TC-14 text annotations should render as editable SVG objects");
assert.ok(app.includes("function beginMarkupDrag(") && app.includes("function updateMarkupDrag(") && app.includes("function commitMarkupDrag("), "TC-14 existing text, round hole, and square hole markups should support pointer dragging");
assert.ok(app.includes("group.setAttribute(\"transform\"") && app.includes("rootMarkupPositionFromEvent(group.dataset, event)") && app.includes('const margin = found.hostType === "window" || found.markup.kind === "text" ? 0 : 4'), "TC-14 dragging a markup should preview the move, persist root text freely, and keep holes or hardware inside their host cell");
assert.ok(css.includes("svg.window-canvas *") && css.includes("user-select: none") && app.includes('svg.addEventListener("selectstart", event => event.preventDefault())'), "TC-14 canvas text should not show browser text-selection highlights while editing");
assert.ok(app.includes("function findCellGroupFromEvent(") && app.includes("function bindCanvasMarkupPlacement("), "TC-14 markup placement should resolve any SVG click back to the target cell");
assert.ok(app.includes("cellIndex(row, col, win.layout.columns.length)") && !app.includes("cellIndex(win.layout, row, col)"), "TC-14 markup storage/editing should use the same row/column index mapping as the rest of the renderer");
assert.ok(app.includes("resetCanvasCommand();") && app.includes("markDirty();"), "TC-14 successful placement should exit markup placement mode so the preview stops following the mouse");
assert.ok(app.includes("function renderAssemblyWindowCells(") && app.includes("assembly-cell") && app.includes("assembly-markup-layer"), "TC-14 assembly drawings should render selectable cells plus text/hole markups on every connected window");
assert.ok(app.includes('data-window-id="${escapeHtml(item.windowId || "")}"') && app.includes('data-window-id="${escapeHtml(win.windowId)}"'), "TC-14 markup objects and cells should carry their owning window id");
assert.ok(app.includes("project.windows.find(item => item.windowId === cellGroup.dataset.windowId)"), "TC-14 placing text or holes in an assembly should write to the clicked window, not whichever window was previously selected");
assert.ok(app.includes("...project.windows.filter(win => win.windowId !== selected?.windowId)") && app.includes("function findMarkupObject"), "TC-14 selecting an existing markup should search root and cell objects across all current-canvas windows");
assert.ok(app.includes("openCanvasMarkupEditor(markup.markupId, event)") && app.includes("文字标注已挂到窗体根节点"), "TC-14 text placement should immediately open the text input after dropping on the canvas");
assert.ok(app.includes("circle_hole") && app.includes("square_hole"), "TC-14 should support both round and square glass holes");
assert.ok(app.includes("glass-hole-dimension") && app.includes("glass-hole-offset"), "TC-14 holes should show editable size and distance parameters");
assert.ok(app.includes("openCanvasMarkupEditor") && app.includes("commitCanvasMarkupEditor"), "TC-14 double-click editing should commit text, hole size, and position");
assert.ok(!html.includes('id="windowCards"') && html.includes('id="objectTree"'), "debug window selection should move from the bottom strip to the right-side object tree");
assert.ok(app.includes("function renderObjectTree(") && app.includes('bindById("objectTree", "click", handleObjectTreeClick)'), "right-side object tree should be rendered and selectable for manual debugging");
assert.ok(html.includes('class="object-tree-shell"') && css.includes(".object-tree-shell") && css.includes(".inspector-panel .inspector-pane"), "right inspector should keep the object tree independent from hidden legacy property panes");
assert.ok(html.includes('id="selectedObjectProperties"') && app.includes("function renderSelectedObjectProperties("), "right inspector should include a live selected-object property panel below the object tree");
assert.ok(app.includes("function objectTreeButton(") && app.includes("object-tree-branch") && css.includes(".object-tree-branch::before") && css.includes(".object-tree-children"), "object tree should be rendered as a visible hierarchical tree");
assert.ok(app.includes("canvasWindowIdsForDesign(project, assembly.assemblyId)") && app.includes("const canvasWindows = (project.windows || []).filter"), "object tree should only render windows that belong to the current canvas/assembly");
assert.ok(!app.includes("const windows = visibleDesignWindows();\n      const windowTree"), "object tree should not list every legacy root window in the project");
assert.ok(app.includes("function handleCanvasPanStart(") && app.includes("function handleCanvasPanMove(") && app.includes("svg.addEventListener(\"pointerdown\", handleCanvasPanStart)"), "2D canvas should support mouse drag panning");
assert.ok(css.includes(".canvas-stage") && css.includes("max-width: none;") && css.includes("svg.window-canvas") && css.includes("max-height: none;"), "2D canvas should fill the central work area instead of being constrained to a narrow capped drawing block");
assert.ok(html.includes('id="canvasPanHandle"') && css.includes(".canvas-pan-handle") && app.includes('bindById("canvasPanHandle"') === false && app.includes('panHandle?.addEventListener("pointerdown"'), "2D canvas should expose a draggable pan handle without replacing existing canvas panning");
assert.ok(app.includes("assembly-elevation-joint-hit") && css.includes(".assembly-elevation-joint-hit"), "Assembly elevation connection nodes should have a visible-size hit area");
assert.ok(app.includes(".assembly-elevation-joint, .assembly-plan-joint-group") && app.includes("data-joint-id=\"${jointPathId}\""), "Assembly elevation and plan connection nodes should share selectable joint binding");
assert.ok(app.includes("assembly-plan-joint-hit") && css.includes(".assembly-plan-joint-group.selected"), "Assembly plan connection nodes should show hover and selected highlights");
assert.ok(app.includes(".engineering-joint, .plan-engineering-joint") && css.includes(".plan-engineering-joint:hover .plan-joint-profile"), "Single-window plan connection nodes should also be selectable and highlighted");
assert.ok(app.includes("function renderAssemblyCommandZones(") && app.includes("assembly-joint-placement-zones"), "Selecting a connector then choosing a frame should show add zones around the complete assembled drawing");
assert.ok(app.includes('drawingMode = hasAssemblyScene() ? "assembly" : "window";') && app.includes("完整拼接图的虚线区域"), "Connector-driven frame insertion should stay in the full assembly view instead of falling back to the host window");
assert.ok(app.includes("view = { w: 900, h: showPlanView ? 800 : 700 }") && app.includes("view.h - elevationHeight - 86"), "Assembly plan initialization should leave bottom clearance away from the view-options bar");
assert.ok(app.includes("buildThreeWindowModel(item.window, scale, false") && app.includes("buildThreeWindowModel(win, scale, false"), "3D preview should default to window-only models without wall/opening host geometry");
assert.ok(!app.includes("根窗") && !html.includes("根窗"), "canvas, object tree, and menus should not display 根窗 copy");
[
  "新建项目",
  "打开项目",
  "新增窗型",
  "保存项目",
  "保存到窗型库",
  "手机量房图",
  "打印门窗",
  "项目管理",
  "联系电话",
  "项目进度",
  "编辑项目"
].forEach(copy => assert.ok(html.includes(copy), `project command bar should include ${copy}`));
assert.ok(html.includes("project-command-bar"), "top project commands should be grouped like the reference toolbar");
assert.ok(html.includes("system-command-bar"), "system status/export actions should stay separate from project commands");
[
  "门/窗框",
  "中梃/转角料/连接件",
  "开启扇",
  "推拉窗",
  "其他",
  "展开更多"
].forEach(copy => assert.ok(html.includes(copy), `left drawing library should include reference group ${copy}`));
assert.ok(
  css.includes("grid-template-columns: repeat(4, minmax(0, 1fr))"),
  "left drawing tools should use compact four-column icon tiles like the reference library"
);
assert.ok(app.includes('const PROJECT_LIBRARY_KEY = "doormes-designer-project-library-v1"'), "project library should persist complete project records");
assert.ok(app.includes("function saveCurrentProjectToLibrary("), "saving project should use the mock project repository");
assert.ok(app.includes("function loadProjectFromLibrary("), "opening project should restore a complete project record");
assert.ok(app.includes("function newProject("), "top-level new-project flow should be implemented");
assert.ok(app.includes("function validateProjectFields("), "project management should validate required project fields");
assert.ok(app.includes("project.project.contactPhone"), "project contact phone should be modeled and persisted");
assert.ok(app.includes("function openProjectEditDialog("), "project manager should include an edit-project dialog");
assert.ok(app.includes("function openMeasurementDialog("), "mobile measurement drawings should have a project entry point");
assert.ok(app.includes("function useMeasurementAsWindow("), "measurement openings should generate editable window designs");
[
  "智能窗型库",
  "我的窗型库",
  "templateSearch",
  "smartOpeningWidth",
  "smartOpeningHeight",
  "打开智能窗型库",
  "确定门洞尺寸",
  "data-template-source=\"smart\"",
  "data-template-source=\"custom\""
].forEach(copy => assert.ok(html.includes(copy), `window library UI should include ${copy}`));
assert.ok(app.includes('let activeTemplateLibrary = "smart"'), "window library should track smart/custom source state");
assert.ok(app.includes("function buildSmartTemplateCandidates("), "smart library should generate candidates from opening size");
assert.ok(css.includes(".project-manager-dialog"), "project-management dialog should be styled");
assert.ok(css.includes(".measurement-dialog"), "measurement dialog should be styled");
assert.ok(css.includes(".library-tab.active"), "window-library tabs should expose active state");
assert.ok(html.includes('id="projectCreateDialog"'), "TC-01 should open a dedicated new-project dialog");
assert.ok(html.includes('<h2 id="projectCreateTitle">新建项目</h2>'), "TC-01 dialog title should match the prototype");
assert.ok(html.includes('<span class="required-star">*</span>项目名称'), "TC-01 project name should be required");
assert.ok(html.includes('<span class="required-star">*</span>客户电话'), "TC-01 customer phone should be required");
[
  'id="createProjectAddress"',
  'id="createProjectCompanyName"',
  'id="createProjectClerk"',
  'id="createProjectDemandDate"',
  'id="createProjectNote"',
  'id="btnCancelProjectCreate"',
  'id="btnSaveProjectCreate"'
].forEach(markup => assert.ok(html.includes(markup), `TC-01 dialog should contain ${markup}`));
assert.ok(app.includes("function openProjectCreateDialog("), "TC-01 new-project entry should open the create dialog");
assert.ok(app.includes("function validateProjectCreateDialog("), "TC-01 should validate required project fields before create");
assert.ok(app.includes("function saveProjectCreateDialog("), "TC-01 should save from the create dialog");
assert.ok(app.includes("project = createFreshProject(details);"), "TC-01 save should create the project from dialog values");
assert.ok(!app.includes('confirm("新建项目会切换当前画布'), "TC-01 should not use the old confirm-only direct create flow");
assert.ok(html.includes('id="projectProgressChain"'), "TC-02 project manager should expose clickable progress nodes");
assert.ok(html.includes('id="projectPreviewWindows"'), "TC-02 project manager should expose a right-side project preview");
assert.ok(html.includes('id="btnProjectPreviewOpen"'), "TC-02 preview should have an explicit open-project button");
assert.ok(html.includes('id="btnProjectPreviewMeasurement"'), "TC-02 preview should have a project measurement entry");
assert.ok(app.includes("const PROJECT_STATUS_OPTIONS"), "TC-02 should keep project progress as shared status options");
assert.ok(app.includes("function projectManagerRecords("), "TC-02 should render current and saved projects as project cards");
assert.ok(app.includes("function renderProjectPreview("), "TC-02 should preview a card without opening the project");
assert.ok(app.includes("data-edit-project"), "TC-02 project cards should have an independent edit entry");
assert.ok(app.includes("data-open-project"), "TC-02 project cards should have an explicit open entry");
assert.ok(app.includes("function setProjectManagerStatus("), "TC-02 should update progress nodes from project management");
assert.ok(app.includes("function openSelectedProjectMeasurement("), "TC-02 should open measurement drawings for the selected project");
assert.ok(html.includes('id="componentSaveDialog"'), "TC-03 should use a save-to-window-library dialog");
assert.ok(html.includes('id="saveComponentType"'), "TC-03 should require choosing a window type when saving to my library");
assert.ok(app.includes("立即使用"), "TC-03 library cards should expose the reference immediate-use action");
assert.ok(app.includes('const CUSTOM_WINDOW_LIBRARY_KEY = "doormes-designer-custom-window-library-v1"'), "TC-03 my window library should persist outside the current project");
assert.ok(app.includes("function loadCustomWindowLibrary("), "TC-03 should load saved personal window templates");
assert.ok(app.includes("function confirmSaveComponent("), "TC-03 should save the current window from the dialog");
assert.ok(app.includes("function windowTemplateFromWindow("), "TC-03 should preserve the source window dimensions and style");
assert.ok(app.includes("data-use-template"), "TC-03 should use an explicit immediate-use button");
assert.ok(app.includes("project.windows.push(win);"), "TC-03 immediate use should generate a new editable window instead of replacing the current one");
assert.ok(app.includes("const referenceWindow = currentWindow();") && app.includes("ensureAssemblyForReference(referenceWindow)") && app.includes('switchInspector(drawingMode === "assembly" ? "assembly" : "window")'), "Template and measurement generated windows should attach to the current canvas when a reference window exists");
assert.ok(app.includes("windows: []"), "Project initialization should start from an empty drawing instead of a default sample window");
assert.ok(!app.includes("createDefaultProject().windows"), "Project normalization should preserve an empty window list");
assert.ok(html.includes('id="btnNewWindow" class="primary hidden"'), "The obsolete standalone new-window entry should be hidden");
assert.ok(app.includes("画布已清空") && !app.includes("至少保留一樘门窗。"), "Delete should remove the selected object and allow an empty drawing");
assert.ok(app.includes("function removeWindowObject("), "Deleting a selected window should clean related joints and assembly placements");
assert.ok(app.includes('mode: "add_root_window"') && app.includes("function createRootWindowFromCanvasCommand(") && app.includes("createRootWindowFromCanvasCommand();"), "Empty-canvas frame tool clicks should immediately create the first window");
assert.ok(app.includes("从左侧门/窗框工具添加第一个窗框") && !app.includes("请在空画布点击放置第一樘窗。"), "Empty canvas should no longer require a separate placement click for the first frame");
assert.ok(app.includes("function migrateLegacyProjectToCanvasModel("), "Opening saved projects should migrate away old multi-window/orphan sample data");
assert.ok(app.includes("project = migrateLegacyProjectToCanvasModel(record.design)") && app.includes("saveCurrentProjectToLibrary({ toast: false, validate: false })"), "Opening a project should persist the cleaned current-canvas model back to local project storage");
assert.ok(app.includes("project-preview-canvas") && !app.includes("project-preview-window-thumb"), "Project manager preview should show one current-canvas summary instead of old editable window cards");
assert.ok(html.includes('id="smartLibraryDialog"'), "TC-04 should use the reference three-step smart-library dialog");
assert.ok(html.includes("第一步：输入门洞尺寸"), "TC-04 smart dialog should show step 1 size input");
assert.ok(html.includes("第二步：选择门窗类型"), "TC-04 smart dialog should show step 2 type tabs");
assert.ok(html.includes("第三步：请选择你需要的门窗款式"), "TC-04 smart dialog should show step 3 style choices");
["全部", "固定", "平开", "推拉", "确定门洞尺寸"].forEach(copy => assert.ok(html.includes(copy), `TC-04 smart dialog should include ${copy}`));
assert.ok(app.includes("function openSmartLibraryDialog("), "TC-04 should open the smart-library dialog from the library entry");
assert.ok(app.includes("function switchSmartTemplateFilter("), "TC-04 should switch all/fixed/casement/sliding smart tabs");
assert.ok(app.includes("function filteredSmartTemplates("), "TC-04 should filter generated smart candidates");
assert.ok(app.includes("data-smart-use-template"), "TC-04 smart cards should have explicit immediate-use buttons");
assert.ok(app.includes("全国门窗合格率"), "TC-04 smart cards should show reference candidate statistics");
assert.ok(html.includes('data-shape-preset="rectangular"'), "TC-05 left frame library should include the four-side frame tool");
assert.ok(app.includes("function createWindowFromShapePreset("), "TC-05 frame tools should create a new frame window in normal drawing mode");
assert.ok(app.includes('const placementDock = ["left", "right", "top", "bottom", "free"].includes(options.dock) ? options.dock : "right"') && app.includes("const anchor = insertionAnchorForSide(assembly, referenceWindow, placementDock)") && app.includes("createAssemblyPlacement(win.windowId, anchor.referenceWindow.windowId, anchor.dock"), "TC-05 additional frame tools should attach or insert the new frame on the chosen side instead of creating an invisible standalone window");
assert.ok(app.includes('showToast(`已在${referenceWindow ? dockLabel(options.dock || "right") : "画布"}${referenceWindow && selectedPlacementId && currentPlacement()?.note ? "插入" : "生成"}${shapeLabel(type)}窗框。`)'), "TC-05 frame creation should confirm whether the generated frame was inserted or placed");
assert.ok(app.includes('"windowWidth"'), "TC-05 bottom total-width ruler should have an editable dimension target");
assert.ok(app.includes('"windowHeight"'), "TC-05 side total-height ruler should have an editable dimension target");
assert.ok(app.includes("function openCanvasDimensionEditor("), "TC-05 double-clicking a ruler should open the inline dimension editor");
assert.ok(app.includes("win.widthMm = value;"), "TC-05 width editor should update the current window width");
assert.ok(app.includes("win.heightMm = value;"), "TC-05 height editor should update the current window height");
assert.ok(html.includes('data-cell-opening="left_out"'), "TC-06 opening-sash library should include a left-out casement tool");
assert.ok(html.includes('data-cell-opening="right_out"'), "TC-06 opening-sash library should include a right-out casement tool");
assert.ok(html.includes('data-cell-panels="2"'), "TC-06 opening-sash library should include a double-casement tool");
assert.ok(app.includes("function startCellPresetPlacement("), "TC-06 clicking an opening-sash tool should enter placement mode");
assert.ok(app.includes('mode: "apply_cell_preset"'), "TC-06 placement mode should be represented as a canvas command");
assert.ok(app.includes('canvasCommand.mode === "apply_cell_preset"'), "TC-06 target cell clicks should apply the pending opening-sash command");
assert.ok(app.includes("applyCellPreset(canvasCommand.cellPreset"), "TC-06 should apply the tool to the clicked target cell");
assert.ok(app.includes("请在画布点击目标窗格，右键退出"), "TC-06 should prompt the user to click a target cell");
assert.ok(css.includes(".cell-placement-target"), "TC-06 target cells should expose a visual hover placement state");
assert.ok(!app.includes('btn.addEventListener("click", () => applyCellPreset(btn.dataset.cellPreset))'), "TC-06 tool clicks should not immediately mutate the currently selected cell");
assert.ok(html.includes("<h3>推拉扇</h3>"), "TC-07 sliding-sash library should use the reference 推拉扇 section name");
assert.ok(html.includes("两扇等分"), "TC-07 sliding-sash library should include the two-panel sliding style");
assert.ok(html.includes("三扇三等分"), "TC-07 sliding-sash library should include the three-panel sliding style");
assert.ok(html.includes("四扇四等分"), "TC-07 sliding-sash library should include the four-panel sliding style");
assert.ok(html.includes('data-cell-preset="sliding" data-cell-panels="4" data-cell-tracks="2"'), "TC-07 four-panel sliding tool should carry panel and track metadata");
assert.ok(app.includes("四扇四等分推拉"), "TC-07 sliding placement toast should identify the selected sliding style");
assert.ok(app.includes("cellTracks"), "TC-07 sliding placement command should preserve track count until target click");
assert.ok(app.includes("trackCount: trackCount || next.openingAssembly.trackCount"), "TC-07 applying sliding sash should update the opening assembly track count");
assert.ok(app.includes('if (type === "sliding")'), "TC-07 applying sliding sash should run sliding-specific updates");
assert.ok(app.includes("slidingSeries"), "TC-07 applying sliding sash should select a sliding profile series when available");
assert.ok(app.includes("win.seriesId = slidingSeries.id"), "TC-07 sliding sash should update the current window series rather than creating a new window");
[
  "是否带转角料",
  "玻璃带百叶",
  "玻璃带纱窗",
  "玻璃带玻璃护栏",
  "是否带纱",
  "是否带玻璃护栏",
  "带防盗条",
  "竖向显示线",
  "切换摆放方式",
  "是否显示玻璃分隔",
  "清空格条"
].forEach(copy => assert.ok(html.includes(copy), `cell context menu should include ${copy}`));
assert.ok(app.includes("function applyCellMenuAction("), "reference-style cell menu actions should be wired");
assert.ok(app.includes("guardRail"), "glass guard rail should be persisted and rendered as an accessory");

assert.ok(html.includes("一键加纱"), "TC-15 left tool library should expose the reference one-click screen command");
assert.ok(html.includes('id="btnOneClickScreen"'), "TC-15 one-click screen should be a direct command button");
assert.ok(app.includes("function applyScreensToAllOperableCells("), "TC-15 one-click screen should have a current-window batch command");
assert.ok(app.includes("win.layout.cells.forEach(cell =>"), "TC-15 one-click screen should scan the existing window cells");
assert.ok(app.includes("if (!isOperableType(cell.type)) return;"), "TC-15 one-click screen should only affect operable sashes");
assert.ok(app.includes("screenMode: nextMode"), "TC-15 screen mode should persist on opening assemblies/accessories");
assert.ok(app.includes('bindById("btnOneClickScreen", "click", applyScreensToAllOperableCells)'), "TC-15 one-click screen button should be wired");
assert.ok(html.includes("是否带纱"), "TC-15 single-sash screen toggle should remain in the right-click menu");
assert.ok(app.includes('data-cell-menu-action="screen"') || html.includes('data-cell-menu-action="screen"'), "TC-15 single-sash screen toggle should use the cell menu action");
assert.ok(css.includes(".screen-line"), "TC-15 added screen areas should show mesh lines in 2D");
assert.ok(
  app.includes("const SCREEN_MESH_COLUMNS = 12") &&
  app.includes("const SCREEN_MESH_ROWS = 14") &&
  app.includes("index < SCREEN_MESH_COLUMNS") &&
  app.includes("index < SCREEN_MESH_ROWS") &&
  app.includes("addGrid(parent, rect, mats.screenLine, SCREEN_MESH_COLUMNS, SCREEN_MESH_ROWS)") &&
  app.includes("addGrid(screen, { x: 0, y: 0, w: width, h: height, face: rect.face, depth: rect.depth }, mats.screenLine, SCREEN_MESH_COLUMNS, SCREEN_MESH_ROWS)") &&
  css.includes(".screen-mesh-line"),
  "TC-15 screen mesh density should be shared and high-density in both 2D and 3D."
);
assert.ok(html.includes("板材单扇"), "TC-16 left tool library should expose single-panel board placement");
assert.ok(html.includes("板材双扇"), "TC-16 left tool library should expose double-panel board placement");
assert.ok(html.includes('data-panel-mode="single"'), "TC-16 single-panel board tool should carry placement metadata");
assert.ok(html.includes('data-panel-mode="double"'), "TC-16 double-panel board tool should carry placement metadata");
assert.ok(html.includes('id="cellPanelMode"'), "TC-16 inspector should show the selected cell board mode");
assert.ok(app.includes("panelMode: options.panelMode ||"), "TC-16 board placement should carry the selected panel mode");
assert.ok(app.includes("cell.panelMode = requestedPanelMode"), "TC-16 applying a board should replace the old single/double board mode on the same cell");
assert.ok(app.includes('cell.infillType = type === "panel" && options.panelMode'), "TC-16 double-board replacement should not toggle the existing board back to glass");
assert.ok(app.includes("function addThreePanelInfill("), "TC-16 board infill should render as a dedicated 3D infill");
assert.ok(app.includes("normalizePanelMode(cell?.panelMode)"), "TC-16 board mode should be normalized before rendering");
assert.ok(app.includes("panel-leaf-divider"), "TC-16 double-panel boards should show a divider in 2D");
assert.ok(css.includes(".panel-mode-label"), "TC-16 2D board mode labels should be styled");
assert.ok(html.includes('id="surroundDesignDialog"'), "TC-17 package design should open a dedicated dialog");
assert.ok(html.includes("第一步：选择包套样式"), "TC-17 package dialog should preserve the first style-selection step");
assert.ok(html.includes("第二步：选择包套类型"), "TC-17 package dialog should preserve the package-type step");
assert.ok(html.includes("第三步：确认尺寸"), "TC-17 package dialog should preserve the dimension confirmation step");
["全边框", "三边无底框", "左上包框", "右上包框"].forEach(copy => {
  assert.ok(html.includes(copy), `TC-17 package type option should include ${copy}`);
});
assert.ok(html.includes('id="btnConfirmSurroundDesign"'), "TC-17 package dialog should include confirm design action");
assert.ok(app.includes('bindById("btnConfigureSurround", "click", openSurroundDesignDialog)'), "TC-17 package tool should open the dialog from the left library");
assert.ok(app.includes("function openSurroundDesignDialog("), "TC-17 package dialog open flow should exist");
assert.ok(app.includes("function confirmSurroundDesign("), "TC-17 confirm should write package data back to the current window");
assert.ok(app.includes("win.installation.surround = normalizeSurround"), "TC-17 confirm should persist package data on the window installation object");
assert.ok(app.includes("handleSurroundDialogPreviewDoubleClick"), "TC-17 package dimensions should support double-click editing");
assert.ok(app.includes("commitSurroundDialogInlineEditor"), "TC-17 package dimension editor should commit edited values");
assert.ok(app.includes("handleSurroundDialogWheel"), "TC-17 package preview should support wheel zoom");
assert.ok(app.includes("handleSurroundDialogPointerDown") && app.includes("event.button !== 1"), "TC-17 package preview should support middle-button panning");
assert.ok(app.includes("renderSurroundElevation(win"), "TC-17 confirmed package should render around the 2D window frame");
assert.ok(css.includes(".surround-design-dialog"), "TC-17 package dialog should have dedicated dialog styling");
assert.ok(css.includes(".surround-dialog-dimension-text"), "TC-17 package editable dimension text should be visually distinct");
assert.ok(html.includes("一键添加防盗条"), "TC-18 left tool library should expose one-click security-bar placement");
assert.ok(html.includes('id="btnOneClickSecurityBars"'), "TC-18 one-click security bars should be a direct command button");
assert.ok(html.includes('data-cell-menu-action="security"') && html.includes("带防盗条"), "TC-18 right-click menu should expose the single-target security-bar command");
assert.ok(app.includes("function applySecurityBarsToAllCells("), "TC-18 one-click security bars should have a current-window batch command");
assert.ok(app.includes("function cellCanReceiveSecurityBars("), "TC-18 security bars should have a target eligibility check");
assert.ok(app.includes("securityBars: true"), "TC-18 one-click security bars should persist on target cells");
assert.ok(app.includes("cell.accessories.securityBars = !cell.accessories.securityBars"), "TC-18 right-click security bars should only toggle the selected cell");
assert.ok(app.includes('bindById("btnOneClickSecurityBars", "click", applySecurityBarsToAllCells)'), "TC-18 one-click security bars button should be wired");
assert.ok(app.includes("已为选中区域添加防盗条"), "TC-18 single-target action should use reference security-bar copy");
assert.ok(app.includes("security-bar-line"), "TC-18 security bars should render as dedicated 2D overlay lines");
assert.ok(css.includes(".security-bar-line"), "TC-18 security-bar overlay should be styled independently from grille lines");
assert.ok(html.includes('data-cell-menu-action="guardRail"') && html.includes("玻璃带玻璃护栏"), "TC-19 right-click menu should expose the glass guard-rail command");
assert.ok(html.includes("是否带玻璃护栏"), "TC-19 right-click menu should preserve the reference guard-rail wording");
assert.ok(app.includes("cell.accessories.guardRail = !cell.accessories.guardRail"), "TC-19 guard rail should only toggle the selected glass cell");
assert.ok(app.includes("已为选中玻璃添加玻璃护栏"), "TC-19 guard-rail action should confirm the single-target change");
assert.ok(app.includes("guard-rail-line"), "TC-19 guard rail should render as a dedicated 2D overlay");
assert.ok(css.includes(".guard-rail-line"), "TC-19 guard-rail overlay should not intercept target glass clicks");
assert.ok(html.includes("保存门窗信息") && html.includes('id="btnSaveWindowInfo"'), "TC-20 right inspector should expose save-window-info action");
assert.ok(html.includes('id="btnSaveWindowAndNew"') && html.includes("保存门窗并新增"), "TC-20 should expose save-and-create-next-window action");
assert.ok(html.includes('id="windowSaveConfirmDialog"') && html.includes("确认添加"), "TC-20 saving window info should require an add-to-project confirmation dialog");
["saveInstallLocation", "saveSeriesId", "saveGlassTypeId", "saveColor", "saveOpeningMode", "saveUnitPrice", "saveTotalPrice"].forEach(id => {
  assert.ok(html.includes(`id="${id}"`), `TC-20 save-window form should include ${id}`);
});
assert.ok(app.includes("function normalizeWindowOrderInfo("), "TC-20 window save data should be normalized on each window object");
assert.ok(app.includes("function validateWindowSaveInfo("), "TC-20 should validate required window save fields before saving");
assert.ok(app.includes("窗号、安装位置、系列、玻璃为必填项"), "TC-20 validation copy should match required fields");
assert.ok(app.includes("function openWindowSaveConfirmDialog("), "TC-20 save button should open the confirmation dialog");
assert.ok(app.includes("function confirmSaveWindowInfo("), "TC-20 confirmation should persist the current window into the project");
assert.ok(app.includes("saveCurrentProjectToLibrary({ toast: false, validate: false })"), "TC-20 confirmed save should persist the project record");
assert.ok(app.includes("function saveWindowInfoAndCreateNext(") && app.includes("newWindow();"), "TC-20 save-and-new should retain the old window and create the next one");
assert.ok(app.includes('bindById("btnSaveWindowInfo", "click", openWindowSaveConfirmDialog)'), "TC-20 save-window-info button should be wired");
assert.ok(app.includes('bindById("btnConfirmSaveWindowInfo", "click", confirmSaveWindowInfo)'), "TC-20 confirm-add button should be wired");
assert.ok(css.includes(".price-row") && css.includes(".confirm-summary"), "TC-20 save form and confirmation summary should have dedicated styling");

[
  "TC-01 新建项目",
  "TC-02 项目管理",
  "TC-08 转角料添加",
  "TC-11 拼接件添加与修改",
  "TC-12 连接后继续增加窗框",
  "TC-13 俯视图",
  "TC-14 文字标注与玻璃孔",
  "TC-15 一键加纱与单扇加纱",
  "TC-16 板材单扇/双扇替换",
  "TC-17 包套设计",
  "TC-18 防盗条",
  "TC-19 玻璃护栏",
  "TC-20 保存门窗信息"
].forEach(title => assert.ok(plan.includes(title), `acceptance plan should include ${title}`));

console.log("Validated Lanko/Yubeijia parity shell, repeated connector placement, menu copy, wheel zoom, and acceptance plan coverage.");
