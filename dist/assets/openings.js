export const OPENING_OPTIONS_BY_TYPE = Object.freeze({
  fixed_glass: [{ value: "fixed", label: "固定" }],
  turn: [
    { value: "left_in", label: "左内开" },
    { value: "right_in", label: "右内开" },
    { value: "left_out", label: "左外开" },
    { value: "right_out", label: "右外开" }
  ],
  turn_tilt: [
    { value: "left_in", label: "左内开内倒" },
    { value: "right_in", label: "右内开内倒" }
  ],
  top_hung: [
    { value: "top_out", label: "上悬外开" },
    { value: "top_in", label: "上悬内开" }
  ],
  bottom_hung: [
    { value: "bottom_in", label: "下悬内开" },
    { value: "bottom_out", label: "下悬外开" }
  ],
  sliding: [
    { value: "slide_left", label: "向左推拉" },
    { value: "slide_right", label: "向右推拉" }
  ],
  lift_slide: [
    { value: "lift_slide_left", label: "提升后向左推拉" },
    { value: "lift_slide_right", label: "提升后向右推拉" }
  ],
  psk: [
    { value: "psk_left", label: "内倒/向左平移" },
    { value: "psk_right", label: "内倒/向右平移" }
  ],
  parallel_slide: [
    { value: "parallel_slide_left", label: "平行脱离后向左推拉" },
    { value: "parallel_slide_right", label: "平行脱离后向右推拉" }
  ],
  parallel_project: [
    { value: "parallel_out", label: "整扇平行外推" }
  ],
  pocket_slide: [
    { value: "pocket_left", label: "向左入墙" },
    { value: "pocket_right", label: "向右入墙" },
    { value: "pocket_both", label: "向两侧入墙" }
  ],
  corner_slide: [
    { value: "corner_both", label: "转角两侧开启" },
    { value: "corner_left", label: "转角左侧开启" },
    { value: "corner_right", label: "转角右侧开启" }
  ],
  vertical_slide: [
    { value: "slide_up", label: "下扇上提" },
    { value: "slide_down", label: "上扇下拉" }
  ],
  folding: [
    { value: "fold_left", label: "向左折叠" },
    { value: "fold_right", label: "向右折叠" }
  ],
  door: [
    { value: "left_in", label: "左内开" },
    { value: "right_in", label: "右内开" },
    { value: "left_out", label: "左外开" },
    { value: "right_out", label: "右外开" }
  ],
  screen: [{ value: "fixed", label: "固定" }],
  louver: [{ value: "fixed", label: "固定" }],
  grille: [{ value: "fixed", label: "固定" }],
  panel: [{ value: "fixed", label: "固定" }],
  empty: [{ value: "fixed", label: "无开启" }]
});

export const OPERABLE_TYPES = Object.freeze([
  "turn",
  "turn_tilt",
  "top_hung",
  "bottom_hung",
  "sliding",
  "lift_slide",
  "psk",
  "parallel_slide",
  "parallel_project",
  "pocket_slide",
  "corner_slide",
  "vertical_slide",
  "folding",
  "door"
]);

export const GLASS_INFILL_TYPES = Object.freeze([
  "fixed_glass",
  ...OPERABLE_TYPES
]);

export function isOperableType(type) {
  return OPERABLE_TYPES.includes(type);
}

export function isGlassInfillType(type) {
  return GLASS_INFILL_TYPES.includes(type);
}

export function openingOptionsForType(type) {
  return OPENING_OPTIONS_BY_TYPE[type] || OPENING_OPTIONS_BY_TYPE.fixed_glass;
}

export function defaultOpeningForType(type) {
  return openingOptionsForType(type)[0].value;
}

export function normalizeOpening(type, opening) {
  const options = openingOptionsForType(type);
  return options.some(item => item.value === opening) ? opening : options[0].value;
}

export function openingLabel(type, opening) {
  const options = openingOptionsForType(type);
  return options.find(item => item.value === opening)?.label || options[0].label;
}

