import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultCatalog } from "../dist/assets/catalog.js";
import { calculateProjectBom } from "../dist/assets/calculation.js";
import {
  WALL_CORNER_MODE_OPTIONS,
  WALL_MATERIAL_OPTIONS,
  defaultSurround,
  normalizeSurround,
  resolveFramePlacement,
  resolveSurroundSides,
  surroundGeometry,
  surroundSummary
} from "../dist/assets/installations.js";

const defaults = defaultSurround();
assert.equal(defaults.enabled, false, "surrounds should be opt-in for legacy projects");
assert.equal(defaults.mountingMode, "opening", "ordinary windows should default to installation within the wall opening");
assert.equal(defaults.frameAlignment, "center", "ordinary windows should default to the wall-depth centerline");
assert.equal(defaults.wallMaterialId, "plaster", "installation walls should default to a neutral plaster finish");
assert.equal(defaults.wallCornerMode, "structural_pier", "corner windows should default to a structurally framed wall corner");
assert.equal(defaults.cornerPierWidthMm, 240);
assert.deepEqual(WALL_MATERIAL_OPTIONS.map(item => item.value), ["plaster", "concrete", "red_brick", "gray_brick", "stone"]);
assert.deepEqual(WALL_CORNER_MODE_OPTIONS.map(item => item.value), ["structural_pier", "open_corner"]);
assert.deepEqual(resolveSurroundSides({ edgeMode: "three_without_bottom" }), ["top", "right", "left"]);
assert.deepEqual(resolveSurroundSides({ edgeMode: "left_top" }), ["top", "left"]);

const custom = normalizeSurround({
  enabled: true,
  styleId: "outside_only",
  edgeMode: "custom",
  sides: ["left", "top", "invalid", "left"],
  wallThicknessMm: 1000,
  wallMaterialId: "red_brick",
  wallCornerMode: "open_corner",
  cornerPierWidthMm: 2000,
  frameOffsetMm: -500,
  outsideWidthMm: 120,
  boardThicknessMm: 2,
  materialCode: "SUR-CUSTOM"
});
assert.deepEqual(custom.sides, ["top", "left"], "custom sides should be canonical and unique");
assert.equal(custom.wallThicknessMm, 600, "wall thickness should respect the supported range");
assert.equal(custom.wallMaterialId, "red_brick", "supported wall finishes should survive normalization");
assert.equal(custom.wallCornerMode, "open_corner", "wall-corner structure should remain independent from the window corner post");
assert.equal(custom.cornerPierWidthMm, 1200, "corner wall-pier width should respect the supported range");
assert.equal(normalizeSurround({ wallMaterialId: "unknown" }).wallMaterialId, "plaster", "unknown wall finishes should use the stable default");
assert.equal(normalizeSurround({ wallCornerMode: "unknown" }).wallCornerMode, "structural_pier");
assert.equal(custom.frameOffsetMm, -300);
assert.equal(custom.boardThicknessMm, 5);

const centeredPlacement = resolveFramePlacement({ wallThicknessMm: 200, frameAlignment: "center" }, 70);
assert.equal(centeredPlacement.effectiveFrameOffsetMm, 0);
const exteriorFlushPlacement = resolveFramePlacement({ wallThicknessMm: 200, frameAlignment: "exterior_flush" }, 70);
assert.equal(exteriorFlushPlacement.effectiveFrameOffsetMm, -65);
const interiorFlushPlacement = resolveFramePlacement({ wallThicknessMm: 200, frameAlignment: "interior_flush" }, 70);
assert.equal(interiorFlushPlacement.effectiveFrameOffsetMm, 65);
const customPlacement = resolveFramePlacement({ wallThicknessMm: 200, frameAlignment: "custom", frameOffsetMm: 20 }, 70);
assert.equal(customPlacement.effectiveFrameOffsetMm, 20);
const overmountPlacement = resolveFramePlacement({ wallThicknessMm: 200, mountingMode: "exterior_overmount", exteriorMountGapMm: 10 }, 70);
assert.equal(overmountPlacement.effectiveFrameOffsetMm, -145);

const bothSides = normalizeSurround({
  enabled: true,
  styleId: "both_sides",
  edgeMode: "all",
  wallThicknessMm: 200,
  frameOffsetMm: 20,
  outsideWidthMm: 90,
  insideWidthMm: 70,
  boardThicknessMm: 18,
  materialCode: "SUR-AL-90",
  colorOutside: "RAL7016",
  colorInside: "RAL9016"
});
const geometry = surroundGeometry(bothSides, 1800, 1500);
assert.equal(geometry.perimeterMm, 6600);
assert.equal(geometry.cornerCount, 4);
assert.equal(geometry.linerAreaM2, 1.32);
assert.equal(geometry.outsideEnabled, true);
assert.equal(geometry.insideEnabled, true);
assert.equal(geometry.linerEnabled, true);
assert.equal(surroundSummary(bothSides, 1800, 1500).style, "内外双包套");
assert.equal(surroundSummary({ ...bothSides, wallMaterialId: "gray_brick" }, 1800, 1500).wallMaterial, "灰砖墙");
assert.equal(surroundSummary({ ...bothSides, wallCornerMode: "structural_pier", cornerPierWidthMm: 300 }, 1800, 1500).cornerPierWidthMm, 300);

