import { builtInTemplates, categoryLabels, defaultCatalog, typeLabels } from "./catalog.js?v=20260912-43";
import { buildInterfacePackage, calculateProjectBom, cellIndex, hashString, materialName, sum } from "./calculation.js?v=20260912-43";
import {
  OPERABLE_TYPES,
  applyOpeningTransform,
  assemblyLimits,
  cornerSlidingMotionVectors,
  defaultOpeningAssembly,
  defaultOpeningForType,
  isOperableType,
  foldingPlanProjections,
  motionLabelForType,
  normalizeOpeningAssembly,
  normalizeOpening,
  openingPlanProjection,
  openingAssemblySummary,
  openingLabel,
  openingOptionsForType
} from "./openings.js?v=20260912-43";
import {
  createCellId,
  createLocalMullion,
  findMemberHost,
  memberLabel,
  memberLengthMm,
  normalizeMember,
  normalizeTopology,
  partitionTopologyRegion
} from "./topology.js?v=20260912-43";
import {
  JOINT_STYLE_OPTIONS,
  createEngineeringJoint,
  defaultJointProfile,
  jointLabel,
  jointLengthMm,
  jointStatus,
  normalizeEngineeringJoint,
  normalizeEngineeringJoints
} from "./joints.js?v=20260912-43";
import {
  assemblyBounds,
  assemblySummary,
  createAssemblyPlacement,
  createWindowAssembly,
  dockLabel,
  normalizeWindowAssemblies,
  resolveAssemblyLayout
} from "./assemblies.js?v=20260912-43";
import {
  FRAME_ALIGNMENT_OPTIONS,
  MOUNTING_MODE_OPTIONS,
  SURROUND_EDGE_OPTIONS,
  SURROUND_STYLE_OPTIONS,
  WALL_CORNER_MODE_OPTIONS,
  WALL_MATERIAL_OPTIONS,
  normalizeSurround,
  resolveFramePlacement,
  resolveInstallationSection,
  resolveSurroundSides,
  surroundGeometry,
  surroundSideLabel,
  surroundSummary
} from "./installations.js?v=20260912-43";

const STORAGE_KEY = "doormes-designer-v1";
const THREE_MODULE_URL = "three";
const ORBIT_CONTROLS_URL = "three/addons/controls/OrbitControls.js";
const SHAPE_PRESETS = Object.freeze([
  { type: "rectangular", label: "四边框", icon: "□", description: "标准矩形洞口和窗框" },
  { type: "arched", label: "上拱框", icon: "⌒", description: "顶部拱形固定或组合窗" },
  { type: "trapezoid", label: "右斜顶框", icon: "⌿", description: "右侧斜顶或平行四边形外框" },
  { type: "trapezoid_left", label: "左斜顶框", icon: "⍀", description: "左侧斜顶或反向平行四边形外框" },
  { type: "trapezoid_peak", label: "双斜顶框", icon: "⌂", description: "顶部双坡/尖顶异形框" },
  { type: "notch_top_left", label: "左上缺角框", icon: "┌", description: "左上角让位的 L 形外框" },
  { type: "notch_top_right", label: "右上缺角框", icon: "┐", description: "右上角让位的 L 形外框" },
  { type: "custom_polygon", label: "DIY异形框", icon: "DIY", description: "按点位录入的自定义多边形外框" }
]);
const SHAPE_PRESET_BY_TYPE = Object.freeze(Object.fromEntries(SHAPE_PRESETS.map(item => [item.type, item])));
const LEGACY_FILL_CELL_TYPES = Object.freeze(["screen", "louver", "grille", "panel"]);
const INFILL_TYPES = Object.freeze(["glass", "panel", "louver"]);
const CELL_SCREEN_MODES = Object.freeze(["none", "fixed", "swing", "sliding", "retractable"]);

    let project = loadProject();
    let selectedWindowId = project.windows[0]?.windowId || "";
    let selectedCell = { row: 0, col: 0 };
    let selectedMemberId = "";
    let selectedJointId = "";
    let selectedAssemblyId = project.assemblies?.[0]?.assemblyId || "";
    let selectedPlacementId = "";
    let drawingMode = "window";
    let activeLeftTab = "draw";
    let activeInspectorTab = "window";
    let activeBomTab = "summary";
    let activeModule = "draw";
    let lastMainModule = "draw";
    let bom = calculateProjectBom(project);
    const diyShapeEditor = {
      points: [],
      selectedIndex: -1,
      draggingIndex: -1,
      closed: false,
      editingShapeId: ""
    };
    let threeLib = null;
    let orbitControlsLib = null;
    let threeImporting = false;
    let threeUnavailable = false;
    let previewNeedsRebuild = true;
    const preview3d = {
      renderer: null,
      scene: null,
      camera: null,
      controls: null,
      group: null,
      floor: null,
      grid: null,
      viewportWidth: 0,
      viewportHeight: 0,
      bounds: null,
      openables: [],
      selectedPartKey: "",
      selectedPartKeys: new Set(),
      selectionMode: "single",
      selectionHelpers: [],
      contextPartKey: "",
      playback: null,
      raycaster: null,
      pointer: null,
      pointerDown: null,
      lastFrameAt: 0,
      raf: 0
    };

    function createDefaultProject() {
      return {
        schemaVersion: "cn-door-window-design.v2",
        project: {
          projectId: "P-2026-001",
          name: "中国门窗设计样板工程",
          customerName: "样板客户",
          address: "项目地址"
        },
        order: {
          orderId: "SO-001",
          batchNo: "BATCH-001",
          source: "designer"
        },
        catalog: structuredClone(defaultCatalog),
        componentLibrary: [],
        joints: [],
        assemblies: [],
        viewOptions: {
          showOpenState: true,
          showProfileColor: true,
          showDimensions: true,
          showPlanView: true
        },
        calculation: {
          status: "draft",
          mbomVersion: 0,
          lastCalculatedAt: "",
          confirmedAt: "",
          frozenAt: "",
          lastHash: "",
          events: []
        },
        customShapes: [],
        integrations: {
          reservedEvents: [
            "design.submitted",
            "bom.calculated",
            "bom.confirmed",
            "bom.frozen",
            "manufacturing_package.ready",
            "design.revised"
          ],
          externalRefs: []
        },
        windows: [
          createWindow({
            mark: "C-01",
            name: "客厅窗",
            widthMm: 1800,
            heightMm: 1500,
            quantity: 2,
            floor: "1F",
            room: "客厅",
            layout: {
              columns: [1, 1],
              rows: [1],
              cells: [
                { type: "fixed_glass", opening: "left_in" },
                { type: "turn_tilt", opening: "right_in" }
              ]
            }
          })
        ]
      };
    }

    function createWindow(overrides = {}) {
      const idPart = Math.random().toString(36).slice(2, 8).toUpperCase();
      const layout = normalizeLayout(overrides.layout || {
        columns: [1],
        rows: [1],
        cells: [{ type: "fixed_glass", opening: "left_in" }]
      });
      return {
        windowId: overrides.windowId || `W-${idPart}`,
        mark: overrides.mark || `C-${String(Date.now()).slice(-4)}`,
        name: overrides.name || "新门窗",
        quantity: Number(overrides.quantity || 1),
        widthMm: Number(overrides.widthMm || 1200),
        heightMm: Number(overrides.heightMm || 1500),
        floor: overrides.floor || "",
        room: overrides.room || "",
        seriesId: overrides.seriesId || "AL70",
        colorInside: overrides.colorInside || "RAL9016",
        colorOutside: overrides.colorOutside || "RAL7016",
        defaultGlassTypeId: overrides.defaultGlassTypeId || "GL-LOWE-24",
        defaultHardwareSetId: overrides.defaultHardwareSetId || "HW-TT-STD",
        installation: {
          sillHeightMm: Math.max(0, Number(overrides.installation?.sillHeightMm ?? overrides.sillHeightMm ?? 0)),
          surround: normalizeSurround(overrides.installation?.surround)
        },
        shape: normalizeWindowShape(overrides.shape),
        geometryMode: overrides.geometryMode === "topology" || overrides.topology?.members?.length ? "topology" : "grid",
        layout,
        topology: normalizeTopology(overrides.topology, layout),
        notes: overrides.notes || ""
      };
    }

    function normalizeWindowShape(value = {}) {
      const type = SHAPE_PRESET_BY_TYPE[value?.type] ? value.type : "rectangular";
      const defaultPoints = type === "custom_polygon"
        ? [{ x: 0, y: 20 }, { x: 50, y: 0 }, { x: 100, y: 20 }, { x: 100, y: 100 }, { x: 0, y: 100 }]
        : [];
      return {
        type,
        archHeightMm: type === "arched" ? Math.max(120, Math.round(Number(value.archHeightMm) || 220)) : 0,
        points: type === "custom_polygon" ? normalizeShapePoints(value.points, defaultPoints) : []
      };
    }

    function shapeLabel(type) {
      return SHAPE_PRESET_BY_TYPE[type]?.label || SHAPE_PRESET_BY_TYPE.rectangular.label;
    }

    function normalizeShapePoints(points, fallback = []) {
      const source = Array.isArray(points) ? points : fallback;
      const normalized = source
        .map(point => ({
          x: Math.min(100, Math.max(0, Math.round(Number(point?.x) * 10) / 10)),
          y: Math.min(100, Math.max(0, Math.round(Number(point?.y) * 10) / 10))
        }))
        .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
      return normalized.length >= 3 ? normalized : fallback;
    }

    function fitShapePointsToBounds(points, fallback = []) {
      const normalized = normalizeShapePoints(points, fallback);
      if (normalized.length < 3) return normalized;
      const xs = normalized.map(point => point.x);
      const ys = normalized.map(point => point.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const spanX = maxX - minX;
      const spanY = maxY - minY;
      if (spanX < 0.1 || spanY < 0.1) return normalized;
      return normalized.map(point => ({
        x: Math.min(100, Math.max(0, Math.round(((point.x - minX) / spanX) * 1000) / 10)),
        y: Math.min(100, Math.max(0, Math.round(((point.y - minY) / spanY) * 1000) / 10))
      }));
    }

    function parseShapePointsText(text, fallback = []) {
      const points = String(text || "")
        .split(/\s+/)
        .map(token => token.trim())
        .filter(Boolean)
        .map(token => {
          const [x, y] = token.split(",").map(Number);
          return { x, y };
        });
      return normalizeShapePoints(points, fallback);
    }

    function formatShapePoints(points) {
      return normalizeShapePoints(points).map(point => `${formatPointCoord(point.x)},${formatPointCoord(point.y)}`).join(" ");
    }

    function formatPointCoord(value) {
      return Number.isInteger(value) ? String(value) : value.toFixed(1);
    }

    function normalizeCustomShapeElement(value) {
      const points = fitShapePointsToBounds(value?.points);
      if (points.length < 3) return null;
      return {
        shapeId: String(value?.shapeId || `DIY-${Date.now().toString(36).toUpperCase()}`),
        name: String(value?.name || "DIY异形框"),
        windowId: String(value?.windowId || ""),
        points,
        createdAt: String(value?.createdAt || new Date().toISOString())
      };
    }

    function normalizeCellCustomShape(value) {
      if (!value) return null;
      const points = fitShapePointsToBounds(value.points);
      if (points.length < 3) return null;
      return {
        shapeId: String(value.shapeId || ""),
        name: String(value.name || "DIY异形构件"),
        points
      };
    }

    function migrateLegacyCellType(type) {
      if (type === "panel") return { type: "fixed_glass", infillType: "panel" };
      if (type === "louver") return { type: "fixed_glass", infillType: "louver" };
      if (type === "grille") return { type: "fixed_glass", accessories: { grille: true } };
      if (type === "screen") return { type: "fixed_glass", accessories: { screenMode: "fixed" } };
      return { type };
    }

    function normalizeCellInfillType(value) {
      return INFILL_TYPES.includes(value) ? value : "glass";
    }

    function normalizeCellAccessories(value = {}) {
      const screenMode = CELL_SCREEN_MODES.includes(value?.screenMode) ? value.screenMode : "none";
      return {
        grille: Boolean(value?.grille),
        screenMode,
        securityBars: Boolean(value?.securityBars),
        frosted: Boolean(value?.frosted)
      };
    }

    function defaultScreenModeForCell(cell) {
      if (!cell || !isOperableType(cell.type)) return "fixed";
      if (["sliding", "lift_slide", "psk", "parallel_slide", "pocket_slide", "corner_slide", "vertical_slide"].includes(cell.type)) return "sliding";
      if (cell.type === "folding") return "retractable";
      return "swing";
    }

    function createCell(type = "fixed_glass", opening = "") {
      const normalizedOpening = normalizeOpening(type, opening || defaultOpeningForType(type));
      return {
        cellId: createCellId(),
        type,
        opening: normalizedOpening,
        openingAssembly: defaultOpeningAssembly(type, normalizedOpening),
        glassTypeId: "",
        hardwareSetId: defaultHardwareSetForType(type),
        panelTypeId: "PN-SANDWICH",
        infillType: "glass",
        accessories: normalizeCellAccessories(),
        handleHeightMm: 750,
        customShape: null,
        note: ""
      };
    }

    function defaultHardwareSetForType(type) {
      return {
        turn: "HW-TURN-STD",
        turn_tilt: "HW-TT-STD",
        top_hung: "HW-HUNG-STD",
        bottom_hung: "HW-HUNG-STD",
        sliding: "HW-SLIDE-STD",
        lift_slide: "HW-LIFT-SLIDE",
        psk: "HW-PSK-STD",
        parallel_slide: "HW-PARALLEL-SLIDE",
        parallel_project: "HW-PARALLEL-PROJECT",
        pocket_slide: "HW-POCKET-SLIDE",
        corner_slide: "HW-CORNER-SLIDE",
        vertical_slide: "HW-VERTICAL-SLIDE",
        folding: "HW-FOLD-STD",
        door: "HW-DOOR-STD"
      }[type] || "";
    }

    function normalizeCell(cell) {
      const migrated = migrateLegacyCellType(cell?.type);
      const type = Object.prototype.hasOwnProperty.call(typeLabels, migrated.type) ? migrated.type : "fixed_glass";
      const base = createCell(type, cell?.opening);
      const accessories = normalizeCellAccessories({
        ...(migrated.accessories || {}),
        ...(cell?.accessories || {})
      });
      return {
        ...base,
        cellId: String(cell?.cellId || base.cellId),
        openingAssembly: normalizeOpeningAssembly(type, base.opening, cell?.openingAssembly),
        glassTypeId: cell?.glassTypeId || "",
        hardwareSetId: cell?.hardwareSetId || base.hardwareSetId,
        panelTypeId: cell?.panelTypeId || "PN-SANDWICH",
        infillType: normalizeCellInfillType(cell?.infillType || migrated.infillType),
        accessories,
        handleHeightMm: Math.max(0, Number(cell?.handleHeightMm ?? 750)),
        customShape: normalizeCellCustomShape(cell?.customShape),
        note: cell?.note || ""
      };
    }

    function normalizeProject(value) {
      const next = value && typeof value === "object" ? value : createDefaultProject();
      next.schemaVersion = "cn-door-window-design.v2";
      next.project ||= {};
      next.order ||= {};
      next.catalog ||= structuredClone(defaultCatalog);
      next.catalog.profileSystems = mergeCatalogItems(next.catalog.profileSystems, defaultCatalog.profileSystems);
      next.catalog.glassTypes = mergeCatalogItems(next.catalog.glassTypes, defaultCatalog.glassTypes);
      next.catalog.hardwareSets = mergeCatalogItems(next.catalog.hardwareSets, defaultCatalog.hardwareSets);
      next.catalog.panelTypes = mergeCatalogItems(next.catalog.panelTypes, defaultCatalog.panelTypes);
      next.componentLibrary ||= [];
      next.customShapes = Array.isArray(next.customShapes)
        ? next.customShapes.map(normalizeCustomShapeElement).filter(Boolean)
        : [];
      next.viewOptions = {
        showOpenState: true,
        showProfileColor: true,
        showDimensions: true,
        showPlanView: true,
        ...(next.viewOptions || {})
      };
      next.integrations ||= { reservedEvents: [], externalRefs: [] };
      next.calculation ||= {};
      next.calculation.status ||= "draft";
      next.calculation.mbomVersion ||= 0;
      next.calculation.events ||= [];
      next.windows = Array.isArray(next.windows) && next.windows.length ? next.windows : createDefaultProject().windows;
      next.windows = next.windows.map(w => {
        const layout = normalizeLayout(w.layout);
        return {
          ...createWindow({}),
          ...w,
          quantity: Math.max(1, Number(w.quantity || 1)),
          widthMm: Math.max(300, Number(w.widthMm || 1200)),
          heightMm: Math.max(300, Number(w.heightMm || 1500)),
          installation: {
            sillHeightMm: Math.max(0, Number(w.installation?.sillHeightMm ?? w.sillHeightMm ?? 0)),
            surround: normalizeSurround(w.installation?.surround)
          },
          shape: normalizeWindowShape(w.shape),
          geometryMode: w.geometryMode === "topology" || w.topology?.members?.length ? "topology" : "grid",
          layout,
          topology: normalizeTopology(w.topology, layout)
        };
      });
      next.joints = normalizeEngineeringJoints(next.joints, next.windows);
      next.assemblies = normalizeWindowAssemblies(next.assemblies, next.windows, next.joints);
      return next;
    }

    function mergeCatalogItems(current, defaults) {
      const items = Array.isArray(current) ? current : [];
      const existingIds = new Set(items.map(item => item?.id));
      return [...items, ...structuredClone(defaults.filter(item => !existingIds.has(item.id)))];
    }

    function normalizeLayout(layout) {
      const cols = Array.isArray(layout?.columns) && layout.columns.length ? layout.columns.map(Number) : [1];
      const rows = Array.isArray(layout?.rows) && layout.rows.length ? layout.rows.map(Number) : [1];
      const count = cols.length * rows.length;
      const cells = Array.isArray(layout?.cells) ? layout.cells.slice(0, count) : [];
      while (cells.length < count) cells.push(createCell());
      return {
        columns: cols.map(v => Number.isFinite(v) && v > 0 ? v : 1),
        rows: rows.map(v => Number.isFinite(v) && v > 0 ? v : 1),
        cells: cells.map(normalizeCell)
      };
    }

    function loadProject() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return normalizeProject(JSON.parse(stored));
      } catch (error) {
        console.warn("Project load failed", error);
      }
      return createDefaultProject();
    }

    function saveProject() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    }

    function currentWindow() {
      return project.windows.find(w => w.windowId === selectedWindowId) || project.windows[0];
    }

    function currentSeries(win = currentWindow()) {
      return project.catalog.profileSystems.find(s => s.id === win?.seriesId) || project.catalog.profileSystems[0];
    }

    function currentCell(win = currentWindow()) {
      if (!win) return null;
      const cols = win.layout.columns.length;
      const row = Math.min(selectedCell.row, win.layout.rows.length - 1);
      const col = Math.min(selectedCell.col, cols - 1);
      selectedCell = { row, col };
      return win.layout.cells[row * cols + col];
    }

    function currentMember(win = currentWindow()) {
      if (!win || !selectedMemberId) return null;
      return win.topology?.members?.find(member => member.memberId === selectedMemberId) || null;
    }

    function currentJoint() {
      if (!selectedJointId) return null;
      return project.joints?.find(joint => joint.jointId === selectedJointId) || null;
    }

    function currentProjectAssembly() {
      if (!project.assemblies?.length) return null;
      return project.assemblies.find(assembly => assembly.assemblyId === selectedAssemblyId) || project.assemblies[0];
    }

    function currentPlacement() {
      if (!selectedPlacementId) return null;
      return currentProjectAssembly()?.placements?.find(placement => placement.placementId === selectedPlacementId) || null;
    }

    function cloneCell(cell) {
      return {
        ...structuredClone(cell),
        cellId: createCellId()
      };
    }

    function markDirty() {
      previewNeedsRebuild = true;
      if (project.calculation.status === "confirmed" || project.calculation.status === "frozen") {
        project.calculation.status = "changed";
        addEvent("design.revised");
      } else if (!project.calculation.status) {
        project.calculation.status = "draft";
      }
      saveProject();
      render();
    }

    function addEvent(type) {
      project.calculation.events ||= [];
      project.calculation.events.push({
        type,
        at: new Date().toISOString(),
        mbomVersion: project.calculation.mbomVersion || 0
      });
    }

    function recalc(status = "calculated") {
      project.calculation.status = status;
      project.calculation.lastCalculatedAt = new Date().toISOString();
      project.calculation.lastHash = hashString(JSON.stringify({
        windows: project.windows,
        joints: project.joints,
        assemblies: project.assemblies,
        catalog: project.catalog,
        order: project.order
      }));
      addEvent(status === "calculated" ? "bom.calculated" : `bom.${status}`);
      bom = calculateProjectBom(project);
      saveProject();
      render();
    }

    function confirmBom() {
      recalc("confirmed");
      project.calculation.confirmedAt = new Date().toISOString();
      addEvent("bom.confirmed");
      saveProject();
      render();
      showToast("算料结果已确认，后续设计变更会标记为已变更。");
    }

    function freezeBom() {
      recalc("frozen");
      project.calculation.mbomVersion = Number(project.calculation.mbomVersion || 0) + 1;
      project.calculation.frozenAt = new Date().toISOString();
      addEvent("bom.frozen");
      addEvent("manufacturing_package.ready");
      bom = calculateProjectBom(project);
      saveProject();
      render();
      showToast(`BOM已冻结为 v${project.calculation.mbomVersion}。`);
    }

    function updateProjectFromInputs() {
      project.project.projectId = valueOf("projectId");
      project.project.name = valueOf("projectName");
      project.project.customerName = valueOf("customerName");
      project.project.address = valueOf("projectAddress");
      project.order.orderId = valueOf("orderId");
      project.order.batchNo = valueOf("batchNo");
      markDirty();
    }

    function updateWindowFromInputs() {
      const win = currentWindow();
      if (!win) return;
      win.mark = valueOf("winMark");
      win.quantity = Math.max(1, Number(valueOf("winQty") || 1));
      win.widthMm = Math.max(300, Number(valueOf("winWidth") || 1200));
      win.heightMm = Math.max(300, Number(valueOf("winHeight") || 1500));
      win.floor = valueOf("winFloor");
      win.room = valueOf("winRoom");
      const shapeType = valueOf("winShape");
      const currentPoints = win.shape?.type === "custom_polygon" ? win.shape.points : undefined;
      const shouldOpenDiyEditor = shapeType === "custom_polygon" && win.shape?.type !== "custom_polygon" && !currentPoints?.length;
      if (shouldOpenDiyEditor) {
        setValue("winShape", win.shape?.type || "rectangular");
        openDiyShapeEditor({ blank: true });
        return;
      }
      win.shape = normalizeWindowShape({
        type: shapeType,
        archHeightMm: Math.max(0, Number(valueOf("archHeight") || 0)),
        points: shapeType === "custom_polygon" ? parseShapePointsText(valueOf("shapePoints"), currentPoints) : []
      });
      win.installation ||= { sillHeightMm: 0 };
      win.installation.sillHeightMm = Math.max(0, Number(valueOf("sillHeight") || 0));
      markDirty();
    }

    function updateInstallationFromInputs() {
      const win = currentWindow();
      if (!win) return;
      const selectedSides = [
        ["top", "surroundSideTop"],
        ["right", "surroundSideRight"],
        ["bottom", "surroundSideBottom"],
        ["left", "surroundSideLeft"]
      ].filter(([, id]) => document.getElementById(id)?.checked).map(([side]) => side);
      win.installation ||= { sillHeightMm: 0 };
      win.installation.surround = normalizeSurround({
        ...win.installation.surround,
        enabled: document.getElementById("surroundEnabled")?.checked,
        mountingMode: valueOf("installationMountingMode"),
        frameAlignment: valueOf("installationFrameAlignment"),
        styleId: valueOf("surroundStyle"),
        edgeMode: valueOf("surroundEdgeMode"),
        sides: selectedSides,
        wallThicknessMm: Number(valueOf("surroundWallThickness")),
        wallMaterialId: valueOf("wallMaterial"),
        wallCornerMode: valueOf("wallCornerMode"),
        cornerPierWidthMm: Number(valueOf("cornerPierWidth")),
        frameOffsetMm: Number(valueOf("surroundFrameOffset")),
        exteriorMountGapMm: Number(valueOf("exteriorMountGap")),
        outsideWidthMm: Number(valueOf("surroundOutsideWidth")),
        insideWidthMm: Number(valueOf("surroundInsideWidth")),
        boardThicknessMm: Number(valueOf("surroundBoardThickness")),
        materialCode: valueOf("surroundMaterialCode"),
        colorOutside: valueOf("surroundColorOutside"),
        colorInside: valueOf("surroundColorInside"),
        note: valueOf("surroundNote")
      });
      previewNeedsRebuild = true;
      markDirty();
    }

    function openInstallationInspector() {
      drawingMode = "window";
      selectedPlacementId = "";
      switchInspector("installation");
      previewNeedsRebuild = true;
      render();
    }

    function updateProductFromInputs() {
      const win = currentWindow();
      if (!win) return;
      win.seriesId = valueOf("seriesId");
      win.colorInside = valueOf("colorInside");
      win.colorOutside = valueOf("colorOutside");
      win.defaultGlassTypeId = valueOf("glassTypeId");
      win.defaultHardwareSetId = valueOf("hardwareSetId");
      markDirty();
    }

    function updateCellFromInputs(event) {
      const win = currentWindow();
      const cell = currentCell(win);
      if (!cell) return;
      const previousOpening = cell.opening;
      const nextType = valueOf("cellType");
      const hasLocalMembers = win.topology?.members?.some(member => member.hostRegionId === cell.cellId);
      if (hasLocalMembers && nextType !== "fixed_glass") {
        setValue("cellType", "fixed_glass");
        showToast("该窗格含局部中梃，请先删除局部梃再更换构件类型。");
        return;
      }
      const typeChanged = cell.type !== nextType;
      cell.type = nextType;
      cell.opening = typeChanged
        ? defaultOpeningForType(nextType)
        : normalizeOpening(nextType, valueOf("opening"));
      if (typeChanged) {
        cell.openingAssembly = defaultOpeningAssembly(nextType, cell.opening);
      } else {
        const directional = previousOpening !== cell.opening
          ? alignAssemblyToOpening(nextType, cell.opening, cell.openingAssembly)
          : cell.openingAssembly;
        cell.openingAssembly = readOpeningAssemblyInputs(nextType, cell.opening, directional);
      }
      cell.glassTypeId = valueOf("cellGlass");
      cell.hardwareSetId = typeChanged ? defaultHardwareSetForType(nextType) : valueOf("cellHardware");
      cell.infillType = normalizeCellInfillType(valueOf("cellInfill"));
      const screenMode = isOperableType(nextType)
        ? (event?.target?.id === "cellScreenMode" ? valueOf("cellScreenMode") : valueOf("assemblyScreenMode"))
        : valueOf("cellScreenMode");
      cell.accessories = normalizeCellAccessories({
        ...cell.accessories,
        grille: document.getElementById("cellAccessoryGrille")?.checked,
        screenMode,
        securityBars: document.getElementById("cellAccessorySecurity")?.checked,
        frosted: document.getElementById("cellAccessoryFrosted")?.checked
      });
      if (isOperableType(cell.type)) {
        const assembly = normalizeOpeningAssembly(cell.type, cell.opening, cell.openingAssembly);
        cell.openingAssembly = {
          ...assembly,
          screenMode: cell.accessories.screenMode
        };
      }
      cell.handleHeightMm = Math.max(0, Number(valueOf("handleHeight") || 0));
      cell.note = valueOf("cellNote");
      markDirty();
    }

    function readOpeningAssemblyInputs(type, opening, current) {
      if (!isOperableType(type)) return normalizeOpeningAssembly(type, opening, current);
      return normalizeOpeningAssembly(type, opening, {
        ...current,
        panelCount: Number(valueOf("assemblyPanelCount")),
        activePanelCount: Number(valueOf("assemblyActivePanelCount")),
        trackCount: Number(valueOf("assemblyTrackCount")),
        stackSide: valueOf("assemblyStackSide"),
        primarySide: valueOf("assemblyPrimarySide"),
        mullionMode: valueOf("assemblyMullionMode"),
        openPlane: valueOf("assemblyOpenPlane"),
        operationPriority: valueOf("assemblyOperationPriority"),
        ventilationMode: valueOf("assemblyVentilationMode"),
        trafficDoor: valueOf("assemblyTrafficDoor"),
        screenMode: valueOf("assemblyScreenMode"),
        cornerAngleDeg: Number(valueOf("assemblyCornerAngle")),
        cornerPostMode: valueOf("assemblyCornerPostMode"),
        pocketDepthMm: Number(valueOf("assemblyPocketDepth"))
      });
    }

    function alignAssemblyToOpening(type, opening, assembly) {
      const next = { ...(assembly || {}) };
      if (["sliding", "lift_slide", "psk", "parallel_slide", "folding"].includes(type)) {
        next.stackSide = opening.endsWith("right") ? "right" : "left";
      } else if (type === "pocket_slide") {
        next.stackSide = opening === "pocket_both" ? "both" : (opening.endsWith("right") ? "right" : "left");
      } else if (type === "corner_slide") {
        next.stackSide = opening === "corner_both" ? "both" : (opening.endsWith("right") ? "right" : "left");
      } else if (type === "vertical_slide") {
        next.stackSide = opening === "slide_down" ? "bottom" : "top";
        next.primarySide = opening === "slide_down" ? "right" : "left";
      } else if (["turn", "turn_tilt", "door"].includes(type)) {
        next.primarySide = opening.startsWith("right") ? "right" : "left";
        next.openPlane = opening.endsWith("out") ? "out" : "in";
      }
      return next;
    }

    function updateViewOptionsFromInputs() {
      project.viewOptions = {
        ...project.viewOptions,
        showOpenState: checkedOf("viewShowOpenState"),
        showProfileColor: checkedOf("viewShowProfileColor"),
        showDimensions: checkedOf("viewShowDimensions"),
        showPlanView: checkedOf("viewShowPlanView")
      };
      saveProject();
      renderSvg();
    }

    function valueOf(id) {
      return document.getElementById(id).value;
    }

    function setValue(id, value) {
      const el = document.getElementById(id);
      if (el && el.value !== String(value ?? "")) el.value = value ?? "";
    }

    function checkedOf(id) {
      return Boolean(document.getElementById(id)?.checked);
    }

    function setChecked(id, value) {
      const el = document.getElementById(id);
      if (el) el.checked = Boolean(value);
    }

    function addColumn() {
      const win = currentWindow();
      if (!win) return;
      selectedMemberId = "";
      selectedJointId = "";
      const oldCols = win.layout.columns.length;
      const rows = win.layout.rows.length;
      const oldCells = win.layout.cells;
      win.layout.columns.push(1);
      const next = [];
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < oldCols; c += 1) next.push(oldCells[cellIndex(r, c, oldCols)]);
        next.push(createCell());
      }
      win.layout.cells = next;
      selectedCell = { row: 0, col: oldCols };
      markDirty();
    }

    function addRow() {
      const win = currentWindow();
      if (!win) return;
      selectedMemberId = "";
      selectedJointId = "";
      const cols = win.layout.columns.length;
      win.layout.rows.push(1);
      for (let c = 0; c < cols; c += 1) win.layout.cells.push(createCell());
      selectedCell = { row: win.layout.rows.length - 1, col: 0 };
      markDirty();
    }

    function removeColumn() {
      const win = currentWindow();
      if (!win || win.layout.columns.length <= 1) return;
      selectedMemberId = "";
      selectedJointId = "";
      const oldCols = win.layout.columns.length;
      const rows = win.layout.rows.length;
      win.layout.columns.pop();
      const next = [];
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < oldCols - 1; c += 1) next.push(win.layout.cells[cellIndex(r, c, oldCols)]);
      }
      win.layout.cells = next;
      selectedCell.col = Math.min(selectedCell.col, oldCols - 2);
      markDirty();
    }

    function removeRow() {
      const win = currentWindow();
      if (!win || win.layout.rows.length <= 1) return;
      selectedMemberId = "";
      selectedJointId = "";
      const cols = win.layout.columns.length;
      win.layout.rows.pop();
      win.layout.cells = win.layout.cells.slice(0, win.layout.rows.length * cols);
      selectedCell.row = Math.min(selectedCell.row, win.layout.rows.length - 1);
      markDirty();
    }

    function splitSelectedColumn(partCount = 2) {
      const win = currentWindow();
      if (!win) return;
      selectedMemberId = "";
      selectedJointId = "";
      const cols = win.layout.columns.length;
      const rows = win.layout.rows.length;
      const col = Math.min(selectedCell.col, cols - 1);
      const oldCells = win.layout.cells;
      const count = Math.max(2, Math.min(6, Number(partCount) || 2));
      const weight = Number(win.layout.columns[col] || 1) / count;
      win.layout.columns.splice(col, 1, ...Array.from({ length: count }, () => weight));
      const next = [];
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const cell = oldCells[cellIndex(r, c, cols)];
          next.push(cell);
          if (c === col) {
            for (let index = 1; index < count; index += 1) next.push(cloneCell(cell));
          }
        }
      }
      win.layout.cells = next;
      selectedCell = { row: selectedCell.row, col: col + count - 1 };
      markDirty();
    }

    function splitSelectedRow(partCount = 2) {
      const win = currentWindow();
      if (!win) return;
      selectedMemberId = "";
      selectedJointId = "";
      const cols = win.layout.columns.length;
      const rows = win.layout.rows.length;
      const row = Math.min(selectedCell.row, rows - 1);
      const oldCells = win.layout.cells;
      const count = Math.max(2, Math.min(6, Number(partCount) || 2));
      const weight = Number(win.layout.rows[row] || 1) / count;
      win.layout.rows.splice(row, 1, ...Array.from({ length: count }, () => weight));
      const next = [];
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) next.push(oldCells[cellIndex(r, c, cols)]);
        if (r === row) {
          for (let index = 1; index < count; index += 1) {
            for (let c = 0; c < cols; c += 1) next.push(cloneCell(oldCells[cellIndex(r, c, cols)]));
          }
        }
      }
      win.layout.cells = next;
      selectedCell = { row: row + count - 1, col: selectedCell.col };
      markDirty();
    }

    function equalizeGrid() {
      const win = currentWindow();
      if (!win) return;
      win.layout.columns = win.layout.columns.map(() => 1);
      win.layout.rows = win.layout.rows.map(() => 1);
      markDirty();
      showToast("当前窗型分格已均分。");
    }

    function applyQuickPair() {
      const win = currentWindow();
      if (!win) return;
      win.layout = normalizeLayout({
        columns: [1, 1],
        rows: [1],
        cells: [
          createCell("turn", "left_in"),
          createCell("turn", "right_in")
        ]
      });
      win.geometryMode = "grid";
      win.topology = normalizeTopology(null, win.layout);
      selectedMemberId = "";
      selectedJointId = "";
      selectedCell = { row: 0, col: 0 };
      markDirty();
      showToast("已套用双扇平开窗。");
    }

    function applyCellPreset(type) {
      const win = currentWindow();
      const cell = currentCell(win);
      if (!cell) return;
      if (LEGACY_FILL_CELL_TYPES.includes(type)) {
        applyCellFillOrAccessory(type);
        return;
      }
      const hasLocalMembers = win.topology?.members?.some(member => member.hostRegionId === cell.cellId);
      if (hasLocalMembers && type !== "fixed_glass") {
        showToast("该窗格含局部中梃，请先删除局部梃再设置开启扇或辅件。");
        return;
      }
      const next = createCell(type, cell.opening);
      const glassTypeId = cell.glassTypeId;
      const panelTypeId = cell.panelTypeId;
      cell.type = next.type;
      cell.opening = next.opening;
      cell.openingAssembly = next.openingAssembly;
      cell.glassTypeId = glassTypeId || next.glassTypeId;
      cell.hardwareSetId = next.hardwareSetId;
      cell.panelTypeId = panelTypeId || next.panelTypeId;
      switchInspector("cell");
      markDirty();
      showToast(`选中单元已设为${typeLabels[type] || type}。`);
    }

    function applyCellFillOrAccessory(type) {
      const win = currentWindow();
      const cell = currentCell(win);
      if (!cell) return;
      if (cell.type === "empty") {
        const next = createCell("fixed_glass", "fixed");
        Object.assign(cell, {
          type: next.type,
          opening: next.opening,
          openingAssembly: next.openingAssembly,
          hardwareSetId: next.hardwareSetId
        });
      }
      cell.accessories = normalizeCellAccessories(cell.accessories);
      if (type === "grille") {
        cell.accessories.grille = !cell.accessories.grille;
        showToast(cell.accessories.grille ? "已为选中窗格叠加格条。" : "已取消选中窗格格条。");
      } else if (type === "screen") {
        const nextMode = cell.accessories.screenMode === "none" ? defaultScreenModeForCell(cell) : "none";
        cell.accessories.screenMode = nextMode;
        if (isOperableType(cell.type)) {
          cell.openingAssembly = normalizeOpeningAssembly(cell.type, cell.opening, {
            ...cell.openingAssembly,
            screenMode: nextMode
          });
        }
        showToast(nextMode === "none" ? "已取消配套纱窗。" : "已为选中窗格叠加配套纱窗。");
      } else if (type === "louver" || type === "panel") {
        cell.infillType = cell.infillType === type ? "glass" : type;
        showToast(cell.infillType === "glass" ? "填充已恢复为玻璃。" : `选中窗格填充已设为${typeLabels[type]}。`);
      }
      switchInspector("cell");
      markDirty();
    }

    function applyShapePreset(type) {
      const win = currentWindow();
      if (!win) return;
      if (type === "custom_polygon") {
        openDiyShapeEditor({ blank: true });
        return;
      }
      win.shape = {
        ...normalizeWindowShape({
          type,
          archHeightMm: type === "arched" ? Math.max(220, Number(win.shape?.archHeightMm || 0)) : 0
        })
      };
      selectedMemberId = "";
      selectedJointId = "";
      switchInspector("window");
      markDirty();
      showToast(`整窗外形已设为${shapeLabel(type)}。`);
    }

    function applyCustomShapeElement(shapeId) {
      const win = currentWindow();
      const item = project.customShapes?.find(shape => shape.shapeId === shapeId);
      const cell = currentCell(win);
      if (!win || !cell || !item) return;
      cell.customShape = normalizeCellCustomShape({
        shapeId: item.shapeId,
        name: item.name,
        points: item.points
      });
      selectedMemberId = "";
      selectedJointId = "";
      switchInspector("cell");
      markDirty();
      showToast(`已将DIY异形构件“${item.name}”应用到选中窗格。`);
    }

    function editCustomShapeElement(shapeId) {
      const item = project.customShapes?.find(shape => shape.shapeId === shapeId);
      if (!item) return;
      openDiyShapeEditor({
        shapeId: item.shapeId,
        name: item.name,
        points: item.points
      });
    }

    function updateCellsUsingCustomShape(shape) {
      project.windows.forEach(win => {
        win.layout.cells.forEach(cell => {
          if (cell.customShape?.shapeId !== shape.shapeId) return;
          cell.customShape = normalizeCellCustomShape({
            shapeId: shape.shapeId,
            name: shape.name,
            points: shape.points
          });
        });
      });
    }

    function addLocalMember(orientation) {
      const win = currentWindow();
      if (!win) return;
      const cell = currentCell(win);
      if (cell?.type !== "fixed_glass") {
        showToast("局部中梃当前仅支持固定玻璃区域，请先将窗格设为固定玻璃。");
        return;
      }
      const member = createLocalMullion(
        win.layout,
        selectedCell.row,
        selectedCell.col,
        orientation,
        currentSeries(win)?.mullionProfile || ""
      );
      win.topology = normalizeTopology(win.topology, win.layout);
      win.topology.members.push(member);
      win.geometryMode = "topology";
      selectedJointId = "";
      selectedMemberId = member.memberId;
      switchInspector("member");
      markDirty();
      showToast(`已在选中窗格加入局部${orientation === "vertical" ? "竖梃" : "横梃"}。`);
    }

    function updateMemberFromInputs() {
      const win = currentWindow();
      const member = currentMember(win);
      if (!win || !member) return;
      const throughMode = valueOf("memberThroughMode");
      const startRatio = throughMode === "continuous" ? 0 : Number(valueOf("memberSpanStart")) / 100;
      const endRatio = throughMode === "continuous" ? 1 : Number(valueOf("memberSpanEnd")) / 100;
      const next = normalizeMember({
        ...member,
        orientation: valueOf("memberOrientation"),
        positionRatio: Number(valueOf("memberPosition")) / 100,
        span: { startRatio, endRatio },
        profileId: valueOf("memberProfile").trim(),
        throughMode,
        connectionStart: valueOf("memberConnectionStart"),
        connectionEnd: valueOf("memberConnectionEnd"),
        note: valueOf("memberNote")
      }, new Set(win.topology.regions.map(region => region.regionId)));
      if (!next) return;
      Object.assign(member, next);
      markDirty();
    }

    function deleteSelectedMember() {
      const win = currentWindow();
      const member = currentMember(win);
      if (!win || !member) return;
      win.topology.members = win.topology.members.filter(item => item.memberId !== member.memberId);
      selectedMemberId = "";
      selectedJointId = "";
      hideMemberContextMenu();
      switchInspector("cell");
      markDirty();
      showToast("局部中梃已删除。");
    }

    function addEngineeringJoint(type) {
      const win = currentWindow();
      if (!win) return;
      const joint = createEngineeringJoint(type, win, currentSeries(win));
      project.joints ||= [];
      project.joints.push(joint);
      selectedMemberId = "";
      selectedJointId = joint.jointId;
      switchInspector("joint");
      markDirty();
      showToast(type === "corner" ? "已在当前窗右边加入转角节点。" : "已在当前窗右边加入拼接节点。");
    }

    function updateJointFromInputs() {
      const joint = currentJoint();
      const win = currentWindow();
      if (!joint || !win) return;
      const nextType = valueOf("jointType");
      const typeChanged = nextType !== joint.type;
      const next = normalizeEngineeringJoint({
        ...joint,
        type: nextType,
        style: typeChanged ? JOINT_STYLE_OPTIONS[nextType][0].value : valueOf("jointStyle"),
        orientation: valueOf("jointOrientation"),
        hostEdge: valueOf("jointHostEdge"),
        angleDeg: typeChanged && nextType === "corner" ? 90 : Number(valueOf("jointAngle")),
        legWidthAMm: Number(valueOf("jointLegA")),
        legWidthBMm: Number(valueOf("jointLegB")),
        span: {
          startRatio: Number(valueOf("jointSpanStart")) / 100,
          endRatio: Number(valueOf("jointSpanEnd")) / 100
        },
        profileId: typeChanged ? defaultJointProfile(nextType, currentSeries(win)) : valueOf("jointProfile").trim(),
        frameTreatment: valueOf("jointFrameTreatment"),
        postMode: valueOf("jointPostMode"),
        fastenerSpacingMm: Number(valueOf("jointFastenerSpacing")),
        note: valueOf("jointNote")
      }, new Set(project.windows.map(item => item.windowId)));
      if (!next) return;
      Object.assign(joint, next);
      markDirty();
    }

    function deleteSelectedJoint() {
      const joint = currentJoint();
      if (!joint) return;
      project.joints = project.joints.filter(item => item.jointId !== joint.jointId);
      project.assemblies?.forEach(assembly => {
        assembly.placements.forEach(placement => {
          if (placement.jointId === joint.jointId) placement.jointId = "";
        });
      });
      selectedJointId = "";
      hideJointContextMenu();
      switchInspector("window");
      markDirty();
      showToast("连接节点已删除。");
    }

    function syncAssemblyJointConnections() {
      const connectedByJoint = new Map((project.joints || []).map(joint => [joint.jointId, new Set([joint.hostWindowId])]));
      (project.assemblies || []).forEach(assembly => {
        assembly.placements.forEach(placement => {
          if (!placement.jointId || !connectedByJoint.has(placement.jointId)) return;
          connectedByJoint.get(placement.jointId).add(placement.windowId);
          connectedByJoint.get(placement.jointId).add(placement.referenceWindowId);
        });
      });
      (project.joints || []).forEach(joint => {
        joint.connectedWindowIds = [...connectedByJoint.get(joint.jointId)];
      });
    }

    function normalizeProjectAssemblies() {
      project.assemblies = normalizeWindowAssemblies(project.assemblies, project.windows, project.joints);
      if (!project.assemblies.some(assembly => assembly.assemblyId === selectedAssemblyId)) {
        selectedAssemblyId = project.assemblies[0]?.assemblyId || "";
      }
      if (selectedPlacementId && !currentPlacement()) selectedPlacementId = "";
      syncAssemblyJointConnections();
    }

    function switchDrawingMode(mode) {
      drawingMode = mode === "assembly" ? "assembly" : "window";
      if (drawingMode === "assembly") {
        const assembly = currentProjectAssembly();
        if (assembly) {
          selectedAssemblyId = assembly.assemblyId;
          switchInspector("assembly");
        }
      } else if (activeInspectorTab === "assembly") {
        switchInspector("window");
      }
      previewNeedsRebuild = true;
      render();
    }

    function newProjectAssembly() {
      const root = currentWindow() || project.windows[0];
      if (!root) return;
      const assembly = createWindowAssembly(root, `门窗组合${project.assemblies.length + 1}`);
      project.assemblies.push(assembly);
      selectedAssemblyId = assembly.assemblyId;
      selectedPlacementId = "";
      drawingMode = "assembly";
      switchInspector("assembly");
      markDirty();
      showToast(`已以${root.mark}作为根窗建立组合。`);
    }

    function addAssemblyPlacement(dock) {
      if (project.windows.length < 2) {
        showToast("请先新建或复制第二樘门窗。 ");
        return;
      }
      let assembly = currentProjectAssembly();
      if (!assembly) {
        assembly = createWindowAssembly(project.windows[0], "门窗组合1");
        project.assemblies.push(assembly);
        selectedAssemblyId = assembly.assemblyId;
      }
      const existing = assembly.placements.find(item => item.windowId === selectedWindowId);
      if (existing) {
        existing.dock = dock;
        if (dock !== "free") existing.freePosition = { xMm: 0, yMm: 0, zMm: 0 };
        selectedPlacementId = existing.placementId;
      } else {
        const positioned = new Set([assembly.rootWindowId, ...assembly.placements.map(item => item.windowId)]);
        let movingWindow = currentWindow();
        if (!movingWindow || positioned.has(movingWindow.windowId)) {
          movingWindow = project.windows.find(win => !positioned.has(win.windowId));
        }
        if (!movingWindow) {
          showToast("当前组合已包含所有门窗，请先选择组合中的窗体再调整位置。 ");
          return;
        }
        const referenceWindowId = assembly.rootWindowId;
        const selectedJoint = currentJoint();
        const useJoint = selectedJoint && [selectedJoint.hostWindowId, ...selectedJoint.connectedWindowIds].includes(referenceWindowId)
          ? selectedJoint
          : null;
        const rotationDeg = useJoint?.type === "corner"
          ? (useJoint.orientation === "reversed" ? -useJoint.angleDeg : useJoint.angleDeg)
          : 0;
        const root = project.windows.find(win => win.windowId === referenceWindowId);
        const placement = createAssemblyPlacement(movingWindow.windowId, referenceWindowId, dock, {
          rotationDeg,
          jointId: useJoint?.jointId || "",
          freePosition: dock === "free"
            ? { xMm: (Number(root?.widthMm || 0) + Number(movingWindow.widthMm || 0)) / 2 + 300, yMm: 0, zMm: 0 }
            : undefined
        });
        assembly.placements.push(placement);
        selectedWindowId = movingWindow.windowId;
        selectedPlacementId = placement.placementId;
      }
      selectedMemberId = "";
      selectedJointId = "";
      drawingMode = "assembly";
      normalizeProjectAssemblies();
      switchInspector("assembly");
      markDirty();
      showToast(`当前窗已设置为${dockLabel(dock)}组合。`);
    }

    function updateProjectAssemblyFromInputs() {
      const assembly = currentProjectAssembly();
      if (!assembly) return;
      assembly.name = valueOf("projectAssemblyName").trim() || assembly.name;
      const rootWindowId = valueOf("projectAssemblyRoot");
      if (project.windows.some(win => win.windowId === rootWindowId)) assembly.rootWindowId = rootWindowId;
      const placement = currentPlacement();
      if (placement) {
        const referenceWindowId = valueOf("placementReference");
        if (referenceWindowId !== placement.windowId && project.windows.some(win => win.windowId === referenceWindowId)) {
          placement.referenceWindowId = referenceWindowId;
        }
        placement.dock = valueOf("placementDock");
        placement.align = valueOf("placementAlign");
        placement.gapMm = Number(valueOf("placementGap"));
        placement.offsetMm = Number(valueOf("placementOffset"));
        placement.rotationDeg = Number(valueOf("placementRotation"));
        placement.freePosition = {
          xMm: Number(valueOf("placementFreeX")),
          yMm: Number(valueOf("placementFreeY")),
          zMm: Number(valueOf("placementFreeZ"))
        };
        placement.jointId = valueOf("placementJoint");
        placement.note = valueOf("placementNote");
      }
      normalizeProjectAssemblies();
      markDirty();
    }

    function selectProjectAssemblyFromInput() {
      const assemblyId = valueOf("projectAssemblySelect");
      const assembly = project.assemblies.find(item => item.assemblyId === assemblyId);
      if (!assembly) return;
      selectedAssemblyId = assembly.assemblyId;
      selectedPlacementId = "";
      selectedWindowId = assembly.rootWindowId;
      drawingMode = "assembly";
      switchInspector("assembly");
      previewNeedsRebuild = true;
      render();
    }

    function deleteSelectedPlacement() {
      const assembly = currentProjectAssembly();
      const placement = currentPlacement();
      if (!assembly || !placement) return;
      assembly.placements = assembly.placements.filter(item => item.placementId !== placement.placementId);
      selectedPlacementId = "";
      hideAssemblyContextMenu();
      normalizeProjectAssemblies();
      markDirty();
      showToast("窗体已移出当前组合。 ");
    }

    function deleteCurrentAssembly() {
      const assembly = currentProjectAssembly();
      if (!assembly) return;
      project.assemblies = project.assemblies.filter(item => item.assemblyId !== assembly.assemblyId);
      selectedAssemblyId = project.assemblies[0]?.assemblyId || "";
      selectedPlacementId = "";
      drawingMode = "window";
      normalizeProjectAssemblies();
      switchInspector("window");
      markDirty();
      showToast("门窗组合已删除，单窗设计仍然保留。 ");
    }

    function filterToolLibrary() {
      const query = valueOf("toolSearch").trim().toLocaleLowerCase();
      let visibleCount = 0;
      document.querySelectorAll("#toolLibrary .tool-section").forEach(section => {
        const haystack = `${section.dataset.toolGroup || ""} ${section.textContent}`.toLocaleLowerCase();
        const visible = !query || haystack.includes(query);
        section.classList.toggle("hidden", !visible);
        if (visible) visibleCount += 1;
      });
      document.getElementById("toolSearchEmpty")?.classList.toggle("hidden", visibleCount > 0);
    }

    function newWindow() {
      const count = project.windows.length + 1;
      const win = createWindow({ mark: `C-${String(count).padStart(2, "0")}`, name: "新门窗" });
      project.windows.push(win);
      selectedWindowId = win.windowId;
      selectedMemberId = "";
      selectedJointId = "";
      selectedPlacementId = "";
      selectedCell = { row: 0, col: 0 };
      switchInspector("window");
      markDirty();
    }

    function duplicateWindow() {
      const win = currentWindow();
      if (!win) return;
      const copy = structuredClone(win);
      copy.windowId = `W-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      copy.mark = `${win.mark}-副本`;
      project.windows.push(copy);
      selectedWindowId = copy.windowId;
      selectedMemberId = "";
      selectedJointId = "";
      selectedPlacementId = "";
      markDirty();
    }

    function deleteWindow() {
      if (project.windows.length <= 1) {
        showToast("至少保留一樘门窗。");
        return;
      }
      project.windows = project.windows.filter(w => w.windowId !== selectedWindowId);
      selectedWindowId = project.windows[0].windowId;
      selectedMemberId = "";
      selectedJointId = "";
      selectedPlacementId = "";
      selectedCell = { row: 0, col: 0 };
      markDirty();
    }

    function addSeries() {
      const id = valueOf("newSeriesId").trim();
      if (!id) {
        showToast("请填写系列ID。");
        return;
      }
      const item = {
        id,
        name: valueOf("newSeriesName").trim() || id,
        material: valueOf("newMaterial"),
        frameProfile: valueOf("newFrameCode").trim() || `${id}-K01`,
        sashProfile: valueOf("newSashCode").trim() || `${id}-S01`,
        mullionProfile: valueOf("newMullionCode").trim() || `${id}-Z01`,
        spliceProfile: valueOf("newSpliceCode").trim() || `${id}-SPLICE`,
        cornerProfile: valueOf("newCornerCode").trim() || `${id}-CORNER-90`,
        beadProfile: `${id}-YT01`,
        gasketCode: `EPDM-${id}`,
        faceWidthMm: Number(valueOf("newFaceWidth") || 70),
        frameDepthMm: Number(valueOf("newFrameDepth") || valueOf("newFaceWidth") || 70),
        sashFaceWidthMm: Math.max(45, Number(valueOf("newFaceWidth") || 70) - 12),
        stockLengthMm: Number(valueOf("newStockLength") || 6000),
        sawKerfMm: 4
      };
      const idx = project.catalog.profileSystems.findIndex(s => s.id === id);
      if (idx >= 0) project.catalog.profileSystems[idx] = item;
      else project.catalog.profileSystems.push(item);
      const win = currentWindow();
      if (win) win.seriesId = id;
      markDirty();
      showToast("材料包已加入。");
    }

    function saveComponent() {
      const win = currentWindow();
      if (!win) return;
      const name = prompt("组件名称", `${win.mark} 窗型`);
      if (!name) return;
      const item = {
        id: `custom-${Math.random().toString(36).slice(2, 9)}`,
        name,
        description: `${win.widthMm}x${win.heightMm} · ${win.layout.columns.length}列${win.layout.rows.length}行`,
        source: "user",
        window: {
          widthMm: win.widthMm,
          heightMm: win.heightMm,
          installation: structuredClone(win.installation),
          shape: structuredClone(win.shape),
          geometryMode: win.geometryMode,
          layout: structuredClone(win.layout),
          topology: structuredClone(win.topology),
          seriesId: win.seriesId,
          colorInside: win.colorInside,
          colorOutside: win.colorOutside,
          defaultGlassTypeId: win.defaultGlassTypeId,
          defaultHardwareSetId: win.defaultHardwareSetId
        }
      };
      project.componentLibrary.push(item);
      saveProject();
      render();
      showToast("当前窗型已保存为自定义组件。");
    }

    function clearCustomComponents() {
      project.componentLibrary = [];
      markDirty();
      showToast("自定义组件已清空。");
    }

    function applyTemplate(template) {
      const win = currentWindow();
      if (!win) return;
      const source = template.window;
      win.widthMm = source.widthMm || win.widthMm;
      win.heightMm = source.heightMm || win.heightMm;
      if (source.installation) win.installation = {
        sillHeightMm: Math.max(0, Number(source.installation.sillHeightMm || 0)),
        surround: normalizeSurround(source.installation.surround)
      };
      win.shape = structuredClone(source.shape || win.shape);
      win.layout = normalizeLayout(structuredClone(source.layout));
      win.geometryMode = source.geometryMode === "topology" || source.topology?.members?.length ? "topology" : "grid";
      win.topology = normalizeTopology(structuredClone(source.topology), win.layout);
      if (source.seriesId) win.seriesId = source.seriesId;
      if (source.colorInside) win.colorInside = source.colorInside;
      if (source.colorOutside) win.colorOutside = source.colorOutside;
      if (source.defaultGlassTypeId) win.defaultGlassTypeId = source.defaultGlassTypeId;
      if (source.defaultHardwareSetId) win.defaultHardwareSetId = source.defaultHardwareSetId;
      selectedMemberId = "";
      selectedJointId = "";
      selectedCell = { row: 0, col: 0 };
      switchInspector("window");
      markDirty();
    }

    function exportFile(filename, data, type = "application/json") {
      const blob = new Blob([data], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function exportJson() {
      exportFile(`${project.project.projectId || "project"}-design.json`, JSON.stringify(project, null, 2));
    }

    function exportBom() {
      recalc("calculated");
      exportFile(`${project.project.projectId || "project"}-bom.json`, JSON.stringify(bom, null, 2));
    }

    function exportPackage() {
      recalc(project.calculation.status === "frozen" ? "frozen" : "calculated");
      exportFile(`${project.project.projectId || "project"}-manufacturing-package.json`, JSON.stringify(buildInterfacePackage(project, bom), null, 2));
    }

    function applyJsonText() {
      try {
        const parsed = JSON.parse(valueOf("jsonText"));
        project = normalizeProject(parsed);
        selectedWindowId = project.windows[0].windowId;
        selectedMemberId = "";
        selectedJointId = "";
        selectedAssemblyId = project.assemblies[0]?.assemblyId || "";
        selectedPlacementId = "";
        selectedCell = { row: 0, col: 0 };
        recalc("calculated");
        showToast("JSON已应用。");
      } catch (error) {
        showToast(`JSON格式错误：${error.message}`);
      }
    }

    function importJsonFile(file) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          project = normalizeProject(JSON.parse(String(reader.result || "{}")));
          selectedWindowId = project.windows[0].windowId;
          selectedMemberId = "";
          selectedJointId = "";
          selectedAssemblyId = project.assemblies[0]?.assemblyId || "";
          selectedPlacementId = "";
          selectedCell = { row: 0, col: 0 };
          recalc("calculated");
          showToast("设计JSON已导入。");
        } catch (error) {
          showToast(`导入失败：${error.message}`);
        }
      };
      reader.readAsText(file, "utf-8");
    }

    async function copyPackage() {
      const text = JSON.stringify(buildInterfacePackage(project, bom), null, 2);
      try {
        await navigator.clipboard.writeText(text);
        showToast("接口JSON已复制。");
      } catch {
        showToast("当前浏览器不允许复制，可在右侧接口页手动选择。");
      }
    }

    function switchLeft(tab) {
      activeLeftTab = tab;
      document.querySelectorAll(".left-tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tab));
      document.querySelectorAll(".left-pane").forEach(pane => pane.classList.add("hidden"));
      document.getElementById(`left-${tab}`).classList.remove("hidden");
      render();
    }

    function switchInspector(tab) {
      activeInspectorTab = tab;
      document.querySelectorAll(".inspector-tab").forEach(btn => btn.classList.toggle("active", btn.dataset.inspector === tab));
      document.querySelectorAll(".inspector-pane").forEach(pane => pane.classList.add("hidden"));
      document.getElementById(`inspector-${tab}`)?.classList.remove("hidden");
    }

    function switchBom(tab) {
      activeBomTab = tab;
      document.querySelectorAll(".bom-tab").forEach(btn => btn.classList.toggle("active", btn.dataset.bomTab === tab));
      document.querySelectorAll(".bom-pane").forEach(pane => pane.classList.add("hidden"));
      document.getElementById(`bom-${tab}`)?.classList.remove("hidden");
    }

    function switchModule(module) {
      if (module === "preview") {
        openPreviewDialog();
        return;
      }
      activeModule = module;
      lastMainModule = module;
      document.querySelectorAll(".module-button").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.module === module);
      });
      const workspace = document.querySelector(".workspace");
      workspace.classList.toggle("bom-mode", module === "bom");
      render();
    }

    function openPreviewDialog() {
      const dialog = document.getElementById("previewDialog");
      if (!dialog) return;
      if (activeModule !== "preview") lastMainModule = activeModule;
      activeModule = "preview";
      document.querySelectorAll(".module-button").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.module === "preview");
      });
      if (!dialog.open) dialog.showModal();
      previewNeedsRebuild = true;
      renderThreePreview();
    }

    function closePreviewDialog() {
      const dialog = document.getElementById("previewDialog");
      hidePreviewContextMenu();
      stopPreviewPlayback(false);
      if (dialog?.open) dialog.close();
      activeModule = lastMainModule;
      document.querySelectorAll(".module-button").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.module === activeModule);
      });
    }

    function render() {
      project = normalizeProject(project);
      if (!project.windows.some(w => w.windowId === selectedWindowId)) selectedWindowId = project.windows[0].windowId;
      if (!project.assemblies.some(assembly => assembly.assemblyId === selectedAssemblyId)) selectedAssemblyId = project.assemblies[0]?.assemblyId || "";
      if (selectedPlacementId && !currentPlacement()) selectedPlacementId = "";
      if (selectedMemberId && !currentMember()) selectedMemberId = "";
      if (selectedJointId && !currentJoint()) selectedJointId = "";
      if (activeInspectorTab === "member" && !selectedMemberId) switchInspector("cell");
      if (activeInspectorTab === "joint" && !selectedJointId) switchInspector("window");
      if (activeInspectorTab === "assembly" && drawingMode !== "assembly") switchInspector("window");
      syncAssemblyJointConnections();
      bom = calculateProjectBom(project);
      renderInputs();
      renderSvg();
      renderCellPalette();
      renderCustomShapeLibrary();
      if (activeModule === "preview") renderThreePreview();
      renderWindowCards();
      renderTemplates();
      renderBom();
      renderStatus();
      saveProject();
    }

    function renderInputs() {
      const win = currentWindow();
      if (!win) return;
      setValue("projectId", project.project.projectId || "");
      setValue("projectName", project.project.name || "");
      setValue("customerName", project.project.customerName || "");
      setValue("projectAddress", project.project.address || "");
      setValue("orderId", project.order.orderId || "");
      setValue("batchNo", project.order.batchNo || "");
      setValue("winMark", win.mark);
      setValue("winQty", win.quantity);
      setValue("winWidth", win.widthMm);
      setValue("winHeight", win.heightMm);
      setValue("sillHeight", win.installation?.sillHeightMm || 0);
      setValue("winFloor", win.floor || "");
      setValue("winRoom", win.room || "");
      renderSelect("winShape", SHAPE_PRESETS.map(item => [item.type, item.label]), win.shape.type || "rectangular");
      setValue("archHeight", win.shape.archHeightMm || 0);
      setValue("shapePoints", formatShapePoints(win.shape.points || []));
      document.getElementById("shapePointsField")?.classList.toggle("hidden", win.shape.type !== "custom_polygon");
      document.getElementById("btnOpenDiyShapeEditor")?.classList.toggle("hidden", win.shape.type !== "custom_polygon");
      document.getElementById("archHeight")?.closest("label")?.classList.toggle("hidden", win.shape.type !== "arched");
      renderSelect("seriesId", project.catalog.profileSystems.map(s => [s.id, `${s.id} · ${s.name}`]), win.seriesId);
      renderSelect("glassTypeId", project.catalog.glassTypes.map(g => [g.id, g.name]), win.defaultGlassTypeId);
      renderSelect("hardwareSetId", project.catalog.hardwareSets.map(h => [h.id, h.name]), win.defaultHardwareSetId);
      setValue("colorInside", win.colorInside || "");
      setValue("colorOutside", win.colorOutside || "");
      const cell = currentCell(win);
      if (cell) {
        setValue("cellType", cell.type);
        setValue("cellCustomShapeName", cell.customShape?.name || "");
        document.getElementById("cellCustomShapeField")?.classList.toggle("hidden", !cell.customShape);
        renderSelect("opening", openingOptionsForType(cell.type).map(item => [item.value, item.label]), cell.opening);
        renderInputDatalist("cellGlass", project.catalog.glassTypes, cell.glassTypeId || win.defaultGlassTypeId);
        renderInputDatalist("cellHardware", project.catalog.hardwareSets, cell.hardwareSetId || win.defaultHardwareSetId);
        renderSelect("cellInfill", [["glass", "玻璃"], ["panel", "面板"], ["louver", "百叶"]], cell.infillType || "glass");
        renderSelect("cellScreenMode", [["none", "无"], ["fixed", "固定纱窗"], ["swing", "平开纱扇"], ["sliding", "推拉纱扇"], ["retractable", "卷轴纱窗"]], isOperableType(cell.type) ? (cell.openingAssembly?.screenMode || "none") : (cell.accessories?.screenMode || "none"));
        const accessories = normalizeCellAccessories(cell.accessories);
        const grille = document.getElementById("cellAccessoryGrille");
        const security = document.getElementById("cellAccessorySecurity");
        const frosted = document.getElementById("cellAccessoryFrosted");
        if (grille) grille.checked = accessories.grille;
        if (security) security.checked = accessories.securityBars;
        if (frosted) frosted.checked = accessories.frosted;
        setValue("handleHeight", cell.handleHeightMm ?? 750);
        setValue("cellNote", cell.note || "");
        const operable = isOperableType(cell.type);
        document.getElementById("opening").disabled = !operable;
        document.getElementById("cellHardware").disabled = !operable;
        document.getElementById("handleHeight").disabled = !operable;
        renderOpeningAssemblyInputs(cell);
      }
      const member = currentMember(win);
      const memberTab = document.querySelector('[data-inspector="member"]');
      memberTab?.classList.toggle("hidden", !member);
      if (member) {
        const memberIndex = win.topology.members.findIndex(item => item.memberId === member.memberId);
        const host = findMemberHost(win.layout, member);
        const series = currentSeries(win);
        setValue("memberOrientation", member.orientation);
        setValue("memberPosition", Math.round(member.positionRatio * 100));
        setValue("memberSpanStart", Math.round(member.span.startRatio * 100));
        setValue("memberSpanEnd", Math.round(member.span.endRatio * 100));
        setValue("memberProfile", member.profileId || series.mullionProfile || "");
        setValue("memberThroughMode", member.throughMode);
        setValue("memberConnectionStart", member.connectionStart);
        setValue("memberConnectionEnd", member.connectionEnd);
        setValue("memberNote", member.note || "");
        document.getElementById("memberTitle").textContent = `${memberLabel(member, memberIndex)} · ${member.orientation === "horizontal" ? "局部横梃" : "局部竖梃"}`;
        document.getElementById("memberHostLabel").textContent = host ? `${host.col + 1}列${host.row + 1}行 · ${host.cell.cellId}` : "未找到所属窗格";
        const spanDisabled = member.throughMode === "continuous";
        document.getElementById("memberSpanStart").disabled = spanDisabled;
        document.getElementById("memberSpanEnd").disabled = spanDisabled;
        const length = memberLengthMm(member, win, Number(series.faceWidthMm || 0));
        const hostMembers = win.topology.members.filter(item => item.hostRegionId === member.hostRegionId);
        const partition = partitionTopologyRegion(hostMembers);
        document.getElementById("memberTopologySummary").innerHTML = [
          ["构件ID", member.memberId],
          ["所属区域", member.hostRegionId],
          ["计算长度", `${Math.round(length)} mm`],
          ["分区校验", partition.valid ? `${partition.regions.length}个矩形区域` : "存在悬空线段，玻璃暂不拆分"],
          ["几何模式", win.geometryMode === "topology" ? "拓扑增强" : "规则网格"]
        ].map(([label, value]) => `<li><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></li>`).join("");
      }
      const joint = currentJoint();
      const jointTab = document.querySelector('[data-inspector="joint"]');
      jointTab?.classList.toggle("hidden", !joint);
      if (joint) {
        const jointIndex = project.joints.findIndex(item => item.jointId === joint.jointId);
        const hostWindow = project.windows.find(item => item.windowId === joint.hostWindowId) || win;
        const hostSeries = currentSeries(hostWindow);
        setValue("jointType", joint.type);
        renderSelect("jointStyle", JOINT_STYLE_OPTIONS[joint.type].map(item => [item.value, item.label]), joint.style);
        setValue("jointOrientation", joint.orientation);
        setValue("jointHostEdge", joint.hostEdge);
        setValue("jointAngle", joint.angleDeg);
        setValue("jointLegA", joint.legWidthAMm);
        setValue("jointLegB", joint.legWidthBMm);
        setValue("jointSpanStart", Math.round(joint.span.startRatio * 100));
        setValue("jointSpanEnd", Math.round(joint.span.endRatio * 100));
        setValue("jointProfile", joint.profileId || defaultJointProfile(joint.type, hostSeries));
        setValue("jointFrameTreatment", joint.frameTreatment);
        setValue("jointPostMode", joint.postMode);
        setValue("jointFastenerSpacing", joint.fastenerSpacingMm);
        setValue("jointNote", joint.note || "");
        document.getElementById("jointTitle").textContent = `${jointLabel(joint, jointIndex)} · ${joint.type === "corner" ? "转角料" : "拼接料"}`;
        document.getElementById("jointHostLabel").textContent = `${hostWindow.mark} · ${edgeLabel(joint.hostEdge)}`;
        document.getElementById("jointAngleField").classList.toggle("hidden", joint.type !== "corner");
        document.getElementById("jointPostModeField").classList.toggle("hidden", joint.type !== "corner");
        renderJointDetailPreview(joint);
        const status = jointStatus(joint);
        document.getElementById("jointSummary").innerHTML = [
          ["节点ID", joint.jointId],
          ["节点状态", status.label],
          ["计算长度", `${Math.round(jointLengthMm(joint, hostWindow))} mm`],
          ["安装方向", joint.orientation === "normal" ? "正装" : "反装"],
          ["BOM归属", hostWindow.mark]
        ].map(([label, value]) => `<li><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></li>`).join("");
      }
      renderInstallationInputs(win);
      renderProjectAssemblyInputs();
      const selectionModeLabel = document.getElementById("selectionModeLabel");
      if (selectionModeLabel) selectionModeLabel.textContent = drawingMode === "assembly"
        ? `组合模式 · ${currentPlacement() ? "定位窗" : "根窗"}`
        : joint
          ? `选择模式 · ${joint.type === "corner" ? "转角节点" : "拼接节点"}`
          : member
            ? `选择模式 · ${member.orientation === "horizontal" ? "局部横梃" : "局部竖梃"}`
            : `选择模式 · ${cell ? `${selectedCell.col + 1}列${selectedCell.row + 1}行` : "窗格"}`;
      [
        ["btnWindowDrawingMode", drawingMode === "window"],
        ["btnAssemblyDrawingMode", drawingMode === "assembly"]
      ].forEach(([id, active]) => {
        const button = document.getElementById(id);
        button?.classList.toggle("active", active);
        button?.setAttribute("aria-pressed", String(active));
      });
      setChecked("viewShowOpenState", project.viewOptions.showOpenState);
      setChecked("viewShowProfileColor", project.viewOptions.showProfileColor);
      setChecked("viewShowDimensions", project.viewOptions.showDimensions);
      setChecked("viewShowPlanView", project.viewOptions.showPlanView);
      if (activeLeftTab === "json") {
        setValue("jsonText", JSON.stringify(project, null, 2));
      }
      renderSeriesDetails();
      const series = currentSeries(win);
      const glass = project.catalog.glassTypes.find(item => item.id === win.defaultGlassTypeId);
      const hardware = project.catalog.hardwareSets.find(item => item.id === win.defaultHardwareSetId);
      document.getElementById("inspectorProductSummary").innerHTML = [
        ["产品系列", series?.name || win.seriesId],
        ["内/外色", `${win.colorInside || "-"} / ${win.colorOutside || "-"}`],
        ["默认玻璃", glass?.name || win.defaultGlassTypeId],
        ["默认五金", hardware?.name || win.defaultHardwareSetId],
        ["安装包套", win.installation?.surround?.enabled ? surroundSummary(win.installation.surround, win.widthMm, win.heightMm).style : "未启用"]
      ].map(([label, value]) => `<li><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "-")}</strong></li>`).join("");
      renderDesignerCapabilitySummary();
    }

    function renderDesignerCapabilitySummary() {
      const operableNames = OPERABLE_TYPES.map(type => typeLabels[type] || type);
      document.getElementById("designerCapabilitySummary").innerHTML = [
        ["外框预设", SHAPE_PRESETS.map(item => item.label).join("、")],
        ["开启窗型", operableNames.join("、")],
        ["填充构件", ["固定玻璃", "纱窗", "百叶", "格条", "面板", "留空"].join("、")],
        ["下一阶段", "拖点异形框、自由角度尺寸链、异形 3D 洞口"]
      ].map(([label, value]) => `<li><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></li>`).join("");
    }

    function renderInstallationInputs(win) {
      const surround = normalizeSurround(win.installation?.surround);
      const series = currentSeries(win);
      const placement = resolveFramePlacement(surround, series?.frameDepthMm || series?.faceWidthMm || 70);
      win.installation.surround = surround;
      setChecked("surroundEnabled", surround.enabled);
      renderSelect("installationMountingMode", MOUNTING_MODE_OPTIONS.map(item => [item.value, item.label]), surround.mountingMode);
      renderSelect("installationFrameAlignment", FRAME_ALIGNMENT_OPTIONS.map(item => [item.value, item.label]), surround.frameAlignment);
      renderSelect("surroundStyle", SURROUND_STYLE_OPTIONS.map(item => [item.value, item.label]), surround.styleId);
      renderSelect("surroundEdgeMode", SURROUND_EDGE_OPTIONS.map(item => [item.value, item.label]), surround.edgeMode);
      renderSelect("wallMaterial", WALL_MATERIAL_OPTIONS.map(item => [item.value, item.label]), surround.wallMaterialId);
      renderSelect("wallCornerMode", WALL_CORNER_MODE_OPTIONS.map(item => [item.value, item.label]), surround.wallCornerMode);
      setValue("surroundWallThickness", surround.wallThicknessMm);
      setValue("cornerPierWidth", surround.cornerPierWidthMm);
      setValue("surroundFrameOffset", surround.frameOffsetMm);
      setValue("exteriorMountGap", surround.exteriorMountGapMm);
      setValue("surroundOutsideWidth", surround.outsideWidthMm);
      setValue("surroundInsideWidth", surround.insideWidthMm);
      setValue("surroundBoardThickness", surround.boardThicknessMm);
      setValue("surroundMaterialCode", surround.materialCode);
      setValue("surroundColorOutside", surround.colorOutside);
      setValue("surroundColorInside", surround.colorInside);
      setValue("surroundNote", surround.note);
      const sides = new Set(resolveSurroundSides(surround));
      [
        ["top", "surroundSideTop"],
        ["right", "surroundSideRight"],
        ["bottom", "surroundSideBottom"],
        ["left", "surroundSideLeft"]
      ].forEach(([side, id]) => setChecked(id, sides.has(side)));
      document.getElementById("surroundCustomSides")?.classList.toggle("hidden", surround.edgeMode !== "custom");
      document.getElementById("installationFrameAlignmentField")?.classList.toggle("hidden", surround.mountingMode !== "opening");
      document.getElementById("surroundFrameOffsetField")?.classList.toggle("hidden", surround.mountingMode !== "opening" || surround.frameAlignment !== "custom");
      document.getElementById("exteriorMountGapField")?.classList.toggle("hidden", surround.mountingMode !== "exterior_overmount");
      document.getElementById("cornerPierWidthField")?.classList.toggle("hidden", surround.wallCornerMode !== "structural_pier");
      document.getElementById("surroundOutsideWidth").disabled = !["both_sides", "outside_only"].includes(surround.styleId);
      document.getElementById("surroundInsideWidth").disabled = !["both_sides", "inside_only"].includes(surround.styleId);
      document.getElementById("installationWindowLabel").textContent = `${win.mark} · ${win.widthMm}×${win.heightMm} mm`;
      renderInstallationDetailPreview(surround, series);
      const summary = surroundSummary(surround, win.widthMm, win.heightMm);
      document.getElementById("installationSummary").innerHTML = [
        ["包套状态", summary.enabled ? "已启用" : "未启用"],
        ["安装方式", summary.mountingMode],
        ["框位", `${summary.frameAlignment} · ${placement.effectiveFrameOffsetMm >= 0 ? "+" : ""}${Math.round(placement.effectiveFrameOffsetMm)} mm`],
        ["样式", summary.style],
        ["应用边", `${summary.edgeMode} · ${resolveSurroundSides(surround).map(surroundSideLabel).join("、") || "未选择"}`],
        ["包套总长", `${summary.perimeterMm} mm`],
        ["洞口衬板", `${summary.linerAreaM2.toFixed(3)} m²`],
        ["墙厚", `${summary.wallThicknessMm} mm`],
        ["墙体材质", summary.wallMaterial],
        ["转角墙节点", summary.wallCornerMode],
        ["转角墙柱", summary.wallCornerMode === "结构转角墙柱" ? `${summary.cornerPierWidthMm} mm` : "不设墙柱"]
      ].map(([label, value]) => `<li><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></li>`).join("");
    }

    function renderInstallationDetailPreview(surround, series) {
      const svg = document.getElementById("installationDetailPreview");
      if (!svg) return;
      const enabled = surround.enabled;
      const wallX = 72;
      const wallWidth = 136;
      const wallY = 48;
      const wallHeight = 76;
      const placement = resolveFramePlacement(surround, series?.frameDepthMm || series?.faceWidthMm || 70);
      const frameDepth = Math.max(12, Math.min(46, placement.frameDepthMm / placement.wallThicknessMm * wallWidth));
      const frameCenter = wallX + wallWidth / 2 + placement.effectiveFrameOffsetMm / placement.wallThicknessMm * wallWidth;
      const frameX = frameCenter - frameDepth / 2;
      const boardDepth = Math.max(4, Math.min(12, surround.boardThicknessMm * 0.34));
      const outsideEnabled = enabled && ["both_sides", "outside_only"].includes(surround.styleId);
      const insideEnabled = enabled && ["both_sides", "inside_only"].includes(surround.styleId);
      const linerEnabled = enabled && ["both_sides", "liner"].includes(surround.styleId);
      svg.innerHTML = `
        <text class="surround-preview-label" x="32" y="24">室外</text>
        <text class="surround-preview-label" x="248" y="24">室内</text>
        <rect class="surround-preview-wall" x="${wallX}" y="${wallY}" width="${wallWidth}" height="${wallHeight}" />
        ${linerEnabled ? `<rect class="surround-preview-liner" x="${wallX + 4}" y="${wallY + 10}" width="${wallWidth - 8}" height="${wallHeight - 20}" />` : ""}
        <rect class="surround-preview-frame" x="${frameX}" y="${wallY + 5}" width="${frameDepth}" height="${wallHeight - 10}" />
        ${outsideEnabled ? `<rect class="surround-preview-outside" x="${wallX - boardDepth}" y="${wallY - 18}" width="${boardDepth}" height="${wallHeight + 36}" />` : ""}
        ${insideEnabled ? `<rect class="surround-preview-inside" x="${wallX + wallWidth}" y="${wallY - 18}" width="${boardDepth}" height="${wallHeight + 36}" />` : ""}
        <path class="surround-preview-dimension" d="M${wallX} 146H${wallX + wallWidth} M${wallX} 141V151 M${wallX + wallWidth} 141V151" />
        <text class="surround-preview-label" x="140" y="164">墙厚 ${Math.round(surround.wallThicknessMm)} mm</text>
        <text class="surround-preview-label" x="${Math.max(30, Math.min(250, frameCenter))}" y="38">${placement.mountingMode === "exterior_overmount" ? "外挂" : "框位"} ${placement.effectiveFrameOffsetMm >= 0 ? "+" : ""}${Math.round(placement.effectiveFrameOffsetMm)} mm</text>`;
    }

    function renderProjectAssemblyInputs() {
      const tab = document.querySelector('[data-inspector="assembly"]');
      const assembly = currentProjectAssembly();
      const placement = currentPlacement();
      tab?.classList.toggle("hidden", drawingMode !== "assembly");
      const controls = [
        "placementReference",
        "placementDock",
        "placementAlign",
        "placementGap",
        "placementOffset",
        "placementRotation",
        "placementFreeX",
        "placementFreeY",
        "placementFreeZ",
        "placementJoint",
        "placementNote"
      ];
      const deletePlacement = document.getElementById("btnDeletePlacement");
      if (deletePlacement) deletePlacement.disabled = !placement;
      const deleteAssembly = document.getElementById("btnDeleteAssembly");
      if (deleteAssembly) deleteAssembly.disabled = !assembly;
      controls.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.disabled = !placement;
      });
      if (!assembly) {
        renderSelect("projectAssemblySelect", [], "");
        const assemblySelect = document.getElementById("projectAssemblySelect");
        if (assemblySelect) assemblySelect.disabled = true;
        setValue("projectAssemblyName", "");
        renderSelect("projectAssemblyRoot", [], "");
        const nameControl = document.getElementById("projectAssemblyName");
        if (nameControl) nameControl.disabled = true;
        const rootControl = document.getElementById("projectAssemblyRoot");
        if (rootControl) rootControl.disabled = true;
        document.getElementById("projectAssemblyTitle").textContent = "尚未建立组合";
        document.getElementById("placementWindowLabel").textContent = "从左侧新建组合或选择停靠方向";
        document.getElementById("projectAssemblySummary").innerHTML = '<li><span>组合状态</span><strong>未创建</strong></li>';
        return;
      }

      renderSelect(
        "projectAssemblySelect",
        project.assemblies.map(item => [item.assemblyId, item.name]),
        assembly.assemblyId
      );
      const assemblySelect = document.getElementById("projectAssemblySelect");
      if (assemblySelect) assemblySelect.disabled = false;
      const nameControl = document.getElementById("projectAssemblyName");
      if (nameControl) nameControl.disabled = false;
      setValue("projectAssemblyName", assembly.name);
      renderSelect("projectAssemblyRoot", project.windows.map(win => [win.windowId, `${win.mark} · ${win.name}`]), assembly.rootWindowId);
      const rootControl = document.getElementById("projectAssemblyRoot");
      if (rootControl) rootControl.disabled = assembly.placements.length > 0;
      document.getElementById("projectAssemblyTitle").textContent = assembly.name;
      if (placement) {
        const movingWindow = project.windows.find(win => win.windowId === placement.windowId);
        document.getElementById("placementWindowLabel").textContent = `${movingWindow?.mark || placement.windowId} · ${dockLabel(placement.dock)}`;
        renderSelect(
          "placementReference",
          project.windows.filter(win => win.windowId !== placement.windowId).map(win => [win.windowId, `${win.mark} · ${win.name}`]),
          placement.referenceWindowId
        );
        setValue("placementDock", placement.dock);
        setValue("placementAlign", placement.align);
        setValue("placementGap", placement.gapMm);
        setValue("placementOffset", placement.offsetMm);
        setValue("placementRotation", placement.rotationDeg);
        setValue("placementFreeX", placement.freePosition.xMm);
        setValue("placementFreeY", placement.freePosition.yMm);
        setValue("placementFreeZ", placement.freePosition.zMm);
        renderSelect(
          "placementJoint",
          [["", "不使用连接节点"], ...project.joints.map((joint, index) => [joint.jointId, `${jointLabel(joint, index)} · ${joint.type === "corner" ? "转角料" : "拼接料"}`])],
          placement.jointId
        );
        setValue("placementNote", placement.note || "");
      } else {
        const root = project.windows.find(win => win.windowId === assembly.rootWindowId);
        document.getElementById("placementWindowLabel").textContent = `${root?.mark || assembly.rootWindowId} · 根窗`;
      }
      document.getElementById("placementFreeFields").classList.toggle("hidden", !placement || placement.dock !== "free");
      const summary = assemblySummary(assembly, project.windows);
      document.getElementById("projectAssemblySummary").innerHTML = [
        ["组合ID", summary.assemblyId],
        ["包含窗体", `${summary.windowIds.length}樘`],
        ["连接节点", `${summary.jointIds.length}个`],
        ["组合外包", `${summary.overallWidthMm}×${summary.overallHeightMm}×${summary.overallDepthMm} mm`],
        ["根窗", project.windows.find(win => win.windowId === summary.rootWindowId)?.mark || summary.rootWindowId]
      ].map(([label, value]) => `<li><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></li>`).join("");
    }

    function edgeLabel(edge) {
      return { left: "左边", right: "右边", top: "上边", bottom: "下边" }[edge] || edge;
    }

    function renderJointDetailPreview(joint) {
      const svg = document.getElementById("jointDetailPreview");
      if (!svg || !joint) return;
      if (joint.type === "splice") {
        svg.innerHTML = `
          <text class="joint-detail-label" x="130" y="20">${joint.orientation === "normal" ? "正装" : "反装"} · ${joint.style === "reinforced" ? "加强拼接" : "标准拼接"}</text>
          <rect class="joint-detail-profile" x="36" y="58" width="82" height="34" />
          <rect class="joint-detail-profile" x="142" y="58" width="82" height="34" />
          <rect class="joint-detail-profile" x="108" y="48" width="44" height="54" rx="2" />
          ${joint.style === "reinforced" ? '<rect x="119" y="38" width="22" height="74" fill="#cc7a00" opacity="0.75" />' : ""}
          <path class="joint-detail-dimension" d="M108 122H152 M108 117V127 M152 117V127" />
          <text class="joint-detail-label" x="130" y="142">${Math.round(joint.legWidthAMm + joint.legWidthBMm)} mm</text>
          <text class="joint-detail-label" x="76" y="78">窗框 A</text>
          <text class="joint-detail-label" x="184" y="78">窗框 B</text>`;
        return;
      }
      const sign = joint.orientation === "reversed" ? 1 : -1;
      const angle = Number(joint.angleDeg || 90);
      const legA = Math.max(38, Math.min(78, Number(joint.legWidthAMm || 50)));
      const legB = Math.max(38, Math.min(78, Number(joint.legWidthBMm || 50)));
      svg.innerHTML = `
        <text class="joint-detail-label" x="130" y="20">${JOINT_STYLE_OPTIONS.corner.find(item => item.value === joint.style)?.label || "转角"} · ${joint.orientation === "normal" ? "正装" : "反装"}</text>
        <g transform="translate(130 84)">
          <rect class="joint-detail-profile" x="-${legA}" y="-9" width="${legA}" height="18" />
          <g transform="rotate(${sign * angle})">
            <rect class="joint-detail-profile" x="0" y="-9" width="${legB}" height="18" />
          </g>
          <circle cx="0" cy="0" r="${joint.style === "curved" ? 14 : 9}" fill="${joint.postMode === "postless" ? "#fff" : "#cc7a00"}" stroke="#263b49" stroke-width="2" />
        </g>
        <path class="joint-detail-dimension" d="M82 114 Q130 ${joint.orientation === "normal" ? 135 : 93} 178 114" />
        <text class="joint-detail-label" x="130" y="139">${Math.round(angle)}° · A ${Math.round(joint.legWidthAMm)} / B ${Math.round(joint.legWidthBMm)} mm</text>`;
    }

    function renderOpeningAssemblyInputs(cell) {
      const panel = document.getElementById("openingAssemblyPanel");
      const operable = isOperableType(cell.type);
      panel.classList.toggle("hidden", !operable);
      if (!operable) return;
      const assembly = normalizeOpeningAssembly(cell.type, cell.opening, cell.openingAssembly);
      cell.openingAssembly = assembly;
      const limits = assemblyLimits(cell.type);
      setValue("assemblyPanelCount", assembly.panelCount);
      setValue("assemblyActivePanelCount", assembly.activePanelCount);
      setValue("assemblyTrackCount", assembly.trackCount);
      setValue("assemblyMullionMode", assembly.mullionMode);
      setValue("assemblyOpenPlane", assembly.openPlane);
      setValue("assemblyOperationPriority", assembly.operationPriority);
      setValue("assemblyVentilationMode", assembly.ventilationMode);
      setValue("assemblyTrafficDoor", assembly.trafficDoor);
      setValue("assemblyScreenMode", assembly.screenMode);
      setValue("assemblyCornerAngle", assembly.cornerAngleDeg);
      setValue("assemblyCornerPostMode", assembly.cornerPostMode);
      setValue("assemblyPocketDepth", assembly.pocketDepthMm);

      const vertical = cell.type === "vertical_slide";
      renderSelect("assemblyPrimarySide", vertical
        ? [["left", "下扇先动"], ["right", "上扇先动"]]
        : [["left", "左侧主扇"], ["right", "右侧主扇"]], assembly.primarySide);
      renderSelect("assemblyStackSide", vertical
        ? [["top", "向上"], ["bottom", "向下"], ["both", "上下双动"]]
        : [["left", "向左"], ["right", "向右"], ["both", "向两侧"]], assembly.stackSide);
      if (cell.type === "psk") {
        renderSelect("assemblyOperationPriority", [["tilt_first", "内倒优先"], ["slide_first", "平移优先"]], assembly.operationPriority);
      } else {
        renderSelect("assemblyOperationPriority", [["turn_first", "平开优先"], ["tilt_first", "内倒优先"]], assembly.operationPriority);
      }

      const panelCount = document.getElementById("assemblyPanelCount");
      panelCount.min = String(limits.minPanels);
      panelCount.max = String(limits.maxPanels);
      const activeCount = document.getElementById("assemblyActivePanelCount");
      activeCount.min = String(limits.minActive);
      activeCount.max = String(Math.min(limits.maxActive, assembly.panelCount));
      const trackCount = document.getElementById("assemblyTrackCount");
      trackCount.min = String(limits.minTracks);
      trackCount.max = String(Math.min(limits.maxTracks, assembly.panelCount));

      const multiPanel = limits.maxPanels > 1;
      setAssemblyFieldVisible("panelCount", multiPanel);
      setAssemblyFieldVisible("activePanelCount", ["turn", "turn_tilt", "door", "sliding", "lift_slide", "psk", "parallel_slide", "pocket_slide", "corner_slide", "vertical_slide"].includes(cell.type));
      setAssemblyFieldVisible("trackCount", ["sliding", "lift_slide", "psk", "parallel_slide", "pocket_slide", "corner_slide", "vertical_slide"].includes(cell.type));
      setAssemblyFieldVisible("stackSide", ["sliding", "lift_slide", "psk", "parallel_slide", "pocket_slide", "corner_slide", "vertical_slide", "folding"].includes(cell.type));
      setAssemblyFieldVisible("primarySide", ["turn", "turn_tilt", "door", "vertical_slide"].includes(cell.type));
      setAssemblyFieldVisible("mullionMode", ["turn", "turn_tilt", "door"].includes(cell.type) && assembly.panelCount > 1);
      setAssemblyFieldVisible("openPlane", cell.type === "folding");
      setAssemblyFieldVisible("operationPriority", ["turn_tilt", "psk"].includes(cell.type));
      setAssemblyFieldVisible("ventilationMode", ["turn_tilt", "psk", "sliding", "lift_slide"].includes(cell.type));
      setAssemblyFieldVisible("trafficDoor", cell.type === "folding");
      setAssemblyFieldVisible("screenMode", true);
      setAssemblyFieldVisible("cornerAngleDeg", cell.type === "corner_slide");
      setAssemblyFieldVisible("cornerPostMode", cell.type === "corner_slide");
      setAssemblyFieldVisible("pocketDepthMm", cell.type === "pocket_slide");
      document.getElementById("assemblySummary").textContent = openingAssemblySummary(cell.type, assembly);
    }

    function setAssemblyFieldVisible(name, visible) {
      document.querySelector(`[data-assembly-field="${name}"]`)?.classList.toggle("hidden", !visible);
    }

    function renderSelect(id, options, selected) {
      const el = document.getElementById(id);
      const html = options.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
      if (el.innerHTML !== html) el.innerHTML = html;
      setValue(id, selected || options[0]?.[0] || "");
    }

    function renderInputDatalist(id, source, value) {
      setValue(id, value || "");
      const input = document.getElementById(id);
      const listId = `${id}-list`;
      if (!document.getElementById(listId)) {
        const dl = document.createElement("datalist");
        dl.id = listId;
        document.body.appendChild(dl);
        input.setAttribute("list", listId);
      }
      document.getElementById(listId).innerHTML = source.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
    }

    function renderSeriesDetails() {
      const s = currentSeries();
      const rows = [
        ["材质", materialName(s.material)],
        ["框料", s.frameProfile],
        ["扇料", s.sashProfile],
        ["中梃", s.mullionProfile],
        ["拼接料", s.spliceProfile || `${s.id}-SPLICE`],
        ["转角料", s.cornerProfile || `${s.id}-CORNER-90`],
        ["压条", s.beadProfile],
        ["胶条", s.gasketCode],
        ["标准料长", `${s.stockLengthMm} mm`]
      ];
      document.getElementById("seriesDetails").innerHTML = rows
        .map(([k, v]) => `<li><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></li>`)
        .join("");
    }

    function renderCellPalette() {
      const cell = currentCell();
      document.querySelectorAll("[data-cell-preset]").forEach(btn => {
        const preset = btn.dataset.cellPreset;
        const active = preset === cell?.type
          || (preset === "grille" && Boolean(cell?.accessories?.grille))
          || (preset === "screen" && ((cell?.accessories?.screenMode && cell.accessories.screenMode !== "none") || (cell?.openingAssembly?.screenMode && cell.openingAssembly.screenMode !== "none")))
          || (preset === "louver" && cell?.infillType === "louver")
          || (preset === "panel" && cell?.infillType === "panel");
        btn.classList.toggle("active", active);
      });
      const win = currentWindow();
      document.querySelectorAll("[data-shape-preset]").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.shapePreset === win?.shape?.type);
      });
    }

    function renderCustomShapeLibrary() {
      const container = document.getElementById("customShapeLibrary");
      if (!container) return;
      container.innerHTML = (project.customShapes || []).map(shape => `
        <div class="custom-shape-item" title="${escapeHtml(shape.name)}">
          <button class="custom-shape-apply" data-custom-shape="${escapeHtml(shape.shapeId)}" type="button">
            ${renderCustomShapeThumb(shape.points)}
            <strong>${escapeHtml(shape.name)}</strong>
          </button>
          <button class="custom-shape-edit" data-edit-custom-shape="${escapeHtml(shape.shapeId)}" type="button">编辑</button>
        </div>
      `).join("");
    }

    function renderCustomShapeThumb(points) {
      const normalized = normalizeShapePoints(points);
      if (normalized.length < 3) return "";
      const path = normalized.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" ");
      return `<svg viewBox="-6 -6 112 112" aria-hidden="true"><path d="${path} Z" fill="rgba(187,225,238,0.55)" stroke="#20383e" stroke-width="5" vector-effect="non-scaling-stroke" /></svg>`;
    }

    function cellCustomShapePath(cell, item) {
      const shape = normalizeCellCustomShape(cell?.customShape);
      if (!shape) return "";
      return shape.points.map((point, index) => {
        const px = item.x + point.x / 100 * item.w;
        const py = item.y + point.y / 100 * item.h;
        return `${index ? "L" : "M"}${px} ${py}`;
      }).join(" ") + " Z";
    }

    function renderSvg() {
      const svg = document.getElementById("windowSvg");
      const win = currentWindow();
      if (!win) {
        svg.innerHTML = "";
        return;
      }
      if (drawingMode === "assembly") {
        renderAssemblySvg(svg);
        return;
      }
      const options = project.viewOptions;
      const view = { w: 900, h: options.showPlanView ? 760 : 620 };
      const elevationHeight = options.showPlanView ? 500 : view.h;
      const margin = { x: 90, y: 72 };
      const scale = Math.min((view.w - margin.x * 2) / win.widthMm, (elevationHeight - margin.y * 2) / win.heightMm);
      const drawW = win.widthMm * scale;
      const drawH = win.heightMm * scale;
      const x = (view.w - drawW) / 2;
      const y = (elevationHeight - drawH) / 2 + (options.showPlanView ? 0 : 10);
      const series = currentSeries(win);
      const face = Math.max(10, Number(series.faceWidthMm || 70) * scale);
      const inner = { x: x + face, y: y + face, w: drawW - 2 * face, h: drawH - 2 * face };
      const rects = computeCellRects(win, inner);
      let planY = 0;
      if (options.showPlanView) {
        const cornerPreview = resolvePlanCornerMount(win, rects, x, 0, drawW);
        const cornerRise = cornerPreview ? Math.max(0, -cornerPreview.endY) : 0;
        const planExtents = estimatePlanProjectionExtents(win, rects, x, drawW);
        const planClearance = Math.max(118, cornerRise + 70, planExtents.outside + 54);
        planY = y + drawH + planClearance;
        view.h = Math.max(view.h, planY + Math.max(142, planExtents.inside + 82));
      }
      svg.setAttribute("viewBox", `0 0 ${view.w} ${view.h}`);
      const framePath = frameShapePath(win, x, y, drawW, drawH, face);
      const frameColor = options.showProfileColor ? profileColor(win.colorInside, series.material) : "#7e8792";
      const outlineColor = series.material === "pvc" ? "#d8dcdd" : "#26393e";
      const parts = [];

      parts.push(svgPlanDefs());
      parts.push(`<text class="window-mark" x="${view.w / 2}" y="${Math.max(18, y - 38)}">${escapeHtml(win.mark)}</text>`);
      parts.push(renderSurroundElevation(win, x, y, drawW, drawH, scale));
      parts.push(`<path d="${framePath}" fill="${frameColor}" fill-rule="evenodd" stroke="${outlineColor}" stroke-width="2" />`);
      parts.push(`<rect x="${inner.x}" y="${inner.y}" width="${inner.w}" height="${inner.h}" fill="#f8fbfc" />`);

      for (let i = 0; i < rects.length; i += 1) {
        const item = rects[i];
        const cell = item.cell;
        const selected = item.row === selectedCell.row && item.col === selectedCell.col;
        const fill = cellFill(cell);
        const openable = isOperableType(cell.type);
        const cellPath = cellCustomShapePath(cell, item);
        const clipId = cellPath ? `cellClip-${item.row}-${item.col}` : "";
        parts.push(`<g class="cell" data-row="${item.row}" data-col="${item.col}" tabindex="0">`);
        if (cellPath) {
          parts.push(`<defs><clipPath id="${clipId}"><path d="${cellPath}" /></clipPath></defs>`);
          parts.push(`<path d="${cellPath}" fill="${fill}" stroke="${cell.type === "empty" ? "#b8c3c6" : "#5a747b"}" stroke-width="1.6" />`);
          parts.push(`<text class="shape-angle-label" x="${item.x + item.w / 2}" y="${item.y + 16}">${escapeHtml(cell.customShape.name)}</text>`);
        } else {
          parts.push(`<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" fill="${fill}" stroke="${cell.type === "empty" ? "#b8c3c6" : "#5a747b"}" stroke-width="1.2" />`);
        }
        if (cellPath) parts.push(`<g clip-path="url(#${clipId})">`);
        if (openable) {
          const inset = Math.min(item.w, item.h) * 0.12;
          if (options.showOpenState) {
            parts.push(openCellElevation(cell, item, outlineColor, frameColor, scale));
          } else {
            parts.push(`<rect x="${item.x + inset}" y="${item.y + inset}" width="${Math.max(0, item.w - inset * 2)}" height="${Math.max(0, item.h - inset * 2)}" fill="none" stroke="${outlineColor}" stroke-width="5" />`);
            parts.push(openingSymbol(cell, item, inset));
          }
        }
        parts.push(cellDecoration(cell, item, outlineColor));
        parts.push(integratedScreenDecoration(cell, item, outlineColor));
        if (cellPath) parts.push(`</g>`);
        parts.push(`<text class="cell-label" x="${item.x + item.w / 2}" y="${item.y + item.h / 2}">${escapeHtml(cellDrawingCode(cell.type, i))}</text>`);
        if (selected && openable && options.showDimensions) {
          parts.push(handleHeightDimension(cell, item, scale));
        }
        if (selected) {
          parts.push(cellPath
            ? `<path class="selected-stroke" d="${cellPath}" />`
            : `<rect class="selected-stroke" x="${item.x + 3}" y="${item.y + 3}" width="${Math.max(0, item.w - 6)}" height="${Math.max(0, item.h - 6)}" />`);
        }
        parts.push(`</g>`);
      }

      const dividerColor = frameColor;
      const colEdges = rectsToEdges(win.layout.columns, inner.x, inner.w);
      const rowEdges = rectsToEdges(win.layout.rows, inner.y, inner.h);
      for (let c = 1; c < colEdges.length - 1; c += 1) {
        for (let r = 0; r < win.layout.rows.length; r += 1) {
          if (cellHasCustomShape(win, r, c - 1) || cellHasCustomShape(win, r, c)) continue;
          const bottom = rowEdges[r];
          const top = rowEdges[r + 1];
          parts.push(`<rect x="${colEdges[c] - face / 2}" y="${bottom}" width="${face}" height="${top - bottom}" fill="${dividerColor}" stroke="${outlineColor}" stroke-width="1.5" />`);
        }
      }
      for (let r = 1; r < rowEdges.length - 1; r += 1) {
        const aboveRow = r - 1;
        const belowRow = r;
        for (let c = 0; c < win.layout.columns.length; c += 1) {
          if (cellHasCustomShape(win, aboveRow, c) || cellHasCustomShape(win, belowRow, c)) continue;
          parts.push(`<rect x="${colEdges[c]}" y="${rowEdges[r] - face / 2}" width="${colEdges[c + 1] - colEdges[c]}" height="${face}" fill="${dividerColor}" stroke="${outlineColor}" stroke-width="1.5" />`);
        }
      }

      parts.push(renderTopologyMembers(win, rects, face, dividerColor, outlineColor));
      parts.push(renderEngineeringJoints(win, x, y, drawW, drawH));

      if (options.showDimensions) {
        const colTotal = sum(win.layout.columns);
        const rowTotal = sum(win.layout.rows);
        const dimensionColEdges = rectsToEdges(win.layout.columns, x, drawW, colTotal);
        const dimensionRowEdges = rectsToEdges(win.layout.rows, y, drawH, rowTotal);
        for (let c = 0; c < win.layout.columns.length; c += 1) {
          const widthMm = win.widthMm * win.layout.columns[c] / colTotal;
          parts.push(dimensionLine(dimensionColEdges[c], y - 22, dimensionColEdges[c + 1], y - 22, `${Math.round(widthMm)}`));
        }
        for (let r = 0; r < win.layout.rows.length; r += 1) {
          const heightMm = win.heightMm * win.layout.rows[r] / rowTotal;
          parts.push(dimensionLine(x + drawW + 22, dimensionRowEdges[r], x + drawW + 22, dimensionRowEdges[r + 1], `${Math.round(heightMm)}`, true));
        }
        parts.push(dimensionLine(x, y + drawH + 34, x + drawW, y + drawH + 34, `${Math.round(win.widthMm)} mm`));
        parts.push(dimensionLine(x + drawW + 52, y, x + drawW + 52, y + drawH, `${Math.round(win.heightMm)} mm`, true));
        parts.push(`<text class="sill-height-label" x="${x + drawW + 10}" y="${y + drawH + 17}">台高 ${Math.round(win.installation?.sillHeightMm || 0)} mm</text>`);
        parts.push(renderCustomShapeAnnotations(win, x, y, drawW, drawH));
      }
      if (options.showPlanView) {
        parts.push(renderPlanView(win, rects, x, planY, drawW, outlineColor, frameColor, options));
      }

      svg.innerHTML = parts.join("");
      svg.querySelectorAll(".cell").forEach(g => {
        g.addEventListener("click", event => {
          const row = Number(g.dataset.row);
          const col = Number(g.dataset.col);
          selectedMemberId = "";
          selectedJointId = "";
          selectedCell = { row, col };
          switchInspector("cell");
          render();
        });
        g.addEventListener("contextmenu", event => {
          event.preventDefault();
          const row = Number(g.dataset.row);
          const col = Number(g.dataset.col);
          selectedMemberId = "";
          selectedJointId = "";
          selectedCell = { row, col };
          switchInspector("cell");
          render();
          showCellContextMenu(event, row, col);
        });
        g.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            selectedMemberId = "";
            selectedJointId = "";
            selectedCell = { row: Number(g.dataset.row), col: Number(g.dataset.col) };
            switchInspector("cell");
            render();
          }
        });
      });
      svg.querySelectorAll(".topology-member").forEach(group => {
        const select = () => {
          const member = win.topology.members.find(item => item.memberId === group.dataset.memberId);
          const host = findMemberHost(win.layout, member);
          if (!member || !host) return;
          selectedJointId = "";
          selectedMemberId = member.memberId;
          selectedCell = { row: host.row, col: host.col };
          switchInspector("member");
          render();
        };
        group.addEventListener("click", event => {
          event.stopPropagation();
          select();
        });
        group.addEventListener("contextmenu", event => {
          event.preventDefault();
          event.stopPropagation();
          select();
          showMemberContextMenu(event, group.dataset.memberId);
        });
        group.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") select();
        });
      });
      svg.querySelectorAll(".engineering-joint").forEach(group => {
        const select = () => {
          const joint = project.joints.find(item => item.jointId === group.dataset.jointId);
          if (!joint) return;
          selectedMemberId = "";
          selectedJointId = joint.jointId;
          switchInspector("joint");
          render();
        };
        group.addEventListener("click", event => {
          event.stopPropagation();
          select();
        });
        group.addEventListener("contextmenu", event => {
          event.preventDefault();
          event.stopPropagation();
          select();
          showJointContextMenu(event, group.dataset.jointId);
        });
        group.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") select();
        });
      });
      document.getElementById("drawingTitle").textContent = `${win.mark} · ${win.name || ""}`;
      document.getElementById("drawingStats").textContent = `室外立面 · ${win.widthMm}×${win.heightMm} mm · ${win.layout.columns.length}列${win.layout.rows.length}行 · ${currentSeries(win).name}`;
    }

    function svgPlanDefs() {
      return `<defs>
        <marker id="planMotionArrow" viewBox="0 0 8 8" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L8,4 L0,8 Z" fill="#1677ff" />
        </marker>
      </defs>`;
    }

    function renderSurroundElevation(win, x, y, width, height, scale) {
      const geometry = surroundGeometry(win.installation?.surround, win.widthMm, win.heightMm);
      if (!geometry.surround.enabled || !geometry.sides.length) return "";
      const visibleWidthMm = Math.max(
        geometry.outsideEnabled ? geometry.surround.outsideWidthMm : 0,
        geometry.insideEnabled ? geometry.surround.insideWidthMm : 0,
        geometry.surround.boardThicknessMm * 2
      );
      const band = Math.max(6, Math.min(46, visibleWidthMm * scale));
      return geometry.sides.map(side => {
        if (side === "top") return `<rect class="surround-elevation" x="${x - band}" y="${y - band}" width="${width + band * 2}" height="${band}" />`;
        if (side === "right") return `<rect class="surround-elevation" x="${x + width}" y="${y - band}" width="${band}" height="${height + band * 2}" />`;
        if (side === "bottom") return `<rect class="surround-elevation" x="${x - band}" y="${y + height}" width="${width + band * 2}" height="${band}" />`;
        return `<rect class="surround-elevation" x="${x - band}" y="${y - band}" width="${band}" height="${height + band * 2}" />`;
      }).join("");
    }

    function renderAssemblySvg(svg) {
      const view = { w: 900, h: 700 };
      const assembly = currentProjectAssembly();
      svg.setAttribute("viewBox", `0 0 ${view.w} ${view.h}`);
      if (!assembly) {
        svg.innerHTML = '<text class="assembly-empty-state" x="450" y="330">尚未建立门窗组合</text>';
        document.getElementById("drawingTitle").textContent = "组合总图";
        document.getElementById("drawingStats").textContent = `${project.windows.length}樘待组合门窗`;
        return;
      }
      const layout = resolveAssemblyLayout(assembly, project.windows);
      const rawPoint = (item, localX, localY) => {
        const angle = item.rotationDeg * Math.PI / 180;
        const worldX = item.xMm + Math.cos(angle) * localX;
        const worldZ = item.zMm - Math.sin(angle) * localX;
        const worldY = item.yMm + localY;
        return { x: worldX + worldZ * 0.42, y: -worldY + worldZ * 0.16 };
      };
      const rawCorners = layout.flatMap(item => [
        rawPoint(item, -item.window.widthMm / 2, -item.window.heightMm / 2),
        rawPoint(item, item.window.widthMm / 2, -item.window.heightMm / 2),
        rawPoint(item, item.window.widthMm / 2, item.window.heightMm / 2),
        rawPoint(item, -item.window.widthMm / 2, item.window.heightMm / 2)
      ]);
      const minX = Math.min(...rawCorners.map(point => point.x));
      const maxX = Math.max(...rawCorners.map(point => point.x));
      const minY = Math.min(...rawCorners.map(point => point.y));
      const maxY = Math.max(...rawCorners.map(point => point.y));
      const margin = 86;
      const scale = Math.min(
        (view.w - margin * 2) / Math.max(1, maxX - minX),
        (view.h - margin * 2) / Math.max(1, maxY - minY)
      );
      const offsetX = (view.w - (maxX - minX) * scale) / 2 - minX * scale;
      const offsetY = (view.h - (maxY - minY) * scale) / 2 - minY * scale;
      const point = (item, localX, localY) => {
        const raw = rawPoint(item, localX, localY);
        return { x: raw.x * scale + offsetX, y: raw.y * scale + offsetY };
      };
      const pointString = points => points.map(item => `${item.x.toFixed(2)},${item.y.toFixed(2)}`).join(" ");
      const parts = [];

      layout.forEach(item => {
        if (!item.referenceWindowId) return;
        const reference = layout.find(candidate => candidate.windowId === item.referenceWindowId);
        if (!reference) return;
        const from = point(reference, 0, 0);
        const to = point(item, 0, 0);
        const placement = assembly.placements.find(candidate => candidate.placementId === item.placementId);
        const joint = project.joints.find(candidate => candidate.jointId === placement?.jointId);
        parts.push(`<line class="assembly-link" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`);
        parts.push(`<text class="assembly-link-label" x="${(from.x + to.x) / 2}" y="${(from.y + to.y) / 2 - 8}">${escapeHtml(joint ? jointLabel(joint, project.joints.indexOf(joint)) : dockLabel(item.dock))}</text>`);
      });

      layout.forEach(item => {
        const win = item.window;
        const series = currentSeries(win);
        const face = Math.min(Number(series.faceWidthMm || 70), win.widthMm * 0.18, win.heightMm * 0.18);
        const outer = [
          point(item, -win.widthMm / 2, -win.heightMm / 2),
          point(item, win.widthMm / 2, -win.heightMm / 2),
          point(item, win.widthMm / 2, win.heightMm / 2),
          point(item, -win.widthMm / 2, win.heightMm / 2)
        ];
        const inner = [
          point(item, -win.widthMm / 2 + face, -win.heightMm / 2 + face),
          point(item, win.widthMm / 2 - face, -win.heightMm / 2 + face),
          point(item, win.widthMm / 2 - face, win.heightMm / 2 - face),
          point(item, -win.widthMm / 2 + face, win.heightMm / 2 - face)
        ];
        const selected = item.placementId ? item.placementId === selectedPlacementId : !selectedPlacementId && win.windowId === selectedWindowId;
        parts.push(`<g class="assembly-window ${selected ? "selected" : ""}" data-window-id="${escapeHtml(win.windowId)}" data-placement-id="${escapeHtml(item.placementId)}" tabindex="0">`);
        parts.push(`<polygon class="assembly-window-frame" points="${pointString(outer)}" />`);
        parts.push(`<polygon class="assembly-window-inner" points="${pointString(inner)}" />`);
        const innerWidth = Math.max(0, win.widthMm - face * 2);
        const innerHeight = Math.max(0, win.heightMm - face * 2);
        const colTotal = sum(win.layout.columns);
        let colAt = -innerWidth / 2;
        for (let index = 0; index < win.layout.columns.length - 1; index += 1) {
          colAt += innerWidth * win.layout.columns[index] / colTotal;
          const start = point(item, colAt, -innerHeight / 2);
          const end = point(item, colAt, innerHeight / 2);
          parts.push(`<line class="assembly-window-divider" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" />`);
        }
        const rowTotal = sum(win.layout.rows);
        let rowAt = -innerHeight / 2;
        for (let index = 0; index < win.layout.rows.length - 1; index += 1) {
          rowAt += innerHeight * win.layout.rows[index] / rowTotal;
          const start = point(item, -innerWidth / 2, rowAt);
          const end = point(item, innerWidth / 2, rowAt);
          parts.push(`<line class="assembly-window-divider" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" />`);
        }
        const center = point(item, 0, 0);
        parts.push(`<text class="assembly-window-label" x="${center.x}" y="${center.y}">${escapeHtml(`${win.mark}${item.dock === "root" ? " · 根窗" : ""}`)}</text>`);
        parts.push("</g>");
      });

      const bounds = assemblyBounds(layout);
      parts.push(dimensionLine(margin, view.h - 42, view.w - margin, view.h - 42, `${Math.round(bounds.widthMm)} mm`));
      parts.push(dimensionLine(view.w - 42, margin, view.w - 42, view.h - margin, `${Math.round(bounds.heightMm)} mm`, true));
      if (bounds.depthMm > 0.5) parts.push(`<text class="sill-height-label" x="${margin}" y="${view.h - 18}">空间进深 ${Math.round(bounds.depthMm)} mm</text>`);
      svg.innerHTML = parts.join("");

      const selectGroup = group => {
        selectedWindowId = group.dataset.windowId;
        selectedPlacementId = group.dataset.placementId || "";
        selectedMemberId = "";
        selectedJointId = "";
        switchInspector("assembly");
        render();
      };
      svg.querySelectorAll(".assembly-window").forEach(group => {
        group.addEventListener("click", event => {
          event.stopPropagation();
          selectGroup(group);
        });
        group.addEventListener("contextmenu", event => {
          event.preventDefault();
          event.stopPropagation();
          selectGroup(group);
          showAssemblyContextMenu(event, group.dataset.windowId, group.dataset.placementId || "");
        });
        group.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") selectGroup(group);
        });
      });
      const summary = assemblySummary(assembly, project.windows);
      document.getElementById("drawingTitle").textContent = `${assembly.name} · 组合总图`;
      document.getElementById("drawingStats").textContent = `室外立面 · ${summary.windowIds.length}樘 · ${summary.overallWidthMm}×${summary.overallHeightMm}×${summary.overallDepthMm} mm`;
    }

    function renderTopologyMembers(win, rects, face, fillColor, outlineColor) {
      if (!win.topology?.members?.length) return "";
      return win.topology.members.map((member, index) => {
        const host = rects.find(item => item.cell.cellId === member.hostRegionId);
        if (!host) return "";
        const selected = member.memberId === selectedMemberId;
        const thickness = Math.max(7, face * 0.82);
        let x;
        let y;
        let width;
        let height;
        if (member.orientation === "horizontal") {
          x = host.x + host.w * member.span.startRatio;
          y = host.y + host.h * member.positionRatio - thickness / 2;
          width = host.w * (member.span.endRatio - member.span.startRatio);
          height = thickness;
        } else {
          x = host.x + host.w * member.positionRatio - thickness / 2;
          y = host.y + host.h * member.span.startRatio;
          width = thickness;
          height = host.h * (member.span.endRatio - member.span.startRatio);
        }
        const labelX = x + width / 2;
        const labelY = y + Math.min(height / 2, 14);
        return `
          <g class="topology-member ${selected ? "selected" : ""}" data-member-id="${escapeHtml(member.memberId)}" tabindex="0" role="button" aria-label="${member.orientation === "horizontal" ? "局部横梃" : "局部竖梃"}">
            <rect class="topology-member-hit" x="${x - 4}" y="${y - 4}" width="${Math.max(8, width + 8)}" height="${Math.max(8, height + 8)}" />
            <rect class="topology-member-profile" x="${x}" y="${y}" width="${Math.max(1, width)}" height="${Math.max(1, height)}" fill="${fillColor}" stroke="${outlineColor}" />
            <text class="topology-member-label" x="${labelX}" y="${labelY}">${memberLabel(member, index)}</text>
          </g>`;
      }).join("");
    }

    function renderEngineeringJoints(win, x, y, width, height) {
      const joints = project.joints.filter(joint => joint.hostWindowId === win.windowId);
      return joints.map(joint => {
        const globalIndex = project.joints.findIndex(item => item.jointId === joint.jointId);
        const midpoint = (joint.span.startRatio + joint.span.endRatio) / 2;
        let anchorX = x;
        let anchorY = y;
        let offsetX = 0;
        let offsetY = 0;
        if (joint.hostEdge === "right") {
          anchorX = x + width;
          anchorY = y + height * midpoint;
          offsetX = 17;
        } else if (joint.hostEdge === "left") {
          anchorX = x;
          anchorY = y + height * midpoint;
          offsetX = -17;
        } else if (joint.hostEdge === "top") {
          anchorX = x + width * midpoint;
          anchorY = y;
          offsetY = -17;
        } else {
          anchorX = x + width * midpoint;
          anchorY = y + height;
          offsetY = 17;
        }
        const markerX = anchorX + offsetX;
        const markerY = anchorY + offsetY;
        const selected = joint.jointId === selectedJointId;
        const radians = Number(joint.angleDeg || 90) * Math.PI / 180;
        const direction = joint.orientation === "reversed" ? -1 : 1;
        const guideX = markerX + Math.cos(radians) * 30 * direction;
        const guideY = markerY - Math.sin(radians) * 30;
        return `
          <g class="engineering-joint ${selected ? "selected" : ""}" data-joint-id="${escapeHtml(joint.jointId)}" tabindex="0" role="button" aria-label="${joint.type === "corner" ? "转角节点" : "拼接节点"}">
            <line class="engineering-joint-guide" x1="${anchorX}" y1="${anchorY}" x2="${markerX}" y2="${markerY}" />
            ${joint.type === "corner" ? `<path class="engineering-joint-guide" d="M${markerX} ${markerY} L${guideX} ${guideY}" />` : ""}
            <rect class="engineering-joint-hit" x="${markerX - 12}" y="${markerY - 12}" width="24" height="24" />
            <path class="engineering-joint-shape" d="M${markerX} ${markerY - 9} L${markerX + 9} ${markerY} L${markerX} ${markerY + 9} L${markerX - 9} ${markerY} Z" />
            <text class="engineering-joint-label" x="${markerX}" y="${markerY}">${jointLabel(joint, globalIndex)}</text>
          </g>`;
      }).join("");
    }

    function cellDrawingCode(type, index) {
      return isOperableType(type) ? `A${index + 1}` : `F${index + 1}`;
    }

    function handlePositionY(cell, item, scale) {
      const cellHeightMm = Math.max(1, item.h / Math.max(scale, 0.0001));
      const handleHeightMm = Math.min(cellHeightMm, Math.max(0, Number(cell.handleHeightMm ?? 750)));
      return item.y + item.h - handleHeightMm * scale;
    }

    function openSashElevation(cell, item, outlineColor, frameColor, scale) {
      const inset = Math.max(7, Math.min(item.w, item.h) * 0.1);
      const leftHinged = cell.opening?.startsWith("left");
      const outward = cell.opening?.endsWith("out");
      const hingeX = leftHinged ? item.x + inset : item.x + item.w - inset;
      const span = Math.max(12, item.w - inset * 2);
      const freeX = hingeX + (leftHinged ? 1 : -1) * span * 0.52;
      const top = item.y + inset;
      const bottom = item.y + item.h - inset;
      const perspective = (outward ? -1 : 1) * Math.min(8, item.h * 0.035);
      const handleY = handlePositionY(cell, item, scale);
      const glassFill = cell.type === "door" ? "rgba(185,122,66,0.32)" : "rgba(188,228,246,0.48)";
      return `
        <g class="open-sash-elevation">
          <path d="M${hingeX} ${top} L${freeX} ${top + perspective} L${freeX} ${bottom - perspective} L${hingeX} ${bottom} Z"
            fill="${glassFill}" stroke="${outlineColor}" stroke-width="${Math.max(4, Math.min(7, inset * 0.42))}" />
          <line x1="${hingeX}" y1="${top}" x2="${hingeX}" y2="${bottom}" stroke="${frameColor}" stroke-width="3" />
          <line x1="${freeX}" y1="${handleY - 9}" x2="${freeX}" y2="${handleY + 9}" stroke="#8a5a00" stroke-width="4" stroke-linecap="round" />
        </g>
      `;
    }

    function openCellElevation(cell, item, outlineColor, frameColor, scale) {
      if (["turn", "turn_tilt", "door"].includes(cell.type)) {
        if (cell.openingAssembly?.panelCount > 1) {
          return doubleSideHungElevation(cell, item, outlineColor, frameColor, scale);
        }
        return openSashElevation(cell, item, outlineColor, frameColor, scale);
      }
      if (cell.type === "top_hung" || cell.type === "bottom_hung") {
        return hungSashElevation(cell, item, outlineColor, frameColor);
      }
      if (["sliding", "lift_slide", "psk", "parallel_slide", "pocket_slide"].includes(cell.type)) {
        return slidingSashElevation(cell, item, outlineColor, frameColor);
      }
      if (cell.type === "parallel_project") {
        return parallelProjectElevation(cell, item, outlineColor, frameColor);
      }
      if (cell.type === "corner_slide") {
        return cornerSlidingElevation(cell, item, outlineColor, frameColor);
      }
      if (cell.type === "vertical_slide") {
        return verticalSashElevation(cell, item, outlineColor, frameColor);
      }
      if (cell.type === "folding") {
        return foldingSashElevation(cell, item, outlineColor, frameColor);
      }
      return openingSymbol(cell, item, Math.min(item.w, item.h) * 0.12);
    }

    function doubleSideHungElevation(cell, item, outlineColor, frameColor, scale) {
      const assembly = normalizeOpeningAssembly(cell.type, cell.opening, cell.openingAssembly);
      const gap = assembly.mullionMode === "flying_mullion" ? 1 : Math.max(4, item.w * 0.025);
      const panelWidth = (item.w - gap) / 2;
      return assembly.panels.slice(0, 2).map((panel, index) => {
        const panelItem = {
          ...item,
          x: item.x + index * (panelWidth + gap),
          w: panelWidth
        };
        const panelCell = {
          ...cell,
          opening: `${panel.hingeSide}_${assembly.openPlane}`,
          openingAssembly: { ...assembly, panelCount: 1 }
        };
        const role = panel.role === "primary" ? "主" : (panel.role === "secondary" ? "从" : "固");
        const elevation = panel.movable
          ? openSashElevation(panelCell, panelItem, outlineColor, frameColor, scale)
          : `<rect x="${panelItem.x + 7}" y="${panelItem.y + 7}" width="${Math.max(4, panelItem.w - 14)}" height="${Math.max(4, panelItem.h - 14)}" fill="rgba(188,228,246,0.30)" stroke="${frameColor}" stroke-width="4" />`;
        return `${elevation}<text class="assembly-role" x="${panelItem.x + panelItem.w / 2}" y="${panelItem.y + 22}">${role}</text>`;
      }).join("");
    }

    function integratedScreenDecoration(cell, item, stroke) {
      const mode = cell.openingAssembly?.screenMode && cell.openingAssembly.screenMode !== "none"
        ? cell.openingAssembly.screenMode
        : normalizeCellAccessories(cell.accessories).screenMode;
      if (!mode || mode === "none") return "";
      const inset = Math.max(8, Math.min(item.w, item.h) * 0.08);
      const left = item.x + inset;
      const right = item.x + item.w - inset;
      const top = item.y + inset;
      const bottom = item.y + item.h - inset;
      const lines = [`<g class="integrated-screen" opacity="0.58">`];
      if (mode === "retractable") {
        lines.push(`<rect x="${left}" y="${top}" width="${Math.min(10, item.w * 0.06)}" height="${bottom - top}" fill="#8aa7a2" />`);
      }
      for (let index = 1; index < 5; index += 1) {
        const x = left + (right - left) * index / 5;
        const y = top + (bottom - top) * index / 5;
        lines.push(`<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="${stroke}" stroke-width="0.7" />`);
        lines.push(`<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="${stroke}" stroke-width="0.7" />`);
      }
      lines.push(`</g>`);
      return lines.join("");
    }

    function hungSashElevation(cell, item, outlineColor, frameColor) {
      const inset = Math.max(7, Math.min(item.w, item.h) * 0.1);
      const topHinged = cell.type === "top_hung";
      const hingeY = topHinged ? item.y + inset : item.y + item.h - inset;
      const freeY = hingeY + (topHinged ? 1 : -1) * Math.max(14, (item.h - inset * 2) * 0.58);
      const left = item.x + inset;
      const right = item.x + item.w - inset;
      const taper = Math.min((right - left) * 0.12, 12);
      return `
        <g class="open-sash-elevation">
          <path d="M${left} ${hingeY} L${right} ${hingeY} L${right - taper} ${freeY} L${left + taper} ${freeY} Z"
            fill="rgba(188,228,246,0.48)" stroke="${outlineColor}" stroke-width="5" />
          <line x1="${left}" y1="${hingeY}" x2="${right}" y2="${hingeY}" stroke="${frameColor}" stroke-width="3" />
          <line x1="${item.x + item.w / 2 - 10}" y1="${freeY}" x2="${item.x + item.w / 2 + 10}" y2="${freeY}" stroke="#8a5a00" stroke-width="4" stroke-linecap="round" />
        </g>
      `;
    }

    function slidingSashElevation(cell, item, outlineColor, frameColor) {
      const assembly = normalizeOpeningAssembly(cell.type, cell.opening, cell.openingAssembly);
      const inset = Math.max(7, Math.min(item.w, item.h) * 0.1);
      const sashW = Math.max(12, (item.w - inset * 2) / assembly.panelCount * 1.06);
      const sashH = Math.max(18, item.h - inset * 2);
      const lift = cell.type === "lift_slide" ? -Math.min(8, item.h * 0.05) : 0;
      const parallelOffset = ["psk", "parallel_slide"].includes(cell.type) ? Math.min(7, item.h * 0.04) : 0;
      const arrowY = item.y + item.h / 2;
      const rightward = assembly.stackSide === "right";
      const arrowStart = rightward ? item.x + item.w * 0.38 : item.x + item.w * 0.62;
      const arrowEnd = rightward ? item.x + item.w * 0.72 : item.x + item.w * 0.28;
      const panels = assembly.panels.map((panel, index) => {
        const x = item.x + inset + index * (item.w - inset * 2) / assembly.panelCount;
        const activeClass = panel.movable ? " active-panel" : "";
        const panelY = item.y + inset + (panel.movable ? lift : 0);
        const offset = panel.movable ? parallelOffset : 0;
        return `${offset ? `<line x1="${x}" y1="${panelY}" x2="${x + offset}" y2="${panelY - offset}" stroke="#788b94" stroke-width="1.5" />` : ""}<rect class="${activeClass}" x="${x + offset}" y="${panelY - offset}" width="${sashW}" height="${sashH}" fill="rgba(188,228,246,${panel.movable ? 0.52 : 0.3})" stroke="${panel.movable ? outlineColor : frameColor}" stroke-width="${panel.movable ? 4 : 3}" />`;
      }).join("");
      const pocketSides = assembly.stackSide === "both" ? ["left", "right"] : [assembly.stackSide];
      const pocket = cell.type === "pocket_slide"
        ? pocketSides.map(side => `<rect x="${side === "right" ? item.x + item.w * 0.72 : item.x}" y="${item.y}" width="${item.w * 0.28}" height="${item.h}" fill="rgba(126,135,146,0.18)" stroke="#7e8792" stroke-width="2" stroke-dasharray="6 4" />`).join("")
        : "";
      const tiltMark = cell.type === "psk"
        ? `<path d="M${item.x + inset} ${item.y + item.h - inset} L${item.x + item.w / 2} ${item.y + inset} L${item.x + item.w - inset} ${item.y + item.h - inset}" fill="none" stroke="#20383e" stroke-width="1.5" stroke-dasharray="6 4" />`
        : "";
      const slideArrow = assembly.stackSide === "both"
        ? `<path d="M${item.x + item.w / 2 - 6} ${arrowY} H${item.x + inset + 14} m10 -8 l-10 8 10 8 M${item.x + item.w / 2 + 6} ${arrowY} H${item.x + item.w - inset - 14} m-10 -8 l10 8 -10 8" fill="none" stroke="${outlineColor}" stroke-width="2" />`
        : `<path d="M${arrowStart} ${arrowY}${cell.type === "lift_slide" ? `v-10` : ""} L${arrowEnd} ${arrowY - (cell.type === "lift_slide" ? 10 : 0)} m${rightward ? -10 : 10} -8 l${rightward ? 10 : -10} 8 ${rightward ? -10 : 10} 8" fill="none" stroke="${outlineColor}" stroke-width="2" />`;
      return `
        <g class="open-sash-elevation">
          ${pocket}
          ${panels}
          ${tiltMark}
          ${slideArrow}
        </g>
      `;
    }

    function parallelProjectElevation(cell, item, outlineColor, frameColor) {
      const inset = Math.max(8, Math.min(item.w, item.h) * 0.1);
      const offset = Math.min(12, Math.max(6, inset * 0.55));
      const x = item.x + inset;
      const y = item.y + inset;
      const width = item.w - inset * 2;
      const height = item.h - inset * 2;
      return `
        <g class="open-sash-elevation">
          <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="rgba(188,228,246,0.22)" stroke="${frameColor}" stroke-width="3" />
          <rect x="${x + offset}" y="${y - offset}" width="${width}" height="${height}" fill="rgba(188,228,246,0.5)" stroke="${outlineColor}" stroke-width="5" />
          <path d="M${x} ${y} L${x + offset} ${y - offset} M${x + width} ${y} L${x + width + offset} ${y - offset} M${x} ${y + height} L${x + offset} ${y + height - offset} M${x + width} ${y + height} L${x + width + offset} ${y + height - offset}" stroke="#7b8e96" stroke-width="2" />
        </g>
      `;
    }

    function cornerSlidingElevation(cell, item, outlineColor, frameColor) {
      const assembly = normalizeOpeningAssembly(cell.type, cell.opening, cell.openingAssembly);
      const inset = Math.max(8, Math.min(item.w, item.h) * 0.1);
      const centerX = item.x + item.w / 2;
      const top = item.y + inset;
      const bottom = item.y + item.h - inset;
      const gap = assembly.cornerPostMode === "postless" ? 2 : Math.max(6, item.w * 0.025);
      const arrows = assembly.stackSide === "left"
        ? `M${centerX} ${item.y + item.h / 2} H${item.x + inset + 14} m10 -8 l-10 8 10 8`
        : (assembly.stackSide === "right"
          ? `M${centerX} ${item.y + item.h / 2} H${item.x + item.w - inset - 14} m-10 -8 l10 8 -10 8`
          : `M${centerX - 6} ${item.y + item.h / 2} H${item.x + inset + 14} m10 -8 l-10 8 10 8 M${centerX + 6} ${item.y + item.h / 2} H${item.x + item.w - inset - 14} m-10 -8 l10 8 -10 8`);
      return `
        <g class="open-sash-elevation">
          <rect x="${item.x + inset}" y="${top}" width="${Math.max(4, centerX - gap / 2 - item.x - inset)}" height="${bottom - top}" fill="rgba(188,228,246,0.46)" stroke="${outlineColor}" stroke-width="4" />
          <rect x="${centerX + gap / 2}" y="${top}" width="${Math.max(4, item.x + item.w - inset - centerX - gap / 2)}" height="${bottom - top}" fill="rgba(188,228,246,0.46)" stroke="${outlineColor}" stroke-width="4" />
          ${assembly.cornerPostMode === "post" ? `<rect x="${centerX - gap / 2}" y="${top}" width="${gap}" height="${bottom - top}" fill="${frameColor}" />` : ""}
          <path d="${arrows}" fill="none" stroke="${outlineColor}" stroke-width="2" />
        </g>
      `;
    }

    function verticalSashElevation(cell, item, outlineColor, frameColor) {
      const assembly = normalizeOpeningAssembly(cell.type, cell.opening, cell.openingAssembly);
      const inset = Math.max(7, Math.min(item.w, item.h) * 0.1);
      const sashW = item.w - inset * 2;
      const sashH = Math.max(18, (item.h - inset * 2) * 0.56);
      const upward = assembly.stackSide !== "bottom";
      const movingY = upward ? item.y + item.h - inset - sashH : item.y + inset;
      const staticY = upward ? item.y + inset : item.y + item.h - inset - sashH;
      const centerX = item.x + item.w / 2;
      const arrowStart = upward ? item.y + item.h * 0.68 : item.y + item.h * 0.32;
      const arrowEnd = upward ? item.y + item.h * 0.34 : item.y + item.h * 0.66;
      return `
        <g class="open-sash-elevation">
          <rect x="${item.x + inset}" y="${staticY}" width="${sashW}" height="${sashH}" fill="rgba(188,228,246,${assembly.activePanelCount > 1 ? 0.48 : 0.3})" stroke="${assembly.activePanelCount > 1 ? outlineColor : frameColor}" stroke-width="4" />
          <rect x="${item.x + inset}" y="${movingY}" width="${sashW}" height="${sashH}" fill="rgba(188,228,246,0.52)" stroke="${outlineColor}" stroke-width="5" />
          <path d="M${centerX} ${arrowStart} V${arrowEnd} m-8 ${upward ? 10 : -10} l8 ${upward ? -10 : 10} 8 ${upward ? 10 : -10}" fill="none" stroke="${outlineColor}" stroke-width="2" />
        </g>
      `;
    }

    function foldingSashElevation(cell, item, outlineColor, frameColor) {
      const assembly = normalizeOpeningAssembly(cell.type, cell.opening, cell.openingAssembly);
      const inset = Math.max(7, Math.min(item.w, item.h) * 0.1);
      const leftward = assembly.stackSide !== "right";
      const panelW = Math.max(6, (item.w - inset * 2) / assembly.panelCount);
      const points = [];
      for (let index = 0; index <= assembly.panelCount; index += 1) {
        const logical = leftward ? index : assembly.panelCount - index;
        const x = item.x + inset + logical * panelW;
        const y = item.y + item.h / 2 + (index % 2 === 0 ? -10 : 10);
        points.push(`${x},${y}`);
      }
      return `
        <g class="open-sash-elevation">
          <rect x="${item.x + inset}" y="${item.y + inset}" width="${item.w - inset * 2}" height="${item.h - inset * 2}" fill="rgba(188,228,246,0.32)" stroke="${frameColor}" stroke-width="3" />
          <polyline points="${points.join(" ")}" fill="none" stroke="${outlineColor}" stroke-width="6" stroke-linejoin="round" />
          <path d="M${leftward ? item.x + item.w * 0.62 : item.x + item.w * 0.38} ${item.y + item.h * 0.72} H${leftward ? item.x + item.w * 0.26 : item.x + item.w * 0.74}" fill="none" stroke="${outlineColor}" stroke-width="2" />
        </g>
      `;
    }

    function handleHeightDimension(cell, item, scale) {
      const value = Math.max(0, Number(cell.handleHeightMm ?? 750));
      const handleY = handlePositionY(cell, item, scale);
      const leftHinged = cell.opening?.startsWith("left");
      const lineX = leftHinged ? item.x + item.w - 13 : item.x + 13;
      return dimensionLine(lineX, handleY, lineX, item.y + item.h, `${Math.round(value)}`, true);
    }

    function renderPlanView(win, rects, x, planY, drawW, outlineColor, frameColor, options) {
      const cornerMount = resolvePlanCornerMount(win, rects, x, planY, drawW);
      const section = planInstallationSection(win, drawW);
      const extents = estimatePlanProjectionExtents(win, rects, x, drawW);
      const parts = [
        `<g class="plan-view">`,
        `<text class="plan-side outside" x="${x - 58}" y="${planY - 46}">室外</text>`,
        `<text class="plan-side inside" x="${x - 58}" y="${planY + 64}">室内</text>`,
        renderPlanWallBase(x, planY, drawW, outlineColor, frameColor, cornerMount, section)
      ];
      for (const item of rects) {
        parts.push(renderPlanCellTracks(item, planY, outlineColor, frameColor, cornerMount));
        const projections = buildPlanOpeningParts(item.cell, item, planY, section.wallThicknessPx, cornerMount);
        projections.forEach(entry => {
          if (entry.kind === "folding") {
            parts.push(renderPlanFoldingProjection(entry.part, options.showOpenState ? 1 : 0, planY));
          } else {
            parts.push(renderPlanPanelProjection(entry.part, options.showOpenState ? 1 : 0, planY, entry.overhead));
          }
        });
      }
      if (options.showDimensions) {
        const dimensionY = planY + Math.max(110, extents.inside + 54);
        parts.push(dimensionLine(x, dimensionY, x + drawW, dimensionY, `${Math.round(win.widthMm)} mm`));
      }
      parts.push(`</g>`);
      return parts.join("");
    }

    function planWallThickness(win, drawW) {
      return Math.max(16, Math.min(34, normalizeSurround(win.installation?.surround).wallThicknessMm * drawW / Math.max(1, win.widthMm)));
    }

    function planInstallationSection(win, drawW) {
      const series = currentSeries(win);
      const frameDepthMm = Number(series?.frameDepthMm || series?.faceWidthMm || 70);
      const raw = resolveInstallationSection(win.installation?.surround, frameDepthMm);
      const wallThicknessPx = planWallThickness(win, drawW);
      const pxPerMm = wallThicknessPx / Math.max(1, raw.wallThicknessMm);
      const convert = value => value * pxPerMm;
      return {
        ...raw,
        wallThicknessPx,
        pxPerMm,
        wallCenterPx: convert(raw.wallCenterMm),
        wallOutsidePx: convert(raw.wallOutsideFaceMm),
        wallInsidePx: convert(raw.wallInsideFaceMm),
        frameOutsidePx: convert(raw.frameOutsideFaceMm),
        frameInsidePx: convert(raw.frameInsideFaceMm),
        frameDepthPx: Math.max(10, raw.frameDepthMm * pxPerMm),
        frameProjectsOutsidePx: Math.max(0, convert(raw.frameProjectsOutsideMm)),
        frameProjectsInsidePx: Math.max(0, convert(raw.frameProjectsInsideMm))
      };
    }

    function estimatePlanProjectionExtents(win, rects, x, drawW) {
      const section = planInstallationSection(win, drawW);
      const wallThicknessPx = section.wallThicknessPx;
      const cornerMount = resolvePlanCornerMount(win, rects, x, 0, drawW);
      let outside = Math.max(section.wallOutsidePx, section.frameOutsidePx);
      let inside = Math.max(-section.wallInsidePx, -section.frameInsidePx);
      rects.forEach(item => {
        buildPlanOpeningParts(item.cell, item, 0, wallThicknessPx, cornerMount).forEach(entry => {
          const sets = entry.kind === "folding"
            ? [foldingPlanProjections(entry.part, 0).panels, foldingPlanProjections(entry.part, 1).panels]
            : [[openingPlanProjection(entry.part, 0)], [openingPlanProjection(entry.part, 1)]];
          sets.flat().forEach(projection => {
            projection.corners.forEach(point => {
              outside = Math.max(outside, point.z);
              inside = Math.max(inside, -point.z);
            });
          });
        });
      });
      return { outside, inside };
    }

    function buildPlanOpeningParts(cell, item, planY, wallThicknessPx, cornerMount) {
      if (!isOperableType(cell.type)) return [];
      const assembly = normalizeOpeningAssembly(cell.type, cell.opening, cell.openingAssembly);
      const sashDepth = Math.max(4, wallThicknessPx * 0.2);
      const centerX = item.x + item.w / 2;
      const entries = [];
      if (["turn", "turn_tilt", "door"].includes(cell.type)) {
        const totalWidth = item.w * 0.9;
        const gap = assembly.panelCount > 1 && assembly.mullionMode === "fixed_mullion" ? Math.max(3, item.w * 0.018) : 1;
        const panelWidth = (totalWidth - gap * (assembly.panelCount - 1)) / assembly.panelCount;
        assembly.panels.forEach((panel, index) => {
          if (!panel.movable) return;
          const x = centerX - totalWidth / 2 + panelWidth / 2 + index * (panelWidth + gap);
          entries.push({
            kind: "panel",
            part: {
              type: cell.type,
              cell: { ...cell, opening: `${panel.hingeSide}_${assembly.openPlane}` },
              label: panel.label,
              width: panelWidth,
              height: item.h * 0.9,
              depth: sashDepth,
              closedPosition: { x, y: 0, z: 0 },
              motionMode: cell.type === "turn_tilt" && assembly.operationPriority === "tilt_first" ? "tilt" : "primary"
            }
          });
        });
        return entries;
      }

      if (cell.type === "top_hung" || cell.type === "bottom_hung") {
        return [{
          kind: "panel",
          overhead: true,
          part: {
            type: cell.type,
            cell,
            label: assembly.panels[0]?.label || "开启扇",
            width: item.w * 0.9,
            height: item.h * 0.9,
            depth: sashDepth,
            closedPosition: { x: centerX, y: 0, z: 0 }
          }
        }];
      }

      if (["sliding", "lift_slide", "psk", "parallel_slide", "pocket_slide", "vertical_slide"].includes(cell.type)) {
        const totalWidth = item.w * 0.92;
        const panelWidth = cell.type === "vertical_slide" ? item.w * 0.86 : totalWidth / assembly.panelCount * 1.06;
        const panelHeight = cell.type === "vertical_slide" ? item.h * 0.56 : item.h * 0.86;
        const trackGap = Math.max(6, wallThicknessPx * 0.24);
        assembly.panels.forEach((panel, index) => {
          if (!panel.movable) return;
          const x = cell.type === "vertical_slide"
            ? centerX
            : centerX - totalWidth / 2 + totalWidth * (index + 0.5) / assembly.panelCount;
          const direction = assembly.stackSide === "both"
            ? (index < assembly.panelCount / 2 ? -1 : 1)
            : (["right", "top"].includes(assembly.stackSide) ? 1 : -1);
          const panelStep = totalWidth / assembly.panelCount;
          const travelPanels = assembly.stackSide === "left"
            ? Math.max(1, index)
            : (assembly.stackSide === "right"
              ? Math.max(1, assembly.panelCount - 1 - index)
              : (index < assembly.panelCount / 2
                ? Math.max(1, index)
                : Math.max(1, assembly.panelCount - 1 - index)));
          entries.push({
            kind: "panel",
            part: {
              type: cell.type,
              cell,
              label: panel.label,
              width: panelWidth,
              height: panelHeight,
              depth: sashDepth,
              direction,
              travel: cell.type === "vertical_slide" ? item.h * 0.38 : panelStep * travelPanels * 0.96,
              liftHeight: cell.type === "lift_slide" ? item.h * 0.035 : 0,
              releaseDepth: ["psk", "parallel_slide"].includes(cell.type) ? Math.max(18, wallThicknessPx * 0.82) : 0,
              openPlane: assembly.openPlane,
              closedPosition: { x, y: 0, z: (panel.trackIndex - (assembly.trackCount - 1) / 2) * trackGap },
              motionMode: cell.type === "psk" && assembly.operationPriority === "tilt_first" ? "tilt" : "primary"
            }
          });
        });
        return entries;
      }

      if (cell.type === "parallel_project") {
        return [{
          kind: "panel",
          part: {
            type: cell.type,
            cell,
            label: assembly.panels[0]?.label || "平行推出扇",
            width: item.w * 0.96,
            height: item.h * 0.94,
            depth: sashDepth,
            projectDepth: Math.max(34, wallThicknessPx * 3.2),
            closedPosition: { x: centerX, y: 0, z: 0 }
          }
        }];
      }

      if (cell.type === "corner_slide") {
        const radians = assembly.cornerAngleDeg * Math.PI / 180;
        const mount = cornerMount?.item === item
          ? cornerMount
          : {
              anchorX: item.x + item.w,
              returnOpeningStartX: item.x + item.w,
              returnOpeningStartY: planY,
              radians,
              returnSpan: Math.max(35, item.w)
            };
        const leftCount = Math.ceil(assembly.panelCount / 2);
        const rightCount = assembly.panelCount - leftCount;
        const frontSpan = Math.max(20, mount.anchorX - item.x);
        const returnSpan = Math.max(20, mount.returnSpan || frontSpan);
        const trackGap = Math.max(6, wallThicknessPx * 0.24);
        const returnOriginZ = planY - mount.returnOpeningStartY;
        assembly.panels.forEach((panel, index) => {
          if (!panel.movable) return;
          const rightWing = index >= leftCount;
          const wingCount = rightWing ? rightCount : leftCount;
          const wingIndex = rightWing ? index - leftCount : leftCount - index - 1;
          const wingSpan = rightWing ? returnSpan : frontSpan;
          const panelWidth = wingSpan / Math.max(1, wingCount) * 1.04;
          const distance = (wingIndex + 0.5) * wingSpan / Math.max(1, wingCount);
          const trackOffset = (panel.trackIndex - (assembly.trackCount - 1) / 2) * trackGap;
          const travel = panelWidth * Math.max(1, wingIndex + 1) * 0.92;
          const vectors = cornerSlidingMotionVectors(assembly.cornerAngleDeg, rightWing, travel, 0);
          entries.push({
            kind: "panel",
            part: {
              type: cell.type,
              cell,
              label: `${rightWing ? "右翼" : "左翼"}${panel.label}`,
              width: panelWidth,
              height: item.h * 0.86,
              depth: sashDepth,
              travelVector: rightWing ? { x: vectors.travelVector.x, z: -vectors.travelVector.z } : vectors.travelVector,
              releaseVector: rightWing ? { x: vectors.releaseVector.x, z: -vectors.releaseVector.z } : vectors.releaseVector,
              closedPosition: rightWing
                ? {
                    x: mount.returnOpeningStartX + Math.cos(radians) * distance + Math.sin(radians) * trackOffset,
                    y: 0,
                    z: returnOriginZ + Math.sin(radians) * distance - Math.cos(radians) * trackOffset
                  }
                : { x: mount.anchorX - distance, y: 0, z: trackOffset },
              closedRotation: { x: 0, y: rightWing ? -radians : 0, z: 0 }
            }
          });
        });
        return entries;
      }

      if (cell.type === "folding") {
        const panelWidth = item.w * 0.9 / assembly.panelCount;
        const groups = assembly.stackSide === "both"
          ? [["left", Math.ceil(assembly.panelCount / 2)], ["right", Math.floor(assembly.panelCount / 2)]]
          : [[assembly.stackSide, assembly.panelCount]];
        groups.forEach(([side, panelCount], order) => {
          if (!panelCount) return;
          entries.push({
            kind: "folding",
            part: {
              type: cell.type,
              label: `${side === "right" ? "右" : "左"}侧折叠组`,
              panelCount,
              panelWidth,
              width: panelWidth * panelCount,
              height: item.h * 0.86,
              depth: sashDepth,
              direction: side === "right" ? -1 : 1,
              openPlane: assembly.openPlane,
              closedPosition: { x: centerX + (side === "right" ? 1 : -1) * item.w * 0.45, y: 0, z: 0 },
              operationOrder: order
            }
          });
        });
      }
      return entries;
    }

    function renderPlanPanelProjection(part, ratio, planY, overhead = false) {
      const closed = openingPlanProjection(part, 0);
      const opened = openingPlanProjection(part, ratio);
      const closedPoints = planProjectionPoints(closed.corners, planY);
      const openedPoints = planProjectionPoints(opened.corners, planY);
      const openedCenterY = planY - opened.position.z;
      const label = escapeHtml(part.label || "活动扇");
      if (ratio <= 0.001) {
        return `<g class="plan-opening-projection ${overhead ? "overhead" : ""}" data-plan-panel="${label}">
          <polygon class="plan-sash-current" points="${openedPoints}" />
          <title>${label} · 关闭位置</title>
        </g>`;
      }
      return `<g class="plan-opening-projection ${overhead ? "overhead" : ""}" data-plan-panel="${label}">
        <polygon class="plan-sash-closed" points="${closedPoints}" />
        ${renderPlanMotionGuide(closed.position, opened.position, planY, label)}
        <polygon class="plan-sash-current" points="${openedPoints}" />
        <text class="plan-panel-label" x="${opened.position.x}" y="${openedCenterY - 7}">${label}</text>
        <title>${label} · 当前开启投影</title>
      </g>`;
    }

    function renderPlanFoldingProjection(part, ratio, planY) {
      const closed = foldingPlanProjections(part, 0);
      const opened = foldingPlanProjections(part, ratio);
      const closedShapes = closed.panels.map(panel => `<polygon class="plan-sash-closed" points="${planProjectionPoints(panel.corners, planY)}" />`).join("");
      const openedShapes = opened.panels.map((panel, index) => {
        const points = planProjectionPoints(panel.corners, planY);
        return `<polygon class="plan-sash-current" points="${points}" data-fold-panel="${index + 1}" />`;
      }).join("");
      const endPanel = opened.panels.at(-1);
      const labelX = endPanel?.center.x ?? part.closedPosition.x;
      const labelY = planY - (endPanel?.center.z || 0) - 7;
      const label = escapeHtml(part.label || "折叠组");
      const guideStart = closed.panels[0]?.center || part.closedPosition;
      const guideEnd = endPanel?.center || part.closedPosition;
      return `<g class="plan-opening-projection folding" data-plan-panel="${label}">
        ${ratio > 0.001 ? closedShapes : ""}
        ${ratio > 0.001 ? renderPlanMotionGuide(guideStart, guideEnd, planY, label) : ""}
        ${openedShapes}
        ${ratio > 0.001 ? `<text class="plan-panel-label" x="${labelX}" y="${labelY}">${label}</text>` : ""}
        <title>${label} · ${opened.panels.length}扇投影</title>
      </g>`;
    }

    function renderPlanMotionGuide(start, end, planY, label) {
      const startX = start.x;
      const startY = planY - start.z;
      const endX = end.x;
      const endY = planY - end.z;
      if (Math.hypot(endX - startX, endY - startY) < 2) return "";
      return `<g class="plan-motion-guide">
        <path class="plan-motion-path" d="M${startX} ${startY} L${endX} ${endY}" marker-end="url(#planMotionArrow)" />
        <circle class="plan-motion-end" cx="${endX}" cy="${endY}" r="3.2" />
        <title>${label} · 开启轨迹</title>
      </g>`;
    }

    function planProjectionPoints(corners, planY) {
      return corners.map(point => `${point.x},${planY - point.z}`).join(" ");
    }

    function renderPlanCellTracks(item, planY, outlineColor, frameColor, cornerMount) {
      const cell = item.cell;
      const assembly = normalizeOpeningAssembly(cell.type, cell.opening, cell.openingAssembly);
      const parts = [];
      if (["sliding", "lift_slide", "psk", "parallel_slide", "pocket_slide", "vertical_slide"].includes(cell.type)) {
        for (let track = 0; track < assembly.trackCount; track += 1) {
          const offset = (track - (assembly.trackCount - 1) / 2) * 9;
          parts.push(`<line class="plan-track" x1="${item.x + 6}" y1="${planY - offset}" x2="${item.x + item.w - 6}" y2="${planY - offset}" stroke="${outlineColor}" />`);
        }
        if (cell.type === "pocket_slide") {
          const sides = assembly.stackSide === "both" ? ["left", "right"] : [assembly.stackSide];
          sides.forEach(side => {
            const pocketX = side === "right" ? item.x + item.w - 28 : item.x;
            parts.push(`<rect class="plan-pocket" x="${pocketX}" y="${planY - 22}" width="28" height="44" />`);
          });
        }
      }
      if (cell.type === "corner_slide") {
        const radians = assembly.cornerAngleDeg * Math.PI / 180;
        const mount = cornerMount?.item === item
          ? cornerMount
          : {
              anchorX: item.x + item.w,
              wallCornerX: item.x + item.w,
              wallCornerY: planY,
              returnOpeningStartX: item.x + item.w,
              returnOpeningStartY: planY,
              endX: item.x + item.w + Math.cos(radians) * Math.max(35, item.w),
              endY: planY - Math.sin(radians) * Math.max(35, item.w),
              radians,
              wallCornerMode: "open_corner"
            };
        for (let track = 0; track < assembly.trackCount; track += 1) {
          const offset = (track - (assembly.trackCount - 1) / 2) * 7;
          const sideStartX = mount.returnOpeningStartX + Math.sin(mount.radians) * offset;
          const sideStartY = mount.returnOpeningStartY + Math.cos(mount.radians) * offset;
          const sideEndX = mount.endX + Math.sin(mount.radians) * offset;
          const sideEndY = mount.endY + Math.cos(mount.radians) * offset;
          parts.push(`<path class="plan-track" d="M${item.x + 6} ${planY - offset} H${mount.anchorX} M${sideStartX} ${sideStartY} L${sideEndX} ${sideEndY}" stroke="${outlineColor}" />`);
        }
        if (assembly.cornerPostMode === "post" && mount.wallCornerMode !== "structural_pier") {
          parts.push(`<circle cx="${mount.anchorX}" cy="${planY}" r="5" fill="${frameColor}" stroke="${outlineColor}" />`);
        }
      }
      return parts.join("");
    }

    function resolvePlanCornerMount(win, rects, x, planY, drawW) {
      const maxCol = Math.max(-1, ...rects.map(item => item.col));
      const item = rects.find(candidate => candidate.col === maxCol && candidate.row === 0 && candidate.cell?.type === "corner_slide");
      if (!item) return null;
      const assembly = normalizeOpeningAssembly(item.cell.type, item.cell.opening, item.cell.openingAssembly);
      const surround = normalizeSurround(win.installation?.surround);
      const radians = assembly.cornerAngleDeg * Math.PI / 180;
      const anchorX = item.x + item.w;
      const returnSpan = Math.max(34, item.w);
      const cornerPierWidthPx = Math.max(12, Math.min(80, surround.cornerPierWidthMm * drawW / Math.max(1, win.widthMm)));
      const structuralPier = surround.wallCornerMode === "structural_pier";
      const wallCornerX = anchorX + (structuralPier ? cornerPierWidthPx : 0);
      const returnOpeningOffset = structuralPier ? cornerPierWidthPx : 0;
      const returnOpeningStartX = wallCornerX + Math.cos(radians) * returnOpeningOffset;
      const returnOpeningStartY = planY - Math.sin(radians) * returnOpeningOffset;
      return {
        item,
        anchorX,
        wallCornerX,
        wallCornerY: planY,
        returnOpeningStartX,
        returnOpeningStartY,
        endX: returnOpeningStartX + Math.cos(radians) * returnSpan,
        endY: returnOpeningStartY - Math.sin(radians) * returnSpan,
        radians,
        returnSpan,
        wallCornerMode: surround.wallCornerMode,
        cornerPierWidthPx
      };
    }

    function renderPlanWallBase(x, planY, drawW, outlineColor, frameColor, cornerMount, section) {
      const wallThicknessPx = section.wallThicknessPx;
      const wallTopY = planY - section.wallOutsidePx;
      const wallBottomY = planY - section.wallInsidePx;
      const frameTopY = planY - section.frameOutsidePx;
      const frameBottomY = planY - section.frameInsidePx;
      const frameHeight = Math.max(8, frameBottomY - frameTopY);
      const frameOverhang = section.frameProjectsOutsidePx > 0.5 || section.frameProjectsInsidePx > 0.5;
      if (!cornerMount) {
        return `
          <rect class="plan-wall-band" x="${x}" y="${wallTopY}" width="${drawW}" height="${Math.max(1, wallBottomY - wallTopY)}" />
          <rect class="plan-frame-band" x="${x}" y="${frameTopY}" width="${drawW}" height="${frameHeight}" />
          <line class="plan-wall-center" x1="${x}" y1="${planY - section.wallCenterPx}" x2="${x + drawW}" y2="${planY - section.wallCenterPx}" />
          ${frameOverhang ? `<rect class="plan-frame-overhang" x="${x}" y="${frameTopY}" width="${drawW}" height="${frameHeight}" />` : ""}
          <path class="plan-wall-outline" d="M${x} ${wallTopY}H${x + drawW}M${x} ${wallBottomY}H${x + drawW}" />
          <path class="plan-frame-outline" d="M${x} ${frameTopY}H${x + drawW}M${x} ${frameBottomY}H${x + drawW}" />`;
      }
      const wallCenterY = planY - section.wallCenterPx;
      const normalX = Math.sin(cornerMount.radians);
      const normalY = Math.cos(cornerMount.radians);
      const returnWallStart = { x: cornerMount.wallCornerX, y: wallCenterY };
      const returnWallEnd = { x: cornerMount.endX, y: cornerMount.endY - section.wallCenterPx };
      const mainWall = rectPolygon(x, wallTopY, cornerMount.wallCornerX - x, wallBottomY - wallTopY);
      const returnWall = bandPolygon(returnWallStart, returnWallEnd, { x: normalX, y: normalY }, wallThicknessPx);
      const mainFrame = rectPolygon(x, frameTopY, cornerMount.anchorX - x, frameHeight);
      const returnFrame = bandPolygon(
        { x: cornerMount.returnOpeningStartX, y: cornerMount.returnOpeningStartY },
        { x: cornerMount.endX, y: cornerMount.endY },
        { x: normalX, y: normalY },
        frameHeight
      );
      const cornerPier = renderPlanCornerWallPier(cornerMount, wallThicknessPx, outlineColor);
      return `
        <polygon class="plan-wall-band" points="${mainWall}" />
        <polygon class="plan-wall-band" points="${returnWall}" />
        <polygon class="plan-frame-band" points="${mainFrame}" />
        <polygon class="plan-frame-band" points="${returnFrame}" />
        <path class="plan-wall-center" d="M${x} ${wallCenterY}H${cornerMount.wallCornerX}M${returnWallStart.x} ${returnWallStart.y}L${returnWallEnd.x} ${returnWallEnd.y}" fill="none" />
        ${frameOverhang ? `<polygon class="plan-frame-overhang" points="${mainFrame}" /><polygon class="plan-frame-overhang" points="${returnFrame}" />` : ""}
        <polygon class="plan-wall-outline" points="${mainWall}" />
        <polygon class="plan-wall-outline" points="${returnWall}" />
        <polygon class="plan-frame-outline" points="${mainFrame}" />
        <polygon class="plan-frame-outline" points="${returnFrame}" />
        ${cornerPier}
        <text class="plan-side outside" x="${cornerMount.endX + normalX * 28}" y="${cornerMount.endY + normalY * 28}">外</text>
        <text class="plan-side inside" x="${cornerMount.endX - normalX * 28}" y="${cornerMount.endY - normalY * 28}">内</text>`;
    }

    function rectPolygon(x, y, width, height) {
      const right = x + Math.max(0, width);
      const bottom = y + Math.max(1, height);
      return [[x, y], [right, y], [right, bottom], [x, bottom]].map(point => point.join(",")).join(" ");
    }

    function bandPolygon(start, end, normal, thickness) {
      const half = Math.max(0.5, thickness / 2);
      return [
        [start.x + normal.x * half, start.y + normal.y * half],
        [end.x + normal.x * half, end.y + normal.y * half],
        [end.x - normal.x * half, end.y - normal.y * half],
        [start.x - normal.x * half, start.y - normal.y * half]
      ].map(point => point.join(",")).join(" ");
    }

    function renderPlanCornerWallPier(cornerMount, wallThicknessPx, outlineColor) {
      if (cornerMount.wallCornerMode !== "structural_pier") return "";
      const halfDepth = wallThicknessPx / 2;
      const length = cornerMount.cornerPierWidthPx;
      const normalX = Math.sin(cornerMount.radians);
      const normalY = Math.cos(cornerMount.radians);
      const returnPolygon = [
        [cornerMount.wallCornerX + normalX * halfDepth, cornerMount.wallCornerY + normalY * halfDepth],
        [cornerMount.wallCornerX - normalX * halfDepth, cornerMount.wallCornerY - normalY * halfDepth],
        [cornerMount.returnOpeningStartX - normalX * halfDepth, cornerMount.returnOpeningStartY - normalY * halfDepth],
        [cornerMount.returnOpeningStartX + normalX * halfDepth, cornerMount.returnOpeningStartY + normalY * halfDepth]
      ].map(point => point.join(",")).join(" ");
      return `
        <rect x="${cornerMount.anchorX}" y="${cornerMount.wallCornerY - halfDepth}" width="${length}" height="${wallThicknessPx}" fill="#c9d0d5" stroke="${outlineColor}" stroke-width="1.5" />
        <polygon points="${returnPolygon}" fill="#c9d0d5" stroke="${outlineColor}" stroke-width="1.5" />`;
    }

    function showCellContextMenu(event, row, col) {
      const menu = document.getElementById("cellContextMenu");
      const win = currentWindow();
      const cell = win?.layout.cells[cellIndex(row, col, win.layout.columns.length)];
      if (!menu || !cell) return;
      const title = document.getElementById("cellMenuTitle");
      if (title) title.textContent = `${col + 1}列${row + 1}行 · ${typeLabels[cell.type] || cell.type}`;
      menu.classList.remove("hidden");
      const left = Math.max(8, Math.min(event.clientX + 10, window.innerWidth - menu.offsetWidth - 8));
      const top = Math.max(8, Math.min(event.clientY + 10, window.innerHeight - menu.offsetHeight - 8));
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    }

    function hideCellContextMenu() {
      document.getElementById("cellContextMenu")?.classList.add("hidden");
    }

    function showMemberContextMenu(event, memberId) {
      const menu = document.getElementById("memberContextMenu");
      const win = currentWindow();
      const member = win?.topology?.members?.find(item => item.memberId === memberId);
      if (!menu || !member) return;
      selectedJointId = "";
      selectedMemberId = member.memberId;
      const index = win.topology.members.findIndex(item => item.memberId === member.memberId);
      const title = document.getElementById("memberMenuTitle");
      if (title) title.textContent = `${memberLabel(member, index)} · ${member.orientation === "horizontal" ? "局部横梃" : "局部竖梃"}`;
      menu.classList.remove("hidden");
      const left = Math.max(8, Math.min(event.clientX + 10, window.innerWidth - menu.offsetWidth - 8));
      const top = Math.max(8, Math.min(event.clientY + 10, window.innerHeight - menu.offsetHeight - 8));
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    }

    function hideMemberContextMenu() {
      document.getElementById("memberContextMenu")?.classList.add("hidden");
    }

    function showJointContextMenu(event, jointId) {
      const menu = document.getElementById("jointContextMenu");
      const joint = project.joints?.find(item => item.jointId === jointId);
      if (!menu || !joint) return;
      selectedMemberId = "";
      selectedJointId = joint.jointId;
      const index = project.joints.findIndex(item => item.jointId === joint.jointId);
      const title = document.getElementById("jointMenuTitle");
      if (title) title.textContent = `${jointLabel(joint, index)} · ${joint.type === "corner" ? "转角料" : "拼接料"}`;
      menu.classList.remove("hidden");
      const left = Math.max(8, Math.min(event.clientX + 10, window.innerWidth - menu.offsetWidth - 8));
      const top = Math.max(8, Math.min(event.clientY + 10, window.innerHeight - menu.offsetHeight - 8));
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    }

    function hideJointContextMenu() {
      document.getElementById("jointContextMenu")?.classList.add("hidden");
    }

    function showAssemblyContextMenu(event, windowId, placementId) {
      const menu = document.getElementById("assemblyContextMenu");
      const win = project.windows.find(item => item.windowId === windowId);
      if (!menu || !win) return;
      selectedWindowId = windowId;
      selectedPlacementId = placementId || "";
      const title = document.getElementById("assemblyMenuTitle");
      if (title) title.textContent = `${win.mark} · ${placementId ? "定位窗" : "根窗"}`;
      const remove = document.getElementById("btnAssemblyMenuRemove");
      if (remove) remove.disabled = !placementId;
      menu.classList.remove("hidden");
      const left = Math.max(8, Math.min(event.clientX + 10, window.innerWidth - menu.offsetWidth - 8));
      const top = Math.max(8, Math.min(event.clientY + 10, window.innerHeight - menu.offsetHeight - 8));
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    }

    function hideAssemblyContextMenu() {
      document.getElementById("assemblyContextMenu")?.classList.add("hidden");
    }

    function applyCellMenuType(type) {
      applyCellPreset(type);
      hideCellContextMenu();
    }

    function previewSelectedCell() {
      hideCellContextMenu();
      const key = `${selectedWindowId}:${selectedCell.row}:${selectedCell.col}:P1`;
      preview3d.selectedPartKey = key;
      preview3d.selectedPartKeys = new Set([key]);
      openPreviewDialog();
    }

    function frameShapePath(win, x, y, w, h, face) {
      const innerX = x + face;
      const innerY = y + face;
      const innerW = w - face * 2;
      const innerH = h - face * 2;
      const shapeType = normalizeWindowShape(win.shape).type;
      if (shapeType === "arched") {
        const rise = Math.min(h * 0.32, Math.max(face * 1.2, Number(win.shape.archHeightMm || 220) * (w / win.widthMm)));
        const outer = `M${x} ${y + rise} Q${x + w / 2} ${y - rise * 0.75} ${x + w} ${y + rise} L${x + w} ${y + h} L${x} ${y + h} Z`;
        const inner = `M${innerX} ${innerY + rise * 0.72} Q${x + w / 2} ${innerY - rise * 0.45} ${innerX + innerW} ${innerY + rise * 0.72} L${innerX + innerW} ${innerY + innerH} L${innerX} ${innerY + innerH} Z`;
        return `${outer} ${inner}`;
      }
      if (shapeType === "trapezoid") {
        const shift = Math.min(w * 0.18, 90);
        return polygonFramePath(
          [[x + shift, y], [x + w, y], [x + w - shift, y + h], [x, y + h]],
          [[innerX + shift * 0.75, innerY], [innerX + innerW, innerY], [innerX + innerW - shift * 0.75, innerY + innerH], [innerX, innerY + innerH]]
        );
      }
      if (shapeType === "trapezoid_left") {
        const shift = Math.min(w * 0.18, 90);
        return polygonFramePath(
          [[x, y], [x + w - shift, y], [x + w, y + h], [x + shift, y + h]],
          [[innerX, innerY], [innerX + innerW - shift * 0.75, innerY], [innerX + innerW, innerY + innerH], [innerX + shift * 0.75, innerY + innerH]]
        );
      }
      if (shapeType === "trapezoid_peak") {
        const peak = Math.min(h * 0.3, Math.max(face * 1.5, 110));
        return polygonFramePath(
          [[x, y + peak], [x + w * 0.5, y], [x + w, y + peak], [x + w, y + h], [x, y + h]],
          [[innerX, innerY + peak * 0.72], [x + w * 0.5, innerY], [innerX + innerW, innerY + peak * 0.72], [innerX + innerW, innerY + innerH], [innerX, innerY + innerH]]
        );
      }
      if (shapeType === "notch_top_left") {
        const notch = Math.min(w * 0.28, h * 0.32, 130);
        return polygonFramePath(
          [[x + notch, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y + notch]],
          [[innerX + notch * 0.72, innerY], [innerX + innerW, innerY], [innerX + innerW, innerY + innerH], [innerX, innerY + innerH], [innerX, innerY + notch * 0.72]]
        );
      }
      if (shapeType === "notch_top_right") {
        const notch = Math.min(w * 0.28, h * 0.32, 130);
        return polygonFramePath(
          [[x, y], [x + w - notch, y], [x + w, y + notch], [x + w, y + h], [x, y + h]],
          [[innerX, innerY], [innerX + innerW - notch * 0.72, innerY], [innerX + innerW, innerY + notch * 0.72], [innerX + innerW, innerY + innerH], [innerX, innerY + innerH]]
        );
      }
      if (shapeType === "custom_polygon") {
        const outer = normalizeShapePoints(win.shape.points).map(point => [x + point.x / 100 * w, y + point.y / 100 * h]);
        const inner = insetPolygonTowardCentroid(outer, Math.min(face, w * 0.18, h * 0.18));
        if (outer.length >= 3 && inner.length >= 3) return polygonFramePath(outer, inner);
      }
      return `M${x} ${y}h${w}v${h}h-${w}Z M${innerX} ${innerY}v${innerH}h${innerW}v-${innerH}Z`;
    }

    function polygonFramePath(outer, inner) {
      return `${polygonPath(outer)} ${polygonPath(inner)}`;
    }

    function polygonPath(points) {
      return points.map(([px, py], index) => `${index === 0 ? "M" : "L"}${px} ${py}`).join(" ") + " Z";
    }

    function windowShapePoints3d(win, width, height) {
      const shape = normalizeWindowShape(win.shape);
      const type = shape.type || "rectangular";
      const halfW = width / 2;
      const halfH = height / 2;
      if (type === "arched") {
        const rise = Math.min(height * 0.32, Math.max(width * 0.012, Number(shape.archHeightMm || 220) * (width / Math.max(1, win.widthMm))));
        const leftY = halfH - rise;
        const control = { x: 0, y: halfH + rise * 0.75 };
        const left = { x: -halfW, y: leftY };
        const right = { x: halfW, y: leftY };
        const arch = Array.from({ length: 15 }, (_, index) => {
          const t = index / 14;
          const inv = 1 - t;
          return {
            x: inv * inv * left.x + 2 * inv * t * control.x + t * t * right.x,
            y: inv * inv * left.y + 2 * inv * t * control.y + t * t * right.y
          };
        });
        return [...arch, { x: halfW, y: -halfH }, { x: -halfW, y: -halfH }];
      }
      if (type === "trapezoid") {
        const shift = Math.min(width * 0.18, 90 * (width / Math.max(1, win.widthMm)));
        return [
          { x: -halfW + shift, y: halfH },
          { x: halfW, y: halfH },
          { x: halfW - shift, y: -halfH },
          { x: -halfW, y: -halfH }
        ];
      }
      if (type === "trapezoid_left") {
        const shift = Math.min(width * 0.18, 90 * (width / Math.max(1, win.widthMm)));
        return [
          { x: -halfW, y: halfH },
          { x: halfW - shift, y: halfH },
          { x: halfW, y: -halfH },
          { x: -halfW + shift, y: -halfH }
        ];
      }
      if (type === "trapezoid_peak") {
        const peak = Math.min(height * 0.3, Math.max(width * 0.018, 110 * (height / Math.max(1, win.heightMm))));
        return [
          { x: -halfW, y: halfH - peak },
          { x: 0, y: halfH },
          { x: halfW, y: halfH - peak },
          { x: halfW, y: -halfH },
          { x: -halfW, y: -halfH }
        ];
      }
      if (type === "notch_top_left") {
        const notch = Math.min(width * 0.28, height * 0.32, 130 * (width / Math.max(1, win.widthMm)));
        return [
          { x: -halfW + notch, y: halfH },
          { x: halfW, y: halfH },
          { x: halfW, y: -halfH },
          { x: -halfW, y: -halfH },
          { x: -halfW, y: halfH - notch }
        ];
      }
      if (type === "notch_top_right") {
        const notch = Math.min(width * 0.28, height * 0.32, 130 * (width / Math.max(1, win.widthMm)));
        return [
          { x: -halfW, y: halfH },
          { x: halfW - notch, y: halfH },
          { x: halfW, y: halfH - notch },
          { x: halfW, y: -halfH },
          { x: -halfW, y: -halfH }
        ];
      }
      if (type === "custom_polygon") {
        const points = normalizeShapePoints(shape.points).map(point => ({
          x: -halfW + point.x / 100 * width,
          y: halfH - point.y / 100 * height
        }));
        if (points.length >= 3) return points;
      }
      return [
        { x: -halfW, y: halfH },
        { x: halfW, y: halfH },
        { x: halfW, y: -halfH },
        { x: -halfW, y: -halfH }
      ];
    }

    function isRectangularWindowShape(win) {
      return normalizeWindowShape(win.shape).type === "rectangular";
    }

    function cellHasCustomShape(win, row, col) {
      const cols = win?.layout?.columns?.length || 0;
      if (row < 0 || col < 0 || !cols) return false;
      return Boolean(normalizeCellCustomShape(win.layout.cells[cellIndex(row, col, cols)]?.customShape));
    }

    function windowHasCustomCellShape(win) {
      return Boolean(win?.layout?.cells?.some(cell => normalizeCellCustomShape(cell?.customShape)));
    }

    function insetPolygonTowardCentroid(points, inset) {
      if (!points.length) return [];
      const center = points.reduce((acc, [px, py]) => ({ x: acc.x + px, y: acc.y + py }), { x: 0, y: 0 });
      center.x /= points.length;
      center.y /= points.length;
      return points.map(([px, py]) => {
        const dx = center.x - px;
        const dy = center.y - py;
        const length = Math.hypot(dx, dy) || 1;
        const move = Math.min(inset, length * 0.45);
        return [px + dx / length * move, py + dy / length * move];
      });
    }

    function computeCellRects(win, inner) {
      const cols = win.layout.columns;
      const rows = win.layout.rows;
      const colTotal = sum(cols);
      const rowTotal = sum(rows);
      const colEdges = rectsToEdges(cols, inner.x, inner.w, colTotal);
      const rowEdges = rectsToEdges(rows, inner.y, inner.h, rowTotal);
      const rects = [];
      for (let r = 0; r < rows.length; r += 1) {
        for (let c = 0; c < cols.length; c += 1) {
          rects.push({
            row: r,
            col: c,
            x: colEdges[c],
            y: rowEdges[r],
            w: colEdges[c + 1] - colEdges[c],
            h: rowEdges[r + 1] - rowEdges[r],
            cell: win.layout.cells[cellIndex(r, c, cols.length)]
          });
        }
      }
      return rects;
    }

    function rectsToEdges(weights, start, total, knownSum) {
      const totalWeight = knownSum || sum(weights);
      const edges = [start];
      let cursor = start;
      for (const weight of weights) {
        cursor += total * weight / totalWeight;
        edges.push(cursor);
      }
      edges[edges.length - 1] = start + total;
      return edges;
    }

    function profileColor(ral, material) {
      const palette = {
        RAL9016: "#edf1f1",
        RAL9005: "#1d2527",
        RAL7016: "#364246",
        RAL9006: "#a9b0b3",
        RAL8017: "#4a3128"
      };
      if (palette[String(ral).toUpperCase()]) return palette[String(ral).toUpperCase()];
      if (material === "pvc") return "#f0f3f3";
      if (material === "wood") return "#a47551";
      return "#8f9ba0";
    }

    function cellFill(cellOrType) {
      const type = typeof cellOrType === "string" ? cellOrType : cellOrType?.type;
      const infillType = typeof cellOrType === "string" ? "glass" : normalizeCellInfillType(cellOrType?.infillType);
      if (infillType === "panel") return "var(--panel)";
      if (infillType === "louver") return "var(--louver)";
      return {
        fixed_glass: "var(--glass)",
        turn: "#cfe7f1",
        turn_tilt: "#c6e2ee",
        top_hung: "#d5ebf0",
        bottom_hung: "#d8e8f3",
        sliding: "#d4e9f0",
        lift_slide: "#cfe5e6",
        psk: "#d7e7f3",
        parallel_slide: "#d8ecea",
        parallel_project: "#e2e9f3",
        pocket_slide: "#d9e4e7",
        corner_slide: "#d5ebe2",
        vertical_slide: "#dbe8f1",
        folding: "#d5e8df",
        door: "var(--door)",
        screen: "var(--screen)",
        louver: "var(--louver)",
        grille: "var(--grille)",
        panel: "var(--panel)",
        empty: "var(--empty)"
      }[type] || "var(--glass)";
    }

    function cellDecoration(cellOrType, item, stroke) {
      const type = typeof cellOrType === "string" ? cellOrType : cellOrType?.type;
      const infillType = typeof cellOrType === "string" ? type : normalizeCellInfillType(cellOrType?.infillType);
      const accessories = typeof cellOrType === "string" ? normalizeCellAccessories() : normalizeCellAccessories(cellOrType?.accessories);
      const lines = [];
      const inset = Math.max(8, Math.min(item.w, item.h) * 0.08);
      if (type === "screen" || accessories.screenMode !== "none") {
        const step = Math.max(16, Math.min(item.w, item.h) / 6);
        for (let x = item.x + inset; x < item.x + item.w - inset; x += step) {
          lines.push(`<line class="screen-line" x1="${x}" y1="${item.y + inset}" x2="${x}" y2="${item.y + item.h - inset}" stroke="#3ba47b" stroke-width="1" opacity="0.55" />`);
        }
        for (let y = item.y + inset; y < item.y + item.h - inset; y += step) {
          lines.push(`<line class="screen-line" x1="${item.x + inset}" y1="${y}" x2="${item.x + item.w - inset}" y2="${y}" stroke="#3ba47b" stroke-width="1" opacity="0.55" />`);
        }
      }
      if (type === "louver" || infillType === "louver") {
        const count = Math.max(4, Math.min(9, Math.floor(item.h / 34)));
        for (let i = 1; i <= count; i += 1) {
          const y = item.y + item.h * i / (count + 1);
          lines.push(`<line class="louver-line" x1="${item.x + inset}" y1="${y}" x2="${item.x + item.w - inset}" y2="${y - 8}" stroke="${stroke}" stroke-width="4" opacity="0.7" />`);
        }
      }
      if (type === "grille" || accessories.grille) {
        const cx = item.x + item.w / 2;
        const cy = item.y + item.h / 2;
        lines.push(`<line class="grille-line" x1="${cx}" y1="${item.y + inset}" x2="${cx}" y2="${item.y + item.h - inset}" stroke="${stroke}" stroke-width="5" opacity="0.76" />`);
        lines.push(`<line class="grille-line" x1="${item.x + inset}" y1="${cy}" x2="${item.x + item.w - inset}" y2="${cy}" stroke="${stroke}" stroke-width="5" opacity="0.76" />`);
      }
      if (accessories.securityBars) {
        for (let index = 1; index <= 3; index += 1) {
          const x = item.x + item.w * index / 4;
          lines.push(`<line class="grille-line" x1="${x}" y1="${item.y + inset}" x2="${x}" y2="${item.y + item.h - inset}" stroke="#2f3b42" stroke-width="3" opacity="0.82" />`);
        }
      }
      if (accessories.frosted) {
        lines.push(`<rect x="${item.x + inset}" y="${item.y + inset}" width="${Math.max(0, item.w - inset * 2)}" height="${Math.max(0, item.h - inset * 2)}" fill="rgba(238,245,247,0.5)" />`);
      }
      return lines.join("");
    }

    function openingSymbol(cell, item, inset) {
      const opening = cell.opening;
      const assembly = normalizeOpeningAssembly(cell.type, opening, cell.openingAssembly);
      const centerX = item.x + item.w / 2;
      const centerY = item.y + item.h / 2;
      const leftEdge = item.x + inset;
      const rightEdge = item.x + item.w - inset;
      const topEdge = item.y + inset;
      const bottomEdge = item.y + item.h - inset;
      if (cell.type === "top_hung") {
        const dash = opening.endsWith("out") ? "" : "stroke-dasharray='7 5'";
        return `<path d="M${leftEdge} ${bottomEdge} L${centerX} ${topEdge} L${rightEdge} ${bottomEdge}" fill="none" stroke="#20383e" stroke-width="2" ${dash} />`;
      }
      if (cell.type === "bottom_hung") {
        const dash = opening.endsWith("out") ? "" : "stroke-dasharray='7 5'";
        return `<path d="M${leftEdge} ${topEdge} L${centerX} ${bottomEdge} L${rightEdge} ${topEdge}" fill="none" stroke="#20383e" stroke-width="2" ${dash} />`;
      }
      if (["sliding", "lift_slide", "psk", "parallel_slide", "pocket_slide"].includes(cell.type)) {
        const rightward = assembly.stackSide === "right";
        const start = rightward ? item.x + item.w * 0.3 : item.x + item.w * 0.7;
        const end = rightward ? item.x + item.w * 0.7 : item.x + item.w * 0.3;
        const lift = cell.type === "lift_slide" ? -10 : 0;
        const dividers = Array.from({ length: assembly.panelCount - 1 }, (_, index) => {
          const px = leftEdge + (rightEdge - leftEdge) * (index + 1) / assembly.panelCount;
          return `<line x1="${px}" y1="${topEdge}" x2="${px}" y2="${bottomEdge}" stroke="#5a747b" stroke-width="1.5" />`;
        }).join("");
        const arrows = assembly.stackSide === "both"
          ? `<path d="M${centerX - 6} ${centerY} H${leftEdge + 12} m10 -8 l-10 8 10 8 M${centerX + 6} ${centerY} H${rightEdge - 12} m-10 -8 l10 8 -10 8" fill="none" stroke="#20383e" stroke-width="2" />`
          : `<path d="M${start} ${centerY} ${cell.type === "lift_slide" ? "v-10" : ""} L${end} ${centerY + lift} m${rightward ? -10 : 10} -8 l${rightward ? 10 : -10} 8 ${rightward ? -10 : 10} 8" fill="none" stroke="#20383e" stroke-width="2" />`;
        const special = cell.type === "psk"
          ? `<path d="M${leftEdge} ${bottomEdge} L${centerX} ${topEdge} L${rightEdge} ${bottomEdge}" fill="none" stroke="#20383e" stroke-width="1.5" stroke-dasharray="6 4" />`
          : (cell.type === "pocket_slide"
            ? (assembly.stackSide === "both"
              ? `<rect x="${leftEdge}" y="${topEdge}" width="${(rightEdge - leftEdge) * 0.18}" height="${bottomEdge - topEdge}" fill="rgba(126,135,146,0.2)" /><rect x="${rightEdge - (rightEdge - leftEdge) * 0.18}" y="${topEdge}" width="${(rightEdge - leftEdge) * 0.18}" height="${bottomEdge - topEdge}" fill="rgba(126,135,146,0.2)" />`
              : `<rect x="${assembly.stackSide === "right" ? rightEdge - (rightEdge - leftEdge) * 0.22 : leftEdge}" y="${topEdge}" width="${(rightEdge - leftEdge) * 0.22}" height="${bottomEdge - topEdge}" fill="rgba(126,135,146,0.2)" />`)
            : "");
        return `${special}${dividers}${arrows}`;
      }
      if (cell.type === "parallel_project") {
        const offset = Math.min(8, inset * 0.45);
        return `<rect x="${leftEdge + offset}" y="${topEdge - offset}" width="${rightEdge - leftEdge}" height="${bottomEdge - topEdge}" fill="none" stroke="#20383e" stroke-width="2" /><path d="M${leftEdge} ${topEdge} L${leftEdge + offset} ${topEdge - offset} M${rightEdge} ${topEdge} L${rightEdge + offset} ${topEdge - offset}" stroke="#20383e" />`;
      }
      if (cell.type === "corner_slide") {
        const gap = assembly.cornerPostMode === "postless" ? 2 : 7;
        return `<path d="M${leftEdge} ${topEdge} L${centerX - gap} ${centerY} L${leftEdge} ${bottomEdge} M${rightEdge} ${topEdge} L${centerX + gap} ${centerY} L${rightEdge} ${bottomEdge}" fill="none" stroke="#20383e" stroke-width="2" />`;
      }
      if (cell.type === "vertical_slide") {
        const upward = opening === "slide_up";
        const start = upward ? item.y + item.h * 0.7 : item.y + item.h * 0.3;
        const end = upward ? item.y + item.h * 0.3 : item.y + item.h * 0.7;
        return `<path d="M${centerX} ${start} V${end} m-8 ${upward ? 10 : -10} l8 ${upward ? -10 : 10} 8 ${upward ? 10 : -10}" fill="none" stroke="#20383e" stroke-width="2" />`;
      }
      if (cell.type === "folding") {
        const points = Array.from({ length: assembly.panelCount + 1 }, (_, index) => {
          const logical = assembly.stackSide === "right" ? assembly.panelCount - index : index;
          const px = leftEdge + (rightEdge - leftEdge) * logical / assembly.panelCount;
          const py = index % 2 ? bottomEdge : topEdge;
          return `${px},${py}`;
        });
        return `<polyline points="${points.join(" ")}" fill="none" stroke="#20383e" stroke-width="2" />`;
      }
      if (["turn", "turn_tilt", "door"].includes(cell.type) && assembly.panelCount > 1) {
        return assembly.panels.map((panel, index) => {
          const panelWidth = (rightEdge - leftEdge) / assembly.panelCount;
          const panelLeft = leftEdge + panelWidth * index;
          const panelRight = panelLeft + panelWidth;
          if (!panel.movable) return `<line x1="${panelLeft}" y1="${topEdge}" x2="${panelLeft}" y2="${bottomEdge}" stroke="#5a747b" stroke-width="1.5" />`;
          const x1 = panel.hingeSide === "left" ? panelLeft : panelRight;
          const x2 = panel.hingeSide === "left" ? panelRight : panelLeft;
          const dash = assembly.openPlane === "out" ? "" : "stroke-dasharray='7 5'";
          return `<path d="M${x1} ${topEdge} L${x2} ${bottomEdge} L${x1} ${bottomEdge} Z" fill="none" stroke="#20383e" stroke-width="2" ${dash} />`;
        }).join("");
      }
      const left = opening?.startsWith("left");
      const out = opening?.endsWith("out");
      const x1 = left ? item.x + inset : item.x + item.w - inset;
      const y1 = item.y + inset;
      const x2 = left ? item.x + item.w - inset : item.x + inset;
      const y2 = item.y + item.h - inset;
      const dash = out ? "" : "stroke-dasharray='7 5'";
      return `<path d="M${x1} ${y1} L${x2} ${y2} L${x1} ${y2} Z" fill="none" stroke="#20383e" stroke-width="2" ${dash} />`;
    }

    function dimensionLine(x1, y1, x2, y2, label, vertical = false) {
      if (vertical) {
        const mid = (y1 + y2) / 2;
        return `<g><line class="dimension" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" /><line class="dimension" x1="${x1 - 7}" y1="${y1}" x2="${x1 + 7}" y2="${y1}" /><line class="dimension" x1="${x1 - 7}" y1="${y2}" x2="${x1 + 7}" y2="${y2}" /><text class="dimension-text" transform="translate(${x1 - 18} ${mid}) rotate(-90)">${escapeHtml(label)}</text></g>`;
      }
      const mid = (x1 + x2) / 2;
      return `<g><line class="dimension" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" /><line class="dimension" x1="${x1}" y1="${y1 - 7}" x2="${x1}" y2="${y1 + 7}" /><line class="dimension" x1="${x2}" y1="${y2 - 7}" x2="${x2}" y2="${y2 + 7}" /><text class="dimension-text" x="${mid}" y="${y1 + 18}">${escapeHtml(label)}</text></g>`;
    }

    function renderCustomShapeAnnotations(win, x, y, w, h) {
      const shape = normalizeWindowShape(win.shape);
      if (shape.type !== "custom_polygon") return "";
      const points = normalizeShapePoints(shape.points);
      if (points.length < 3) return "";
      const svgPoints = points.map(point => ({ x: x + point.x / 100 * w, y: y + point.y / 100 * h }));
      const modelPoints = points.map(point => ({ x: point.x / 100 * win.widthMm, y: point.y / 100 * win.heightMm }));
      const centroid = svgPoints.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
      centroid.x /= svgPoints.length;
      centroid.y /= svgPoints.length;
      const parts = [`<g class="shape-annotation" data-shape-editor="custom_polygon" aria-label="DIY异形框边长与角度">`];
      for (let index = 0; index < svgPoints.length; index += 1) {
        const nextIndex = (index + 1) % svgPoints.length;
        const start = svgPoints[index];
        const end = svgPoints[nextIndex];
        const modelStart = modelPoints[index];
        const modelEnd = modelPoints[nextIndex];
        const lengthMm = Math.hypot(modelEnd.x - modelStart.x, modelEnd.y - modelStart.y);
        const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
        const outward = outwardLabelVector(mid, centroid, 16);
        const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
        parts.push(`<line class="shape-edge-guide" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" />`);
        parts.push(`<text class="shape-edge-label" x="${mid.x + outward.x}" y="${mid.y + outward.y}" transform="rotate(${angle} ${mid.x + outward.x} ${mid.y + outward.y})">${Math.round(lengthMm)} mm</text>`);
      }
      for (let index = 0; index < svgPoints.length; index += 1) {
        const prev = modelPoints[(index - 1 + modelPoints.length) % modelPoints.length];
        const current = modelPoints[index];
        const next = modelPoints[(index + 1) % modelPoints.length];
        const svgPoint = svgPoints[index];
        const labelVector = outwardLabelVector(svgPoint, centroid, 24);
        const angleDeg = polygonVertexAngle(prev, current, next);
        parts.push(`<circle class="shape-vertex-dot" cx="${svgPoint.x}" cy="${svgPoint.y}" r="3.5" />`);
        parts.push(`<text class="shape-angle-label" x="${svgPoint.x + labelVector.x}" y="${svgPoint.y + labelVector.y}">${Math.round(angleDeg)}°</text>`);
      }
      parts.push(`</g>`);
      return parts.join("");
    }

    function svgPointFromClient(svg, clientX, clientY) {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      return point.matrixTransform(svg.getScreenCTM().inverse());
    }

    function openDiyShapeEditor(options = {}) {
      diyShapeEditor.points = Array.isArray(options.points) ? normalizeShapePoints(options.points).map(point => ({ ...point })) : [];
      diyShapeEditor.selectedIndex = -1;
      diyShapeEditor.draggingIndex = -1;
      diyShapeEditor.closed = diyShapeEditor.points.length >= 3 && !options.blank;
      diyShapeEditor.editingShapeId = String(options.shapeId || "");
      setValue("diyShapeName", options.name || "");
      const title = document.getElementById("diyShapeDialogTitle");
      if (title) title.textContent = diyShapeEditor.editingShapeId ? "编辑DIY异形构件" : "DIY异形框绘制";
      const saveButton = document.getElementById("btnSaveDiyShape");
      if (saveButton) saveButton.textContent = diyShapeEditor.editingShapeId ? "保存修改" : "保存为窗型元素";
      renderDiyShapeEditor();
      const dialog = document.getElementById("diyShapeDialog");
      if (dialog?.showModal && !dialog.open) dialog.showModal();
    }

    function closeDiyShapeEditor() {
      const dialog = document.getElementById("diyShapeDialog");
      if (dialog?.open) dialog.close();
      diyShapeEditor.draggingIndex = -1;
    }

    function renderDiyShapeEditor() {
      const svg = document.getElementById("diyShapeCanvas");
      const status = document.getElementById("diyShapeStatus");
      if (!svg) return;
      const bounds = diyShapeBounds();
      const parts = [];
      parts.push(`<defs><marker id="diyDimTick" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M4 0 L4 8" stroke="#596bd4" stroke-width="1.4" /></marker></defs>`);
      parts.push(`<rect class="diy-work-area" x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}" rx="2" />`);
      for (let i = 1; i < 10; i += 1) {
        const gx = bounds.x + bounds.w * i / 10;
        const gy = bounds.y + bounds.h * i / 10;
        parts.push(`<line class="diy-grid-line" x1="${gx}" y1="${bounds.y}" x2="${gx}" y2="${bounds.y + bounds.h}" />`);
        parts.push(`<line class="diy-grid-line" x1="${bounds.x}" y1="${gy}" x2="${bounds.x + bounds.w}" y2="${gy}" />`);
      }
      const svgPoints = diyShapeEditor.points.map(point => diyPointToSvg(point, bounds));
      if (svgPoints.length >= 3 && diyShapeEditor.closed) {
        const path = svgPoints.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" ");
        parts.push(`<path class="diy-shape-path" d="${path} Z" />`);
      } else if (svgPoints.length >= 2) {
        parts.push(`<polyline class="diy-shape-preview-line" points="${svgPoints.map(point => `${point.x},${point.y}`).join(" ")}" />`);
      }
      if (svgPoints.length >= 2) parts.push(renderDiyShapeDimensions(diyShapeEditor.points, svgPoints, diyShapeEditor.closed));
      svgPoints.forEach((point, index) => {
        const active = index === diyShapeEditor.selectedIndex ? " active" : "";
        parts.push(`<circle class="diy-shape-point${active}" data-diy-point-index="${index}" cx="${point.x}" cy="${point.y}" r="7" />`);
        parts.push(`<text class="diy-shape-label" x="${point.x}" y="${point.y - 13}">P${index + 1}</text>`);
      });
      if (!svgPoints.length) {
        parts.push(`<text class="diy-shape-label" x="${bounds.x + bounds.w / 2}" y="${bounds.y + bounds.h / 2}">空白画布：点击添加外框顶点</text>`);
      }
      svg.innerHTML = parts.join("");
      if (status) {
        const count = diyShapeEditor.points.length;
        status.textContent = count < 3
          ? `已绘制 ${count} 个点，还需要至少 ${3 - count} 个点才能闭合。`
          : diyShapeEditor.closed
            ? `已闭合为 ${count} 边形，可输入名称并保存到工具库。`
            : `已绘制 ${count} 个点，点击第一个点闭合成面。`;
      }
    }

    function renderDiyShapeDimensions(modelPoints, svgPoints, closed) {
      const parts = [];
      const segmentCount = closed ? svgPoints.length : svgPoints.length - 1;
      const centroid = svgPoints.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
      centroid.x /= svgPoints.length;
      centroid.y /= svgPoints.length;
      for (let index = 0; index < segmentCount; index += 1) {
        const nextIndex = (index + 1) % svgPoints.length;
        const start = svgPoints[index];
        const end = svgPoints[nextIndex];
        const modelStart = modelPoints[index];
        const modelEnd = modelPoints[nextIndex];
        const lengthMm = Math.hypot(modelEnd.x - modelStart.x, modelEnd.y - modelStart.y) * 24;
        const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
        const outward = outwardLabelVector(mid, centroid, 16);
        const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
        parts.push(`<text class="diy-dimension" x="${mid.x + outward.x}" y="${mid.y + outward.y}" transform="rotate(${angle} ${mid.x + outward.x} ${mid.y + outward.y})">${Math.round(lengthMm)} mm</text>`);
      }
      if (closed) {
        for (let index = 0; index < svgPoints.length; index += 1) {
          const prev = modelPoints[(index - 1 + modelPoints.length) % modelPoints.length];
          const current = modelPoints[index];
          const next = modelPoints[(index + 1) % modelPoints.length];
          const point = svgPoints[index];
          const labelVector = outwardLabelVector(point, centroid, 26);
          parts.push(`<text class="diy-angle" x="${point.x + labelVector.x}" y="${point.y + labelVector.y}">${Math.round(polygonVertexAngle(prev, current, next))}°</text>`);
        }
        const minX = Math.min(...svgPoints.map(point => point.x));
        const maxX = Math.max(...svgPoints.map(point => point.x));
        const minY = Math.min(...svgPoints.map(point => point.y));
        const maxY = Math.max(...svgPoints.map(point => point.y));
        const widthMm = (Math.max(...modelPoints.map(point => point.x)) - Math.min(...modelPoints.map(point => point.x))) * 24;
        const heightMm = (Math.max(...modelPoints.map(point => point.y)) - Math.min(...modelPoints.map(point => point.y))) * 24;
        parts.push(`<line class="diy-overall-guide" x1="${minX}" y1="${maxY + 30}" x2="${maxX}" y2="${maxY + 30}" />`);
        parts.push(`<text class="diy-overall-dimension" x="${(minX + maxX) / 2}" y="${maxY + 50}">${Math.round(widthMm)} mm</text>`);
        parts.push(`<line class="diy-overall-guide" x1="${maxX + 28}" y1="${minY}" x2="${maxX + 28}" y2="${maxY}" />`);
        parts.push(`<text class="diy-overall-dimension" x="${maxX + 50}" y="${(minY + maxY) / 2}" transform="rotate(-90 ${maxX + 50} ${(minY + maxY) / 2})">${Math.round(heightMm)} mm</text>`);
      }
      return parts.join("");
    }

    function diyShapeBounds() {
      return { x: 58, y: 42, w: 604, h: 360 };
    }

    function diyPointToSvg(point, bounds = diyShapeBounds()) {
      return {
        x: bounds.x + point.x / 100 * bounds.w,
        y: bounds.y + point.y / 100 * bounds.h
      };
    }

    function diyPointFromSvg(point, bounds = diyShapeBounds()) {
      return {
        x: Math.round(Math.min(100, Math.max(0, (point.x - bounds.x) / bounds.w * 100)) * 10) / 10,
        y: Math.round(Math.min(100, Math.max(0, (point.y - bounds.y) / bounds.h * 100)) * 10) / 10
      };
    }

    function handleDiyShapePointerDown(event) {
      const svg = document.getElementById("diyShapeCanvas");
      if (!svg) return;
      const index = Number(event.target?.dataset?.diyPointIndex);
      const point = diyPointFromSvg(svgPointFromClient(svg, event.clientX, event.clientY));
      if (Number.isInteger(index) && index >= 0) {
        if (index === 0 && diyShapeEditor.points.length >= 3 && !diyShapeEditor.closed) {
          diyShapeEditor.selectedIndex = 0;
          diyShapeEditor.draggingIndex = -1;
          diyShapeEditor.closed = true;
          renderDiyShapeEditor();
          return;
        }
        diyShapeEditor.selectedIndex = index;
        diyShapeEditor.draggingIndex = index;
      } else if (!diyShapeEditor.closed) {
        diyShapeEditor.points.push(point);
        diyShapeEditor.selectedIndex = diyShapeEditor.points.length - 1;
        diyShapeEditor.draggingIndex = diyShapeEditor.selectedIndex;
      }
      svg.setPointerCapture?.(event.pointerId);
      renderDiyShapeEditor();
    }

    function handleDiyShapePointerMove(event) {
      if (diyShapeEditor.draggingIndex < 0) return;
      const svg = document.getElementById("diyShapeCanvas");
      if (!svg) return;
      diyShapeEditor.points[diyShapeEditor.draggingIndex] = diyPointFromSvg(svgPointFromClient(svg, event.clientX, event.clientY));
      renderDiyShapeEditor();
    }

    function handleDiyShapePointerUp(event) {
      const svg = document.getElementById("diyShapeCanvas");
      svg?.releasePointerCapture?.(event.pointerId);
      diyShapeEditor.draggingIndex = -1;
    }

    function undoDiyShapePoint() {
      if (!diyShapeEditor.points.length) return;
      if (diyShapeEditor.closed) {
        diyShapeEditor.closed = false;
        renderDiyShapeEditor();
        return;
      }
      const index = diyShapeEditor.selectedIndex >= 0 ? diyShapeEditor.selectedIndex : diyShapeEditor.points.length - 1;
      diyShapeEditor.points.splice(index, 1);
      diyShapeEditor.selectedIndex = Math.min(diyShapeEditor.points.length - 1, index - 1);
      renderDiyShapeEditor();
    }

    function clearDiyShape() {
      diyShapeEditor.points = [];
      diyShapeEditor.selectedIndex = -1;
      diyShapeEditor.draggingIndex = -1;
      diyShapeEditor.closed = false;
      renderDiyShapeEditor();
    }

    function saveDiyShapeElement() {
      const points = normalizeShapePoints(diyShapeEditor.points);
      if (points.length < 3) {
        showToast("DIY异形框至少需要3个点。");
        return;
      }
      if (!diyShapeEditor.closed) {
        showToast("请先点击第一个点闭合成面。");
        return;
      }
      const name = valueOf("diyShapeName").trim();
      if (!name) {
        showToast("请先输入DIY窗型名称。");
        document.getElementById("diyShapeName")?.focus();
        return;
      }
      project.customShapes ||= [];
      const editingIndex = project.customShapes.findIndex(shape => shape.shapeId === diyShapeEditor.editingShapeId);
      const shapeId = editingIndex >= 0 ? project.customShapes[editingIndex].shapeId : `DIY-${Date.now().toString(36).toUpperCase()}`;
      const savedShape = normalizeCustomShapeElement({
        ...project.customShapes[editingIndex],
        shapeId,
        name,
        points,
        createdAt: new Date().toISOString()
      });
      if (editingIndex >= 0) {
        project.customShapes[editingIndex] = savedShape;
        updateCellsUsingCustomShape(savedShape);
      } else {
        project.customShapes.push(savedShape);
      }
      closeDiyShapeEditor();
      markDirty();
      showToast(editingIndex >= 0 ? `DIY异形构件“${name}”已更新。` : `DIY窗型“${name}”已保存到工具库。`);
    }

    function outwardLabelVector(point, centroid, distance) {
      const dx = point.x - centroid.x;
      const dy = point.y - centroid.y;
      const length = Math.hypot(dx, dy) || 1;
      return { x: dx / length * distance, y: dy / length * distance };
    }

    function polygonVertexAngle(prev, current, next) {
      const ax = prev.x - current.x;
      const ay = prev.y - current.y;
      const bx = next.x - current.x;
      const by = next.y - current.y;
      const dot = ax * bx + ay * by;
      const lengths = (Math.hypot(ax, ay) || 1) * (Math.hypot(bx, by) || 1);
      const radians = Math.acos(Math.min(1, Math.max(-1, dot / lengths)));
      return radians * 180 / Math.PI;
    }

    function renderCssPreview(win) {
      const fallback = document.getElementById("previewFallback");
      if (!fallback || !win || preview3d.renderer) return;
      const cols = win.layout.columns;
      const rows = win.layout.rows;
      const colTotal = sum(cols);
      const rowTotal = sum(rows);
      let cellHtml = "";
      let top = 0;
      for (let r = 0; r < rows.length; r += 1) {
        const height = rows[r] / rowTotal * 100;
        let left = 0;
        for (let c = 0; c < cols.length; c += 1) {
          const width = cols[c] / colTotal * 100;
          const cell = win.layout.cells[cellIndex(r, c, cols.length)];
          const label = typeLabels[cell?.type] || "窗格";
          cellHtml += `<div class="fallback-cell ${escapeHtml(cell?.type || "fixed_glass")}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;">${escapeHtml(label)}</div>`;
          left += width;
        }
        top += height;
      }
      fallback.classList.remove("hidden");
      fallback.innerHTML = `
        <div class="fallback-model">
          <div class="fallback-window" style="aspect-ratio:${Math.max(300, win.widthMm)} / ${Math.max(300, win.heightMm)};">${cellHtml}</div>
          <div class="fallback-note">${threeUnavailable ? "当前显示轻量3D预览，二维绘图和BOM正常可用。" : "正在加载WebGL预览，先显示轻量3D效果。"}</div>
        </div>
      `;
    }

    function renderThreePreview() {
      const win = currentWindow();
      const stats = document.getElementById("previewStats");
      const title = document.getElementById("previewDialogTitle");
      const projectAssembly = drawingMode === "assembly" ? currentProjectAssembly() : null;
      if (projectAssembly) {
        const summary = assemblySummary(projectAssembly, project.windows);
        if (title) title.textContent = "3D组合预览";
        if (stats) stats.textContent = `${projectAssembly.name} · ${summary.windowIds.length}樘 · ${summary.overallWidthMm}×${summary.overallHeightMm}×${summary.overallDepthMm} mm`;
      } else {
        if (title) title.textContent = "3D窗体预览";
        if (stats && win) stats.textContent = `${win.mark} · ${win.widthMm}×${win.heightMm} mm · ${typeLabels[currentCell(win)?.type] || "单元"}`;
      }
      if (!win) return;
      renderCssPreview(win);
      if (!threeLib || !preview3d.renderer) {
        ensureThreePreview();
        return;
      }
      resizeThreePreview();
      if (previewNeedsRebuild) {
        rebuildThreeWindow(win);
        previewNeedsRebuild = false;
      }
      preview3d.renderer.render(preview3d.scene, preview3d.camera);
    }

    async function ensureThreePreview() {
      if (threeLib || threeImporting || threeUnavailable) return;
      threeImporting = true;
      const fallback = document.getElementById("previewFallback");
      if (fallback) fallback.textContent = "正在生成3D预览";
      try {
        [threeLib, orbitControlsLib] = await Promise.all([
          import(THREE_MODULE_URL),
          import(ORBIT_CONTROLS_URL)
        ]);
        setupThreePreview();
        previewNeedsRebuild = true;
        renderThreePreview();
      } catch (error) {
        console.warn("Three.js preview failed", error);
        threeUnavailable = true;
        if (fallback) fallback.textContent = "3D预览暂时无法加载，二维绘图和BOM仍可正常使用。";
      } finally {
        threeImporting = false;
      }
    }

    function setupThreePreview() {
      const THREE = threeLib;
      const { OrbitControls } = orbitControlsLib;
      const canvas = document.getElementById("preview3d");
      if (!canvas) return;
      preview3d.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      preview3d.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      preview3d.renderer.outputColorSpace = THREE.SRGBColorSpace;
      preview3d.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      preview3d.renderer.toneMappingExposure = 1.08;
      preview3d.renderer.shadowMap.enabled = true;
      preview3d.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      preview3d.scene = new THREE.Scene();
      preview3d.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      preview3d.camera.position.set(1.2, 0.45, 5.2);
      preview3d.scene.add(new THREE.HemisphereLight(0xffffff, 0xb7c4d3, 2.4));
      const key = new THREE.DirectionalLight(0xffffff, 2.8);
      key.position.set(3, 4, 5);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      preview3d.scene.add(key);
      const fill = new THREE.DirectionalLight(0xbfe7ff, 1.1);
      fill.position.set(-4, 2, 2);
      preview3d.scene.add(fill);
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 9),
        new THREE.ShadowMaterial({ color: 0x547086, opacity: 0.14 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, -1.62, -0.2);
      floor.receiveShadow = true;
      preview3d.scene.add(floor);
      preview3d.floor = floor;
      const grid = new THREE.GridHelper(9, 30, 0x91a7b7, 0xd6e2ea);
      grid.position.set(0, -1.615, -0.2);
      preview3d.scene.add(grid);
      preview3d.grid = grid;
      preview3d.group = new THREE.Group();
      preview3d.scene.add(preview3d.group);
      preview3d.controls = new OrbitControls(preview3d.camera, canvas);
      preview3d.controls.enableDamping = true;
      preview3d.controls.dampingFactor = 0.075;
      preview3d.controls.enablePan = false;
      preview3d.controls.minPolarAngle = Math.PI * 0.28;
      preview3d.controls.maxPolarAngle = Math.PI * 0.72;
      preview3d.raycaster = new THREE.Raycaster();
      preview3d.pointer = new THREE.Vector2();
      document.getElementById("previewFallback")?.classList.add("hidden");
      new ResizeObserver(() => {
        resizeThreePreview();
        preview3d.renderer?.render(preview3d.scene, preview3d.camera);
      }).observe(canvas.parentElement);
      canvas.addEventListener("webglcontextlost", event => {
        event.preventDefault();
        document.getElementById("previewFallback")?.classList.remove("hidden");
      });
      canvas.addEventListener("webglcontextrestored", () => {
        document.getElementById("previewFallback")?.classList.add("hidden");
        previewNeedsRebuild = true;
        renderThreePreview();
      });
      canvas.addEventListener("pointerdown", event => {
        preview3d.pointerDown = { x: event.clientX, y: event.clientY };
      });
      canvas.addEventListener("pointerup", event => {
        const start = preview3d.pointerDown;
        preview3d.pointerDown = null;
        if (event.button !== 0 || !start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
        selectThreePartAt(event, false);
      });
      canvas.addEventListener("contextmenu", event => {
        event.preventDefault();
        selectThreePartAt(event, true, true);
      });
      animateThreePreview();
    }

    function animateThreePreview() {
      cancelAnimationFrame(preview3d.raf);
      preview3d.lastFrameAt = performance.now();
      const tick = now => {
        preview3d.raf = requestAnimationFrame(tick);
        const deltaSeconds = Math.min(0.05, Math.max(0, (now - preview3d.lastFrameAt) / 1000));
        preview3d.lastFrameAt = now;
        if (activeModule !== "preview") return;
        updateThreeAnimations(deltaSeconds);
        preview3d.controls?.update();
        updatePreviewViewSide();
        preview3d.selectionHelpers.forEach(helper => {
          const part = preview3d.openables.find(item => item.key === helper.userData.openableKey);
          helper.visible = Boolean(part) && part.current <= 0.001 && part.target <= 0.001 && !preview3d.playback?.active;
          helper.update?.();
        });
        if (preview3d.renderer && preview3d.scene && preview3d.camera) {
          preview3d.renderer.render(preview3d.scene, preview3d.camera);
        }
      };
      preview3d.raf = requestAnimationFrame(tick);
    }

    function updatePreviewViewSide() {
      const indicator = document.getElementById("previewViewSide");
      const camera = preview3d.camera;
      const controls = preview3d.controls;
      if (!indicator || !camera || !controls) return;
      const direction = camera.position.clone().sub(controls.target);
      const sideRatio = direction.length() > 0 ? direction.z / direction.length() : 1;
      if (Math.abs(sideRatio) < 0.22) {
        indicator.textContent = "主立面：侧向观察";
        indicator.dataset.side = "side";
      } else if (sideRatio > 0) {
        indicator.textContent = "主立面：室外侧观察";
        indicator.dataset.side = "outside";
      } else {
        indicator.textContent = "主立面：室内侧观察";
        indicator.dataset.side = "inside";
      }
    }

    function updateThreeAnimations(deltaSeconds) {
      let selectedChanged = false;
      for (const part of preview3d.openables) {
        const previous = part.current;
        const difference = part.target - part.current;
        if (Math.abs(difference) < 0.001) {
          part.current = part.target;
        } else {
          part.current += difference * Math.min(1, deltaSeconds * 7.5);
        }
        selectedChanged ||= preview3d.selectedPartKeys.has(part.key) && Math.abs(previous - part.current) > 0.0001;
        applyOpeningState(part, part.current);
      }
      updatePreviewPlayback();
      if (selectedChanged) updatePreviewMotionReadout();
    }

    function updatePreviewPlayback() {
      const playback = preview3d.playback;
      if (!playback?.active) return;
      const parts = playback.keys
        .map(key => preview3d.openables.find(part => part.key === key))
        .filter(Boolean);
      if (!parts.length) {
        stopPreviewPlayback();
        return;
      }
      const activePart = parts[playback.index];
      const reachedTarget = playback.phase === "opening"
        ? activePart?.current >= 0.995
        : activePart?.current <= 0.005;
      if (!reachedTarget) return;

      playback.index += 1;
      if (playback.index < parts.length) {
        parts[playback.index].target = playback.phase === "opening" ? 1 : 0;
        updatePreviewMotionReadout();
        return;
      }
      if (playback.phase === "opening") {
        playback.phase = "closing";
        playback.index = 0;
        playback.keys.reverse();
        const firstClosingPart = preview3d.openables.find(part => part.key === playback.keys[0]);
        if (firstClosingPart) firstClosingPart.target = 0;
        updatePreviewMotionReadout();
        return;
      }
      stopPreviewPlayback();
      showToast("选中构件已按开启顺序完成演示。");
    }

    function resizeThreePreview() {
      const canvas = document.getElementById("preview3d");
      if (!canvas || !preview3d.renderer || !preview3d.camera) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      if (preview3d.viewportWidth !== width || preview3d.viewportHeight !== height) {
        preview3d.viewportWidth = width;
        preview3d.viewportHeight = height;
        preview3d.renderer.setSize(width, height, false);
        preview3d.camera.aspect = width / height;
        preview3d.camera.updateProjectionMatrix();
        fitThreePreview(false);
      }
    }

    function fitThreePreview(resetDirection = true) {
      const THREE = threeLib;
      const camera = preview3d.camera;
      const controls = preview3d.controls;
      const bounds = preview3d.bounds;
      if (!THREE || !camera || !controls || !bounds || bounds.isEmpty()) return;

      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(0.2, camera.aspect));
      const fitHeight = size.y / (2 * Math.tan(verticalFov / 2));
      const fitWidth = size.x / (2 * Math.tan(horizontalFov / 2));
      const distance = Math.max(fitHeight, fitWidth, 1) * 1.3 + size.z * 0.55;
      let direction = new THREE.Vector3(0.32, 0.12, 1).normalize();

      if (!resetDirection) {
        const current = camera.position.clone().sub(controls.target);
        if (current.lengthSq() > 0.001) direction = current.normalize();
      }

      controls.target.copy(center);
      camera.position.copy(center).addScaledVector(direction, distance);
      camera.near = Math.max(0.01, distance / 100);
      camera.far = Math.max(100, distance * 20);
      camera.updateProjectionMatrix();
      controls.minDistance = distance * 0.46;
      controls.maxDistance = distance * 3.2;
      controls.update();
    }

    function rebuildThreeWindow(win) {
      const THREE = threeLib;
      const root = preview3d.group;
      if (!THREE || !root) return;
      clearThreeObject(root);
      const previousSelection = new Set(preview3d.selectedPartKeys);
      preview3d.openables = [];
      preview3d.selectionHelpers = [];
      preview3d.playback = null;
      root.position.set(0, 0, 0);
      root.rotation.set(0, 0, 0);
      if (drawingMode === "assembly" && currentProjectAssembly()) {
        const assembly = currentProjectAssembly();
        const layout = resolveAssemblyLayout(assembly, project.windows);
        const bounds = assemblyBounds(layout);
        const scale = 2.55 / Math.max(bounds.widthMm, bounds.heightMm, bounds.depthMm, 300);
        const floorDatumMm = layout.length
          ? Math.min(...layout.map(item => item.yMm - item.window.heightMm / 2 - Math.max(0, Number(item.window.installation?.sillHeightMm || 0))))
          : 0;
        layout.forEach(item => {
          const model = buildThreeWindowModel(item.window, scale, true, item.window.windowId === assembly.rootWindowId);
          model.position.set(item.xMm * scale, (item.yMm - floorDatumMm) * scale, item.zMm * scale);
          model.rotation.y = item.rotationDeg * Math.PI / 180;
          root.add(model);
        });
      } else {
        const scale = 2.55 / Math.max(win.widthMm, win.heightMm);
        const model = buildThreeWindowModel(win, scale, true, true);
        const sillHeight = Math.max(0, Number(win.installation?.sillHeightMm || 0)) * scale;
        model.position.y = win.heightMm * scale / 2 + sillHeight;
        root.add(model);
      }

      preview3d.bounds = new THREE.Box3().setFromObject(root);
      updatePreviewGround(0);
      const selectedKey = `${selectedWindowId}:${selectedCell.row}:${selectedCell.col}:`;
      const validKeys = new Set(preview3d.openables.map(part => part.key));
      preview3d.selectedPartKeys = new Set([...previousSelection].filter(key => validKeys.has(key)));
      if (!preview3d.selectedPartKeys.size) {
        const fallbackKey = preview3d.openables.find(part => part.key.startsWith(selectedKey))?.key || preview3d.openables[0]?.key || "";
        if (fallbackKey) preview3d.selectedPartKeys.add(fallbackKey);
      }
      preview3d.selectedPartKey = [...preview3d.selectedPartKeys][0] || "";
      updatePreviewPartOptions();
      updatePreviewSelection();
      fitThreePreview(true);
    }

    function updatePreviewGround(groundY = 0) {
      if (preview3d.floor) preview3d.floor.position.y = groundY;
      if (preview3d.grid) preview3d.grid.position.y = groundY + 0.005;
    }

    function buildThreeWindowModel(win, scale, showOpening, showOrientationLabels = true) {
      const THREE = threeLib;
      const series = currentSeries(win);
      const model = new THREE.Group();
      const width = win.widthMm * scale;
      const height = win.heightMm * scale;
      const face = Math.max(0.045, Number(series.faceWidthMm || 70) * scale);
      const depth = Math.max(0.07, Number(series.frameDepthMm || series.faceWidthMm || 70) * scale);
      const innerW = Math.max(0.1, width - face * 2);
      const innerH = Math.max(0.1, height - face * 2);
      const mats = threeMaterials(win, series, scale);
      const colEdges = rectsToEdges(win.layout.columns, -innerW / 2, innerW);
      const rowEdges = rectsToEdges(win.layout.rows, -innerH / 2, innerH);
      const cornerMount = resolveThreeCornerMount(win, width, colEdges, face);
      const wallHost = new THREE.Group();
      wallHost.userData.mountType = "wall-host";
      model.add(wallHost);
      const frameMount = new THREE.Group();
      frameMount.userData.mountType = "window-frame";
      wallHost.add(frameMount);

      if (showOpening) {
        addShowroomOpening(wallHost, width, height, face, depth, mats, win, scale, cornerMount, showOrientationLabels);
        addThreeCustomCellWallOpenings(wallHost, win, colEdges, rowEdges, face, depth, mats, scale, cornerMount);
      }
      addMountedOuterFrame(frameMount, win, width, height, face, depth, mats, cornerMount, colEdges, rowEdges);
      addThreeGridFrameMembers(frameMount, win, colEdges, rowEdges, innerW, innerH, face, depth, mats);

      const cols = win.layout.columns.length;
      const rows = win.layout.rows.length;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const left = colEdges[c];
          const right = colEdges[c + 1];
          const bottom = rowEdges[rows - r - 1];
          const top = rowEdges[rows - r];
          const cell = win.layout.cells[cellIndex(r, c, cols)];
          addThreeCell(frameMount, cell, {
            x: (left + right) / 2,
            y: (bottom + top) / 2,
            w: Math.max(0.02, right - left - face * 0.22),
            h: Math.max(0.02, top - bottom - face * 0.22),
            face,
            depth,
            cornerMount: cornerMount && cell?.type === "corner_slide" ? cornerMount : null
          }, mats, { row: r, col: c, rows, cols, windowId: win.windowId, windowMark: win.mark });
        }
      }
      addThreeTopologyMembers(frameMount, win, colEdges, rowEdges, face, depth, mats);
      addThreeEngineeringJoints(frameMount, win, width, height, face, depth, scale, mats);
      model.userData.frameBottomY = -height / 2;
      model.userData.finishedFloorY = -height / 2 - Math.max(0, Number(win.installation?.sillHeightMm || 0)) * scale;
      return model;
    }

    function resolveThreeCornerMount(win, width, colEdges, face) {
      const cols = win.layout.columns.length;
      const rows = win.layout.rows.length;
      if (rows !== 1 || cols < 1) return null;
      const col = cols - 1;
      const cell = win.layout.cells[cellIndex(0, col, cols)];
      if (cell?.type !== "corner_slide") return null;
      const anchorX = width / 2;
      const frontWingSpan = Math.max(face * 2.2, anchorX - colEdges[col]);
      const returnSpan = frontWingSpan;
      const assembly = normalizeOpeningAssembly(cell.type, cell.opening, cell.openingAssembly);
      const surround = normalizeSurround(win.installation?.surround);
      const angle = assembly.cornerAngleDeg * Math.PI / 180;
      const modelScale = width / Math.max(1, win.widthMm);
      const cornerPierWidth = Math.max(face * 1.2, surround.wallThicknessMm * modelScale, surround.cornerPierWidthMm * modelScale);
      const structuralPier = surround.wallCornerMode === "structural_pier";
      const wallCornerX = anchorX + (structuralPier ? cornerPierWidth : 0);
      const returnOpeningOffset = structuralPier ? cornerPierWidth : 0;
      return {
        anchorX,
        wallCornerX,
        frontLeftX: -width / 2,
        frontSpan: anchorX + width / 2,
        frontWingSpan,
        returnSpan,
        returnOpeningOffset,
        returnOpeningOriginX: wallCornerX + Math.cos(angle) * returnOpeningOffset,
        returnOpeningOriginZ: -Math.sin(angle) * returnOpeningOffset,
        angle,
        postMode: assembly.cornerPostMode,
        wallCornerMode: surround.wallCornerMode,
        cornerPierWidth
      };
    }

    function addMountedOuterFrame(parent, win, width, height, face, depth, mats, cornerMount, colEdges = [], rowEdges = []) {
      if (!cornerMount) {
        if (!isRectangularWindowShape(win)) {
          addThreeShapeFrame(parent, windowShapePoints3d(win, width, height), face, depth, mats.profile);
          return;
        }
        if (windowHasCustomCellShape(win) && colEdges.length && rowEdges.length) {
          addThreeSegmentedOuterFrame(parent, win, colEdges, rowEdges, width, height, face, depth, mats.profile);
          return;
        }
        addBox(parent, 0, height / 2 - face / 2, 0, width, face, depth, mats.profile);
        addBox(parent, 0, -height / 2 + face / 2, 0, width, face, depth, mats.profile);
        addBox(parent, -width / 2 + face / 2, 0, 0, face, height, depth, mats.profile);
        addBox(parent, width / 2 - face / 2, 0, 0, face, height, depth, mats.profile);
        return;
      }

      const frontCenterX = cornerMount.frontLeftX + cornerMount.frontSpan / 2;
      addBox(parent, frontCenterX, height / 2 - face / 2, 0, cornerMount.frontSpan, face, depth, mats.profile);
      addBox(parent, frontCenterX, -height / 2 + face / 2, 0, cornerMount.frontSpan, face, depth, mats.profile);
      addBox(parent, cornerMount.frontLeftX + face / 2, 0, 0, face, height, depth, mats.profile);
      if (cornerMount.wallCornerMode === "structural_pier") {
        addBox(parent, cornerMount.anchorX - face / 2, 0, 0, face, height, depth, mats.profile);
      }

      const returnFrame = new threeLib.Group();
      returnFrame.position.set(cornerMount.returnOpeningOriginX, 0, cornerMount.returnOpeningOriginZ);
      returnFrame.rotation.y = cornerMount.angle;
      addBox(returnFrame, cornerMount.returnSpan / 2, height / 2 - face / 2, 0, cornerMount.returnSpan, face, depth, mats.profile);
      addBox(returnFrame, cornerMount.returnSpan / 2, -height / 2 + face / 2, 0, cornerMount.returnSpan, face, depth, mats.profile);
      if (cornerMount.wallCornerMode === "structural_pier") {
        addBox(returnFrame, face / 2, 0, 0, face, height, depth, mats.profile);
      }
      addBox(returnFrame, cornerMount.returnSpan - face / 2, 0, 0, face, height, depth, mats.profile);
      parent.add(returnFrame);
    }

    function addThreeSegmentedOuterFrame(parent, win, colEdges, rowEdges, width, height, face, depth, material) {
      const cols = win.layout.columns.length;
      const rows = win.layout.rows.length;
      for (let col = 0; col < cols; col += 1) {
        const centerX = (colEdges[col] + colEdges[col + 1]) / 2;
        const segmentW = colEdges[col + 1] - colEdges[col];
        if (!cellHasCustomShape(win, 0, col)) {
          addBox(parent, centerX, height / 2 - face / 2, 0, segmentW, face, depth, material);
        }
        if (!cellHasCustomShape(win, rows - 1, col)) {
          addBox(parent, centerX, -height / 2 + face / 2, 0, segmentW, face, depth, material);
        }
      }
      for (let row = 0; row < rows; row += 1) {
        const bottom = rowEdges[rows - row - 1];
        const top = rowEdges[rows - row];
        const centerY = (bottom + top) / 2;
        const segmentH = top - bottom;
        if (!cellHasCustomShape(win, row, 0)) {
          addBox(parent, -width / 2 + face / 2, centerY, 0, face, segmentH, depth, material);
        }
        if (!cellHasCustomShape(win, row, cols - 1)) {
          addBox(parent, width / 2 - face / 2, centerY, 0, face, segmentH, depth, material);
        }
      }
    }

    function addThreeGridFrameMembers(parent, win, colEdges, rowEdges, innerW, innerH, face, depth, mats) {
      const cols = win.layout.columns.length;
      const rows = win.layout.rows.length;
      for (let col = 1; col < colEdges.length - 1; col += 1) {
        for (let row = 0; row < rows; row += 1) {
          if (cellHasCustomShape(win, row, col - 1) || cellHasCustomShape(win, row, col)) continue;
          const bottom = rowEdges[rows - row - 1];
          const top = rowEdges[rows - row];
          addBox(parent, colEdges[col], (bottom + top) / 2, 0.01, face * 0.82, top - bottom, depth * 0.92, mats.profile);
        }
      }
      for (let edge = 1; edge < rowEdges.length - 1; edge += 1) {
        const aboveRow = rows - edge - 1;
        const belowRow = rows - edge;
        for (let col = 0; col < cols; col += 1) {
          if (cellHasCustomShape(win, aboveRow, col) || cellHasCustomShape(win, belowRow, col)) continue;
          addBox(parent, (colEdges[col] + colEdges[col + 1]) / 2, rowEdges[edge], 0.01, colEdges[col + 1] - colEdges[col], face * 0.82, depth * 0.92, mats.profile);
        }
      }
    }

    function addThreeShapeFrame(parent, points, face, depth, material) {
      if (!Array.isArray(points) || points.length < 3) return;
      const railWidth = Math.max(0.012, face * 0.82);
      for (let index = 0; index < points.length; index += 1) {
        const start = points[index];
        const end = points[(index + 1) % points.length];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        if (length <= 0.002) continue;
        const rail = addBox(parent, (start.x + end.x) / 2, (start.y + end.y) / 2, 0, length, railWidth, depth, material);
        rail.rotation.z = Math.atan2(dy, dx);
        rail.userData.mountType = "shape-frame-rail";
      }
    }

    function addThreeTopologyMembers(parent, win, colEdges, rowEdges, face, depth, mats) {
      const columns = win.layout.columns.length;
      const rows = win.layout.rows.length;
      for (const member of win.topology?.members || []) {
        const host = findMemberHost(win.layout, member);
        if (!host) continue;
        const left = colEdges[host.col];
        const right = colEdges[host.col + 1];
        const bottom = rowEdges[rows - host.row - 1];
        const top = rowEdges[rows - host.row];
        const cellWidth = right - left;
        const cellHeight = top - bottom;
        if (member.orientation === "horizontal") {
          const startX = left + cellWidth * member.span.startRatio;
          const endX = left + cellWidth * member.span.endRatio;
          const y = top - cellHeight * member.positionRatio;
          addBox(parent, (startX + endX) / 2, y, 0.012, endX - startX, face * 0.82, depth * 0.92, mats.profile);
        } else {
          const startY = top - cellHeight * member.span.startRatio;
          const endY = top - cellHeight * member.span.endRatio;
          const x = left + cellWidth * member.positionRatio;
          addBox(parent, x, (startY + endY) / 2, 0.012, face * 0.82, startY - endY, depth * 0.92, mats.profile);
        }
      }
    }

    function addThreeEngineeringJoints(parent, win, width, height, face, depth, scale, mats) {
      const joints = project.joints.filter(joint => joint.hostWindowId === win.windowId);
      joints.forEach(joint => {
        const vertical = ["left", "right"].includes(joint.hostEdge);
        const edgeLength = vertical ? height : width;
        const length = edgeLength * (joint.span.endRatio - joint.span.startRatio);
        const midpoint = (joint.span.startRatio + joint.span.endRatio) / 2;
        const group = new threeLib.Group();
        const side = ["left", "top"].includes(joint.hostEdge) ? -1 : 1;
        if (vertical) {
          group.position.set(side * (width / 2 + face * 0.18), height / 2 - height * midpoint, depth * 0.1);
        } else {
          group.position.set(-width / 2 + width * midpoint, -side * (height / 2 + face * 0.18), depth * 0.1);
        }
        const legA = Math.max(face * 0.5, joint.legWidthAMm * scale);
        const legB = Math.max(face * 0.5, joint.legWidthBMm * scale);
        const thickness = Math.max(0.012, face * 0.16);
        if (joint.postMode === "postless") {
          addBox(group, 0, 0, 0, vertical ? thickness : length, vertical ? length : thickness, depth * 0.3, mats.jointSeal);
        } else if (joint.type === "splice") {
          addBox(group, 0, 0, 0, vertical ? thickness : length, vertical ? length : thickness, legA + legB, mats.joint);
          if (joint.style === "reinforced") {
            addBox(group, 0, 0, depth * 0.08, vertical ? thickness * 2.2 : length, vertical ? length : thickness * 2.2, depth * 0.22, mats.hardwareDark);
          }
        } else if (joint.style === "curved") {
          const geometry = new threeLib.CylinderGeometry(Math.max(legA, legB) * 0.24, Math.max(legA, legB) * 0.24, length, 18);
          const mesh = new threeLib.Mesh(geometry, mats.joint);
          if (!vertical) mesh.rotation.z = Math.PI / 2;
          mesh.castShadow = true;
          group.add(mesh);
        } else {
          const first = addBox(group, 0, 0, 0, vertical ? thickness : length, vertical ? length : thickness, legA, mats.joint);
          const second = addBox(group, 0, 0, 0, vertical ? legB : length, vertical ? length : legB, thickness, mats.joint);
          const angle = threeLib.MathUtils.degToRad(joint.angleDeg * (joint.orientation === "reversed" ? -1 : 1));
          if (vertical) second.rotation.y = angle;
          else second.rotation.x = angle;
          first.userData.jointId = joint.jointId;
          second.userData.jointId = joint.jointId;
        }
        parent.add(group);
      });
    }

    function addThreeCell(parent, cell, rect, mats, meta) {
      if (!cell || cell.type === "empty") return;
      const assembly = normalizeOpeningAssembly(cell.type, cell.opening, cell.openingAssembly);
      const infillType = normalizeCellInfillType(cell.infillType);
      if (!isOperableType(cell.type) && infillType === "panel") {
        addBox(parent, rect.x, rect.y, 0.035, rect.w * 0.92, rect.h * 0.92, rect.depth * 0.25, mats.panel);
        addThreeCellOverlays(parent, cell, rect, mats, assembly);
        return;
      }
      if (!isOperableType(cell.type) && infillType === "louver") {
        addThreeLouvers(parent, rect, mats);
        addThreeCellOverlays(parent, cell, rect, mats, assembly);
        return;
      }
      if (cell.customShape && isOperableType(cell.type)) {
        addThreeCustomOperableCell(parent, cell, rect, mats, meta, assembly);
        addIntegratedScreen(parent, cell, rect, mats, meta);
        addThreeCellOverlays(parent, cell, rect, mats, assembly);
        return;
      }
      if (cell.customShape) addThreeCustomCellGeometry(parent, cell, rect, mats);
      if (cell.type === "panel") {
        addBox(parent, rect.x, rect.y, 0.035, rect.w * 0.92, rect.h * 0.92, rect.depth * 0.25, mats.panel);
        return;
      }
      if (cell.type === "screen") {
        addPane(parent, rect.x, rect.y, 0.045, rect.w * 0.92, rect.h * 0.92, mats.screen);
        addGrid(parent, rect, mats.screenLine, 5, 5);
        return;
      }
      if (cell.type === "louver") {
        addThreeLouvers(parent, rect, mats);
        return;
      }
      if (cell.type === "grille") {
        addPane(parent, rect.x, rect.y, 0.02, rect.w * 0.9, rect.h * 0.9, mats.glass);
        addBox(parent, rect.x, rect.y, 0.075, rect.face * 0.18, rect.h * 0.86, rect.depth * 0.32, mats.profile);
        addBox(parent, rect.x, rect.y, 0.075, rect.w * 0.86, rect.face * 0.18, rect.depth * 0.32, mats.profile);
        return;
      }
      if (cell.type === "top_hung" || cell.type === "bottom_hung") {
        const sash = new threeLib.Group();
        const topHinged = cell.type === "top_hung";
        const sashWidth = rect.w * 0.9;
        const sashHeight = rect.h * 0.9;
        sash.position.set(rect.x, rect.y, 0.065);
        addSashFrame(sash, 0, 0, sashWidth, sashHeight, rect.face * 0.38, rect.depth * 0.54, mats.profile);
        addPane(sash, 0, 0, 0.02, rect.w * 0.62, rect.h * 0.62, mats.glass);
        const handleY = (topHinged ? -1 : 1) * sashHeight * 0.34;
        addHorizontalHandle(sash, 0, handleY, rect.depth * 0.58, rect.face, mats.hardware);
        addHorizontalHinges(sash, (topHinged ? 1 : -1) * sashHeight * 0.46, sashWidth, rect.face, rect.depth, mats.hardwareDark);
        parent.add(sash);
        registerOpenable({
          cell,
          key: `${meta.windowId}:${meta.row}:${meta.col}:P1`,
          windowId: meta.windowId,
          windowMark: meta.windowMark,
          row: meta.row,
          col: meta.col,
          object: sash,
          type: cell.type,
          panelLabel: assembly.panels[0]?.label || "开启扇",
          operationOrder: 0,
          width: sashWidth,
          height: sashHeight,
          closedPosition: sash.position.clone(),
          motionMode: "primary",
          current: 0,
          target: 0
        });
        addIntegratedScreen(parent, cell, rect, mats, meta);
        addThreeCellOverlays(parent, cell, rect, mats, assembly);
        return;
      }
      if (cell.type === "turn" || cell.type === "turn_tilt" || cell.type === "door") {
        addSideHungAssembly(parent, cell, rect, mats, meta, assembly);
        addIntegratedScreen(parent, cell, rect, mats, meta);
        addThreeCellOverlays(parent, cell, rect, mats, assembly);
        return;
      }
      if (["sliding", "lift_slide", "psk", "parallel_slide", "pocket_slide"].includes(cell.type)) {
        addSlidingAssembly(parent, cell, rect, mats, meta, assembly);
        addIntegratedScreen(parent, cell, rect, mats, meta);
        addThreeCellOverlays(parent, cell, rect, mats, assembly);
        return;
      }
      if (cell.type === "parallel_project") {
        addParallelProjectCell(parent, cell, rect, mats, meta, assembly);
        addIntegratedScreen(parent, cell, rect, mats, meta);
        addThreeCellOverlays(parent, cell, rect, mats, assembly);
        return;
      }
      if (cell.type === "corner_slide") {
        addCornerSlidingAssembly(parent, cell, rect, mats, meta, assembly);
        addIntegratedScreen(parent, cell, rect, mats, meta);
        addThreeCellOverlays(parent, cell, rect, mats, assembly);
        return;
      }
      if (cell.type === "vertical_slide") {
        addVerticalSlidingAssembly(parent, cell, rect, mats, meta, assembly);
        addIntegratedScreen(parent, cell, rect, mats, meta);
        addThreeCellOverlays(parent, cell, rect, mats, assembly);
        return;
      }
      if (cell.type === "folding") {
        addFoldingCell(parent, cell, rect, mats, meta, assembly);
        addIntegratedScreen(parent, cell, rect, mats, meta);
        addThreeCellOverlays(parent, cell, rect, mats, assembly);
        return;
      }
      if (!cell.customShape) addPane(parent, rect.x, rect.y, 0.02, rect.w * 0.9, rect.h * 0.9, mats.glass);
      addThreeCellOverlays(parent, cell, rect, mats, assembly);
    }

    function addThreeLouvers(parent, rect, mats) {
      const count = Math.max(4, Math.min(9, Math.floor(rect.h / 0.15)));
      for (let i = 1; i <= count; i += 1) {
        const y = rect.y - rect.h / 2 + rect.h * i / (count + 1);
        const slat = addBox(parent, rect.x, y, 0.07, rect.w * 0.82, rect.face * 0.22, rect.depth * 0.3, mats.profile);
        slat.rotation.x = -0.22;
      }
    }

    function addThreeCellOverlays(parent, cell, rect, mats, assembly) {
      const accessories = normalizeCellAccessories(cell.accessories);
      const infillType = normalizeCellInfillType(cell.infillType);
      if (isOperableType(cell.type) && infillType === "panel") {
        addBox(parent, rect.x, rect.y, 0.092, rect.w * 0.68, rect.h * 0.68, rect.depth * 0.12, mats.panel);
      }
      if (isOperableType(cell.type) && infillType === "louver") {
        addThreeLouvers(parent, { ...rect, w: rect.w * 0.72, h: rect.h * 0.72 }, mats);
      }
      if (accessories.grille) {
        addBox(parent, rect.x, rect.y, 0.12, rect.face * 0.14, rect.h * 0.76, rect.depth * 0.2, mats.profile);
        addBox(parent, rect.x, rect.y, 0.12, rect.w * 0.76, rect.face * 0.14, rect.depth * 0.2, mats.profile);
      }
      if (accessories.securityBars) {
        for (let index = 1; index <= 3; index += 1) {
          const x = rect.x - rect.w * 0.32 + rect.w * 0.16 * index;
          addBox(parent, x, rect.y, 0.135, rect.face * 0.11, rect.h * 0.8, rect.depth * 0.18, mats.hardwareDark);
        }
      }
      if (accessories.frosted) {
        addPane(parent, rect.x, rect.y, 0.11, rect.w * 0.72, rect.h * 0.72, mats.glass);
      }
    }

    function addThreeCustomCellGeometry(parent, cell, rect, mats) {
      const shapeData = normalizeCellCustomShape(cell.customShape);
      if (!shapeData || !threeLib) return;
      const group = new threeLib.Group();
      group.position.set(rect.x, rect.y, 0.03);
      addThreeCustomShapeBody(group, shapeData, rect.w * 0.92, rect.h * 0.92, rect.face * 0.26, rect.depth * 0.5, mats);
      parent.add(group);
    }

    function addThreeCustomOperableCell(parent, cell, rect, mats, meta, assembly) {
      const shapeData = normalizeCellCustomShape(cell.customShape);
      if (!shapeData || !threeLib) return;
      const sash = new threeLib.Group();
      const sashWidth = rect.w * 0.9;
      const sashHeight = rect.h * 0.9;
      sash.position.set(rect.x, rect.y, 0.065);
      addThreeCustomShapeBody(sash, shapeData, sashWidth, sashHeight, rect.face * 0.32, rect.depth * 0.54, mats);
      const leftOpening = cell.opening?.startsWith("left") || cell.opening?.endsWith("left");
      if (["turn", "turn_tilt", "door"].includes(cell.type)) {
        addHandle(sash, (leftOpening ? 1 : -1) * sashWidth * 0.34, 0, rect.depth * 0.58, rect.face, mats.hardware);
        addHinges(sash, (leftOpening ? -1 : 1) * sashWidth * 0.46, sashHeight, rect.face, rect.depth, mats.hardwareDark);
      } else if (cell.type === "top_hung" || cell.type === "bottom_hung") {
        const topHinged = cell.type === "top_hung";
        addHorizontalHandle(sash, 0, (topHinged ? -1 : 1) * sashHeight * 0.34, rect.depth * 0.58, rect.face, mats.hardware);
        addHorizontalHinges(sash, (topHinged ? 1 : -1) * sashHeight * 0.46, sashWidth, rect.face, rect.depth, mats.hardwareDark);
      } else {
        addHandle(sash, sashWidth * 0.34, 0, rect.depth * 0.48, rect.face, mats.hardware);
      }
      parent.add(sash);
      const horizontalDirection = cell.opening?.endsWith("right") || assembly.stackSide === "right" ? 1 : -1;
      const verticalDirection = cell.opening === "slide_down" || assembly.stackSide === "bottom" ? -1 : 1;
      const travel = Math.max(sashWidth, sashHeight) * 0.62;
      const motionType = ["corner_slide", "folding"].includes(cell.type) ? "sliding" : cell.type;
      registerOpenable({
        cell,
        key: `${meta.windowId}:${meta.row}:${meta.col}:DIY`,
        windowId: meta.windowId,
        windowMark: meta.windowMark,
        row: meta.row,
        col: meta.col,
        object: sash,
        type: cell.type,
        motionType,
        panelLabel: `${shapeData.name} · ${assembly.panels[0]?.label || "异形扇"}`,
        operationOrder: 0,
        width: sashWidth,
        height: sashHeight,
        shapePoints: shapeData.points,
        shapeWidth: sashWidth,
        shapeHeight: sashHeight,
        travel,
        liftHeight: cell.type === "lift_slide" ? rect.h * 0.035 : 0,
        releaseDepth: ["psk", "parallel_slide", "corner_slide"].includes(cell.type) ? Math.max(0.055, rect.depth * 0.82) : 0,
        projectDepth: cell.type === "parallel_project" ? Math.max(0.22, rect.depth * 3.2) : 0,
        openPlane: assembly.openPlane,
        direction: cell.type === "vertical_slide" ? verticalDirection : horizontalDirection,
        closedPosition: sash.position.clone(),
        motionMode: (cell.type === "turn_tilt" || cell.type === "psk") && assembly.operationPriority === "tilt_first" ? "tilt" : "primary",
        current: 0,
        target: 0
      });
    }

    function addThreeCustomShapeBody(parent, shapeData, width, height, face, depth, mats) {
      const points = shapeData.points.map(point => ({
        x: -width / 2 + point.x / 100 * width,
        y: height / 2 - point.y / 100 * height
      }));
      const shape = new threeLib.Shape();
      points.forEach((point, index) => {
        if (index === 0) shape.moveTo(point.x, point.y);
        else shape.lineTo(point.x, point.y);
      });
      shape.closePath();
      const glassGeometry = new threeLib.ShapeGeometry(shape);
      const glass = new threeLib.Mesh(glassGeometry, mats.glass);
      glass.position.z = 0.01;
      glass.userData.mountType = "diy-cell-glass";
      parent.add(glass);
      const edgeRadius = Math.max(0.008, face * 0.32);
      for (let index = 0; index < points.length; index += 1) {
        const start = points[index];
        const end = points[(index + 1) % points.length];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        if (length <= 0.001) continue;
        const rail = addBox(parent, (start.x + end.x) / 2, (start.y + end.y) / 2, 0.055, length, edgeRadius, depth, mats.profile);
        rail.rotation.z = Math.atan2(dy, dx);
        rail.userData.mountType = "diy-cell-frame";
      }
    }

    function addSideHungAssembly(parent, cell, rect, mats, meta, assembly) {
      const panelCount = assembly.panelCount;
      const totalWidth = rect.w * 0.9;
      const gap = panelCount > 1 && assembly.mullionMode === "fixed_mullion" ? rect.face * 0.16 : rect.face * 0.03;
      const sashWidth = (totalWidth - gap * (panelCount - 1)) / panelCount;
      const sashHeight = rect.h * 0.9;
      assembly.panels.forEach((panel, index) => {
        const sash = new threeLib.Group();
        const x = rect.x - totalWidth / 2 + sashWidth / 2 + index * (sashWidth + gap);
        const panelOpening = `${panel.hingeSide}_${assembly.openPlane}`;
        const panelCell = { ...cell, opening: panelOpening };
        sash.position.set(x, rect.y, 0.065);
        addSashFrame(sash, 0, 0, sashWidth, sashHeight, rect.face * 0.34, rect.depth * 0.54, mats.profile);
        if (cell.type === "door") {
          addBox(sash, 0, -rect.h * 0.08, 0.01, sashWidth * 0.72, rect.h * 0.56, rect.depth * 0.12, mats.door);
        } else {
          addPane(sash, 0, 0, 0.02, sashWidth * 0.72, rect.h * 0.62, mats.glass);
        }
        const left = panel.hingeSide === "left";
        addHandle(sash, (left ? 1 : -1) * sashWidth * 0.34, 0, rect.depth * 0.58, rect.face, mats.hardware);
        addHinges(sash, (left ? -1 : 1) * sashWidth * 0.46, sashHeight, rect.face, rect.depth, mats.hardwareDark);
        parent.add(sash);
        if (!panel.movable) return;
        registerOpenable({
          cell: panelCell,
          key: `${meta.windowId}:${meta.row}:${meta.col}:${panel.id}`,
          windowId: meta.windowId,
          windowMark: meta.windowMark,
          row: meta.row,
          col: meta.col,
          object: sash,
          type: cell.type,
          panelLabel: `${panel.label} · ${panel.role === "primary" ? "主扇" : "从扇"}`,
          operationOrder: panel.operationOrder,
          width: sashWidth,
          height: sashHeight,
          closedPosition: sash.position.clone(),
          motionMode: cell.type === "turn_tilt" && assembly.operationPriority === "tilt_first" ? "tilt" : "primary",
          current: 0,
          target: 0
        });
      });
    }

    function addSlidingAssembly(parent, cell, rect, mats, meta, assembly) {
      const totalWidth = rect.w * 0.92;
      const panelWidth = totalWidth / assembly.panelCount * 1.06;
      const panelHeight = rect.h * 0.86;
      if (cell.type === "pocket_slide") addPocketHousing(parent, rect, mats, assembly);
      assembly.panels.forEach((panel, index) => {
        const sash = new threeLib.Group();
        const x = rect.x - totalWidth / 2 + totalWidth * (index + 0.5) / assembly.panelCount;
        const z = 0.025 + panel.trackIndex * Math.max(0.035, rect.depth * 0.32);
        sash.position.set(x, rect.y, z);
        addSashFrame(sash, 0, 0, panelWidth, panelHeight, rect.face * 0.28, rect.depth * 0.44, mats.profile);
        addPane(sash, 0, 0, 0.015, panelWidth * 0.75, panelHeight * 0.76, mats.glass);
        if (panel.movable) addHandle(sash, panelWidth * 0.34, 0, rect.depth * 0.48, rect.face, mats.hardware);
        parent.add(sash);
        if (!panel.movable) return;
        const direction = assembly.stackSide === "both"
          ? (index < assembly.panelCount / 2 ? -1 : 1)
          : (assembly.stackSide === "right" ? 1 : -1);
        const panelStep = totalWidth / assembly.panelCount;
        const travelPanels = assembly.stackSide === "left"
          ? Math.max(1, index)
          : (assembly.stackSide === "right"
            ? Math.max(1, assembly.panelCount - 1 - index)
            : (index < assembly.panelCount / 2
              ? Math.max(1, index)
              : Math.max(1, assembly.panelCount - 1 - index)));
        registerOpenable({
          cell,
          key: `${meta.windowId}:${meta.row}:${meta.col}:${panel.id}`,
          windowId: meta.windowId,
          windowMark: meta.windowMark,
          row: meta.row,
          col: meta.col,
          object: sash,
          type: cell.type,
          panelLabel: `${panel.label} · ${panel.role === "primary" ? "主扇" : "联动扇"}`,
          operationOrder: panel.operationOrder,
          width: panelWidth,
          height: panelHeight,
          travel: panelStep * travelPanels * 0.96,
          liftHeight: cell.type === "lift_slide" ? rect.h * 0.035 : 0,
          releaseDepth: ["psk", "parallel_slide"].includes(cell.type) ? Math.max(0.055, rect.depth * 0.82) : 0,
          openPlane: assembly.openPlane,
          direction,
          closedPosition: sash.position.clone(),
          motionMode: cell.type === "psk" && assembly.operationPriority === "tilt_first" ? "tilt" : "primary",
          current: 0,
          target: 0
        });
      });
    }

    function addPocketHousing(parent, rect, mats, assembly) {
      const sides = assembly.stackSide === "both" ? [-1, 1] : [assembly.stackSide === "right" ? 1 : -1];
      sides.forEach(side => {
        const lipWidth = Math.max(0.012, rect.face * 0.16);
        const mouthDepth = Math.max(0.035, rect.depth * 0.62);
        const plateDepth = Math.max(0.008, rect.depth * 0.08);
        const mouthHeight = rect.h * 0.9;
        const pocketX = rect.x + side * (rect.w / 2 - lipWidth / 2);
        const pocketMouth = new threeLib.Group();
        pocketMouth.position.set(pocketX, rect.y, -rect.depth * 0.22);
        pocketMouth.userData.mountType = "frame-pocket-mouth";
        addBox(pocketMouth, 0, 0, -mouthDepth / 2, lipWidth, mouthHeight, plateDepth, mats.hardwareDark);
        addBox(pocketMouth, 0, 0, mouthDepth / 2, lipWidth, mouthHeight, plateDepth, mats.hardwareDark);
        addBox(pocketMouth, 0, mouthHeight / 2, 0, lipWidth, rect.face * 0.18, mouthDepth, mats.profile);
        addBox(pocketMouth, 0, -mouthHeight / 2, 0, lipWidth, rect.face * 0.18, mouthDepth, mats.profile);
        parent.add(pocketMouth);
      });
    }

    function addParallelProjectCell(parent, cell, rect, mats, meta, assembly) {
      const sash = new threeLib.Group();
      const sashWidth = rect.w * 0.96;
      const sashHeight = rect.h * 0.94;
      const sashFace = Math.max(rect.face * 0.26, Math.min(sashWidth, sashHeight) * 0.032);
      const projectDepth = Math.max(0.22, rect.depth * 3.2);
      sash.position.set(rect.x, rect.y, 0.065);
      addSashFrame(sash, 0, 0, sashWidth, sashHeight, sashFace, rect.depth * 0.54, mats.profile);
      addPane(
        sash,
        0,
        0,
        0.02,
        Math.max(0.02, sashWidth - sashFace * 2.35),
        Math.max(0.02, sashHeight - sashFace * 2.35),
        mats.glass
      );
      addHorizontalHandle(sash, 0, -sashHeight * 0.36, rect.depth * 0.58, rect.face, mats.hardware);
      for (const x of [-sashWidth * 0.42, sashWidth * 0.42]) {
        for (const y of [-sashHeight * 0.34, sashHeight * 0.34]) {
          addBox(sash, x, y, -rect.depth * 0.36, rect.face * 0.09, rect.face * 0.5, rect.depth * 0.5, mats.hardwareDark);
        }
      }
      parent.add(sash);
      const mechanism = addParallelProjectMechanism(parent, rect, mats, sashWidth, sashHeight, projectDepth, sash.position.z);
      registerOpenable({
        cell,
        key: `${meta.windowId}:${meta.row}:${meta.col}:P1`,
        windowId: meta.windowId,
        windowMark: meta.windowMark,
        row: meta.row,
        col: meta.col,
        object: sash,
        type: cell.type,
        panelLabel: assembly.panels[0]?.label || "平行推出扇",
        operationOrder: 0,
        width: sashWidth,
        height: sashHeight,
        projectDepth,
        mechanismRoot: mechanism.root,
        updateMechanism: ratio => updateParallelProjectMechanism(mechanism, sash, ratio),
        closedPosition: sash.position.clone(),
        motionMode: "primary",
        current: 0,
        target: 0
      });
    }

    function addParallelProjectMechanism(parent, rect, mats, sashWidth, sashHeight, projectDepth, closedSashZ) {
      const THREE = threeLib;
      const root = new THREE.Group();
      root.position.set(rect.x, rect.y, 0);
      root.userData.mountType = "parallel-project-hardware";
      const railX = sashWidth * 0.465;
      const railHeight = sashHeight * 0.72;
      const thickness = Math.max(0.009, rect.face * 0.11);
      addBox(root, -railX, 0, 0, thickness * 1.35, railHeight, thickness, mats.hardwareDark);
      addBox(root, railX, 0, 0, thickness * 1.35, railHeight, thickness, mats.hardwareDark);
      const armGeometry = new THREE.BoxGeometry(1, thickness, thickness * 0.72);
      const pivotGeometry = new THREE.SphereGeometry(thickness * 1.15, 10, 8);
      const armDefinitions = [
        { side: -1, vertical: 1 },
        { side: -1, vertical: -1 },
        { side: 1, vertical: 1 },
        { side: 1, vertical: -1 }
      ];
      const arms = armDefinitions.map(definition => {
        const arm = new THREE.Mesh(armGeometry, mats.hardwareDark);
        const fixedPivot = new THREE.Mesh(pivotGeometry, mats.hardware);
        const movingPivot = new THREE.Mesh(pivotGeometry, mats.hardware);
        arm.castShadow = true;
        fixedPivot.castShadow = true;
        movingPivot.castShadow = true;
        root.add(arm, fixedPivot, movingPivot);
        return { ...definition, arm, fixedPivot, movingPivot };
      });
      parent.add(root);
      const mechanism = {
        root,
        arms,
        sashWidth,
        sashHeight,
        projectDepth,
        closedSashZ,
        framePlaneZ: -rect.depth * 0.16,
        movingPlaneInset: rect.depth * 0.2
      };
      const maximumGap = closedSashZ + projectDepth - mechanism.movingPlaneInset - mechanism.framePlaneZ;
      mechanism.armLength = Math.hypot(maximumGap, sashHeight * 0.12);
      updateParallelProjectMechanism(mechanism, { position: { z: closedSashZ } }, 0);
      return mechanism;
    }

    function updateParallelProjectMechanism(mechanism, sash, ratio) {
      const THREE = threeLib;
      const value = Math.max(0, Math.min(1, Number(ratio) || 0));
      const movingZ = Number(sash.position.z) - mechanism.movingPlaneInset;
      const railX = mechanism.sashWidth * 0.465;
      const movingY = mechanism.sashHeight * 0.405;
      const depthGap = Math.abs(movingZ - mechanism.framePlaneZ);
      const railOffset = Math.sqrt(Math.max(0, mechanism.armLength ** 2 - depthGap ** 2));
      const fixedY = Math.max(mechanism.sashHeight * 0.035, movingY - railOffset);
      mechanism.root.visible = value > 0.015;
      mechanism.arms.forEach(item => {
        const start = new THREE.Vector3(
          item.side * railX,
          item.vertical * fixedY,
          mechanism.framePlaneZ
        );
        const end = new THREE.Vector3(
          item.side * railX,
          item.vertical * movingY,
          movingZ
        );
        setLinkBarBetween(item.arm, start, end);
        item.fixedPivot.position.copy(start);
        item.movingPivot.position.copy(end);
      });
    }

    function setLinkBarBetween(mesh, start, end) {
      const THREE = threeLib;
      const direction = end.clone().sub(start);
      const length = Math.max(0.001, direction.length());
      mesh.position.copy(start).add(end).multiplyScalar(0.5);
      mesh.scale.set(length, 1, 1);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.normalize());
    }

    function addCornerSlidingAssembly(parent, cell, rect, mats, meta, assembly) {
      const leftCount = Math.ceil(assembly.panelCount / 2);
      const rightCount = assembly.panelCount - leftCount;
      const cornerAnchorX = rect.cornerMount?.anchorX ?? rect.x;
      const returnOriginX = rect.cornerMount?.returnOpeningOriginX ?? cornerAnchorX;
      const returnOriginZ = rect.cornerMount?.returnOpeningOriginZ ?? 0;
      const wingSpan = rect.cornerMount?.frontWingSpan ?? rect.w * 0.9;
      const leftPanelWidth = wingSpan / Math.max(1, leftCount) * 1.04;
      const rightPanelWidth = wingSpan / Math.max(1, rightCount) * 1.04;
      const panelHeight = rect.h * 0.86;
      const angle = assembly.cornerAngleDeg * Math.PI / 180;
      const trackStep = Math.max(0.035, rect.depth * 0.32);
      const trackCenter = 0.04 + Math.max(0, assembly.trackCount - 1) * trackStep / 2;
      addCornerTrackFrame(parent, rect, mats, assembly, wingSpan, panelHeight, angle, trackCenter, trackStep, {
        frontAnchorX: cornerAnchorX,
        returnOriginX,
        returnOriginZ,
        structuralPier: rect.cornerMount?.wallCornerMode === "structural_pier"
      });
      assembly.panels.forEach((panel, index) => {
        const rightWing = index >= leftCount;
        const wingIndex = rightWing ? index - leftCount : leftCount - index - 1;
        const panelWidth = rightWing ? rightPanelWidth : leftPanelWidth;
        const distance = (wingIndex + 0.5) * (rightWing ? wingSpan / Math.max(1, rightCount) : wingSpan / leftCount);
        const trackOffset = 0.04 + panel.trackIndex * trackStep;
        const sash = new threeLib.Group();
        if (rightWing) {
          sash.position.set(
            returnOriginX + Math.cos(angle) * distance + Math.sin(angle) * trackOffset,
            rect.y,
            returnOriginZ - Math.sin(angle) * distance + Math.cos(angle) * trackOffset
          );
          sash.rotation.y = angle;
        } else {
          sash.position.set(cornerAnchorX - distance, rect.y, trackOffset);
        }
        addSashFrame(sash, 0, 0, panelWidth, panelHeight, rect.face * 0.27, rect.depth * 0.44, mats.profile);
        addPane(sash, 0, 0, 0.015, panelWidth * 0.72, panelHeight * 0.76, mats.glass);
        if (panel.movable) addHandle(sash, (rightWing ? -1 : 1) * panelWidth * 0.34, 0, rect.depth * 0.48, rect.face, mats.hardware);
        parent.add(sash);
        if (!panel.movable) return;
        const travel = panelWidth * Math.max(1, wingIndex + 1) * 0.92;
        const { travelVector, releaseVector } = cornerSlidingMotionVectors(
          assembly.cornerAngleDeg,
          rightWing,
          travel,
          0
        );
        registerOpenable({
          cell,
          key: `${meta.windowId}:${meta.row}:${meta.col}:${panel.id}`,
          windowId: meta.windowId,
          windowMark: meta.windowMark,
          row: meta.row,
          col: meta.col,
          object: sash,
          type: cell.type,
          panelLabel: `${rightWing ? "右翼" : "左翼"}${panel.label}`,
          operationOrder: panel.operationOrder,
          width: panelWidth,
          height: panelHeight,
          travelVector,
          releaseVector,
          closedPosition: sash.position.clone(),
          closedRotation: sash.rotation.clone(),
          motionMode: "primary",
          current: 0,
          target: 0
        });
      });
      if (assembly.cornerPostMode === "post" && rect.cornerMount?.wallCornerMode !== "structural_pier") {
        addBox(parent, cornerAnchorX, rect.y, 0, rect.face * 0.72, rect.h * 0.94, rect.depth * 0.86, mats.profile);
      }
    }

    function addCornerTrackFrame(parent, rect, mats, assembly, wingSpan, panelHeight, angle, trackCenter, trackStep, mount = {}) {
      const railFace = Math.max(0.018, rect.face * 0.22);
      const railDepth = Math.max(rect.depth * 0.72, trackStep * Math.max(1, assembly.trackCount));
      const railY = panelHeight / 2 + railFace / 2;
      const cornerAnchorX = mount.frontAnchorX ?? rect.x;
      const returnOriginX = mount.returnOriginX ?? cornerAnchorX;
      const returnOriginZ = mount.returnOriginZ ?? 0;
      const frontCenterX = cornerAnchorX - wingSpan / 2;
      addBox(parent, frontCenterX, rect.y + railY, trackCenter, wingSpan, railFace, railDepth, mats.profile);
      addBox(parent, frontCenterX, rect.y - railY, trackCenter, wingSpan, railFace, railDepth, mats.profile);
      addBox(parent, cornerAnchorX - wingSpan, rect.y, trackCenter, railFace, panelHeight + railFace * 2, railDepth, mats.profile);
      if (mount.structuralPier) {
        addBox(parent, cornerAnchorX, rect.y, trackCenter, railFace, panelHeight + railFace * 2, railDepth, mats.profile);
      }

      const returnFrame = new threeLib.Group();
      returnFrame.position.set(returnOriginX, rect.y, returnOriginZ);
      returnFrame.rotation.y = angle;
      addBox(returnFrame, wingSpan / 2, railY, trackCenter, wingSpan, railFace, railDepth, mats.profile);
      addBox(returnFrame, wingSpan / 2, -railY, trackCenter, wingSpan, railFace, railDepth, mats.profile);
      if (mount.structuralPier) {
        addBox(returnFrame, 0, 0, trackCenter, railFace, panelHeight + railFace * 2, railDepth, mats.profile);
      }
      addBox(returnFrame, wingSpan, 0, trackCenter, railFace, panelHeight + railFace * 2, railDepth, mats.profile);
      parent.add(returnFrame);
    }

    function addVerticalSlidingAssembly(parent, cell, rect, mats, meta, assembly) {
      const panelWidth = rect.w * 0.86;
      const panelHeight = rect.h * 0.56;
      assembly.panels.forEach((panel, index) => {
        const sash = new threeLib.Group();
        const y = rect.y + (index === 0 ? 1 : -1) * rect.h * 0.2;
        sash.position.set(rect.x, y, 0.025 + panel.trackIndex * Math.max(0.035, rect.depth * 0.32));
        addSashFrame(sash, 0, 0, panelWidth, panelHeight, rect.face * 0.28, rect.depth * 0.44, mats.profile);
        addPane(sash, 0, 0, 0.015, panelWidth * 0.76, panelHeight * 0.72, mats.glass);
        if (panel.movable) addHorizontalHandle(sash, 0, (index === 0 ? -1 : 1) * panelHeight * 0.32, rect.depth * 0.48, rect.face, mats.hardware);
        parent.add(sash);
        if (!panel.movable) return;
        const direction = assembly.stackSide === "both" ? (index === 0 ? -1 : 1) : (assembly.stackSide === "bottom" ? -1 : 1);
        registerOpenable({
          cell,
          key: `${meta.windowId}:${meta.row}:${meta.col}:${panel.id}`,
          windowId: meta.windowId,
          windowMark: meta.windowMark,
          row: meta.row,
          col: meta.col,
          object: sash,
          type: cell.type,
          panelLabel: `${panel.label} · ${panel.role === "primary" ? "主扇" : "联动扇"}`,
          operationOrder: panel.operationOrder,
          width: panelWidth,
          height: panelHeight,
          travel: rect.h * 0.38,
          direction,
          closedPosition: sash.position.clone(),
          motionMode: "primary",
          current: 0,
          target: 0
        });
      });
    }

    function addFoldingCell(parent, cell, rect, mats, meta, assembly) {
      const panelCount = assembly.panelCount;
      const totalWidth = rect.w * 0.9;
      const panelWidth = totalWidth / panelCount;
      const panelHeight = rect.h * 0.86;
      if (assembly.stackSide === "both") {
        const leftCount = Math.ceil(panelCount / 2);
        addFoldingGroup(parent, cell, rect, mats, meta, assembly, leftCount, panelWidth, panelHeight, "left", 0);
        addFoldingGroup(parent, cell, rect, mats, meta, assembly, panelCount - leftCount, panelWidth, panelHeight, "right", 1);
        return;
      }
      addFoldingGroup(parent, cell, rect, mats, meta, assembly, panelCount, panelWidth, panelHeight, assembly.stackSide, 0);
    }

    function addFoldingGroup(parent, cell, rect, mats, meta, assembly, panelCount, panelWidth, panelHeight, side, order) {
      if (panelCount < 1) return;
      const totalWidth = rect.w * 0.9;
      const foldsRight = side === "right";
      const direction = foldsRight ? -1 : 1;
      const foldingRoot = new threeLib.Group();
      foldingRoot.position.set(rect.x + (foldsRight ? 1 : -1) * totalWidth / 2, rect.y, 0.065);
      const foldSegments = [];
      let chain = foldingRoot;
      for (let index = 0; index < panelCount; index += 1) {
        const segment = new threeLib.Group();
        if (index > 0) segment.position.x = direction * panelWidth;
        addSashFrame(segment, direction * panelWidth / 2, 0, panelWidth * 0.96, panelHeight, rect.face * 0.27, rect.depth * 0.48, mats.profile);
        addPane(segment, direction * panelWidth / 2, 0, 0.015, panelWidth * 0.68, panelHeight * 0.76, mats.glass);
        chain.add(segment);
        foldSegments.push(segment);
        chain = segment;
      }
      addHandle(foldSegments[panelCount - 1], direction * panelWidth * 0.2, 0, rect.depth * 0.54, rect.face, mats.hardware);
      parent.add(foldingRoot);
      registerOpenable({
        cell,
        key: `${meta.windowId}:${meta.row}:${meta.col}:fold-${side}`,
        windowId: meta.windowId,
        windowMark: meta.windowMark,
        row: meta.row,
        col: meta.col,
        object: foldingRoot,
        type: cell.type,
        panelLabel: `${foldsRight ? "右" : "左"}侧${panelCount}扇折叠组`,
        operationOrder: order,
        width: totalWidth,
        height: panelHeight,
        direction,
        openPlane: assembly.openPlane,
        foldSegments,
        closedPosition: foldingRoot.position.clone(),
        motionMode: "primary",
        current: 0,
        target: 0
      });
    }

    function addIntegratedScreen(parent, cell, rect, mats, meta) {
      const assembly = cell.openingAssembly;
      const mode = assembly?.screenMode && assembly.screenMode !== "none"
        ? assembly.screenMode
        : normalizeCellAccessories(cell.accessories).screenMode;
      if (!mode || mode === "none") return;
      const screen = new threeLib.Group();
      const width = rect.w * 0.88;
      const height = rect.h * 0.86;
      screen.position.set(rect.x, rect.y, -Math.max(0.055, rect.depth * 0.52));
      addSashFrame(screen, 0, 0, width, height, rect.face * 0.18, rect.depth * 0.22, mats.screenLine);
      addPane(screen, 0, 0, 0.01, width * 0.88, height * 0.88, mats.screen);
      addGrid(screen, { x: 0, y: 0, w: width, h: height, face: rect.face, depth: rect.depth }, mats.screenLine, 6, 7);
      parent.add(screen);
      if (mode === "fixed") return;
      const direction = assembly.primarySide === "right" ? 1 : -1;
      registerOpenable({
        cell: { ...cell, opening: `${assembly.primarySide}_in` },
        key: `${meta.windowId}:${meta.row}:${meta.col}:screen`,
        windowId: meta.windowId,
        windowMark: meta.windowMark,
        row: meta.row,
        col: meta.col,
        object: screen,
        type: cell.type,
        motionType: mode === "swing" ? "turn" : (mode === "sliding" ? "sliding" : "retractable_screen"),
        panelLabel: mode === "swing" ? "平开纱扇" : (mode === "sliding" ? "推拉纱扇" : "卷轴纱窗"),
        operationOrder: 100,
        width,
        height,
        travel: rect.w * 0.42,
        direction,
        closedPosition: screen.position.clone(),
        closedScale: screen.scale.clone(),
        motionMode: "primary",
        current: 0,
        target: 0
      });
    }

    function addShowroomOpening(parent, width, height, face, depth, mats, win, scale, cornerMount = null, showOrientationLabels = true) {
      const geometry = surroundGeometry(win.installation?.surround, win.widthMm, win.heightMm);
      const installation = geometry.surround;
      const sillHeight = Math.max(0, Number(win.installation?.sillHeightMm || 0)) * scale;
      const wallMarginMm = Math.max(420, Math.min(900, Math.min(win.widthMm, win.heightMm) * 0.35));
      const wallBand = Math.max(face * 2.4, wallMarginMm * scale);
      const wallDepth = Math.max(0.06, installation.wallThicknessMm * scale);
      const section = resolveInstallationSection(installation, depth / scale);
      // +Z is outside. frameOffsetMm is positive toward inside, so the wall center
      // moves by the same signed amount while the frame remains at local Z = 0.
      const wallCenterZ = section.wallCenterMm * scale;
      const floorY = -height / 2 - sillHeight;
      const openingTopY = height / 2;
      const sideHeight = openingTopY - floorY;
      const sideCenterY = floorY + sideHeight / 2;
      const frontLeftX = cornerMount?.frontLeftX ?? -width / 2;
      const frontSpan = cornerMount?.frontSpan ?? width;
      const frontRightX = frontLeftX + frontSpan;
      const topStartX = frontLeftX - wallBand;
      const topEndX = frontRightX + (cornerMount ? 0 : wallBand);
      if (cornerMount) {
        addCornerReturnWall(parent, cornerMount, height, sillHeight, face, depth, wallBand, wallDepth, wallCenterZ, mats);
      } else {
        if (!isRectangularWindowShape(win)) {
          addThreeWallPanelWithOpening(
            parent,
            windowShapePoints3d(win, width, height),
            { left: topStartX, right: topEndX, bottom: floorY, top: height / 2 + wallBand },
            wallDepth,
            wallCenterZ,
            mats.wall
          );
        } else {
          addBox(parent, (topStartX + topEndX) / 2, height / 2 + wallBand / 2, wallCenterZ, topEndX - topStartX, wallBand, wallDepth, mats.wall);
          addBox(parent, frontLeftX - wallBand / 2, sideCenterY, wallCenterZ, wallBand, sideHeight, wallDepth, mats.wall);
          addBox(parent, frontRightX + wallBand / 2, sideCenterY, wallCenterZ, wallBand, sideHeight, wallDepth, mats.wall);
          if (sillHeight > 0.001) {
            addBox(parent, frontLeftX + frontSpan / 2, floorY + sillHeight / 2, wallCenterZ, frontSpan, sillHeight, wallDepth, mats.wall);
          }
        }
        addBox(parent, frontLeftX + frontSpan / 2, -height / 2 + face * 0.18, depth * 0.05, frontSpan + face * 1.05, face * 0.3, depth * 2.5, mats.sill);
      }
      if (showOrientationLabels) addThreeOrientationLabels(parent, frontLeftX, frontSpan, floorY, wallDepth, wallCenterZ, cornerMount);
      if (!installation.enabled) return;
      const boardThickness = Math.max(0.012, installation.boardThicknessMm * scale);
      if (geometry.linerEnabled) {
        const linerThickness = Math.max(boardThickness, face * 0.3);
        geometry.sides.forEach(side => addThreeSurroundLinerSide(parent, side, width, height, linerThickness, wallDepth, wallCenterZ, mats.surroundLiner));
      }
      if (geometry.outsideEnabled) {
        const trimWidth = Math.max(face * 0.72, installation.outsideWidthMm * scale);
        const z = wallCenterZ + wallDepth / 2 + boardThickness / 2;
        geometry.sides.forEach(side => addThreeSurroundSide(parent, side, width, height, trimWidth, boardThickness, z, mats.surroundOutside));
      }
      if (geometry.insideEnabled) {
        const trimWidth = Math.max(face * 0.72, installation.insideWidthMm * scale);
        const z = wallCenterZ - wallDepth / 2 - boardThickness / 2;
        geometry.sides.forEach(side => addThreeSurroundSide(parent, side, width, height, trimWidth, boardThickness, z, mats.surroundInside));
      }
    }

    function addThreeWallPanelWithOpening(parent, openingPoints, bounds, wallDepth, wallCenterZ, material) {
      const THREE = threeLib;
      if (!THREE || !Array.isArray(openingPoints) || openingPoints.length < 3) return;
      const shape = new THREE.Shape();
      shape.moveTo(bounds.left, bounds.bottom);
      shape.lineTo(bounds.right, bounds.bottom);
      shape.lineTo(bounds.right, bounds.top);
      shape.lineTo(bounds.left, bounds.top);
      shape.closePath();
      const hole = new THREE.Path();
      [...openingPoints].reverse().forEach((point, index) => {
        if (index === 0) hole.moveTo(point.x, point.y);
        else hole.lineTo(point.x, point.y);
      });
      hole.closePath();
      shape.holes.push(hole);
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: wallDepth,
        bevelEnabled: false,
        curveSegments: 8,
        steps: 1
      });
      geometry.translate(0, 0, wallCenterZ - wallDepth / 2);
      geometry.computeVertexNormals();
      applyScaledWallUvs(geometry, material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.mountType = "shaped-wall-opening";
      parent.add(mesh);
      return mesh;
    }

    function addThreeCustomCellWallOpenings(parent, win, colEdges, rowEdges, face, depth, mats, scale, cornerMount) {
      if (cornerMount) return;
      const customCells = win.layout.cells
        .map((cell, index) => ({ cell, index }))
        .filter(item => normalizeCellCustomShape(item.cell?.customShape));
      if (!customCells.length) return;
      const installation = normalizeSurround(win.installation?.surround);
      const section = resolveInstallationSection(installation, depth / scale);
      const wallDepth = Math.max(0.06, installation.wallThicknessMm * scale);
      const wallCenterZ = section.wallCenterMm * scale;
      const cols = win.layout.columns.length;
      const rows = win.layout.rows.length;
      const pad = Math.max(face * 0.38, wallDepth * 0.08);
      customCells.forEach(({ cell, index }) => {
        const shape = normalizeCellCustomShape(cell.customShape);
        const row = Math.floor(index / cols);
        const col = index % cols;
        const left = colEdges[col] + face * 0.11;
        const right = colEdges[col + 1] - face * 0.11;
        const bottom = rowEdges[rows - row - 1] + face * 0.11;
        const top = rowEdges[rows - row] - face * 0.11;
        if (right - left <= face || top - bottom <= face) return;
        const openingPoints = shape.points.map(point => ({
          x: left + point.x / 100 * (right - left),
          y: top - point.y / 100 * (top - bottom)
        }));
        addThreeWallPanelWithOpening(
          parent,
          openingPoints,
          {
            left: left - pad,
            right: right + pad,
            bottom: bottom - pad,
            top: top + pad
          },
          wallDepth,
          wallCenterZ,
          mats.wall
        );
      });
    }

    function addCornerReturnWall(parent, cornerMount, height, sillHeight, face, depth, wallBand, wallDepth, wallCenterZ, mats) {
      const floorY = -height / 2 - sillHeight;
      const sideHeight = height / 2 - floorY;
      const angle = cornerMount.angle;
      const returnDirection = { x: Math.cos(angle), z: -Math.sin(angle) };
      const returnNormal = { x: Math.sin(angle), z: Math.cos(angle) };
      const wallCorner = { x: cornerMount.wallCornerX, z: 0 };
      const returnCenterOrigin = {
        x: wallCorner.x + returnNormal.x * wallCenterZ,
        z: wallCorner.z + returnNormal.z * wallCenterZ
      };
      const wallJoint = lineIntersection2d(
        { x: wallCorner.x, z: wallCenterZ },
        { x: 1, z: 0 },
        returnCenterOrigin,
        returnDirection
      ) || { x: wallCorner.x, z: wallCenterZ };
      const mainTopStart = { x: cornerMount.frontLeftX - wallBand, z: wallCenterZ };
      const returnTopEnd = {
        x: returnCenterOrigin.x + returnDirection.x * (cornerMount.returnOpeningOffset + cornerMount.returnSpan + wallBand),
        z: returnCenterOrigin.z + returnDirection.z * (cornerMount.returnOpeningOffset + cornerMount.returnSpan + wallBand)
      };
      addMiteredWallBand(parent, [mainTopStart, wallJoint, returnTopEnd], height / 2, wallBand, wallDepth, mats.wall);

      addBox(parent, cornerMount.frontLeftX - wallBand / 2, floorY + sideHeight / 2, wallCenterZ, wallBand, sideHeight, wallDepth, mats.wall);
      const returnWall = new threeLib.Group();
      returnWall.position.set(cornerMount.wallCornerX, 0, 0);
      returnWall.rotation.y = angle;
      addBox(returnWall, cornerMount.returnOpeningOffset + cornerMount.returnSpan + wallBand / 2, floorY + sideHeight / 2, wallCenterZ, wallBand, sideHeight, wallDepth, mats.wall);
      parent.add(returnWall);
      addThreeCornerWallPier(parent, cornerMount, floorY, height / 2, wallDepth, wallCenterZ, mats.wall);

      if (sillHeight > 0.001) {
        const mainLowerStart = { x: cornerMount.frontLeftX, z: wallCenterZ };
        const returnLowerEnd = {
          x: returnCenterOrigin.x + returnDirection.x * (cornerMount.returnOpeningOffset + cornerMount.returnSpan),
          z: returnCenterOrigin.z + returnDirection.z * (cornerMount.returnOpeningOffset + cornerMount.returnSpan)
        };
        addMiteredWallBand(parent, [mainLowerStart, wallJoint, returnLowerEnd], floorY, sillHeight, wallDepth, mats.wall);
      }

      const sillEndDistance = cornerMount.returnOpeningOffset + cornerMount.returnSpan + face * 0.52;
      const sillPath = [
        { x: cornerMount.frontLeftX - face * 0.52, z: depth * 0.05 },
        wallCorner,
        {
          x: wallCorner.x + returnDirection.x * sillEndDistance + returnNormal.x * depth * 0.05,
          z: wallCorner.z + returnDirection.z * sillEndDistance + returnNormal.z * depth * 0.05
        }
      ];
      addMiteredWallBand(parent, sillPath, -height / 2 + face * 0.03, face * 0.3, depth * 2.5, mats.sill);
    }

    function addThreeCornerWallPier(parent, cornerMount, floorY, openingTopY, wallDepth, wallCenterZ, material) {
      if (cornerMount.wallCornerMode !== "structural_pier") return;
      const returnDirection = { x: Math.cos(cornerMount.angle), z: -Math.sin(cornerMount.angle) };
      const returnNormal = { x: Math.sin(cornerMount.angle), z: Math.cos(cornerMount.angle) };
      const wallCorner = { x: cornerMount.wallCornerX, z: 0 };
      const returnCenterOrigin = {
        x: wallCorner.x + returnNormal.x * wallCenterZ,
        z: wallCorner.z + returnNormal.z * wallCenterZ
      };
      const wallJoint = lineIntersection2d(
        { x: wallCorner.x, z: wallCenterZ },
        { x: 1, z: 0 },
        returnCenterOrigin,
        returnDirection
      ) || { x: wallCorner.x, z: wallCenterZ };
      const returnEnd = {
        x: returnCenterOrigin.x + returnDirection.x * cornerMount.returnOpeningOffset,
        z: returnCenterOrigin.z + returnDirection.z * cornerMount.returnOpeningOffset
      };
      const pier = addMiteredWallBand(
        parent,
        [{ x: cornerMount.anchorX, z: wallCenterZ }, wallJoint, returnEnd],
        floorY,
        openingTopY - floorY,
        wallDepth,
        material
      );
      if (pier) pier.userData.mountType = "structural-corner-wall-pier";
    }

    function addMiteredWallBand(parent, centerPath, bottomY, bandHeight, thickness, material) {
      const THREE = threeLib;
      const polygon = miteredPathPolygon(centerPath, thickness / 2);
      if (!THREE || polygon.length < 3 || bandHeight <= 0 || thickness <= 0) return;
      const shape = new THREE.Shape();
      polygon.forEach((point, index) => {
        const method = index === 0 ? "moveTo" : "lineTo";
        shape[method](point.x, -point.z);
      });
      shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: bandHeight,
        bevelEnabled: false,
        curveSegments: 1,
        steps: 1
      });
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, bottomY, 0);
      geometry.computeVertexNormals();
      applyScaledWallUvs(geometry, material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.mountType = "continuous-corner-wall";
      parent.add(mesh);
      return mesh;
    }

    function miteredPathPolygon(points, halfWidth) {
      if (!Array.isArray(points) || points.length !== 3) return [];
      const [start, joint, end] = points;
      const firstDirection = normalizePlanVector({ x: joint.x - start.x, z: joint.z - start.z });
      const secondDirection = normalizePlanVector({ x: end.x - joint.x, z: end.z - joint.z });
      if (!firstDirection || !secondDirection) return [];
      const firstNormal = { x: -firstDirection.z, z: firstDirection.x };
      const secondNormal = { x: -secondDirection.z, z: secondDirection.x };
      const offsetJoin = side => {
        const firstOffset = {
          x: joint.x + firstNormal.x * halfWidth * side,
          z: joint.z + firstNormal.z * halfWidth * side
        };
        const secondOffset = {
          x: joint.x + secondNormal.x * halfWidth * side,
          z: joint.z + secondNormal.z * halfWidth * side
        };
        const intersection = lineIntersection2d(firstOffset, firstDirection, secondOffset, secondDirection);
        if (intersection && Math.hypot(intersection.x - joint.x, intersection.z - joint.z) <= halfWidth * 5) return intersection;
        const combined = normalizePlanVector({ x: firstNormal.x + secondNormal.x, z: firstNormal.z + secondNormal.z });
        const fallback = combined || firstNormal;
        return {
          x: joint.x + fallback.x * halfWidth * side,
          z: joint.z + fallback.z * halfWidth * side
        };
      };
      return [
        { x: start.x + firstNormal.x * halfWidth, z: start.z + firstNormal.z * halfWidth },
        offsetJoin(1),
        { x: end.x + secondNormal.x * halfWidth, z: end.z + secondNormal.z * halfWidth },
        { x: end.x - secondNormal.x * halfWidth, z: end.z - secondNormal.z * halfWidth },
        offsetJoin(-1),
        { x: start.x - firstNormal.x * halfWidth, z: start.z - firstNormal.z * halfWidth }
      ];
    }

    function normalizePlanVector(vector) {
      const length = Math.hypot(vector.x, vector.z);
      if (length < 0.000001) return null;
      return { x: vector.x / length, z: vector.z / length };
    }

    function lineIntersection2d(originA, directionA, originB, directionB) {
      const determinant = directionA.x * directionB.z - directionA.z * directionB.x;
      if (Math.abs(determinant) < 0.000001) return null;
      const dx = originB.x - originA.x;
      const dz = originB.z - originA.z;
      const distance = (dx * directionB.z - dz * directionB.x) / determinant;
      return {
        x: originA.x + directionA.x * distance,
        z: originA.z + directionA.z * distance
      };
    }

    function addThreeOrientationLabels(parent, frontLeftX, frontSpan, floorY, wallDepth, wallCenterZ, cornerMount) {
      const x = frontLeftX + frontSpan * (cornerMount ? 0.42 : 0.5);
      const offset = Math.max(0.42, wallDepth * 1.15);
      const labelY = floorY + 0.012;
      const outside = createThreeGroundSideLabel("室外", "#1769aa", false);
      const inside = createThreeGroundSideLabel("室内", "#0f766e", true);
      outside.position.set(x, labelY, wallCenterZ + wallDepth / 2 + offset);
      inside.position.set(x, labelY, wallCenterZ - wallDepth / 2 - offset);
      outside.userData.side = "outside";
      inside.userData.side = "inside";
      parent.add(outside, inside);
    }

    function createThreeGroundSideLabel(text, color, reverse) {
      const THREE = threeLib;
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 96;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "rgba(255,255,255,0.94)";
      context.strokeStyle = color;
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(16, 8);
      context.lineTo(240, 8);
      context.quadraticCurveTo(248, 8, 248, 16);
      context.lineTo(248, 80);
      context.quadraticCurveTo(248, 88, 240, 88);
      context.lineTo(16, 88);
      context.quadraticCurveTo(8, 88, 8, 80);
      context.lineTo(8, 16);
      context.quadraticCurveTo(8, 8, 16, 8);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = color;
      context.font = '700 38px "Microsoft YaHei", sans-serif';
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, 128, 49);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3
      });
      const marker = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.195), material);
      marker.rotation.x = -Math.PI / 2;
      marker.rotation.z = reverse ? Math.PI : 0;
      marker.renderOrder = 12;
      marker.userData.mountType = "ground-orientation-label";
      return marker;
    }

    function addThreeSurroundLinerSide(parent, side, width, height, thickness, depth, z, material) {
      if (side === "top") {
        addBox(parent, 0, height / 2 - thickness / 2, z, width, thickness, depth, material);
      } else if (side === "right") {
        addBox(parent, width / 2 - thickness / 2, 0, z, thickness, height, depth, material);
      } else if (side === "bottom") {
        addBox(parent, 0, -height / 2 + thickness / 2, z, width, thickness, depth, material);
      } else {
        addBox(parent, -width / 2 + thickness / 2, 0, z, thickness, height, depth, material);
      }
    }

    function addThreeSurroundSide(parent, side, width, height, faceWidth, depth, z, material) {
      if (side === "top") {
        addBox(parent, 0, height / 2 + faceWidth / 2, z, width + faceWidth * 2, faceWidth, depth, material);
      } else if (side === "right") {
        addBox(parent, width / 2 + faceWidth / 2, 0, z, faceWidth, height, depth, material);
      } else if (side === "bottom") {
        addBox(parent, 0, -height / 2 - faceWidth / 2, z, width + faceWidth * 2, faceWidth, depth, material);
      } else {
        addBox(parent, -width / 2 - faceWidth / 2, 0, z, faceWidth, height, depth, material);
      }
    }

    function registerOpenable(part) {
      [part.object, part.mechanismRoot].filter(Boolean).forEach(root => {
        root.traverse(item => {
          item.userData.openableKey = part.key;
        });
      });
      preview3d.openables.push(part);
      applyOpeningState(part, 0);
    }

    function applyOpeningState(part, ratio) {
      applyOpeningTransform(part, ratio);
    }

    function addHandle(parent, x, y, z, face, material) {
      addBox(parent, x, y, z, Math.max(0.025, face * 0.15), Math.max(0.12, face * 1.7), Math.max(0.018, face * 0.12), material);
      addBox(parent, x, y, z + Math.max(0.018, face * 0.12), Math.max(0.018, face * 0.1), Math.max(0.035, face * 0.32), Math.max(0.035, face * 0.32), material);
    }

    function addHorizontalHandle(parent, x, y, z, face, material) {
      addBox(parent, x, y, z, Math.max(0.12, face * 1.7), Math.max(0.025, face * 0.15), Math.max(0.018, face * 0.12), material);
      addBox(parent, x, y, z + Math.max(0.018, face * 0.12), Math.max(0.035, face * 0.32), Math.max(0.018, face * 0.1), Math.max(0.035, face * 0.32), material);
    }

    function addHinges(parent, x, height, face, depth, material) {
      for (const y of [-height * 0.31, height * 0.31]) {
        addBox(parent, x, y, depth * 0.18, Math.max(0.02, face * 0.13), Math.max(0.055, face * 0.55), Math.max(0.025, depth * 0.22), material);
      }
    }

    function addHorizontalHinges(parent, y, width, face, depth, material) {
      for (const x of [-width * 0.31, width * 0.31]) {
        addBox(parent, x, y, depth * 0.18, Math.max(0.055, face * 0.55), Math.max(0.02, face * 0.13), Math.max(0.025, depth * 0.22), material);
      }
    }

    function currentPreviewPart() {
      return preview3d.openables.find(part => part.key === preview3d.selectedPartKey) || null;
    }

    function selectedPreviewParts() {
      return preview3d.openables.filter(part => preview3d.selectedPartKeys.has(part.key));
    }

    function previewPartLabel(part) {
      const component = part.panelLabel || typeLabels[part.type] || part.type;
      const windowPrefix = part.windowMark ? `${part.windowMark} · ` : "";
      return `${windowPrefix}${part.col + 1}列${part.row + 1}行 · ${component}`;
    }

    function previewPartDirection(part) {
      if (part.motionType === "retractable_screen") return "横向卷收";
      if (part.motionType === "sliding" && part.panelLabel?.includes("纱")) return "轨道推拉";
      if (part.motionType === "turn" && part.panelLabel?.includes("纱")) return "平开";
      if (part.type === "folding") return `${part.cell.openingAssembly?.openPlane === "in" ? "室内" : "室外"}折叠`;
      return openingLabel(part.type, part.cell.opening);
    }

    function updatePreviewPartOptions() {
      const list = document.getElementById("previewPartList");
      if (!list) return;
      const items = preview3d.openables.map(part => {
        const selected = preview3d.selectedPartKeys.has(part.key);
        const direction = previewPartDirection(part);
        return `
          <button class="preview-part-item ${selected ? "selected" : ""}" data-preview-part="${escapeHtml(part.key)}"
            role="option" aria-selected="${selected}">
            <span class="preview-part-check">${selected ? "✓" : ""}</span>
            <span><strong>${escapeHtml(previewPartLabel(part))}</strong><small>${escapeHtml(direction)}</small></span>
          </button>
        `;
      }).join("");
      list.innerHTML = items || '<div class="preview-part-empty">当前窗型没有可开启构件</div>';
      list.setAttribute("aria-multiselectable", String(preview3d.selectionMode === "multiple"));
      document.querySelectorAll(".preview-select-mode").forEach(button => {
        const active = button.dataset.previewSelectMode === preview3d.selectionMode;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      const count = document.getElementById("previewSelectionCount");
      if (count) count.textContent = `已选 ${selectedPreviewParts().length}`;
      updatePreviewMotionControls();
    }

    function setPreviewSelectionMode(mode) {
      preview3d.selectionMode = mode === "multiple" ? "multiple" : "single";
      if (preview3d.selectionMode === "single" && preview3d.selectedPartKeys.size > 1) {
        const key = preview3d.selectedPartKeys.has(preview3d.selectedPartKey)
          ? preview3d.selectedPartKey
          : [...preview3d.selectedPartKeys][0];
        preview3d.selectedPartKeys = new Set(key ? [key] : []);
      }
      preview3d.selectedPartKey = preview3d.selectedPartKeys.has(preview3d.selectedPartKey)
        ? preview3d.selectedPartKey
        : ([...preview3d.selectedPartKeys][0] || "");
      hidePreviewContextMenu();
      updatePreviewPartOptions();
      updatePreviewSelection();
    }

    function updatePreviewMotionControls() {
      const parts = selectedPreviewParts();
      const part = currentPreviewPart() || parts[0] || null;
      const tiltPart = parts.find(item => ["turn_tilt", "psk"].includes(item.motionType || item.type));
      const mode = document.getElementById("previewMotionMode");
      const range = document.getElementById("previewOpenRange");
      const partButtons = ["btnPartClose", "btnPartOpen"];
      const allButtons = ["btnAllClose", "btnAllOpen"];
      mode.disabled = !tiltPart;
      mode.value = tiltPart?.motionMode || "primary";
      const primaryOption = mode.querySelector('option[value="primary"]');
      if (primaryOption) {
        primaryOption.textContent = parts.length > 1
          ? "按各构件开启"
          : motionLabelForType(part?.motionType || part?.type, "primary");
      }
      range.disabled = parts.length === 0;
      partButtons.forEach(id => { document.getElementById(id).disabled = parts.length === 0; });
      allButtons.forEach(id => { document.getElementById(id).disabled = preview3d.openables.length === 0; });
      const playButton = document.getElementById("btnPlaySelected");
      if (playButton) {
        playButton.disabled = parts.length === 0;
        playButton.textContent = preview3d.playback?.active ? "停止播放" : "播放选中开合";
      }
      updatePreviewMotionReadout();
    }

    function updatePreviewMotionReadout() {
      const parts = selectedPreviewParts();
      const part = currentPreviewPart() || parts[0] || null;
      const average = parts.length ? sum(parts.map(item => item.current)) / parts.length : 0;
      const value = Math.round(average * 100);
      const range = document.getElementById("previewOpenRange");
      const output = document.getElementById("previewOpenValue");
      const status = document.getElementById("previewMotionStatus");
      if (range && document.activeElement !== range) range.value = String(value);
      if (output) output.value = `${value}%`;
      if (!status) return;
      if (!parts.length || !part) {
        status.textContent = preview3d.openables.length
          ? "请选择一个或多个可开启构件。"
          : "当前窗型没有可开启构件。";
        return;
      }
      if (preview3d.playback?.active) {
        const phase = preview3d.playback.phase === "opening" ? "正在开启" : "正在关闭";
        const step = Math.min(preview3d.playback.index + 1, preview3d.playback.keys.length);
        status.textContent = `正在演示 ${parts.length} 个构件 · ${phase} ${step}/${preview3d.playback.keys.length} · ${value}%`;
        return;
      }
      if (parts.length > 1) {
        status.textContent = `已选择 ${parts.length} 个可开启构件 · 平均开启 ${value}%`;
        return;
      }
      const action = `${previewPartDirection(part)} / ${motionLabelForType(part.motionType || part.type, part.motionMode)}`;
      status.textContent = `${previewPartLabel(part)} · ${action} · 开启${value}%`;
    }

    function selectPreviewPart(key, options = {}) {
      const part = preview3d.openables.find(item => item.key === key);
      if (!part) return;
      const additive = options.additive ?? (preview3d.selectionMode === "multiple");
      if (options.exclusive || !additive) {
        preview3d.selectedPartKeys = new Set([key]);
      } else if (options.toggle !== false && preview3d.selectedPartKeys.has(key)) {
        preview3d.selectedPartKeys.delete(key);
      } else {
        preview3d.selectedPartKeys.add(key);
      }
      preview3d.selectedPartKey = preview3d.selectedPartKeys.has(key)
        ? key
        : ([...preview3d.selectedPartKeys][0] || "");
      const primary = currentPreviewPart();
      if (primary) {
        if (primary.windowId) selectedWindowId = primary.windowId;
        selectedCell = { row: primary.row, col: primary.col };
      }
      stopPreviewPlayback();
      updatePreviewPartOptions();
      updatePreviewSelection();
    }

    function updatePreviewSelection() {
      const THREE = threeLib;
      const root = preview3d.group;
      if (!THREE || !root) return;
      preview3d.selectionHelpers.forEach(helper => {
        root.remove(helper);
        disposeThreeHelper(helper);
      });
      preview3d.selectionHelpers = selectedPreviewParts().map(part => {
        const color = part.key === preview3d.selectedPartKey ? 0xff9f1c : 0x1677ff;
        const helper = createPartSelectionHelper(part, color) || new THREE.BoxHelper(part.object, color);
        helper.userData.openableKey = part.key;
        helper.visible = part.current <= 0.001 && part.target <= 0.001 && !preview3d.playback?.active;
        helper.traverse?.(item => {
          if (!item.material) return;
          item.material.depthTest = false;
        });
        if (helper.material) helper.material.depthTest = false;
        helper.renderOrder = 20;
        root.add(helper);
        return helper;
      });
    }

    function disposeThreeHelper(helper) {
      helper.traverse?.(item => {
        item.geometry?.dispose?.();
        if (Array.isArray(item.material)) item.material.forEach(material => material.dispose?.());
        else item.material?.dispose?.();
      });
      helper.geometry?.dispose?.();
      if (Array.isArray(helper.material)) helper.material.forEach(material => material.dispose?.());
      else helper.material?.dispose?.();
    }

    function createPartSelectionHelper(part, color) {
      const THREE = threeLib;
      const root = preview3d.group;
      if (!THREE || !root || !Array.isArray(part.shapePoints) || part.shapePoints.length < 3) return null;
      const width = Number(part.shapeWidth || part.width);
      const height = Number(part.shapeHeight || part.height);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
      root.updateMatrixWorld(true);
      part.object.updateMatrixWorld(true);
      const vertices = [];
      const points = part.shapePoints.map(point => new THREE.Vector3(
        -width / 2 + point.x / 100 * width,
        height / 2 - point.y / 100 * height,
        0.115
      ));
      for (let index = 0; index < points.length; index += 1) {
        const start = points[index].clone().applyMatrix4(part.object.matrixWorld);
        const end = points[(index + 1) % points.length].clone().applyMatrix4(part.object.matrixWorld);
        root.worldToLocal(start);
        root.worldToLocal(end);
        vertices.push(start.x, start.y, start.z, end.x, end.y, end.z);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      const material = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 });
      const helper = new THREE.LineSegments(geometry, material);
      helper.userData.mountType = "diy-shape-selection";
      return helper;
    }

    function threePartKeyAt(event) {
      const canvas = document.getElementById("preview3d");
      if (!canvas || !preview3d.raycaster || !preview3d.pointer || !preview3d.camera || !preview3d.group) return "";
      const rect = canvas.getBoundingClientRect();
      preview3d.pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      preview3d.raycaster.setFromCamera(preview3d.pointer, preview3d.camera);
      const hit = preview3d.raycaster.intersectObjects(preview3d.group.children, true)
        .find(item => item.object.userData.openableKey);
      return hit?.object.userData.openableKey || "";
    }

    function selectThreePartAt(event, showMenu = false, contextClick = false) {
      const key = threePartKeyAt(event);
      if (!key) {
        if (preview3d.selectionMode === "single") {
          preview3d.selectedPartKeys.clear();
          preview3d.selectedPartKey = "";
          updatePreviewPartOptions();
          updatePreviewSelection();
        }
        hidePreviewContextMenu();
        return;
      }
      const modified = event.ctrlKey || event.metaKey || event.shiftKey;
      if (modified && !contextClick) preview3d.selectionMode = "multiple";
      if (contextClick && preview3d.selectedPartKeys.has(key)) {
        preview3d.selectedPartKey = key;
        updatePreviewSelection();
      } else {
        selectPreviewPart(key, {
          additive: !contextClick && (preview3d.selectionMode === "multiple" || modified),
          toggle: !contextClick && (preview3d.selectionMode === "multiple" || modified),
          exclusive: contextClick && !preview3d.selectedPartKeys.has(key)
        });
      }
      if (showMenu && preview3d.selectedPartKeys.has(key)) showPreviewContextMenu(event, key);
    }

    function setPreviewPartTarget(target, immediate = false) {
      const parts = selectedPreviewParts();
      if (!parts.length) return;
      stopPreviewPlayback();
      const value = Math.max(0, Math.min(1, Number(target) || 0));
      parts.forEach(part => {
        part.target = value;
        if (immediate) {
          part.current = value;
          applyOpeningState(part, value);
        }
      });
      updatePreviewSelection();
      updatePreviewMotionReadout();
    }

    function setAllPreviewTargets(target) {
      stopPreviewPlayback();
      const value = Math.max(0, Math.min(1, Number(target) || 0));
      preview3d.openables.forEach(part => { part.target = value; });
      updatePreviewSelection();
      updatePreviewMotionReadout();
    }

    function playSelectedPreview() {
      if (preview3d.playback?.active) {
        stopPreviewPlayback();
        return;
      }
      const parts = selectedPreviewParts();
      if (!parts.length) return;
      const orderedParts = [...parts].sort((a, b) => {
        const orderDifference = (a.operationOrder ?? 0) - (b.operationOrder ?? 0);
        return orderDifference || a.key.localeCompare(b.key);
      });
      orderedParts.forEach(part => {
        part.current = 0;
        part.target = 0;
        applyOpeningState(part, 0);
      });
      preview3d.playback = {
        active: true,
        phase: "opening",
        index: 0,
        keys: orderedParts.map(part => part.key)
      };
      orderedParts[0].target = 1;
      hidePreviewContextMenu();
      updatePreviewMotionControls();
    }

    function stopPreviewPlayback(updateControls = true) {
      if (preview3d.playback?.active) {
        preview3d.openables.forEach(part => { part.target = part.current; });
      }
      preview3d.playback = null;
      if (updateControls) updatePreviewMotionControls();
    }

    function showPreviewContextMenu(event, key) {
      const menu = document.getElementById("previewContextMenu");
      const shell = document.querySelector(".preview-shell");
      const part = preview3d.openables.find(item => item.key === key);
      if (!menu || !shell || !part) return;
      preview3d.contextPartKey = key;
      document.getElementById("previewMenuTitle").textContent = previewPartLabel(part);
      const toggleButton = document.getElementById("btnPreviewMenuToggle");
      if (toggleButton) toggleButton.textContent = preview3d.selectedPartKeys.size > 1 ? "移出多选" : "启用多选";
      menu.classList.remove("hidden");
      const bounds = shell.getBoundingClientRect();
      const left = Math.max(8, Math.min(event.clientX - bounds.left + 10, bounds.width - menu.offsetWidth - 8));
      const top = Math.max(8, Math.min(event.clientY - bounds.top + 10, bounds.height - menu.offsetHeight - 8));
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    }

    function hidePreviewContextMenu() {
      document.getElementById("previewContextMenu")?.classList.add("hidden");
    }

    function togglePreviewContextPart() {
      const key = preview3d.contextPartKey;
      if (!key) return;
      if (preview3d.selectedPartKeys.has(key) && preview3d.selectedPartKeys.size > 1) {
        selectPreviewPart(key, { additive: true, toggle: true });
      } else {
        setPreviewSelectionMode("multiple");
        if (!preview3d.selectedPartKeys.has(key)) selectPreviewPart(key, { additive: true, toggle: false });
        showToast("已启用多选，继续点击其他窗扇即可加入选择。");
      }
      hidePreviewContextMenu();
    }

    function editPreviewContextPart() {
      const part = preview3d.openables.find(item => item.key === preview3d.contextPartKey);
      if (!part) return;
      if (part.windowId) selectedWindowId = part.windowId;
      selectedCell = { row: part.row, col: part.col };
      hidePreviewContextMenu();
      closePreviewDialog();
      switchInspector("cell");
      render();
    }

    function addSashFrame(parent, x, y, w, h, face, depth, material) {
      addBox(parent, x, y + h / 2 - face / 2, 0, w, face, depth, material);
      addBox(parent, x, y - h / 2 + face / 2, 0, w, face, depth, material);
      addBox(parent, x - w / 2 + face / 2, y, 0, face, h, depth, material);
      addBox(parent, x + w / 2 - face / 2, y, 0, face, h, depth, material);
    }

    function addGrid(parent, rect, material, cols, rows) {
      for (let c = 1; c < cols; c += 1) {
        addBox(parent, rect.x - rect.w / 2 + rect.w * c / cols, rect.y, 0.08, rect.face * 0.06, rect.h * 0.82, rect.depth * 0.08, material);
      }
      for (let r = 1; r < rows; r += 1) {
        addBox(parent, rect.x, rect.y - rect.h / 2 + rect.h * r / rows, 0.08, rect.w * 0.82, rect.face * 0.06, rect.depth * 0.08, material);
      }
    }

    function addPane(parent, x, y, z, w, h, material) {
      const geometry = new threeLib.BoxGeometry(w, h, 0.012);
      const mesh = new threeLib.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }

    function addBox(parent, x, y, z, w, h, d, material) {
      const geometry = new threeLib.BoxGeometry(Math.max(0.002, w), Math.max(0.002, h), Math.max(0.002, d));
      applyScaledWallUvs(geometry, material, { x, y, z });
      const mesh = new threeLib.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      const materials = Array.isArray(material) ? material : [material];
      mesh.castShadow = !materials.some(item => item?.transparent);
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }

    function applyScaledWallUvs(geometry, material, offset = { x: 0, y: 0, z: 0 }) {
      const wallMaterial = Array.isArray(material)
        ? material.find(item => item?.userData?.wallTextureSize)
        : material;
      const textureSize = wallMaterial?.userData?.wallTextureSize;
      const position = geometry?.getAttribute?.("position");
      const normal = geometry?.getAttribute?.("normal");
      const uv = geometry?.getAttribute?.("uv");
      if (!textureSize || !position || !normal || !uv) return;
      const uSize = Math.max(0.001, textureSize.u);
      const vSize = Math.max(0.001, textureSize.v);
      for (let index = 0; index < position.count; index += 1) {
        const x = position.getX(index) + Number(offset.x || 0);
        const y = position.getY(index) + Number(offset.y || 0);
        const z = position.getZ(index) + Number(offset.z || 0);
        const nx = Math.abs(normal.getX(index));
        const ny = Math.abs(normal.getY(index));
        const nz = Math.abs(normal.getZ(index));
        if (ny >= nx && ny >= nz) {
          uv.setXY(index, x / uSize, z / uSize);
        } else if (nx > nz) {
          uv.setXY(index, z / uSize, y / vSize);
        } else {
          uv.setXY(index, x / uSize, y / vSize);
        }
      }
      uv.needsUpdate = true;
    }

    function createThreeWallMaterial(materialId, modelScale = 1) {
      const THREE = threeLib;
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext("2d");
      const presets = {
        plaster: { base: "#d9dfe2", line: "#cbd3d7", roughness: 0.95 },
        concrete: { base: "#b9bec0", line: "#9da4a7", roughness: 0.9 },
        red_brick: { base: "#b85e45", line: "#e3d4c7", roughness: 0.88 },
        gray_brick: { base: "#899093", line: "#d3d6d5", roughness: 0.9 },
        stone: { base: "#a7a49c", line: "#d6d2c8", roughness: 0.82 }
      };
      const preset = presets[materialId] || presets.plaster;
      context.fillStyle = preset.base;
      context.fillRect(0, 0, canvas.width, canvas.height);
      if (materialId === "red_brick" || materialId === "gray_brick") {
        const brickWidth = 64;
        const brickHeight = 32;
        context.strokeStyle = preset.line;
        context.lineWidth = 4;
        for (let row = 0; row <= canvas.height / brickHeight; row += 1) {
          const y = row * brickHeight;
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(canvas.width, y);
          context.stroke();
          const offset = row % 2 ? brickWidth / 2 : 0;
          for (let x = offset; x < canvas.width; x += brickWidth) {
            context.beginPath();
            context.moveTo(x, y);
            context.lineTo(x, y + brickHeight);
            context.stroke();
          }
        }
      } else if (materialId === "stone") {
        context.strokeStyle = preset.line;
        context.lineWidth = 3;
        const rowHeights = [52, 44, 58, 46, 56];
        let y = 0;
        rowHeights.forEach((rowHeight, row) => {
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(canvas.width, y);
          context.stroke();
          const widths = row % 2 ? [72, 94, 90] : [98, 70, 88];
          let x = row % 2 ? -28 : 0;
          widths.concat(widths).forEach(width => {
            x += width;
            context.beginPath();
            context.moveTo(x, y);
            context.lineTo(x, Math.min(canvas.height, y + rowHeight));
            context.stroke();
          });
          y += rowHeight;
        });
      } else {
        context.fillStyle = materialId === "concrete" ? "rgba(70,78,82,0.16)" : "rgba(95,110,115,0.08)";
        const count = materialId === "concrete" ? 230 : 130;
        for (let index = 0; index < count; index += 1) {
          const x = (index * 47 + 19) % 256;
          const y = (index * 83 + 31) % 256;
          const size = materialId === "concrete" ? 1 + (index % 3) : 1;
          context.fillRect(x, y, size, size);
        }
        if (materialId === "concrete") {
          context.strokeStyle = "rgba(92,98,100,0.22)";
          context.lineWidth = 2;
          context.strokeRect(4, 4, 248, 248);
        }
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 1);
      texture.anisotropy = 4;
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: texture,
        metalness: 0,
        roughness: preset.roughness
      });
      const scale = Math.max(0.000001, Number(modelScale) || 1);
      material.userData.wallTextureSize = materialId?.includes("brick")
        ? { u: 960 * scale, v: 560 * scale }
        : { u: 900 * scale, v: 900 * scale };
      return material;
    }

    function threeMaterials(win, series, scale) {
      const THREE = threeLib;
      const insideColor = profileColor(win.colorInside, series.material);
      const outsideColor = profileColor(win.colorOutside, series.material);
      const surround = normalizeSurround(win.installation?.surround);
      const profileBody = new THREE.MeshPhysicalMaterial({ color: outsideColor, metalness: series.material === "aluminum" ? 0.48 : 0.08, roughness: 0.32, clearcoat: 0.24, clearcoatRoughness: 0.38 });
      const profileOutside = profileBody.clone();
      const profileInside = profileBody.clone();
      profileOutside.color.set(outsideColor);
      profileInside.color.set(insideColor);
      return {
        profile: [profileBody, profileBody, profileBody, profileBody, profileOutside, profileInside],
        glass: new THREE.MeshPhysicalMaterial({ color: 0x8ccfec, transparent: true, opacity: 0.34, depthWrite: false, metalness: 0, roughness: 0.08, transmission: 0.18, side: THREE.DoubleSide }),
        panel: new THREE.MeshStandardMaterial({ color: 0xd8b37a, metalness: 0.05, roughness: 0.55 }),
        door: new THREE.MeshStandardMaterial({ color: 0xb7773e, metalness: 0.05, roughness: 0.58 }),
        screen: new THREE.MeshStandardMaterial({ color: 0xbdf3d9, transparent: true, opacity: 0.38, roughness: 0.4 }),
        screenLine: new THREE.MeshStandardMaterial({ color: 0x238963, roughness: 0.6 }),
        hardware: new THREE.MeshStandardMaterial({ color: 0xc99628, metalness: 0.82, roughness: 0.24 }),
        hardwareDark: new THREE.MeshStandardMaterial({ color: 0x2d3942, metalness: 0.7, roughness: 0.3 }),
        joint: new THREE.MeshStandardMaterial({ color: 0xc78518, metalness: 0.68, roughness: 0.3 }),
        jointSeal: new THREE.MeshStandardMaterial({ color: 0x27333a, metalness: 0.05, roughness: 0.78 }),
        wall: createThreeWallMaterial(surround.wallMaterialId, scale),
        sill: new THREE.MeshStandardMaterial({ color: 0xcbd5dd, metalness: 0.12, roughness: 0.62 }),
        surroundOutside: new THREE.MeshStandardMaterial({ color: profileColor(surround.colorOutside, series.material), metalness: 0.25, roughness: 0.46 }),
        surroundInside: new THREE.MeshStandardMaterial({ color: profileColor(surround.colorInside, series.material), metalness: 0.18, roughness: 0.5 }),
        surroundLiner: new THREE.MeshStandardMaterial({ color: 0xc9ae82, metalness: 0.04, roughness: 0.66 })
      };
    }

    function clearThreeObject(object) {
      while (object.children.length) {
        const child = object.children.pop();
        child.traverse(item => {
          item.geometry?.dispose?.();
          const disposeMaterial = material => {
            material?.map?.dispose?.();
            material?.dispose?.();
          };
          if (Array.isArray(item.material)) item.material.forEach(disposeMaterial);
          else disposeMaterial(item.material);
        });
      }
    }

    function renderWindowCards() {
      document.getElementById("windowCards").innerHTML = project.windows.map(win => `
        <button class="window-card ${win.windowId === selectedWindowId ? "active" : ""}" data-id="${escapeHtml(win.windowId)}">
          <strong>${escapeHtml(win.mark)} · ${escapeHtml(win.name || "门窗")}</strong>
          <span>${win.widthMm}×${win.heightMm} mm · ${win.quantity}樘</span>
          <span>${escapeHtml(win.floor || "-")} / ${escapeHtml(win.room || "-")}</span>
        </button>
      `).join("");
      document.querySelectorAll(".window-card").forEach(btn => {
        btn.addEventListener("click", () => {
          selectedWindowId = btn.dataset.id;
          selectedMemberId = "";
          selectedJointId = "";
          if (drawingMode === "assembly") {
            const assembly = currentProjectAssembly();
            selectedPlacementId = assembly?.placements.find(item => item.windowId === selectedWindowId)?.placementId || "";
            switchInspector("assembly");
          } else {
            selectedPlacementId = "";
          }
          selectedCell = { row: 0, col: 0 };
          render();
        });
      });
    }

    function renderTemplates() {
      const list = [...builtInTemplates, ...project.componentLibrary];
      document.getElementById("templateList").innerHTML = list.map(tpl => `
        <button class="template-item" data-template="${escapeHtml(tpl.id)}">
          <span class="template-thumb">${templateThumbnail(tpl)}</span>
          <strong>${escapeHtml(tpl.name)}</strong>
          <span>${escapeHtml(tpl.description || "")}</span>
        </button>
      `).join("");
      document.querySelectorAll("[data-template]").forEach(btn => {
        btn.addEventListener("click", () => {
          const tpl = list.find(item => item.id === btn.dataset.template);
          if (tpl) applyTemplate(tpl);
        });
      });
    }

    function templateThumbnail(template) {
      const layout = normalizeLayout(template.window?.layout || {});
      const colTotal = sum(layout.columns);
      const rowTotal = sum(layout.rows);
      const width = 112;
      const height = 76;
      let y = 4;
      const parts = ['<svg viewBox="0 0 120 84" aria-hidden="true">', '<rect x="3" y="3" width="114" height="78" rx="2" fill="#eef8fc" stroke="#425d72" stroke-width="4"/>'];
      for (let row = 0; row < layout.rows.length; row += 1) {
        const cellHeight = height * layout.rows[row] / rowTotal;
        let x = 4;
        for (let col = 0; col < layout.columns.length; col += 1) {
          const cellWidth = width * layout.columns[col] / colTotal;
          const cell = layout.cells[cellIndex(row, col, layout.columns.length)];
          parts.push(`<rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" fill="${cellFill(cell.type)}" stroke="#5a747b" stroke-width="1.5"/>`);
          if (isOperableType(cell.type)) {
            const inset = Math.max(3, Math.min(cellWidth, cellHeight) * 0.14);
            parts.push(openingSymbol(cell, { x, y, w: cellWidth, h: cellHeight }, inset));
          }
          x += cellWidth;
        }
        y += cellHeight;
      }
      parts.push("</svg>");
      return parts.join("");
    }

    function renderBom() {
      document.getElementById("kpiWindows").textContent = String(project.windows.reduce((n, w) => n + Number(w.quantity || 1), 0));
      document.getElementById("kpiLines").textContent = String(bom.mbom.lines.length);
      document.getElementById("kpiCats").textContent = String(new Set(bom.mbom.lines.map(l => l.category)).size);
      document.getElementById("bomSummaryRows").innerHTML = bom.summary.map(row => `
        <tr>
          <td>${escapeHtml(categoryLabels[row.category] || row.category)}</td>
          <td>${escapeHtml(row.materialCode)}</td>
          <td>${escapeHtml(row.name)}<br><span style="color: var(--muted);">${escapeHtml(sizeSpec(row))}</span></td>
          <td class="num">${formatQty(row.quantity)}</td>
          <td>${escapeHtml(row.unit)}</td>
        </tr>
      `).join("");
      document.getElementById("bomDetailRows").innerHTML = bom.mbom.lines.map(line => `
        <tr>
          <td>${escapeHtml(line.sourceMark)}<br><span style="color: var(--muted);">${escapeHtml(line.sourceComponentId)}</span></td>
          <td>${escapeHtml(line.materialCode)}<br><span style="color: var(--muted);">${escapeHtml(line.name)}</span></td>
          <td class="num">${escapeHtml(sizeSpec(line))}</td>
          <td class="num">${angleSpec(line)}</td>
          <td class="num">${formatQty(line.quantity)} ${escapeHtml(line.unit)}</td>
        </tr>
      `).join("");
    }

    function sizeSpec(row) {
      if (row.lengthMm) return `${Math.round(row.lengthMm)} mm${row.color ? ` · ${row.color}` : ""}`;
      if (row.widthMm || row.heightMm) return `${Math.round(row.widthMm || 0)}×${Math.round(row.heightMm || 0)}${row.spec ? ` · ${row.spec}` : ""}`;
      return row.spec || row.color || "-";
    }

    function angleSpec(line) {
      if (line.jointAngleDeg) return `节点${line.jointAngleDeg}° · ${line.cutLeftDeg || 0}°/${line.cutRightDeg || 0}°`;
      if (!line.cutLeftDeg && !line.cutRightDeg) return "-";
      return `${line.cutLeftDeg}°/${line.cutRightDeg}°`;
    }

    function formatQty(value) {
      const n = Number(value || 0);
      return Number.isInteger(n) ? String(n) : n.toFixed(2);
    }

    function renderStatus() {
      const status = project.calculation.status || "draft";
      const labels = {
        draft: "设计中",
        calculated: "已算料",
        confirmed: "已确认",
        frozen: `已冻结 v${project.calculation.mbomVersion || 0}`,
        changed: "已变更"
      };
      document.getElementById("calcStatus").textContent = labels[status] || status;
      const dot = document.getElementById("calcDot");
      dot.className = "dot";
      if (status === "confirmed" || status === "frozen") dot.classList.add("ok");
      else dot.classList.add("warn");
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function showToast(message) {
      const toast = document.getElementById("toast");
      toast.textContent = message;
      toast.classList.add("show");
      clearTimeout(showToast.timer);
      showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
    }

    function publishRuntimeApi() {
      window.LankoDesigner = {
        readDesign() {
          return structuredClone(project);
        },
        readBom() {
          return structuredClone(bom);
        },
        readManufacturingPackage() {
          return buildInterfacePackage(project, bom);
        },
        readCapabilities() {
          return {
            schemaVersion: project.schemaVersion,
            geometryModes: ["grid", "topology"],
            topologyFeatures: ["stable_regions", "frame_segments", "local_mullions", "member_connections"],
            engineeringJoints: {
              types: ["splice", "corner"],
              styles: Object.fromEntries(
                Object.entries(JOINT_STYLE_OPTIONS).map(([type, options]) => [type, options.map(item => ({ ...item }))])
              ),
              ownership: "project"
            },
            windowAssemblies: {
              docks: ["left", "right", "top", "bottom", "free"],
              aligns: ["start", "center", "end"],
              coordinateSystem: "millimeter-3d",
              bomOwnership: "project"
            },
            installationSurrounds: {
              styles: SURROUND_STYLE_OPTIONS.map(item => ({ ...item })),
              edgeModes: SURROUND_EDGE_OPTIONS.map(item => ({ ...item })),
              ownership: "window"
            },
            shapePresets: SHAPE_PRESETS.map(item => ({ ...item })),
            operableTypes: [...OPERABLE_TYPES],
            openingOptions: Object.fromEntries(
              Object.keys(typeLabels).map(type => [type, openingOptionsForType(type).map(item => ({ ...item }))])
            )
          };
        },
        recalculateBom() {
          recalc("calculated");
          return {
            status: project.calculation.status,
            mbomVersion: project.calculation.mbomVersion,
            lineCount: bom.mbom.lines.length
          };
        }
      };
    }

    function registerWebMcpTools() {
      const context = document.modelContext;
      if (!context?.registerTool) return;
      const lifecycle = new AbortController();
      const tools = [
        {
          name: "read_design_json",
          title: "读取设计JSON",
          description: "读取当前朗科门窗设计大师工作台中的完整设计JSON。",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute() {
            return structuredClone(project);
          }
        },
        {
          name: "recalculate_bom",
          title: "重新算料",
          description: "按当前设计JSON重新生成BOM、下料需求和制造接口包。",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute() {
            recalc("calculated");
            return {
              status: project.calculation.status,
              mbomVersion: project.calculation.mbomVersion,
              lineCount: bom.mbom.lines.length,
              generatedAt: bom.mbom.generatedAt
            };
          }
        },
        {
          name: "read_manufacturing_package",
          title: "读取制造接口包",
          description: "读取当前设计生成的 Manufacturing Package，用于MES、ERP、WMS或设备适配器接入。",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute() {
            return buildInterfacePackage(project, bom);
          }
        }
      ];

      for (const tool of tools) {
        try {
          void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal }))
            .catch(error => console.warn("WebMCP registration failed", tool.name, error));
        } catch (error) {
          console.warn("WebMCP registration failed", tool.name, error);
        }
      }
    }

    function bindById(id, eventName, handler) {
      const element = document.getElementById(id);
      if (!element) {
        console.warn(`[朗科门窗设计大师] 未找到控件 #${id}，已跳过 ${eventName} 事件绑定。`);
        return;
      }
      element.addEventListener(eventName, handler);
    }

    function bindEvents() {
      ["projectId", "projectName", "customerName", "projectAddress", "orderId", "batchNo"].forEach(id => {
        bindById(id, "change", updateProjectFromInputs);
      });
      ["winMark", "winQty", "winWidth", "winHeight", "sillHeight", "winFloor", "winRoom", "winShape", "archHeight", "shapePoints"].forEach(id => {
        bindById(id, "change", updateWindowFromInputs);
      });
      ["seriesId", "colorInside", "colorOutside", "glassTypeId", "hardwareSetId"].forEach(id => {
        bindById(id, "change", updateProductFromInputs);
      });
      ["cellType", "opening", "cellGlass", "cellHardware", "cellInfill", "cellScreenMode", "cellAccessoryGrille", "cellAccessorySecurity", "cellAccessoryFrosted", "handleHeight", "cellNote"].forEach(id => {
        bindById(id, "change", updateCellFromInputs);
      });
      [
        "memberOrientation",
        "memberPosition",
        "memberSpanStart",
        "memberSpanEnd",
        "memberProfile",
        "memberThroughMode",
        "memberConnectionStart",
        "memberConnectionEnd",
        "memberNote"
      ].forEach(id => bindById(id, "change", updateMemberFromInputs));
      [
        "jointType",
        "jointStyle",
        "jointOrientation",
        "jointHostEdge",
        "jointAngle",
        "jointLegA",
        "jointLegB",
        "jointSpanStart",
        "jointSpanEnd",
        "jointProfile",
        "jointFrameTreatment",
        "jointPostMode",
        "jointFastenerSpacing",
        "jointNote"
      ].forEach(id => bindById(id, "change", updateJointFromInputs));
      [
        "projectAssemblyName",
        "projectAssemblyRoot",
        "placementReference",
        "placementDock",
        "placementAlign",
        "placementGap",
        "placementOffset",
        "placementRotation",
        "placementFreeX",
        "placementFreeY",
        "placementFreeZ",
        "placementJoint",
        "placementNote"
      ].forEach(id => bindById(id, "change", updateProjectAssemblyFromInputs));
      bindById("projectAssemblySelect", "change", selectProjectAssemblyFromInput);
      [
        "surroundEnabled",
        "installationMountingMode",
        "installationFrameAlignment",
        "surroundStyle",
        "surroundEdgeMode",
        "surroundSideTop",
        "surroundSideRight",
        "surroundSideBottom",
        "surroundSideLeft",
        "surroundWallThickness",
        "wallMaterial",
        "wallCornerMode",
        "cornerPierWidth",
        "surroundFrameOffset",
        "exteriorMountGap",
        "surroundOutsideWidth",
        "surroundInsideWidth",
        "surroundBoardThickness",
        "surroundMaterialCode",
        "surroundColorOutside",
        "surroundColorInside",
        "surroundNote"
      ].forEach(id => bindById(id, "change", updateInstallationFromInputs));
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
      ].forEach(id => bindById(id, "change", updateCellFromInputs));
      ["viewShowOpenState", "viewShowProfileColor", "viewShowDimensions", "viewShowPlanView"].forEach(id => {
        bindById(id, "change", updateViewOptionsFromInputs);
      });
      document.querySelectorAll(".left-tab").forEach(btn => btn.addEventListener("click", () => switchLeft(btn.dataset.tab)));
      document.querySelectorAll(".inspector-tab").forEach(btn => btn.addEventListener("click", () => switchInspector(btn.dataset.inspector)));
      document.querySelectorAll(".bom-tab").forEach(btn => btn.addEventListener("click", () => switchBom(btn.dataset.bomTab)));
      document.querySelectorAll(".module-button").forEach(btn => btn.addEventListener("click", () => switchModule(btn.dataset.module)));
      bindById("btnRecalc", "click", () => {
        recalc("calculated");
        showToast("算料已刷新。");
      });
      bindById("btnConfirm", "click", confirmBom);
      bindById("btnFreeze", "click", freezeBom);
      bindById("btnNewWindow", "click", newWindow);
      bindById("btnDuplicateWindow", "click", duplicateWindow);
      bindById("btnDeleteWindow", "click", deleteWindow);
      bindById("btnWindowDrawingMode", "click", () => switchDrawingMode("window"));
      bindById("btnAssemblyDrawingMode", "click", () => switchDrawingMode("assembly"));
      bindById("btnNewAssembly", "click", newProjectAssembly);
      bindById("btnPlaceLeft", "click", () => addAssemblyPlacement("left"));
      bindById("btnPlaceRight", "click", () => addAssemblyPlacement("right"));
      bindById("btnPlaceTop", "click", () => addAssemblyPlacement("top"));
      bindById("btnPlaceBottom", "click", () => addAssemblyPlacement("bottom"));
      bindById("btnPlaceFree", "click", () => addAssemblyPlacement("free"));
      bindById("btnOpenDiyShapeEditor", "click", () => openDiyShapeEditor());
      bindById("btnCloseDiyShape", "click", closeDiyShapeEditor);
      bindById("btnUndoDiyPoint", "click", undoDiyShapePoint);
      bindById("btnClearDiyShape", "click", clearDiyShape);
      bindById("btnSaveDiyShape", "click", saveDiyShapeElement);
      bindById("diyShapeCanvas", "pointerdown", handleDiyShapePointerDown);
      bindById("diyShapeCanvas", "pointermove", handleDiyShapePointerMove);
      bindById("diyShapeCanvas", "pointerup", handleDiyShapePointerUp);
      bindById("diyShapeDialog", "click", event => {
        if (event.target === event.currentTarget) closeDiyShapeEditor();
      });
      bindById("btnConfigureSurround", "click", openInstallationInspector);
      bindById("btnAddCol", "click", () => splitSelectedColumn(2));
      bindById("btnAddRow", "click", () => splitSelectedRow(2));
      bindById("btnAddLocalVertical", "click", () => addLocalMember("vertical"));
      bindById("btnAddLocalHorizontal", "click", () => addLocalMember("horizontal"));
      bindById("btnAddSpliceJoint", "click", () => addEngineeringJoint("splice"));
      bindById("btnAddCornerJoint", "click", () => addEngineeringJoint("corner"));
      bindById("btnRemoveCol", "click", removeColumn);
      bindById("btnRemoveRow", "click", removeRow);
      bindById("btnSplitVertical", "click", () => splitSelectedColumn(3));
      bindById("btnSplitHorizontal", "click", () => splitSelectedRow(3));
      bindById("btnEqualizeGrid", "click", equalizeGrid);
      bindById("btnQuickPair", "click", applyQuickPair);
      document.querySelectorAll("[data-cell-preset]").forEach(btn => {
        btn.addEventListener("click", () => applyCellPreset(btn.dataset.cellPreset));
      });
      document.querySelectorAll("[data-shape-preset]").forEach(btn => {
        btn.addEventListener("click", () => applyShapePreset(btn.dataset.shapePreset));
      });
      bindById("customShapeLibrary", "click", event => {
        const editButton = event.target.closest("[data-edit-custom-shape]");
        if (editButton) {
          editCustomShapeElement(editButton.dataset.editCustomShape);
          return;
        }
        const button = event.target.closest("[data-custom-shape]");
        if (button) applyCustomShapeElement(button.dataset.customShape);
      });
      bindById("toolSearch", "input", filterToolLibrary);
      document.querySelectorAll("[data-cell-menu-type]").forEach(btn => {
        btn.addEventListener("click", () => applyCellMenuType(btn.dataset.cellMenuType));
      });
      bindById("btnResetView", "click", () => fitThreePreview(true));
      bindById("btnClosePreview", "click", closePreviewDialog);
      bindById("previewDialog", "close", closePreviewDialog);
      bindById("previewDialog", "click", event => {
        if (event.target === event.currentTarget) closePreviewDialog();
      });
      bindById("previewPartList", "click", event => {
        const button = event.target.closest("[data-preview-part]");
        if (!button) return;
        selectPreviewPart(button.dataset.previewPart, {
          additive: preview3d.selectionMode === "multiple",
          toggle: preview3d.selectionMode === "multiple"
        });
        hidePreviewContextMenu();
      });
      document.querySelectorAll(".preview-select-mode").forEach(button => {
        button.addEventListener("click", () => setPreviewSelectionMode(button.dataset.previewSelectMode));
      });
      bindById("previewMotionMode", "change", event => {
        const parts = selectedPreviewParts().filter(part => ["turn_tilt", "psk"].includes(part.motionType || part.type));
        if (!parts.length) return;
        parts.forEach(part => {
          part.motionMode = event.target.value === "tilt" ? "tilt" : "primary";
          applyOpeningState(part, part.current);
        });
        updatePreviewMotionControls();
      });
      bindById("previewOpenRange", "input", event => {
        setPreviewPartTarget(Number(event.target.value) / 100, true);
      });
      bindById("btnPartClose", "click", () => setPreviewPartTarget(0));
      bindById("btnPartOpen", "click", () => setPreviewPartTarget(1));
      bindById("btnAllClose", "click", () => setAllPreviewTargets(0));
      bindById("btnAllOpen", "click", () => setAllPreviewTargets(1));
      bindById("btnPlaySelected", "click", playSelectedPreview);
      bindById("btnPreviewMenuSelectOnly", "click", () => {
        selectPreviewPart(preview3d.contextPartKey, { exclusive: true });
        hidePreviewContextMenu();
      });
      bindById("btnPreviewMenuToggle", "click", togglePreviewContextPart);
      bindById("btnPreviewMenuPlay", "click", playSelectedPreview);
      bindById("btnPreviewMenuOpen", "click", () => {
        setPreviewPartTarget(1);
        hidePreviewContextMenu();
      });
      bindById("btnPreviewMenuClose", "click", () => {
        setPreviewPartTarget(0);
        hidePreviewContextMenu();
      });
      bindById("btnPreviewMenuEdit", "click", editPreviewContextPart);
      bindById("btnCellMenuEdit", "click", hideCellContextMenu);
      bindById("btnCellMenuPreview", "click", previewSelectedCell);
      bindById("btnDeleteMember", "click", deleteSelectedMember);
      bindById("btnMemberMenuEdit", "click", () => {
        hideMemberContextMenu();
        switchInspector("member");
      });
      bindById("btnMemberMenuDelete", "click", deleteSelectedMember);
      bindById("btnDeleteJoint", "click", deleteSelectedJoint);
      bindById("btnJointMenuEdit", "click", () => {
        hideJointContextMenu();
        switchInspector("joint");
      });
      bindById("btnJointMenuDelete", "click", deleteSelectedJoint);
      bindById("btnDeletePlacement", "click", deleteSelectedPlacement);
      bindById("btnDeleteAssembly", "click", deleteCurrentAssembly);
      bindById("btnAssemblyMenuEdit", "click", () => {
        hideAssemblyContextMenu();
        switchInspector("assembly");
        render();
      });
      bindById("btnAssemblyMenuPreview", "click", () => {
        hideAssemblyContextMenu();
        drawingMode = "assembly";
        openPreviewDialog();
      });
      bindById("btnAssemblyMenuRemove", "click", deleteSelectedPlacement);
      document.addEventListener("pointerdown", event => {
        if (!event.target.closest(".object-menu") && !event.target.closest("#preview3d")) {
          hideCellContextMenu();
          hidePreviewContextMenu();
          hideMemberContextMenu();
          hideJointContextMenu();
          hideAssemblyContextMenu();
        }
      });
      window.addEventListener("resize", () => {
        hideCellContextMenu();
        hidePreviewContextMenu();
        hideMemberContextMenu();
        hideJointContextMenu();
        hideAssemblyContextMenu();
      });
      bindById("btnExportBom", "click", exportBom);
      bindById("btnAddSeries", "click", addSeries);
      bindById("btnSaveComponent", "click", saveComponent);
      bindById("btnClearCustom", "click", clearCustomComponents);
      bindById("btnApplyJson", "click", applyJsonText);
      bindById("btnExportJson", "click", exportJson);
      bindById("btnExportJsonTop", "click", exportJson);
      bindById("btnImportJson", "click", () => document.getElementById("importFile")?.click());
      bindById("importFile", "change", event => {
        const file = event.target.files?.[0];
        if (file) importJsonFile(file);
        event.target.value = "";
      });
    }

    function boot() {
      bindEvents();
      registerWebMcpTools();
      recalc("calculated");
      publishRuntimeApi();
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
  