export function motionLabelForType(type, motionMode = "primary") {
  if (type === "turn_tilt" && motionMode === "tilt") return "内倒";
  return {
    turn: "平开",
    turn_tilt: "平开",
    top_hung: "上悬",
    bottom_hung: "下悬",
    sliding: "轨道推拉",
    lift_slide: "提升推拉",
    psk: motionMode === "tilt" ? "内倒" : "平移内倒",
    parallel_slide: "平行推拉",
    parallel_project: "平行推出",
    pocket_slide: "入墙推拉",
    corner_slide: "转角推拉",
    vertical_slide: "上下提拉",
    folding: "折叠",
    door: "平开"
  }[type] || "开启";
}

export const SCREEN_MODES = Object.freeze(["none", "fixed", "swing", "sliding", "retractable"]);

export function defaultOpeningAssembly(type, opening) {
  const stackSide = opening?.endsWith("right") ? "right" : "left";
  const primarySide = opening?.startsWith("right") || opening === "slide_down" ? "right" : "left";
  const defaults = {
    mechanism: {
      turn: "side_hung",
      turn_tilt: "tilt_turn",
      top_hung: "top_hung",
      bottom_hung: "bottom_hung",
      sliding: "inline_slide",
      lift_slide: "lift_slide",
      psk: "psk_tilt_slide",
      parallel_slide: "parallel_slide",
      parallel_project: "parallel_project",
      pocket_slide: "pocket_slide",
      corner_slide: "corner_slide",
      vertical_slide: "vertical_slide",
      folding: "folding",
      door: "side_hung"
    }[type] || "fixed",
    panelCount: 1,
    activePanelCount: isOperableType(type) ? 1 : 0,
    trackCount: 1,
    stackSide: "none",
    primarySide,
    mullionMode: "fixed_mullion",
    openPlane: opening?.endsWith("out") ? "out" : "in",
    operationPriority: "turn_first",
    ventilationMode: type === "turn_tilt" ? "tilt" : "none",
    trafficDoor: "none",
    screenMode: "none",
    cornerAngleDeg: 90,
    cornerPostMode: "postless",
    pocketDepthMm: 0,
    panels: [],
    operationSequence: []
  };

  if (type === "sliding" || type === "lift_slide") {
    defaults.panelCount = 2;
    defaults.activePanelCount = 1;
    defaults.trackCount = 2;
    defaults.stackSide = stackSide;
  } else if (type === "psk" || type === "parallel_slide") {
    defaults.panelCount = 2;
    defaults.activePanelCount = 1;
    defaults.trackCount = 1;
    defaults.stackSide = stackSide;
    defaults.operationPriority = type === "psk" ? "tilt_first" : "slide_first";
    defaults.ventilationMode = type === "psk" ? "tilt" : "none";
  } else if (type === "pocket_slide") {
    defaults.panelCount = 1;
    defaults.activePanelCount = 1;
    defaults.trackCount = 1;
    defaults.stackSide = opening === "pocket_both" ? "both" : stackSide;
  } else if (type === "corner_slide") {
    defaults.panelCount = 4;
    defaults.activePanelCount = 2;
    defaults.trackCount = 2;
    defaults.stackSide = opening === "corner_both" ? "both" : stackSide;
  } else if (type === "vertical_slide") {
    defaults.panelCount = 2;
    defaults.activePanelCount = 1;
    defaults.trackCount = 2;
    defaults.stackSide = opening === "slide_down" ? "bottom" : "top";
    defaults.primarySide = opening === "slide_down" ? "right" : "left";
  } else if (type === "folding") {
    defaults.panelCount = 3;
    defaults.activePanelCount = 3;
    defaults.trackCount = 1;
    defaults.stackSide = stackSide;
    defaults.openPlane = "out";
  }
  return buildAssemblyPanels(type, opening, defaults);
}

