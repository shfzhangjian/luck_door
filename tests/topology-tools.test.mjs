import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultCatalog } from "../dist/assets/catalog.js";
import { calculateProjectBom } from "../dist/assets/calculation.js";
import {
  createLocalMullion,
  findMemberHost,
  memberLengthMm,
  normalizeTopology,
  partitionTopologyRegion
} from "../dist/assets/topology.js";

const layout = {
  columns: [1, 1],
  rows: [1],
  cells: [
    { cellId: "R-LEFT", type: "fixed_glass", opening: "fixed" },
    { cellId: "R-RIGHT", type: "fixed_glass", opening: "fixed" }
  ]
};

const vertical = createLocalMullion(layout, 0, 0, "vertical", "AL70-Z01");
const horizontal = createLocalMullion(layout, 0, 1, "horizontal", "AL70-Z02");
horizontal.span = { startRatio: 0.1, endRatio: 0.9 };
horizontal.positionRatio = 0.4;

const topology = normalizeTopology({
  members: [
    vertical,
    horizontal,
    { ...vertical, memberId: "M-ORPHAN", hostRegionId: "R-MISSING" }
  ]
}, layout);

assert.equal(topology.vertices.length, 4, "rectangular frames should expose four stable topology vertices");
assert.equal(topology.frameSegments.length, 4, "rectangular frames should expose four frame segments");
assert.equal(topology.regions.length, 2, "every layout cell should map to a stable topology region");
assert.equal(topology.members.length, 2, "members whose host region was deleted should be removed during normalization");
assert.deepEqual(findMemberHost(layout, horizontal)?.col, 1, "member host lookup should use the stable region id");

const win = {
  windowId: "W-TOPOLOGY",
  mark: "C-TOPOLOGY",
  quantity: 2,
  widthMm: 1800,
  heightMm: 1500,
  seriesId: "AL70",
  colorInside: "RAL9016",
  colorOutside: "RAL7016",
  defaultGlassTypeId: "GL-LOWE-24",
  defaultHardwareSetId: "HW-TURN-STD",
  geometryMode: "topology",
  layout,
  topology
};

assert.equal(Math.round(memberLengthMm(vertical, win, 70)), 1360, "full-height local mullion should use the inner window height");
assert.equal(Math.round(memberLengthMm(horizontal, win, 70)), 664, "partial horizontal mullion should use host-cell width and span");
assert.deepEqual(partitionTopologyRegion([vertical]).regions.length, 2, "a full-height mullion should split its host into two regions");
assert.equal(partitionTopologyRegion([vertical]).valid, true, "edge-to-edge mullions should produce rectangular regions");
assert.equal(partitionTopologyRegion([horizontal]).valid, false, "floating partial mullions should be flagged as a non-rectangular partition");
const topHalfVertical = { ...vertical, span: { startRatio: 0, endRatio: 0.5 } };
const fullHorizontal = { ...horizontal, positionRatio: 0.5, span: { startRatio: 0, endRatio: 1 } };
const teePartition = partitionTopologyRegion([topHalfVertical, fullHorizontal]);
assert.equal(teePartition.valid, true, "a connected T-junction should create valid rectangular regions");
assert.equal(teePartition.regions.length, 3, "a connected T-junction should create three regions");

const bom = calculateProjectBom({
  catalog: structuredClone(defaultCatalog),
  calculation: { status: "calculated", mbomVersion: 1 },
  windows: [win]
});
const topologyBom = bom.mbom.lines.filter(line => line.sourceComponentId.startsWith("topology.member."));
assert.equal(topologyBom.length, 2, "every local mullion should produce one MBOM source line");
assert.deepEqual(topologyBom.map(line => line.quantity), [2, 2], "local mullion quantities should follow the window quantity");
assert.ok(bom.ebom.some(item => item.type === "mullion" && item.hostRegionId === "R-LEFT"), "EBOM should retain mullion topology provenance");
assert.equal(bom.mbom.lines.filter(line => /^cell\.1\.1\.glass\.\d+$/.test(line.sourceComponentId)).length, 2, "valid member partitions should create traceable glass pieces");
assert.ok(bom.mbom.lines.some(line => line.sourceComponentId === "cell.1.2.glass"), "invalid floating partitions should retain the unsplit glass until validation is resolved");

const schema = JSON.parse(readFileSync(new URL("../docs/door-window-design.v2.schema.json", import.meta.url), "utf8"));
assert.equal(schema.properties.schemaVersion.const, "cn-door-window-design.v2");
assert.ok(schema.$defs.topologyMember, "v2 schema should define local topology members");
assert.ok(schema.$defs.cell.required.includes("cellId"), "v2 cells should have stable ids");
assert.ok(schema.properties.customShapes, "v2 schema should persist saved DIY shape tool items");
assert.ok(schema.$defs.customShapeElement, "v2 schema should describe named reusable DIY shape elements");
assert.ok(schema.$defs.cellCustomShape, "v2 schema should describe DIY geometry attached to an individual cell");
assert.ok(schema.$defs.cell.properties.customShape, "v2 cells should be able to carry a selected DIY shape");

const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
[
  "toolSearch",
  "btnAddLocalVertical",
  "btnAddLocalHorizontal",
  "inspector-member",
  "cellCustomShapeName",
  "memberContextMenu"
].forEach(id => assert.ok(html.includes(`id="${id}"`), `${id} should be available in the drawing workbench`));

console.log("Validated tool-library boundaries, topology normalization, local-mullion BOM, and the v2 JSON contract.");