const win = {
  windowId: "W-SURROUND",
  mark: "C-SUR",
  name: "包套测试窗",
  quantity: 2,
  widthMm: 1800,
  heightMm: 1500,
  seriesId: "AL70",
  colorInside: "RAL9016",
  colorOutside: "RAL7016",
  defaultGlassTypeId: "GL-LOWE-24",
  defaultHardwareSetId: "HW-TURN-STD",
  installation: { sillHeightMm: 0, surround: bothSides },
  geometryMode: "grid",
  layout: {
    columns: [1],
    rows: [1],
    cells: [{ cellId: "CELL-SUR", type: "fixed_glass", opening: "fixed" }]
  }
};
const bom = calculateProjectBom({
  catalog: structuredClone(defaultCatalog),
  calculation: { status: "calculated", mbomVersion: 1 },
  windows: [win],
  joints: [],
  assemblies: []
});
const installationEbom = bom.ebom.find(item => item.type === "installation_surround");
assert.ok(installationEbom, "enabled surrounds should have an EBOM source object");
assert.equal(installationEbom.perimeterMm, 6600);
assert.equal(bom.mbom.lines.filter(line => line.sourceComponentId.startsWith("installation.surround.outside.")).length, 4);
assert.equal(bom.mbom.lines.filter(line => line.sourceComponentId.startsWith("installation.surround.inside.")).length, 4);
assert.equal(bom.mbom.lines.filter(line => line.sourceComponentId.startsWith("installation.surround.liner.")).length, 4);
assert.equal(bom.mbom.lines.find(line => line.sourceComponentId === "installation.surround.corner_connector").quantity, 16);
assert.equal(bom.mbom.lines.find(line => line.sourceComponentId === "installation.surround.seal").quantity, 13.2);

const schema = JSON.parse(readFileSync(new URL("../docs/door-window-design.v2.schema.json", import.meta.url), "utf8"));
assert.equal(schema.$defs.installation.properties.surround.$ref, "#/$defs/installationSurround");
assert.ok(schema.$defs.installationSurround.required.includes("wallThicknessMm"));
assert.ok(schema.$defs.installationSurround.required.includes("wallMaterialId"));
assert.ok(schema.$defs.installationSurround.required.includes("wallCornerMode"));
assert.ok(schema.$defs.installationSurround.required.includes("cornerPierWidthMm"));
assert.deepEqual(schema.$defs.installationSurround.properties.wallMaterialId.enum, ["plaster", "concrete", "red_brick", "gray_brick", "stone"]);
assert.deepEqual(schema.$defs.installationSurround.properties.wallCornerMode.enum, ["structural_pier", "open_corner"]);

const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
[
  "btnConfigureSurround",
  "inspector-installation",
  "surroundEnabled",
  "installationMountingMode",
  "installationFrameAlignment",
  "wallMaterial",
  "wallCornerMode",
  "cornerPierWidth",
  "surroundStyle",
  "surroundEdgeMode",
  "installationDetailPreview",
  "installationSummary"
].forEach(id => assert.ok(html.includes(`id="${id}"`), `${id} should be available in the installation workbench`));

