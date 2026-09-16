const VALID_ORIENTATIONS = new Set(["vertical", "horizontal"]);
const VALID_CONNECTIONS = new Set(["butt", "through"]);
const VALID_MODES = new Set(["local", "continuous"]);

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function idPart() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

export function createCellId() {
  return `R-${idPart()}`;
}

export function createMemberId() {
  return `M-${idPart()}`;
}

function defaultVertices() {
  return [
    { vertexId: "V-TL", xRatio: 0, yRatio: 0 },
    { vertexId: "V-TR", xRatio: 1, yRatio: 0 },
    { vertexId: "V-BR", xRatio: 1, yRatio: 1 },
    { vertexId: "V-BL", xRatio: 0, yRatio: 1 }
  ];
}

function defaultFrameSegments() {
  return [
    { segmentId: "frame.top", side: "top", startVertexId: "V-TL", endVertexId: "V-TR", profileRole: "frame" },
    { segmentId: "frame.right", side: "right", startVertexId: "V-TR", endVertexId: "V-BR", profileRole: "frame" },
    { segmentId: "frame.bottom", side: "bottom", startVertexId: "V-BR", endVertexId: "V-BL", profileRole: "frame" },
    { segmentId: "frame.left", side: "left", startVertexId: "V-BL", endVertexId: "V-TL", profileRole: "frame" }
  ];
}

export function layoutRegions(layout) {
  const columns = Array.isArray(layout?.columns) ? layout.columns.length : 0;
  const rows = Array.isArray(layout?.rows) ? layout.rows.length : 0;
  const regions = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const cell = layout.cells[row * columns + col];
      if (!cell?.cellId) continue;
      regions.push({
        regionId: cell.cellId,
        source: "layout-cell",
        row,
        col
      });
    }
  }
  return regions;
}

export function normalizeMember(member, validRegionIds) {
  if (!member || !validRegionIds.has(member.hostRegionId)) return null;
  const orientation = VALID_ORIENTATIONS.has(member.orientation) ? member.orientation : "vertical";
  const startRatio = clamp(member.span?.startRatio ?? member.startRatio ?? 0, 0, 0.95);
  const endRatio = clamp(member.span?.endRatio ?? member.endRatio ?? 1, startRatio + 0.05, 1);
  return {
    memberId: String(member.memberId || createMemberId()),
    role: "mullion",
    orientation,
    hostRegionId: String(member.hostRegionId),
    positionRatio: clamp(member.positionRatio ?? 0.5, 0.08, 0.92),
    span: { startRatio, endRatio },
    profileId: String(member.profileId || ""),
    throughMode: VALID_MODES.has(member.throughMode) ? member.throughMode : "local",
    connectionStart: VALID_CONNECTIONS.has(member.connectionStart) ? member.connectionStart : "butt",
    connectionEnd: VALID_CONNECTIONS.has(member.connectionEnd) ? member.connectionEnd : "butt",
    note: String(member.note || "")
  };
}

export function normalizeTopology(topology, layout) {
  const regions = layoutRegions(layout);
  const validRegionIds = new Set(regions.map(region => region.regionId));
  const sourceVertices = Array.isArray(topology?.vertices) ? topology.vertices : [];
  const vertices = sourceVertices.length >= 3
    ? sourceVertices.map(vertex => ({
      vertexId: String(vertex.vertexId || `V-${idPart()}`),
      xRatio: clamp(vertex.xRatio, 0, 1),
      yRatio: clamp(vertex.yRatio, 0, 1)
    }))
    : defaultVertices();
  const vertexIds = new Set(vertices.map(vertex => vertex.vertexId));
  const sourceSegments = Array.isArray(topology?.frameSegments) ? topology.frameSegments : [];
  const normalizedSegments = sourceSegments
    .filter(segment => vertexIds.has(segment?.startVertexId) && vertexIds.has(segment?.endVertexId))
    .map(segment => ({
      segmentId: String(segment.segmentId || `frame.${idPart()}`),
      side: ["top", "right", "bottom", "left", "free"].includes(segment.side) ? segment.side : "free",
      startVertexId: String(segment.startVertexId),
      endVertexId: String(segment.endVertexId),
      profileRole: ["frame", "door-frame", "free-frame"].includes(segment.profileRole) ? segment.profileRole : "frame",
      profileId: String(segment.profileId || "")
    }));
  const seen = new Set();
  const members = [];
  for (const source of Array.isArray(topology?.members) ? topology.members : []) {
    const member = normalizeMember(source, validRegionIds);
    if (!member || seen.has(member.memberId)) continue;
    seen.add(member.memberId);
    members.push(member);
  }
  return {
    coordinateSystem: "normalized-inner",
    vertices,
    frameSegments: normalizedSegments.length ? normalizedSegments : defaultFrameSegments(),
    members,
    regions
  };
}

