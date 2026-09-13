const DOCKS = new Set(["left", "right", "top", "bottom", "free"]);
const ALIGNS = new Set(["start", "center", "end"]);

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

export function createWindowAssembly(rootWindow, name = "门窗拼接") {
  return {
    assemblyId: makeId("WA"),
    name,
    rootWindowId: rootWindow.windowId,
    placements: []
  };
}

export function createAssemblyPlacement(windowId, referenceWindowId, dock = "right", options = {}) {
  const normalizedDock = DOCKS.has(dock) ? dock : "right";
  return {
    placementId: makeId("WP"),
    windowId,
    referenceWindowId,
    dock: normalizedDock,
    align: ALIGNS.has(options.align) ? options.align : "center",
    gapMm: clamp(options.gapMm, 0, 2000, 0),
    offsetMm: clamp(options.offsetMm, -10000, 10000, 0),
    rotationDeg: clamp(options.rotationDeg, -180, 180, 0),
    freePosition: {
      xMm: clamp(options.freePosition?.xMm, -50000, 50000, 0),
      yMm: clamp(options.freePosition?.yMm, -50000, 50000, 0),
      zMm: clamp(options.freePosition?.zMm, -50000, 50000, 0)
    },
    jointId: String(options.jointId || ""),
    note: String(options.note || "")
  };
}

export function hostEdgeForDock(dock) {
  return DOCKS.has(dock) && dock !== "free" ? dock : "right";
}

export function placementGapForJoint(joint) {
  if (!joint) return 0;
  return clamp(Math.max(Number(joint.legWidthAMm || 0), Number(joint.legWidthBMm || 0)), 0, 2000, 0);
}

export function placementRotationForJoint(joint) {
  if (!joint || joint.type !== "corner") return 0;
  const angle = clamp(joint.angleDeg, 0, 180, 90);
  return joint.orientation === "reversed" ? -angle : angle;
}

export function normalizeWindowAssembly(source, windows, joints = []) {
  const windowIds = new Set((windows || []).map(win => win.windowId));
  if (!windowIds.size) return null;
  const jointIds = new Set((joints || []).map(joint => joint.jointId));
  const rootWindowId = windowIds.has(source?.rootWindowId) ? source.rootWindowId : windows[0].windowId;
  let pending = [];
  const placementIds = new Set();
  for (const item of Array.isArray(source?.placements) ? source.placements : []) {
    if (!item || !windowIds.has(item.windowId) || !windowIds.has(item.referenceWindowId)) continue;
    if (item.windowId === rootWindowId || item.windowId === item.referenceWindowId) continue;
    const placement = createAssemblyPlacement(item.windowId, item.referenceWindowId, item.dock, item);
    placement.placementId = String(item.placementId || placement.placementId);
    if (placementIds.has(placement.placementId)) placement.placementId = makeId("WP");
    placementIds.add(placement.placementId);
    placement.jointId = jointIds.has(item.jointId) ? String(item.jointId) : "";
    pending.push(placement);
  }

  const placements = [];
  const resolvedWindowIds = new Set([rootWindowId]);
  let progressed = true;
  while (pending.length && progressed) {
    progressed = false;
    const unresolved = [];
    for (const placement of pending) {
      if (resolvedWindowIds.has(placement.windowId)) continue;
      if (!resolvedWindowIds.has(placement.referenceWindowId)) {
        unresolved.push(placement);
        continue;
      }
      placements.push(placement);
      resolvedWindowIds.add(placement.windowId);
      progressed = true;
    }
    pending = unresolved;
  }

  return {
    assemblyId: String(source?.assemblyId || makeId("WA")),
    name: String(source?.name || "门窗拼接"),
    rootWindowId,
    placements,
    note: String(source?.note || "")
  };
}

export function normalizeWindowAssemblies(assemblies, windows, joints = []) {
  const seen = new Set();
  const result = [];
  for (const source of Array.isArray(assemblies) ? assemblies : []) {
    const assembly = normalizeWindowAssembly(source, windows, joints);
    if (!assembly || seen.has(assembly.assemblyId)) continue;
    seen.add(assembly.assemblyId);
    result.push(assembly);
  }
  return result;
}

function alignmentOffset(referenceSize, childSize, align) {
  if (align === "start") return (-referenceSize + childSize) / 2;
  if (align === "end") return (referenceSize - childSize) / 2;
  return 0;
}

function axes(rotationDeg) {
  const radians = rotationDeg * Math.PI / 180;
  return {
    x: { x: Math.cos(radians), z: -Math.sin(radians) },
    z: { x: Math.sin(radians), z: Math.cos(radians) }
  };
}