export function normalizeOpeningAssembly(type, opening, value = {}) {
  const base = defaultOpeningAssembly(type, opening);
  const next = { ...base, ...(value && typeof value === "object" ? value : {}) };
  const limits = assemblyLimits(type);
  next.mechanism = base.mechanism;
  next.panelCount = clampInteger(next.panelCount, limits.minPanels, limits.maxPanels);
  next.activePanelCount = clampInteger(next.activePanelCount, limits.minActive, Math.min(limits.maxActive, next.panelCount));
  if (type === "folding") next.activePanelCount = next.panelCount;
  next.trackCount = clampInteger(next.trackCount, limits.minTracks, Math.min(limits.maxTracks, next.panelCount));
  next.stackSide = allowedStackSides(type).includes(next.stackSide) ? next.stackSide : base.stackSide;
  if (type === "corner_slide" && next.stackSide !== "both") {
    const wingCapacity = next.stackSide === "left" ? Math.ceil(next.panelCount / 2) : Math.floor(next.panelCount / 2);
    next.activePanelCount = Math.min(next.activePanelCount, Math.max(1, wingCapacity));
  }
  next.primarySide = ["left", "right"].includes(next.primarySide) ? next.primarySide : base.primarySide;
  next.mullionMode = ["fixed_mullion", "flying_mullion"].includes(next.mullionMode) ? next.mullionMode : base.mullionMode;
  next.openPlane = ["in", "out"].includes(next.openPlane) ? next.openPlane : base.openPlane;
  next.operationPriority = ["turn_first", "tilt_first", "slide_first"].includes(next.operationPriority) ? next.operationPriority : base.operationPriority;
  next.ventilationMode = ["none", "tilt", "micro", "night"].includes(next.ventilationMode) ? next.ventilationMode : base.ventilationMode;
  next.trafficDoor = ["none", "left", "right"].includes(next.trafficDoor) ? next.trafficDoor : "none";
  next.screenMode = SCREEN_MODES.includes(next.screenMode) ? next.screenMode : "none";
  next.cornerAngleDeg = Math.min(180, Math.max(60, Number(next.cornerAngleDeg) || 90));
  next.cornerPostMode = ["post", "postless"].includes(next.cornerPostMode) ? next.cornerPostMode : "postless";
  next.pocketDepthMm = Math.min(4000, Math.max(0, Math.round(Number(next.pocketDepthMm) || 0)));
  if (type === "parallel_slide") next.operationPriority = "slide_first";
  return buildAssemblyPanels(type, opening, next, value.panels);
}

export function assemblyLimits(type) {
  if (type === "turn" || type === "turn_tilt" || type === "door") {
    return { minPanels: 1, maxPanels: 2, minActive: 1, maxActive: 2, minTracks: 1, maxTracks: 1 };
  }
  if (type === "sliding") {
    return { minPanels: 2, maxPanels: 6, minActive: 1, maxActive: 5, minTracks: 2, maxTracks: 4 };
  }
  if (type === "lift_slide") {
    return { minPanels: 2, maxPanels: 4, minActive: 1, maxActive: 3, minTracks: 2, maxTracks: 3 };
  }
  if (type === "psk" || type === "parallel_slide") {
    return { minPanels: 2, maxPanels: 4, minActive: 1, maxActive: 2, minTracks: 1, maxTracks: 2 };
  }
  if (type === "parallel_project") {
    return { minPanels: 1, maxPanels: 1, minActive: 1, maxActive: 1, minTracks: 1, maxTracks: 1 };
  }
  if (type === "pocket_slide") {
    return { minPanels: 1, maxPanels: 6, minActive: 1, maxActive: 6, minTracks: 1, maxTracks: 3 };
  }
  if (type === "corner_slide") {
    return { minPanels: 2, maxPanels: 8, minActive: 1, maxActive: 8, minTracks: 1, maxTracks: 3 };
  }
  if (type === "vertical_slide") {
    return { minPanels: 2, maxPanels: 2, minActive: 1, maxActive: 2, minTracks: 2, maxTracks: 2 };
  }
  if (type === "folding") {
    return { minPanels: 2, maxPanels: 12, minActive: 2, maxActive: 12, minTracks: 1, maxTracks: 1 };
  }
  if (type === "top_hung" || type === "bottom_hung") {
    return { minPanels: 1, maxPanels: 1, minActive: 1, maxActive: 1, minTracks: 1, maxTracks: 1 };
  }
  return { minPanels: 1, maxPanels: 1, minActive: 0, maxActive: 0, minTracks: 1, maxTracks: 1 };
}