const app = readFileSync(new URL("../dist/assets/app.js", import.meta.url), "utf8");
assert.ok(app.includes("function updatePreviewGround(groundY = 0)"), "3D ground should use an explicit finished-floor datum");
assert.ok(!app.includes("const groundY = bounds.min.y - 0.025"), "3D ground must not move with the lowest generated mesh");
assert.ok(app.includes('wallHost.userData.mountType = "wall-host"'), "3D windows should be mounted under a wall host");
assert.ok(app.includes('frameMount.userData.mountType = "window-frame"'), "3D frames should use an installation mount below the wall host");
assert.ok(app.includes("const wallCenterZ = placement.effectiveFrameOffsetMm * scale"), "3D wall depth should use the same centerline placement as the installation section");
assert.ok(!app.includes("const wallCenterZ = -wallDepth / 2 - installation.frameOffsetMm * scale"), "zero frame offset must not place the frame on the exterior wall face");
assert.ok(app.includes("主立面：室外侧观察"), "3D preview should state which side of the primary facade is being observed");
assert.ok(app.includes("const floorY = -height / 2 - sillHeight"), "wall openings should derive their bottom from sill height");
assert.ok(app.includes("if (sillHeight > 0.001)"), "wall infill below the window should only exist above a non-zero sill");
assert.ok(app.includes("const wallMarginMm = Math.max(420"), "3D walls should extend visibly beyond the opening");
assert.ok(app.includes("resolveFramePlacement(installation, depth / scale)"), "3D wall and frame depth should be resolved by the shared installation placement rule");
assert.ok(app.includes("function createThreeGroundSideLabel("), "indoor/outdoor labels should be generated as ground markers");
assert.ok(app.includes("new THREE.PlaneGeometry(0.52, 0.195)"), "ground labels should use horizontal plane geometry instead of camera-facing sprites");
assert.ok(app.includes("marker.rotation.x = -Math.PI / 2"), "indoor/outdoor labels should lie flat on the finished floor");
assert.ok(app.includes("const labelY = floorY + 0.012"), "ground labels should remain just above the finished-floor datum");
assert.ok(app.includes("function createThreeWallMaterial(materialId, modelScale = 1)"), "3D wall finishes should be generated from the selected installation material and model scale");
assert.ok(app.includes("wall: createThreeWallMaterial(surround.wallMaterialId, scale)"), "3D walls should consume the normalized wall material field and shared scale");
assert.ok(app.includes("function applyScaledWallUvs("), "wall meshes should share dimension-based texture mapping");
assert.ok(app.includes("material.userData.wallTextureSize"), "wall material should expose one physical texture scale to every wall mesh");
assert.ok(app.includes("texture.repeat.set(1, 1)"), "wall texture frequency should be controlled by geometry dimensions rather than per-object repeats");
assert.ok(!app.includes("texture.repeat.set(materialId?.includes(\"brick\") ? 3.6"), "wall boxes must not stretch the same fixed repeat count over different dimensions");
assert.ok(!app.includes("function updateThreeWallCutaway(viewSide)"), "real corner host walls should remain visible from indoor and outdoor observation sides");
const pocketHousingSource = app.slice(app.indexOf("function addPocketHousing("), app.indexOf("function addParallelProjectCell("));
assert.ok(pocketHousingSource.includes('pocketMouth.userData.mountType = "frame-pocket-mouth"'), "pocket sliding should render a frame-mounted pocket mouth");
assert.ok(pocketHousingSource.includes("rect.w / 2 - lipWidth / 2"), "the pocket mouth should remain inside its owning cell boundary");
assert.ok(!pocketHousingSource.includes("mats.wall"), "a window pocket cassette must not create a solid building wall inside the window opening");
assert.ok(app.includes("function addThreeCornerWallPier("), "3D corner windows should be hosted by an independent structural wall-corner model");
const cornerPierSource = app.slice(app.indexOf("function addThreeCornerWallPier("), app.indexOf("function addMiteredWallBand("));
assert.ok(cornerPierSource.includes("const pier = addMiteredWallBand("), "the structural corner pier should be one continuous mitered solid");
assert.ok(cornerPierSource.includes('pier.userData.mountType = "structural-corner-wall-pier"'), "the unified wall pier should identify the structural corner host");
assert.ok(!cornerPierSource.includes("addBox("), "the structural corner pier must not contain intersecting coplanar boxes");
assert.ok(app.includes("function renderPlanCornerWallPier("), "the plan view should expose the same structural corner wall node");
assert.ok(app.includes("const wallCornerX = anchorX + (structuralPier ? cornerPierWidth : 0)"), "the building corner must begin after the primary window opening instead of occupying it");
assert.ok(app.includes("returnOpeningOriginX: wallCornerX + Math.cos(angle) * returnOpeningOffset"), "the return-wall window must begin beyond the structural corner pier");
assert.ok(app.includes("returnFrame.position.set(cornerMount.returnOpeningOriginX, 0, cornerMount.returnOpeningOriginZ)"), "the return window frame must mount at its own opening boundary");
assert.ok(cornerPierSource.includes('{ x: cornerMount.anchorX, z: wallCenterZ }'), "the unified pier must begin at the primary opening boundary");
assert.ok(cornerPierSource.includes("openingTopY - floorY"), "the wall pier must stop where the header starts instead of overlapping it");
assert.ok(app.includes("const sideHeight = openingTopY - floorY"), "straight-wall jambs must stop below the header to avoid coplanar flicker");
assert.ok(app.includes("const sideHeight = height / 2 - floorY"), "corner-wall end jambs must stop below the header to avoid coplanar flicker");
assert.ok(app.includes("returnOriginX + Math.cos(angle) * distance"), "return-wing sashes must be positioned from the return opening rather than the wall centerline");
assert.ok(!app.includes("frameCorner"), "corner-wall geometry must not reference the removed pre-wall-pier anchor");

console.log("Validated installation-surround normalization, edge geometry, BOM output, UI hooks, schema, and fixed 3D installation datums.");