export function createLocalMullion(layout, row, col, orientation, profileId = "") {
  const columnCount = layout?.columns?.length || 0;
  const cell = layout?.cells?.[row * columnCount + col];
  if (!cell?.cellId) throw new Error("局部中梃必须放置在有效窗格中");
  return normalizeMember({
    memberId: createMemberId(),
    orientation,
    hostRegionId: cell.cellId,
    positionRatio: 0.5,
    span: { startRatio: 0, endRatio: 1 },
    profileId,
    throughMode: "local",
    connectionStart: "butt",
    connectionEnd: "butt"
  }, new Set([cell.cellId]));
}

export function findMemberHost(layout, member) {
  const columns = layout?.columns?.length || 0;
  const index = layout?.cells?.findIndex(cell => cell.cellId === member?.hostRegionId) ?? -1;
  if (index < 0 || !columns) return null;
  return {
    row: Math.floor(index / columns),
    col: index % columns,
    cell: layout.cells[index]
  };
}

export function memberLengthMm(member, win, faceWidthMm = 0) {
  const host = findMemberHost(win?.layout, member);
  if (!host) return 0;
  const columns = win.layout.columns.map(Number);
  const rows = win.layout.rows.map(Number);
  const columnTotal = columns.reduce((total, value) => total + value, 0) || 1;
  const rowTotal = rows.reduce((total, value) => total + value, 0) || 1;
  const innerWidth = Math.max(0, Number(win.widthMm) - Number(faceWidthMm) * 2);
  const innerHeight = Math.max(0, Number(win.heightMm) - Number(faceWidthMm) * 2);
  const cellWidth = innerWidth * columns[host.col] / columnTotal;
  const cellHeight = innerHeight * rows[host.row] / rowTotal;
  const span = Math.max(0, Number(member.span.endRatio) - Number(member.span.startRatio));
  return (member.orientation === "horizontal" ? cellWidth : cellHeight) * span;
}

export function memberLabel(member, index = 0) {
  const prefix = member?.orientation === "horizontal" ? "H" : "V";
  return `${prefix}${index + 1}`;
}

function uniqueCoordinates(values) {
  return [...new Set(values.map(value => Math.round(clamp(value, 0, 1) * 1000000) / 1000000))]
    .sort((left, right) => left - right);
}

function covers(value, start, end) {
  return value > start + 0.000001 && value < end - 0.000001;
}

