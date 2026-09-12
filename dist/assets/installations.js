const STYLE_IDS = new Set(["both_sides", "outside_only", "inside_only", "liner"]);
const EDGE_MODES = new Set(["all", "three_without_bottom", "left_top", "right_top", "custom"]);
const MOUNTING_MODES = new Set(["opening", "exterior_overmount"]);
const FRAME_ALIGNMENTS = new Set(["center", "exterior_flush", "interior_flush", "custom"]);
const WALL_MATERIAL_IDS = new Set(["plaster", "concrete", "red_brick", "gray_brick", "stone"]);
const WALL_CORNER_MODE_IDS = new Set(["structural_pier", "open_corner"]);
const SIDES = ["top", "right", "bottom", "left"];

export const SURROUND_STYLE_OPTIONS = [
  { value: "both_sides", label: "内外双包套" },
  { value: "outside_only", label: "仅外包套" },
  { value: "inside_only", label: "仅内包套" },
  { value: "liner", label: "洞口衬板" }
];

export const SURROUND_EDGE_OPTIONS = [
  { value: "all", label: "四边" },
  { value: "three_without_bottom", label: "三边无底" },
  { value: "left_top", label: "左边与上边" },
  { value: "right_top", label: "右边与上边" },
  { value: "custom", label: "自定义边" }
];

export const MOUNTING_MODE_OPTIONS = [
  { value: "opening", label: "洞口内安装" },
  { value: "exterior_overmount", label: "外墙外挂安装" }
];

export const FRAME_ALIGNMENT_OPTIONS = [
  { value: "center", label: "墙厚居中" },
  { value: "exterior_flush", label: "外口齐平" },
  { value: "interior_flush", label: "内口齐平" },
  { value: "custom", label: "自定义框位" }
];

export const WALL_MATERIAL_OPTIONS = [
  { value: "plaster", label: "白色抹灰" },
  { value: "concrete", label: "清水混凝土" },
  { value: "red_brick", label: "红砖墙" },
  { value: "gray_brick", label: "灰砖墙" },
  { value: "stone", label: "石材墙面" }
];

export const WALL_CORNER_MODE_OPTIONS = [
  { value: "structural_pier", label: "结构转角墙柱" },
  { value: "open_corner", label: "连续转角洞口" }
];

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function defaultSurround() {
  return {
    enabled: false,
    mountingMode: "opening",
    frameAlignment: "center",
    styleId: "both_sides",
    edgeMode: "all",
    sides: [...SIDES],
    wallThicknessMm: 200,
    wallMaterialId: "plaster",
    wallCornerMode: "structural_pier",
    cornerPierWidthMm: 240,
    frameOffsetMm: 0,
    exteriorMountGapMm: 0,
    outsideWidthMm: 80,
    insideWidthMm: 80,
    boardThicknessMm: 18,
    materialCode: "SURROUND-AL-01",
    colorOutside: "RAL7016",
    colorInside: "RAL9016",
    note: ""
  };
}

export function resolveSurroundSides(surround) {
  const edgeMode = EDGE_MODES.has(surround?.edgeMode) ? surround.edgeMode : "all";
  if (edgeMode === "three_without_bottom") return ["top", "right", "left"];
  if (edgeMode === "left_top") return ["top", "left"];
  if (edgeMode === "right_top") return ["top", "right"];
  if (edgeMode !== "custom") return [...SIDES];
  const selected = new Set(Array.isArray(surround?.sides) ? surround.sides : []);
  return SIDES.filter(side => selected.has(side));
}

export function normalizeSurround(source) {
  const base = defaultSurround();
  const value = source && typeof source === "object" ? source : {};
  const styleId = STYLE_IDS.has(value.styleId) ? value.styleId : base.styleId;
  const edgeMode = EDGE_MODES.has(value.edgeMode) ? value.edgeMode : base.edgeMode;
  const mountingMode = MOUNTING_MODES.has(value.mountingMode) ? value.mountingMode : base.mountingMode;
  const frameAlignment = FRAME_ALIGNMENTS.has(value.frameAlignment)
    ? value.frameAlignment
    : (Math.abs(Number(value.frameOffsetMm) || 0) > 0.001 ? "custom" : base.frameAlignment);
  const result = {
    enabled: Boolean(value.enabled),
    mountingMode,
    frameAlignment,
    styleId,
    edgeMode,
    sides: [],
    wallThicknessMm: clamp(value.wallThicknessMm, 60, 600, base.wallThicknessMm),
    wallMaterialId: WALL_MATERIAL_IDS.has(value.wallMaterialId) ? value.wallMaterialId : base.wallMaterialId,
    wallCornerMode: WALL_CORNER_MODE_IDS.has(value.wallCornerMode) ? value.wallCornerMode : base.wallCornerMode,
    cornerPierWidthMm: clamp(value.cornerPierWidthMm, 120, 1200, base.cornerPierWidthMm),
    frameOffsetMm: clamp(value.frameOffsetMm, -300, 300, base.frameOffsetMm),
    exteriorMountGapMm: clamp(value.exteriorMountGapMm, 0, 200, base.exteriorMountGapMm),
    outsideWidthMm: clamp(value.outsideWidthMm, 0, 500, base.outsideWidthMm),
    insideWidthMm: clamp(value.insideWidthMm, 0, 500, base.insideWidthMm),
    boardThicknessMm: clamp(value.boardThicknessMm, 5, 100, base.boardThicknessMm),
    materialCode: String(value.materialCode || base.materialCode),
    colorOutside: String(value.colorOutside || base.colorOutside),
    colorInside: String(value.colorInside || base.colorInside),
    note: String(value.note || "")
  };
  result.sides = resolveSurroundSides({ edgeMode, sides: value.sides });
  return result;
}

