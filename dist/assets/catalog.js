export const builtInTemplates = [
      {
        id: "tpl-fixed-single",
        name: "单樘固定窗",
        description: "一格固定玻璃，适合快速报价和玻璃BOM验证",
        window: {
          widthMm: 1200,
          heightMm: 1500,
          shape: { type: "rectangular", archHeightMm: 0 },
          layout: {
            columns: [1],
            rows: [1],
            cells: [{ type: "fixed_glass", opening: "left_in" }]
          }
        }
      },
      {
        id: "tpl-turn-pair",
        name: "双扇平开窗",
        description: "左右平开，中间竖梃，输出框料、扇料、玻璃、五金",
        window: {
          widthMm: 1800,
          heightMm: 1500,
          shape: { type: "rectangular", archHeightMm: 0 },
          layout: {
            columns: [1, 1],
            rows: [1],
            cells: [
              { type: "turn", opening: "left_in" },
              { type: "turn", opening: "right_in" }
            ]
          }
        }
      },
      {
        id: "tpl-door-side",
        name: "门联窗",
        description: "左侧固定玻璃，右侧门扇，下部面板可改",
        window: {
          widthMm: 2100,
          heightMm: 2400,
          shape: { type: "rectangular", archHeightMm: 0 },
          layout: {
            columns: [0.8, 1.2],
            rows: [1],
            cells: [
              { type: "fixed_glass", opening: "left_in" },
              { type: "door", opening: "right_in" }
            ]
          }
        }
      },
      {
        id: "tpl-transom-door",
        name: "上亮门",
        description: "上部固定玻璃，下部门扇，适合入户门组合",
        window: {
          widthMm: 1000,
          heightMm: 2400,
          shape: { type: "rectangular", archHeightMm: 0 },
          layout: {
            columns: [1],
            rows: [0.35, 1],
            cells: [
              { type: "fixed_glass", opening: "left_in" },
              { type: "door", opening: "right_in" }
            ]
          }
        }
      },
      {
        id: "tpl-arched-combo",
        name: "上拱组合窗",
        description: "上拱外形，左右分格，可作为异型组合窗起点",
        window: {
          widthMm: 1800,
          heightMm: 1700,
          shape: { type: "arched", archHeightMm: 260 },
          layout: {
            columns: [1, 1],
            rows: [1],
            cells: [
              { type: "fixed_glass", opening: "left_in" },
              { type: "turn_tilt", opening: "right_in" }
            ]
          }
        }
      },
      {
        id: "tpl-screen-turn",
        name: "带纱扇平开窗",
        description: "左侧纱窗，右侧平开扇，适合门店快速演示",
        window: {
          widthMm: 1800,
          heightMm: 1500,
          shape: { type: "rectangular", archHeightMm: 0 },
          layout: {
            columns: [1, 1],
            rows: [1],
            cells: [
              { type: "screen", opening: "left_in" },
              { type: "turn", opening: "right_in" }
            ]
          }
        }
      },
      {
        id: "tpl-louver-grille",
        name: "百叶格条窗",
        description: "上部百叶，下部装饰格条，适合补齐门店素材库",
        window: {
          widthMm: 1200,
          heightMm: 1600,
          shape: { type: "rectangular", archHeightMm: 0 },
          layout: {
            columns: [1],
            rows: [0.42, 1],
            cells: [
              { type: "louver", opening: "left_in" },
              { type: "grille", opening: "left_in" }
            ]
          }
        }
      },
      {
        id: "tpl-first-phase-openings",
        name: "首期开启方式组合",
        description: "上悬、下悬、提升推拉、上下提拉和折叠的功能验证窗型",
        window: {
          widthMm: 3000,
          heightMm: 1800,
          shape: { type: "rectangular", archHeightMm: 0 },
          layout: {
            columns: [1, 1, 1],
            rows: [1, 1],
            cells: [
              { type: "top_hung", opening: "top_out" },
              { type: "bottom_hung", opening: "bottom_in" },
              { type: "vertical_slide", opening: "slide_up" },
              { type: "lift_slide", opening: "lift_slide_left" },
              { type: "folding", opening: "fold_left" },
              { type: "sliding", opening: "slide_right" }
            ]
          }
        }
      },
      {
        id: "tpl-advanced-sliding",
        name: "后期开启组合",
        description: "PSK、平行推拉、平行推出、入墙推拉和无柱转角推拉",
        window: {
          widthMm: 5000,
          heightMm: 1800,
          shape: { type: "rectangular", archHeightMm: 0 },
          layout: {
            columns: [1, 1, 1, 1, 1],
            rows: [1],
            cells: [
              { type: "psk", opening: "psk_left" },
              { type: "parallel_slide", opening: "parallel_slide_right" },
              { type: "parallel_project", opening: "parallel_out" },
              { type: "pocket_slide", opening: "pocket_left" },
              { type: "corner_slide", opening: "corner_both" }
            ]
          }
        }
      }
    ];

