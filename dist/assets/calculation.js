import { typeLabels } from "./catalog.js?v=20260912-27";
import { isGlassInfillType, isOperableType, normalizeOpeningAssembly } from "./openings.js?v=20260912-27";
import { findMemberHost, memberLengthMm, normalizeTopology, partitionTopologyRegion } from "./topology.js?v=20260912-27";
import { JOINT_STYLE_OPTIONS, defaultJointProfile, jointLengthMm, normalizeEngineeringJoints } from "./joints.js?v=20260912-27";
import { assemblySummary, normalizeWindowAssemblies } from "./assemblies.js?v=20260912-27";
import { surroundGeometry, surroundSideLabel, surroundSummary } from "./installations.js?v=20260912-27";

export function sum(list) {
      return list.reduce((a, b) => a + Number(b || 0), 0) || 1;
    }

export function cellIndex(row, col, cols) {
      return row * cols + col;
    }

export function materialName(material) {
      return { aluminum: "铝合金", pvc: "塑钢", wood: "木" }[material] || material;
    }

    function accessoryBom(type, cellW, cellH, qty) {
      const width = Math.round(cellW);
      const height = Math.round(cellH);
      const perimeterM = Math.round(((cellW + cellH) * 2 / 1000) * 10) / 10;
      const rows = {
        screen: {
          materialCode: "ACC-SCREEN",
          name: "纱窗组件",
          spec: "成品纱窗",
          quantity: qty,
          unit: "set"
        },
        louver: {
          materialCode: "ACC-LOUVER",
          name: "百叶组件",
          spec: "成品百叶",
          quantity: qty,
          unit: "set"
        },
        grille: {
          materialCode: "ACC-GRILLE",
          name: "装饰格条",
          spec: "横竖格条",
          quantity: Math.max(0.1, perimeterM * qty),
          unit: "m"
        }
      };
      return rows[type] || null;
    }

    function glassForCell(input, win, cell) {
      const id = cell?.glassTypeId || win.defaultGlassTypeId;
      return input.catalog.glassTypes.find(g => g.id === id) || input.catalog.glassTypes[0];
    }

    function hardwareForCell(input, win, cell) {
      const typeDefault = {
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
      }[cell?.type];
      const id = cell?.hardwareSetId || typeDefault || win.defaultHardwareSetId;
      return input.catalog.hardwareSets.find(h => h.id === id) || input.catalog.hardwareSets[0];
    }

    function sashGeometry(type, cellW, cellH, assembly) {
      if (["sliding", "lift_slide", "psk", "parallel_slide", "pocket_slide"].includes(type)) {
        return { count: assembly.panelCount, width: cellW / assembly.panelCount * 1.06, height: cellH };
      }
      if (type === "corner_slide") {
        return { count: assembly.panelCount, width: cellW / Math.ceil(assembly.panelCount / 2), height: cellH };
      }
      if (type === "vertical_slide") {
        return { count: assembly.panelCount, width: cellW, height: cellH * 0.56 };
      }
      if (type === "folding") {
        return { count: assembly.panelCount, width: cellW / assembly.panelCount, height: cellH };
      }
      if (["turn", "turn_tilt", "door"].includes(type)) {
        return { count: assembly.panelCount, width: cellW / assembly.panelCount, height: cellH };
      }
      return { count: 1, width: cellW, height: cellH };
    }

    function hardwareQuantities(type, assembly, hardware, height) {
      const active = Math.max(1, assembly.activePanelCount);
      if (type === "folding") {
        const groups = assembly.stackSide === "both" ? 2 : 1;
        return {
          handles: Math.max(groups, assembly.trafficDoor === "none" ? 1 : groups + 1),
          members: Math.max(2, (assembly.panelCount - groups) * 3 + groups * 2)
        };
      }
      if (["sliding", "lift_slide", "psk", "parallel_slide", "pocket_slide", "corner_slide", "vertical_slide"].includes(type)) {
        return { handles: active, members: active * 2 };
      }
      return { handles: active, members: active * calcHingeQty(hardware.hingeQtyRule, height) };
    }

    function addAssemblyBomLines(lines, context) {
      const { cell, assembly, series, sourceComponentId, sourceWindowId, sourceMark, cellW, cellH, frameColor, qty, mitered } = context;
      if (["sliding", "lift_slide", "psk", "parallel_slide", "pocket_slide", "corner_slide", "vertical_slide", "folding"].includes(cell.type)) {
        const vertical = cell.type === "vertical_slide";
        const length = vertical ? cellH : cellW;
        const cornerMultiplier = cell.type === "corner_slide" ? 2 : 1;
        addBomLine(lines, {
          sourceWindowId,
          sourceMark,
          sourceComponentId: `${sourceComponentId}.track`,
          category: "profile",
          materialCode: series.trackProfile || `${series.sashProfile}-TRACK`,
          name: vertical ? "提拉导轨" : (cell.type === "folding" ? "折叠承重轨" : (cell.type === "pocket_slide" ? "入墙隐藏轨道" : (cell.type === "corner_slide" ? "转角推拉轨道" : "推拉轨道"))),
          spec: `${assembly.trackCount}轨 · ${typeLabels[cell.type]}`,
          material: materialName(series.material),
          color: frameColor,
          lengthMm: Math.round(length),
          widthMm: 0,
          heightMm: 0,
          cutLeftDeg: 90,
          cutRightDeg: 90,
          grossLengthMm: grossLength(length, series, false),
          quantity: qty * assembly.trackCount * cornerMultiplier,
          unit: "pcs"
        });
      }

      if (assembly.panelCount > 1 && assembly.mullionMode === "flying_mullion") {
        addBomLine(lines, {
          sourceWindowId,
          sourceMark,
          sourceComponentId: `${sourceComponentId}.flyingMullion`,
          category: "profile",
          materialCode: series.flyingMullionProfile || series.mullionProfile,
          name: "假中梃",
          spec: series.name,
          material: materialName(series.material),
          color: frameColor,
          lengthMm: Math.round(cellH),
          widthMm: 0,
          heightMm: 0,
          cutLeftDeg: mitered ? 45 : 90,
          cutRightDeg: mitered ? 45 : 90,
          grossLengthMm: grossLength(cellH, series, mitered),
          quantity: qty,
          unit: "pcs"
        });
      }

      if (assembly.screenMode !== "none") {
        const screen = {
          fixed: ["ACC-SCREEN-FIXED", "固定纱窗"],
          swing: ["ACC-SCREEN-SWING", "平开纱扇"],
          sliding: ["ACC-SCREEN-SLIDE", "推拉纱扇"],
          retractable: ["ACC-SCREEN-ROLL", "卷轴纱窗"]
        }[assembly.screenMode];
        addBomLine(lines, {
          sourceWindowId,
          sourceMark,
          sourceComponentId: `${sourceComponentId}.screen`,
          category: "accessory",
          materialCode: screen[0],
          name: screen[1],
          spec: `${Math.round(cellW)}x${Math.round(cellH)}`,
          material: "纱窗组件",
          color: frameColor,
          lengthMm: 0,
          widthMm: Math.round(cellW),
          heightMm: Math.round(cellH),
          cutLeftDeg: 0,
          cutRightDeg: 0,
          grossLengthMm: 0,
          quantity: qty,
          unit: "set"
        });
      }

      if (["micro", "night"].includes(assembly.ventilationMode)) {
        addBomLine(lines, {
          sourceWindowId,
          sourceMark,
          sourceComponentId: `${sourceComponentId}.ventilation`,
          category: "hardware",
          materialCode: assembly.ventilationMode === "micro" ? "HW-VENT-MICRO" : "HW-VENT-NIGHT",
          name: assembly.ventilationMode === "micro" ? "微通风组件" : "夜间通风限位组件",
          spec: typeLabels[cell.type],
          material: "五金",
          color: "",
          lengthMm: 0,
          widthMm: 0,
          heightMm: 0,
          cutLeftDeg: 0,
          cutRightDeg: 0,
          grossLengthMm: 0,
          quantity: qty * Math.max(1, assembly.activePanelCount),
          unit: "set"
        });
      }

      if (cell.type === "folding" && assembly.trafficDoor !== "none") {
        addBomLine(lines, {
          sourceWindowId,
          sourceMark,
          sourceComponentId: `${sourceComponentId}.trafficDoor`,
          category: "hardware",
          materialCode: "HW-FOLD-TRAFFIC",
          name: "折叠通行扇五金包",
          spec: assembly.trafficDoor === "right" ? "右通行扇" : "左通行扇",
          material: "五金",
          color: "",
          lengthMm: 0,
          widthMm: 0,
          heightMm: 0,
          cutLeftDeg: 0,
          cutRightDeg: 0,
          grossLengthMm: 0,
          quantity: qty,
          unit: "set"
        });
      }

      if (cell.type === "pocket_slide") {
        const pocketDepth = assembly.pocketDepthMm || Math.round(cellW / Math.max(1, assembly.panelCount));
        addBomLine(lines, {
          sourceWindowId,
          sourceMark,
          sourceComponentId: `${sourceComponentId}.pocket`,
          category: "accessory",
          materialCode: "ACC-POCKET-CASSETTE",
          name: "入墙盒体/检修组件",
          spec: `${pocketDepth}x${Math.round(cellH)}`,
          material: "门窗配件",
          color: frameColor,
          lengthMm: 0,
          widthMm: pocketDepth,
          heightMm: Math.round(cellH),
          cutLeftDeg: 0,
          cutRightDeg: 0,
          grossLengthMm: 0,
          quantity: qty * (assembly.stackSide === "both" ? 2 : 1),
          unit: "set"
        });
      }

      if (cell.type === "corner_slide") {
        const postless = assembly.cornerPostMode === "postless";
        addBomLine(lines, {
          sourceWindowId,
          sourceMark,
          sourceComponentId: `${sourceComponentId}.corner`,
          category: postless ? "hardware" : "profile",
          materialCode: postless ? "HW-CORNER-SEAL" : (series.cornerPostProfile || series.mullionProfile),
          name: postless ? "无柱转角闭合密封件" : "转角立柱",
          spec: `${assembly.cornerAngleDeg}°`,
          material: postless ? "五金/密封" : materialName(series.material),
          color: postless ? "" : frameColor,
          lengthMm: postless ? 0 : Math.round(cellH),
          widthMm: 0,
          heightMm: 0,
          cutLeftDeg: 90,
          cutRightDeg: 90,
          grossLengthMm: postless ? 0 : grossLength(cellH, series, false),
          quantity: qty,
          unit: postless ? "set" : "pcs"
        });
      }
    }

    function calcHingeQty(rule, height) {
      if (!rule) return 2;
      if (rule === "2") return 2;
      if (rule.includes("2200")) return height > 2200 ? 4 : 3;
      if (rule.includes("1800")) return height > 1800 ? 3 : 2;
      return Number(rule) || 2;
    }

    function makeLineId(prefix, index) {
      return `${prefix}-${String(index + 1).padStart(4, "0")}`;
    }

    function addBomLine(lines, line) {
      lines.push({
        lineId: makeLineId("MBOM", lines.length),
        ...line
      });
    }

    function grossLength(net, series, mitered) {
      const kerf = Number(series.sawKerfMm || 4);
      if (mitered) return Math.round((net + kerf + 2 * Number(series.faceWidthMm || 70)) * 10) / 10;
      return Math.round((net + kerf + 40) * 10) / 10;
    }