export function resolveFramePlacement(source, frameDepthMm = 70) {
  const surround = normalizeSurround(source);
  const wallThicknessMm = surround.wallThicknessMm;
  const resolvedFrameDepthMm = clamp(frameDepthMm, 1, 600, 70);
  const flushOffsetMm = Math.max(0, (wallThicknessMm - resolvedFrameDepthMm) / 2);
  let effectiveFrameOffsetMm = 0;

  if (surround.mountingMode === "exterior_overmount") {
    effectiveFrameOffsetMm = -(wallThicknessMm + resolvedFrameDepthMm) / 2 - surround.exteriorMountGapMm;
  } else if (surround.frameAlignment === "exterior_flush") {
    effectiveFrameOffsetMm = -flushOffsetMm;
  } else if (surround.frameAlignment === "interior_flush") {
    effectiveFrameOffsetMm = flushOffsetMm;
  } else if (surround.frameAlignment === "custom") {
    effectiveFrameOffsetMm = surround.frameOffsetMm;
  }

  return {
    mountingMode: surround.mountingMode,
    frameAlignment: surround.frameAlignment,
    wallThicknessMm,
    frameDepthMm: resolvedFrameDepthMm,
    effectiveFrameOffsetMm,
    outsideFaceMm: -wallThicknessMm / 2,
    insideFaceMm: wallThicknessMm / 2
  };
}

export function surroundGeometry(source, widthMm, heightMm) {
  const surround = normalizeSurround(source);
  const width = Math.max(0, Number(widthMm || 0));
  const height = Math.max(0, Number(heightMm || 0));
  const sides = resolveSurroundSides(surround);
  const pieces = sides.map(side => ({
    side,
    lengthMm: ["top", "bottom"].includes(side) ? width : height
  }));
  const active = new Set(sides);
  const cornerPairs = [["top", "right"], ["right", "bottom"], ["bottom", "left"], ["left", "top"]];
  const cornerCount = cornerPairs.filter(([first, second]) => active.has(first) && active.has(second)).length;
  const perimeterMm = pieces.reduce((total, piece) => total + piece.lengthMm, 0);
  return {
    surround,
    sides,
    pieces,
    cornerCount,
    perimeterMm,
    linerAreaM2: Math.round(perimeterMm * surround.wallThicknessMm / 1000) / 1000,
    outsideEnabled: ["both_sides", "outside_only"].includes(surround.styleId),
    insideEnabled: ["both_sides", "inside_only"].includes(surround.styleId),
    linerEnabled: surround.styleId === "liner" || surround.styleId === "both_sides"
  };
}

export function surroundSummary(source, widthMm, heightMm) {
  const geometry = surroundGeometry(source, widthMm, heightMm);
  const style = SURROUND_STYLE_OPTIONS.find(item => item.value === geometry.surround.styleId)?.label || geometry.surround.styleId;
  const edgeMode = SURROUND_EDGE_OPTIONS.find(item => item.value === geometry.surround.edgeMode)?.label || geometry.surround.edgeMode;
  return {
    enabled: geometry.surround.enabled,
    style,
    edgeMode,
    sideCount: geometry.sides.length,
    perimeterMm: Math.round(geometry.perimeterMm),
    linerAreaM2: geometry.linerAreaM2,
    wallThicknessMm: geometry.surround.wallThicknessMm,
    wallMaterial: WALL_MATERIAL_OPTIONS.find(item => item.value === geometry.surround.wallMaterialId)?.label || geometry.surround.wallMaterialId,
    wallCornerMode: WALL_CORNER_MODE_OPTIONS.find(item => item.value === geometry.surround.wallCornerMode)?.label || geometry.surround.wallCornerMode,
    cornerPierWidthMm: geometry.surround.cornerPierWidthMm,
    mountingMode: MOUNTING_MODE_OPTIONS.find(item => item.value === geometry.surround.mountingMode)?.label || geometry.surround.mountingMode,
    frameAlignment: FRAME_ALIGNMENT_OPTIONS.find(item => item.value === geometry.surround.frameAlignment)?.label || geometry.surround.frameAlignment
  };
}

export function surroundSideLabel(side) {
  return { top: "上边", right: "右边", bottom: "下边", left: "左边" }[side] || side;
}