export const defaultCatalog = {
      profileSystems: [
        {
          id: "AL70",
          name: "70断桥铝系统窗",
          material: "aluminum",
          frameProfile: "AL70-K01",
          sashProfile: "AL70-S01",
          mullionProfile: "AL70-Z01",
          spliceProfile: "AL70-SPLICE",
          cornerProfile: "AL70-CORNER-90",
          beadProfile: "AL70-YT01",
          gasketCode: "EPDM-70",
          faceWidthMm: 70,
          frameDepthMm: 70,
          sashFaceWidthMm: 58,
          stockLengthMm: 6000,
          sawKerfMm: 4
        },
        {
          id: "PVC80",
          name: "80塑钢推拉窗",
          material: "pvc",
          frameProfile: "PVC80-K01",
          sashProfile: "PVC80-S01",
          mullionProfile: "PVC80-Z01",
          spliceProfile: "PVC80-SPLICE",
          cornerProfile: "PVC80-CORNER-90",
          beadProfile: "PVC80-YT01",
          gasketCode: "EPDM-PVC80",
          faceWidthMm: 80,
          frameDepthMm: 80,
          sashFaceWidthMm: 62,
          stockLengthMm: 5800,
          sawKerfMm: 4
        }
      ],
      glassTypes: [
        { id: "GL-LOWE-24", name: "5+14A+5 Low-E", thicknessMm: 24, ug: 1.8 },
        { id: "GL-TEMP-27", name: "6+15A+6 钢化中空", thicknessMm: 27, ug: 2.0 },
        { id: "GL-TRIPLE-36", name: "5+12A+5+12A+5 三玻两腔", thicknessMm: 36, ug: 1.1 }
      ],
      hardwareSets: [
        { id: "HW-TT-STD", name: "内开内倒标准五金", handleCode: "HW-BS-01", hingeCode: "HW-HJ-70", memberName: "传动器/铰链", hingeQtyRule: "height>1800?3:2" },
        { id: "HW-TURN-STD", name: "平开标准五金", handleCode: "HW-BS-02", hingeCode: "HW-HJ-50", memberName: "合页/铰链", hingeQtyRule: "height>1800?3:2" },
        { id: "HW-HUNG-STD", name: "悬窗标准五金", handleCode: "HW-HUNG-HANDLE", hingeCode: "HW-FRICTION-STAY", memberName: "摩擦铰链/风撑", hingeQtyRule: "2" },
        { id: "HW-SLIDE-STD", name: "推拉标准五金", handleCode: "HW-SL-01", hingeCode: "HW-ROLLER-01", memberName: "滑轮组件", hingeQtyRule: "2" },
        { id: "HW-LIFT-SLIDE", name: "提升推拉五金", handleCode: "HW-LS-HANDLE", hingeCode: "HW-LS-BOGIE", memberName: "提升滑轮车", hingeQtyRule: "2" },
        { id: "HW-VERTICAL-SLIDE", name: "上下提拉五金", handleCode: "HW-VS-LOCK", hingeCode: "HW-VS-BALANCE", memberName: "平衡器/导向件", hingeQtyRule: "2" },
        { id: "HW-FOLD-STD", name: "折叠窗标准五金", handleCode: "HW-FOLD-HANDLE", hingeCode: "HW-FOLD-HINGE", memberName: "折叠合页/滑轮", hingeQtyRule: "4" },
        { id: "HW-PSK-STD", name: "PSK平移内倒五金", handleCode: "HW-PSK-HANDLE", hingeCode: "HW-PSK-CARRIAGE", memberName: "平移内倒滑车/剪刀撑", hingeQtyRule: "2" },
        { id: "HW-PARALLEL-SLIDE", name: "平行推拉五金", handleCode: "HW-PS-HANDLE", hingeCode: "HW-PS-CARRIAGE", memberName: "平行推拉滑车", hingeQtyRule: "2" },
        { id: "HW-PARALLEL-PROJECT", name: "平行推出五金", handleCode: "HW-PP-HANDLE", hingeCode: "HW-PP-STAY", memberName: "同步剪刀撑", hingeQtyRule: "4" },
        { id: "HW-POCKET-SLIDE", name: "入墙推拉五金", handleCode: "HW-PK-HANDLE", hingeCode: "HW-PK-ROLLER", memberName: "入墙滑轮/缓冲器", hingeQtyRule: "2" },
        { id: "HW-CORNER-SLIDE", name: "转角推拉五金", handleCode: "HW-CS-HANDLE", hingeCode: "HW-CS-ROLLER", memberName: "转角滑轮/联动件", hingeQtyRule: "2" },
        { id: "HW-DOOR-STD", name: "门扇标准五金", handleCode: "HW-LOCK-01", hingeCode: "HW-DH-01", memberName: "门合页", hingeQtyRule: "height>2200?4:3" }
      ],
      panelTypes: [
        { id: "PN-SANDWICH", name: "保温夹芯板", thicknessMm: 24 },
        { id: "PN-ALU", name: "铝单板", thicknessMm: 3 }
      ]
    };

export const typeLabels = {
      fixed_glass: "固定玻璃",
      turn: "平开扇",
      turn_tilt: "内开内倒",
      top_hung: "上悬窗",
      bottom_hung: "下悬窗",
      sliding: "推拉扇",
      lift_slide: "提升推拉",
      psk: "PSK平移内倒",
      parallel_slide: "平行推拉",
      parallel_project: "平行推出",
      pocket_slide: "入墙推拉",
      corner_slide: "转角推拉",
      vertical_slide: "上下提拉",
      folding: "折叠窗",
      door: "门扇",
      screen: "纱窗",
      louver: "百叶",
      grille: "格条",
      panel: "面板",
      empty: "留空"
    };

export const categoryLabels = {
      profile: "型材",
      glass: "玻璃",
      hardware: "五金",
      gasket: "胶条",
      bead: "压条",
      panel: "面板",
      accessory: "配件"
    };