export function allowedStackSides(type) {
  if (type === "vertical_slide") return ["top", "bottom", "both"];
  if (["sliding", "lift_slide", "psk", "parallel_slide", "pocket_slide", "corner_slide", "folding"].includes(type)) return ["left", "right", "both"];
  return ["none"];
}

export function cornerSlidingMotionVectors(angleDeg, rightWing, travel, releaseDepth) {
  const angle = Math.min(180, Math.max(60, Number(angleDeg) || 90)) * Math.PI / 180;
  const distance = Math.max(0, Number(travel) || 0);
  const release = Math.max(0, Number(releaseDepth) || 0);
  if (!rightWing) {
    return {
      travelVector: { x: -distance, z: 0 },
      releaseVector: { x: 0, z: release }
    };
  }
  return {
    travelVector: {
      x: Math.cos(angle) * distance,
      z: -Math.sin(angle) * distance
    },
    releaseVector: {
      x: Math.sin(angle) * release,
      z: Math.cos(angle) * release
    }
  };
}

export function openingAssemblySummary(type, assembly) {
  if (!isOperableType(type)) return "固定构件";
  const parts = [`${assembly.panelCount}扇`];
  if (assembly.trackCount > 1) parts.push(`${assembly.trackCount}轨`);
  if (assembly.activePanelCount !== assembly.panelCount) parts.push(`${assembly.activePanelCount}活动`);
  if (["turn", "turn_tilt", "door"].includes(type) && assembly.panelCount > 1) parts.push(assembly.primarySide === "right" ? "右主扇" : "左主扇");
  if (assembly.mullionMode === "flying_mullion" && assembly.panelCount > 1) parts.push("假中梃");
  if (assembly.stackSide !== "none") parts.push({ left: "左收", right: "右收", both: "双向收", top: "上提", bottom: "下拉" }[assembly.stackSide]);
  if (type === "folding") parts.push(assembly.openPlane === "in" ? "内折" : "外折");
  if (type === "folding" && assembly.trafficDoor !== "none") parts.push(assembly.trafficDoor === "right" ? "右通行扇" : "左通行扇");
  if (type === "turn_tilt") parts.push(assembly.operationPriority === "tilt_first" ? "内倒优先" : "平开优先");
  if (type === "psk") parts.push(assembly.operationPriority === "tilt_first" ? "内倒优先" : "平移优先");
  if (type === "corner_slide") parts.push(`${assembly.cornerAngleDeg}°转角`, assembly.cornerPostMode === "postless" ? "无转角柱" : "带转角柱");
  if (type === "pocket_slide") parts.push(assembly.pocketDepthMm > 0 ? `墙腔${assembly.pocketDepthMm}mm` : "墙腔自动");
  if (assembly.ventilationMode !== "none") parts.push({ tilt: "内倒通风", micro: "微通风", night: "夜间通风" }[assembly.ventilationMode]);
  if (assembly.screenMode !== "none") parts.push({ fixed: "固定纱", swing: "平开纱", sliding: "推拉纱", retractable: "卷轴纱" }[assembly.screenMode]);
  return parts.filter(Boolean).join(" · ");
}

