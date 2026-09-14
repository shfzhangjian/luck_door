const JOINT_TYPES = new Set(["splice", "corner"]);
const JOINT_EDGES = new Set(["left", "right", "top", "bottom"]);
const ORIENTATIONS = new Set(["normal", "reversed"]);
const FRAME_TREATMENTS = new Set(["keep_both", "shared_frame", "connector_only"]);
const POST_MODES = new Set(["profile", "postless"]);
const ALIAS_DISPLAYS = new Set(["code", "alias", "all", "hidden"]);

export const JOINT_STYLE_OPTIONS = {
  splice: [
    { value: "flat", label: "标准拼接" },
    { value: "reinforced", label: "加强拼接" }
  ],
  corner: [
    { value: "default", label: "默认转角" },
    { value: "curved", label: "弧形面转角" },
    { value: "universal", label: "万能转角" },
    { value: "rectangular", label: "矩形转角" },
    { value: "giant", label: "巨型转角" }
  ]
};

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function jointId() {
  return `J-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

export function defaultJointProfile(type, series) {
  if (type === "corner") return series?.cornerProfile || `${series?.id || "SYS"}-CORNER-90`;
  return series?.spliceProfile || `${series?.id || "SYS"}-SPLICE`;
}

export function createEngineeringJoint(type, win, series) {
  const normalizedType = JOINT_TYPES.has(type) ? type : "splice";
  const defaultLegWidth = normalizedType === "corner" ? 100 : 50;
  return normalizeEngineeringJoint({
    jointId: jointId(),
    type: normalizedType,
    style: normalizedType === "corner" ? "default" : "flat",
    orientation: "normal",
    hostWindowId: win.windowId,
    hostEdge: "right",
    connectedWindowIds: [win.windowId],
    angleDeg: normalizedType === "corner" ? 90 : 180,
    legWidthAMm: defaultLegWidth,
    legWidthBMm: defaultLegWidth,
    span: { startRatio: 0, endRatio: 1 },
    profileId: defaultJointProfile(normalizedType, series),
    frameTreatment: "keep_both",
    postMode: "profile",
    fastenerSpacingMm: 400,
    note: ""
  }, new Set([win.windowId]));
}

export function normalizeEngineeringJoint(joint, validWindowIds) {
  if (!joint || !validWindowIds.has(joint.hostWindowId)) return null;
  const type = JOINT_TYPES.has(joint.type) ? joint.type : "splice";
  const defaultLegWidth = type === "corner" ? 100 : 50;
  const styleOptions = JOINT_STYLE_OPTIONS[type];
  const style = styleOptions.some(item => item.value === joint.style) ? joint.style : styleOptions[0].value;
  const startRatio = clamp(joint.span?.startRatio ?? 0, 0, 0.95, 0);
  const endRatio = clamp(joint.span?.endRatio ?? 1, startRatio + 0.05, 1, 1);
  const connectedWindowIds = [...new Set([
    joint.hostWindowId,
    ...(Array.isArray(joint.connectedWindowIds) ? joint.connectedWindowIds : [])
  ].filter(id => validWindowIds.has(id)))];
  return {
    jointId: String(joint.jointId || jointId()),
    type,
    style,
    orientation: ORIENTATIONS.has(joint.orientation) ? joint.orientation : "normal",
    hostWindowId: String(joint.hostWindowId),
    hostEdge: JOINT_EDGES.has(joint.hostEdge) ? joint.hostEdge : "right",
    connectedWindowIds,
    angleDeg: type === "corner" ? clamp(joint.angleDeg, 60, 180, 90) : 180,
    legWidthAMm: clamp(joint.legWidthAMm, 10, 300, defaultLegWidth),
    legWidthBMm: clamp(joint.legWidthBMm, 10, 300, defaultLegWidth),
    span: { startRatio, endRatio },
    profileId: String(joint.profileId || ""),
    frameTreatment: FRAME_TREATMENTS.has(joint.frameTreatment) ? joint.frameTreatment : "keep_both",
    postMode: type === "corner" && POST_MODES.has(joint.postMode) ? joint.postMode : "profile",
    fastenerSpacingMm: clamp(joint.fastenerSpacingMm, 100, 1000, 400),
    aliasDisplay: ALIAS_DISPLAYS.has(joint.aliasDisplay) ? joint.aliasDisplay : "alias",
    note: String(joint.note || "")
  };
}

export function normalizeEngineeringJoints(joints, windows) {
  const validWindowIds = new Set((windows || []).map(win => win.windowId));
  const seen = new Set();
  const normalized = [];
  for (const source of Array.isArray(joints) ? joints : []) {
    const joint = normalizeEngineeringJoint(source, validWindowIds);
    if (!joint || seen.has(joint.jointId)) continue;
    seen.add(joint.jointId);
    normalized.push(joint);
  }
  return normalized;
}

export function jointLengthMm(joint, win) {
  if (!joint || !win) return 0;
  const edgeLength = ["top", "bottom"].includes(joint.hostEdge)
    ? Number(win.widthMm || 0)
    : Number(win.heightMm || 0);
  return edgeLength * Math.max(0, joint.span.endRatio - joint.span.startRatio);
}

export function jointLabel(joint, index = 0) {
  return `${joint?.type === "corner" ? "T" : "S"}${index + 1}`;
}

export function jointStatus(joint) {
  if (!joint) return { valid: false, label: "节点无效" };
  if (joint.connectedWindowIds.length < 2) return { valid: true, label: "待连接第二樘窗" };
  return { valid: true, label: `已连接${joint.connectedWindowIds.length}樘窗` };
}