export function resolveAssemblyLayout(assembly, windows) {
  if (!assembly) return [];
  const byId = new Map((windows || []).map(win => [win.windowId, win]));
  const root = byId.get(assembly.rootWindowId);
  if (!root) return [];
  const transforms = new Map([[root.windowId, {
    windowId: root.windowId,
    placementId: "",
    referenceWindowId: "",
    dock: "root",
    xMm: 0,
    yMm: 0,
    zMm: 0,
    rotationDeg: 0,
    window: root
  }]]);

  for (const placement of assembly.placements || []) {
    const win = byId.get(placement.windowId);
    const reference = transforms.get(placement.referenceWindowId);
    if (!win || !reference) continue;
    const referenceWindow = reference.window;
    const referenceAxes = axes(reference.rotationDeg);
    const rotationDeg = reference.rotationDeg + placement.rotationDeg;
    const childAxes = axes(rotationDeg);
    let xMm = reference.xMm;
    let yMm = reference.yMm;
    let zMm = reference.zMm;

    if (placement.dock === "right" || placement.dock === "left") {
      const side = placement.dock === "right" ? 1 : -1;
      const referenceEdge = side * Number(referenceWindow.widthMm || 0) / 2;
      const childHalf = side * Number(win.widthMm || 0) / 2;
      xMm += referenceAxes.x.x * (referenceEdge + side * placement.gapMm) + childAxes.x.x * childHalf;
      zMm += referenceAxes.x.z * (referenceEdge + side * placement.gapMm) + childAxes.x.z * childHalf;
      yMm += alignmentOffset(Number(referenceWindow.heightMm || 0), Number(win.heightMm || 0), placement.align) + placement.offsetMm;
    } else if (placement.dock === "top" || placement.dock === "bottom") {
      const side = placement.dock === "top" ? 1 : -1;
      const along = alignmentOffset(Number(referenceWindow.widthMm || 0), Number(win.widthMm || 0), placement.align) + placement.offsetMm;
      xMm += referenceAxes.x.x * along;
      zMm += referenceAxes.x.z * along;
      yMm += side * ((Number(referenceWindow.heightMm || 0) + Number(win.heightMm || 0)) / 2 + placement.gapMm);
    } else {
      xMm += referenceAxes.x.x * placement.freePosition.xMm + referenceAxes.z.x * placement.freePosition.zMm;
      zMm += referenceAxes.x.z * placement.freePosition.xMm + referenceAxes.z.z * placement.freePosition.zMm;
      yMm += placement.freePosition.yMm;
    }

    transforms.set(win.windowId, {
      windowId: win.windowId,
      placementId: placement.placementId,
      referenceWindowId: placement.referenceWindowId,
      dock: placement.dock,
      xMm,
      yMm,
      zMm,
      rotationDeg,
      window: win
    });
  }
  return [...transforms.values()];
}

export function assemblyBounds(layout) {
  if (!layout?.length) return { widthMm: 0, heightMm: 0, depthMm: 0, minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
  const points = [];
  layout.forEach(item => {
    const basis = axes(item.rotationDeg);
    const halfWidth = Number(item.window.widthMm || 0) / 2;
    const halfHeight = Number(item.window.heightMm || 0) / 2;
    for (const side of [-1, 1]) {
      for (const vertical of [-1, 1]) {
        points.push({
          x: item.xMm + basis.x.x * halfWidth * side,
          y: item.yMm + halfHeight * vertical,
          z: item.zMm + basis.x.z * halfWidth * side
        });
      }
    }
  });
  const values = key => points.map(point => point[key]);
  const minX = Math.min(...values("x"));
  const maxX = Math.max(...values("x"));
  const minY = Math.min(...values("y"));
  const maxY = Math.max(...values("y"));
  const minZ = Math.min(...values("z"));
  const maxZ = Math.max(...values("z"));
  return {
    widthMm: maxX - minX,
    heightMm: maxY - minY,
    depthMm: maxZ - minZ,
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ
  };
}

export function assemblySummary(assembly, windows) {
  const layout = resolveAssemblyLayout(assembly, windows);
  const bounds = assemblyBounds(layout);
  return {
    assemblyId: assembly?.assemblyId || "",
    name: assembly?.name || "",
    rootWindowId: assembly?.rootWindowId || "",
    windowIds: layout.map(item => item.windowId),
    jointIds: [...new Set((assembly?.placements || []).map(item => item.jointId).filter(Boolean))],
    overallWidthMm: Math.round(bounds.widthMm),
    overallHeightMm: Math.round(bounds.heightMm),
    overallDepthMm: Math.round(bounds.depthMm)
  };
}

export function dockLabel(dock) {
  return { left: "左方", right: "右方", top: "上方", bottom: "下方", free: "自由定位", root: "基准窗" }[dock] || dock;
}