export function calculateProjectBom(input) {
      const lines = [];
      const ebom = [];
      input.windows.forEach(win => calculateWindowBom(input, win, lines, ebom));
      const joints = normalizeEngineeringJoints(input.joints, input.windows);
      joints.forEach(joint => calculateJointBom(input, joint, lines, ebom));
      const assemblies = normalizeWindowAssemblies(input.assemblies, input.windows, joints);
      const assemblyBom = assemblies.map(assembly => {
        const summary = assemblySummary(assembly, input.windows);
        const windowIds = new Set(summary.windowIds);
        const jointIds = new Set(summary.jointIds);
        const mbomLineIds = lines
          .filter(line => windowIds.has(line.sourceWindowId))
          .filter(line => !line.sourceComponentId?.startsWith("joint.") || [...jointIds].some(jointId => line.sourceComponentId.startsWith(`joint.${jointId}.`)))
          .map(line => line.lineId);
        const item = {
          ...summary,
          placementCount: assembly.placements.length,
          mbomLineIds
        };
        ebom.push({
          type: "window_assembly",
          sourceAssemblyId: assembly.assemblyId,
          ownership: "project",
          ...structuredClone(item)
        });
        return item;
      });
      const summary = aggregateBom(lines);
      const cutRequirements = lines
        .filter(line => line.category === "profile" || line.category === "bead")
        .map(line => ({
          sourceWindowId: line.sourceWindowId,
          sourceComponentId: line.sourceComponentId,
          materialCode: line.materialCode,
          color: line.color,
          lengthMm: line.lengthMm,
          cutLeftDeg: line.cutLeftDeg,
          cutRightDeg: line.cutRightDeg,
          quantity: line.quantity
        }));
      return {
        ebom,
        mbom: {
          version: input.calculation?.mbomVersion || 0,
          status: input.calculation?.status || "draft",
          generatedAt: new Date().toISOString(),
          lines
        },
        assemblies: assemblyBom,
        summary,
        cutRequirements
      };
    }

    function calculateJointBom(input, joint, lines, ebom) {
      const win = input.windows.find(item => item.windowId === joint.hostWindowId);
      if (!win) return;
      const series = input.catalog.profileSystems.find(item => item.id === win.seriesId) || input.catalog.profileSystems[0];
      const qty = Math.max(1, Number(win.quantity || 1));
      const length = jointLengthMm(joint, win);
      const frameColor = `${win.colorInside}/${win.colorOutside}`;
      const styleName = JOINT_STYLE_OPTIONS[joint.type].find(item => item.value === joint.style)?.label || joint.style;
      const typeName = joint.type === "corner" ? "转角节点" : "拼接节点";
      const sourceComponentId = `joint.${joint.jointId}`;
      const spec = [
        styleName,
        joint.type === "corner" ? `${joint.angleDeg}°` : "180°",
        joint.orientation === "normal" ? "正装" : "反装",
        `A${joint.legWidthAMm}/B${joint.legWidthBMm}`
      ].join(" · ");

      ebom.push({
        sourceWindowId: win.windowId,
        sourceComponentId,
        type: "engineering_joint",
        joint: structuredClone(joint),
        lengthMm: Math.round(length),
        ownership: win.windowId
      });

      if (joint.postMode !== "postless") {
        addBomLine(lines, {
          sourceWindowId: win.windowId,
          sourceMark: win.mark,
          sourceComponentId: `${sourceComponentId}.profile`,
          category: "profile",
          materialCode: joint.profileId || defaultJointProfile(joint.type, series),
          name: `${typeName}型材`,
          spec,
          material: materialName(series.material),
          color: frameColor,
          lengthMm: Math.round(length),
          widthMm: 0,
          heightMm: 0,
          cutLeftDeg: 90,
          cutRightDeg: 90,
          jointAngleDeg: joint.angleDeg,
          grossLengthMm: grossLength(length, series, false),
          quantity: qty,
          unit: "pcs"
        });
      }

      addBomLine(lines, {
        sourceWindowId: win.windowId,
        sourceMark: win.mark,
        sourceComponentId: `${sourceComponentId}.connector`,
        category: "hardware",
        materialCode: joint.type === "corner" ? "ACC-CORNER-CONNECTOR" : "ACC-SPLICE-CONNECTOR",
        name: `${typeName}连接件`,
        spec,
        material: "连接件",
        color: "",
        lengthMm: 0,
        widthMm: 0,
        heightMm: 0,
        cutLeftDeg: 0,
        cutRightDeg: 0,
        grossLengthMm: 0,
        quantity: qty * 2,
        unit: "set"
      });

      if (joint.type === "corner") {
        addBomLine(lines, {
          sourceWindowId: win.windowId,
          sourceMark: win.mark,
          sourceComponentId: `${sourceComponentId}.seal`,
          category: "gasket",
          materialCode: joint.postMode === "postless" ? "SEAL-CORNER-POSTLESS" : "SEAL-CORNER-JOINT",
          name: joint.postMode === "postless" ? "无柱转角密封" : "转角连接密封",
          spec: `${joint.angleDeg}° · ${joint.orientation === "normal" ? "正装" : "反装"}`,
          material: "EPDM",
          color: "黑色",
          lengthMm: Math.round(length),
          widthMm: 0,
          heightMm: 0,
          cutLeftDeg: 0,
          cutRightDeg: 0,
          grossLengthMm: 0,
          quantity: Math.round(length * qty / 100) / 10,
          unit: "m"
        });
      }

      const fastenerCount = Math.max(2, Math.ceil(length / joint.fastenerSpacingMm) + 1);
      addBomLine(lines, {
        sourceWindowId: win.windowId,
        sourceMark: win.mark,
        sourceComponentId: `${sourceComponentId}.fastener`,
        category: "hardware",
        materialCode: "FASTENER-JOINT-SS",
        name: "节点不锈钢紧固件",
        spec: `间距不大于${joint.fastenerSpacingMm} mm`,
        material: "不锈钢",
        color: "",
        lengthMm: 0,
        widthMm: 0,
        heightMm: 0,
        cutLeftDeg: 0,
        cutRightDeg: 0,
        grossLengthMm: 0,
        quantity: fastenerCount * qty,
        unit: "pcs"
      });
    }

    function glazingRegionsForCell(topology, cell, cellW, cellH, face) {
      const members = topology.members.filter(member => member.hostRegionId === cell.cellId);
      if (!members.length) return [{ widthMm: cellW, heightMm: cellH }];
      const partition = partitionTopologyRegion(members);
      if (!partition.valid || partition.regions.length <= 1) return [{ widthMm: cellW, heightMm: cellH }];
      return partition.regions.map(region => ({
        widthMm: Math.max(0,
          (region.xEnd - region.xStart) * cellW
          - (region.xStart > 0 ? face / 2 : 0)
          - (region.xEnd < 1 ? face / 2 : 0)),
        heightMm: Math.max(0,
          (region.yEnd - region.yStart) * cellH
          - (region.yStart > 0 ? face / 2 : 0)
          - (region.yEnd < 1 ? face / 2 : 0))
      }));
    }

    function addGlazingBomLines(lines, context) {
      const {
        input,
        win,
        cell,
        glass,
        series,
        sourceComponentId,
        frameColor,
        sash,
        regions,
        clear,
        qty
      } = context;
      regions.forEach((region, index) => {
        const split = regions.length > 1;
        const pieceSourceId = split ? `${sourceComponentId}.glass.${index + 1}` : `${sourceComponentId}.glass`;
        const glassW = Math.max(0, (split ? region.widthMm : sash.width) - clear);
        const glassH = Math.max(0, (split ? region.heightMm : sash.height) - clear);
        const count = split ? qty : qty * sash.count;
        const area = Math.round((glassW * glassH / 1000000) * 1000) / 1000;
        addBomLine(lines, {
          sourceWindowId: win.windowId,
          sourceMark: win.mark,
          sourceComponentId: pieceSourceId,
          category: "glass",
          materialCode: glass.id,
          name: glass.name,
          spec: `${Math.round(glassW)}x${Math.round(glassH)}x${glass.thicknessMm}`,
          material: "玻璃",
          color: "",
          lengthMm: 0,
          widthMm: Math.round(glassW),
          heightMm: Math.round(glassH),
          cutLeftDeg: 0,
          cutRightDeg: 0,
          grossLengthMm: 0,
          quantity: count,
          unit: "pcs",
          areaM2: area
        });

        const perimeter = Math.round(2 * (glassW + glassH));
        addBomLine(lines, {
          sourceWindowId: win.windowId,
          sourceMark: win.mark,
          sourceComponentId: `${pieceSourceId}.gasket`,
          category: "gasket",
          materialCode: series.gasketCode,
          name: "玻璃胶条",
          spec: glass.name,
          material: "EPDM",
          color: "黑色",
          lengthMm: perimeter,
          widthMm: 0,
          heightMm: 0,
          cutLeftDeg: 0,
          cutRightDeg: 0,
          grossLengthMm: 0,
          quantity: Math.round(perimeter * count / 100) / 10,
          unit: "m"
        });

        addBomLine(lines, {
          sourceWindowId: win.windowId,
          sourceMark: win.mark,
          sourceComponentId: `${pieceSourceId}.bead.h`,
          category: "bead",
          materialCode: series.beadProfile,
          name: "玻璃压条-横",
          spec: glass.name,
          material: materialName(series.material),
          color: frameColor,
          lengthMm: Math.round(glassW),
          widthMm: 0,
          heightMm: 0,
          cutLeftDeg: 45,
          cutRightDeg: 45,
          grossLengthMm: grossLength(glassW, series, true),
          quantity: count * 2,
          unit: "pcs"
        });

        addBomLine(lines, {
          sourceWindowId: win.windowId,
          sourceMark: win.mark,
          sourceComponentId: `${pieceSourceId}.bead.v`,
          category: "bead",
          materialCode: series.beadProfile,
          name: "玻璃压条-竖",
          spec: glass.name,
          material: materialName(series.material),
          color: frameColor,
          lengthMm: Math.round(glassH),
          widthMm: 0,
          heightMm: 0,
          cutLeftDeg: 45,
          cutRightDeg: 45,
          grossLengthMm: grossLength(glassH, series, true),
          quantity: count * 2,
          unit: "pcs"
        });
      });
    }

    function calculateSurroundBom(win, series, lines, ebom, qty) {
      const geometry = surroundGeometry(win.installation?.surround, win.widthMm, win.heightMm);
      if (!geometry.surround.enabled || !geometry.pieces.length) return;
      const summary = surroundSummary(geometry.surround, win.widthMm, win.heightMm);
      const sourceComponentId = "installation.surround";
      ebom.push({
        sourceWindowId: win.windowId,
        sourceComponentId,
        type: "installation_surround",
        surround: structuredClone(geometry.surround),
        sides: geometry.sides,
        perimeterMm: geometry.perimeterMm,
        linerAreaM2: geometry.linerAreaM2
      });

      const trimLayers = [
        geometry.outsideEnabled ? { id: "outside", name: "外包套", widthMm: geometry.surround.outsideWidthMm, color: geometry.surround.colorOutside } : null,
        geometry.insideEnabled ? { id: "inside", name: "内包套", widthMm: geometry.surround.insideWidthMm, color: geometry.surround.colorInside } : null
      ].filter(Boolean);
      trimLayers.forEach(layer => {
        geometry.pieces.forEach(piece => addBomLine(lines, {
          sourceWindowId: win.windowId,
          sourceMark: win.mark,
          sourceComponentId: `${sourceComponentId}.${layer.id}.${piece.side}`,
          category: "profile",
          materialCode: geometry.surround.materialCode,
          name: `${layer.name}-${surroundSideLabel(piece.side)}`,
          spec: `${summary.style} · ${layer.widthMm}×${geometry.surround.boardThicknessMm} mm`,
          material: materialName(series.material),
          color: layer.color,
          lengthMm: Math.round(piece.lengthMm),
          widthMm: 0,
          heightMm: 0,
          cutLeftDeg: 45,
          cutRightDeg: 45,
          grossLengthMm: grossLength(piece.lengthMm, series, true),
          quantity: qty,
          unit: "pcs"
        }));
      });

      if (geometry.linerEnabled) {
        geometry.pieces.forEach(piece => addBomLine(lines, {
          sourceWindowId: win.windowId,
          sourceMark: win.mark,
          sourceComponentId: `${sourceComponentId}.liner.${piece.side}`,
          category: "panel",
          materialCode: `${geometry.surround.materialCode}-LINER`,
          name: `洞口衬板-${surroundSideLabel(piece.side)}`,
          spec: `${geometry.surround.wallThicknessMm}×${geometry.surround.boardThicknessMm} mm`,
          material: "安装板材",
          color: geometry.surround.colorInside,
          lengthMm: 0,
          widthMm: Math.round(geometry.surround.wallThicknessMm),
          heightMm: Math.round(piece.lengthMm),
          cutLeftDeg: 0,
          cutRightDeg: 0,
          grossLengthMm: 0,
          quantity: qty,
          unit: "pcs"
        }));
      }

      const trimLayerCount = trimLayers.length;
      if (geometry.cornerCount && trimLayerCount) {
        addBomLine(lines, {
          sourceWindowId: win.windowId,
          sourceMark: win.mark,
          sourceComponentId: `${sourceComponentId}.corner_connector`,
          category: "accessory",
          materialCode: `${geometry.surround.materialCode}-CORNER`,
          name: "包套转角连接件",
          spec: `${summary.edgeMode} · ${geometry.surround.boardThicknessMm} mm`,
          material: "安装辅件",
          color: "",
          lengthMm: 0,
          widthMm: 0,
          heightMm: 0,
          cutLeftDeg: 0,
          cutRightDeg: 0,
          grossLengthMm: 0,
          quantity: qty * geometry.cornerCount * trimLayerCount,
          unit: "pcs"
        });
      }
      addBomLine(lines, {
        sourceWindowId: win.windowId,
        sourceMark: win.mark,
        sourceComponentId: `${sourceComponentId}.seal`,
        category: "gasket",
        materialCode: "SEAL-INSTALL-SURROUND",
        name: "包套收口密封",
        spec: `${summary.edgeMode} · ${geometry.surround.wallThicknessMm} mm墙厚`,
        material: "密封材料",
        color: "",
        lengthMm: Math.round(geometry.perimeterMm),
        widthMm: 0,
        heightMm: 0,
        cutLeftDeg: 0,
        cutRightDeg: 0,
        grossLengthMm: 0,
        quantity: Math.round(geometry.perimeterMm * qty / 10) / 100,
        unit: "m"
      });
    }

    function calculateWindowBom(input, win, lines, ebom) {
      const series = input.catalog.profileSystems.find(s => s.id === win.seriesId) || input.catalog.profileSystems[0];
      const qty = Math.max(1, Number(win.quantity || 1));
      const width = Number(win.widthMm);
      const height = Number(win.heightMm);
      const face = Number(series.faceWidthMm || 70);
      const sashFace = Number(series.sashFaceWidthMm || 58);
      const innerW = Math.max(0, width - 2 * face);
      const innerH = Math.max(0, height - 2 * face);
      const mitered = series.material === "aluminum" || series.material === "pvc";
      const frameColor = `${win.colorInside}/${win.colorOutside}`;
      const frameMembers = [
        ["frame.top", "上框", width],
        ["frame.bottom", "下框", width],
        ["frame.left", "左框", height],
        ["frame.right", "右框", height]
      ];

      ebom.push({
        sourceWindowId: win.windowId,
        mark: win.mark,
        type: "window",
        widthMm: width,
        heightMm: height,
        quantity: qty,
        seriesId: win.seriesId,
        geometryMode: win.geometryMode || "grid",
        layout: win.layout,
        topology: normalizeTopology(win.topology, win.layout)
      });

      frameMembers.forEach(([id, name, len]) => {
        addBomLine(lines, {
          sourceWindowId: win.windowId,
          sourceMark: win.mark,
          sourceComponentId: id,
          category: "profile",
          materialCode: series.frameProfile,
          name,
          spec: series.name,
          material: materialName(series.material),
          color: frameColor,
          lengthMm: Math.round(len),
          widthMm: 0,
          heightMm: 0,
          cutLeftDeg: mitered ? 45 : 90,
          cutRightDeg: mitered ? 45 : 90,
          grossLengthMm: grossLength(len, series, mitered),
          quantity: qty,
          unit: "pcs"
        });
      });

      const cols = win.layout.columns.length;
      const rows = win.layout.rows.length;
      const colTotal = sum(win.layout.columns);
      const rowTotal = sum(win.layout.rows);
      const colWidths = win.layout.columns.map(v => innerW * v / colTotal);
      const rowHeights = win.layout.rows.map(v => innerH * v / rowTotal);

      for (let c = 1; c < cols; c += 1) {
        addBomLine(lines, {
          sourceWindowId: win.windowId,
          sourceMark: win.mark,
          sourceComponentId: `divider.v.${c}`,
          category: "profile",
          materialCode: series.mullionProfile,
          name: "竖梃",
          spec: series.name,
          material: materialName(series.material),
          color: frameColor,
          lengthMm: Math.round(innerH),
          widthMm: 0,
          heightMm: 0,
          cutLeftDeg: 90,
          cutRightDeg: 90,
          grossLengthMm: grossLength(innerH, series, false),
          quantity: qty,
          unit: "pcs"
        });
      }

      for (let r = 1; r < rows; r += 1) {
        addBomLine(lines, {
          sourceWindowId: win.windowId,
          sourceMark: win.mark,
          sourceComponentId: `divider.h.${r}`,
          category: "profile",
          materialCode: series.mullionProfile,
          name: "横梃",
          spec: series.name,
          material: materialName(series.material),
          color: frameColor,
          lengthMm: Math.round(innerW),
          widthMm: 0,
          heightMm: 0,
          cutLeftDeg: 90,
          cutRightDeg: 90,
          grossLengthMm: grossLength(innerW, series, false),
          quantity: qty,
          unit: "pcs"
        });
      }

      const topology = normalizeTopology(win.topology, win.layout);
      topology.members.forEach(member => {
        const host = findMemberHost(win.layout, member);
        const length = memberLengthMm(member, win, face);
        if (!host || length <= 0) return;
        const sourceComponentId = `topology.member.${member.memberId}`;
        const orientationName = member.orientation === "horizontal" ? "横梃" : "竖梃";
        const modeName = member.throughMode === "continuous" ? "连续" : "局部";
        ebom.push({
          sourceWindowId: win.windowId,
          sourceComponentId,
          type: "mullion",
          orientation: member.orientation,
          hostRegionId: member.hostRegionId,
          widthMm: member.orientation === "horizontal" ? Math.round(length) : Math.round(face),
          heightMm: member.orientation === "vertical" ? Math.round(length) : Math.round(face),
          profileId: member.profileId || series.mullionProfile,
          connectionStart: member.connectionStart,
          connectionEnd: member.connectionEnd
        });
        addBomLine(lines, {
          sourceWindowId: win.windowId,
          sourceMark: win.mark,
          sourceComponentId,
          category: "profile",
          materialCode: member.profileId || series.mullionProfile,
          name: `${modeName}${orientationName}`,
          spec: `${series.name} · ${host.col + 1}列${host.row + 1}行`,
          material: materialName(series.material),
          color: frameColor,
          lengthMm: Math.round(length),
          widthMm: 0,
          heightMm: 0,
          cutLeftDeg: 90,
          cutRightDeg: 90,
          grossLengthMm: grossLength(length, series, false),
          quantity: qty,
          unit: "pcs"
        });
      });

      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const idx = cellIndex(r, c, cols);
          const cell = win.layout.cells[idx];
          const cellW = Math.max(0, colWidths[c] - (cols > 1 ? face * 0.35 : 0));
          const cellH = Math.max(0, rowHeights[r] - (rows > 1 ? face * 0.35 : 0));
          const sourceComponentId = `cell.${r + 1}.${c + 1}`;
          if (cell.type === "empty") continue;
          const assembly = normalizeOpeningAssembly(cell.type, cell.opening, cell.openingAssembly);

          ebom.push({
            sourceWindowId: win.windowId,
            sourceComponentId,
            type: cell.type,
            opening: cell.opening,
            openingAssembly: assembly,
            widthMm: Math.round(cellW),
            heightMm: Math.round(cellH)
          });

          if (cell.type === "panel") {
            const panel = input.catalog.panelTypes.find(p => p.id === cell.panelTypeId) || input.catalog.panelTypes[0];
            addBomLine(lines, {
              sourceWindowId: win.windowId,
              sourceMark: win.mark,
              sourceComponentId,
              category: "panel",
              materialCode: panel.id,
              name: panel.name,
              spec: `${Math.round(cellW)}x${Math.round(cellH)}x${panel.thicknessMm}`,
              material: "板材",
              color: frameColor,
              lengthMm: 0,
              widthMm: Math.round(cellW),
              heightMm: Math.round(cellH),
              cutLeftDeg: 0,
              cutRightDeg: 0,
              grossLengthMm: 0,
              quantity: qty,
              unit: "pcs"
            });
            continue;
          }

          const accessory = accessoryBom(cell.type, cellW, cellH, qty);
          if (accessory) {
            addBomLine(lines, {
              sourceWindowId: win.windowId,
              sourceMark: win.mark,
              sourceComponentId,
              category: "accessory",
              materialCode: accessory.materialCode,
              name: accessory.name,
              spec: accessory.spec,
              material: "门窗配件",
              color: frameColor,
              lengthMm: 0,
              widthMm: Math.round(cellW),
              heightMm: Math.round(cellH),
              cutLeftDeg: 0,
              cutRightDeg: 0,
              grossLengthMm: 0,
              quantity: accessory.quantity,
              unit: accessory.unit
            });
            continue;
          }

          const sash = sashGeometry(cell.type, cellW, cellH, assembly);
          if (isOperableType(cell.type)) {
            const sashMembers = [
              ["sash.top", "扇上料", sash.width],
              ["sash.bottom", "扇下料", sash.width],
              ["sash.left", "扇左料", sash.height],
              ["sash.right", "扇右料", sash.height]
            ];
            sashMembers.forEach(([id, name, len]) => {
              addBomLine(lines, {
                sourceWindowId: win.windowId,
                sourceMark: win.mark,
                sourceComponentId: `${sourceComponentId}.${id}`,
                category: "profile",
                materialCode: series.sashProfile,
                name,
                spec: series.name,
                material: materialName(series.material),
                color: frameColor,
                lengthMm: Math.round(len),
                widthMm: 0,
                heightMm: 0,
                cutLeftDeg: mitered ? 45 : 90,
                cutRightDeg: mitered ? 45 : 90,
                grossLengthMm: grossLength(len, series, mitered),
                quantity: qty * sash.count,
                unit: "pcs"
              });
            });

            const hardware = hardwareForCell(input, win, cell);
            const hardwareQty = hardwareQuantities(cell.type, assembly, hardware, cellH);
            addBomLine(lines, {
              sourceWindowId: win.windowId,
              sourceMark: win.mark,
              sourceComponentId: `${sourceComponentId}.handle`,
              category: "hardware",
              materialCode: hardware.handleCode,
              name: hardware.name,
              spec: typeLabels[cell.type],
              material: "五金",
              color: "",
              lengthMm: 0,
              widthMm: 0,
              heightMm: 0,
              cutLeftDeg: 0,
              cutRightDeg: 0,
              grossLengthMm: 0,
              quantity: qty * hardwareQty.handles,
              unit: "set"
            });
            addBomLine(lines, {
              sourceWindowId: win.windowId,
              sourceMark: win.mark,
              sourceComponentId: `${sourceComponentId}.hinge`,
              category: "hardware",
              materialCode: hardware.hingeCode,
              name: hardware.memberName || "合页/铰链",
              spec: hardware.name,
              material: "五金",
              color: "",
              lengthMm: 0,
              widthMm: 0,
              heightMm: 0,
              cutLeftDeg: 0,
              cutRightDeg: 0,
              grossLengthMm: 0,
              quantity: qty * hardwareQty.members,
              unit: "pcs"
            });
            addAssemblyBomLines(lines, {
              cell,
              assembly,
              series,
              sourceComponentId,
              sourceWindowId: win.windowId,
              sourceMark: win.mark,
              cellW,
              cellH,
              frameColor,
              qty,
              mitered
            });
          }

          if (!isGlassInfillType(cell.type)) continue;

          const glass = glassForCell(input, win, cell);
          const clear = isOperableType(cell.type) ? sashFace + 22 : 24;
          const regions = isOperableType(cell.type)
            ? [{ widthMm: cellW, heightMm: cellH }]
            : glazingRegionsForCell(topology, cell, cellW, cellH, face);
          addGlazingBomLines(lines, {
            input,
            win,
            cell,
            glass,
            series,
            sourceComponentId,
            frameColor,
            sash,
            regions,
            clear,
            qty
          });
        }
      }
      calculateSurroundBom(win, series, lines, ebom, qty);
    }

    function aggregateBom(lines) {
      const map = new Map();
      for (const line of lines) {
        const key = [
          line.category,
          line.materialCode,
          line.spec,
          line.color,
          line.unit,
          line.lengthMm,
          line.widthMm,
          line.heightMm
        ].join("|");
        if (!map.has(key)) {
          map.set(key, {
            category: line.category,
            materialCode: line.materialCode,
            name: line.name,
            spec: line.spec,
            color: line.color,
            lengthMm: line.lengthMm,
            widthMm: line.widthMm,
            heightMm: line.heightMm,
            unit: line.unit,
            quantity: 0
          });
        }
        const row = map.get(key);
        row.quantity += Number(line.quantity || 0);
      }
      return Array.from(map.values()).sort((a, b) => `${a.category}${a.materialCode}`.localeCompare(`${b.category}${b.materialCode}`));
    }

