import { builtInTemplates, categoryLabels, defaultCatalog, typeLabels } from "./catalog.js?v=20260912-51";
import { buildInterfacePackage, calculateProjectBom, cellIndex, hashString, materialName, sum } from "./calculation.js?v=20260912-51";
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
} from "./openings.js?v=20260915-01";
import {
  createCellId,
  createMemberId,
  createLocalMullion,
  findMemberHost,
  memberLabel,
  memberLengthMm,
  normalizeMember,
  normalizeTopology,
  partitionTopologyRegion
} from "./topology.js?v=20260912-51";
import {
  JOINT_STYLE_OPTIONS,
  createEngineeringJoint,
  defaultJointProfile,
  jointLabel,
  jointLengthMm,
  jointStatus,
  normalizeEngineeringJoint,
  normalizeEngineeringJoints
} from "./joints.js?v=20260912-51";
import {
  assemblyBounds,
  assemblySummary,
  createAssemblyPlacement,
  createWindowAssembly,
  dockLabel,
  hostEdgeForDock,
  normalizeWindowAssemblies,
  placementGapForJoint,
  placementRotationForJoint,
  resolveAssemblyLayout
} from "./assemblies.js?v=20260914-05";
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
} from "./installations.js?v=20260912-51";

const STORAGE_KEY = "doormes-designer-v1";
const PROJECT_LIBRARY_KEY = "doormes-designer-project-library-v1";
const CUSTOM_WINDOW_LIBRARY_KEY = "doormes-designer-custom-window-library-v1";
const THREE_MODULE_URL = "three";
const ORBIT_CONTROLS_URL = "three/addons/controls/OrbitControls.js";
const SHAPE_PRESETS = Object.freeze([
  { type: "rectangular", label: "四边框", icon: "□", description: "标准矩形洞口和窗框" },
  { type: "arched", label: "上拱框", icon: "⌒", description: "顶部拱形固定或拼接窗" },
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
const PANEL_MODES = Object.freeze(["single", "double"]);
const CELL_SCREEN_MODES = Object.freeze(["none", "fixed", "swing", "sliding", "retractable"]);
const PROJECT_STATUS_OPTIONS = Object.freeze([
  ["new", "新建项目"],
  ["designing", "设计方案"],
  ["review", "确认方案"],
  ["confirmed", "客户确认"]
]);

    let project = loadProject();
    const initialAssembly = project.assemblies?.find(assembly => assembly.placements?.length) || project.assemblies?.[0] || null;
    let selectedWindowId = initialAssembly?.rootWindowId || project.windows[0]?.windowId || "";
    let selectedCell = { row: 0, col: 0 };
    let selectedMemberId = "";
    let selectedJointId = "";
    const collapsedObjectBranches = new Set();
    let selectedMarkupId = "";
    let selectedAssemblyId = initialAssembly?.assemblyId || "";
    let selectedPlacementId = "";
    let drawingMode = project.assemblies?.some(assembly => assembly.placements?.length) ? "assembly" : "window";
    let activeLeftTab = "draw";
    let activeInspectorTab = "window";
    let activeBomTab = "summary";
    let activeModule = "draw";
    let lastMainModule = "draw";
    let activeTemplateLibrary = "smart";
    let templateSearchTerm = "";
    let smartTemplateCandidates = [];
    let smartTemplateFilter = "all";
    let projectManagerSelectedId = project.project?.projectId || "";
    let editingProjectId = "";
    let measurementSourceProject = null;
    let jointPositionDialogMode = "joint";
    let pendingConnectedShapeType = "rectangular";
    let canvasCommand = { mode: "", jointType: "", jointId: "", shapeType: "", cellPreset: "", cellOpening: "", cellPanels: "", cellTracks: "", panelMode: "", markupType: "" };
    let canvasViewport = { scale: 1, x: 0, y: 0 };
    let canvasPan = { active: false, pointerId: 0, startX: 0, startY: 0, originX: 0, originY: 0 };
    let geometryDrag = null;
    let activeMarkupEditor = null;
    let bom = calculateProjectBom(project);
    const diyShapeEditor = {
      points: [],
      selectedIndex: -1,
      draggingIndex: -1,
      closed: false,
      editingShapeId: ""
    };
    const surroundDesignDialog = {
      draft: null,
      viewport: { scale: 1, x: 0, y: 0 },
      panning: false,
      panStart: { x: 0, y: 0 },
      panOrigin: { x: 0, y: 0 },
      activeDimension: ""
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
      selectionMode: "multiple",
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
          contactPhone: "168",
          status: "designing",
          createdAt: new Date().toISOString(),
          address: "项目地址"
        },
        order: {
          orderId: "SO-001",
          batchNo: "BATCH-001",
          source: "designer"
        },
        catalog: structuredClone(defaultCatalog),
        componentLibrary: [],
        measurements: defaultMeasurements(),
        joints: [],
        assemblies: [],
        viewOptions: {
          showOpenState: true,
          showProfileColor: true,
          showDimensions: true,
          showPlanView: true,
          show3dDimensions: true,
          show3dMarkups: true,
          show3dOrientation: true
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
        windows: []
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
        embeddedInWindowId: overrides.embeddedInWindowId || "",
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
        orderInfo: normalizeWindowOrderInfo(overrides.orderInfo, overrides),
        notes: overrides.notes || ""
      };
    }

    function normalizeWindowOrderInfo(value = {}, win = {}) {
      const quantity = Math.max(1, Number(win.quantity || 1));
      const unitPrice = Math.max(0, Number(value?.unitPrice || 0));
      return {
        installLocation: value?.installLocation || win.room || "",
        color: value?.color || win.colorInside || "",
        openingMode: value?.openingMode || "",
        unitPrice,
        totalPrice: Math.max(0, Number(value?.totalPrice || quantity * unitPrice)),
        savedToProject: Boolean(value?.savedToProject),
        savedAt: value?.savedAt || "",
        note: value?.note || win.notes || ""
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

    function normalizePanelMode(value) {
      return PANEL_MODES.includes(value) ? value : "single";
    }

    function panelModeLabel(value) {
      return normalizePanelMode(value) === "double" ? "双扇板材" : "单扇板材";
    }

    function normalizeCellAccessories(value = {}) {
      const screenMode = CELL_SCREEN_MODES.includes(value?.screenMode) ? value.screenMode : "none";
      return {
        grille: Boolean(value?.grille),
        screenMode,
        securityBars: Boolean(value?.securityBars),
        guardRail: Boolean(value?.guardRail),
        frosted: Boolean(value?.frosted)
      };
    }

    function defaultMeasurements() {
      return [
        { measurementId: "M-01", room: "客厅", openingName: "客厅主窗洞口", widthMm: 1800, heightMm: 1500, sillHeightMm: 0, status: "待设计" },
        { measurementId: "M-02", room: "卧室", openingName: "卧室窗洞口", widthMm: 1200, heightMm: 1500, sillHeightMm: 900, status: "待设计" },
        { measurementId: "M-03", room: "厨房", openingName: "厨房推拉窗洞口", widthMm: 1500, heightMm: 1200, sillHeightMm: 950, status: "待设计" }
      ];
    }

    function defaultScreenModeForCell(cell) {
      if (!cell || !isOperableType(cell.type)) return "fixed";
      if (["sliding", "lift_slide", "psk", "parallel_slide", "pocket_slide", "corner_slide", "vertical_slide"].includes(cell.type)) return "sliding";
      if (cell.type === "folding") return "retractable";
      return "swing";
    }

    function createMarkupId() {
      return `MK-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    }

    function normalizeCellMarkup(value = {}) {
      const kind = ["text", "circle_hole", "square_hole", "lock"].includes(value.kind) ? value.kind : "text";
      const xPercent = Math.max(0, Math.min(100, Number(value.xPercent ?? value.xRatio ?? 50)));
      const yPercent = Math.max(0, Math.min(100, Number(value.yPercent ?? value.yRatio ?? 50)));
      return {
        markupId: String(value.markupId || createMarkupId()),
        kind,
        text: String(value.text || (kind === "text" ? "文字标注" : "")),
        xPercent,
        yPercent,
        offsetXPercent: Math.max(-100, Math.min(100, Number(value.offsetXPercent ?? xPercent - 50))),
        offsetYPercent: Math.max(-100, Math.min(100, Number(value.offsetYPercent ?? yPercent - 50))),
        sizeMm: Math.max(10, Math.min(300, Number(value.sizeMm || (kind === "text" ? 0 : 60)))),
        hostType: "cell",
        hostWindowId: String(value.hostWindowId || ""),
        hostCellId: String(value.hostCellId || ""),
        note: String(value.note || "")
      };
    }

    function normalizeCellMarkups(value) {
      return Array.isArray(value) ? value.map(normalizeCellMarkup).filter(Boolean) : [];
    }

    function createCellMarkup(kind, options = {}) {
      return normalizeCellMarkup({
        kind,
        text: kind === "text" ? "文字标注" : "",
        sizeMm: kind === "text" ? 0 : (kind === "lock" ? 35 : 60),
        ...options
      });
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
        panelMode: "single",
        infillType: "glass",
        accessories: normalizeCellAccessories(),
        handleHeightMm: 750,
        customShape: null,
        markups: [],
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
        panelMode: normalizePanelMode(cell?.panelMode),
        infillType: normalizeCellInfillType(cell?.infillType || migrated.infillType),
        accessories,
        handleHeightMm: Math.max(0, Number(cell?.handleHeightMm ?? 750)),
        customShape: normalizeCellCustomShape(cell?.customShape),
        markups: normalizeCellMarkups(cell?.markups).map(markup => ({
          ...markup,
          hostCellId: markup.hostCellId || String(cell?.cellId || base.cellId)
        })),
        note: cell?.note || ""
      };
    }

    function normalizeProject(value) {
      const next = value && typeof value === "object" ? value : createDefaultProject();
      next.schemaVersion = "cn-door-window-design.v2";
      next.project ||= {};
      next.project.projectId ||= "P-2026-001";
      next.project.name ||= "中国门窗设计样板工程";
      next.project.customerName ||= "";
      next.project.contactPhone ||= "";
      next.project.status = ["new", "designing", "review", "confirmed"].includes(next.project.status) ? next.project.status : "designing";
      next.project.createdAt ||= new Date().toISOString();
      next.project.address ||= "";
      next.project.companyName ||= "";
      next.project.clerk ||= "";
      next.project.demandDate ||= "";
      next.project.note ||= "";
      next.order ||= {};
      next.catalog ||= structuredClone(defaultCatalog);
      next.catalog.profileSystems = mergeCatalogItems(next.catalog.profileSystems, defaultCatalog.profileSystems);
      next.catalog.glassTypes = mergeCatalogItems(next.catalog.glassTypes, defaultCatalog.glassTypes);
      next.catalog.hardwareSets = mergeCatalogItems(next.catalog.hardwareSets, defaultCatalog.hardwareSets);
      next.catalog.panelTypes = mergeCatalogItems(next.catalog.panelTypes, defaultCatalog.panelTypes);
      next.componentLibrary ||= [];
      next.measurements = Array.isArray(next.measurements) ? next.measurements.map(normalizeMeasurement).filter(Boolean) : [];
      if (!next.measurements.length) next.measurements = defaultMeasurements().map(normalizeMeasurement).filter(Boolean);
      next.customShapes = Array.isArray(next.customShapes)
        ? next.customShapes.map(normalizeCustomShapeElement).filter(Boolean)
        : [];
      next.viewOptions = {
        showOpenState: true,
        showProfileColor: true,
        showDimensions: true,
        showPlanView: true,
        show3dDimensions: true,
        show3dMarkups: true,
        show3dOrientation: true,
        ...(next.viewOptions || {})
      };
      next.integrations ||= { reservedEvents: [], externalRefs: [] };
      next.calculation ||= {};
      next.calculation.status ||= "draft";
      next.calculation.mbomVersion ||= 0;
      next.calculation.events ||= [];
      next.windows = Array.isArray(next.windows) ? next.windows : [];
      next.windows = next.windows.map(w => {
        const layout = normalizeLayout(w.layout);
        const normalizedWindow = {
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
          topology: normalizeTopology(w.topology, layout),
          orderInfo: normalizeWindowOrderInfo(w.orderInfo, w)
        };
        normalizedWindow.layout.cells.forEach(cell => {
          cell.markups = normalizeCellMarkups(cell.markups).map(markup => ({
            ...markup,
            hostType: "cell",
            hostWindowId: normalizedWindow.windowId,
            hostCellId: cell.cellId
          }));
        });
        return normalizedWindow;
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
        if (stored) return migrateLegacyProjectToCanvasModel(JSON.parse(stored));
      } catch (error) {
        console.warn("Project load failed", error);
      }
      return createDefaultProject();
    }

    function saveProject() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    }

    function loadProjectLibrary() {
      try {
        const stored = localStorage.getItem(PROJECT_LIBRARY_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        const records = Array.isArray(parsed) ? parsed.filter(item => item?.projectId && item?.design) : [];
        let changed = false;
        const migrated = records.map(item => {
          const design = migrateLegacyProjectToCanvasModel(item.design);
          if (JSON.stringify(design.windows) !== JSON.stringify(item.design?.windows || [])
            || JSON.stringify(design.assemblies) !== JSON.stringify(item.design?.assemblies || [])
            || JSON.stringify(design.joints) !== JSON.stringify(item.design?.joints || [])) {
            changed = true;
          }
          return {
            ...item,
            ...projectSummaryFor(design),
            savedAt: item.savedAt || item.updatedAt || new Date().toISOString(),
            design
          };
        });
        if (changed) localStorage.setItem(PROJECT_LIBRARY_KEY, JSON.stringify(migrated));
        return migrated;
      } catch (error) {
        console.warn("Project library load failed", error);
        return [];
      }
    }

    function saveProjectLibrary(items) {
      localStorage.setItem(PROJECT_LIBRARY_KEY, JSON.stringify(items));
    }

    function loadCustomWindowLibrary() {
      try {
        const stored = localStorage.getItem(CUSTOM_WINDOW_LIBRARY_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed.filter(item => item?.id && item?.window) : [];
      } catch (error) {
        console.warn("Custom window library load failed", error);
        return [];
      }
    }

    function saveCustomWindowLibrary(items) {
      localStorage.setItem(CUSTOM_WINDOW_LIBRARY_KEY, JSON.stringify(items));
    }

    function projectSummaryFor(design) {
      const normalized = normalizeProject(structuredClone(design || project));
      const canvasWindowIds = canvasWindowIdsForDesign(normalized);
      const windowCount = canvasWindowIds.size || normalized.windows.length;
      const assemblyCount = normalized.assemblies?.length || 0;
      return {
        projectId: normalized.project.projectId || "未编号",
        name: normalized.project.name || "未命名项目",
        customerName: normalized.project.customerName || "-",
        contactPhone: normalized.project.contactPhone || "-",
        status: normalized.project.status || "designing",
        orderId: normalized.order?.orderId || "-",
        windowCount,
        assemblyCount,
        updatedAt: new Date().toISOString()
      };
    }

    function canvasWindowIdsForDesign(design, assemblyId = "") {
      const ids = new Set();
      const assembly = (design.assemblies || []).find(item => item.assemblyId === assemblyId)
        || (design.assemblies || []).find(item => item.placements?.length)
        || null;
      if (assembly) {
        if (assembly.rootWindowId) ids.add(assembly.rootWindowId);
        (assembly.placements || []).forEach(placement => {
          if (placement.windowId) ids.add(placement.windowId);
          if (placement.referenceWindowId) ids.add(placement.referenceWindowId);
        });
        return ids;
      }
      const firstRoot = (design.windows || []).find(win => !win.embeddedInWindowId) || design.windows?.[0];
      if (firstRoot?.windowId) ids.add(firstRoot.windowId);
      return ids;
    }

    function canvasWindowsForDesign(design, assemblyId = "") {
      const ids = canvasWindowIdsForDesign(design, assemblyId);
      return (design.windows || []).filter(win => ids.has(win.windowId));
    }

    function migrateLegacyProjectToCanvasModel(sourceDesign, options = {}) {
      const next = normalizeProject(structuredClone(sourceDesign || createDefaultProject()));
      if (!next.windows.length) return next;
      const targetAssembly = (next.assemblies || []).find(item => item.assemblyId === options.assemblyId)
        || (next.assemblies || []).find(item => item.placements?.length)
        || null;
      const keepWindowIds = canvasWindowIdsForDesign(next, targetAssembly?.assemblyId || "");
      if (!keepWindowIds.size) return next;
      const beforeWindowCount = next.windows.length;
      next.windows = next.windows.filter(win => keepWindowIds.has(win.windowId));
      const validWindowIds = new Set(next.windows.map(win => win.windowId));
      if (targetAssembly) {
        const keptAssembly = {
          ...targetAssembly,
          placements: (targetAssembly.placements || []).filter(placement => (
            validWindowIds.has(placement.windowId) && validWindowIds.has(placement.referenceWindowId)
          ))
        };
        next.assemblies = keptAssembly.rootWindowId && validWindowIds.has(keptAssembly.rootWindowId)
          ? [keptAssembly]
          : [];
      } else {
        next.assemblies = [];
      }
      const usedJointIds = new Set(next.assemblies.flatMap(assembly => (
        (assembly.placements || []).map(placement => placement.jointId).filter(Boolean)
      )));
      next.joints = (next.joints || []).filter(joint => {
        const connectedInsideCanvas = (joint.connectedWindowIds || []).some(id => validWindowIds.has(id));
        return validWindowIds.has(joint.hostWindowId) && (usedJointIds.has(joint.jointId) || connectedInsideCanvas);
      }).map(joint => ({
        ...joint,
        connectedWindowIds: (joint.connectedWindowIds || []).filter(id => validWindowIds.has(id))
      }));
      const migrated = normalizeProject(next);
      if (beforeWindowCount !== migrated.windows.length) {
        migrated.project.note = `${migrated.project.note || ""}`.trim();
      }
      return migrated;
    }

    function resetProjectSelection() {
      const assembly = project.assemblies?.find(item => item.placements?.length) || project.assemblies?.[0] || null;
      selectedAssemblyId = assembly?.assemblyId || "";
      selectedWindowId = assembly?.rootWindowId || project.windows[0]?.windowId || "";
      selectedCell = { row: 0, col: 0 };
      selectedMemberId = "";
      selectedJointId = "";
      selectedPlacementId = "";
      drawingMode = assembly?.placements?.length ? "assembly" : "window";
      switchInspector(drawingMode === "assembly" ? "assembly" : "window");
    }

    function createFreshProject(details = {}) {
      const next = createDefaultProject();
      const stamp = new Date();
      const datePart = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, "0")}${String(stamp.getDate()).padStart(2, "0")}`;
      next.project.projectId = `P-${datePart}-${String(stamp.getTime()).slice(-4)}`;
      next.project.name = details.name || "新建项目";
      next.project.customerName = details.customerName || details.name || "";
      next.project.contactPhone = details.contactPhone || "";
      next.project.status = "new";
      next.project.createdAt = stamp.toISOString();
      next.project.address = details.address || "";
      next.project.companyName = details.companyName || "";
      next.project.clerk = details.clerk || "";
      next.project.demandDate = details.demandDate || "";
      next.project.note = details.note || "";
      next.order.orderId = "";
      next.order.batchNo = "";
      next.windows = [];
      next.joints = [];
      next.assemblies = [];
      next.componentLibrary = structuredClone(project.componentLibrary || []);
      return normalizeProject(next);
    }

    function normalizeMeasurement(value) {
      if (!value || typeof value !== "object") return null;
      return {
        measurementId: value.measurementId || `M-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        room: value.room || "",
        openingName: value.openingName || "洞口",
        widthMm: Math.max(300, Number(value.widthMm || 1200)),
        heightMm: Math.max(300, Number(value.heightMm || 1500)),
        sillHeightMm: Math.max(0, Number(value.sillHeightMm || 0)),
        status: value.status || "待设计",
        note: value.note || ""
      };
    }

    function saveCurrentProjectToLibrary(options = {}) {
      if (options.validate !== false && !validateProjectFields()) return;
      project = migrateLegacyProjectToCanvasModel(project, { assemblyId: selectedAssemblyId });
      resetProjectSelection();
      const summary = projectSummaryFor(project);
      const items = loadProjectLibrary();
      const existingIndex = items.findIndex(item => item.projectId === summary.projectId);
      const record = {
        ...summary,
        savedAt: new Date().toISOString(),
        design: normalizeProject(structuredClone(project))
      };
      if (existingIndex >= 0) items[existingIndex] = record;
      else items.unshift(record);
      projectManagerSelectedId = summary.projectId;
      saveProjectLibrary(items);
      saveProject();
      if (options.toast !== false) showToast(`项目 ${summary.projectId} 已保存到项目库。`);
      renderProjectManager();
    }

    function projectManagerRecords() {
      const items = loadProjectLibrary();
      const currentSummary = projectSummaryFor(project);
      const hasCurrent = items.some(item => item.projectId === currentSummary.projectId);
      const currentRecord = {
        ...currentSummary,
        savedAt: project.project.createdAt || new Date().toISOString(),
        design: normalizeProject(structuredClone(project)),
        isCurrent: true
      };
      return hasCurrent
        ? items.map(item => item.projectId === currentSummary.projectId ? { ...item, design: currentRecord.design, isCurrent: true } : item)
        : [currentRecord, ...items];
    }

    function projectManagerRecordById(projectId, records = projectManagerRecords()) {
      return records.find(item => item.projectId === projectId) || records[0] || null;
    }

    function selectProjectManagerRecord(projectId) {
      projectManagerSelectedId = projectId || "";
      renderProjectManager();
    }

    function resetProjectCreateDialog() {
      [
        "createProjectName",
        "createProjectPhone",
        "createProjectAddress",
        "createProjectCompanyName",
        "createProjectClerk",
        "createProjectDemandDate",
        "createProjectNote"
      ].forEach(id => {
        setValue(id, "");
        document.getElementById(id)?.classList.remove("field-error");
      });
      document.getElementById("projectCreateError")?.classList.add("hidden");
    }

    function openProjectCreateDialog() {
      resetProjectCreateDialog();
      const dialog = document.getElementById("projectCreateDialog");
      if (dialog?.showModal && !dialog.open) dialog.showModal();
      document.getElementById("createProjectName")?.focus();
    }

    function closeProjectCreateDialog() {
      const dialog = document.getElementById("projectCreateDialog");
      if (dialog?.open) dialog.close();
    }

    function validateProjectCreateDialog() {
      const name = valueOf("createProjectName").trim();
      const phone = valueOf("createProjectPhone").trim();
      const validPhone = /^[0-9+\-\s]{3,20}$/.test(phone);
      document.getElementById("createProjectName")?.classList.toggle("field-error", !name);
      document.getElementById("createProjectPhone")?.classList.toggle("field-error", !validPhone);
      const error = document.getElementById("projectCreateError");
      if (error) {
        error.textContent = !name ? "请填写项目名称。" : "请填写正确的客户电话。";
        error.classList.toggle("hidden", Boolean(name && validPhone));
      }
      return Boolean(name && validPhone);
    }

    function saveProjectCreateDialog() {
      if (!validateProjectCreateDialog()) return;
      const details = {
        name: valueOf("createProjectName").trim(),
        contactPhone: valueOf("createProjectPhone").trim(),
        address: valueOf("createProjectAddress").trim(),
        companyName: valueOf("createProjectCompanyName").trim(),
        clerk: valueOf("createProjectClerk").trim(),
        demandDate: valueOf("createProjectDemandDate").trim(),
        note: valueOf("createProjectNote").trim()
      };
      saveCurrentProjectToLibrary({ toast: false, validate: false });
      project = createFreshProject(details);
      resetProjectSelection();
      switchLeft("order");
      closeProjectCreateDialog();
      saveProject();
      render();
      renderProjectManager();
      showToast(`项目“${details.name}”已创建。`);
    }

    function newProject() {
      openProjectCreateDialog();
    }

    function loadProjectFromLibrary(projectId) {
      const record = projectManagerRecordById(projectId);
      if (!record) {
        showToast("项目不存在或已被删除。");
        return;
      }
      project = migrateLegacyProjectToCanvasModel(record.design);
      projectManagerSelectedId = project.project.projectId;
      resetProjectSelection();
      saveCurrentProjectToLibrary({ toast: false, validate: false });
      saveProject();
      closeProjectManager();
      render();
      showToast(`已打开项目 ${project.project.projectId}。`);
    }

    function deleteProjectFromLibrary(projectId) {
      if (!confirm("确认从本机项目库删除该项目记录？当前打开项目不会被清空。")) return;
      const items = loadProjectLibrary().filter(item => item.projectId !== projectId);
      saveProjectLibrary(items);
      if (projectManagerSelectedId === projectId) projectManagerSelectedId = "";
      renderProjectManager();
      showToast("项目记录已删除。");
    }

    function openProjectEditDialog(projectId = project.project.projectId) {
      const record = projectManagerRecordById(projectId) || { design: project };
      const target = normalizeProject(structuredClone(record.design || project));
      editingProjectId = target.project.projectId || projectId || project.project.projectId;
      setValue("editProjectId", target.project.projectId || "");
      setValue("editProjectName", target.project.name || "");
      setValue("editCustomerName", target.project.customerName || "");
      setValue("editProjectPhone", target.project.contactPhone || "");
      setValue("editProjectAddress", target.project.address || "");
      setValue("editOrderId", target.order?.orderId || "");
      setValue("editBatchNo", target.order?.batchNo || "");
      renderSelect("editProjectStatus", PROJECT_STATUS_OPTIONS, target.project.status || "designing");
      const dialog = document.getElementById("projectEditDialog");
      if (dialog?.showModal && !dialog.open) dialog.showModal();
    }

    function closeProjectEditDialog() {
      const dialog = document.getElementById("projectEditDialog");
      if (dialog?.open) dialog.close();
    }

    function saveProjectEditDialog() {
      const nextProjectId = valueOf("editProjectId").trim() || editingProjectId || project.project.projectId;
      const nextName = valueOf("editProjectName").trim();
      const nextPhone = valueOf("editProjectPhone").trim();
      const validPhone = /^[0-9+\-\s]{3,20}$/.test(nextPhone);
      document.getElementById("editProjectName")?.classList.toggle("field-error", !nextName);
      document.getElementById("editProjectPhone")?.classList.toggle("field-error", !validPhone);
      if (!nextName) {
        showToast("请填写项目名称。");
        return;
      }
      if (!validPhone) {
        showToast("请填写正确的客户联系电话。");
        return;
      }
      const applyEdit = design => {
        design.project.projectId = nextProjectId;
        design.project.name = nextName;
        design.project.customerName = valueOf("editCustomerName").trim();
        design.project.contactPhone = nextPhone;
        design.project.address = valueOf("editProjectAddress").trim();
        design.project.status = valueOf("editProjectStatus") || "designing";
        design.order.orderId = valueOf("editOrderId").trim();
        design.order.batchNo = valueOf("editBatchNo").trim();
        return normalizeProject(design);
      };
      const editingCurrent = editingProjectId === project.project.projectId;
      if (editingCurrent) {
        project = applyEdit(project);
        renderInputs();
        markDirty();
        saveCurrentProjectToLibrary({ toast: false, validate: false });
      } else {
        const items = loadProjectLibrary();
        const index = items.findIndex(item => item.projectId === editingProjectId);
        if (index >= 0) {
          const updatedDesign = applyEdit(normalizeProject(structuredClone(items[index].design)));
          items[index] = {
            ...projectSummaryFor(updatedDesign),
            savedAt: new Date().toISOString(),
            design: updatedDesign
          };
          saveProjectLibrary(items);
          projectManagerSelectedId = updatedDesign.project.projectId;
        }
        renderProjectManager();
      }
      editingProjectId = "";
      closeProjectEditDialog();
      showToast("项目信息已保存。");
    }

    function openMeasurementDialog(sourceDesign = project) {
      measurementSourceProject = normalizeProject(structuredClone(sourceDesign || project));
      renderMeasurementList();
      const dialog = document.getElementById("measurementDialog");
      if (dialog?.showModal && !dialog.open) dialog.showModal();
    }

    function closeMeasurementDialog() {
      const dialog = document.getElementById("measurementDialog");
      if (dialog?.open) dialog.close();
      measurementSourceProject = null;
    }

    function measurementRecords() {
      const source = measurementSourceProject || project;
      const explicit = Array.isArray(source.measurements) ? source.measurements : [];
      const designWindows = source === project ? visibleDesignWindows() : source.windows.filter(win => !win.embeddedInWindowId);
      const fromWindows = designWindows.map(win => normalizeMeasurement({
        measurementId: `MW-${win.windowId}`,
        room: win.room || "当前设计",
        openingName: `${win.mark} · ${win.name || "门窗"}`,
        widthMm: win.widthMm,
        heightMm: win.heightMm,
        sillHeightMm: win.installation?.sillHeightMm || 0,
        status: "已生成窗型"
      }));
      return [...explicit, ...fromWindows].filter(Boolean);
    }

    function renderMeasurementList() {
      const records = measurementRecords();
      const list = document.getElementById("measurementList");
      if (!list) return;
      list.innerHTML = records.map(item => `
        <article class="measurement-item">
          <div>
            <strong>${escapeHtml(item.room || "-")} · ${escapeHtml(item.openingName || "洞口")}</strong>
            <span>${Math.round(item.widthMm)}×${Math.round(item.heightMm)} mm · 台高 ${Math.round(item.sillHeightMm || 0)} mm · ${escapeHtml(item.status || "-")}</span>
          </div>
          <button data-measurement-use="${escapeHtml(item.measurementId)}" type="button">生成窗型</button>
        </article>
      `).join("");
      list.querySelectorAll("[data-measurement-use]").forEach(button => {
        button.addEventListener("click", () => useMeasurementAsWindow(button.dataset.measurementUse));
      });
    }

    function useMeasurementAsWindow(measurementId) {
      const record = measurementRecords().find(item => item.measurementId === measurementId);
      if (!record) return;
      const referenceWindow = currentWindow();
      const win = createWindow({
        mark: nextWindowMark(),
        name: record.openingName || "量房窗型",
        widthMm: record.widthMm,
        heightMm: record.heightMm,
        sillHeightMm: record.sillHeightMm,
        room: record.room,
        quantity: 1
      });
      project.windows.push(win);
      selectedWindowId = win.windowId;
      selectedCell = { row: 0, col: 0 };
      selectedMemberId = "";
      selectedJointId = "";
      selectedMarkupId = "";
      selectedPlacementId = "";
      if (referenceWindow) {
        const assembly = ensureAssemblyForReference(referenceWindow);
        const placement = createAssemblyPlacement(win.windowId, referenceWindow.windowId, "right", { gapMm: 0, rotationDeg: 0 });
        assembly.placements.push(placement);
        selectedAssemblyId = assembly.assemblyId;
        selectedPlacementId = placement.placementId;
        drawingMode = "assembly";
      } else {
        selectedAssemblyId = "";
        drawingMode = "window";
      }
      closeMeasurementDialog();
      switchLeft("draw");
      switchInspector(drawingMode === "assembly" ? "assembly" : "window");
      markDirty();
      showToast("已按量房洞口生成新窗型。");
    }

    function currentWindow() {
      return project.windows.find(w => w.windowId === selectedWindowId) || project.windows[0];
    }

    function isEmbeddedFrame(win) {
      return Boolean(win?.embeddedInWindowId);
    }

    function rootWindowIdFor(win) {
      return win?.embeddedInWindowId || win?.windowId || "";
    }

    function visibleDesignWindows() {
      const roots = project.windows.filter(win => !isEmbeddedFrame(win));
      return roots.length ? roots : project.windows;
    }

    function hasAssemblyScene() {
      return project.assemblies?.some(assembly => assembly.placements?.length) || false;
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

    function findCellMarkup(markupId) {
      if (!markupId) return null;
      const selected = currentWindow();
      const windows = [
        selected,
        ...project.windows.filter(win => win.windowId !== selected?.windowId)
      ].filter(Boolean);
      for (const win of windows) {
        for (let row = 0; row < win.layout.rows.length; row += 1) {
          for (let col = 0; col < win.layout.columns.length; col += 1) {
            const cell = win.layout.cells[cellIndex(row, col, win.layout.columns.length)];
            const markup = cell?.markups?.find(item => item.markupId === markupId);
            if (markup) return { win, cell, markup, row, col };
          }
        }
      }
      return null;
    }

    function cloneCell(cell) {
      const cloned = {
        ...structuredClone(cell),
        cellId: createCellId()
      };
      cloned.markups = normalizeCellMarkups(cloned.markups).map(markup => ({
        ...markup,
        markupId: createMarkupId(),
        hostCellId: cloned.cellId
      }));
      return cloned;
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

    function validateProjectFields(options = {}) {
      const name = valueOf("projectName").trim();
      const phone = valueOf("projectPhone").trim();
      const validPhone = /^[0-9+\-\s]{3,20}$/.test(phone);
      document.getElementById("projectName")?.classList.toggle("field-error", !name);
      document.getElementById("projectPhone")?.classList.toggle("field-error", !validPhone);
      if (!name) {
        if (options.toast !== false) showToast("请填写项目名称。");
        return false;
      }
      if (!validPhone) {
        if (options.toast !== false) showToast("请填写正确的客户联系电话。");
        return false;
      }
      return true;
    }

    function updateProjectFromInputs() {
      project.project.projectId = valueOf("projectId");
      project.project.name = valueOf("projectName");
      project.project.customerName = valueOf("customerName");
      project.project.contactPhone = valueOf("projectPhone");
      project.project.status = valueOf("projectStatus") || "designing";
      project.project.address = valueOf("projectAddress");
      project.order.orderId = valueOf("orderId");
      project.order.batchNo = valueOf("batchNo");
      validateProjectFields({ toast: false });
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

    function defaultOpeningSummary(win) {
      if (!win) return "";
      const counts = new Map();
      win.layout.cells.forEach(cell => {
        const label = typeLabels[cell.type] || cell.type;
        counts.set(label, (counts.get(label) || 0) + 1);
      });
      return Array.from(counts.entries()).map(([label, count]) => `${label}${count > 1 ? count : ""}`).join("、");
    }

    function updateWindowSaveTotals(win = currentWindow()) {
      if (!win) return 0;
      const quantity = Math.max(1, Number(valueOf("winQty") || win.quantity || 1));
      const unitPrice = Math.max(0, Number(valueOf("saveUnitPrice") || 0));
      const totalPrice = quantity * unitPrice;
      setValue("saveUnitPriceQty", quantity);
      setValue("saveTotalPrice", totalPrice);
      win.orderInfo = normalizeWindowOrderInfo({
        ...win.orderInfo,
        unitPrice,
        totalPrice
      }, { ...win, quantity });
      return totalPrice;
    }

    function updateWindowSaveInfoFromInputs(options = {}) {
      const win = currentWindow();
      if (!win) return false;
      win.mark = valueOf("winMark").trim();
      win.quantity = Math.max(1, Number(valueOf("winQty") || 1));
      win.seriesId = valueOf("saveSeriesId") || win.seriesId;
      win.defaultGlassTypeId = valueOf("saveGlassTypeId") || win.defaultGlassTypeId;
      const color = valueOf("saveColor").trim();
      if (color) {
        win.colorInside = color;
        win.colorOutside = color;
      }
      win.orderInfo = normalizeWindowOrderInfo({
        ...win.orderInfo,
        installLocation: valueOf("saveInstallLocation").trim(),
        color,
        openingMode: valueOf("saveOpeningMode").trim() || defaultOpeningSummary(win),
        unitPrice: Math.max(0, Number(valueOf("saveUnitPrice") || 0)),
        note: valueOf("saveWindowNote").trim()
      }, win);
      updateWindowSaveTotals(win);
      if (options.dirty !== false) markDirty();
      return true;
    }

    function validateWindowSaveInfo() {
      updateWindowSaveInfoFromInputs({ dirty: false });
      const win = currentWindow();
      if (!win) return false;
      const required = [
        ["winMark", Boolean(win.mark)],
        ["saveInstallLocation", Boolean(win.orderInfo?.installLocation)],
        ["saveSeriesId", Boolean(win.seriesId)],
        ["saveGlassTypeId", Boolean(win.defaultGlassTypeId)]
      ];
      const valid = required.every(([, ok]) => ok);
      required.forEach(([id, ok]) => document.getElementById(id)?.classList.toggle("field-error", !ok));
      document.getElementById("windowSaveError")?.classList.toggle("hidden", valid);
      if (!valid) showToast("窗号、安装位置、系列、玻璃为必填项。");
      return valid;
    }

    function renderWindowSaveConfirmSummary() {
      const win = currentWindow();
      const container = document.getElementById("windowSaveConfirmSummary");
      if (!win || !container) return;
      const series = project.catalog.profileSystems.find(item => item.id === win.seriesId);
      const glass = project.catalog.glassTypes.find(item => item.id === win.defaultGlassTypeId);
      container.innerHTML = `
        <strong>${escapeHtml(win.mark)} · ${escapeHtml(win.name || "门窗")}</strong>
        <span>安装位置：${escapeHtml(win.orderInfo?.installLocation || "-")}</span>
        <span>规格：${win.widthMm}×${win.heightMm} mm · ${win.quantity}樘</span>
        <span>系列：${escapeHtml(series?.name || win.seriesId || "-")}</span>
        <span>玻璃：${escapeHtml(glass?.name || win.defaultGlassTypeId || "-")}</span>
        <span>颜色：${escapeHtml(win.orderInfo?.color || win.colorInside || "-")}</span>
        <span>开启方式：${escapeHtml(win.orderInfo?.openingMode || defaultOpeningSummary(win) || "-")}</span>
        <span>总价：${Number(win.orderInfo?.totalPrice || 0).toLocaleString()} 元</span>
      `;
    }

    function openWindowSaveConfirmDialog() {
      if (!validateWindowSaveInfo()) return;
      renderWindowSaveConfirmSummary();
      const dialog = document.getElementById("windowSaveConfirmDialog");
      if (dialog?.showModal && !dialog.open) dialog.showModal();
    }

    function closeWindowSaveConfirmDialog() {
      const dialog = document.getElementById("windowSaveConfirmDialog");
      if (dialog?.open) dialog.close();
    }

    function confirmSaveWindowInfo(options = {}) {
      if (!validateWindowSaveInfo()) return false;
      const win = currentWindow();
      if (!win) return false;
      win.orderInfo = normalizeWindowOrderInfo({
        ...win.orderInfo,
        savedToProject: true,
        savedAt: new Date().toISOString()
      }, win);
      project.project.status = project.project.status === "new" ? "designing" : project.project.status;
      saveCurrentProjectToLibrary({ toast: false, validate: false });
      saveProject();
      closeWindowSaveConfirmDialog();
      render();
      if (options.toast !== false) showToast(`门窗 ${win.mark} 已添加到当前项目。`);
      return true;
    }

    function saveWindowInfoAndCreateNext() {
      if (!validateWindowSaveInfo()) return;
      const saved = confirmSaveWindowInfo({ toast: false });
      if (!saved) return;
      const savedMark = currentWindow()?.mark || "";
      newWindow();
      showToast(`${savedMark} 已保存，已新增下一樘门窗。`);
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
      cell.panelMode = normalizePanelMode(valueOf("cellPanelMode"));
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

    function localMullionName(orientation) {
      return orientation === "vertical" ? "竖梃" : "横梃";
    }

    function localMullionExists(win, row, col, orientation, positionRatio = 0.5) {
      const cell = win?.layout?.cells?.[cellIndex(row, col, win.layout.columns.length)];
      if (!cell?.cellId) return false;
      return Boolean(win.topology?.members?.some(member => (
        member.hostRegionId === cell.cellId &&
        member.orientation === orientation &&
        Math.abs(Number(member.positionRatio ?? 0.5) - positionRatio) < 0.015 &&
        Math.abs(Number(member.span?.startRatio ?? 0)) < 0.015 &&
        Math.abs(Number(member.span?.endRatio ?? 1) - 1) < 0.015
      )));
    }

    function addSegmentedLocalMullion(win, row, col, orientation, options = {}) {
      if (!win) return null;
      const cols = win.layout.columns.length;
      const targetCell = win.layout.cells[cellIndex(row, col, cols)];
      if (!targetCell || targetCell.type === "empty") {
        showToast(`请选择有效窗格后再加入${localMullionName(orientation)}。`);
        return null;
      }
      win.topology = normalizeTopology(win.topology, win.layout);
      if (localMullionExists(win, row, col, orientation)) {
        showToast(`该窗格已有局部${localMullionName(orientation)}，未重复叠加。`);
        return null;
      }
      const member = createLocalMullion(
        win.layout,
        row,
        col,
        orientation,
        currentSeries(win)?.mullionProfile || ""
      );
      win.topology.members.push(member);
      win.geometryMode = "topology";
      selectedCell = { row, col };
      selectedJointId = "";
      selectedMemberId = member.memberId;
      switchInspector("member");
      if (options.markDirty !== false) markDirty();
      return member;
    }

    function splitSelectedColumn(partCount = 2) {
      const win = currentWindow();
      if (!win) return;
      selectedMemberId = "";
      selectedJointId = "";
      const cols = win.layout.columns.length;
      const rows = win.layout.rows.length;
      const col = Math.min(selectedCell.col, cols - 1);
      const row = Math.min(selectedCell.row, rows - 1);
      if (partCount === 2 && rows > 1) {
        const member = addSegmentedLocalMullion(win, row, col, "vertical");
        if (member) showToast("已有横向分隔，已在选中窗格加入局部竖梃，未切穿横梃。");
        return;
      }
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
      const col = Math.min(selectedCell.col, cols - 1);
      if (partCount === 2 && cols > 1) {
        const member = addSegmentedLocalMullion(win, row, col, "horizontal");
        if (member) showToast("已有竖向分隔，已在选中窗格加入局部横梃，未切穿竖梃。");
        return;
      }
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

    function cellPresetLabel(type, options = {}) {
      if (type === "turn" && options.panelCount === 2) return "外开对开扇";
      if (type === "turn" && options.opening === "left_out") return "左外开扇";
      if (type === "turn" && options.opening === "right_out") return "右外开扇";
      if (type === "sliding" && options.panelCount === 2) return "两扇等分推拉";
      if (type === "sliding" && options.panelCount === 3) return "三扇三等分推拉";
      if (type === "sliding" && options.panelCount === 4) return "四扇四等分推拉";
      return typeLabels[type] || type;
    }

    function startCellPresetPlacement(type, options = {}) {
      const win = currentWindow();
      if (!win) {
        canvasCommand = {
          mode: "add_root_window",
          jointType: "",
          jointId: "",
          shapeType: "rectangular",
          cellPreset: type,
          cellOpening: options.opening || "",
          cellPanels: options.panelCount ? String(options.panelCount) : "",
          cellTracks: options.trackCount ? String(options.trackCount) : "",
          panelMode: options.panelMode || "",
          markupType: ""
        };
        selectedMemberId = "";
        selectedJointId = "";
        drawingMode = "window";
        switchInspector("window");
        render();
        showToast(`已选择${cellPresetLabel(type, options)}，请在空画布点击放置第一樘窗。`);
        return;
      }
      const joint = currentJoint();
      if (joint && type === "fixed_glass") {
        pendingConnectedShapeType = "rectangular";
        canvasCommand = { mode: "add_window_from_joint", jointType: "", jointId: joint.jointId, shapeType: "rectangular", cellPreset: "", cellOpening: "", cellPanels: "", cellTracks: "", panelMode: "", markupType: "" };
        selectedMemberId = "";
        drawingMode = hasAssemblyScene() ? "assembly" : "window";
        switchInspector("joint");
        render();
        showToast("固定玻璃窗将通过当前连接点接出，请在完整拼接图的虚线区域点击确认位置，右键退出。");
        return;
      }
      canvasCommand = {
        mode: "apply_cell_preset",
        jointType: "",
        jointId: "",
        shapeType: "",
        cellPreset: type,
        cellOpening: options.opening || "",
        cellPanels: options.panelCount ? String(options.panelCount) : "",
        cellTracks: options.trackCount ? String(options.trackCount) : "",
        panelMode: options.panelMode || "",
        markupType: ""
      };
      selectedMemberId = "";
      selectedJointId = "";
      drawingMode = hasAssemblyScene() ? "assembly" : "window";
      switchInspector("cell");
      render();
      showToast(`已选择${cellPresetLabel(type, options)}，请在画布点击目标窗格，右键退出。`);
    }

    function markupToolLabel(kind) {
      return {
        text: "文字标注",
        circle_hole: "圆孔",
        square_hole: "方孔",
        lock: "锁具"
      }[kind] || "标注";
    }

    function startCellMarkupPlacement(kind) {
      const win = currentWindow();
      if (!win) return;
      canvasCommand = {
        mode: "add_cell_markup",
        jointType: "",
        jointId: "",
        shapeType: "",
        cellPreset: "",
        cellOpening: "",
        cellPanels: "",
        cellTracks: "",
        panelMode: "",
        markupType: kind
      };
      selectedMemberId = "";
      selectedJointId = "";
      drawingMode = hasAssemblyScene() ? "assembly" : "window";
      switchInspector("cell");
      render();
      showToast(`已选择${markupToolLabel(kind)}，请点击目标玻璃区域放置，右键退出。`);
    }

    function applyCellPreset(type, options = {}) {
      const win = currentWindow();
      const cell = currentCell(win);
      if (!cell) return;
      if (LEGACY_FILL_CELL_TYPES.includes(type)) {
        applyCellFillOrAccessory(type, options);
        return;
      }
      const hasLocalMembers = win.topology?.members?.some(member => member.hostRegionId === cell.cellId);
      if (hasLocalMembers && type !== "fixed_glass") {
        showToast("该窗格含局部中梃，请先删除局部梃再设置开启扇或辅件。");
        return;
      }
      const next = createCell(type, options.opening || cell.opening);
      if (options.panelCount && isOperableType(next.type)) {
        const panelCount = Number(options.panelCount);
        const trackCount = Number(options.trackCount || 0);
        const activePanelCount = next.type === "sliding"
          ? Math.max(1, Math.min(panelCount, Math.ceil(panelCount / 2)))
          : panelCount;
        next.openingAssembly = normalizeOpeningAssembly(next.type, next.opening, {
          ...next.openingAssembly,
          panelCount,
          activePanelCount,
          trackCount: trackCount || next.openingAssembly.trackCount
        });
      }
      const glassTypeId = cell.glassTypeId;
      const panelTypeId = cell.panelTypeId;
      cell.type = next.type;
      cell.opening = next.opening;
      cell.openingAssembly = next.openingAssembly;
      cell.glassTypeId = glassTypeId || next.glassTypeId;
      cell.hardwareSetId = next.hardwareSetId;
      cell.panelTypeId = panelTypeId || next.panelTypeId;
      if (type === "sliding") {
        const slidingSeries = project.catalog.profileSystems.find(series => series.name?.includes("推拉") || series.id?.toLowerCase().includes("slide"));
        if (slidingSeries) win.seriesId = slidingSeries.id;
      }
      switchInspector("cell");
      markDirty();
      showToast(`选中单元已设为${cellPresetLabel(type, options)}。`);
    }

    function applyCellFillOrAccessory(type, options = {}) {
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
        const requestedPanelMode = type === "panel" ? normalizePanelMode(options.panelMode || cell.panelMode) : "";
        cell.infillType = type === "panel" && options.panelMode
          ? "panel"
          : (cell.infillType === type ? "glass" : type);
        if (type === "panel" && cell.infillType === "panel") {
          cell.panelMode = requestedPanelMode;
        }
        if (type === "panel" && cell.infillType === "glass") {
          cell.panelMode = normalizePanelMode(options.panelMode || cell.panelMode);
        }
        showToast(cell.infillType === "glass" ? "填充已恢复为玻璃。" : `选中窗格填充已设为${type === "panel" ? panelModeLabel(cell.panelMode) : typeLabels[type]}。`);
      } else if (type === "security") {
        cell.accessories.securityBars = !cell.accessories.securityBars;
        showToast(cell.accessories.securityBars ? "已为选中区域添加防盗条。" : "已取消选中区域防盗条。");
      } else if (type === "guardRail") {
        cell.accessories.guardRail = !cell.accessories.guardRail;
        showToast(cell.accessories.guardRail ? "已为选中玻璃添加玻璃护栏。" : "已取消选中玻璃护栏。");
      }
      switchInspector("cell");
      markDirty();
    }

    function applyScreensToAllOperableCells() {
      const win = currentWindow();
      if (!win) return;
      let changed = 0;
      win.layout.cells.forEach(cell => {
        if (!isOperableType(cell.type)) return;
        const nextMode = defaultScreenModeForCell(cell);
        cell.accessories = normalizeCellAccessories({
          ...cell.accessories,
          screenMode: nextMode
        });
        cell.openingAssembly = normalizeOpeningAssembly(cell.type, cell.opening, {
          ...cell.openingAssembly,
          screenMode: nextMode
        });
        changed += 1;
      });
      if (!changed) {
        showToast("当前门窗没有可加纱的开启扇。");
        return;
      }
      selectedMemberId = "";
      selectedJointId = "";
      switchInspector("cell");
      markDirty();
      showToast(`已为当前门窗 ${changed} 个开启扇一键加纱。`);
    }

    function cellCanReceiveSecurityBars(cell) {
      return cell && cell.type !== "empty";
    }

    function applySecurityBarsToAllCells() {
      const win = currentWindow();
      if (!win) return;
      let changed = 0;
      win.layout.cells.forEach(cell => {
        if (!cellCanReceiveSecurityBars(cell)) return;
        cell.accessories = normalizeCellAccessories({
          ...cell.accessories,
          securityBars: true
        });
        changed += 1;
      });
      if (!changed) {
        showToast("当前门窗没有可添加防盗条的目标区域。");
        return;
      }
      selectedMemberId = "";
      selectedJointId = "";
      switchInspector("cell");
      markDirty();
      showToast(`已为当前门窗 ${changed} 个目标区域一键添加防盗条。`);
    }

    function applyShapePreset(type) {
      const win = currentWindow();
      if (!win) {
        if (type === "custom_polygon") {
          openDiyShapeEditor({ blank: true });
          return;
        }
        canvasCommand = {
          mode: "add_root_window",
          jointType: "",
          jointId: "",
          shapeType: SHAPE_PRESET_BY_TYPE[type] ? type : "rectangular",
          cellPreset: "",
          cellOpening: "",
          cellPanels: "",
          cellTracks: "",
          panelMode: "",
          markupType: ""
        };
        drawingMode = "window";
        switchInspector("window");
        render();
        showToast(`已选择${shapeLabel(type)}，请在空画布点击放置第一樘窗。`);
        return;
      }
      const joint = currentJoint();
      if (joint) {
        if (type === "custom_polygon") {
          showToast("DIY异形窗请先保存为窗型，再接到连接件。");
          return;
        }
        pendingConnectedShapeType = type;
        canvasCommand = { mode: "add_window_from_joint", jointType: "", jointId: joint.jointId, shapeType: type, cellPreset: "", cellOpening: "", cellPanels: "", cellTracks: "", panelMode: "", markupType: "" };
        drawingMode = hasAssemblyScene() ? "assembly" : "window";
        render();
        showToast(`${shapeLabel(type)}将通过${joint.type === "corner" ? "转角料" : "拼接料"}接出，请在完整拼接图的虚线区域点击确认位置，右键退出。`);
        return;
      }
      if (type === "custom_polygon") {
        openDiyShapeEditor({ blank: true });
        return;
      }
      createWindowFromShapePreset(type);
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
      const row = Math.min(selectedCell.row, win.layout.rows.length - 1);
      const col = Math.min(selectedCell.col, win.layout.columns.length - 1);
      const member = addSegmentedLocalMullion(win, row, col, orientation);
      if (member) showToast(`已在选中窗格加入局部${localMullionName(orientation)}。`);
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

    function startEngineeringJointPlacement(type) {
      const win = currentWindow();
      if (!win) return;
      closeJointPositionDialog();
      hideJointContextMenu();
      hideAssemblyContextMenu();
      hideMemberContextMenu();
      canvasCommand = { mode: "add_joint", jointType: type === "corner" ? "corner" : "splice", jointId: "", shapeType: "", cellPreset: "", cellOpening: "", cellPanels: "", cellTracks: "", panelMode: "", markupType: "" };
      selectedMemberId = "";
      selectedJointId = "";
      drawingMode = hasAssemblyScene() ? "assembly" : "window";
      switchInspector(drawingMode === "assembly" ? "assembly" : "window");
      render();
      showToast(type === "corner"
        ? "快捷操作提示：请在完整拼接图的虚线区域添加转角料，右键退出。"
        : "快捷操作提示：请在完整拼接图的虚线区域添加拼接料，右键退出。");
    }

    function cancelCanvasCommand(message = "已退出当前绘图命令。") {
      if (!canvasCommand.mode) return;
      canvasCommand = { mode: "", jointType: "", jointId: "", shapeType: "", cellPreset: "", cellOpening: "", cellPanels: "", cellTracks: "", panelMode: "", markupType: "" };
      render();
      showToast(message);
    }

    function addEngineeringJointAtEdge(type, edge) {
      const assembly = drawingMode === "assembly" ? currentProjectAssembly() : null;
      const boundary = assembly ? assemblyBoundaryItemForEdge(assembly, edge) : null;
      const win = boundary?.window || currentWindow();
      if (!win) return;
      const joint = createEngineeringJoint(type, win, currentSeries(win));
      joint.hostEdge = hostEdgeForDock(edge);
      project.joints ||= [];
      project.joints.push(joint);
      selectedWindowId = win.windowId;
      selectedPlacementId = boundary?.placementId || "";
      selectedMemberId = "";
      selectedJointId = joint.jointId;
      canvasCommand = { mode: "add_joint", jointType: joint.type, jointId: "", shapeType: "", cellPreset: "", cellOpening: "", cellPanels: "", cellTracks: "", panelMode: "", markupType: "" };
      switchInspector("joint");
      markDirty();
      showToast(`已在${dockLabel(edge)}增加${joint.type === "corner" ? "转角料" : "拼接料"}。可继续点击其它边，右键退出添加。`);
    }

    function insertEngineeringJointAtPlacement(type, placementId) {
      const assembly = currentProjectAssembly();
      const placement = assembly?.placements?.find(item => item.placementId === placementId);
      const hostWindow = placement ? project.windows.find(win => win.windowId === placement.referenceWindowId) : null;
      if (!placement || !hostWindow || placement.jointId) return;
      const joint = createEngineeringJoint(type, hostWindow, currentSeries(hostWindow));
      joint.hostEdge = hostEdgeForDock(placement.dock);
      joint.connectedWindowIds = [placement.referenceWindowId, placement.windowId];
      project.joints ||= [];
      project.joints.push(joint);
      placement.jointId = joint.jointId;
      placement.gapMm = placementGapForJoint(joint);
      placement.rotationDeg = placementRotationForJoint(joint);
      selectedWindowId = hostWindow.windowId;
      selectedPlacementId = "";
      selectedMemberId = "";
      selectedMarkupId = "";
      selectedJointId = joint.jointId;
      canvasCommand = { ...canvasCommand, mode: "add_joint", jointType: joint.type, jointId: "" };
      switchInspector("joint");
      markDirty();
      showToast(`已在两樘窗中缝插入${joint.type === "corner" ? "转角料" : "拼接料"}。`);
    }

    function assemblyBoundaryItemForEdge(assembly, edge) {
      const layout = resolveAssemblyElevationLayout(assembly, project.windows).items || [];
      if (!layout.length) return null;
      const targetEdge = hostEdgeForDock(edge);
      const score = item => {
        if (targetEdge === "left") return item.x;
        if (targetEdge === "right") return -(item.x + item.w);
        if (targetEdge === "top") return item.y;
        if (targetEdge === "bottom") return -(item.y + item.h);
        return 0;
      };
      return layout.reduce((best, item) => !best || score(item) < score(best) ? item : best, null);
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
      syncPlacementsForJoint(joint);
      markDirty();
    }

    function deleteSelectedJoint() {
      const joint = currentJoint();
      if (!joint) return;
      project.joints = project.joints.filter(item => item.jointId !== joint.jointId);
      project.assemblies?.forEach(assembly => {
        assembly.placements.forEach(placement => {
          if (placement.jointId === joint.jointId) {
            placement.jointId = "";
            placement.gapMm = 0;
            placement.rotationDeg = 0;
          }
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

    function syncPlacementsForJoint(joint) {
      if (!joint?.jointId) return;
      (project.assemblies || []).forEach(assembly => {
        assembly.placements.forEach(placement => {
          if (placement.jointId !== joint.jointId) return;
          placement.gapMm = placementGapForJoint(joint);
          placement.rotationDeg = placementRotationForJoint(joint);
        });
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
      drawingMode = hasAssemblyScene() || mode === "assembly" ? "assembly" : "window";
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
      const assembly = createWindowAssembly(root, `门窗拼接${project.assemblies.length + 1}`);
      project.assemblies.push(assembly);
      selectedAssemblyId = assembly.assemblyId;
      selectedPlacementId = "";
      drawingMode = "assembly";
      switchInspector("assembly");
      markDirty();
      showToast(`已以${root.mark}作为基准窗。`);
    }

    function assemblyContainsWindow(assembly, windowId) {
      return assembly?.rootWindowId === windowId || assembly?.placements?.some(item => item.windowId === windowId);
    }

    function ensureAssemblyForReference(referenceWindow) {
      project.assemblies ||= [];
      let assembly = currentProjectAssembly();
      if (!assemblyContainsWindow(assembly, referenceWindow.windowId)) {
        assembly = project.assemblies.find(item => assemblyContainsWindow(item, referenceWindow.windowId));
      }
      if (!assembly) {
        assembly = createWindowAssembly(referenceWindow, `门窗拼接${project.assemblies.length + 1}`);
        project.assemblies.push(assembly);
      }
      selectedAssemblyId = assembly.assemblyId;
      return assembly;
    }

    function nextWindowMark() {
      const usedMarks = new Set(project.windows.map(win => win.mark));
      for (let index = project.windows.length + 1; index < project.windows.length + 1000; index += 1) {
        const mark = `C-${String(index).padStart(2, "0")}`;
        if (!usedMarks.has(mark)) return mark;
      }
      return `C-${Date.now().toString(36).toUpperCase()}`;
    }

    function createConnectedWindow(referenceWindow, dock, joint, shapeType = "rectangular") {
      const edge = dock === "free" ? hostEdgeForDock(joint?.hostEdge) : hostEdgeForDock(dock);
      const lateral = edge === "left" || edge === "right";
      const normalizedShape = normalizeWindowShape({
        type: SHAPE_PRESET_BY_TYPE[shapeType] ? shapeType : "rectangular",
        archHeightMm: shapeType === "arched" ? 220 : 0
      });
      return createWindow({
        mark: nextWindowMark(),
        name: joint?.type === "corner" ? "转角拼接窗" : "拼接窗",
        embeddedInWindowId: rootWindowIdFor(referenceWindow),
        widthMm: lateral ? 1000 : Number(referenceWindow.widthMm || 1200),
        heightMm: lateral ? Number(referenceWindow.heightMm || 1500) : 1000,
        quantity: Number(referenceWindow.quantity || 1),
        floor: referenceWindow.floor,
        room: referenceWindow.room,
        seriesId: referenceWindow.seriesId,
        colorInside: referenceWindow.colorInside,
        colorOutside: referenceWindow.colorOutside,
        defaultGlassTypeId: referenceWindow.defaultGlassTypeId,
        defaultHardwareSetId: referenceWindow.defaultHardwareSetId,
        shape: normalizedShape,
        layout: {
          columns: [1],
          rows: [1],
          cells: [{ type: "fixed_glass", opening: "fixed" }]
        }
      });
    }

    function openJointPositionDialog(mode = "window", options = {}) {
      const dialog = document.getElementById("jointPositionDialog");
      const joint = currentJoint();
      if (!dialog || !joint) return;
      jointPositionDialogMode = mode === "joint" ? "joint" : "window";
      if (options.shapeType) pendingConnectedShapeType = options.shapeType;
      const title = document.getElementById("jointPositionDialogTitle");
      const subtitle = document.getElementById("jointPositionSubtitle");
      if (title) title.textContent = jointPositionDialogMode === "joint" ? "选择连接位置" : "选择窗型位置";
      if (subtitle) {
        subtitle.textContent = jointPositionDialogMode === "joint"
          ? `${jointLabel(joint)} · 选择安装在当前窗的哪一边`
          : `${jointLabel(joint)} · ${shapeLabel(pendingConnectedShapeType)}接到哪一边`;
      }
      dialog.querySelectorAll("[data-joint-position]").forEach(button => {
        button.classList.toggle("hidden", jointPositionDialogMode === "joint" && button.dataset.jointPosition === "free");
      });
      if (dialog.showModal && !dialog.open) dialog.showModal();
    }

    function closeJointPositionDialog() {
      const dialog = document.getElementById("jointPositionDialog");
      if (dialog?.open) dialog.close();
    }

    function chooseJointPosition(dock) {
      const joint = currentJoint();
      if (!joint) {
        showToast("请先选择拼接料或转角料。");
        return;
      }
      closeJointPositionDialog();
      if (jointPositionDialogMode === "joint") {
        joint.hostEdge = hostEdgeForDock(dock);
        markDirty();
        switchInspector("joint");
        showToast(`已在${dockLabel(dock)}增加${joint.type === "corner" ? "转角料" : "拼接料"}，可设置角度后再选择窗框。`);
        return;
      }
      addAssemblyPlacement(dock, { forceCreate: true, shapeType: pendingConnectedShapeType });
    }

    function addAssemblyPlacement(dock, options = {}) {
      const selectedJoint = currentJoint();
      const referenceWindow = selectedJoint
        ? project.windows.find(win => win.windowId === selectedJoint.hostWindowId)
        : currentWindow();
      if (!referenceWindow) return;
      const assembly = ensureAssemblyForReference(referenceWindow);
      let useJoint = selectedJoint && selectedJoint.hostWindowId === referenceWindow.windowId ? selectedJoint : null;
      const shouldCreateFromJoint = Boolean(useJoint) || Boolean(options.forceCreate);
      if (useJoint && dock !== "free") {
        useJoint.hostEdge = hostEdgeForDock(dock);
      }
      let createdWindow = false;
      let movingWindow = null;
      const existing = !selectedJoint ? assembly.placements.find(item => item.windowId === selectedWindowId) : null;
      if (existing) {
        existing.dock = dock;
        if (dock !== "free") existing.freePosition = { xMm: 0, yMm: 0, zMm: 0 };
        selectedPlacementId = existing.placementId;
      } else {
        const positioned = new Set([assembly.rootWindowId, ...assembly.placements.map(item => item.windowId)]);
        movingWindow = currentWindow();
        if (!movingWindow || movingWindow.windowId === referenceWindow.windowId || positioned.has(movingWindow.windowId)) {
          movingWindow = project.windows.find(win => win.windowId !== referenceWindow.windowId && !positioned.has(win.windowId));
        }
        if (!movingWindow || shouldCreateFromJoint) {
          movingWindow = createConnectedWindow(referenceWindow, dock, useJoint, options.shapeType);
          project.windows.push(movingWindow);
          createdWindow = true;
        }
        const placement = createAssemblyPlacement(movingWindow.windowId, referenceWindow.windowId, dock, {
          gapMm: placementGapForJoint(useJoint),
          rotationDeg: placementRotationForJoint(useJoint),
          jointId: useJoint?.jointId || "",
          freePosition: dock === "free"
            ? { xMm: (Number(referenceWindow.widthMm || 0) + Number(movingWindow.widthMm || 0)) / 2 + 300, yMm: 0, zMm: 0 }
            : undefined
        });
        assembly.placements.push(placement);
        if (useJoint) {
          useJoint.connectedWindowIds = [...new Set([
            useJoint.hostWindowId,
            ...useJoint.connectedWindowIds,
            referenceWindow.windowId,
            movingWindow.windowId
          ])];
        }
        selectedWindowId = movingWindow.windowId;
        selectedPlacementId = placement.placementId;
      }
      selectedMemberId = "";
      selectedJointId = useJoint?.jointId || "";
      drawingMode = "assembly";
      normalizeProjectAssemblies();
      switchInspector("assembly");
      markDirty();
      const action = createdWindow ? "已在当前拼接图中新增并连接到" : "已设置到";
      const via = useJoint ? `，通过${useJoint.type === "corner" ? "转角料" : "拼接料"}${jointLabel(useJoint, project.joints.indexOf(useJoint))}` : "";
      showToast(`${movingWindow ? movingWindow.mark : "当前窗"}${action}${dockLabel(dock)}${via}。`);
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
      showToast("窗体已移出当前拼接。 ");
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
      showToast("门窗拼接关系已删除，原窗设计仍然保留。 ");
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
      showToast("当前没有独立新建门窗流程，请从左侧门/窗框工具在画布上添加。");
    }

    function createWindowFromShapePreset(type) {
      const referenceWindow = currentWindow();
      const normalizedShape = normalizeWindowShape({
        type: SHAPE_PRESET_BY_TYPE[type] ? type : "rectangular",
        archHeightMm: type === "arched" ? 220 : 0
      });
      const win = createWindow({
        mark: nextWindowMark(),
        name: shapeLabel(type),
        widthMm: referenceWindow?.widthMm || 1200,
        heightMm: referenceWindow?.heightMm || 1500,
        shape: normalizedShape,
        layout: {
          columns: [1],
          rows: [1],
          cells: [{ type: "fixed_glass", opening: "fixed" }]
        }
      });
      project.windows.push(win);
      selectedWindowId = win.windowId;
      selectedCell = { row: 0, col: 0 };
      selectedMemberId = "";
      selectedJointId = "";
      selectedAssemblyId = "";
      selectedPlacementId = "";
      if (referenceWindow) {
        const assembly = ensureAssemblyForReference(referenceWindow);
        const placement = createAssemblyPlacement(win.windowId, referenceWindow.windowId, "right", { gapMm: 0, rotationDeg: 0 });
        assembly.placements.push(placement);
        selectedAssemblyId = assembly.assemblyId;
        selectedPlacementId = placement.placementId;
        drawingMode = "assembly";
        switchInspector("assembly");
      } else {
        drawingMode = "window";
        switchInspector("window");
      }
      markDirty();
      showToast(`已生成${shapeLabel(type)}窗框。`);
    }

    function createRootWindowFromCanvasCommand() {
      if (canvasCommand.mode !== "add_root_window") return;
      const command = { ...canvasCommand };
      const shapeType = SHAPE_PRESET_BY_TYPE[command.shapeType] ? command.shapeType : "rectangular";
      const normalizedShape = normalizeWindowShape({
        type: shapeType,
        archHeightMm: shapeType === "arched" ? 220 : 0
      });
      const win = createWindow({
        mark: nextWindowMark(),
        name: command.cellPreset ? cellPresetLabel(command.cellPreset, {
          opening: command.cellOpening,
          panelCount: Number(command.cellPanels || 0) || undefined,
          trackCount: Number(command.cellTracks || 0) || undefined,
          panelMode: command.panelMode || undefined
        }) : shapeLabel(shapeType),
        widthMm: 1200,
        heightMm: 1500,
        shape: normalizedShape,
        layout: {
          columns: [1],
          rows: [1],
          cells: [{ type: "fixed_glass", opening: "fixed" }]
        }
      });
      project.windows.push(win);
      selectedWindowId = win.windowId;
      selectedCell = { row: 0, col: 0 };
      selectedMemberId = "";
      selectedJointId = "";
      selectedMarkupId = "";
      selectedAssemblyId = "";
      selectedPlacementId = "";
      drawingMode = "window";
      canvasCommand = { mode: "", jointType: "", jointId: "", shapeType: "", cellPreset: "", cellOpening: "", cellPanels: "", cellTracks: "", panelMode: "", markupType: "" };
      if (command.cellPreset) {
        applyCellPreset(command.cellPreset, {
          opening: command.cellOpening,
          panelCount: Number(command.cellPanels || 0) || undefined,
          trackCount: Number(command.cellTracks || 0) || undefined,
          panelMode: command.panelMode || undefined
        });
      } else {
        switchInspector("window");
        markDirty();
      }
      showToast(`已在画布添加${win.mark}。`);
    }

    function duplicateWindow() {
      const win = currentWindow();
      if (!win) return;
      const copy = structuredClone(win);
      copy.windowId = `W-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      copy.mark = `${win.mark}-副本`;
      const cellIdMap = new Map();
      copy.layout.cells = copy.layout.cells.map(cell => {
        const oldCellId = cell.cellId;
        const cloned = cloneCell(cell);
        cellIdMap.set(oldCellId, cloned.cellId);
        cloned.markups = normalizeCellMarkups(cloned.markups).map(markup => ({
          ...markup,
          hostType: "cell",
          hostWindowId: copy.windowId,
          hostCellId: cloned.cellId
        }));
        return cloned;
      });
      if (copy.topology?.members) {
        const members = copy.topology.members.map(member => ({
          ...member,
          memberId: createMemberId(),
          hostRegionId: cellIdMap.get(member.hostRegionId) || member.hostRegionId
        }));
        copy.topology = normalizeTopology({ ...copy.topology, members }, copy.layout);
      }
      project.windows.push(copy);
      selectedWindowId = copy.windowId;
      selectedMemberId = "";
      selectedJointId = "";
      selectedPlacementId = "";
      if (!isEmbeddedFrame(win)) {
        const assembly = ensureAssemblyForReference(win);
        const placement = createAssemblyPlacement(copy.windowId, win.windowId, "right", { gapMm: 0, rotationDeg: 0 });
        assembly.placements.push(placement);
        selectedAssemblyId = assembly.assemblyId;
        selectedPlacementId = placement.placementId;
        drawingMode = "assembly";
        switchInspector("assembly");
      }
      markDirty();
    }

    function removeWindowObject(windowId) {
      if (!windowId) return;
      project.windows = project.windows.filter(win => win.windowId !== windowId);
      project.joints = (project.joints || [])
        .filter(joint => joint.hostWindowId !== windowId)
        .map(joint => ({
          ...joint,
          connectedWindowIds: (joint.connectedWindowIds || []).filter(id => id !== windowId)
        }));
      project.assemblies = (project.assemblies || [])
        .map(assembly => ({
          ...assembly,
          placements: (assembly.placements || []).filter(placement => (
            placement.windowId !== windowId && placement.referenceWindowId !== windowId
          ))
        }))
        .filter(assembly => assembly.rootWindowId !== windowId && assembly.placements.length);
    }

    function selectFallbackObject() {
      selectedMarkupId = "";
      selectedMemberId = "";
      selectedJointId = "";
      selectedPlacementId = "";
      selectedCell = { row: 0, col: 0 };
      if (!project.windows.length) {
        selectedWindowId = "";
        selectedAssemblyId = "";
        drawingMode = "window";
        switchInspector("window");
        return;
      }
      selectedWindowId = project.windows[0].windowId;
      selectedAssemblyId = project.assemblies?.[0]?.assemblyId || "";
      drawingMode = hasAssemblyScene() ? "assembly" : "window";
      switchInspector(drawingMode === "assembly" ? "assembly" : "window");
    }

    function deleteWindow() {
      const markup = selectedMarkupId ? findCellMarkup(selectedMarkupId) : null;
      if (markup) {
        markup.cell.markups = normalizeCellMarkups(markup.cell.markups).filter(item => item.markupId !== selectedMarkupId);
        selectedMarkupId = "";
        markDirty();
        showToast("标注已删除。");
        return;
      }
      if (selectedMemberId && currentMember()) {
        deleteSelectedMember();
        return;
      }
      if (selectedJointId && currentJoint()) {
        deleteSelectedJoint();
        return;
      }
      const placement = currentPlacement();
      if (placement) {
        removeWindowObject(placement.windowId);
        normalizeProjectAssemblies();
        selectFallbackObject();
        markDirty();
        showToast("已删除选中拼接窗体。");
        return;
      }
      if (!selectedWindowId) {
        showToast("画布已经为空。");
        return;
      }
      removeWindowObject(selectedWindowId);
      normalizeProjectAssemblies();
      selectFallbackObject();
      markDirty();
      showToast(project.windows.length ? "已删除选中窗体。" : "画布已清空。");
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

    function customWindowTypeLabel(value) {
      return {
        fixed: "固定窗",
        casement: "平开窗",
        sliding: "推拉窗",
        combination: "组合窗",
        custom: "自定义"
      }[value] || "自定义";
    }

    function windowTemplateFromWindow(win, details = {}) {
      return {
        id: details.id || `custom-${Math.random().toString(36).slice(2, 9)}`,
        name: details.name || `${win.mark} 窗型`,
        category: details.category || "custom",
        categoryLabel: customWindowTypeLabel(details.category || "custom"),
        description: `${win.widthMm}x${win.heightMm} · ${customWindowTypeLabel(details.category || "custom")} · ${win.layout.columns.length}列${win.layout.rows.length}行`,
        source: "user",
        savedAt: new Date().toISOString(),
        window: {
          name: win.name,
          widthMm: win.widthMm,
          heightMm: win.heightMm,
          floor: win.floor,
          room: win.room,
          quantity: win.quantity,
          installation: structuredClone(win.installation),
          shape: structuredClone(win.shape),
          geometryMode: win.geometryMode,
          layout: structuredClone(win.layout),
          topology: structuredClone(win.topology),
          seriesId: win.seriesId,
          colorInside: win.colorInside,
          colorOutside: win.colorOutside,
          defaultGlassTypeId: win.defaultGlassTypeId,
          defaultHardwareSetId: win.defaultHardwareSetId,
          notes: win.notes
        }
      };
    }

    function openComponentSaveDialog() {
      const win = currentWindow();
      if (!win) return;
      setValue("saveComponentName", `${win.mark} 窗型`);
      renderSelect("saveComponentType", [["fixed", "固定窗"], ["casement", "平开窗"], ["sliding", "推拉窗"], ["combination", "组合窗"], ["custom", "自定义"]], "custom");
      document.getElementById("saveComponentName")?.classList.remove("field-error");
      document.getElementById("componentSaveError")?.classList.add("hidden");
      const dialog = document.getElementById("componentSaveDialog");
      if (dialog?.showModal && !dialog.open) dialog.showModal();
      document.getElementById("saveComponentName")?.focus();
    }

    function closeComponentSaveDialog() {
      const dialog = document.getElementById("componentSaveDialog");
      if (dialog?.open) dialog.close();
    }

    function saveComponent() {
      openComponentSaveDialog();
    }

    function confirmSaveComponent() {
      const win = currentWindow();
      if (!win) return;
      const name = valueOf("saveComponentName").trim();
      const category = valueOf("saveComponentType") || "custom";
      document.getElementById("saveComponentName")?.classList.toggle("field-error", !name);
      document.getElementById("componentSaveError")?.classList.toggle("hidden", Boolean(name));
      if (!name) return;
      const item = windowTemplateFromWindow(win, { name, category });
      const personalLibrary = loadCustomWindowLibrary();
      saveCustomWindowLibrary([item, ...personalLibrary.filter(existing => existing.id !== item.id)]);
      project.componentLibrary = [item, ...project.componentLibrary.filter(existing => existing.id !== item.id)];
      activeTemplateLibrary = "custom";
      switchLeft("components");
      closeComponentSaveDialog();
      saveProject();
      render();
      showToast("当前窗型已保存到我的窗型库。");
    }

    function clearCustomComponents() {
      saveCustomWindowLibrary([]);
      project.componentLibrary = [];
      markDirty();
      showToast("我的窗型库已清空。");
    }

    function applyTemplate(template) {
      const source = template.window;
      if (!source) return;
      const referenceWindow = currentWindow();
      const win = createWindow({
        ...structuredClone(source),
        windowId: "",
        embeddedInWindowId: "",
        mark: nextWindowMark(),
        name: source.name || template.name || "窗型库窗型",
        quantity: source.quantity || 1
      });
      project.windows.push(win);
      selectedWindowId = win.windowId;
      selectedMemberId = "";
      selectedJointId = "";
      selectedAssemblyId = "";
      selectedPlacementId = "";
      selectedCell = { row: 0, col: 0 };
      if (referenceWindow) {
        const assembly = ensureAssemblyForReference(referenceWindow);
        const placement = createAssemblyPlacement(win.windowId, referenceWindow.windowId, "right", { gapMm: 0, rotationDeg: 0 });
        assembly.placements.push(placement);
        selectedAssemblyId = assembly.assemblyId;
        selectedPlacementId = placement.placementId;
        drawingMode = "assembly";
      } else {
        drawingMode = "window";
      }
      switchLeft("draw");
      switchInspector(drawingMode === "assembly" ? "assembly" : "window");
      markDirty();
      showToast(`已从窗型库生成 ${win.mark}。`);
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

    function printDesign() {
      saveCurrentProjectToLibrary({ toast: false });
      window.print();
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
      if (!project.windows.length) {
        selectedWindowId = "";
        selectedMemberId = "";
        selectedJointId = "";
        selectedPlacementId = "";
        selectedMarkupId = "";
        selectedAssemblyId = "";
        selectedCell = { row: 0, col: 0 };
        drawingMode = "window";
      } else if (!project.windows.some(w => w.windowId === selectedWindowId)) {
        selectedWindowId = project.windows[0].windowId;
      }
      if (!project.assemblies.some(assembly => assembly.assemblyId === selectedAssemblyId)) selectedAssemblyId = project.assemblies[0]?.assemblyId || "";
      if (selectedPlacementId && !currentPlacement()) selectedPlacementId = "";
      if (selectedMemberId && !currentMember()) selectedMemberId = "";
      if (selectedJointId && !currentJoint()) selectedJointId = "";
      if (hasAssemblyScene()) drawingMode = "assembly";
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
      renderObjectTree();
      renderSelectedObjectProperties();
      renderTemplates();
      renderBom();
      renderStatus();
      updateCanvasCommandControls();
      saveProject();
    }

    function updateCanvasCommandControls() {
      document.querySelectorAll(".palette-tile.command-active, .toolbar-action.command-active").forEach(button => button.classList.remove("command-active"));
      if (canvasCommand.mode === "add_joint") {
        const id = canvasCommand.jointType === "corner" ? "btnAddCornerJoint" : "btnAddSpliceJoint";
        document.getElementById(id)?.classList.add("command-active");
      }
      if (canvasCommand.mode === "add_window_from_joint" && canvasCommand.shapeType) {
        document.querySelector(`[data-shape-preset="${CSS.escape(canvasCommand.shapeType)}"]`)?.classList.add("command-active");
      }
      if (canvasCommand.mode === "apply_cell_preset" && canvasCommand.cellPreset) {
        document.querySelectorAll(`[data-cell-preset="${CSS.escape(canvasCommand.cellPreset)}"]`).forEach(button => {
          const openingMatches = canvasCommand.cellOpening
            ? button.dataset.cellOpening === canvasCommand.cellOpening
            : !button.dataset.cellOpening;
          const panelMatches = canvasCommand.cellPanels
            ? button.dataset.cellPanels === canvasCommand.cellPanels
            : !button.dataset.cellPanels;
          const trackMatches = canvasCommand.cellTracks
            ? button.dataset.cellTracks === canvasCommand.cellTracks
            : !button.dataset.cellTracks;
          const panelModeMatches = canvasCommand.panelMode
            ? button.dataset.panelMode === canvasCommand.panelMode
            : !button.dataset.panelMode;
          if (openingMatches && panelMatches && trackMatches && panelModeMatches) button.classList.add("command-active");
        });
      }
      if (canvasCommand.mode === "add_cell_markup" && canvasCommand.markupType) {
        document.querySelector(`[data-markup-tool="${CSS.escape(canvasCommand.markupType)}"]`)?.classList.add("command-active");
      }
    }

    function renderInputs() {
      const win = currentWindow();
      setValue("projectId", project.project.projectId || "");
      setValue("projectName", project.project.name || "");
      setValue("customerName", project.project.customerName || "");
      setValue("projectPhone", project.project.contactPhone || "");
      renderSelect("projectStatus", PROJECT_STATUS_OPTIONS, project.project.status || "designing");
      setValue("projectAddress", project.project.address || "");
      setValue("orderId", project.order.orderId || "");
      setValue("batchNo", project.order.batchNo || "");
      if (!win) {
        setValue("winMark", "");
        setValue("winQty", "");
        setValue("winWidth", "");
        setValue("winHeight", "");
        setValue("winFloor", "");
        setValue("winRoom", "");
        return;
      }
      setValue("winMark", win.mark);
      setValue("winQty", win.quantity);
      setValue("winWidth", win.widthMm);
      setValue("winHeight", win.heightMm);
      if (!document.activeElement || !["smartOpeningWidth", "smartOpeningHeight"].includes(document.activeElement.id)) {
        setValue("smartOpeningWidth", win.widthMm);
        setValue("smartOpeningHeight", win.heightMm);
      }
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
      win.orderInfo = normalizeWindowOrderInfo(win.orderInfo, win);
      setValue("saveInstallLocation", win.orderInfo.installLocation || "");
      renderSelect("saveSeriesId", project.catalog.profileSystems.map(s => [s.id, `${s.id} · ${s.name}`]), win.seriesId);
      renderSelect("saveGlassTypeId", project.catalog.glassTypes.map(g => [g.id, g.name]), win.defaultGlassTypeId);
      setValue("saveColor", win.orderInfo.color || win.colorInside || "");
      setValue("saveOpeningMode", win.orderInfo.openingMode || defaultOpeningSummary(win));
      setValue("saveUnitPrice", win.orderInfo.unitPrice || 0);
      setValue("saveWindowNote", win.orderInfo.note || win.notes || "");
      updateWindowSaveTotals(win);
      const cell = currentCell(win);
      if (cell) {
        setValue("cellType", cell.type);
        setValue("cellCustomShapeName", cell.customShape?.name || "");
        document.getElementById("cellCustomShapeField")?.classList.toggle("hidden", !cell.customShape);
        renderSelect("opening", openingOptionsForType(cell.type).map(item => [item.value, item.label]), cell.opening);
        renderInputDatalist("cellGlass", project.catalog.glassTypes, cell.glassTypeId || win.defaultGlassTypeId);
        renderInputDatalist("cellHardware", project.catalog.hardwareSets, cell.hardwareSetId || win.defaultHardwareSetId);
        renderSelect("cellInfill", [["glass", "玻璃"], ["panel", "面板"], ["louver", "百叶"]], cell.infillType || "glass");
        renderSelect("cellPanelMode", [["single", "单扇"], ["double", "双扇"]], normalizePanelMode(cell.panelMode));
        document.getElementById("cellPanelModeField")?.classList.toggle("hidden", normalizeCellInfillType(cell.infillType) !== "panel");
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
        ? `拼接模式 · ${currentPlacement() ? "相邻窗" : "基准窗"}`
        : joint
          ? `选择模式 · ${joint.type === "corner" ? "转角节点" : "拼接节点"}`
          : member
            ? `选择模式 · ${member.orientation === "horizontal" ? "局部横梃" : "局部竖梃"}`
            : `选择模式 · ${cell ? `${selectedCell.col + 1}列${selectedCell.row + 1}行` : "窗格"}`;
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

    function openSurroundDesignDialog() {
      const win = currentWindow();
      if (!win) return;
      drawingMode = "window";
      selectedPlacementId = "";
      switchInspector("installation");
      surroundDesignDialog.draft = normalizeSurround({
        ...win.installation?.surround,
        enabled: true
      });
      surroundDesignDialog.viewport = { scale: 1, x: 0, y: 0 };
      hideSurroundDialogInlineEditor();
      syncSurroundDesignDialogInputs();
      const dialog = document.getElementById("surroundDesignDialog");
      if (dialog?.showModal && !dialog.open) dialog.showModal();
      render();
    }

    function closeSurroundDesignDialog() {
      hideSurroundDialogInlineEditor();
      const dialog = document.getElementById("surroundDesignDialog");
      if (dialog?.open) dialog.close();
      surroundDesignDialog.panning = false;
    }

    function syncSurroundDesignDialogInputs() {
      const draft = surroundDesignDialog.draft || normalizeSurround({ enabled: true });
      setValue("surroundDialogStyle", draft.styleId);
      setValue("surroundDialogEdgeMode", draft.edgeMode);
      setValue("surroundDialogWallThickness", draft.wallThicknessMm);
      setValue("surroundDialogOutsideWidth", draft.outsideWidthMm);
      setValue("surroundDialogInsideWidth", draft.insideWidthMm);
      setValue("surroundDialogBoardThickness", draft.boardThicknessMm);
      const sides = new Set(resolveSurroundSides(draft));
      [
        ["top", "surroundDialogSideTop"],
        ["right", "surroundDialogSideRight"],
        ["bottom", "surroundDialogSideBottom"],
        ["left", "surroundDialogSideLeft"]
      ].forEach(([side, id]) => setChecked(id, sides.has(side)));
      updateSurroundDialogControlState();
      renderSurroundDesignDialogPreview();
    }

    function updateSurroundDialogControlState() {
      const draft = surroundDesignDialog.draft || normalizeSurround({ enabled: true });
      document.getElementById("surroundDialogCustomSides")?.classList.toggle("hidden", draft.edgeMode !== "custom");
      const outsideControl = document.getElementById("surroundDialogOutsideWidth");
      const insideControl = document.getElementById("surroundDialogInsideWidth");
      if (outsideControl) outsideControl.disabled = !["both_sides", "outside_only"].includes(draft.styleId);
      if (insideControl) insideControl.disabled = !["both_sides", "inside_only"].includes(draft.styleId);
    }

    function updateSurroundDialogDraftFromInputs() {
      const selectedSides = [
        ["top", "surroundDialogSideTop"],
        ["right", "surroundDialogSideRight"],
        ["bottom", "surroundDialogSideBottom"],
        ["left", "surroundDialogSideLeft"]
      ].filter(([, id]) => document.getElementById(id)?.checked).map(([side]) => side);
      surroundDesignDialog.draft = normalizeSurround({
        ...(surroundDesignDialog.draft || {}),
        enabled: true,
        styleId: valueOf("surroundDialogStyle"),
        edgeMode: valueOf("surroundDialogEdgeMode"),
        sides: selectedSides,
        wallThicknessMm: Number(valueOf("surroundDialogWallThickness")),
        outsideWidthMm: Number(valueOf("surroundDialogOutsideWidth")),
        insideWidthMm: Number(valueOf("surroundDialogInsideWidth")),
        boardThicknessMm: Number(valueOf("surroundDialogBoardThickness"))
      });
      updateSurroundDialogControlState();
      renderSurroundDesignDialogPreview();
    }

    function surroundDialogViewportTransform() {
      const view = surroundDesignDialog.viewport;
      return `translate(${view.x.toFixed(3)} ${view.y.toFixed(3)}) scale(${view.scale.toFixed(4)})`;
    }

    function renderSurroundDesignDialogPreview() {
      const svg = document.getElementById("surroundDialogPreview");
      if (!svg) return;
      const win = currentWindow();
      const draft = surroundDesignDialog.draft || normalizeSurround({ enabled: true });
      const summary = surroundSummary(draft, win?.widthMm || 1200, win?.heightMm || 1500);
      const sides = resolveSurroundSides(draft);
      const x = 170;
      const y = 102;
      const width = 280;
      const height = 190;
      const visibleWidth = Math.max(
        ["both_sides", "outside_only"].includes(draft.styleId) ? draft.outsideWidthMm : 0,
        ["both_sides", "inside_only"].includes(draft.styleId) ? draft.insideWidthMm : 0,
        draft.boardThicknessMm * 2
      );
      const band = Math.max(18, Math.min(54, visibleWidth * 0.25));
      const sideRects = sides.map(side => {
        if (side === "top") return `<rect class="surround-elevation" x="${x - band}" y="${y - band}" width="${width + band * 2}" height="${band}" />`;
        if (side === "right") return `<rect class="surround-elevation" x="${x + width}" y="${y - band}" width="${band}" height="${height + band * 2}" />`;
        if (side === "bottom") return `<rect class="surround-elevation" x="${x - band}" y="${y + height}" width="${width + band * 2}" height="${band}" />`;
        return `<rect class="surround-elevation" x="${x - band}" y="${y - band}" width="${band}" height="${height + band * 2}" />`;
      }).join("");
      const transform = surroundDialogViewportTransform();
      svg.innerHTML = `
        <g id="surroundDialogViewport" transform="${transform}">
          <text class="surround-preview-label" x="310" y="42">${escapeHtml(win?.mark || "当前门窗")} · 包套设计</text>
          ${sideRects}
          <rect class="surround-preview-frame" x="${x}" y="${y}" width="${width}" height="${height}" />
          <rect x="${x + 24}" y="${y + 24}" width="${width - 48}" height="${height - 48}" fill="#eef8fb" stroke="#8297a3" stroke-width="2" />
          <path class="surround-dialog-dimension" d="M${x} ${y - 54}H${x + width} M${x} ${y - 62}V${y - 46} M${x + width} ${y - 62}V${y - 46}" />
          <text class="surround-dialog-dimension-text" data-surround-dimension="outsideWidthMm" x="${x + width / 2}" y="${y - 72}">外包边 ${Math.round(draft.outsideWidthMm)}</text>
          <path class="surround-dialog-dimension" d="M${x + width + 72} ${y}V${y + height} M${x + width + 64} ${y}H${x + width + 80} M${x + width + 64} ${y + height}H${x + width + 80}" />
          <text class="surround-dialog-dimension-text" data-surround-dimension="wallThicknessMm" x="${x + width + 104}" y="${y + height / 2}" transform="rotate(90 ${x + width + 104} ${y + height / 2})">墙厚 ${Math.round(draft.wallThicknessMm)}</text>
          <path class="surround-dialog-dimension" d="M${x} ${y + height + 52}H${x + width} M${x} ${y + height + 44}V${y + height + 60} M${x + width} ${y + height + 44}V${y + height + 60}" />
          <text class="surround-dialog-dimension-text" data-surround-dimension="insideWidthMm" x="${x + width / 2}" y="${y + height + 76}">内包边 ${Math.round(draft.insideWidthMm)}</text>
          <text class="surround-dialog-dimension-text" data-surround-dimension="boardThicknessMm" x="${x - 74}" y="${y + height / 2}">板厚 ${Math.round(draft.boardThicknessMm)}</text>
          <text class="surround-preview-label" x="${x - 36}" y="${y + height + 106}">室外</text>
          <text class="surround-preview-label" x="${x + width + 36}" y="${y + height + 106}">室内</text>
        </g>`;
      document.getElementById("surroundDialogSummary").innerHTML = [
        ["包套类型", summary.edgeMode],
        ["样式", summary.style],
        ["应用边", sides.map(surroundSideLabel).join("、") || "未选择"],
        ["包套总长", `${summary.perimeterMm} mm`],
        ["洞口衬板", `${summary.linerAreaM2.toFixed(3)} m²`]
      ].map(([label, value]) => `<li><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></li>`).join("");
    }

    function surroundDimensionMeta(field) {
      const draft = surroundDesignDialog.draft;
      if (!draft) return null;
      const map = {
        wallThicknessMm: { label: "墙厚", inputId: "surroundDialogWallThickness", min: 60, max: 600 },
        outsideWidthMm: { label: "外包边宽", inputId: "surroundDialogOutsideWidth", min: 0, max: 500 },
        insideWidthMm: { label: "内包边宽", inputId: "surroundDialogInsideWidth", min: 0, max: 500 },
        boardThicknessMm: { label: "板材厚度", inputId: "surroundDialogBoardThickness", min: 5, max: 100 }
      };
      const meta = map[field];
      if (!meta) return null;
      return { ...meta, field, current: Number(draft[field]) };
    }

    function openSurroundDialogInlineEditor(field, event) {
      const meta = surroundDimensionMeta(field);
      const input = document.getElementById("surroundDialogInlineInput");
      const wrap = document.getElementById("surroundDialogPreviewWrap");
      if (!meta || !input || !wrap) return;
      const rect = wrap.getBoundingClientRect();
      surroundDesignDialog.activeDimension = field;
      input.min = String(meta.min);
      input.max = String(meta.max);
      input.value = String(Math.round(meta.current));
      input.setAttribute("aria-label", `修改${meta.label}`);
      input.style.left = `${Math.max(8, Math.min(rect.width - 118, event.clientX - rect.left - 55))}px`;
      input.style.top = `${Math.max(8, Math.min(rect.height - 38, event.clientY - rect.top - 15))}px`;
      input.classList.remove("hidden");
      input.focus();
      input.select();
    }

    function hideSurroundDialogInlineEditor() {
      const input = document.getElementById("surroundDialogInlineInput");
      if (input) input.classList.add("hidden");
      surroundDesignDialog.activeDimension = "";
    }

    function commitSurroundDialogInlineEditor() {
      const field = surroundDesignDialog.activeDimension;
      const input = document.getElementById("surroundDialogInlineInput");
      const meta = surroundDimensionMeta(field);
      if (!field || !input || !meta || input.classList.contains("hidden")) return;
      const raw = Number(input.value);
      if (Number.isFinite(raw)) {
        const value = Math.max(meta.min, Math.min(meta.max, raw));
        surroundDesignDialog.draft = normalizeSurround({
          ...(surroundDesignDialog.draft || {}),
          [field]: value
        });
        setValue(meta.inputId, value);
      }
      hideSurroundDialogInlineEditor();
      renderSurroundDesignDialogPreview();
    }

    function handleSurroundDialogPreviewDoubleClick(event) {
      const target = event.target.closest?.("[data-surround-dimension]");
      if (!target) return;
      event.preventDefault();
      openSurroundDialogInlineEditor(target.dataset.surroundDimension, event);
    }

    function handleSurroundDialogWheel(event) {
      const svg = document.getElementById("surroundDialogPreview");
      if (!svg || event.target.closest?.("input, select, textarea, button")) return;
      event.preventDefault();
      const pointer = svgPointFromMouse(svg, event);
      const previousScale = surroundDesignDialog.viewport.scale;
      const zoomFactor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nextScale = Math.max(0.55, Math.min(3, previousScale * zoomFactor));
      const ratio = nextScale / previousScale;
      surroundDesignDialog.viewport.x = pointer.x - (pointer.x - surroundDesignDialog.viewport.x) * ratio;
      surroundDesignDialog.viewport.y = pointer.y - (pointer.y - surroundDesignDialog.viewport.y) * ratio;
      surroundDesignDialog.viewport.scale = nextScale;
      document.getElementById("surroundDialogViewport")?.setAttribute("transform", surroundDialogViewportTransform());
    }

    function handleSurroundDialogPointerDown(event) {
      if (event.button !== 1) return;
      event.preventDefault();
      hideSurroundDialogInlineEditor();
      surroundDesignDialog.panning = true;
      surroundDesignDialog.panStart = { x: event.clientX, y: event.clientY };
      surroundDesignDialog.panOrigin = { x: surroundDesignDialog.viewport.x, y: surroundDesignDialog.viewport.y };
      document.getElementById("surroundDialogPreviewWrap")?.classList.add("panning");
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    function handleSurroundDialogPointerMove(event) {
      if (!surroundDesignDialog.panning) return;
      const scale = surroundDesignDialog.viewport.scale || 1;
      surroundDesignDialog.viewport.x = surroundDesignDialog.panOrigin.x + (event.clientX - surroundDesignDialog.panStart.x) / scale;
      surroundDesignDialog.viewport.y = surroundDesignDialog.panOrigin.y + (event.clientY - surroundDesignDialog.panStart.y) / scale;
      document.getElementById("surroundDialogViewport")?.setAttribute("transform", surroundDialogViewportTransform());
    }

    function handleSurroundDialogPointerUp(event) {
      if (!surroundDesignDialog.panning) return;
      surroundDesignDialog.panning = false;
      document.getElementById("surroundDialogPreviewWrap")?.classList.remove("panning");
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }

    function confirmSurroundDesign() {
      const win = currentWindow();
      if (!win || !surroundDesignDialog.draft) return;
      updateSurroundDialogDraftFromInputs();
      win.installation ||= { sillHeightMm: 0 };
      win.installation.surround = normalizeSurround({
        ...surroundDesignDialog.draft,
        enabled: true
      });
      closeSurroundDesignDialog();
      switchInspector("installation");
      previewNeedsRebuild = true;
      markDirty();
      showToast("包套设计已确认并显示到当前门窗外框。");
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
        document.getElementById("projectAssemblyTitle").textContent = "尚未建立拼接";
        document.getElementById("placementWindowLabel").textContent = "先添加拼接料或转角料，再选择窗型位置";
        document.getElementById("projectAssemblySummary").innerHTML = '<li><span>拼接状态</span><strong>未创建</strong></li>';
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
        document.getElementById("placementWindowLabel").textContent = `${root?.mark || assembly.rootWindowId}`;
      }
      document.getElementById("placementFreeFields").classList.toggle("hidden", !placement || placement.dock !== "free");
      const summary = assemblySummary(assembly, project.windows);
      document.getElementById("projectAssemblySummary").innerHTML = [
        ["拼接ID", summary.assemblyId],
        ["包含窗体", `${summary.windowIds.length}樘`],
        ["连接节点", `${summary.jointIds.length}个`],
        ["拼接外包", `${summary.overallWidthMm}×${summary.overallHeightMm}×${summary.overallDepthMm} mm`],
        ["基准窗", project.windows.find(win => win.windowId === summary.rootWindowId)?.mark || summary.rootWindowId]
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
          <text class="joint-detail-label" x="130" y="142">${Math.round(joint.legWidthAMm)} mm</text>
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

    function openJointSettingsDialog() {
      const joint = currentJoint();
      const dialog = document.getElementById("jointSettingsDialog");
      if (!joint || !dialog) return;
      hideJointContextMenu();
      hideJointSettingsInlineEditor();
      const title = document.getElementById("jointSettingsTitle");
      if (title) title.textContent = joint.type === "corner" ? "转角设置" : "拼接设置";
      renderSelect("jointSettingsStyle", JOINT_STYLE_OPTIONS[joint.type].map(item => [item.value, item.label]), joint.style);
      setValue("jointSettingsOrientation", joint.orientation);
      renderJointSettingsPreview(joint);
      dialog.showModal();
    }

    function closeJointSettingsDialog() {
      hideJointSettingsInlineEditor();
      document.getElementById("jointSettingsDialog")?.close();
    }

    function applyJointSettingsDraft() {
      const joint = currentJoint();
      if (!joint) return;
      joint.style = valueOf("jointSettingsStyle") || joint.style;
      joint.orientation = valueOf("jointSettingsOrientation") || joint.orientation;
      syncPlacementsForJoint(joint);
      renderJointSettingsPreview(joint);
      renderJointDetailPreview(joint);
    }

    function saveJointSettingsDialog() {
      applyJointSettingsDraft();
      closeJointSettingsDialog();
      markDirty();
      showToast("连接件设置已保存。");
    }

    function promptJointNumericValue(label, currentValue, min, max) {
      const raw = window.prompt(label, String(Math.round(currentValue)));
      if (raw === null) return null;
      const value = Number(raw);
      if (!Number.isFinite(value)) return null;
      return Math.max(min, Math.min(max, value));
    }

    function jointSettingMeta(joint, setting) {
      if (!joint) return null;
      if (setting === "angle" && joint.type === "corner") {
        return { setting, current: joint.angleDeg, min: 60, max: 180, label: "转角角度" };
      }
      if (setting === "legA") {
        return { setting, current: joint.legWidthAMm, min: 10, max: 300, label: "A侧宽度" };
      }
      if (setting === "legB") {
        return { setting, current: joint.legWidthBMm, min: 10, max: 300, label: "B侧宽度" };
      }
      return null;
    }

    function hideJointSettingsInlineEditor() {
      const input = document.getElementById("jointSettingsInlineInput");
      if (!input) return;
      input.classList.add("hidden");
      input.dataset.setting = "";
      input.dataset.min = "";
      input.dataset.max = "";
    }

    function commitJointSettingsInlineEditor() {
      const input = document.getElementById("jointSettingsInlineInput");
      const joint = currentJoint();
      if (!input || input.classList.contains("hidden") || !joint) return;
      const setting = input.dataset.setting;
      const value = Number(input.value);
      const min = Number(input.dataset.min);
      const max = Number(input.dataset.max);
      hideJointSettingsInlineEditor();
      if (!Number.isFinite(value)) return;
      const nextValue = Math.max(min, Math.min(max, value));
      if (setting === "angle" && joint.type === "corner") joint.angleDeg = nextValue;
      if (setting === "legA") joint.legWidthAMm = nextValue;
      if (setting === "legB") joint.legWidthBMm = nextValue;
      syncPlacementsForJoint(joint);
      setValue("jointAngle", joint.angleDeg);
      setValue("jointLegA", joint.legWidthAMm);
      setValue("jointLegB", joint.legWidthBMm);
      renderJointSettingsPreview(joint);
      renderJointDetailPreview(joint);
      markDirty();
    }

    function openJointSettingsInlineEditor(setting, event) {
      const joint = currentJoint();
      const meta = jointSettingMeta(joint, setting);
      const input = document.getElementById("jointSettingsInlineInput");
      const wrap = document.getElementById("jointSettingsPreviewWrap");
      if (!meta || !input || !wrap) {
        const fallback = meta ? promptJointNumericValue(`请输入${meta.label}`, meta.current, meta.min, meta.max) : null;
        if (fallback !== null && joint) {
          if (setting === "angle") joint.angleDeg = fallback;
          if (setting === "legA") joint.legWidthAMm = fallback;
          if (setting === "legB") joint.legWidthBMm = fallback;
          syncPlacementsForJoint(joint);
          renderJointSettingsPreview(joint);
          renderJointDetailPreview(joint);
          markDirty();
        }
        return;
      }
      const box = wrap.getBoundingClientRect();
      const left = Math.max(8, Math.min(box.width - 136, event.clientX - box.left + 10));
      const top = Math.max(8, Math.min(box.height - 34, event.clientY - box.top - 13));
      input.dataset.setting = meta.setting;
      input.dataset.min = String(meta.min);
      input.dataset.max = String(meta.max);
      input.setAttribute("aria-label", meta.label);
      input.min = String(meta.min);
      input.max = String(meta.max);
      input.step = "1";
      input.value = String(Math.round(meta.current));
      input.style.left = `${left}px`;
      input.style.top = `${top}px`;
      input.classList.remove("hidden");
      input.focus();
      input.select();
    }

    function handleJointSettingsPreviewDoubleClick(event) {
      const joint = currentJoint();
      const target = event.target.closest?.("[data-joint-setting]");
      if (!joint || !target) return;
      openJointSettingsInlineEditor(target.dataset.jointSetting, event);
    }

    function renderJointSettingsPreview(joint) {
      const svg = document.getElementById("jointSettingsPreview");
      if (!svg || !joint) return;
      const styleLabel = JOINT_STYLE_OPTIONS[joint.type].find(item => item.value === joint.style)?.label || "默认";
      if (joint.type === "splice") {
        svg.innerHTML = `
          <text class="joint-settings-label" x="260" y="34">${escapeHtml(styleLabel)} · ${joint.orientation === "normal" ? "正装" : "反装"}</text>
          <rect class="joint-settings-window" x="92" y="132" width="138" height="128" />
          <rect class="joint-settings-window" x="290" y="132" width="138" height="128" />
          <rect class="joint-settings-profile" x="235" y="116" width="${Math.max(32, Math.min(80, joint.legWidthAMm))}" height="160" />
          <text class="joint-settings-window-label" x="161" y="196">窗框</text>
          <text class="joint-settings-window-label" x="359" y="196">窗框</text>
          <g data-joint-setting="legA">
            <path class="joint-settings-dim-blue" d="M235 92 H${235 + Math.max(32, Math.min(80, joint.legWidthAMm))} M235 86 V98 M${235 + Math.max(32, Math.min(80, joint.legWidthAMm))} 86 V98" />
            <text class="joint-settings-dim-text" x="260" y="83">${Math.round(joint.legWidthAMm)}</text>
          </g>`;
        return;
      }
      const angle = Math.max(60, Math.min(180, Number(joint.angleDeg || 90)));
      const legA = Math.max(28, Math.min(92, Number(joint.legWidthAMm || 50)));
      const legB = Math.max(28, Math.min(92, Number(joint.legWidthBMm || 50)));
      const sweep = joint.orientation === "reversed" ? 1 : 0;
      const style = joint.style || "default";
      const profileClass = `joint-settings-profile ${style === "giant" ? "giant" : ""}`;
      const pivotClass = `joint-settings-pivot ${style === "universal" ? "universal" : ""}`;
      const bendPath = style === "curved"
        ? `M260 210 Q${260 + legB * 0.92} ${210 + legA * 0.1} ${260 + legB} ${210 + legA}`
        : style === "universal"
          ? `M260 210 L${260 + legB * 0.72} 210 L${260 + legB} ${210 + legA * 0.38} L${260 + legB} ${210 + legA}`
          : `M260 210 L${260 + legB} 210 L${260 + legB} ${210 + legA}`;
      const styleOverlay = style === "rectangular"
        ? `<rect class="joint-settings-style-mark rectangular" x="${260 + legB - 14}" y="210" width="14" height="${legA}" />`
        : style === "universal"
          ? `<circle class="joint-settings-style-mark universal" cx="${260 + legB * 0.72}" cy="210" r="7" />`
          : style === "giant"
            ? `<path class="joint-settings-style-mark giant" d="M260 210 L${260 + legB + 18} 210 L${260 + legB + 18} ${210 + legA + 18} L${260 + legB} ${210 + legA + 18}" />`
            : "";
      svg.innerHTML = `
        <text class="joint-settings-label" x="260" y="34">${escapeHtml(styleLabel)} · ${joint.orientation === "normal" ? "正装" : "反装"}</text>
        <rect class="joint-settings-window" x="126" y="148" width="112" height="104" />
        <rect class="joint-settings-window" x="260" y="210" width="112" height="104" />
        <text class="joint-settings-window-label" x="182" y="202">窗框</text>
        <text class="joint-settings-window-label" x="316" y="266">窗框</text>
        <path class="${profileClass}" d="${bendPath}" />
        ${styleOverlay}
        <circle class="${pivotClass}" cx="260" cy="210" r="${style === "giant" ? 10 : 8}" />
        <g data-joint-setting="legA">
          <path class="joint-settings-dim-blue" d="M260 126 H${260 + legA} M260 119 V133 M${260 + legA} 119 V133" />
          <text class="joint-settings-dim-text" x="${260 + legA / 2}" y="114">${Math.round(joint.legWidthAMm)}</text>
        </g>
        <g data-joint-setting="legB">
          <path class="joint-settings-dim-red" d="M${282 + legB} 210 V${210 + legA} M${276 + legB} 210 H${288 + legB} M${276 + legB} ${210 + legA} H${288 + legB}" />
          <text class="joint-settings-dim-text-red" x="${302 + legB}" y="${210 + legA / 2}" transform="rotate(90 ${302 + legB} ${210 + legA / 2})">${Math.round(joint.legWidthBMm)}</text>
        </g>
        <g data-joint-setting="angle">
          <path class="joint-settings-angle" d="M224 238 A52 52 0 0 ${sweep} 260 286" />
          <text class="joint-settings-angle-text" x="226" y="270">${Math.round(angle)}°</text>
        </g>`;
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
      document.querySelectorAll("[data-cell-preset]").forEach(btn => {
        btn.classList.remove("active");
      });
      document.querySelectorAll("[data-shape-preset]").forEach(btn => {
        btn.classList.remove("active");
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

    function renderCellMarkups(cell, item, scale) {
      const markups = normalizeCellMarkups(cell?.markups);
      if (!markups.length) return "";
      return markups.map(markup => {
        const cx = item.x + item.w * markup.xPercent / 100;
        const cy = item.y + item.h * markup.yPercent / 100;
        const common = `class="cell-markup ${markup.kind} ${markup.markupId === selectedMarkupId ? "active" : ""}" data-markup-id="${escapeHtml(markup.markupId)}" data-window-id="${escapeHtml(item.windowId || "")}" data-row="${item.row}" data-col="${item.col}" data-cell-x="${item.x}" data-cell-y="${item.y}" data-cell-w="${item.w}" data-cell-h="${item.h}" tabindex="0" role="button"`;
        if (markup.kind === "text") {
          const text = escapeHtml(markup.text || "文字标注");
          const width = Math.max(64, text.length * 11 + 20);
          return `<g ${common} aria-label="文字标注，双击编辑，拖动调整位置">
            <rect class="cell-markup-text-box" x="${cx - width / 2}" y="${cy - 14}" width="${width}" height="28" rx="2" />
            <text class="cell-markup-text" x="${cx}" y="${cy + 4}">${text}</text>
          </g>`;
        }
        if (markup.kind === "lock") {
          const lockW = Math.max(14, markup.sizeMm * scale * 0.55);
          const lockH = Math.max(22, markup.sizeMm * scale);
          return `<g ${common} aria-label="锁具，双击编辑尺寸和定位">
            <rect class="cell-lock-body" x="${cx - lockW / 2}" y="${cy - lockH / 2}" width="${lockW}" height="${lockH}" rx="2" />
            <circle class="cell-lock-cylinder" cx="${cx}" cy="${cy - lockH * 0.14}" r="${Math.max(2.5, lockW * 0.16)}" />
            <line class="cell-lock-handle" x1="${cx}" y1="${cy + lockH * 0.08}" x2="${cx + lockW * 0.65}" y2="${cy + lockH * 0.08}" />
          </g>`;
        }
        const sizePx = Math.max(8, markup.sizeMm * scale);
        const sizeText = `${Math.round(markup.sizeMm)} mm`;
        const offsetText = `X ${Math.round(markup.offsetXPercent)}% · Y ${Math.round(markup.offsetYPercent)}%`;
        if (markup.kind === "circle_hole") {
          return `<g ${common} aria-label="圆孔，双击编辑尺寸和定位">
            <circle class="glass-hole-shape" cx="${cx}" cy="${cy}" r="${sizePx / 2}" />
            <line class="glass-hole-centerline" x1="${cx - sizePx / 2 - 8}" y1="${cy}" x2="${cx + sizePx / 2 + 8}" y2="${cy}" />
            <line class="glass-hole-centerline" x1="${cx}" y1="${cy - sizePx / 2 - 8}" x2="${cx}" y2="${cy + sizePx / 2 + 8}" />
            <text class="glass-hole-dimension" x="${cx}" y="${cy + sizePx / 2 + 15}">Φ${escapeHtml(sizeText)}</text>
            <text class="glass-hole-offset" x="${cx}" y="${cy + sizePx / 2 + 29}">${escapeHtml(offsetText)}</text>
          </g>`;
        }
        return `<g ${common} aria-label="方孔，双击编辑尺寸和定位">
          <rect class="glass-hole-shape" x="${cx - sizePx / 2}" y="${cy - sizePx / 2}" width="${sizePx}" height="${sizePx}" />
          <line class="glass-hole-centerline" x1="${cx - sizePx / 2 - 8}" y1="${cy}" x2="${cx + sizePx / 2 + 8}" y2="${cy}" />
          <line class="glass-hole-centerline" x1="${cx}" y1="${cy - sizePx / 2 - 8}" x2="${cx}" y2="${cy + sizePx / 2 + 8}" />
          <text class="glass-hole-dimension" x="${cx}" y="${cy + sizePx / 2 + 15}">${escapeHtml(sizeText)}</text>
          <text class="glass-hole-offset" x="${cx}" y="${cy + sizePx / 2 + 29}">${escapeHtml(offsetText)}</text>
        </g>`;
      }).join("");
    }

    function renderMarkupLayer(rects, scale) {
      const content = rects
        .map(item => renderCellMarkups(item.cell, item, scale))
        .join("");
      return `<g id="markupLayer" class="markup-layer">${content}</g>`;
    }

    function renderAssemblyWindowCells(win, inner, scale, outlineColor) {
      const rects = computeCellRects(win, inner).map(item => ({
        ...item,
        windowId: win.windowId
      }));
      const parts = [];
      for (const item of rects) {
        const cell = item.cell;
        const selected = win.windowId === selectedWindowId
          && item.row === selectedCell.row
          && item.col === selectedCell.col
          && !selectedMarkupId && !selectedJointId && activeInspectorTab === "cell";
        const commandClass = ["apply_cell_preset", "add_cell_markup"].includes(canvasCommand.mode) ? " cell-placement-target" : "";
        parts.push(`<g class="cell assembly-cell${commandClass}" data-window-id="${escapeHtml(win.windowId)}" data-row="${item.row}" data-col="${item.col}" data-cell-x="${item.x}" data-cell-y="${item.y}" data-cell-w="${item.w}" data-cell-h="${item.h}" tabindex="0" role="button">`);
        parts.push(`<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" fill="${cellFill(cell)}" stroke="#708493" stroke-width="1.1" />`);
        if (isOperableType(cell.type)) {
          const frameColor = project.viewOptions?.showProfileColor ? profileColor(win.colorInside, currentSeries(win).material) : "#7e8792";
          const inset = Math.min(item.w, item.h) * 0.12;
          parts.push(project.viewOptions?.showOpenState
            ? openCellElevation(cell, item, outlineColor, frameColor, scale)
            : `<rect x="${item.x + inset}" y="${item.y + inset}" width="${Math.max(0, item.w - inset * 2)}" height="${Math.max(0, item.h - inset * 2)}" fill="none" stroke="${outlineColor}" stroke-width="5" />${openingSymbol(cell, item, inset)}`);
        }
        parts.push(cellDecoration(cell, item, outlineColor));
        parts.push(integratedScreenDecoration(cell, item, outlineColor));
        parts.push(`<text class="cell-label" x="${item.x + item.w / 2}" y="${item.y + item.h / 2}">${escapeHtml(cellDrawingCode(cell.type, item.row * win.layout.columns.length + item.col))}</text>`);
        if (selected) {
          parts.push(`<rect class="selected-stroke" x="${item.x + 3}" y="${item.y + 3}" width="${Math.max(0, item.w - 6)}" height="${Math.max(0, item.h - 6)}" />`);
        }
        parts.push("</g>");
      }
      parts.push(`<g class="markup-layer assembly-markup-layer">${rects.map(item => renderCellMarkups(item.cell, item, scale)).join("")}</g>`);
      return parts.join("");
    }

    function renderSvg() {
      const svg = document.getElementById("windowSvg");
      const win = currentWindow();
      if (!win) {
        const view = { w: 900, h: 620 };
        svg.setAttribute("viewBox", `0 0 ${view.w} ${view.h}`);
        document.getElementById("drawingTitle").textContent = "空画布";
        const placingRoot = canvasCommand.mode === "add_root_window";
        const rootLabel = canvasCommand.cellPreset
          ? cellPresetLabel(canvasCommand.cellPreset, {
            opening: canvasCommand.cellOpening,
            panelCount: Number(canvasCommand.cellPanels || 0) || undefined,
            trackCount: Number(canvasCommand.cellTracks || 0) || undefined,
            panelMode: canvasCommand.panelMode || undefined
          })
          : shapeLabel(canvasCommand.shapeType || "rectangular");
        document.getElementById("drawingStats").textContent = placingRoot
          ? `待放置 · ${rootLabel}`
          : "从左侧门/窗框工具添加第一个窗框";
        setCanvasSvgContent(svg, `
          <g class="empty-canvas-state">
            <g id="rootWindowPlacementZone" class="${placingRoot ? "root-placement-zone active" : "root-placement-zone"}" tabindex="${placingRoot ? "0" : "-1"}" role="button" aria-label="${placingRoot ? `放置${escapeHtml(rootLabel)}` : "空画布"}">
              <rect x="250" y="180" width="400" height="180" rx="8" fill="#f8fbff" stroke="${placingRoot ? "#1d72ff" : "#c9d8ea"}" stroke-width="${placingRoot ? "3" : "1"}" stroke-dasharray="8 8"></rect>
              <text x="450" y="252" text-anchor="middle" fill="${placingRoot ? "#1d72ff" : "#5f7189"}" font-size="22" font-weight="700">${placingRoot ? `点击放置${escapeHtml(rootLabel)}` : "空画布"}</text>
              <text x="450" y="292" text-anchor="middle" fill="#7d8ca1" font-size="14">${placingRoot ? "点击此区域生成第一樘窗；右键退出" : "先选择左侧门/窗框工具，再在画布上添加对象"}</text>
            </g>
          </g>
        `);
        if (placingRoot) {
          const zone = svg.querySelector("#rootWindowPlacementZone");
          zone?.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            createRootWindowFromCanvasCommand();
          });
          zone?.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              createRootWindowFromCanvasCommand();
            }
          });
          svg.addEventListener("contextmenu", event => {
            event.preventDefault();
            cancelCanvasCommand("已退出添加模式。");
          }, { once: true });
        }
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
        const planClearance = Math.max(92, cornerRise + 50, planExtents.outside + 38);
        planY = y + drawH + planClearance;
        view.h = Math.max(view.h, planY + Math.max(142, planExtents.inside + 130));
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
      parts.push(renderProfileBevel(x, y, drawW, drawH, face));
      parts.push(`<rect x="${inner.x}" y="${inner.y}" width="${inner.w}" height="${inner.h}" fill="#f8fbfc" />`);

      for (let i = 0; i < rects.length; i += 1) {
        const item = rects[i];
        const cell = item.cell;
        const selected = item.row === selectedCell.row && item.col === selectedCell.col;
        const fill = cellFill(cell);
        const openable = isOperableType(cell.type);
        const cellPath = cellCustomShapePath(cell, item);
        const clipId = cellPath ? `cellClip-${item.row}-${item.col}` : "";
        const cellCommandClass = ["apply_cell_preset", "add_cell_markup"].includes(canvasCommand.mode) ? " cell-placement-target" : "";
        parts.push(`<g class="cell${cellCommandClass}" data-window-id="${escapeHtml(win.windowId)}" data-row="${item.row}" data-col="${item.col}" data-cell-x="${item.x}" data-cell-y="${item.y}" data-cell-w="${item.w}" data-cell-h="${item.h}" tabindex="0">`);
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
          const dividerX = colEdges[c] - face / 2;
          const dividerY = bottom;
          const dividerW = face;
          const dividerH = top - bottom;
          parts.push(`<rect x="${dividerX}" y="${dividerY}" width="${dividerW}" height="${dividerH}" fill="${dividerColor}" stroke="${outlineColor}" stroke-width="1.5" />`);
          parts.push(renderProfileDividerBevel(dividerX, dividerY, dividerW, dividerH));
        }
      }
      for (let r = 1; r < rowEdges.length - 1; r += 1) {
        const aboveRow = r - 1;
        const belowRow = r;
        for (let c = 0; c < win.layout.columns.length; c += 1) {
          if (cellHasCustomShape(win, aboveRow, c) || cellHasCustomShape(win, belowRow, c)) continue;
          const dividerX = colEdges[c];
          const dividerY = rowEdges[r] - face / 2;
          const dividerW = colEdges[c + 1] - colEdges[c];
          const dividerH = face;
          parts.push(`<rect x="${dividerX}" y="${dividerY}" width="${dividerW}" height="${dividerH}" fill="${dividerColor}" stroke="${outlineColor}" stroke-width="1.5" />`);
          parts.push(renderProfileDividerBevel(dividerX, dividerY, dividerW, dividerH));
        }
      }

      parts.push(renderTopologyMembers(win, rects, face, dividerColor, outlineColor));
      parts.push(renderEngineeringJoints(win, x, y, drawW, drawH));
      parts.push(renderCanvasCommandZones(win, x, y, drawW, drawH));
      parts.push(renderMarkupLayer(rects, scale));
      parts.push(renderWindowGeometryHandles(win, x, y, drawW, drawH, inner, scale, colEdges, rowEdges));
      parts.push(`<g id="markupPreviewLayer" class="markup-preview-layer"></g>`);

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
        parts.push(dimensionLine(x, y + drawH + 34, x + drawW, y + drawH + 34, `${Math.round(win.widthMm)} mm`, false, "windowWidth"));
        parts.push(dimensionLine(x + drawW + 52, y, x + drawW + 52, y + drawH, `${Math.round(win.heightMm)} mm`, true, "windowHeight"));
        parts.push(`<text class="sill-height-label" x="${x + drawW + 10}" y="${y + drawH + 17}">台高 ${Math.round(win.installation?.sillHeightMm || 0)} mm</text>`);
        parts.push(renderCustomShapeAnnotations(win, x, y, drawW, drawH));
      }
      if (options.showPlanView) {
        parts.push(renderPlanView(win, rects, x, planY, drawW, outlineColor, frameColor, options));
      }

      setCanvasSvgContent(svg, parts);
      bindCanvasMarkupPlacement(svg);
      bindCanvasGeometryDrag(svg);
      svg.querySelectorAll(".cell").forEach(g => {
        g.addEventListener("click", event => {
          const row = Number(g.dataset.row);
          const col = Number(g.dataset.col);
          selectedMemberId = "";
          selectedJointId = "";
          selectedMarkupId = "";
          selectedCell = { row, col };
          if (canvasCommand.mode === "apply_cell_preset" && canvasCommand.cellPreset) {
            event.preventDefault();
            event.stopPropagation();
            applyCellPreset(canvasCommand.cellPreset, {
              opening: canvasCommand.cellOpening,
              panelCount: Number(canvasCommand.cellPanels || 0) || undefined,
              trackCount: Number(canvasCommand.cellTracks || 0) || undefined,
              panelMode: canvasCommand.panelMode || undefined
            });
            return;
          }
          if (canvasCommand.mode === "add_cell_markup" && canvasCommand.markupType) {
            event.preventDefault();
            event.stopPropagation();
            addCellMarkupFromEvent(g, event);
            return;
          }
          switchInspector("cell");
          render();
        });
        g.addEventListener("contextmenu", event => {
          event.preventDefault();
          const row = Number(g.dataset.row);
          const col = Number(g.dataset.col);
          selectedMemberId = "";
          selectedJointId = "";
          selectedMarkupId = "";
          selectedCell = { row, col };
          switchInspector("cell");
          render();
          showCellContextMenu(event, row, col);
        });
        g.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            selectedMemberId = "";
            selectedJointId = "";
            selectedMarkupId = "";
            selectedCell = { row: Number(g.dataset.row), col: Number(g.dataset.col) };
            switchInspector("cell");
            render();
          }
        });
      });
      let markupDrag = null;
      svg.querySelectorAll(".cell-markup").forEach(group => {
        group.addEventListener("click", event => {
          event.stopPropagation();
          selectedMarkupId = group.dataset.markupId || "";
          selectedCell = { row: Number(group.dataset.row), col: Number(group.dataset.col) };
          switchInspector("cell");
          renderObjectTree();
          renderSelectedObjectProperties();
        });
        group.addEventListener("dblclick", event => {
          event.preventDefault();
          event.stopPropagation();
          openCanvasMarkupEditor(group.dataset.markupId, event);
        });
        group.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openCanvasMarkupEditor(group.dataset.markupId, event);
          }
        });
        group.addEventListener("pointerdown", event => {
          markupDrag = beginMarkupDrag(group, event) || markupDrag;
        });
        group.addEventListener("pointermove", event => {
          markupDrag = updateMarkupDrag(group, markupDrag, event);
        });
        group.addEventListener("pointerup", event => {
          if (commitMarkupDrag(group, markupDrag, event)) {
            markupDrag = null;
            return;
          }
          markupDrag = null;
        });
        group.addEventListener("pointercancel", event => {
          if (markupDrag?.pointerId === event.pointerId) {
            group.removeAttribute("transform");
            markupDrag = null;
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
          selectedMarkupId = "";
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
      svg.querySelectorAll(".engineering-joint, .plan-engineering-joint").forEach(group => {
        const select = () => {
          const joint = project.joints.find(item => item.jointId === group.dataset.jointId);
          if (!joint) return;
          selectedMemberId = "";
          selectedJointId = joint.jointId;
          selectedMarkupId = "";
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
      svg.querySelectorAll(".editable-dimension").forEach(group => {
        group.addEventListener("dblclick", event => {
          event.preventDefault();
          event.stopPropagation();
          openCanvasDimensionEditor(group.dataset.dimensionEdit, event);
        });
        group.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openCanvasDimensionEditor(group.dataset.dimensionEdit, event);
          }
        });
      });
      svg.querySelectorAll(".joint-placement-zone").forEach(zone => {
        zone.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          handleCanvasCommandZone(zone.dataset.edge);
        });
        zone.addEventListener("contextmenu", event => {
          event.preventDefault();
          event.stopPropagation();
          cancelCanvasCommand("已退出添加模式。");
        });
      });
      svg.addEventListener("contextmenu", event => {
        if (!canvasCommand.mode) return;
        event.preventDefault();
        cancelCanvasCommand("已退出添加模式。");
      });
      document.getElementById("drawingTitle").textContent = `${win.mark} · ${win.name || ""}`;
      document.getElementById("drawingStats").textContent = `室外立面 · ${win.widthMm}×${win.heightMm} mm · ${win.layout.columns.length}列${win.layout.rows.length}行 · ${currentSeries(win).name}`;
    }

    function clampCanvasScale(value) {
      return Math.max(0.35, Math.min(5, Number(value) || 1));
    }

    function canvasViewportTransform() {
      return `translate(${canvasViewport.x.toFixed(3)} ${canvasViewport.y.toFixed(3)}) scale(${canvasViewport.scale.toFixed(4)})`;
    }

    function setCanvasSvgContent(svg, parts) {
      const content = Array.isArray(parts) ? parts.join("") : String(parts || "");
      svg.innerHTML = `<g id="canvasViewport" class="canvas-viewport" transform="${canvasViewportTransform()}">${content}</g>`;
    }

    function renderWindowGeometryHandles(win, x, y, width, height, inner, scale, colEdges, rowEdges) {
      if (canvasCommand.mode) return "";
      const attrs = `data-geometry-window="${escapeHtml(win.windowId)}" data-unit-scale="${scale}"`;
      const parts = [`<g class="geometry-drag-layer" aria-label="拖动调整窗体尺寸和中梃比例">`];
      parts.push(`<g class="geometry-drag-handle window-width-handle" ${attrs} data-geometry-kind="window" data-geometry-axis="width" tabindex="0">
        <line x1="${x + width}" y1="${y + 10}" x2="${x + width}" y2="${y + height - 10}" />
        <circle cx="${x + width}" cy="${y + height / 2}" r="7" />
      </g>`);
      parts.push(`<g class="geometry-drag-handle window-height-handle" ${attrs} data-geometry-kind="window" data-geometry-axis="height" tabindex="0">
        <line x1="${x + 10}" y1="${y + height}" x2="${x + width - 10}" y2="${y + height}" />
        <circle cx="${x + width / 2}" cy="${y + height}" r="7" />
      </g>`);
      for (let index = 1; index < colEdges.length - 1; index += 1) {
        parts.push(`<g class="geometry-drag-handle mullion-drag-handle" ${attrs} data-geometry-kind="divider" data-geometry-axis="column" data-geometry-index="${index - 1}" tabindex="0">
          <line x1="${colEdges[index]}" y1="${inner.y}" x2="${colEdges[index]}" y2="${inner.y + inner.h}" />
          <circle cx="${colEdges[index]}" cy="${inner.y + 12}" r="6" />
        </g>`);
      }
      for (let index = 1; index < rowEdges.length - 1; index += 1) {
        parts.push(`<g class="geometry-drag-handle mullion-drag-handle" ${attrs} data-geometry-kind="divider" data-geometry-axis="row" data-geometry-index="${index - 1}" tabindex="0">
          <line x1="${inner.x}" y1="${rowEdges[index]}" x2="${inner.x + inner.w}" y2="${rowEdges[index]}" />
          <circle cx="${inner.x + 12}" cy="${rowEdges[index]}" r="6" />
        </g>`);
      }
      parts.push("</g>");
      return parts.join("");
    }

    function bindCanvasGeometryDrag(svg) {
      svg.querySelectorAll(".geometry-drag-handle").forEach(handle => {
        handle.addEventListener("pointerdown", event => {
          if (event.button !== 0 || canvasCommand.mode) return;
          const win = project.windows.find(item => item.windowId === handle.dataset.geometryWindow);
          if (!win) return;
          event.preventDefault();
          event.stopPropagation();
          const point = canvasPointFromMouse(svg, event);
          geometryDrag = {
            pointerId: event.pointerId,
            windowId: win.windowId,
            kind: handle.dataset.geometryKind,
            axis: handle.dataset.geometryAxis,
            index: Number(handle.dataset.geometryIndex || 0),
            unitScale: Math.max(0.0001, Number(handle.dataset.unitScale || 1)),
            startPoint: point,
            startWidth: win.widthMm,
            startHeight: win.heightMm,
            startColumns: [...win.layout.columns],
            startRows: [...win.layout.rows],
            changed: false,
            moved: false
          };
          const move = moveEvent => updateGeometryDrag(svg, moveEvent);
          const up = upEvent => {
            finishGeometryDrag(svg, upEvent);
            document.removeEventListener("pointermove", move, true);
            document.removeEventListener("pointerup", up, true);
            document.removeEventListener("pointercancel", up, true);
          };
          geometryDrag.cleanup = () => {
            document.removeEventListener("pointermove", move, true);
            document.removeEventListener("pointerup", up, true);
            document.removeEventListener("pointercancel", up, true);
          };
          document.addEventListener("pointermove", move, true);
          document.addEventListener("pointerup", up, true);
          document.addEventListener("pointercancel", up, true);
        });
      });
    }

    function applyGeometryDragDelta(drag, deltaMm) {
      const win = project.windows.find(item => item.windowId === drag.windowId);
      if (!win) return false;
      if (drag.kind === "window") {
        if (drag.axis === "width") win.widthMm = Math.max(300, Math.round(drag.startWidth + deltaMm));
        if (drag.axis === "height") win.heightMm = Math.max(300, Math.round(drag.startHeight + deltaMm));
      } else {
        const weights = drag.axis === "column" ? drag.startColumns : drag.startRows;
        if (weights.length < 2) return false;
        const spanMm = drag.axis === "column" ? drag.startWidth : drag.startHeight;
        const total = sum(weights);
        const sizes = weights.map(value => value / total * spanMm);
        const index = Math.max(0, Math.min(weights.length - 2, drag.index));
        const pairTotal = sizes[index] + sizes[index + 1];
        if (pairTotal <= 240) return false;
        sizes[index] = Math.max(120, Math.min(pairTotal - 120, sizes[index] + deltaMm));
        sizes[index + 1] = pairTotal - sizes[index];
        if (drag.axis === "column") win.layout.columns = sizes;
        else win.layout.rows = sizes;
      }
      selectedWindowId = win.windowId;
      selectedPlacementId = currentProjectAssembly()?.placements?.find(item => item.windowId === win.windowId)?.placementId || "";
      return true;
    }

    function updateGeometryDrag(svg, event) {
      if (!geometryDrag || geometryDrag.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const point = canvasPointFromMouse(svg, event);
      const dx = point.x - geometryDrag.startPoint.x;
      const dy = point.y - geometryDrag.startPoint.y;
      geometryDrag.moved ||= Math.hypot(dx, dy) > 2;
      if (!geometryDrag.moved) return;
      const deltaPx = geometryDrag.axis === "height" || geometryDrag.axis === "row" ? dy : dx;
      const changed = applyGeometryDragDelta(geometryDrag, deltaPx / geometryDrag.unitScale);
      if (!changed) return;
      geometryDrag.changed = true;
      render();
    }

    function finishGeometryDrag(svg, event) {
      if (!geometryDrag || geometryDrag.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const drag = geometryDrag;
      geometryDrag.cleanup?.();
      geometryDrag = null;
      if (!drag.moved || !drag.changed) return;
      markDirty();
      showToast(drag.kind === "window" ? "窗框尺寸已更新。" : "中梃分格比例已更新。");
    }

    function updateCanvasViewportTransform() {
      document.getElementById("canvasViewport")?.setAttribute("transform", canvasViewportTransform());
    }

    function svgPointFromMouse(svg, event) {
      const rect = svg.getBoundingClientRect();
      const viewBox = svg.viewBox.baseVal;
      return {
        x: viewBox.x + (event.clientX - rect.left) * viewBox.width / Math.max(1, rect.width),
        y: viewBox.y + (event.clientY - rect.top) * viewBox.height / Math.max(1, rect.height)
      };
    }

    function canvasPointFromMouse(svg, event) {
      const point = svgPointFromMouse(svg, event);
      return {
        x: (point.x - canvasViewport.x) / canvasViewport.scale,
        y: (point.y - canvasViewport.y) / canvasViewport.scale
      };
    }

    function markupPositionFromEvent(cellGroup, event) {
      const svg = document.getElementById("windowSvg");
      const point = canvasPointFromMouse(svg, event);
      const x = Number(cellGroup.dataset.cellX || 0);
      const y = Number(cellGroup.dataset.cellY || 0);
      const w = Math.max(1, Number(cellGroup.dataset.cellW || 1));
      const h = Math.max(1, Number(cellGroup.dataset.cellH || 1));
      const xPercent = Math.max(0, Math.min(100, (point.x - x) / w * 100));
      const yPercent = Math.max(0, Math.min(100, (point.y - y) / h * 100));
      return { xPercent, yPercent, offsetXPercent: xPercent - 50, offsetYPercent: yPercent - 50 };
    }

    function beginMarkupDrag(group, event) {
      if (event.button !== 0 || canvasCommand.mode) return null;
      event.preventDefault();
      event.stopPropagation();
      group.setPointerCapture?.(event.pointerId);
      return {
        markupId: group.dataset.markupId || "",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        moved: false
      };
    }

    function updateMarkupDrag(group, drag, event) {
      if (!drag || drag.markupId !== group.dataset.markupId || drag.pointerId !== event.pointerId || canvasCommand.mode) return drag;
      event.preventDefault();
      event.stopPropagation();
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      drag.moved = drag.moved || Math.hypot(dx, dy) > 2;
      group.setAttribute("transform", `translate(${dx / canvasViewport.scale} ${dy / canvasViewport.scale})`);
      return drag;
    }

    function commitMarkupDrag(group, drag, event) {
      if (!drag || drag.markupId !== group.dataset.markupId || drag.pointerId !== event.pointerId || canvasCommand.mode) return false;
      event.preventDefault();
      event.stopPropagation();
      group.releasePointerCapture?.(event.pointerId);
      group.removeAttribute("transform");
      const moved = drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4;
      if (!moved) return false;
      const found = findCellMarkup(group.dataset.markupId);
      if (!found) return false;
      selectedWindowId = found.win.windowId;
      const assembly = currentProjectAssembly();
      selectedPlacementId = assembly?.placements?.find(placement => placement.windowId === selectedWindowId)?.placementId || "";
      selectedCell = { row: found.row, col: found.col };
      selectedMarkupId = group.dataset.markupId || "";
      const next = markupPositionFromEvent(group, event);
      const margin = found.markup.kind === "text" ? 0 : 4;
      found.markup.xPercent = Math.max(margin, Math.min(100 - margin, next.xPercent));
      found.markup.yPercent = Math.max(margin, Math.min(100 - margin, next.yPercent));
      found.markup.offsetXPercent = found.markup.xPercent - 50;
      found.markup.offsetYPercent = found.markup.yPercent - 50;
      markDirty();
      return true;
    }

    function findCellGroupFromEvent(svg, event) {
      const direct = event.target?.closest?.(".cell");
      if (direct && svg.contains(direct)) return direct;
      const point = canvasPointFromMouse(svg, event);
      return Array.from(svg.querySelectorAll(".cell")).find(group => {
        const x = Number(group.dataset.cellX || 0);
        const y = Number(group.dataset.cellY || 0);
        const w = Number(group.dataset.cellW || 0);
        const h = Number(group.dataset.cellH || 0);
        return point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h;
      }) || null;
    }

    function resetCanvasCommand() {
      canvasCommand = { mode: "", jointType: "", jointId: "", shapeType: "", cellPreset: "", cellOpening: "", cellPanels: "", cellTracks: "", panelMode: "", markupType: "" };
    }

    function bindCanvasMarkupPlacement(svg) {
      if (svg.__markupPlacementMoveHandler) {
        svg.removeEventListener("mousemove", svg.__markupPlacementMoveHandler, true);
      }
      if (svg.__markupPlacementClickHandler) {
        svg.removeEventListener("click", svg.__markupPlacementClickHandler, true);
      }
      svg.__markupPlacementMoveHandler = event => {
        if (canvasCommand.mode !== "add_cell_markup" || !canvasCommand.markupType) {
          hideMarkupPlacementPreview();
          return;
        }
        const group = findCellGroupFromEvent(svg, event);
        if (!group) {
          hideMarkupPlacementPreview();
          return;
        }
        showMarkupPlacementPreview(group, event);
      };
      svg.__markupPlacementClickHandler = event => {
        if (canvasCommand.mode !== "add_cell_markup" || !canvasCommand.markupType) return;
        const group = findCellGroupFromEvent(svg, event);
        if (!group) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        addCellMarkupFromEvent(group, event);
      };
      svg.addEventListener("mousemove", svg.__markupPlacementMoveHandler, true);
      svg.addEventListener("click", svg.__markupPlacementClickHandler, true);
    }

    function addCellMarkupFromEvent(cellGroup, event) {
      const win = project.windows.find(item => item.windowId === cellGroup.dataset.windowId) || currentWindow();
      const row = Number(cellGroup.dataset.row);
      const col = Number(cellGroup.dataset.col);
      const cell = win?.layout?.cells[cellIndex(row, col, win.layout.columns.length)];
      if (!cell || canvasCommand.mode !== "add_cell_markup") return;
      hideMarkupPlacementPreview();
      const markupType = canvasCommand.markupType || "text";
      const position = markupPositionFromEvent(cellGroup, event);
      if (markupType !== "text") {
        position.xPercent = Math.max(4, Math.min(96, position.xPercent));
        position.yPercent = Math.max(4, Math.min(96, position.yPercent));
        position.offsetXPercent = position.xPercent - 50;
        position.offsetYPercent = position.yPercent - 50;
      }
      cell.markups ||= [];
      const markup = createCellMarkup(markupType, {
        ...position,
        hostType: "cell",
        hostWindowId: win.windowId,
        hostCellId: cell.cellId
      });
      cell.markups.push(markup);
      selectedWindowId = win.windowId;
      selectedCell = { row, col };
      selectedMarkupId = markup.markupId;
      switchInspector("cell");
      resetCanvasCommand();
      markDirty();
      if (markup.kind === "text") {
        openCanvasMarkupEditor(markup.markupId, event);
        showToast("文字标注已放到当前玻璃区域，请输入文字后回车保存。");
        return;
      }
      showToast(`${markupToolLabel(markupType)}已安装到当前窗格，双击可编辑。`);
    }

    function showMarkupPlacementPreview(cellGroup, event) {
      if (canvasCommand.mode !== "add_cell_markup" || !canvasCommand.markupType) return;
      const previewLayer = document.getElementById("markupPreviewLayer");
      const svg = document.getElementById("windowSvg");
      if (!previewLayer || !svg) return;
      hideMarkupPlacementPreview();
      const point = canvasPointFromMouse(svg, event);
      const kind = canvasCommand.markupType;
      const preview = document.createElementNS("http://www.w3.org/2000/svg", "g");
      preview.setAttribute("id", "markupPlacementPreview");
      preview.setAttribute("class", `markup-placement-preview ${kind}`);
      if (kind === "text") {
        preview.innerHTML = `<rect x="${point.x - 38}" y="${point.y - 14}" width="76" height="28" rx="2" /><text x="${point.x}" y="${point.y + 4}">文字标注</text>`;
      } else if (kind === "circle_hole") {
        preview.innerHTML = `<circle cx="${point.x}" cy="${point.y}" r="16" /><text x="${point.x}" y="${point.y + 30}">圆孔</text>`;
      } else if (kind === "lock") {
        preview.innerHTML = `<rect x="${point.x - 8}" y="${point.y - 18}" width="16" height="36" rx="2" /><circle cx="${point.x}" cy="${point.y - 5}" r="3" /><text x="${point.x}" y="${point.y + 32}">锁具</text>`;
      } else {
        preview.innerHTML = `<rect x="${point.x - 16}" y="${point.y - 16}" width="32" height="32" /><text x="${point.x}" y="${point.y + 30}">方孔</text>`;
      }
      previewLayer.append(preview);
    }

    function hideMarkupPlacementPreview() {
      document.getElementById("markupPlacementPreview")?.remove();
    }

    function openCanvasMarkupEditor(markupId, event) {
      const found = findCellMarkup(markupId);
      const input = document.getElementById("canvasMarkupInput");
      const shell = document.querySelector(".canvas-shell");
      if (!found || !input || !shell) return;
      activeMarkupEditor = { markupId };
      input.type = "text";
      input.value = found.markup.kind === "text"
        ? found.markup.text
        : `${Math.round(found.markup.sizeMm)},${Math.round(found.markup.xPercent)},${Math.round(found.markup.yPercent)}`;
      input.placeholder = found.markup.kind === "text" ? "输入标注文字" : "尺寸mm,X%,Y%";
      const bounds = shell.getBoundingClientRect();
      const left = Number.isFinite(event.clientX) ? event.clientX - bounds.left : bounds.width / 2;
      const top = Number.isFinite(event.clientY) ? event.clientY - bounds.top : bounds.height / 2;
      input.style.left = `${Math.max(8, Math.min(left, bounds.width - 220))}px`;
      input.style.top = `${Math.max(8, Math.min(top, bounds.height - 40))}px`;
      input.classList.remove("hidden");
      input.focus();
      input.select();
    }

    function hideCanvasMarkupEditor() {
      const input = document.getElementById("canvasMarkupInput");
      activeMarkupEditor = null;
      input?.classList.add("hidden");
    }

    function commitCanvasMarkupEditor() {
      const input = document.getElementById("canvasMarkupInput");
      if (!activeMarkupEditor || !input || input.classList.contains("hidden")) return;
      const found = findCellMarkup(activeMarkupEditor.markupId);
      if (!found) {
        hideCanvasMarkupEditor();
        return;
      }
      if (found.markup.kind === "text") {
        found.markup.text = input.value.trim() || "文字标注";
      } else {
        const [size, xPercent, yPercent] = input.value.split(/[,\s]+/).map(Number);
        if (Number.isFinite(size)) found.markup.sizeMm = Math.max(10, Math.min(300, size));
        if (Number.isFinite(xPercent)) found.markup.xPercent = Math.max(4, Math.min(96, xPercent));
        if (Number.isFinite(yPercent)) found.markup.yPercent = Math.max(4, Math.min(96, yPercent));
        found.markup.offsetXPercent = found.markup.xPercent - 50;
        found.markup.offsetYPercent = found.markup.yPercent - 50;
      }
      hideCanvasMarkupEditor();
      markDirty();
      showToast("标注/孔位/锁具参数已更新。");
    }

    function handleCanvasWheel(event) {
      const svg = document.getElementById("windowSvg");
      if (!svg || event.target.closest?.("input, select, textarea, button")) return;
      event.preventDefault();
      const pointer = svgPointFromMouse(svg, event);
      const previousScale = canvasViewport.scale;
      const zoomFactor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nextScale = clampCanvasScale(previousScale * zoomFactor);
      if (Math.abs(nextScale - previousScale) < 0.001) return;
      const ratio = nextScale / previousScale;
      canvasViewport.x = pointer.x - (pointer.x - canvasViewport.x) * ratio;
      canvasViewport.y = pointer.y - (pointer.y - canvasViewport.y) * ratio;
      canvasViewport.scale = nextScale;
      updateCanvasViewportTransform();
    }

    function shouldStartCanvasPan(event) {
      if (event.button !== 0 || canvasCommand.mode) return false;
      if (event.target.closest?.(".cell, .cell-markup, .topology-member, .engineering-joint, .assembly-window, .assembly-elevation-joint, .assembly-plan-joint-group, .plan-engineering-joint, .joint-placement-zone, .editable-dimension, .geometry-drag-handle")) return false;
      return true;
    }

    function handleCanvasPanStart(event) {
      const svg = document.getElementById("windowSvg");
      if (!svg || !shouldStartCanvasPan(event)) return;
      event.preventDefault();
      canvasPan = {
        active: true,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: canvasViewport.x,
        originY: canvasViewport.y
      };
      svg.classList.add("is-panning");
      svg.setPointerCapture?.(event.pointerId);
    }

    function handleCanvasPanMove(event) {
      if (!canvasPan.active || event.pointerId !== canvasPan.pointerId) return;
      const svg = document.getElementById("windowSvg");
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const viewBox = svg.viewBox.baseVal;
      const dx = (event.clientX - canvasPan.startX) * viewBox.width / Math.max(1, rect.width);
      const dy = (event.clientY - canvasPan.startY) * viewBox.height / Math.max(1, rect.height);
      canvasViewport.x = canvasPan.originX + dx;
      canvasViewport.y = canvasPan.originY + dy;
      updateCanvasViewportTransform();
    }

    function handleCanvasPanEnd(event) {
      if (!canvasPan.active || event.pointerId !== canvasPan.pointerId) return;
      const svg = document.getElementById("windowSvg");
      svg?.classList.remove("is-panning");
      document.getElementById("canvasPanHandle")?.classList.remove("is-panning");
      svg?.releasePointerCapture?.(event.pointerId);
      event.currentTarget?.releasePointerCapture?.(event.pointerId);
      canvasPan = { active: false, pointerId: 0, startX: 0, startY: 0, originX: 0, originY: 0 };
    }

    function bindCanvasWheelZoom() {
      const svg = document.getElementById("windowSvg");
      if (!svg) return;
      const panHandle = document.getElementById("canvasPanHandle");
      svg.addEventListener("selectstart", event => event.preventDefault());
      svg.addEventListener("wheel", handleCanvasWheel, { passive: false });
      svg.addEventListener("pointerdown", handleCanvasPanStart);
      svg.addEventListener("pointermove", handleCanvasPanMove);
      svg.addEventListener("pointerup", handleCanvasPanEnd);
      svg.addEventListener("pointercancel", handleCanvasPanEnd);
      panHandle?.addEventListener("pointerdown", event => {
        if (event.button !== 0 || canvasCommand.mode) return;
        event.preventDefault();
        canvasPan = {
          active: true,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: canvasViewport.x,
          originY: canvasViewport.y
        };
        svg.classList.add("is-panning");
        panHandle.classList.add("is-panning");
        panHandle.setPointerCapture?.(event.pointerId);
      });
      panHandle?.addEventListener("pointermove", handleCanvasPanMove);
      panHandle?.addEventListener("pointerup", handleCanvasPanEnd);
      panHandle?.addEventListener("pointercancel", handleCanvasPanEnd);
    }

    function canvasDimensionMeta(target) {
      const win = currentWindow();
      if (!win) return null;
      if (target === "windowWidth") return { target, current: win.widthMm, min: 300, max: 30000, label: "外宽" };
      if (target === "windowHeight") return { target, current: win.heightMm, min: 300, max: 30000, label: "外高" };
      return null;
    }

    function hideCanvasDimensionEditor() {
      const editor = document.getElementById("canvasDimensionEditor");
      const input = document.getElementById("canvasDimensionInput");
      if (editor) editor.classList.add("hidden");
      if (!input) return;
      input.dataset.target = "";
      input.dataset.min = "";
      input.dataset.max = "";
    }

    function commitCanvasDimensionEditor() {
      const input = document.getElementById("canvasDimensionInput");
      const win = currentWindow();
      const editor = document.getElementById("canvasDimensionEditor");
      if (!input || !editor || editor.classList.contains("hidden") || !win) return;
      const target = input.dataset.target;
      const min = Number(input.dataset.min);
      const max = Number(input.dataset.max);
      const rawValue = Number(input.value);
      hideCanvasDimensionEditor();
      if (!Number.isFinite(rawValue)) return;
      const value = Math.max(min, Math.min(max, Math.round(rawValue)));
      if (target === "windowWidth") {
        win.widthMm = value;
        setValue("winWidth", value);
      }
      if (target === "windowHeight") {
        win.heightMm = value;
        setValue("winHeight", value);
      }
      markDirty();
    }

    function openCanvasDimensionEditor(target, event) {
      const meta = canvasDimensionMeta(target);
      const input = document.getElementById("canvasDimensionInput");
      const editor = document.getElementById("canvasDimensionEditor");
      const label = document.getElementById("canvasDimensionLabel");
      const shell = document.querySelector(".canvas-shell");
      if (!meta || !input || !editor || !shell) return;
      const box = shell.getBoundingClientRect();
      const left = Math.max(8, Math.min(box.width - 198, event.clientX - box.left + 10));
      const top = Math.max(8, Math.min(box.height - 116, event.clientY - box.top - 14));
      input.dataset.target = meta.target;
      input.dataset.min = String(meta.min);
      input.dataset.max = String(meta.max);
      input.setAttribute("aria-label", meta.label);
      if (label) label.textContent = `${meta.label} mm`;
      input.min = String(meta.min);
      input.max = String(meta.max);
      input.step = "1";
      input.value = String(Math.round(meta.current));
      editor.style.left = `${left}px`;
      editor.style.top = `${top}px`;
      editor.classList.remove("hidden");
      input.focus();
      input.select();
    }

    function svgPlanDefs() {
      return `<defs>
        <marker id="planMotionArrow" viewBox="0 0 8 8" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L8,4 L0,8 Z" fill="#1677ff" />
        </marker>
      </defs>`;
    }

    function renderProfileBevel(x, y, width, height, face) {
      if (width <= 0 || height <= 0 || face <= 0) return "";
      const inset = Math.max(3, Math.min(face * 0.24, 13));
      const innerX = x + face;
      const innerY = y + face;
      const innerW = Math.max(0, width - face * 2);
      const innerH = Math.max(0, height - face * 2);
      const outerRight = x + width;
      const outerBottom = y + height;
      const innerRight = innerX + innerW;
      const innerBottom = innerY + innerH;
      const hasInner = innerW > 0 && innerH > 0;
      const highlights = [
        `M${x + inset} ${y + inset} H${outerRight - inset}`,
        `M${x + inset} ${y + inset} V${outerBottom - inset}`
      ];
      const shadows = [
        `M${outerRight - inset} ${y + inset} V${outerBottom - inset}`,
        `M${x + inset} ${outerBottom - inset} H${outerRight - inset}`
      ];
      const grooves = [];
      const miters = [
        `M${x} ${y} L${innerX} ${innerY}`,
        `M${outerRight} ${y} L${innerRight} ${innerY}`,
        `M${outerRight} ${outerBottom} L${innerRight} ${innerBottom}`,
        `M${x} ${outerBottom} L${innerX} ${innerBottom}`
      ];
      if (hasInner) {
        const innerGuideX = innerX - inset * 0.42;
        const innerGuideY = innerY - inset * 0.42;
        const innerGuideRight = innerRight + inset * 0.42;
        const innerGuideBottom = innerBottom + inset * 0.42;
        highlights.push(`M${innerGuideX} ${innerGuideY} H${innerGuideRight}`);
        highlights.push(`M${innerGuideX} ${innerGuideY} V${innerGuideBottom}`);
        shadows.push(`M${innerGuideRight} ${innerGuideY} V${innerGuideBottom}`);
        shadows.push(`M${innerGuideX} ${innerGuideBottom} H${innerGuideRight}`);
        grooves.push(`M${innerX - inset * 0.45} ${innerY - inset * 0.45} H${innerRight + inset * 0.45} V${innerBottom + inset * 0.45} H${innerX - inset * 0.45} Z`);
      }
      return `
        <g class="profile-bevel-layer">
          <path class="profile-bevel-highlight" d="${highlights.join(" ")}" />
          <path class="profile-bevel-shadow" d="${shadows.join(" ")}" />
          <path class="profile-bevel-miter" d="${miters.join(" ")}" />
          ${grooves.length ? `<path class="profile-bevel-groove" d="${grooves.join(" ")}" />` : ""}
        </g>`;
    }

    function renderProfileDividerBevel(x, y, width, height) {
      if (width <= 0 || height <= 0) return "";
      const inset = Math.max(2, Math.min(width, height) * 0.18);
      const right = x + width;
      const bottom = y + height;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const vertical = height >= width;
      return `
        <g class="profile-bevel-layer profile-divider-bevel">
          <path class="profile-bevel-highlight" d="M${x + inset} ${y + inset} H${right - inset} M${x + inset} ${y + inset} V${bottom - inset}" />
          <path class="profile-bevel-shadow" d="M${right - inset} ${y + inset} V${bottom - inset} M${x + inset} ${bottom - inset} H${right - inset}" />
          <path class="profile-bevel-groove" d="${vertical
            ? `M${centerX} ${y + inset} V${bottom - inset}`
            : `M${x + inset} ${centerY} H${right - inset}`}" />
        </g>`;
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
      const showPlanView = Boolean(project.viewOptions?.showPlanView);
      const view = { w: 900, h: showPlanView ? 800 : 700 };
      const elevationHeight = showPlanView ? 470 : view.h;
      const assembly = currentProjectAssembly();
      svg.setAttribute("viewBox", `0 0 ${view.w} ${view.h}`);
      if (!assembly) {
        setCanvasSvgContent(svg, `<text class="assembly-empty-state" x="450" y="${elevationHeight / 2}">尚未建立门窗拼接</text>`);
        document.getElementById("drawingTitle").textContent = "拼接总图";
        document.getElementById("drawingStats").textContent = `${project.windows.length}樘待拼接门窗`;
        return;
      }
      const layout = resolveAssemblyLayout(assembly, project.windows);
      const elevation = resolveAssemblyElevationLayout(assembly, project.windows);
      const elevationBoxes = elevation.items;
      const elevationExtents = [
        ...elevationBoxes.map(item => ({ x1: item.x, y1: item.y, x2: item.x + item.w, y2: item.y + item.h })),
        ...elevation.connectors.map(item => ({ x1: item.x, y1: item.y, x2: item.x + item.w, y2: item.y + item.h }))
      ];
      const minX = Math.min(...elevationExtents.map(item => item.x1));
      const maxX = Math.max(...elevationExtents.map(item => item.x2));
      const minY = Math.min(...elevationExtents.map(item => item.y1));
      const maxY = Math.max(...elevationExtents.map(item => item.y2));
      const margin = 86;
      const scale = Math.min(
        (view.w - margin * 2) / Math.max(1, maxX - minX),
        (elevationHeight - margin * 2) / Math.max(1, maxY - minY)
      );
      const offsetX = (view.w - (maxX - minX) * scale) / 2 - minX * scale;
      const offsetY = (elevationHeight - (maxY - minY) * scale) / 2 - minY * scale;
      const mapElevation = (xMm, yMm) => ({ x: xMm * scale + offsetX, y: yMm * scale + offsetY });
      const parts = [svgPlanDefs()];

      elevation.connectors.forEach(connector => {
        const joint = project.joints.find(candidate => candidate.jointId === connector.jointId);
        const start = mapElevation(connector.x, connector.y);
        const width = Math.max(8, connector.w * scale);
        const height = Math.max(8, connector.h * scale);
        const vertical = connector.orientation === "vertical";
        const midX = start.x + width / 2;
        const midY = start.y + height / 2;
        const jointIndex = project.joints.indexOf(joint);
        const label = joint ? (joint.type === "corner" ? `T${jointIndex + 1}` : `S${jointIndex + 1}`) : "";
        const hostWindow = joint ? project.windows.find(win => win.windowId === joint.hostWindowId) : null;
        const detail = joint
          ? joint.type === "corner"
            ? `${Math.round(joint.legWidthAMm || connector.w)}*${Math.round(joint.legWidthBMm || connector.w)} ${joint.orientation === "reversed" ? "外转" : "内转"}${Math.round(joint.angleDeg || 180)}°`
            : `宽${Math.round(joint.legWidthAMm || connector.w)} · 长${Math.round(jointLengthMm(joint, hostWindow))}`
          : "";
        const selected = Boolean(joint && joint.jointId === selectedJointId);
        parts.push(`<g class="assembly-elevation-joint ${selected ? "selected" : ""}" data-joint-id="${escapeHtml(connector.jointId || "")}" tabindex="0" role="button" aria-label="${escapeHtml(joint ? jointLabel(joint, jointIndex) : "连接节点")}">`);
        parts.push(`<rect class="assembly-elevation-joint-hit" x="${start.x - 10}" y="${start.y - 10}" width="${width + 20}" height="${height + 20}" />`);
        parts.push(`<rect class="assembly-elevation-joint-profile" x="${start.x}" y="${start.y}" width="${width}" height="${height}" />`);
        parts.push(vertical
          ? `<line class="assembly-elevation-joint-centerline" x1="${midX}" y1="${start.y}" x2="${midX}" y2="${start.y + height}" />`
          : `<line class="assembly-elevation-joint-centerline" x1="${start.x}" y1="${midY}" x2="${start.x + width}" y2="${midY}" />`);
        if (label) parts.push(`<text class="assembly-elevation-joint-label" x="${midX}" y="${midY}">${escapeHtml(label)}</text>`);
        if (detail) parts.push(`<text class="assembly-elevation-joint-note" x="${midX}" y="${start.y - 10}">${escapeHtml(detail)}</text>`);
        parts.push("</g>");
      });

      elevationBoxes.forEach(item => {
        const win = item.window;
        const series = currentSeries(win);
        const face = Math.min(Number(series.faceWidthMm || 70), win.widthMm * 0.18, win.heightMm * 0.18) * scale;
        const topLeft = mapElevation(item.x, item.y);
        const drawW = item.w * scale;
        const drawH = item.h * scale;
        const selected = !selectedJointId && (item.placementId ? item.placementId === selectedPlacementId : !selectedPlacementId && win.windowId === selectedWindowId && activeInspectorTab !== "assembly");
        parts.push(`<g class="assembly-window ${selected ? "selected" : ""}" data-window-id="${escapeHtml(win.windowId)}" data-placement-id="${escapeHtml(item.placementId)}" tabindex="0">`);
        const frameColor = project.viewOptions?.showProfileColor ? profileColor(win.colorInside, series.material) : "#7e8792";
        const framePath = frameShapePath(win, topLeft.x, topLeft.y, drawW, drawH, face);
        parts.push(`<path class="assembly-window-frame" d="${framePath}" fill-rule="evenodd" style="fill:${frameColor}" />`);
        parts.push(renderProfileBevel(topLeft.x, topLeft.y, drawW, drawH, face));
        parts.push(`<rect class="assembly-window-inner" x="${topLeft.x + face}" y="${topLeft.y + face}" width="${Math.max(0, drawW - face * 2)}" height="${Math.max(0, drawH - face * 2)}" />`);
        const innerWidth = Math.max(0, drawW - face * 2);
        const innerHeight = Math.max(0, drawH - face * 2);
        const assemblyInner = { x: topLeft.x + face, y: topLeft.y + face, w: innerWidth, h: innerHeight };
        parts.push(renderAssemblyWindowCells(win, assemblyInner, scale, "#26393e"));
        const colTotal = sum(win.layout.columns);
        let colAt = topLeft.x + face;
        for (let index = 0; index < win.layout.columns.length - 1; index += 1) {
          colAt += innerWidth * win.layout.columns[index] / colTotal;
          parts.push(`<line class="assembly-window-divider" x1="${colAt}" y1="${topLeft.y + face}" x2="${colAt}" y2="${topLeft.y + drawH - face}" />`);
        }
        const rowTotal = sum(win.layout.rows);
        let rowAt = topLeft.y + face;
        for (let index = 0; index < win.layout.rows.length - 1; index += 1) {
          rowAt += innerHeight * win.layout.rows[index] / rowTotal;
          parts.push(`<line class="assembly-window-divider" x1="${topLeft.x + face}" y1="${rowAt}" x2="${topLeft.x + drawW - face}" y2="${rowAt}" />`);
        }
        parts.push(renderWindowGeometryHandles(
          win,
          topLeft.x,
          topLeft.y,
          drawW,
          drawH,
          assemblyInner,
          scale,
          rectsToEdges(win.layout.columns, assemblyInner.x, assemblyInner.w),
          rectsToEdges(win.layout.rows, assemblyInner.y, assemblyInner.h)
        ));
        parts.push(`<text class="assembly-window-label" x="${topLeft.x + drawW / 2}" y="${topLeft.y + drawH / 2}">${escapeHtml(win.mark)}</text>`);
        parts.push("</g>");
      });

      const bounds = assemblyBounds(layout);
      const elevationMin = mapElevation(minX, minY);
      const elevationMax = mapElevation(maxX, maxY);
      const segmentDimY = elevationMax.y + 26;
      elevationBoxes.forEach(item => {
        const segmentStart = mapElevation(item.x, maxY);
        const segmentEnd = mapElevation(item.x + item.w, maxY);
        parts.push(`<g class="assembly-segment-dimension" data-window-id="${escapeHtml(item.windowId)}">${dimensionLine(segmentStart.x, segmentDimY, segmentEnd.x, segmentDimY, `${Math.round(item.w)} mm`)}</g>`);
      });
      parts.push(dimensionLine(elevationMin.x, elevationMax.y + 58, elevationMax.x, elevationMax.y + 58, `${Math.round(maxX - minX)} mm`));
      parts.push(dimensionLine(elevationMax.x + 44, elevationMin.y, elevationMax.x + 44, elevationMax.y, `${Math.round(maxY - minY)} mm`, true));
      if (bounds.depthMm > 0.5) parts.push(`<text class="sill-height-label" x="${margin}" y="${elevationHeight - 18}">空间进深 ${Math.round(bounds.depthMm)} mm</text>`);
      parts.push(renderAssemblyCommandZones(elevationMin.x, elevationMin.y, elevationMax.x - elevationMin.x, elevationMax.y - elevationMin.y));
      parts.push(renderAssemblyInternalJointZones(assembly, elevationBoxes, mapElevation, scale));
      if (showPlanView) {
        parts.push(renderAssemblyPlanView(assembly, layout, view.w, elevationHeight + 12, view.h - elevationHeight - 86));
      }
      parts.push(`<g id="markupPreviewLayer" class="markup-preview-layer"></g>`);
      setCanvasSvgContent(svg, parts);
      bindCanvasMarkupPlacement(svg);
      bindCanvasGeometryDrag(svg);

      const selectGroup = group => {
        selectedWindowId = group.dataset.windowId;
        selectedPlacementId = group.dataset.placementId || "";
        selectedMemberId = "";
        selectedJointId = "";
        selectedMarkupId = "";
        switchInspector("window");
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
      svg.querySelectorAll(".assembly-cell").forEach(group => {
        group.addEventListener("click", event => {
          const row = Number(group.dataset.row);
          const col = Number(group.dataset.col);
          selectedWindowId = group.dataset.windowId || selectedWindowId;
          selectedPlacementId = assembly.placements.find(placement => placement.windowId === selectedWindowId)?.placementId || "";
          selectedMemberId = "";
          selectedJointId = "";
          selectedMarkupId = "";
          selectedCell = { row, col };
          if (canvasCommand.mode === "apply_cell_preset" && canvasCommand.cellPreset) {
            event.preventDefault();
            event.stopPropagation();
            applyCellPreset(canvasCommand.cellPreset, {
              opening: canvasCommand.cellOpening,
              panelCount: Number(canvasCommand.cellPanels || 0) || undefined,
              trackCount: Number(canvasCommand.cellTracks || 0) || undefined,
              panelMode: canvasCommand.panelMode || undefined
            });
            return;
          }
          if (canvasCommand.mode === "add_cell_markup" && canvasCommand.markupType) {
            event.preventDefault();
            event.stopPropagation();
            addCellMarkupFromEvent(group, event);
            return;
          }
          event.stopPropagation();
          switchInspector("cell");
          render();
        });
        group.addEventListener("keydown", event => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          selectedWindowId = group.dataset.windowId || selectedWindowId;
          selectedPlacementId = assembly.placements.find(placement => placement.windowId === selectedWindowId)?.placementId || "";
          selectedMemberId = "";
          selectedJointId = "";
          selectedMarkupId = "";
          selectedCell = { row: Number(group.dataset.row), col: Number(group.dataset.col) };
          switchInspector("cell");
          render();
        });
      });
      let markupDrag = null;
      svg.querySelectorAll(".cell-markup").forEach(group => {
        group.addEventListener("click", event => {
          event.stopPropagation();
          const found = findCellMarkup(group.dataset.markupId);
          if (!found) return;
          selectedWindowId = found.win.windowId;
          selectedPlacementId = assembly.placements.find(placement => placement.windowId === selectedWindowId)?.placementId || "";
          selectedMarkupId = group.dataset.markupId || "";
          selectedCell = { row: found.row, col: found.col };
          switchInspector("cell");
          render();
        });
        group.addEventListener("dblclick", event => {
          event.preventDefault();
          event.stopPropagation();
          const found = findCellMarkup(group.dataset.markupId);
          if (found) selectedWindowId = found.win.windowId;
          openCanvasMarkupEditor(group.dataset.markupId, event);
        });
        group.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openCanvasMarkupEditor(group.dataset.markupId, event);
          }
        });
        group.addEventListener("pointerdown", event => {
          markupDrag = beginMarkupDrag(group, event) || markupDrag;
        });
        group.addEventListener("pointermove", event => {
          markupDrag = updateMarkupDrag(group, markupDrag, event);
        });
        group.addEventListener("pointerup", event => {
          if (commitMarkupDrag(group, markupDrag, event)) {
            markupDrag = null;
            return;
          }
          markupDrag = null;
        });
        group.addEventListener("pointercancel", event => {
          if (markupDrag?.pointerId === event.pointerId) {
            group.removeAttribute("transform");
            markupDrag = null;
          }
        });
      });
      svg.querySelectorAll(".assembly-elevation-joint, .assembly-plan-joint-group").forEach(group => {
        const selectJoint = () => {
          const joint = project.joints.find(item => item.jointId === group.dataset.jointId);
          if (!joint) return;
          selectedJointId = joint.jointId;
          selectedMemberId = "";
          selectedPlacementId = "";
          selectedMarkupId = "";
          switchInspector("joint");
          render();
        };
        group.addEventListener("click", event => {
          event.stopPropagation();
          selectJoint();
        });
        group.addEventListener("contextmenu", event => {
          event.preventDefault();
          event.stopPropagation();
          selectJoint();
          showJointContextMenu(event, group.dataset.jointId);
        });
        group.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") selectJoint();
        });
      });
      svg.querySelectorAll(".joint-placement-zone").forEach(zone => {
        zone.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          handleCanvasCommandZone(zone.dataset.edge, zone.dataset.placementId || "");
        });
        zone.addEventListener("contextmenu", event => {
          event.preventDefault();
          event.stopPropagation();
          cancelCanvasCommand("已退出添加模式。");
        });
      });
      svg.addEventListener("contextmenu", event => {
        if (!canvasCommand.mode) return;
        event.preventDefault();
        cancelCanvasCommand("已退出添加模式。");
      });
      const summary = assemblySummary(assembly, project.windows);
      document.getElementById("drawingTitle").textContent = `${assembly.name} · 拼接总图`;
      document.getElementById("drawingStats").textContent = `室外立面 · ${summary.windowIds.length}樘 · ${Math.round(maxX - minX)}×${Math.round(maxY - minY)}×${summary.overallDepthMm} mm`;
    }

    function resolveAssemblyElevationLayout(assembly, windows) {
      const byId = new Map((windows || []).map(win => [win.windowId, win]));
      const root = byId.get(assembly?.rootWindowId);
      if (!root) return { items: [], connectors: [] };
      const items = new Map([[root.windowId, {
        windowId: root.windowId,
        placementId: "",
        referenceWindowId: "",
        dock: "root",
        x: 0,
        y: 0,
        w: Number(root.widthMm || 0),
        h: Number(root.heightMm || 0),
        window: root
      }]]);
      const connectors = [];
      const usedJointIds = new Set();
      for (const placement of assembly.placements || []) {
        const win = byId.get(placement.windowId);
        const reference = items.get(placement.referenceWindowId);
        if (!win || !reference || items.has(win.windowId)) continue;
        const gap = Math.max(0, Number(placement.gapMm || 0));
        const w = Number(win.widthMm || 0);
        const h = Number(win.heightMm || 0);
        const alignOffset = placement.align === "start"
          ? 0
          : placement.align === "end"
            ? reference.h - h
            : (reference.h - h) / 2;
        let x = reference.x;
        let y = reference.y;
        if (placement.dock === "right") {
          x = reference.x + reference.w + gap;
          y = reference.y + alignOffset + Number(placement.offsetMm || 0);
          const top = Math.min(reference.y, y);
          const bottom = Math.max(reference.y + reference.h, y + h);
          connectors.push({ jointId: placement.jointId, orientation: "vertical", x: reference.x + reference.w, y: top, w: Math.max(12, gap), h: bottom - top });
          if (placement.jointId) usedJointIds.add(placement.jointId);
        } else if (placement.dock === "left") {
          x = reference.x - gap - w;
          y = reference.y + alignOffset + Number(placement.offsetMm || 0);
          const top = Math.min(reference.y, y);
          const bottom = Math.max(reference.y + reference.h, y + h);
          connectors.push({ jointId: placement.jointId, orientation: "vertical", x: x + w, y: top, w: Math.max(12, gap), h: bottom - top });
          if (placement.jointId) usedJointIds.add(placement.jointId);
        } else if (placement.dock === "top") {
          x = reference.x + (reference.w - w) / 2 + Number(placement.offsetMm || 0);
          y = reference.y - gap - h;
          const left = Math.min(reference.x, x);
          const right = Math.max(reference.x + reference.w, x + w);
          connectors.push({ jointId: placement.jointId, orientation: "horizontal", x: left, y: reference.y - Math.max(12, gap), w: right - left, h: Math.max(12, gap) });
          if (placement.jointId) usedJointIds.add(placement.jointId);
        } else if (placement.dock === "bottom") {
          x = reference.x + (reference.w - w) / 2 + Number(placement.offsetMm || 0);
          y = reference.y + reference.h + gap;
          const left = Math.min(reference.x, x);
          const right = Math.max(reference.x + reference.w, x + w);
          connectors.push({ jointId: placement.jointId, orientation: "horizontal", x: left, y: reference.y + reference.h, w: right - left, h: Math.max(12, gap) });
          if (placement.jointId) usedJointIds.add(placement.jointId);
        } else {
          x = reference.x + Number(placement.freePosition?.xMm || 0);
          y = reference.y + Number(placement.freePosition?.yMm || 0);
        }
        items.set(win.windowId, {
          windowId: win.windowId,
          placementId: placement.placementId,
          referenceWindowId: placement.referenceWindowId,
          dock: placement.dock,
          x,
          y,
          w,
          h,
          window: win
        });
      }
      for (const item of items.values()) {
        project.joints
          .filter(joint => joint.hostWindowId === item.windowId && !usedJointIds.has(joint.jointId))
          .forEach(joint => {
            const start = Math.max(0, Math.min(0.98, joint.span?.startRatio ?? 0));
            const end = Math.max(start + 0.02, Math.min(1, joint.span?.endRatio ?? 1));
            const legA = Math.max(12, Number(joint.legWidthAMm || 50));
            if (joint.hostEdge === "left") {
              connectors.push({ jointId: joint.jointId, orientation: "vertical", x: item.x - legA, y: item.y + item.h * start, w: legA, h: item.h * (end - start) });
            } else if (joint.hostEdge === "right") {
              connectors.push({ jointId: joint.jointId, orientation: "vertical", x: item.x + item.w, y: item.y + item.h * start, w: legA, h: item.h * (end - start) });
            } else if (joint.hostEdge === "top") {
              connectors.push({ jointId: joint.jointId, orientation: "horizontal", x: item.x + item.w * start, y: item.y - legA, w: item.w * (end - start), h: legA });
            } else if (joint.hostEdge === "bottom") {
              connectors.push({ jointId: joint.jointId, orientation: "horizontal", x: item.x + item.w * start, y: item.y + item.h, w: item.w * (end - start), h: legA });
            }
          });
      }
      return { items: [...items.values()], connectors: connectors.filter(connector => project.joints.some(joint => joint.jointId === connector.jointId)) };
    }

    function assemblyPlanPoint(item, localX, localZ = 0) {
      const angle = item.rotationDeg * Math.PI / 180;
      return {
        x: item.xMm + Math.cos(angle) * localX + Math.sin(angle) * localZ,
        z: item.zMm - Math.sin(angle) * localX + Math.cos(angle) * localZ
      };
    }

    function assemblyPlanFootprint(item) {
      const win = item.window;
      const series = currentSeries(win);
      const halfWidth = Number(win.widthMm || 0) / 2;
      const depth = Math.max(48, Number(series.frameDepthMm || series.faceWidthMm || 70));
      const halfDepth = depth / 2;
      const outer = [
        assemblyPlanPoint(item, -halfWidth, -halfDepth),
        assemblyPlanPoint(item, halfWidth, -halfDepth),
        assemblyPlanPoint(item, halfWidth, halfDepth),
        assemblyPlanPoint(item, -halfWidth, halfDepth)
      ];
      const innerInset = Math.min(halfDepth * 0.42, 18);
      const inner = [
        assemblyPlanPoint(item, -halfWidth + innerInset, -halfDepth + innerInset),
        assemblyPlanPoint(item, halfWidth - innerInset, -halfDepth + innerInset),
        assemblyPlanPoint(item, halfWidth - innerInset, halfDepth - innerInset),
        assemblyPlanPoint(item, -halfWidth + innerInset, halfDepth - innerInset)
      ];
      return { item, outer, inner, depth };
    }

    function renderAssemblyPlanView(assembly, layout, viewWidth, planTopY, planHeight) {
      if (!layout.length) return "";
      const footprints = layout.map(assemblyPlanFootprint);
      const framePoints = footprints.flatMap(footprint => footprint.outer);
      const frameMinX = Math.min(...framePoints.map(point => point.x));
      const frameMaxX = Math.max(...framePoints.map(point => point.x));
      const frameMinZ = Math.min(...framePoints.map(point => point.z));
      const frameMaxZ = Math.max(...framePoints.map(point => point.z));
      const centers = layout.map(item => assemblyPlanPoint(item, 0, 0));
      const openings = layout.map(item => assemblyPlanOpenings(item));
      const allPoints = footprints.flatMap(footprint => [...footprint.outer, ...footprint.inner]).concat(centers, openings.flatMap(opening => opening.points));
      const values = key => allPoints.map(point => point[key]);
      const minX = Math.min(...values("x"));
      const maxX = Math.max(...values("x"));
      const rawMinZ = Math.min(...values("z"));
      const rawMaxZ = Math.max(...values("z"));
      const rawDepth = Math.max(1, rawMaxZ - rawMinZ);
      const depthMm = Math.max(rawDepth, 420);
      const centerZ = (rawMinZ + rawMaxZ) / 2;
      const minZ = centerZ - depthMm / 2;
      const maxZ = centerZ + depthMm / 2;
      const padX = 88;
      const padY = 26;
      const scale = Math.min(
        (viewWidth - padX * 2) / Math.max(1, maxX - minX),
        (planHeight - padY * 2) / Math.max(1, maxZ - minZ)
      );
      const offsetX = (viewWidth - (maxX - minX) * scale) / 2 - minX * scale;
      const offsetY = planTopY + (planHeight - (maxZ - minZ) * scale) / 2 - minZ * scale;
      const map = point => ({ x: point.x * scale + offsetX, y: point.z * scale + offsetY });
      const pointString = points => points.map(point => {
        const mapped = map(point);
        return `${mapped.x.toFixed(2)},${mapped.y.toFixed(2)}`;
      }).join(" ");
      const planParts = [
        `<g class="assembly-plan-view">`,
        `<path class="assembly-plan-split" d="M${padX} ${planTopY - 8}H${viewWidth - padX}" />`,
        `<text class="plan-side outside" x="${padX - 18}" y="${planTopY + 34}">室外</text>`,
        `<text class="plan-side inside" x="${padX - 18}" y="${planTopY + planHeight - 14}">室内</text>`
      ];

      layout.forEach(item => {
        if (!item.referenceWindowId) return;
        const reference = layout.find(candidate => candidate.windowId === item.referenceWindowId);
        if (!reference) return;
        const placement = assembly.placements.find(candidate => candidate.placementId === item.placementId);
        const joint = project.joints.find(candidate => candidate.jointId === placement?.jointId);
        if (!joint) return;
        const referenceSide = placement?.dock === "left" ? -1 : 1;
        const childSide = placement?.dock === "left" ? 1 : -1;
        const referenceHalfWidth = Number(reference.window?.widthMm || 0) / 2;
        const childHalfWidth = Number(item.window?.widthMm || 0) / 2;
        const from = map(assemblyPlanPoint(reference, referenceSide * referenceHalfWidth, 0));
        const to = map(assemblyPlanPoint(item, childSide * childHalfWidth, 0));
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const jointIndex = project.joints.indexOf(joint);
        const label = joint ? jointLabel(joint, jointIndex) : dockLabel(item.dock);
        const detail = joint
          ? joint.type === "corner"
            ? `${Math.round(joint.angleDeg || 90)}° · A ${Math.round(joint.legWidthAMm || 0)} / B ${Math.round(joint.legWidthBMm || 0)} mm`
            : `宽${Math.round(joint.legWidthAMm || 0)} · 长${Math.round(jointLengthMm(joint, reference.window))} mm`
          : "";
        const selected = Boolean(joint && joint.jointId === selectedJointId);
        const jointPathId = escapeHtml(joint?.jointId || "");
        planParts.push(`<g class="assembly-plan-joint-group ${joint?.type === "corner" ? "corner" : joint?.type === "splice" ? "splice" : "plain"} ${selected ? "selected" : ""}" data-joint-id="${jointPathId}" tabindex="0" role="button" aria-label="${escapeHtml(joint ? jointLabel(joint, jointIndex) : "连接节点")}">`);
        if (joint?.type === "corner") {
          const turnDown = (joint.orientation !== "reversed") === (referenceSide > 0);
          const bendY = midY + (turnDown ? 1 : -1) * Math.max(18, Math.min(46, Math.abs(to.x - from.x) * 0.28));
          const arcR = Math.max(16, Math.min(34, Math.abs(to.x - from.x) * 0.2));
          const sweep = turnDown ? (referenceSide > 0 ? 1 : 0) : (referenceSide > 0 ? 0 : 1);
          const cornerPath = `M${from.x} ${from.y}L${midX} ${from.y}L${midX} ${bendY}L${to.x} ${to.y}`;
          planParts.push(`<path class="assembly-plan-joint-hit" d="${cornerPath}" />`);
          planParts.push(`<path class="assembly-plan-corner-profile" d="${cornerPath}" />`);
          planParts.push(`<path class="assembly-plan-joint assembly-plan-corner-centerline" d="${cornerPath}" />`);
          planParts.push(`<path class="assembly-plan-joint-angle-arc" d="M${midX - referenceSide * arcR} ${from.y} A${arcR} ${arcR} 0 0 ${sweep} ${midX} ${from.y + (turnDown ? arcR : -arcR)}" />`);
          planParts.push(`<text class="assembly-plan-joint-angle-label" x="${midX + referenceSide * (arcR + 12)}" y="${from.y + (turnDown ? arcR + 12 : -arcR - 6)}">${Math.round(joint.angleDeg || 90)}°</text>`);
        } else if (joint?.type === "splice") {
          const widthPx = Math.max(8, Number(joint.legWidthAMm || placement?.gapMm || 50) * scale);
          const heightPx = Math.max(28, Math.min(74, (Math.abs(to.y - from.y) || 420 * scale) * 0.32));
          planParts.push(`<rect class="assembly-plan-splice-hit" x="${midX - widthPx / 2 - 10}" y="${midY - heightPx / 2 - 10}" width="${widthPx + 20}" height="${heightPx + 20}" />`);
          planParts.push(`<rect class="assembly-plan-splice-profile" x="${midX - widthPx / 2}" y="${midY - heightPx / 2}" width="${widthPx}" height="${heightPx}" />`);
          planParts.push(`<line class="assembly-plan-joint" x1="${midX}" y1="${midY - heightPx / 2}" x2="${midX}" y2="${midY + heightPx / 2}" />`);
          planParts.push(`<text class="assembly-plan-splice-size" x="${midX + widthPx / 2 + 12}" y="${midY + 4}">${Math.round(joint.legWidthAMm || placement?.gapMm || 50)}</text>`);
        } else {
          planParts.push(`<line class="assembly-plan-joint-hit" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`);
          planParts.push(`<line class="assembly-plan-joint" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`);
        }
        planParts.push(`<circle class="assembly-plan-joint-node" cx="${midX}" cy="${midY}" r="5" />`);
        planParts.push(`<text class="assembly-plan-joint-label" x="${midX}" y="${midY - 12}">${escapeHtml(label)}</text>`);
        if (detail) planParts.push(`<text class="assembly-plan-joint-detail" x="${midX}" y="${midY + 18}">${escapeHtml(detail)}</text>`);
        planParts.push("</g>");
      });

      footprints.forEach(footprint => {
        const item = footprint.item;
        const win = item.window;
        const selected = !selectedJointId && (item.placementId ? item.placementId === selectedPlacementId : !selectedPlacementId && win.windowId === selectedWindowId && activeInspectorTab !== "assembly");
        const center = map(assemblyPlanPoint(item, 0, 0));
        planParts.push(`<g class="assembly-plan-window ${selected ? "selected" : ""}">`);
        planParts.push(`<polygon class="assembly-plan-frame" points="${pointString(footprint.outer)}" />`);
        planParts.push(`<polygon class="assembly-plan-inner" points="${pointString(footprint.inner)}" />`);
        planParts.push(`<text class="assembly-plan-window-label" x="${center.x}" y="${center.y + 4}">${escapeHtml(win.mark)}</text>`);
        planParts.push("</g>");
      });

      openings.forEach(({ item, content }) => {
        const origin = map(assemblyPlanPoint(item, 0, 0));
        const angle = -item.rotationDeg * Math.PI / 180;
        const unit = scale / 0.1;
        const a = Math.cos(angle) * unit;
        const b = Math.sin(angle) * unit;
        planParts.push(`<g class="assembly-plan-openings" data-window-id="${escapeHtml(item.windowId)}" transform="matrix(${a} ${b} ${-b} ${a} ${origin.x} ${origin.y})">${content}</g>`);
      });
      const dimY = planTopY + planHeight - 2;
      planParts.push(dimensionLine(map({ x: frameMinX, z: maxZ }).x, dimY, map({ x: frameMaxX, z: maxZ }).x, dimY, `${Math.round(frameMaxX - frameMinX)} mm`));
      if (rawDepth > 1) {
        const depthX = viewWidth - padX + 14;
        planParts.push(dimensionLine(depthX, map({ x: maxX, z: frameMinZ }).y, depthX, map({ x: maxX, z: frameMaxZ }).y, `${Math.round(frameMaxZ - frameMinZ)} mm`, true));
      }
      planParts.push(`</g>`);
      return planParts.join("");
    }

    function assemblyPlanOpenings(item) {
      const win = item.window;
      const unit = 0.1;
      const face = Number(currentSeries(win).faceWidthMm || 70);
      const rects = computeCellRects(win, {
        x: (-win.widthMm / 2 + face) * unit, y: 0,
        w: Math.max(1, win.widthMm - face * 2) * unit,
        h: Math.max(1, win.heightMm - face * 2) * unit
      });
      const ratio = project.viewOptions?.showOpenState ? 1 : 0;
      const points = [];
      const parts = [];
      rects.forEach(rect => {
        parts.push(renderPlanCellTracks(rect, 0, "#26393e", "#dce5e8", null));
        buildPlanOpeningParts(rect.cell, rect, 0, 7, null).forEach(entry => {
          const projections = entry.kind === "folding"
            ? foldingPlanProjections(entry.part, ratio).panels
            : [openingPlanProjection(entry.part, ratio)];
          projections.forEach(projection => projection.corners.forEach(point => {
            points.push(assemblyPlanPoint(item, point.x / unit, -point.z / unit));
          }));
          parts.push(entry.kind === "folding"
            ? renderPlanFoldingProjection(entry.part, ratio, 0)
            : renderPlanPanelProjection(entry.part, ratio, 0, entry.overhead));
        });
      });
      return { item, points, content: parts.join("") };
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
            ${renderProfileDividerBevel(x, y, Math.max(1, width), Math.max(1, height))}
            <text class="topology-member-label" x="${labelX}" y="${labelY}">${memberLabel(member, index)}</text>
          </g>`;
      }).join("");
    }

    function renderEngineeringJoints(win, x, y, width, height) {
      const joints = project.joints.filter(joint => joint.hostWindowId === win.windowId);
      return joints.map(joint => {
        const globalIndex = project.joints.findIndex(item => item.jointId === joint.jointId);
        const start = Math.max(0, Math.min(0.98, joint.span.startRatio));
        const end = Math.max(start + 0.02, Math.min(1, joint.span.endRatio));
        const scaleX = width / Math.max(1, win.widthMm);
        const scaleY = height / Math.max(1, win.heightMm);
        const vertical = ["left", "right"].includes(joint.hostEdge);
        const thickness = Math.max(24, Math.min(96, Number(joint.legWidthAMm || 50) * (vertical ? scaleX : scaleY)));
        const selected = joint.jointId === selectedJointId;
        const label = joint.type === "corner" ? `T${globalIndex + 1}` : `S${globalIndex + 1}`;
        const aliasText = jointAliasText(joint, label);
        const turnText = joint.type === "corner"
          ? `${Math.round(joint.legWidthAMm)}*${Math.round(joint.legWidthBMm)} ${joint.orientation === "reversed" ? "外转" : "内转"}${Math.round(joint.angleDeg || 180)}°`
          : `宽${Math.round(joint.legWidthAMm)} · 长${Math.round(jointLengthMm(joint, win))}`;
        let band;
        let labelX;
        let labelY;
        let noteX;
        let noteY;
        if (joint.hostEdge === "left") {
          band = { x: x - thickness, y: y + height * start, w: thickness, h: height * (end - start) };
          noteX = band.x + band.w / 2;
          noteY = band.y - 16;
        } else if (joint.hostEdge === "right") {
          band = { x: x + width, y: y + height * start, w: thickness, h: height * (end - start) };
          noteX = band.x + band.w / 2;
          noteY = band.y - 16;
        } else if (joint.hostEdge === "top") {
          band = { x: x + width * start, y: y - thickness, w: width * (end - start), h: thickness };
          noteX = band.x + band.w / 2;
          noteY = band.y - 10;
        } else {
          band = { x: x + width * start, y: y + height, w: width * (end - start), h: thickness };
          noteX = band.x + band.w / 2;
          noteY = band.y + band.h + 18;
        }
        labelX = band.x + band.w / 2;
        labelY = band.y + band.h / 2;
        const midLine = vertical
          ? `<line class="engineering-joint-centerline" x1="${band.x + band.w / 2}" y1="${band.y}" x2="${band.x + band.w / 2}" y2="${band.y + band.h}" />`
          : `<line class="engineering-joint-centerline" x1="${band.x}" y1="${band.y + band.h / 2}" x2="${band.x + band.w}" y2="${band.y + band.h / 2}" />`;
        return `
          <g class="engineering-joint ${selected ? "selected" : ""}" data-joint-id="${escapeHtml(joint.jointId)}" tabindex="0" role="button" aria-label="${joint.type === "corner" ? "转角节点" : "拼接节点"}">
            <rect class="engineering-joint-hit" x="${band.x}" y="${band.y}" width="${band.w}" height="${band.h}" />
            <rect class="engineering-joint-shape" x="${band.x}" y="${band.y}" width="${band.w}" height="${band.h}" />
            ${midLine}
            ${selected ? `<rect class="engineering-joint-selection" x="${band.x}" y="${band.y}" width="${band.w}" height="${band.h}" />` : ""}
            ${aliasText ? `<text class="engineering-joint-label" x="${labelX}" y="${labelY}">${escapeHtml(aliasText)}</text>` : ""}
            <text class="engineering-joint-note" x="${noteX}" y="${noteY}">${escapeHtml(turnText)}</text>
          </g>`;
      }).join("");
    }

    function jointAliasText(joint, label) {
      if (!joint || joint.aliasDisplay === "hidden") return "";
      if (joint.aliasDisplay === "code") return joint.profileId || label;
      if (joint.aliasDisplay === "all") return `${label} · ${joint.profileId || "-"}`;
      return label;
    }

    function renderCanvasCommandZones(win, x, y, width, height) {
      if (!["add_window_from_joint", "add_joint"].includes(canvasCommand.mode) || drawingMode !== "window") return "";
      const joint = canvasCommand.mode === "add_window_from_joint"
        ? project.joints.find(item => item.jointId === canvasCommand.jointId)
        : null;
      if (canvasCommand.mode === "add_window_from_joint" && (!joint || joint.hostWindowId !== win.windowId)) return "";
      const edges = canvasCommand.mode === "add_window_from_joint" ? [joint.hostEdge] : ["left", "right", "top", "bottom"];
      const title = canvasCommand.mode === "add_window_from_joint"
        ? `${shapeLabel(canvasCommand.shapeType || pendingConnectedShapeType)}接出位置`
        : `${canvasCommand.jointType === "corner" ? "转角料" : "拼接料"}安装位置`;
      const zoneW = Math.max(78, width * 0.22);
      const zoneH = Math.max(70, height * 0.22);
      const zones = {
        left: { x: x - zoneW, y, width: zoneW, height },
        right: { x: x + width, y, width: zoneW, height },
        top: { x, y: y - zoneH, width, height: zoneH },
        bottom: { x, y: y + height, width, height: zoneH }
      };
      const parts = [`<g class="joint-placement-zones" aria-label="${escapeHtml(title)}">`];
      edges.forEach(edge => {
        const zone = zones[edge];
        if (!zone) return;
        const labelX = zone.x + zone.width / 2;
        const labelY = zone.y + zone.height / 2;
        parts.push(`
          <g class="joint-placement-zone" data-edge="${edge}" tabindex="0" role="button" aria-label="${escapeHtml(`${title} · ${dockLabel(edge)}`)}">
            <rect class="joint-placement-zone-box" x="${zone.x}" y="${zone.y}" width="${zone.width}" height="${zone.height}" />
            <text class="joint-placement-zone-label" x="${labelX}" y="${labelY}">${escapeHtml(dockLabel(edge))}</text>
          </g>`);
      });
      parts.push(`<g class="joint-placement-tip">
        <rect x="${x - 72}" y="${y + height * 0.44}" width="210" height="44" rx="4" />
        <text x="${x - 60}" y="${y + height * 0.44 + 17}">快捷操作提示：</text>
        <text x="${x - 60}" y="${y + height * 0.44 + 33}">点击虚线区域添加，右键退出</text>
      </g>`);
      parts.push("</g>");
      return parts.join("");
    }

    function renderAssemblyCommandZones(x, y, width, height) {
      if (drawingMode !== "assembly") return "";
      if (canvasCommand.mode !== "add_window_from_joint" && canvasCommand.mode !== "add_joint") return "";
      const joint = canvasCommand.mode === "add_window_from_joint"
        ? project.joints.find(item => item.jointId === canvasCommand.jointId)
        : null;
      if (canvasCommand.mode === "add_window_from_joint" && !joint) return "";
      const title = canvasCommand.mode === "add_joint"
        ? `${canvasCommand.jointType === "corner" ? "转角料" : "拼接料"}安装位置`
        : `${shapeLabel(canvasCommand.shapeType || pendingConnectedShapeType)}接出位置`;
      const zoneW = Math.max(78, width * 0.16);
      const zoneH = Math.max(70, height * 0.22);
      const zones = {
        left: { x: x - zoneW, y, width: zoneW, height },
        right: { x: x + width, y, width: zoneW, height },
        top: { x, y: y - zoneH, width, height: zoneH },
        bottom: { x, y: y + height, width, height: zoneH }
      };
      const parts = [`<g class="joint-placement-zones assembly-joint-placement-zones" aria-label="${escapeHtml(title)}">`];
      ["left", "right", "top", "bottom"].forEach(edge => {
        const zone = zones[edge];
        const labelX = zone.x + zone.width / 2;
        const labelY = zone.y + zone.height / 2;
        parts.push(`
          <g class="joint-placement-zone" data-edge="${edge}" tabindex="0" role="button" aria-label="${escapeHtml(`${title} · ${dockLabel(edge)}`)}">
            <rect class="joint-placement-zone-box" x="${zone.x}" y="${zone.y}" width="${zone.width}" height="${zone.height}" />
            <text class="joint-placement-zone-label" x="${labelX}" y="${labelY}">${escapeHtml(dockLabel(edge))}</text>
          </g>`);
      });
      parts.push(`<g class="joint-placement-tip">
        <rect x="${x + 12}" y="${Math.max(18, y + height * 0.42)}" width="270" height="48" rx="4" />
        <text x="${x + 24}" y="${Math.max(18, y + height * 0.42) + 18}">快捷操作提示：</text>
        <text x="${x + 24}" y="${Math.max(18, y + height * 0.42) + 35}">按完整拼接图选择区域，右键退出</text>
      </g>`);
      parts.push("</g>");
      return parts.join("");
    }

    function renderAssemblyInternalJointZones(assembly, elevationBoxes, mapElevation, scale) {
      if (drawingMode !== "assembly" || canvasCommand.mode !== "add_joint") return "";
      const byWindowId = new Map(elevationBoxes.map(item => [item.windowId, item]));
      const zones = [];
      (assembly?.placements || []).forEach(placement => {
        if (placement.jointId || placement.dock === "free" || Number(placement.gapMm || 0) > 0.5) return;
        const child = byWindowId.get(placement.windowId);
        const reference = byWindowId.get(placement.referenceWindowId);
        if (!child || !reference) return;
        const vertical = placement.dock === "left" || placement.dock === "right";
        const boundaryMm = vertical
          ? (placement.dock === "right" ? child.x : reference.x)
          : (placement.dock === "bottom" ? reference.y + reference.h : child.y + child.h);
        const startMm = vertical ? Math.max(child.y, reference.y) : Math.max(child.x, reference.x);
        const endMm = vertical ? Math.min(child.y + child.h, reference.y + reference.h) : Math.min(child.x + child.w, reference.x + reference.w);
        if (endMm <= startMm) return;
        const start = vertical ? mapElevation(boundaryMm, startMm) : mapElevation(startMm, boundaryMm);
        const thickness = Math.max(22, 70 * scale);
        const x = vertical ? start.x - thickness / 2 : start.x;
        const y = vertical ? start.y : start.y - thickness / 2;
        const width = vertical ? thickness : (endMm - startMm) * scale;
        const height = vertical ? (endMm - startMm) * scale : thickness;
        zones.push(`<g class="joint-placement-zone internal-joint-zone" data-edge="${escapeHtml(placement.dock)}" data-placement-id="${escapeHtml(placement.placementId)}" tabindex="0" role="button" aria-label="在两樘窗中间插入连接件">
          <rect class="joint-placement-zone-box" x="${x}" y="${y}" width="${width}" height="${height}" />
          <text class="joint-placement-zone-label" x="${x + width / 2}" y="${y + height / 2}">中缝</text>
        </g>`);
      });
      return zones.length ? `<g class="joint-placement-zones internal-joint-zones">${zones.join("")}</g>` : "";
    }

    function handleCanvasCommandZone(edge, placementId = "") {
      if (!canvasCommand.mode) return;
      if (canvasCommand.mode === "add_joint") {
        if (placementId) {
          insertEngineeringJointAtPlacement(canvasCommand.jointType, placementId);
          return;
        }
        addEngineeringJointAtEdge(canvasCommand.jointType, edge);
        return;
      }
      if (canvasCommand.mode === "add_window_from_joint") {
        selectedJointId = canvasCommand.jointId;
        pendingConnectedShapeType = canvasCommand.shapeType || pendingConnectedShapeType;
        canvasCommand = { mode: "", jointType: "", jointId: "", shapeType: "", cellPreset: "", cellOpening: "", cellPanels: "", cellTracks: "", panelMode: "", markupType: "" };
        addAssemblyPlacement(edge, { forceCreate: true, shapeType: pendingConnectedShapeType });
      }
    }

    function cellDrawingCode(type, index) {
      return isOperableType(type) ? `A${index + 1}` : `F${index + 1}`;
    }

    function handlePositionY(cell, item, scale) {
      const cellHeightMm = Math.max(1, item.h / Math.max(scale, 0.0001));
      const handleHeightMm = Math.min(cellHeightMm, Math.max(0, Number(cell.handleHeightMm ?? 750)));
      return item.y + item.h - handleHeightMm * scale;
    }

    function openingDirectionText(cell) {
      if (!cell || !isOperableType(cell.type)) return "";
      const assembly = normalizeOpeningAssembly(cell.type, cell.opening, cell.openingAssembly);
      const opening = String(cell.opening || "");
      const plane = assembly.openPlane || (opening.endsWith("out") ? "out" : (opening.endsWith("in") ? "in" : ""));
      if (plane === "out") return "外开";
      if (plane === "in") return "内开";
      return "";
    }

    function openingDirectionSvgLabel(cell, x, y, anchor = "middle") {
      const label = openingDirectionText(cell);
      if (!label) return "";
      return `<text class="opening-direction-label" x="${x}" y="${y}" text-anchor="${anchor}">${escapeHtml(label)}</text>`;
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
      const labelX = (hingeX + freeX) / 2;
      const labelY = Math.max(item.y + 14, top + 16);
      return `
        <g class="open-sash-elevation">
          <path d="M${hingeX} ${top} L${freeX} ${top + perspective} L${freeX} ${bottom - perspective} L${hingeX} ${bottom} Z"
            fill="${glassFill}" stroke="${outlineColor}" stroke-width="${Math.max(4, Math.min(7, inset * 0.42))}" />
          <line x1="${hingeX}" y1="${top}" x2="${hingeX}" y2="${bottom}" stroke="${frameColor}" stroke-width="3" />
          <line x1="${freeX}" y1="${handleY - 9}" x2="${freeX}" y2="${handleY + 9}" stroke="#8a5a00" stroke-width="4" stroke-linecap="round" />
          ${openingDirectionSvgLabel(cell, labelX, labelY)}
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
      parts.push(renderPlanEngineeringJoints(win, x, planY, drawW, section));
      if (options.showDimensions) {
        const dimensionY = planY + Math.max(110, extents.inside + 54);
        parts.push(dimensionLine(x, dimensionY, x + drawW, dimensionY, `${Math.round(win.widthMm)} mm`));
      }
      parts.push(`</g>`);
      return parts.join("");
    }

    function renderPlanEngineeringJoints(win, x, planY, drawW, section) {
      const joints = project.joints.filter(joint => joint.hostWindowId === win.windowId);
      if (!joints.length) return "";
      const frameTopY = planY - section.frameOutsidePx;
      const frameBottomY = planY - section.frameInsidePx;
      const frameHeight = Math.max(8, frameBottomY - frameTopY);
      const mmToX = drawW / Math.max(1, win.widthMm);
      const mmToDepth = section.pxPerMm || frameHeight / 70;
      const parts = [`<g class="plan-engineering-joints">`];
      joints.forEach(joint => {
        const vertical = ["left", "right"].includes(joint.hostEdge);
        const start = Math.max(0, Math.min(0.98, joint.span?.startRatio ?? 0));
        const end = Math.max(start + 0.02, Math.min(1, joint.span?.endRatio ?? 1));
        const labelIndex = project.joints.findIndex(item => item.jointId === joint.jointId);
        const label = joint.type === "corner" ? `T${labelIndex + 1}` : `S${labelIndex + 1}`;
        const widthPx = Math.max(10, Math.min(42, Number(joint.legWidthAMm || 50) * (vertical ? mmToX : mmToDepth)));
        const depthPx = Math.max(16, Math.min(66, Number(joint.legWidthBMm || 50) * mmToDepth));
        const selected = joint.jointId === selectedJointId;
        if (joint.hostEdge === "left" || joint.hostEdge === "right") {
          const side = joint.hostEdge === "left" ? -1 : 1;
          const edgeX = side < 0 ? x : x + drawW;
          const bandX = side < 0 ? edgeX - widthPx : edgeX;
          const bandY = frameTopY;
          parts.push(`<g class="plan-engineering-joint ${selected ? "selected" : ""}" data-joint-id="${escapeHtml(joint.jointId)}" tabindex="0" role="button" aria-label="${escapeHtml(jointLabel(joint, labelIndex))}">`);
          parts.push(`<rect class="plan-joint-profile" x="${bandX}" y="${bandY}" width="${widthPx}" height="${frameHeight}" />`);
          parts.push(`<line class="plan-joint-centerline" x1="${bandX + widthPx / 2}" y1="${bandY}" x2="${bandX + widthPx / 2}" y2="${bandY + frameHeight}" />`);
          if (joint.type === "corner") {
            const turnDown = joint.orientation !== "reversed";
            const returnY = turnDown ? frameBottomY + depthPx : frameTopY - depthPx;
            const returnTop = Math.min(returnY, frameTopY);
            const returnHeight = Math.abs(returnY - frameTopY) + frameHeight;
            parts.push(`<rect class="plan-joint-profile return-leg" x="${bandX}" y="${returnTop}" width="${widthPx}" height="${returnHeight}" />`);
            const arcR = Math.max(18, Math.min(38, depthPx * 0.72));
            const arcStartY = turnDown ? frameBottomY + arcR : frameTopY - arcR;
            const arcEndX = edgeX + side * arcR;
            const sweep = turnDown ? (side < 0 ? 0 : 1) : (side < 0 ? 1 : 0);
            parts.push(`<path class="plan-joint-angle-arc" d="M${edgeX} ${arcStartY} A${arcR} ${arcR} 0 0 ${sweep} ${arcEndX} ${turnDown ? frameBottomY : frameTopY}" />`);
            parts.push(`<text class="plan-joint-angle-label" x="${edgeX + side * (arcR + 10)}" y="${turnDown ? frameBottomY + arcR + 10 : frameTopY - arcR - 4}">${Math.round(joint.angleDeg || 90)}°</text>`);
          }
          parts.push(`<text class="plan-joint-label" x="${bandX + widthPx / 2}" y="${frameTopY - 8}">${escapeHtml(label)}</text>`);
          parts.push(`<text class="plan-joint-size" x="${bandX + widthPx / 2}" y="${frameBottomY + 18}">${Math.round(joint.legWidthAMm || 0)}</text>`);
          parts.push("</g>");
          return;
        }
        const startX = x + drawW * start;
        const length = drawW * (end - start);
        const bandY = joint.hostEdge === "top" ? frameTopY - widthPx : frameBottomY;
        parts.push(`<g class="plan-engineering-joint ${selected ? "selected" : ""}" data-joint-id="${escapeHtml(joint.jointId)}" tabindex="0" role="button" aria-label="${escapeHtml(jointLabel(joint, labelIndex))}">`);
        parts.push(`<rect class="plan-joint-profile" x="${startX}" y="${bandY}" width="${length}" height="${widthPx}" />`);
        parts.push(`<line class="plan-joint-centerline" x1="${startX}" y1="${bandY + widthPx / 2}" x2="${startX + length}" y2="${bandY + widthPx / 2}" />`);
        parts.push(`<text class="plan-joint-label" x="${startX + length / 2}" y="${bandY - 8}">${escapeHtml(label)}</text>`);
        parts.push("</g>");
      });
      parts.push("</g>");
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
      menu.querySelectorAll("[data-corner-only]").forEach(item => {
        item.classList.toggle("hidden", joint.type !== "corner");
      });
      menu.querySelectorAll("[data-joint-angle]").forEach(item => {
        item.classList.toggle("checked", joint.type === "corner" && Number(item.dataset.jointAngle) === Math.round(joint.angleDeg || 0));
      });
      menu.querySelectorAll("[data-joint-style]").forEach(item => {
        item.classList.toggle("checked", item.dataset.jointStyle === joint.style);
      });
      menu.querySelectorAll("[data-joint-alias]").forEach(item => {
        item.classList.toggle("checked", item.dataset.jointAlias === (joint.aliasDisplay || "alias"));
      });
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
      if (title) title.textContent = `${win.mark}${placementId ? " · 定位窗" : ""}`;
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

    function focusJointInspector(fieldId = "") {
      if (!currentJoint()) return;
      hideJointContextMenu();
      switchInspector("joint");
      render();
      if (fieldId) setTimeout(() => document.getElementById(fieldId)?.focus(), 0);
    }

    function editJointLengthOrWidthFromMenu() {
      const joint = currentJoint();
      if (!joint) return;
      if (joint.type !== "splice") {
        focusJointInspector("jointLegA");
        return;
      }
      const nextWidth = promptJointNumericValue("请输入拼接件宽度 mm", joint.legWidthAMm, 10, 300);
      hideJointContextMenu();
      if (nextWidth === null) return;
      joint.legWidthAMm = nextWidth;
      syncPlacementsForJoint(joint);
      setValue("jointLegA", joint.legWidthAMm);
      setValue("jointLegB", joint.legWidthBMm);
      markDirty();
      showToast(`拼接件宽度已改为 ${Math.round(nextWidth)} mm。`);
    }

    function setJointAngleFromMenu(angleDeg) {
      const joint = currentJoint();
      if (!joint || joint.type !== "corner") return;
      joint.angleDeg = Number(angleDeg);
      syncPlacementsForJoint(joint);
      hideJointContextMenu();
      markDirty();
      showToast(`转角角度已改为 ${joint.angleDeg}°。`);
    }

    function setJointStyleFromMenu(style) {
      const joint = currentJoint();
      if (!joint) return;
      const options = JOINT_STYLE_OPTIONS[joint.type] || [];
      if (!options.some(item => item.value === style)) return;
      joint.style = style;
      hideJointContextMenu();
      markDirty();
      const label = options.find(item => item.value === style)?.label || style;
      showToast(`${joint.type === "corner" ? "转角料" : "拼接料"}形状已改为${label}。`);
    }

    function setJointAliasDisplayFromMenu(aliasDisplay) {
      const joint = currentJoint();
      if (!joint) return;
      const allowed = new Set(["code", "alias", "all", "hidden"]);
      if (!allowed.has(aliasDisplay)) return;
      joint.aliasDisplay = aliasDisplay;
      hideJointContextMenu();
      markDirty();
      const label = { code: "显示型材编码", alias: "显示节点别名", all: "显示编码+别名", hidden: "隐藏型材文字" }[aliasDisplay];
      showToast(`型材别名显示设置已改为：${label}。`);
    }

    function setJointProfileFromMenu(profileMode) {
      const joint = currentJoint();
      if (!joint) return;
      if (profileMode === "custom") {
        focusJointInspector("jointProfile");
        return;
      }
      const hostWindow = project.windows.find(win => win.windowId === joint.hostWindowId) || currentWindow();
      const series = currentSeries(hostWindow);
      const baseProfile = defaultJointProfile(joint.type, series);
      joint.profileId = profileMode === "reinforced" ? `${baseProfile}-PLUS` : baseProfile;
      hideJointContextMenu();
      markDirty();
      showToast(`连接型材已更换为 ${joint.profileId}。`);
    }

    function applyCellMenuType(type) {
      applyCellPreset(type);
      hideCellContextMenu();
    }

    function applyCellMenuAction(action) {
      hideCellContextMenu();
      if (action === "corner") {
        startEngineeringJointPlacement("corner");
        return;
      }
      if (action === "switchLayout") {
        switchInspector("cell");
        render();
        return;
      }
      if (action === "clearGrille") {
        const cell = currentCell(currentWindow());
        if (!cell) return;
        cell.accessories = normalizeCellAccessories(cell.accessories);
        cell.accessories.grille = false;
        markDirty();
        showToast("已清空选中区域格条。");
        return;
      }
      applyCellFillOrAccessory(action);
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
      if (infillType === "panel" || type === "panel") {
        const panelMode = normalizePanelMode(typeof cellOrType === "string" ? "single" : cellOrType?.panelMode);
        const panelInset = Math.max(10, Math.min(item.w, item.h) * 0.1);
        const left = item.x + panelInset;
        const right = item.x + item.w - panelInset;
        const top = item.y + panelInset;
        const bottom = item.y + item.h - panelInset;
        lines.push(`<rect class="panel-infill-outline" x="${left}" y="${top}" width="${Math.max(0, right - left)}" height="${Math.max(0, bottom - top)}" fill="none" stroke="#9d7a45" stroke-width="2" opacity="0.72" />`);
        if (panelMode === "double") {
          const mid = (left + right) / 2;
          lines.push(`<line class="panel-leaf-divider" x1="${mid}" y1="${top}" x2="${mid}" y2="${bottom}" stroke="#8b6d3f" stroke-width="3" opacity="0.76" />`);
          lines.push(`<text class="panel-mode-label" x="${(left + mid) / 2}" y="${(top + bottom) / 2}">板1</text>`);
          lines.push(`<text class="panel-mode-label" x="${(mid + right) / 2}" y="${(top + bottom) / 2}">板2</text>`);
        } else {
          lines.push(`<text class="panel-mode-label" x="${(left + right) / 2}" y="${(top + bottom) / 2}">板材</text>`);
        }
      }
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
          lines.push(`<line class="security-bar-line" x1="${x}" y1="${item.y + inset}" x2="${x}" y2="${item.y + item.h - inset}" stroke="#2f3b42" stroke-width="3" opacity="0.82" />`);
        }
      }
      if (accessories.guardRail) {
        const y1 = item.y + item.h * 0.58;
        const y2 = item.y + item.h * 0.68;
        lines.push(`<line class="guard-rail-line" x1="${item.x + inset}" y1="${y1}" x2="${item.x + item.w - inset}" y2="${y1}" stroke="#2f3b42" stroke-width="4" opacity="0.82" />`);
        lines.push(`<line class="guard-rail-line" x1="${item.x + inset}" y1="${y2}" x2="${item.x + item.w - inset}" y2="${y2}" stroke="#2f3b42" stroke-width="4" opacity="0.82" />`);
        lines.push(`<line class="guard-rail-line" x1="${item.x + item.w * 0.5}" y1="${y1 - 12}" x2="${item.x + item.w * 0.5}" y2="${y2 + 12}" stroke="#2f3b42" stroke-width="3" opacity="0.82" />`);
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
        return `<g class="opening-symbol">${openingDirectionSvgLabel(cell, centerX, topEdge + 14)}<path d="M${leftEdge} ${bottomEdge} L${centerX} ${topEdge} L${rightEdge} ${bottomEdge}" fill="none" stroke="#20383e" stroke-width="2" ${dash} /></g>`;
      }
      if (cell.type === "bottom_hung") {
        const dash = opening.endsWith("out") ? "" : "stroke-dasharray='7 5'";
        return `<g class="opening-symbol">${openingDirectionSvgLabel(cell, centerX, bottomEdge - 8)}<path d="M${leftEdge} ${topEdge} L${centerX} ${bottomEdge} L${rightEdge} ${topEdge}" fill="none" stroke="#20383e" stroke-width="2" ${dash} /></g>`;
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
          const panelCell = {
            ...cell,
            opening: `${panel.hingeSide}_${assembly.openPlane}`,
            openingAssembly: { ...assembly, panelCount: 1 }
          };
          return `<g class="opening-symbol">${openingDirectionSvgLabel(panelCell, (panelLeft + panelRight) / 2, topEdge + 14)}<path d="M${x1} ${topEdge} L${x2} ${bottomEdge} L${x1} ${bottomEdge} Z" fill="none" stroke="#20383e" stroke-width="2" ${dash} /></g>`;
        }).join("");
      }
      const left = opening?.startsWith("left");
      const out = opening?.endsWith("out");
      const hingeX = left ? item.x + inset : item.x + item.w - inset;
      const openX = left ? item.x + item.w - inset : item.x + inset;
      const hingeY = item.y + item.h / 2;
      const dash = out ? "" : "stroke-dasharray='7 5'";
      return `<g class="opening-symbol">${openingDirectionSvgLabel(cell, (hingeX + openX) / 2, topEdge + 14)}<path d="M${hingeX} ${hingeY} L${openX} ${topEdge} M${hingeX} ${hingeY} L${openX} ${bottomEdge}" fill="none" stroke="#20383e" stroke-width="2" ${dash} /></g>`;
    }

    function dimensionLine(x1, y1, x2, y2, label, vertical = false, editTarget = "") {
      const editable = editTarget
        ? ` class="editable-dimension" data-dimension-edit="${escapeHtml(editTarget)}" tabindex="0" role="button" aria-label="双击修改${escapeHtml(label)}"`
        : "";
      const hitLine = editTarget ? `<line class="dimension-hit" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />` : "";
      if (vertical) {
        const mid = (y1 + y2) / 2;
        return `<g${editable}>${hitLine}<line class="dimension" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" /><line class="dimension" x1="${x1 - 7}" y1="${y1}" x2="${x1 + 7}" y2="${y1}" /><line class="dimension" x1="${x1 - 7}" y1="${y2}" x2="${x1 + 7}" y2="${y2}" /><text class="dimension-text" transform="translate(${x1 - 18} ${mid}) rotate(-90)">${escapeHtml(label)}</text></g>`;
      }
      const mid = (x1 + x2) / 2;
      return `<g${editable}>${hitLine}<line class="dimension" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" /><line class="dimension" x1="${x1}" y1="${y1 - 7}" x2="${x1}" y2="${y1 + 7}" /><line class="dimension" x1="${x2}" y1="${y2 - 7}" x2="${x2}" y2="${y2 + 7}" /><text class="dimension-text" x="${mid}" y="${y1 + 18}">${escapeHtml(label)}</text></g>`;
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
      setChecked("previewShowDimensions", project.viewOptions?.show3dDimensions !== false);
      setChecked("previewShowMarkups", project.viewOptions?.show3dMarkups !== false);
      setChecked("previewShowOrientation", project.viewOptions?.show3dOrientation !== false);
      const projectAssembly = drawingMode === "assembly" ? currentProjectAssembly() : null;
      if (projectAssembly) {
        const summary = assemblySummary(projectAssembly, project.windows);
        if (title) title.textContent = "3D拼接预览";
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
          const model = buildThreeWindowModel(item.window, scale, false, item.window.windowId === assembly.rootWindowId);
          model.position.set(item.xMm * scale, (item.yMm - floorDatumMm) * scale, item.zMm * scale);
          model.rotation.y = item.rotationDeg * Math.PI / 180;
          root.add(model);
        });
      } else {
        const scale = 2.55 / Math.max(win.widthMm, win.heightMm);
        const model = buildThreeWindowModel(win, scale, false, true);
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
      if (project.viewOptions?.show3dDimensions !== false) {
        addThreeDimensionGuides(model, win, width, height, depth);
      }
      if (showOrientationLabels && project.viewOptions?.show3dOrientation !== false) {
        addThreeOrientationLabels(model, -width / 2, width, -height / 2, depth, 0, cornerMount);
      }

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
            w: Math.max(0.02, right - left - face * 0.03),
            h: Math.max(0.02, top - bottom - face * 0.03),
            modelScale: scale,
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
        const legA = Math.max(1, joint.legWidthAMm) * scale;
        const legB = Math.max(1, joint.legWidthBMm) * scale;
        const thickness = Math.max(0.012, face * 0.16);
        if (joint.postMode === "postless") {
          addBox(group, 0, 0, 0, vertical ? thickness : length, vertical ? length : thickness, depth * 0.3, mats.jointSeal);
        } else if (joint.type === "splice") {
          if (vertical) group.position.x = side * (width / 2 + legA / 2);
          else group.position.y = -side * (height / 2 + legA / 2);
          group.position.z = 0;
          addBox(group, 0, 0, 0, vertical ? legA : length, vertical ? length : legA, legB, mats.joint);
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

    function addThreePanelInfill(parent, cell, rect, mats, options = {}) {
      const mode = normalizePanelMode(cell?.panelMode);
      const width = rect.w * (options.widthRatio ?? 0.92);
      const height = rect.h * (options.heightRatio ?? 0.92);
      const depth = options.depth ?? rect.depth * 0.25;
      const z = options.z ?? 0.035;
      if (mode !== "double") {
        addBox(parent, rect.x, rect.y, z, width, height, depth, mats.panel);
        return;
      }
      const gap = Math.max(rect.face * 0.16, width * 0.035);
      const leafWidth = Math.max(0.02, (width - gap) / 2);
      addBox(parent, rect.x - (leafWidth + gap) / 2, rect.y, z, leafWidth, height, depth, mats.panel);
      addBox(parent, rect.x + (leafWidth + gap) / 2, rect.y, z, leafWidth, height, depth, mats.panel);
      addBox(parent, rect.x, rect.y, z + depth * 0.55, rect.face * 0.08, height, depth * 0.28, mats.hardwareDark);
    }

    function createThreeTextPlane(text, color = "#145da0", height = 0.13) {
      const THREE = threeLib;
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 128;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "rgba(255,255,255,0.92)";
      context.fillRect(3, 3, canvas.width - 6, canvas.height - 6);
      context.strokeStyle = color;
      context.lineWidth = 5;
      context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
      context.fillStyle = color;
      context.font = '700 46px "Microsoft YaHei", sans-serif';
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(text || ""), canvas.width / 2, canvas.height / 2 + 2);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(height * 4, height), material);
      plane.renderOrder = 18;
      return plane;
    }

    function addThreeDimensionGuides(parent, win, width, height, depth) {
      const material = new threeLib.MeshBasicMaterial({ color: 0x7aa3c3, depthTest: false, transparent: true, opacity: 0.92 });
      const line = Math.max(0.006, Math.min(width, height) * 0.0025);
      const z = depth / 2 + 0.1;
      const topY = height / 2 + 0.18;
      const rightX = width / 2 + 0.18;
      addBox(parent, 0, topY, z, width, line, line, material);
      addBox(parent, -width / 2, topY, z, line, 0.1, line, material);
      addBox(parent, width / 2, topY, z, line, 0.1, line, material);
      addBox(parent, rightX, 0, z, line, height, line, material);
      addBox(parent, rightX, -height / 2, z, 0.1, line, line, material);
      addBox(parent, rightX, height / 2, z, 0.1, line, line, material);
      const widthLabel = createThreeTextPlane(`${Math.round(win.widthMm)} mm`);
      widthLabel.position.set(0, topY + 0.09, z);
      parent.add(widthLabel);
      const heightLabel = createThreeTextPlane(`${Math.round(win.heightMm)} mm`);
      heightLabel.position.set(rightX + 0.09, 0, z);
      heightLabel.rotation.z = Math.PI / 2;
      parent.add(heightLabel);
    }

    function addThreeCellHostedObjects(parent, cell, rect, mats, options = {}) {
      const THREE = threeLib;
      const markups = options.markups || normalizeCellMarkups(cell?.markups);
      if (!markups.length) return;
      const scale = Math.max(0.0001, Number(rect.modelScale || 0.001));
      const z = options.localMount ? Math.max(0.035, rect.depth * 0.42) : rect.depth / 2 + 0.045;
      markups.forEach(markup => {
        const worldX = rect.x - rect.w / 2 + rect.w * markup.xPercent / 100;
        const worldY = rect.y + rect.h / 2 - rect.h * markup.yPercent / 100;
        const x = worldX - Number(options.originX || 0);
        const y = worldY - Number(options.originY || 0);
        const size = Math.max(0.028, markup.sizeMm * scale);
        if (markup.kind === "text") {
          const label = createThreeTextPlane(markup.text || "文字标注", "#075bbd", Math.max(0.1, Math.min(0.2, rect.h * 0.09)));
          label.position.set(x, y, z + 0.012);
          label.userData.mountType = "cell-text-annotation";
          parent.add(label);
          return;
        }
        if (markup.kind === "lock") {
          const lock = addBox(parent, x, y, z, size * 0.45, size, Math.max(0.018, rect.depth * 0.18), mats.hardware);
          lock.userData.mountType = "cell-lock";
          const handle = addBox(parent, x + size * 0.28, y, z + 0.018, size * 0.58, size * 0.1, Math.max(0.018, rect.depth * 0.12), mats.hardwareDark);
          handle.userData.mountType = "cell-lock-handle";
          return;
        }
        const cutMaterial = new THREE.MeshBasicMaterial({ color: 0x263238, side: THREE.DoubleSide });
        if (markup.kind === "circle_hole") {
          const hole = new THREE.Mesh(new THREE.CircleGeometry(size / 2, 32), cutMaterial);
          hole.position.set(x, y, z);
          hole.userData.mountType = "hosted-circle-hole";
          parent.add(hole);
          const ring = new THREE.Mesh(new THREE.RingGeometry(size * 0.46, size * 0.56, 32), mats.hardwareDark);
          ring.position.set(x, y, z + 0.006);
          ring.userData.mountType = "hosted-circle-hole-ring";
          parent.add(ring);
          return;
        }
        const hole = addBox(parent, x, y, z, size, size, Math.max(0.012, rect.depth * 0.08), cutMaterial);
        hole.userData.mountType = "hosted-square-hole";
      });
    }

    function addFixedVerticalHingePlates(parent, x, centerY, height, face, depth, material) {
      for (const y of [centerY - height * 0.31, centerY + height * 0.31]) {
        const frameLeaf = addBox(parent, x, y, depth * 0.08, Math.max(0.018, face * 0.12), Math.max(0.06, face * 0.62), Math.max(0.026, depth * 0.3), material);
        frameLeaf.userData.mountType = "fixed-frame-hinge-leaf";
      }
    }

    function addFixedHorizontalHingePlates(parent, centerX, y, width, face, depth, material) {
      for (const x of [centerX - width * 0.31, centerX + width * 0.31]) {
        const frameLeaf = addBox(parent, x, y, depth * 0.08, Math.max(0.06, face * 0.62), Math.max(0.018, face * 0.12), Math.max(0.026, depth * 0.3), material);
        frameLeaf.userData.mountType = "fixed-frame-hinge-leaf";
      }
    }

    function threeOperablePocket(rect) {
      const inset = Math.max(rect.face * 0.22, rect.depth * 0.12);
      const width = Math.max(0.04, rect.w - inset * 2);
      const height = Math.max(0.04, rect.h - inset * 2);
      return {
        x: rect.x,
        y: rect.y,
        z: 0,
        w: width,
        h: height,
        inset,
        face: Math.max(rect.face * 0.28, Math.min(width, height) * 0.032),
        depth: Math.max(0.028, rect.depth * 0.42)
      };
    }

    function addThreeFrameRebate(parent, rect, mats) {
      const pocket = threeOperablePocket(rect);
      const stopFace = Math.max(0.008, rect.face * 0.09);
      const stopDepth = Math.max(0.014, rect.depth * 0.16);
      const stopZ = -rect.depth * 0.32;
      const outerW = Math.max(0.02, rect.w - pocket.inset * 1.3);
      const outerH = Math.max(0.02, rect.h - pocket.inset * 1.3);
      addBox(parent, rect.x, rect.y + outerH / 2, stopZ, outerW, stopFace, stopDepth, mats.hardwareDark).userData.mountType = "frame-rebate-stop";
      addBox(parent, rect.x, rect.y - outerH / 2, stopZ, outerW, stopFace, stopDepth, mats.hardwareDark).userData.mountType = "frame-rebate-stop";
      addBox(parent, rect.x - outerW / 2, rect.y, stopZ, stopFace, outerH, stopDepth, mats.hardwareDark).userData.mountType = "frame-rebate-stop";
      addBox(parent, rect.x + outerW / 2, rect.y, stopZ, stopFace, outerH, stopDepth, mats.hardwareDark).userData.mountType = "frame-rebate-stop";
      return pocket;
    }

    function mountThreeCellHostedObjects(parent, cell, rect, mats, meta) {
      const markups = normalizeCellMarkups(cell?.markups);
      if (!markups.length) return;
      const openables = isOperableType(cell.type)
        ? preview3d.openables.filter(part => part.windowId === meta?.windowId && part.row === meta?.row && part.col === meta?.col)
        : [];
      const fixed = [];
      markups.forEach(markup => {
        const worldX = rect.x - rect.w / 2 + rect.w * markup.xPercent / 100;
        const worldY = rect.y + rect.h / 2 - rect.h * markup.yPercent / 100;
        const support = openables.find(part => {
          const center = part.hostBounds || part.closedPanelCenter || part.closedPosition || part.object?.position;
          return center && Math.abs(worldX - center.x) <= Number(part.width || rect.w) / 2 && Math.abs(worldY - center.y) <= Number(part.height || rect.h) / 2;
        }) || null;
        if (!support?.object) {
          fixed.push(markup);
          return;
        }
        const center = support.localMountOrigin || support.closedPosition || support.object.position;
        addThreeCellHostedObjects(support.object, cell, rect, mats, {
          markups: [markup],
          localMount: true,
          originX: center.x,
          originY: center.y
        });
      });
      if (fixed.length) addThreeCellHostedObjects(parent, cell, rect, mats, { markups: fixed });
    }

    function addThreeCell(parent, cell, rect, mats, meta) {
      if (!cell || cell.type === "empty") return;
      const assembly = normalizeOpeningAssembly(cell.type, cell.opening, cell.openingAssembly);
      const infillType = normalizeCellInfillType(cell.infillType);
      if (!isOperableType(cell.type) && infillType === "panel") {
        addThreePanelInfill(parent, cell, rect, mats);
        addThreeCellOverlays(parent, cell, rect, mats, assembly, meta);
        return;
      }
      if (!isOperableType(cell.type) && infillType === "louver") {
        addThreeLouvers(parent, rect, mats);
        addThreeCellOverlays(parent, cell, rect, mats, assembly, meta);
        return;
      }
      if (cell.customShape && isOperableType(cell.type)) {
        addThreeCustomOperableCell(parent, cell, rect, mats, meta, assembly);
        addIntegratedScreen(parent, cell, rect, mats, meta);
        addThreeCellOverlays(parent, cell, rect, mats, assembly, meta);
        return;
      }
      if (cell.customShape) addThreeCustomCellGeometry(parent, cell, rect, mats);
      if (cell.type === "panel") {
        addThreePanelInfill(parent, cell, rect, mats);
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
        const topHinged = cell.type === "top_hung";
        const pocket = addThreeFrameRebate(parent, rect, mats);
        const sashWidth = pocket.w;
        const sashHeight = pocket.h;
        const hingeY = pocket.y + (topHinged ? 1 : -1) * sashHeight / 2;
        const hingeRoot = new threeLib.Group();
        hingeRoot.position.set(pocket.x, hingeY, pocket.z);
        hingeRoot.userData.mountType = "horizontal-hinged-mechanism";
        const sash = new threeLib.Group();
        sash.position.set(0, pocket.y - hingeY, 0);
        addSashFrame(sash, 0, 0, sashWidth, sashHeight, pocket.face, pocket.depth, mats.profile);
        addPane(sash, 0, 0, 0.012, Math.max(0.02, sashWidth - pocket.face * 2.35), Math.max(0.02, sashHeight - pocket.face * 2.35), mats.glass);
        const handleY = (topHinged ? -1 : 1) * sashHeight * 0.34;
        addHorizontalHandle(sash, 0, handleY, pocket.depth / 2 + rect.depth * 0.08, rect.face, mats.hardware);
        addHorizontalHinges(sash, (topHinged ? 1 : -1) * sashHeight * 0.46, sashWidth, rect.face, rect.depth, mats.hardwareDark);
        hingeRoot.add(sash);
        parent.add(hingeRoot);
        addFixedHorizontalHingePlates(parent, rect.x, hingeY, sashWidth, rect.face, rect.depth, mats.hardwareDark);
        registerOpenable({
          cell,
          key: `${meta.windowId}:${meta.row}:${meta.col}:P1`,
          windowId: meta.windowId,
          windowMark: meta.windowMark,
          row: meta.row,
          col: meta.col,
          object: hingeRoot,
          type: cell.type,
          panelLabel: assembly.panels[0]?.label || "开启扇",
          operationOrder: 0,
          width: sashWidth,
          height: sashHeight,
          closedPosition: hingeRoot.position.clone(),
          closedPanelCenter: new threeLib.Vector3(pocket.x, pocket.y, pocket.z),
          localMountOrigin: hingeRoot.position.clone(),
          hingeAxis: "horizontal",
          motionMode: "primary",
          current: 0,
          target: 0
        });
        addIntegratedScreen(parent, cell, rect, mats, meta);
        addThreeCellOverlays(parent, cell, rect, mats, assembly, meta);
        return;
      }
      if (cell.type === "turn" || cell.type === "turn_tilt" || cell.type === "door") {
        addSideHungAssembly(parent, cell, rect, mats, meta, assembly);
        addIntegratedScreen(parent, cell, rect, mats, meta);
        addThreeCellOverlays(parent, cell, rect, mats, assembly, meta);
        return;
      }
      if (["sliding", "lift_slide", "psk", "parallel_slide", "pocket_slide"].includes(cell.type)) {
        addSlidingAssembly(parent, cell, rect, mats, meta, assembly);
        addIntegratedScreen(parent, cell, rect, mats, meta);
        addThreeCellOverlays(parent, cell, rect, mats, assembly, meta);
        return;
      }
      if (cell.type === "parallel_project") {
        addParallelProjectCell(parent, cell, rect, mats, meta, assembly);
        addIntegratedScreen(parent, cell, rect, mats, meta);
        addThreeCellOverlays(parent, cell, rect, mats, assembly, meta);
        return;
      }
      if (cell.type === "corner_slide") {
        addCornerSlidingAssembly(parent, cell, rect, mats, meta, assembly);
        addIntegratedScreen(parent, cell, rect, mats, meta);
        addThreeCellOverlays(parent, cell, rect, mats, assembly, meta);
        return;
      }
      if (cell.type === "vertical_slide") {
        addVerticalSlidingAssembly(parent, cell, rect, mats, meta, assembly);
        addIntegratedScreen(parent, cell, rect, mats, meta);
        addThreeCellOverlays(parent, cell, rect, mats, assembly, meta);
        return;
      }
      if (cell.type === "folding") {
        addFoldingCell(parent, cell, rect, mats, meta, assembly);
        addIntegratedScreen(parent, cell, rect, mats, meta);
        addThreeCellOverlays(parent, cell, rect, mats, assembly, meta);
        return;
      }
      if (!cell.customShape) addPane(parent, rect.x, rect.y, 0.02, rect.w * 0.9, rect.h * 0.9, mats.glass);
      addThreeCellOverlays(parent, cell, rect, mats, assembly, meta);
    }

    function addThreeLouvers(parent, rect, mats) {
      const count = Math.max(4, Math.min(9, Math.floor(rect.h / 0.15)));
      for (let i = 1; i <= count; i += 1) {
        const y = rect.y - rect.h / 2 + rect.h * i / (count + 1);
        const slat = addBox(parent, rect.x, y, 0.07, rect.w * 0.82, rect.face * 0.22, rect.depth * 0.3, mats.profile);
        slat.rotation.x = -0.22;
      }
    }

    function addThreeCellOverlays(parent, cell, rect, mats, assembly, meta) {
      const accessories = normalizeCellAccessories(cell.accessories);
      const infillType = normalizeCellInfillType(cell.infillType);
      if (isOperableType(cell.type) && infillType === "panel") {
        addThreePanelInfill(parent, cell, rect, mats, { z: 0.092, widthRatio: 0.68, heightRatio: 0.68, depth: rect.depth * 0.12 });
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
      if (project.viewOptions?.show3dMarkups !== false) {
        mountThreeCellHostedObjects(parent, cell, rect, mats, meta);
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
      const pocket = addThreeFrameRebate(parent, rect, mats);
      const sashWidth = pocket.w;
      const sashHeight = pocket.h;
      const sideHinged = ["turn", "turn_tilt", "door"].includes(cell.type);
      const horizontalHinged = cell.type === "top_hung" || cell.type === "bottom_hung";
      let sash = new threeLib.Group();
      let openableObject = sash;
      let closedPosition;
      let closedPanelCenter = new threeLib.Vector3(pocket.x, pocket.y, pocket.z);
      let localMountOrigin = closedPanelCenter.clone();
      let hingeAxis = "";
      const leftOpening = cell.opening?.startsWith("left") || cell.opening?.endsWith("left");
      if (sideHinged) {
        const hingeX = pocket.x + (leftOpening ? -1 : 1) * sashWidth / 2;
        const hingeRoot = new threeLib.Group();
        hingeRoot.position.set(hingeX, pocket.y, pocket.z);
        hingeRoot.userData.mountType = "side-hinged-mechanism";
        sash.position.set(pocket.x - hingeX, 0, 0);
        hingeRoot.add(sash);
        parent.add(hingeRoot);
        addFixedVerticalHingePlates(parent, hingeX, pocket.y, sashHeight, rect.face, rect.depth, mats.hardwareDark);
        openableObject = hingeRoot;
        closedPosition = hingeRoot.position.clone();
        localMountOrigin = hingeRoot.position.clone();
        hingeAxis = "side";
      } else if (horizontalHinged) {
        const topHinged = cell.type === "top_hung";
        const hingeY = pocket.y + (topHinged ? 1 : -1) * sashHeight / 2;
        const hingeRoot = new threeLib.Group();
        hingeRoot.position.set(pocket.x, hingeY, pocket.z);
        hingeRoot.userData.mountType = "horizontal-hinged-mechanism";
        sash.position.set(0, pocket.y - hingeY, 0);
        hingeRoot.add(sash);
        parent.add(hingeRoot);
        addFixedHorizontalHingePlates(parent, pocket.x, hingeY, sashWidth, rect.face, rect.depth, mats.hardwareDark);
        openableObject = hingeRoot;
        closedPosition = hingeRoot.position.clone();
        localMountOrigin = hingeRoot.position.clone();
        hingeAxis = "horizontal";
      } else {
        sash.position.set(pocket.x, pocket.y, pocket.z);
        parent.add(sash);
        closedPosition = sash.position.clone();
      }
      addThreeCustomShapeBody(sash, shapeData, sashWidth, sashHeight, pocket.face, pocket.depth, mats);
      if (sideHinged) {
        addHandle(sash, (leftOpening ? 1 : -1) * sashWidth * 0.34, 0, pocket.depth / 2 + rect.depth * 0.08, rect.face, mats.hardware);
        addHinges(sash, (leftOpening ? -1 : 1) * sashWidth * 0.46, sashHeight, rect.face, rect.depth, mats.hardwareDark);
      } else if (horizontalHinged) {
        const topHinged = cell.type === "top_hung";
        addHorizontalHandle(sash, 0, (topHinged ? -1 : 1) * sashHeight * 0.34, pocket.depth / 2 + rect.depth * 0.08, rect.face, mats.hardware);
        addHorizontalHinges(sash, (topHinged ? 1 : -1) * sashHeight * 0.46, sashWidth, rect.face, rect.depth, mats.hardwareDark);
      } else {
        addHandle(sash, sashWidth * 0.34, 0, rect.depth * 0.48, rect.face, mats.hardware);
      }
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
        object: openableObject,
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
        closedPosition,
        closedPanelCenter,
        localMountOrigin,
        ...(hingeAxis ? { hingeAxis } : {}),
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
      const pocket = addThreeFrameRebate(parent, rect, mats);
      const totalWidth = pocket.w;
      const gap = panelCount > 1 && assembly.mullionMode === "fixed_mullion" ? rect.face * 0.16 : rect.face * 0.03;
      const sashWidth = (totalWidth - gap * (panelCount - 1)) / panelCount;
      const sashHeight = pocket.h;
      assembly.panels.forEach((panel, index) => {
        const x = pocket.x - totalWidth / 2 + sashWidth / 2 + index * (sashWidth + gap);
        const panelOpening = `${panel.hingeSide}_${assembly.openPlane}`;
        const panelCell = { ...cell, opening: panelOpening };
        const left = panel.hingeSide === "left";
        const hingeX = x + (left ? -1 : 1) * sashWidth / 2;
        const hingeRoot = new threeLib.Group();
        hingeRoot.position.set(hingeX, pocket.y, pocket.z);
        hingeRoot.userData.mountType = "side-hinged-mechanism";
        const sash = new threeLib.Group();
        sash.position.set(x - hingeX, 0, 0);
        addSashFrame(sash, 0, 0, sashWidth, sashHeight, pocket.face, pocket.depth, mats.profile);
        if (cell.type === "door") {
          addBox(sash, 0, -sashHeight * 0.08, 0.01, Math.max(0.02, sashWidth - pocket.face * 2.25), sashHeight * 0.56, rect.depth * 0.12, mats.door);
        } else {
          addPane(sash, 0, 0, 0.012, Math.max(0.02, sashWidth - pocket.face * 2.35), Math.max(0.02, sashHeight - pocket.face * 2.35), mats.glass);
        }
        addHandle(sash, (left ? 1 : -1) * sashWidth * 0.34, 0, pocket.depth / 2 + rect.depth * 0.08, rect.face, mats.hardware);
        addHinges(sash, (left ? -1 : 1) * sashWidth * 0.46, sashHeight, rect.face, rect.depth, mats.hardwareDark);
        hingeRoot.add(sash);
        parent.add(hingeRoot);
        addFixedVerticalHingePlates(parent, hingeX, pocket.y, sashHeight, rect.face, rect.depth, mats.hardwareDark);
        if (!panel.movable) return;
        registerOpenable({
          cell: panelCell,
          key: `${meta.windowId}:${meta.row}:${meta.col}:${panel.id}`,
          windowId: meta.windowId,
          windowMark: meta.windowMark,
          row: meta.row,
          col: meta.col,
          object: hingeRoot,
          type: cell.type,
          panelLabel: `${panel.label} · ${panel.role === "primary" ? "主扇" : "从扇"}`,
          operationOrder: panel.operationOrder,
          width: sashWidth,
          height: sashHeight,
          closedPosition: hingeRoot.position.clone(),
          closedPanelCenter: new threeLib.Vector3(x, pocket.y, pocket.z),
          localMountOrigin: hingeRoot.position.clone(),
          hingeAxis: "side",
          motionMode: cell.type === "turn_tilt" && assembly.operationPriority === "tilt_first" ? "tilt" : "primary",
          current: 0,
          target: 0
        });
      });
    }

    function addSlidingAssembly(parent, cell, rect, mats, meta, assembly) {
      const totalWidth = rect.w * 0.985;
      const panelWidth = totalWidth / assembly.panelCount * 1.06;
      const panelHeight = rect.h * 0.965;
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
      const sashWidth = rect.w * 0.985;
      const sashHeight = rect.h * 0.985;
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
      const wingSpan = rect.cornerMount?.frontWingSpan ?? rect.w * 0.985;
      const leftPanelWidth = wingSpan / Math.max(1, leftCount) * 1.04;
      const rightPanelWidth = wingSpan / Math.max(1, rightCount) * 1.04;
      const panelHeight = rect.h * 0.965;
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
      const panelWidth = rect.w * 0.965;
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
      const totalWidth = rect.w * 0.985;
      const panelWidth = totalWidth / panelCount;
      const panelHeight = rect.h * 0.965;
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
      const totalWidth = rect.w * 0.985;
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

    function ensurePreviewPartSelection() {
      const validKeys = new Set(preview3d.openables.map(part => part.key));
      preview3d.selectedPartKeys = new Set([...preview3d.selectedPartKeys].filter(key => validKeys.has(key)));
      if (!preview3d.selectedPartKeys.size && preview3d.openables.length) {
        preview3d.selectedPartKeys.add(preview3d.openables[0].key);
      }
      preview3d.selectedPartKey = preview3d.selectedPartKeys.has(preview3d.selectedPartKey)
        ? preview3d.selectedPartKey
        : ([...preview3d.selectedPartKeys][0] || "");
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
      ensurePreviewPartSelection();
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
      preview3d.selectionMode = "multiple";
      preview3d.selectedPartKey = preview3d.selectedPartKeys.has(preview3d.selectedPartKey)
        ? preview3d.selectedPartKey
        : ([...preview3d.selectedPartKeys][0] || "");
      hidePreviewContextMenu();
      updatePreviewPartOptions();
      updatePreviewSelection();
    }

    function updatePreviewDisplayOptions() {
      project.viewOptions ||= {};
      project.viewOptions.show3dDimensions = checkedOf("previewShowDimensions");
      project.viewOptions.show3dMarkups = checkedOf("previewShowMarkups");
      project.viewOptions.show3dOrientation = checkedOf("previewShowOrientation");
      previewNeedsRebuild = true;
      saveProject();
      renderThreePreview();
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
        hidePreviewContextMenu();
        return;
      }
      const modified = event.ctrlKey || event.metaKey || event.shiftKey;
      preview3d.selectionMode = "multiple";
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

    function objectTreeButton({ active = false, attrs = "", label = "", meta = "", caret = "▸" }) {
      return `<button class="object-tree-item ${active ? "active" : ""}" ${attrs} type="button">
        <span class="object-tree-caret">${escapeHtml(caret)}</span>
        <span class="object-tree-label">${label}</span>
        <span class="object-tree-meta">${meta}</span>
      </button>`;
    }

    function renderObjectTree() {
      const holder = document.getElementById("objectTree");
      if (!holder) return;
      const assembly = currentProjectAssembly();
      const canvasWindowIds = drawingMode === "assembly" && assembly?.placements?.length
        ? canvasWindowIdsForDesign(project, assembly.assemblyId)
        : canvasWindowIdsForDesign(project);
      const placementByWindowId = new Map((assembly?.placements || []).map(placement => [placement.windowId, placement]));
      const renderWindowNode = (win, options = {}) => {
        const cols = win.layout.columns.length;
        const cellRows = win.layout.cells.map((cell, index) => {
          const row = Math.floor(index / cols);
          const col = index % cols;
          const active = win.windowId === selectedWindowId
            && row === selectedCell.row
            && col === selectedCell.col
            && activeInspectorTab === "cell";
          const markups = normalizeCellMarkups(cell.markups);
          const markupRows = markups.map(markup => `
            <div class="object-tree-branch">${objectTreeButton({
              active: markup.markupId === selectedMarkupId,
              attrs: `data-object-markup="${escapeHtml(markup.markupId)}" data-object-markup-window="${escapeHtml(win.windowId)}" data-object-markup-row="${row}" data-object-markup-col="${col}"`,
              label: escapeHtml(markupToolLabel(markup.kind)),
              meta: markup.kind === "text" ? escapeHtml(markup.text || "文字标注") : `${Math.round(markup.sizeMm || 0)}mm`,
              caret: "•"
            })}</div>
          `).join("");
          return `
            <div class="object-tree-branch">
              ${objectTreeButton({
                active,
                attrs: `data-object-cell-window="${escapeHtml(win.windowId)}" data-object-cell-row="${row}" data-object-cell-col="${col}"`,
                label: `格 ${row + 1}-${col + 1} · ${escapeHtml(typeLabels[cell.type] || cell.type)}`,
                meta: markups.length ? `${markups.length}个附属对象` : "无附属对象",
                caret: markups.length ? "▾" : "•"
              })}
              ${markupRows ? `<div class="object-tree-children">${markupRows}</div>` : ""}
            </div>
          `;
        }).join("");
        const placement = placementByWindowId.get(win.windowId);
        const attrs = placement
          ? `data-object-placement="${escapeHtml(placement.placementId)}"`
          : `data-object-window="${escapeHtml(win.windowId)}"`;
        const activeWindow = placement
          ? placement.placementId === selectedPlacementId && !selectedJointId && !selectedMarkupId
          : win.windowId === selectedWindowId && !selectedJointId && !selectedPlacementId && !selectedMarkupId && activeInspectorTab !== "cell";
        return `
          <div class="object-tree-branch">
            ${objectTreeButton({
              active: activeWindow,
              attrs,
              label: `${escapeHtml(win.mark)} · ${escapeHtml(options.role || win.name || "门窗")}`,
              meta: options.meta || `${win.widthMm}×${win.heightMm}`,
              caret: "▾"
            })}
            <div class="object-tree-children">${cellRows}</div>
          </div>
        `;
      };
      const canvasWindows = (project.windows || []).filter(win => canvasWindowIds.has(win.windowId));
      const jointTree = (project.joints || []).filter(joint => (
        canvasWindowIds.has(joint.hostWindowId)
        && (joint.connectedWindowIds || []).some(id => canvasWindowIds.has(id))
      )).map((joint, index) => {
        const active = joint.jointId === selectedJointId;
        const connected = (joint.connectedWindowIds || []).map(id => project.windows.find(win => win.windowId === id)?.mark || id).join(" / ");
        return `
          <div class="object-tree-branch">${objectTreeButton({
            active,
            attrs: `data-object-joint="${escapeHtml(joint.jointId)}"`,
            label: `${escapeHtml(jointLabel(joint, index))} · ${joint.type === "corner" ? "转角料" : "拼接料"}`,
            meta: escapeHtml(connected || joint.hostEdge),
            caret: "•"
          })}</div>
        `;
      }).join("");
      const assemblyTree = assembly?.placements?.length ? `
        <div class="object-tree-branch">
          ${objectTreeButton({
            active: activeInspectorTab === "assembly" && !selectedPlacementId && !selectedJointId && !selectedMarkupId,
            attrs: `data-object-assembly="${escapeHtml(assembly.assemblyId)}"`,
            label: escapeHtml(assembly.name || "拼接总图"),
            meta: `${assembly.placements.length + 1}樘`,
            caret: "▾"
          })}
          <div class="object-tree-children">
            ${canvasWindows.map(win => {
              const placement = placementByWindowId.get(win.windowId);
              const role = win.windowId === assembly.rootWindowId ? (win.name || "门窗") : dockLabel(placement?.dock || "free");
              const meta = placement ? (placement.jointId ? "连接点" : "自由") : `${win.widthMm}×${win.heightMm}`;
              return renderWindowNode(win, { role, meta });
            }).join("")}
            ${jointTree ? `
              <div class="object-tree-branch">
                ${objectTreeButton({ label: "连接节点", meta: `${project.joints.length}个`, caret: "▾" })}
                <div class="object-tree-children">${jointTree}</div>
              </div>
            ` : ""}
          </div>
        </div>
      ` : "";
      const singleWindowTree = !assemblyTree && canvasWindows[0] ? renderWindowNode(canvasWindows[0]) : "";
      holder.innerHTML = `${assemblyTree}${singleWindowTree}` || `<div class="empty-state">暂无对象</div>`;
      holder.setAttribute("role", "tree");
      holder.querySelectorAll(".object-tree-branch").forEach(branch => {
        const button = branch.querySelector(":scope > .object-tree-item");
        const children = branch.querySelector(":scope > .object-tree-children");
        if (!button) return;
        button.setAttribute("role", "treeitem");
        button.setAttribute("aria-selected", String(button.classList.contains("active")));
        if (!children) return;
        const key = JSON.stringify(button.dataset);
        branch.dataset.branchKey = key;
        children.setAttribute("role", "group");
        const collapsed = collapsedObjectBranches.has(key);
        branch.classList.toggle("collapsed", collapsed);
        button.setAttribute("aria-expanded", String(!collapsed));
        button.querySelector(".object-tree-caret").textContent = collapsed ? "▸" : "▾";
      });
    }

    function selectedObjectRows() {
      const markup = selectedMarkupId ? findCellMarkup(selectedMarkupId) : null;
      if (markup) {
        return {
          title: markup.markup.kind === "text" ? "文字标注" : markupToolLabel(markup.markup.kind),
          rows: [
            ["对象", markup.markup.markupId],
            ["所属窗", markup.win.mark],
            ["所属格", `${markup.row + 1}行 ${markup.col + 1}列`],
            ["宿主", markup.markup.hostCellId || markup.cell.cellId],
            ["内容/尺寸", markup.markup.kind === "text" ? markup.markup.text : `${Math.round(markup.markup.sizeMm)} mm`],
            ["位置", `${Math.round(markup.markup.xPercent)}%, ${Math.round(markup.markup.yPercent)}%`]
          ]
        };
      }
      const joint = currentJoint();
      if (joint) {
        const index = project.joints.findIndex(item => item.jointId === joint.jointId);
        return {
          title: `${jointLabel(joint, index)} · ${joint.type === "corner" ? "转角料" : "拼接料"}`,
          rows: [
            ["节点ID", joint.jointId],
            ["所在边", edgeLabel(joint.hostEdge)],
            ["安装方向", joint.orientation === "reversed" ? "反装" : "正装"],
            ["角度", joint.type === "corner" ? `${Math.round(joint.angleDeg || 90)}°` : "-"],
            ["截面", `${Math.round(joint.legWidthAMm)} × ${Math.round(joint.legWidthBMm)} mm`],
            ["型材", joint.profileId || "-"]
          ]
        };
      }
      const assembly = currentProjectAssembly();
      const placement = currentPlacement();
      if (placement && assembly) {
        const win = project.windows.find(item => item.windowId === placement.windowId);
        return {
          title: `${win?.mark || placement.windowId} · 拼接位置`,
          rows: [
            ["窗体", win?.name || "-"],
            ["位置", dockLabel(placement.dock)],
            ["连接节点", placement.jointId || "-"],
            ["缝隙", `${Math.round(placement.gapMm || 0)} mm`],
            ["旋转", `${Math.round(placement.rotationDeg || 0)}°`],
            ["备注", placement.note || "-"]
          ]
        };
      }
      const win = currentWindow();
      const cell = currentCell(win);
      if (win && cell && activeInspectorTab === "cell") {
        return {
          title: `格 ${selectedCell.row + 1}-${selectedCell.col + 1} · ${typeLabels[cell.type] || cell.type}`,
          rows: [
            ["所属窗", win.mark],
            ["构件类型", typeLabels[cell.type] || cell.type],
            ["开启方向", openingLabel(cell.opening)],
            ["玻璃", cell.glassTypeId || win.defaultGlassTypeId || "-"],
            ["五金", cell.hardwareSetId || win.defaultHardwareSetId || "-"],
            ["标注/孔位", `${normalizeCellMarkups(cell.markups).length}个`]
          ]
        };
      }
      if (assembly && drawingMode === "assembly") {
        const summary = assemblySummary(assembly, project.windows);
        return {
          title: assembly.name || "拼接总图",
          rows: [
            ["窗体数量", `${summary.windowIds.length}樘`],
            ["总宽", `${Math.round(summary.overallWidthMm)} mm`],
            ["总高", `${Math.round(summary.overallHeightMm)} mm`],
            ["进深", `${Math.round(summary.overallDepthMm)} mm`],
            ["连接数", `${project.joints.length}个`]
          ]
        };
      }
      if (win) {
        return {
          title: `${win.mark} · ${win.name || "门窗"}`,
          rows: [
            ["窗号", win.mark],
            ["尺寸", `${win.widthMm} × ${win.heightMm} mm`],
            ["数量", `${win.quantity || 1}樘`],
            ["系列", currentSeries(win).name],
            ["格数", `${win.layout.columns.length}列 × ${win.layout.rows.length}行`],
            ["房间", win.room || "-"]
          ]
        };
      }
      return { title: "未选择对象", rows: [] };
    }

    function renderSelectedObjectProperties() {
      const holder = document.getElementById("selectedObjectProperties");
      if (!holder) return;
      const data = selectedObjectRows();
      holder.innerHTML = `
        <div class="selected-object-row"><span>当前对象</span><strong>${escapeHtml(data.title)}</strong></div>
        ${data.rows.map(([key, value]) => `
          <div class="selected-object-row"><span>${escapeHtml(key)}</span><strong>${escapeHtml(String(value ?? "-"))}</strong></div>
        `).join("")}
      `;
    }

    function handleObjectTreeClick(event) {
      const caret = event.target.closest(".object-tree-caret");
      const branch = caret?.closest(".object-tree-branch");
      if (branch?.dataset.branchKey) {
        const key = branch.dataset.branchKey;
        if (collapsedObjectBranches.has(key)) collapsedObjectBranches.delete(key);
        else collapsedObjectBranches.add(key);
        renderObjectTree();
        return;
      }
      const assemblyButton = event.target.closest("[data-object-assembly]");
      const placementButton = event.target.closest("[data-object-placement]");
      const jointButton = event.target.closest("[data-object-joint]");
      const markupButton = event.target.closest("[data-object-markup]");
      const cellButton = event.target.closest("[data-object-cell-window]");
      const windowButton = event.target.closest("[data-object-window]");
      if (assemblyButton) {
        selectedAssemblyId = assemblyButton.dataset.objectAssembly;
        selectedPlacementId = "";
        selectedMemberId = "";
        selectedJointId = "";
        selectedMarkupId = "";
        drawingMode = "assembly";
        switchInspector("assembly");
        render();
        return;
      }
      if (placementButton) {
        const assembly = currentProjectAssembly();
        const placement = assembly?.placements.find(item => item.placementId === placementButton.dataset.objectPlacement);
        if (!placement) return;
        selectedPlacementId = placement.placementId;
        selectedWindowId = placement.windowId;
        selectedMemberId = "";
        selectedJointId = "";
        selectedMarkupId = "";
        drawingMode = "assembly";
        switchInspector("assembly");
        render();
        return;
      }
      if (jointButton) {
        const joint = project.joints.find(item => item.jointId === jointButton.dataset.objectJoint);
        if (!joint) return;
        selectedJointId = joint.jointId;
        selectedWindowId = joint.hostWindowId;
        selectedMemberId = "";
        selectedPlacementId = "";
        selectedMarkupId = "";
        drawingMode = hasAssemblyScene() ? "assembly" : "window";
        switchInspector("joint");
        render();
        return;
      }
      if (markupButton) {
        selectedWindowId = markupButton.dataset.objectMarkupWindow;
        selectedMemberId = "";
        selectedJointId = "";
        selectedPlacementId = "";
        selectedMarkupId = markupButton.dataset.objectMarkup || "";
        selectedCell = {
          row: Number(markupButton.dataset.objectMarkupRow || 0),
          col: Number(markupButton.dataset.objectMarkupCol || 0)
        };
        if (hasAssemblyScene()) drawingMode = "assembly";
        switchInspector("cell");
        render();
        return;
      }
      if (cellButton) {
        selectedWindowId = cellButton.dataset.objectCellWindow;
        selectedMemberId = "";
        selectedJointId = "";
        selectedPlacementId = "";
        selectedMarkupId = "";
        selectedCell = {
          row: Number(cellButton.dataset.objectCellRow || 0),
          col: Number(cellButton.dataset.objectCellCol || 0)
        };
        if (hasAssemblyScene()) drawingMode = "assembly";
        switchInspector("cell");
        render();
        return;
      }
      if (windowButton) {
        selectedWindowId = windowButton.dataset.objectWindow;
        selectedMemberId = "";
        selectedJointId = "";
        selectedPlacementId = "";
        selectedMarkupId = "";
        selectedCell = { row: 0, col: 0 };
        if (hasAssemblyScene()) drawingMode = "assembly";
        switchInspector("window");
        render();
      }
    }

    function handleObjectTreeContextMenu(event) {
      const button = event.target.closest(".object-tree-item");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      // Selection rerenders the tree; retain the clicked object's attributes first.
      const data = { ...button.dataset };
      if (!Object.keys(data).length) return;
      handleObjectTreeClick({ target: button });
      hideCellContextMenu();
      hideJointContextMenu();
      hideAssemblyContextMenu();
      if (data.objectJoint) showJointContextMenu(event, data.objectJoint);
      else if (data.objectMarkup) showTreeMarkupMenu(event, data.objectMarkup);
      else if (data.objectCellWindow) showCellContextMenu(event, Number(data.objectCellRow), Number(data.objectCellCol));
      else showAssemblyContextMenu(event, selectedWindowId, selectedPlacementId);
    }

    function showTreeMarkupMenu(event, markupId) {
      document.getElementById("treeMarkupMenu")?.remove();
      const menu = document.createElement("div");
      menu.id = "treeMarkupMenu";
      menu.className = "object-menu";
      menu.setAttribute("role", "menu");
      [["编辑标注", () => openCanvasMarkupEditor(markupId, event)], ["删除标注", deleteWindow]].forEach(([label, action]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.setAttribute("role", "menuitem");
        button.addEventListener("click", () => { menu.remove(); action(); });
        menu.append(button);
      });
      document.body.append(menu);
      menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8))}px`;
      document.addEventListener("pointerdown", event => {
        if (!menu.contains(event.target)) menu.remove();
      }, { once: true });
    }

    function openProjectManager() {
      renderProjectManager();
      const dialog = document.getElementById("projectManagerDialog");
      if (dialog?.showModal && !dialog.open) dialog.showModal();
    }

    function closeProjectManager() {
      const dialog = document.getElementById("projectManagerDialog");
      if (dialog?.open) dialog.close();
    }

    function renderProjectManager() {
      const dialog = document.getElementById("projectManagerDialog");
      const summary = projectSummaryFor(project);
      const items = projectManagerRecords();
      if (!projectManagerSelectedId || !items.some(item => item.projectId === projectManagerSelectedId)) {
        projectManagerSelectedId = items[0]?.projectId || "";
      }
      const selectedRecord = projectManagerRecordById(projectManagerSelectedId, items);
      const selectedDesign = selectedRecord ? normalizeProject(structuredClone(selectedRecord.design)) : null;
      const currentName = document.getElementById("projectManagerCurrentName");
      const currentMeta = document.getElementById("projectManagerCurrentMeta");
      const stats = document.getElementById("projectManagerStats");
      if (currentName) currentName.textContent = `${summary.projectId} · ${summary.name}`;
      if (currentMeta) {
        currentMeta.textContent = `${summary.customerName} · ${summary.contactPhone} · ${projectStatusLabel(summary.status)} · ${summary.windowCount}樘窗型 · ${summary.assemblyCount}组拼接`;
      }
      if (stats) stats.textContent = `本机项目库 · ${items.length}个项目`;
      renderProjectProgressChain(selectedRecord);
      const list = document.getElementById("projectLibraryList");
      if (list) {
        list.innerHTML = items.map(item => `
          <article class="project-library-item ${item.projectId === projectManagerSelectedId ? "active" : ""}" data-preview-project="${escapeHtml(item.projectId)}" tabindex="0">
            <div class="project-library-main">
              <strong>${escapeHtml(item.projectId)} · ${escapeHtml(item.name || "未命名项目")}</strong>
              <span>${escapeHtml(item.customerName || "-")} · ${escapeHtml(item.contactPhone || "-")} · ${projectStatusLabel(item.status)} · ${escapeHtml(item.orderId || "-")}</span>
              <span>${item.windowCount || 0}樘窗型 · ${item.assemblyCount || 0}组拼接${item.isCurrent ? " · 当前项目" : ""}</span>
              <span>保存时间：${escapeHtml(formatDateTime(item.savedAt || item.updatedAt))}</span>
            </div>
            <div class="project-library-actions">
              <button class="project-card-edit" data-edit-project="${escapeHtml(item.projectId)}" type="button" aria-label="编辑项目">✎</button>
              <button data-open-project="${escapeHtml(item.projectId)}" type="button">打开项目</button>
              <button data-delete-project="${escapeHtml(item.projectId)}" class="danger" type="button">删除</button>
            </div>
          </article>
        `).join("");
        list.querySelectorAll("[data-preview-project]").forEach(card => {
          const preview = () => selectProjectManagerRecord(card.dataset.previewProject);
          card.addEventListener("click", event => {
            if (event.target.closest("button")) return;
            preview();
          });
          card.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              preview();
            }
          });
        });
        list.querySelectorAll("[data-edit-project]").forEach(button => {
          button.addEventListener("click", event => {
            event.stopPropagation();
            openProjectEditDialog(button.dataset.editProject);
          });
        });
        list.querySelectorAll("[data-open-project]").forEach(button => {
          button.addEventListener("click", event => {
            event.stopPropagation();
            loadProjectFromLibrary(button.dataset.openProject);
          });
        });
        list.querySelectorAll("[data-delete-project]").forEach(button => {
          button.addEventListener("click", event => {
            event.stopPropagation();
            deleteProjectFromLibrary(button.dataset.deleteProject);
          });
        });
      }
      renderProjectPreview(selectedRecord, selectedDesign);
      document.getElementById("projectLibraryEmpty")?.classList.toggle("hidden", items.length > 0);
      if (dialog?.open) dialog.returnValue = "";
    }

    function renderProjectProgressChain(record) {
      const holder = document.getElementById("projectProgressChain");
      if (!holder) return;
      const activeStatus = record?.status || "designing";
      holder.innerHTML = PROJECT_STATUS_OPTIONS.map(([value, label]) => `
        <button class="project-progress-node ${value === activeStatus ? "active" : ""}" data-project-progress="${value}" type="button">${label}</button>
      `).join("");
      holder.querySelectorAll("[data-project-progress]").forEach(button => {
        button.addEventListener("click", () => setProjectManagerStatus(button.dataset.projectProgress));
      });
    }

    function renderProjectPreview(record, design) {
      const name = document.getElementById("projectPreviewName");
      const meta = document.getElementById("projectPreviewMeta");
      const windows = document.getElementById("projectPreviewWindows");
      if (!record || !design) {
        if (name) name.textContent = "请选择项目";
        if (meta) meta.textContent = "单击左侧项目卡片预览，右下角“打开项目”才进入设计。";
        if (windows) windows.innerHTML = "";
        return;
      }
      const summary = projectSummaryFor(design);
      if (name) name.textContent = `${summary.projectId} · ${summary.name}`;
      if (meta) meta.textContent = `${summary.customerName} · ${summary.contactPhone} · ${projectStatusLabel(summary.status)} · ${summary.windowCount}樘窗型 · ${summary.assemblyCount}组拼接`;
      if (windows) {
        const canvasWindows = canvasWindowsForDesign(design);
        const assembly = (design.assemblies || []).find(item => item.placements?.length) || null;
        const assemblyData = assembly ? assemblySummary(assembly, design.windows) : null;
        windows.innerHTML = `
          <article class="project-preview-canvas">
            <strong>当前画布设计</strong>
            <span>${escapeHtml(assembly?.name || canvasWindows[0]?.name || "空画布")}</span>
            <div class="project-preview-canvas-grid">
              <span>对象数量<strong>${canvasWindows.length}樘</strong></span>
              <span>连接数量<strong>${assembly ? (assembly.placements || []).filter(item => item.jointId).length : 0}个</strong></span>
              <span>总宽<strong>${Math.round(assemblyData?.overallWidthMm || canvasWindows[0]?.widthMm || 0)} mm</strong></span>
              <span>总高<strong>${Math.round(assemblyData?.overallHeightMm || canvasWindows[0]?.heightMm || 0)} mm</strong></span>
            </div>
            <p>打开项目后只进入这一张当前画布；历史孤立窗型不再作为可编辑门窗显示。</p>
          </article>
        `;
      }
    }

    function setProjectManagerStatus(status) {
      const record = projectManagerRecordById(projectManagerSelectedId);
      if (!record) return;
      if (record.projectId === project.project.projectId) {
        project.project.status = status;
        renderInputs();
        markDirty();
        saveCurrentProjectToLibrary({ toast: false, validate: false });
      } else {
        const items = loadProjectLibrary();
        const index = items.findIndex(item => item.projectId === record.projectId);
        if (index >= 0) {
          const updatedDesign = normalizeProject(structuredClone(items[index].design));
          updatedDesign.project.status = status;
          items[index] = {
            ...projectSummaryFor(updatedDesign),
            savedAt: new Date().toISOString(),
            design: updatedDesign
          };
          saveProjectLibrary(items);
        }
      }
      projectManagerSelectedId = record.projectId;
      renderProjectManager();
    }

    function openSelectedProjectFromManager() {
      if (!projectManagerSelectedId) return;
      loadProjectFromLibrary(projectManagerSelectedId);
    }

    function openSelectedProjectMeasurement() {
      const record = projectManagerRecordById(projectManagerSelectedId);
      if (!record) return;
      openMeasurementDialog(record.design);
    }

    function formatDateTime(value) {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "-";
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    }

    function projectStatusLabel(value) {
      return {
        new: "新建",
        designing: "设计中",
        review: "待确认",
        confirmed: "已确认"
      }[value] || "设计中";
    }

    function smartTemplateKind(template) {
      const cells = normalizeLayout(template.window?.layout || {}).cells;
      const types = cells.map(cell => cell.type);
      if (types.some(type => ["sliding", "lift_slide", "psk", "parallel_slide", "pocket_slide", "corner_slide", "vertical_slide"].includes(type))) return "sliding";
      if (types.some(type => ["turn", "turn_tilt", "top_hung", "bottom_hung", "folding", "door"].includes(type))) return "casement";
      return "fixed";
    }

    function smartTemplateKindLabel(value) {
      return {
        fixed: "固定",
        casement: "平开",
        sliding: "推拉"
      }[value] || "全部";
    }

    function buildSmartTemplateCandidates(widthMm, heightMm) {
      const width = Math.max(300, Number(widthMm || currentWindow()?.widthMm || 1200));
      const height = Math.max(300, Number(heightMm || currentWindow()?.heightMm || 1500));
      const base = builtInTemplates;
      return base.map((template, index) => {
        const copy = structuredClone(template);
        const kind = smartTemplateKind(copy);
        copy.id = `smart-${index + 1}-${width}-${height}`;
        copy.name = `${template.name} · ${width}×${height}`;
        copy.description = `按洞口 ${width}×${height} mm 生成，可立即使用后继续编辑`;
        copy.source = "smart";
        copy.category = kind;
        copy.categoryLabel = smartTemplateKindLabel(kind);
        copy.passRate = Math.max(4.5, 25 - index * 2.3).toFixed(1);
        copy.singleStandard = Math.max(1.5, 16 - index * 1.4).toFixed(1);
        copy.controlRate = Math.max(1.5, 4.5 - index * 0.3).toFixed(1);
        copy.window = {
          ...copy.window,
          widthMm: width,
          heightMm: height
        };
        return copy;
      });
    }

    function currentSmartTemplates() {
      if (!smartTemplateCandidates.length) {
        smartTemplateCandidates = buildSmartTemplateCandidates(currentWindow()?.widthMm, currentWindow()?.heightMm);
      }
      return smartTemplateCandidates;
    }

    function filteredSmartTemplates() {
      const list = currentSmartTemplates();
      if (smartTemplateFilter === "all") return list;
      return list.filter(template => smartTemplateKind(template) === smartTemplateFilter);
    }

    function openSmartLibraryDialog() {
      const win = currentWindow();
      setValue("smartOpeningWidth", win?.widthMm || 3000);
      setValue("smartOpeningHeight", win?.heightMm || 2000);
      smartTemplateFilter = "all";
      if (!smartTemplateCandidates.length) {
        smartTemplateCandidates = buildSmartTemplateCandidates(valueOf("smartOpeningWidth"), valueOf("smartOpeningHeight"));
      }
      const dialog = document.getElementById("smartLibraryDialog");
      if (dialog?.showModal && !dialog.open) dialog.showModal();
      renderSmartLibraryDialog();
    }

    function closeSmartLibraryDialog() {
      const dialog = document.getElementById("smartLibraryDialog");
      if (dialog?.open) dialog.close();
    }

    function generateSmartTemplates() {
      const width = Number(valueOf("smartOpeningWidth") || currentWindow()?.widthMm || 1200);
      const height = Number(valueOf("smartOpeningHeight") || currentWindow()?.heightMm || 1500);
      smartTemplateCandidates = buildSmartTemplateCandidates(width, height);
      activeTemplateLibrary = "smart";
      smartTemplateFilter = "all";
      renderTemplates();
      renderSmartLibraryDialog();
      showToast("已按洞口尺寸生成智能窗型候选。");
    }

    function renderSmartLibraryDialog() {
      document.querySelectorAll("[data-smart-filter]").forEach(button => {
        button.classList.toggle("active", button.dataset.smartFilter === smartTemplateFilter);
      });
      const list = filteredSmartTemplates();
      const holder = document.getElementById("smartCandidateList");
      if (holder) {
        holder.innerHTML = list.map(tpl => `
          <article class="smart-candidate-card">
            <span class="template-thumb">${templateThumbnail(tpl)}</span>
            <strong>${escapeHtml(tpl.name)}</strong>
            <span>全国门窗合格率 ${escapeHtml(tpl.passRate || "0")}%
              <br />单标台 ${escapeHtml(tpl.singleStandard || "0")}% · 单标控台 ${escapeHtml(tpl.controlRate || "0")}%
              <br />${escapeHtml(tpl.categoryLabel || "")} · ${Math.round(tpl.window?.widthMm || 0)}×${Math.round(tpl.window?.heightMm || 0)} mm</span>
            <button data-smart-use-template="${escapeHtml(tpl.id)}" type="button">立即使用</button>
          </article>
        `).join("");
        holder.querySelectorAll("[data-smart-use-template]").forEach(button => {
          button.addEventListener("click", () => {
            const tpl = currentSmartTemplates().find(item => item.id === button.dataset.smartUseTemplate);
            if (tpl) {
              applyTemplate(tpl);
              closeSmartLibraryDialog();
            }
          });
        });
      }
      document.getElementById("smartCandidateEmpty")?.classList.toggle("hidden", list.length > 0);
      const pager = document.getElementById("smartPager");
      if (pager) {
        pager.innerHTML = `<span class="active">1</span><button type="button">2</button><button type="button">3</button><button type="button">4</button><button type="button">5</button><button type="button">›</button>`;
      }
    }

    function switchSmartTemplateFilter(filter) {
      smartTemplateFilter = ["all", "fixed", "casement", "sliding"].includes(filter) ? filter : "all";
      renderSmartLibraryDialog();
    }

    function renderTemplates() {
      const customTemplates = loadCustomWindowLibrary();
      const sourceList = activeTemplateLibrary === "custom" ? customTemplates : currentSmartTemplates();
      const keyword = templateSearchTerm.trim().toLowerCase();
      const list = sourceList.filter(tpl => {
        if (!keyword) return true;
        const text = `${tpl.name || ""} ${tpl.categoryLabel || ""} ${tpl.description || ""} ${tpl.window?.widthMm || ""} ${tpl.window?.heightMm || ""}`.toLowerCase();
        return text.includes(keyword);
      });
      document.getElementById("templateList").innerHTML = list.map(tpl => `
        <article class="template-item">
          <span class="template-thumb">${templateThumbnail(tpl)}</span>
          <strong>${escapeHtml(tpl.name)}</strong>
          <span>${escapeHtml(tpl.categoryLabel || "")}${tpl.categoryLabel ? " · " : ""}${escapeHtml(tpl.description || "")}</span>
          <button data-use-template="${escapeHtml(tpl.id)}" type="button">立即使用</button>
        </article>
      `).join("");
      document.querySelectorAll(".library-tab").forEach(button => {
        button.classList.toggle("active", button.dataset.templateSource === activeTemplateLibrary);
      });
      document.getElementById("smartLibraryPanel")?.classList.toggle("hidden", activeTemplateLibrary !== "smart");
      document.getElementById("customLibraryHint")?.classList.toggle("hidden", activeTemplateLibrary !== "custom");
      document.getElementById("btnClearCustom")?.classList.toggle("hidden", activeTemplateLibrary !== "custom");
      document.getElementById("templateEmpty")?.classList.toggle("hidden", list.length > 0);
      document.querySelectorAll("[data-use-template]").forEach(btn => {
        btn.addEventListener("click", () => {
          const tpl = sourceList.find(item => item.id === btn.dataset.useTemplate);
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
      document.getElementById("kpiWindows").textContent = String(visibleDesignWindows().reduce((n, w) => n + Number(w.quantity || 1), 0));
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
              connectionWorkflow: "joint_driven_auto_frame",
              interactionFlow: "canvas_edge_hotspots",
              autoCreateConnectedWindow: true,
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
      bindCanvasWheelZoom();
      ["projectId", "projectName", "customerName", "projectPhone", "projectStatus", "projectAddress", "orderId", "batchNo"].forEach(id => {
        bindById(id, "change", updateProjectFromInputs);
      });
      ["winMark", "winQty", "winWidth", "winHeight", "sillHeight", "winFloor", "winRoom", "winShape", "archHeight", "shapePoints"].forEach(id => {
        bindById(id, "change", updateWindowFromInputs);
      });
      ["saveInstallLocation", "saveSeriesId", "saveGlassTypeId", "saveColor", "saveOpeningMode", "saveUnitPrice", "saveWindowNote"].forEach(id => {
        bindById(id, "change", updateWindowSaveInfoFromInputs);
      });
      bindById("saveUnitPrice", "input", () => updateWindowSaveTotals());
      ["seriesId", "colorInside", "colorOutside", "glassTypeId", "hardwareSetId"].forEach(id => {
        bindById(id, "change", updateProductFromInputs);
      });
      ["cellType", "opening", "cellGlass", "cellHardware", "cellInfill", "cellPanelMode", "cellScreenMode", "cellAccessoryGrille", "cellAccessorySecurity", "cellAccessoryFrosted", "handleHeight", "cellNote"].forEach(id => {
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
      bindById("canvasDimensionInput", "keydown", event => {
        if (event.key === "Enter") commitCanvasDimensionEditor();
        if (event.key === "Escape") hideCanvasDimensionEditor();
      });
      bindById("btnApplyCanvasDimension", "click", commitCanvasDimensionEditor);
      bindById("btnCancelCanvasDimension", "click", hideCanvasDimensionEditor);
      bindById("canvasMarkupInput", "keydown", event => {
        if (event.key === "Enter") commitCanvasMarkupEditor();
        if (event.key === "Escape") hideCanvasMarkupEditor();
      });
      bindById("canvasMarkupInput", "blur", commitCanvasMarkupEditor);
      bindById("objectTree", "click", handleObjectTreeClick);
      bindById("objectTree", "contextmenu", handleObjectTreeContextMenu);
      bindById("btnTreeExpandAll", "click", () => {
        collapsedObjectBranches.clear();
        renderObjectTree();
      });
      bindById("btnTreeCollapseAll", "click", () => {
        document.querySelectorAll("#objectTree [data-branch-key]").forEach(branch => collapsedObjectBranches.add(branch.dataset.branchKey));
        renderObjectTree();
      });
      bindById("btnToggleObjectPanel", "click", event => {
        const panel = document.querySelector(".inspector-panel");
        const collapsed = panel.classList.toggle("collapsed");
        const button = event.currentTarget;
        button.textContent = collapsed ? "‹" : "›";
        button.title = collapsed ? "展开对象面板" : "收起对象面板";
        button.setAttribute("aria-label", button.title);
        button.setAttribute("aria-expanded", String(!collapsed));
      });
      document.querySelectorAll(".left-tab").forEach(btn => btn.addEventListener("click", () => switchLeft(btn.dataset.tab)));
      document.querySelectorAll(".inspector-tab").forEach(btn => btn.addEventListener("click", () => switchInspector(btn.dataset.inspector)));
      document.querySelectorAll(".bom-tab").forEach(btn => btn.addEventListener("click", () => switchBom(btn.dataset.bomTab)));
      document.querySelectorAll(".module-button").forEach(btn => btn.addEventListener("click", () => switchModule(btn.dataset.module)));
      document.querySelectorAll(".library-tab").forEach(btn => {
        btn.addEventListener("click", () => {
          activeTemplateLibrary = btn.dataset.templateSource === "custom" ? "custom" : "smart";
          if (activeTemplateLibrary === "smart") openSmartLibraryDialog();
          renderTemplates();
        });
      });
      bindById("templateSearch", "input", event => {
        templateSearchTerm = event.target.value || "";
        renderTemplates();
      });
      bindById("btnRecalc", "click", () => {
        recalc("calculated");
        showToast("算料已刷新。");
      });
      bindById("btnConfirm", "click", confirmBom);
      bindById("btnFreeze", "click", freezeBom);
      bindById("btnNewWindow", "click", newWindow);
      bindById("btnTextAnnotation", "click", () => startCellMarkupPlacement("text"));
      bindById("btnCircleHole", "click", () => startCellMarkupPlacement("circle_hole"));
      bindById("btnSquareHole", "click", () => startCellMarkupPlacement("square_hole"));
      bindById("btnLockHardware", "click", () => startCellMarkupPlacement("lock"));
      bindById("btnNewProjectTop", "click", newProject);
      bindById("btnOpenProjectTop", "click", openProjectManager);
      bindById("btnNewWindowTop", "click", newWindow);
      bindById("btnSaveProjectTop", "click", saveCurrentProjectToLibrary);
      bindById("btnSaveComponentTop", "click", saveComponent);
      bindById("btnSaveWindowInfo", "click", openWindowSaveConfirmDialog);
      bindById("btnSaveWindowAndNew", "click", saveWindowInfoAndCreateNext);
      bindById("btnCloseWindowSaveConfirm", "click", closeWindowSaveConfirmDialog);
      bindById("btnCancelWindowSaveConfirm", "click", closeWindowSaveConfirmDialog);
      bindById("btnConfirmSaveWindowInfo", "click", confirmSaveWindowInfo);
      bindById("windowSaveConfirmDialog", "click", event => {
        if (event.target === event.currentTarget) closeWindowSaveConfirmDialog();
      });
      bindById("btnMeasurementTop", "click", () => openMeasurementDialog());
      bindById("btnPrintDesignTop", "click", printDesign);
      bindById("btnCloseProjectManager", "click", closeProjectManager);
      bindById("btnManagerSaveProject", "click", saveCurrentProjectToLibrary);
      bindById("btnManagerNewProject", "click", newProject);
      bindById("btnManagerEditProject", "click", () => openProjectEditDialog());
      bindById("btnManagerMeasurement", "click", () => openMeasurementDialog());
      bindById("btnProjectPreviewEdit", "click", () => openProjectEditDialog(projectManagerSelectedId));
      bindById("btnProjectPreviewOpen", "click", openSelectedProjectFromManager);
      bindById("btnProjectPreviewMeasurement", "click", openSelectedProjectMeasurement);
      bindById("projectManagerDialog", "click", event => {
        if (event.target === event.currentTarget) closeProjectManager();
      });
      bindById("btnCloseProjectCreate", "click", closeProjectCreateDialog);
      bindById("btnCancelProjectCreate", "click", closeProjectCreateDialog);
      bindById("btnSaveProjectCreate", "click", saveProjectCreateDialog);
      bindById("projectCreateDialog", "click", event => {
        if (event.target === event.currentTarget) closeProjectCreateDialog();
      });
      bindById("projectCreateDialog", "keydown", event => {
        if (event.key === "Enter" && event.target?.tagName !== "TEXTAREA") {
          event.preventDefault();
          saveProjectCreateDialog();
        }
      });
      bindById("btnCloseComponentSave", "click", closeComponentSaveDialog);
      bindById("btnCancelComponentSave", "click", closeComponentSaveDialog);
      bindById("btnConfirmComponentSave", "click", confirmSaveComponent);
      bindById("componentSaveDialog", "click", event => {
        if (event.target === event.currentTarget) closeComponentSaveDialog();
      });
      bindById("componentSaveDialog", "keydown", event => {
        if (event.key === "Enter" && event.target?.tagName !== "TEXTAREA") {
          event.preventDefault();
          confirmSaveComponent();
        }
      });
      bindById("btnOpenSmartLibrary", "click", openSmartLibraryDialog);
      bindById("btnCloseSmartLibrary", "click", closeSmartLibraryDialog);
      bindById("smartLibraryDialog", "click", event => {
        if (event.target === event.currentTarget) closeSmartLibraryDialog();
      });
      document.querySelectorAll("[data-smart-filter]").forEach(button => {
        button.addEventListener("click", () => switchSmartTemplateFilter(button.dataset.smartFilter));
      });
      bindById("btnCloseProjectEdit", "click", closeProjectEditDialog);
      bindById("btnCancelProjectEdit", "click", closeProjectEditDialog);
      bindById("btnSaveProjectEdit", "click", saveProjectEditDialog);
      bindById("projectEditDialog", "click", event => {
        if (event.target === event.currentTarget) closeProjectEditDialog();
      });
      bindById("btnCloseMeasurement", "click", closeMeasurementDialog);
      bindById("measurementDialog", "click", event => {
        if (event.target === event.currentTarget) closeMeasurementDialog();
      });
      bindById("btnGenerateSmartTemplates", "click", generateSmartTemplates);
      bindById("btnDuplicateWindow", "click", duplicateWindow);
      bindById("btnDeleteWindow", "click", deleteWindow);
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
      bindById("btnCloseJointPosition", "click", closeJointPositionDialog);
      bindById("jointPositionDialog", "click", event => {
        if (event.target === event.currentTarget) closeJointPositionDialog();
      });
      document.querySelectorAll("[data-joint-position]").forEach(btn => {
        btn.addEventListener("click", () => chooseJointPosition(btn.dataset.jointPosition));
      });
      document.querySelectorAll("[data-joint-angle]").forEach(btn => {
        btn.addEventListener("click", () => setJointAngleFromMenu(btn.dataset.jointAngle));
      });
      document.querySelectorAll("[data-joint-style]").forEach(btn => {
        btn.addEventListener("click", () => setJointStyleFromMenu(btn.dataset.jointStyle));
      });
      document.querySelectorAll("[data-joint-alias]").forEach(btn => {
        btn.addEventListener("click", () => setJointAliasDisplayFromMenu(btn.dataset.jointAlias));
      });
      document.querySelectorAll("[data-joint-profile]").forEach(btn => {
        btn.addEventListener("click", () => setJointProfileFromMenu(btn.dataset.jointProfile));
      });
      bindById("btnJointMenuEdit", "click", openJointSettingsDialog);
      bindById("btnJointMenuLength", "click", editJointLengthOrWidthFromMenu);
      bindById("btnJointMenuCustomAngle", "click", () => focusJointInspector("jointAngle"));
      bindById("btnCloseJointSettings", "click", closeJointSettingsDialog);
      bindById("btnCancelJointSettings", "click", closeJointSettingsDialog);
      bindById("btnSaveJointSettings", "click", saveJointSettingsDialog);
      bindById("jointSettingsStyle", "change", applyJointSettingsDraft);
      bindById("jointSettingsOrientation", "change", applyJointSettingsDraft);
      bindById("jointSettingsPreview", "dblclick", handleJointSettingsPreviewDoubleClick);
      bindById("jointSettingsInlineInput", "keydown", event => {
        if (event.key === "Enter") commitJointSettingsInlineEditor();
        if (event.key === "Escape") hideJointSettingsInlineEditor();
      });
      bindById("jointSettingsInlineInput", "blur", commitJointSettingsInlineEditor);
      bindById("jointSettingsDialog", "click", event => {
        if (event.target === event.currentTarget) closeJointSettingsDialog();
      });
      bindById("btnConfigureSurround", "click", openSurroundDesignDialog);
      bindById("btnCloseSurroundDesign", "click", closeSurroundDesignDialog);
      bindById("btnCancelSurroundDesign", "click", closeSurroundDesignDialog);
      bindById("btnConfirmSurroundDesign", "click", confirmSurroundDesign);
      [
        "surroundDialogStyle",
        "surroundDialogEdgeMode",
        "surroundDialogSideTop",
        "surroundDialogSideRight",
        "surroundDialogSideBottom",
        "surroundDialogSideLeft",
        "surroundDialogWallThickness",
        "surroundDialogOutsideWidth",
        "surroundDialogInsideWidth",
        "surroundDialogBoardThickness"
      ].forEach(id => bindById(id, "change", updateSurroundDialogDraftFromInputs));
      bindById("surroundDesignDialog", "click", event => {
        if (event.target === event.currentTarget) closeSurroundDesignDialog();
      });
      bindById("surroundDialogPreview", "dblclick", handleSurroundDialogPreviewDoubleClick);
      bindById("surroundDialogPreview", "wheel", handleSurroundDialogWheel);
      bindById("surroundDialogPreview", "pointerdown", handleSurroundDialogPointerDown);
      bindById("surroundDialogPreview", "pointermove", handleSurroundDialogPointerMove);
      bindById("surroundDialogPreview", "pointerup", handleSurroundDialogPointerUp);
      bindById("surroundDialogPreview", "pointercancel", handleSurroundDialogPointerUp);
      bindById("surroundDialogPreview", "contextmenu", event => {
        if (surroundDesignDialog.panning) event.preventDefault();
      });
      bindById("surroundDialogInlineInput", "keydown", event => {
        if (event.key === "Enter") commitSurroundDialogInlineEditor();
        if (event.key === "Escape") hideSurroundDialogInlineEditor();
      });
      bindById("surroundDialogInlineInput", "blur", commitSurroundDialogInlineEditor);
      bindById("btnAddCol", "click", () => splitSelectedColumn(2));
      bindById("btnAddRow", "click", () => splitSelectedRow(2));
      bindById("btnAddLocalVertical", "click", () => addLocalMember("vertical"));
      bindById("btnAddLocalHorizontal", "click", () => addLocalMember("horizontal"));
      bindById("btnAddSpliceJoint", "click", () => startEngineeringJointPlacement("splice"));
      bindById("btnAddCornerJoint", "click", () => startEngineeringJointPlacement("corner"));
      bindById("btnRemoveCol", "click", removeColumn);
      bindById("btnRemoveRow", "click", removeRow);
      bindById("btnSplitVertical", "click", () => splitSelectedColumn(3));
      bindById("btnSplitHorizontal", "click", () => splitSelectedRow(3));
      bindById("btnEqualizeGrid", "click", equalizeGrid);
      bindById("btnQuickPair", "click", applyQuickPair);
      bindById("btnOneClickScreen", "click", applyScreensToAllOperableCells);
      bindById("btnOneClickSecurityBars", "click", applySecurityBarsToAllCells);
      document.querySelectorAll("[data-cell-preset]").forEach(btn => {
        btn.addEventListener("click", () => startCellPresetPlacement(btn.dataset.cellPreset, {
          opening: btn.dataset.cellOpening || "",
          panelCount: Number(btn.dataset.cellPanels || 0) || undefined,
          trackCount: Number(btn.dataset.cellTracks || 0) || undefined,
          panelMode: btn.dataset.panelMode || undefined
        }));
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
      document.querySelectorAll("[data-cell-menu-action]").forEach(btn => {
        btn.addEventListener("click", () => applyCellMenuAction(btn.dataset.cellMenuAction));
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
      ["previewShowDimensions", "previewShowMarkups", "previewShowOrientation"].forEach(id => {
        bindById(id, "change", updatePreviewDisplayOptions);
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
  