function buildAssemblyPanels(type, opening, assembly, existingPanels = []) {
  const movableIndexes = type === "corner_slide"
    ? cornerActivePanelIndexes(assembly.panelCount, assembly.activePanelCount, assembly.stackSide)
    : activePanelIndexes(assembly.panelCount, assembly.activePanelCount, assembly.stackSide);
  const orderedIndexes = operationIndexes(movableIndexes, assembly.primarySide, assembly.stackSide);
  const orderMap = new Map(orderedIndexes.map((index, order) => [index, order]));
  const panels = Array.from({ length: assembly.panelCount }, (_, index) => {
    const existing = existingPanels[index] || {};
    const movable = movableIndexes.includes(index);
    const hingeSide = assembly.panelCount === 1
      ? (opening?.startsWith("right") ? "right" : "left")
      : (index < assembly.panelCount / 2 ? "left" : "right");
    return {
      id: existing.id || `P${index + 1}`,
      label: existing.label || `${index + 1}号扇`,
      role: movable ? (orderMap.get(index) === 0 ? "primary" : "secondary") : "fixed",
      movable,
      hingeSide,
      trackIndex: Math.min(assembly.trackCount - 1, index % assembly.trackCount),
      operationOrder: movable ? orderMap.get(index) : -1
    };
  });
  return {
    ...assembly,
    panels,
    operationSequence: panels.filter(panel => panel.movable).sort((a, b) => a.operationOrder - b.operationOrder).map(panel => panel.id)
  };
}

function cornerActivePanelIndexes(panelCount, activePanelCount, stackSide) {
  const leftCount = Math.ceil(panelCount / 2);
  const rightCount = panelCount - leftCount;
  if (stackSide === "left") {
    const count = Math.min(leftCount, activePanelCount);
    return Array.from({ length: count }, (_, index) => leftCount - count + index);
  }
  if (stackSide === "right") {
    const count = Math.min(rightCount, activePanelCount);
    return Array.from({ length: count }, (_, index) => leftCount + index);
  }
  const result = [];
  let left = leftCount - 1;
  let right = leftCount;
  while (result.length < activePanelCount && (left >= 0 || right < panelCount)) {
    if (left >= 0) result.push(left--);
    if (result.length < activePanelCount && right < panelCount) result.push(right++);
  }
  return result.sort((a, b) => a - b);
}

function activePanelIndexes(panelCount, activePanelCount, stackSide) {
  const count = Math.min(panelCount, activePanelCount);
  if (count <= 0) return [];
  if (stackSide === "right" || stackSide === "bottom") {
    return Array.from({ length: count }, (_, index) => index);
  }
  if (stackSide === "both") {
    const result = [];
    let left = Math.floor((panelCount - 1) / 2);
    let right = left + 1;
    while (result.length < count && (left >= 0 || right < panelCount)) {
      if (left >= 0) result.push(left--);
      if (result.length < count && right < panelCount) result.push(right++);
    }
    return result.sort((a, b) => a - b);
  }
  return Array.from({ length: count }, (_, index) => panelCount - count + index);
}

function operationIndexes(indexes, primarySide, stackSide) {
  if (stackSide === "both") {
    const center = (Math.min(...indexes) + Math.max(...indexes)) / 2;
    const left = indexes.filter(index => index <= center).sort((a, b) => b - a);
    const right = indexes.filter(index => index > center).sort((a, b) => a - b);
    return primarySide === "right" ? [...right, ...left] : [...left, ...right];
  }
  const reverse = primarySide === "right" || stackSide === "left" || stackSide === "top";
  return [...indexes].sort((a, b) => reverse ? b - a : a - b);
}

function clampInteger(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(Number(value) || min)));
}