export function buildInterfacePackage(project, bom) {
      const hash = hashString(JSON.stringify({ windows: project.windows, joints: project.joints, assemblies: project.assemblies, catalog: project.catalog, order: project.order }));
      return {
        schemaVersion: "door-mes-manufacturing-package.v1",
        generatedAt: new Date().toISOString(),
        project: project.project,
        order: project.order,
        calculation: {
          status: project.calculation.status,
          mbomVersion: project.calculation.mbomVersion,
          sourceHash: hash,
          lastCalculatedAt: project.calculation.lastCalculatedAt,
          confirmedAt: project.calculation.confirmedAt,
          frozenAt: project.calculation.frozenAt
        },
        designModel: {
          schemaVersion: project.schemaVersion,
          windows: project.windows,
          joints: project.joints || [],
          assemblies: project.assemblies || []
        },
        ebom: bom.ebom,
        mbom: bom.mbom,
        assemblies: bom.assemblies || [],
        cutRequirements: bom.cutRequirements,
        procurementRequirements: bom.summary,
        integrationEvents: project.calculation.events || [],
        reservedInterfaces: {
          mes: ["manufacturing_package.ready", "operation.reported", "barcode.scanned"],
          erp: ["order.accepted", "production.allowed", "shipment.allowed"],
          wms: ["material.issued", "finished_goods.received", "shipment.dispatched"],
          machineAdapters: ["manual_pdf", "generic_csv", "sturtz", "lede"]
        }
      };
    }

export function hashString(value) {
      let hash = 2166136261;
      for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return `h${(hash >>> 0).toString(16)}`;
    }