export function partitionTopologyRegion(members = []) {
  const vertical = members.filter(member => member.orientation === "vertical");
  const horizontal = members.filter(member => member.orientation === "horizontal");
  const xCoordinates = uniqueCoordinates([
    0,
    1,
    ...vertical.map(member => member.positionRatio),
    ...horizontal.flatMap(member => [member.span.startRatio, member.span.endRatio])
  ]);
  const yCoordinates = uniqueCoordinates([
    0,
    1,
    ...horizontal.map(member => member.positionRatio),
    ...vertical.flatMap(member => [member.span.startRatio, member.span.endRatio])
  ]);
  const width = xCoordinates.length - 1;
  const height = yCoordinates.length - 1;
  const visited = new Set();
  const regions = [];
  const componentByCell = new Map();

  const keyOf = (x, y) => `${x}:${y}`;
  const verticalBoundaryBlocked = (x, y) => {
    const boundary = xCoordinates[x];
    const midpoint = (yCoordinates[y] + yCoordinates[y + 1]) / 2;
    return vertical.some(member => Math.abs(member.positionRatio - boundary) < 0.000001
      && covers(midpoint, member.span.startRatio, member.span.endRatio));
  };
  const horizontalBoundaryBlocked = (x, y) => {
    const boundary = yCoordinates[y];
    const midpoint = (xCoordinates[x] + xCoordinates[x + 1]) / 2;
    return horizontal.some(member => Math.abs(member.positionRatio - boundary) < 0.000001
      && covers(midpoint, member.span.startRatio, member.span.endRatio));
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const firstKey = keyOf(x, y);
      if (visited.has(firstKey)) continue;
      const queue = [[x, y]];
      const cells = [];
      visited.add(firstKey);
      while (queue.length) {
        const [cellX, cellY] = queue.shift();
        cells.push([cellX, cellY]);
        const candidates = [
          [cellX - 1, cellY, cellX > 0 && !verticalBoundaryBlocked(cellX, cellY)],
          [cellX + 1, cellY, cellX < width - 1 && !verticalBoundaryBlocked(cellX + 1, cellY)],
          [cellX, cellY - 1, cellY > 0 && !horizontalBoundaryBlocked(cellX, cellY)],
          [cellX, cellY + 1, cellY < height - 1 && !horizontalBoundaryBlocked(cellX, cellY + 1)]
        ];
        for (const [nextX, nextY, allowed] of candidates) {
          const nextKey = keyOf(nextX, nextY);
          if (!allowed || visited.has(nextKey)) continue;
          visited.add(nextKey);
          queue.push([nextX, nextY]);
        }
      }

      const xStart = Math.min(...cells.map(([cellX]) => xCoordinates[cellX]));
      const xEnd = Math.max(...cells.map(([cellX]) => xCoordinates[cellX + 1]));
      const yStart = Math.min(...cells.map(([, cellY]) => yCoordinates[cellY]));
      const yEnd = Math.max(...cells.map(([, cellY]) => yCoordinates[cellY + 1]));
      const areaRatio = cells.reduce((area, [cellX, cellY]) => area
        + (xCoordinates[cellX + 1] - xCoordinates[cellX]) * (yCoordinates[cellY + 1] - yCoordinates[cellY]), 0);
      const boundsArea = (xEnd - xStart) * (yEnd - yStart);
      const componentIndex = regions.length;
      cells.forEach(([cellX, cellY]) => componentByCell.set(keyOf(cellX, cellY), componentIndex));
      regions.push({
        xStart,
        xEnd,
        yStart,
        yEnd,
        areaRatio,
        rectangular: Math.abs(areaRatio - boundsArea) < 0.00001
      });
    }
  }

  const separatesRegions = members.every(member => {
    if (member.orientation === "vertical") {
      const boundaryIndex = xCoordinates.findIndex(value => Math.abs(value - member.positionRatio) < 0.000001);
      if (boundaryIndex <= 0 || boundaryIndex >= xCoordinates.length - 1) return false;
      return yCoordinates.slice(0, -1).every((start, y) => {
        const midpoint = (start + yCoordinates[y + 1]) / 2;
        if (!covers(midpoint, member.span.startRatio, member.span.endRatio)) return true;
        return componentByCell.get(keyOf(boundaryIndex - 1, y)) !== componentByCell.get(keyOf(boundaryIndex, y));
      });
    }
    const boundaryIndex = yCoordinates.findIndex(value => Math.abs(value - member.positionRatio) < 0.000001);
    if (boundaryIndex <= 0 || boundaryIndex >= yCoordinates.length - 1) return false;
    return xCoordinates.slice(0, -1).every((start, x) => {
      const midpoint = (start + xCoordinates[x + 1]) / 2;
      if (!covers(midpoint, member.span.startRatio, member.span.endRatio)) return true;
      return componentByCell.get(keyOf(x, boundaryIndex - 1)) !== componentByCell.get(keyOf(x, boundaryIndex));
    });
  });

  return {
    valid: separatesRegions && regions.every(region => region.rectangular),
    regions
  };
}