export function openingTransformState(part, ratio) {
  const value = Math.max(0, Math.min(1, Number(ratio) || 0));
  const motionType = part.motionType || part.type;
  const position = vectorState(part.closedPosition, 0);
  const rotation = vectorState(part.closedRotation, 0);
  const scale = vectorState(part.closedScale, 1);
  const state = { ratio: value, position, rotation, scale, foldAngles: [] };

  if (motionType === "sliding") {
    position.x += part.direction * part.travel * value;
    return state;
  }

  if (motionType === "pocket_slide") {
    position.x += part.direction * part.travel * value;
    return state;
  }

  if (motionType === "parallel_slide") {
    const releaseRatio = Math.min(1, value / 0.2);
    const slideRatio = Math.max(0, (value - 0.12) / 0.88);
    const releaseSign = part.openPlane === "in" ? -1 : 1;
    position.z += releaseSign * Math.abs(part.releaseDepth || 0.08) * releaseRatio;
    position.x += part.direction * part.travel * slideRatio;
    return state;
  }

  if (motionType === "corner_slide") {
    const releaseRatio = Math.min(1, value / 0.16);
    const slideRatio = Math.max(0, (value - 0.08) / 0.92);
    const releaseVector = part.releaseVector || { x: 0, z: part.releaseDepth || 0.035 };
    position.x += Number(part.travelVector?.x || 0) * slideRatio + Number(releaseVector.x || 0) * releaseRatio;
    position.z += Number(part.travelVector?.z || 0) * slideRatio + Number(releaseVector.z || 0) * releaseRatio;
    return state;
  }

  if (motionType === "psk") {
    if (part.motionMode === "tilt") {
      const pivotY = -part.height / 2;
      const angle = -0.3 * value;
      rotation.x = angle;
      position.y += pivotY - Math.cos(angle) * pivotY;
      position.z -= Math.sin(angle) * pivotY;
      return state;
    }
    const releaseRatio = Math.min(1, value / 0.2);
    const slideRatio = Math.max(0, (value - 0.12) / 0.88);
    const releaseSign = part.openPlane === "in" ? -1 : 1;
    position.z += releaseSign * Math.abs(part.releaseDepth || 0.08) * releaseRatio;
    position.x += part.direction * part.travel * slideRatio;
    return state;
  }

  if (motionType === "parallel_project") {
    position.z += (part.projectDepth || 0.32) * value;
    return state;
  }

  if (motionType === "lift_slide") {
    const liftRatio = Math.min(1, value / 0.16);
    const slideRatio = Math.max(0, (value - 0.1) / 0.9);
    position.y += part.liftHeight * liftRatio;
    position.x += part.direction * part.travel * slideRatio;
    return state;
  }

  if (motionType === "vertical_slide") {
    position.y += part.direction * part.travel * value;
    return state;
  }

  if (motionType === "folding") {
    const sign = (part.direction < 0 ? -1 : 1) * (part.openPlane === "in" ? -1 : 1);
    const count = part.foldSegments?.length || part.panelCount || 0;
    state.foldAngles = Array.from({ length: count }, (_, index) => {
      const degrees = index === 0 ? 82 : 164;
      return sign * (index % 2 === 0 ? 1 : -1) * degrees * Math.PI / 180 * value;
    });
    return state;
  }

  if (motionType === "retractable_screen") {
    scale.x = Math.max(0.06, 1 - value * 0.94);
    position.x += part.direction * part.width * value * 0.47;
    return state;
  }

  if (motionType === "top_hung" || motionType === "bottom_hung") {
    const topHinged = motionType === "top_hung";
    const outward = part.cell.opening?.endsWith("out");
    const pivotY = (topHinged ? 1 : -1) * part.height / 2;
    const angleSign = (topHinged ? -1 : 1) * (outward ? 1 : -1);
    const angle = angleSign * (topHinged ? 0.72 : 0.42) * value;
    rotation.x = angle;
    if (part.hingeAxis === "horizontal") return state;
    position.y += pivotY - Math.cos(angle) * pivotY;
    position.z -= Math.sin(angle) * pivotY;
    return state;
  }

  if (motionType === "turn_tilt" && part.motionMode === "tilt") {
    const pivotY = -part.height / 2;
    const angle = -0.32 * value;
    rotation.x = angle;
    position.y += pivotY - Math.cos(angle) * pivotY;
    position.z -= Math.sin(angle) * pivotY;
    return state;
  }

  const leftHinged = part.cell.opening?.startsWith("left");
  const outward = part.cell.opening?.endsWith("out");
  const pivotX = (leftHinged ? -1 : 1) * part.width / 2;
  const maxAngle = motionType === "door" ? 1.38 : 1.16;
  const angle = (leftHinged ? 1 : -1) * (outward ? -1 : 1) * maxAngle * value;
  rotation.y = angle;
  if (part.hingeAxis === "side") return state;
  position.x += pivotX - Math.cos(angle) * pivotX;
  position.z += Math.sin(angle) * pivotX;
  return state;
}

export function openingPlanProjection(part, ratio) {
  const state = openingTransformState(part, ratio);
  const width = Math.max(0.001, Math.abs(Number(part.width) || 0));
  const height = Math.max(0.001, Math.abs(Number(part.height) || 0));
  const physicalDepth = Math.max(0.001, Math.abs(Number(part.depth) || width * 0.025));
  const projectedDepth = Math.max(
    physicalDepth,
    Math.abs(Math.cos(state.rotation.x)) * physicalDepth + Math.abs(Math.sin(state.rotation.x)) * height
  );
  return {
    ...state,
    width,
    projectedDepth,
    corners: planRectangleCorners(state.position, width, projectedDepth, state.rotation.y)
  };
}

export function foldingPlanProjections(part, ratio) {
  const state = openingTransformState(part, ratio);
  const panelCount = Math.max(0, state.foldAngles.length || Number(part.panelCount) || 0);
  const panelWidth = Math.max(0.001, Math.abs(Number(part.panelWidth) || (Number(part.width) || 0) / Math.max(1, panelCount)));
  const panelDepth = Math.max(0.001, Math.abs(Number(part.depth) || panelWidth * 0.025));
  const direction = part.direction < 0 ? -1 : 1;
  let pivot = { x: state.position.x, z: state.position.z };
  let heading = Number(part.closedRotation?.y || 0);
  const panels = [];
  for (let index = 0; index < panelCount; index += 1) {
    heading += Number(state.foldAngles[index] || 0);
    const localLength = direction * panelWidth;
    const axis = {
      x: Math.cos(heading) * localLength,
      z: -Math.sin(heading) * localLength
    };
    const center = { x: pivot.x + axis.x / 2, y: state.position.y, z: pivot.z + axis.z / 2 };
    panels.push({
      index,
      center,
      rotationY: heading,
      corners: planRectangleCorners(center, panelWidth, panelDepth, heading)
    });
    pivot = { x: pivot.x + axis.x, z: pivot.z + axis.z };
  }
  return { ...state, panels };
}

export function applyOpeningTransform(part, ratio) {
  const state = openingTransformState(part, ratio);
  const object = part.object;
  object.position.set(state.position.x, state.position.y, state.position.z);
  object.rotation.set(state.rotation.x, state.rotation.y, state.rotation.z);
  object.scale.set(state.scale.x, state.scale.y, state.scale.z);
  if ((part.motionType || part.type) === "folding") {
    (part.foldSegments || []).forEach((segment, index) => {
      segment.rotation.y = state.foldAngles[index] || 0;
    });
  }
  if ((part.motionType || part.type) === "parallel_project") {
    part.updateMechanism?.(state.ratio, object);
  }
  return state.ratio;
}

function vectorState(source, fallback) {
  return {
    x: Number(source?.x ?? fallback),
    y: Number(source?.y ?? fallback),
    z: Number(source?.z ?? fallback)
  };
}

function planRectangleCorners(center, width, depth, rotationY) {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [width / 2, depth / 2],
    [-width / 2, depth / 2]
  ].map(([localX, localZ]) => ({
    x: center.x + cosine * localX + sine * localZ,
    z: center.z - sine * localX + cosine * localZ
  }));
}
