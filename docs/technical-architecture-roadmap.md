# 门窗云设计技术架构与执行路线

核定日期：2026-09-16  
用途：作为前端重构、后端原型、CAD/Blender导入导出、对象树整理和后续生产系统建设的执行依据。

## 1. 总体结论

当前项目已经具备门窗绘图、异型、分格、中梃、开启方式、3D预览、包套、拼接/转角、多窗组合、BOM和制造接口包雏形。它已经不是普通画图工具，而是一个“门窗行业CAD + 规则引擎 + 制造数据平台”的原型。

后续技术路线不应寻找一个大而全的开源门窗框架来整体替换。现实可行方案是：

```text
自研门窗领域内核
  + 成熟开源渲染/几何/3D能力
  + Python + JSON 后端原型
  + 后续 Java SpringBoot + MySQL 正式后端
```

核心原则：

- 设计数据必须先于界面存在，二维、三维、BOM、导入导出都从同一份设计模型派生。
- 前端画布只负责交互和表达，不直接承担制造规则。
- 算料、校验、材料、规则和导出必须可版本化，历史订单可重放。
- 先用 Python + JSON 快速验证接口和算法，待领域模型稳定后迁移到 Java + MySQL。
- CAD/Blender导入导出是工程互通能力，不能反向破坏内部门窗模型。

## 2. 当前技术现状

当前项目是纯前端静态Web应用：

| 层级 | 当前实现 |
| --- | --- |
| 页面骨架 | `dist/index.html` |
| 样式 | `dist/assets/app.css` |
| 主逻辑 | `dist/assets/app.js` |
| 3D | Three.js + OrbitControls |
| 2D | SVG / DOM |
| 数据保存 | LocalStorage + JSON |
| 算料 | 前端 `calculation.js` |
| 测试 | Node `.mjs` 测试脚本 |

当前已经拆出的模块：

| 文件 | 职责 |
| --- | --- |
| `catalog.js` | 内置窗型、产品目录、模板 |
| `calculation.js` | 算料、BOM、制造接口包 |
| `openings.js` | 开启方式、运动规则 |
| `topology.js` | 分格、中梃、拓扑 |
| `joints.js` | 拼接料、转角料 |
| `assemblies.js` | 多窗组合 |
| `installations.js` | 安装、包套、墙洞 |

主要问题：

- `app.js` 仍然承担过多职责，包括界面状态、2D渲染、3D构建、选择逻辑、弹窗和右键菜单。
- 3D和2D部分存在局部重复几何算法，容易产生表现不一致。
- 设计对象树尚未成为统一的选择、渲染、BOM追溯入口。
- 后端、材料库、规则库和项目保存仍未从前端彻底分离。

## 3. 目标技术栈

### 3.1 前端

推荐路线：

```text
TypeScript
+ Vite
+ 原生SVG工程图渲染
+ Three.js 3D预览
+ 可选 Konva 用于复杂交互层
+ JSON Schema 数据校验
```

说明：

- SVG继续作为工程图优先方案，适合尺寸、标注、打印、导出。
- Three.js继续负责3D预览、开启动画、材质、墙洞和安装场景。
- Konva/Fabric可以作为交互画布候选，但不能替代门窗领域模型。
- CAD级实体建模后期可接 OpenCascade.js 或 replicad，不作为第一阶段强依赖。

### 3.2 几何与拓扑

几何层建议自研门窗专用内核，并可引入开源几何库辅助：

| 能力 | 建议 |
| --- | --- |
| 点、线、向量、多边形 | 自研基础类型 |
| 多边形裁切、交并差 | 可引入 polygon-clipping / Clipper2 / JSTS |
| 区域分割 | 自研门窗拓扑规则 |
| 异型边界贴合 | 自研 ShapeBoundary + Clip 算法 |
| 3D实体生成 | Three.js Mesh；复杂CAD实体后期接 OpenCascade |

门窗拓扑不能完全交给通用库，因为中梃贯通、T接、十字接、端接、区域归属、BOM来源都是行业规则。

### 3.3 后端阶段

第一阶段使用 Python + JSON 模拟后端：

```text
backend-prototype/
  app.py
  data/
    projects/
    windows/
    catalogs/
    rules/
    bom/
    exports/
  services/
    design_service.py
    catalog_service.py
    rule_service.py
    bom_service.py
    export_service.py
  schemas/
    design.v3.schema.json
    bom.v1.schema.json
    manufacturing-package.v1.schema.json
```

职责：

- 项目保存、打开、复制、版本记录。
- 窗型库、企业组件库、材料库模拟。
- 设计JSON校验。
- BOM计算服务化。
- 规则版本和目录快照模拟。
- 制造接口包导出。
- CAD/Blender导入导出服务原型。

第二阶段迁移到 Java SpringBoot + MySQL：

```text
SpringBoot
+ MySQL
+ Redis
+ 对象存储
+ 消息队列
+ 权限/审计/审批
+ MES/ERP/WMS接口
```

Java正式后端负责：

- 项目、客户、订单、窗号、合同、报价。
- 多用户权限、角色、审批。
- 材料、规则、型材、玻璃、五金和工艺版本。
- BOM冻结、变更审查、历史追溯。
- 与MES、ERP、WMS、设备软件对接。

## 4. 目标分层架构

```text
应用层
  DesignerWeb / AdminConsole / Backend API

交互层
  CanvasController / SelectionController / CommandStack / ObjectTree

领域层
  Project / Wall / Opening / Installation / WindowUnit
  FrameSegment / Mullion / Region / OpeningSash
  EngineeringJoint / Assembly / MaterialCatalog / RuleSet

几何层
  Point / Vector / Segment / Polygon
  ShapeBoundary / TopologyGraph / RegionPartition
  Offset / Clip / Intersect / MotionEnvelope

渲染层
  SvgRenderer / ThreeRenderer / PlanRenderer / PrintRenderer

计算层
  ValidationEngine / BomCalculator / CuttingCalculator
  GlassCalculator / HardwareSelector / InstallationCalculator

数据与集成层
  JSON Schema / ImportExport / Python Prototype API
  SpringBoot API / MySQL / MES ERP WMS Adapter
```

严禁让界面事件直接修改BOM、材料规则或制造结果。界面只能发出命令，命令修改领域模型，领域模型触发校验和派生渲染。

## 5. 核心领域对象

| 对象 | 含义 | 备注 |
| --- | --- | --- |
| `Project` | 项目根对象 | 包含客户、订单、窗号、规则版本 |
| `Wall` | 建筑宿主墙 | 后续v3一等实体 |
| `Opening` | 墙体洞口 | 尺寸、标高、形状、实测值 |
| `Installation` | 安装关系 | 框位、墙厚、间隙、包套、锚固 |
| `WindowUnit` | 单樘门窗 | 当前主要设计对象 |
| `FrameSegment` | 外框边段 | 后续支持不同边不同型材 |
| `Mullion` / `Transom` | 竖梃/横梃 | 包括贯通、局部、自由梃 |
| `Region` | 由框和梃围成的区域 | 可挂固定玻璃、开启扇、面板等 |
| `OpeningSash` | 活动扇 | 机构、铰链、轨道、开启动作 |
| `EngineeringJoint` | 拼接/转角节点 | 项目级对象，避免重复算料 |
| `Assembly` | 多窗组合 | 参照窗、停靠、旋转、间隙 |
| `MaterialCatalog` | 材料目录 | 型材、玻璃、五金、胶条 |
| `RuleSet` | 规则集 | 企业公式、适配范围、版本 |
| `BomDocument` | BOM结果 | 可追溯、可冻结 |

## 6. 前端对象树设计

对象树必须成为“选择、属性面板、2D高亮、3D高亮、BOM追溯”的统一入口。

### 6.1 对象树层级

建议结构：

```text
项目
  项目信息
  材料与规则
  窗型列表
    C-01 客厅窗
      安装/洞口
        墙体
        洞口
        包套
      外框
        上框
        下框
        左框
        右框
        异型边段
      分格/中梃
        贯通竖梃
        贯通横梃
        局部竖梃
        局部横梃
      区域
        格 1-1
          开启扇/固定玻璃
          玻璃/面板/百叶/纱窗
          五金/锁具/执手
      工程节点
        拼接料
        转角料
  多窗组合
    组合 A
      成员窗
      连接节点
      总体尺寸
  BOM
    EBOM
    MBOM
    下料
    玻璃
    五金
    安装包
```

### 6.2 对象树节点字段

每个节点至少包含：

```json
{
  "id": "node-C-01-region-1-1",
  "objectId": "region-xxx",
  "objectType": "region",
  "label": "格 1-1",
  "parentId": "window-C-01",
  "sourcePath": "windows[0].regions[0]",
  "selectable": true,
  "visible": true,
  "locked": false,
  "bomSource": true
}
```

关键要求：

- 对象树节点不直接保存业务数据，只保存引用和显示状态。
- 真实业务数据保存在领域模型中。
- 2D、3D、BOM行都必须能反查 `objectId`。
- 删除对象时必须同步清理引用、BOM来源和选择状态。

### 6.3 选择行为

| 选择对象 | 画布反馈 | 右侧属性 |
| --- | --- | --- |
| 整窗 | 外包轮廓高亮 | 宽高、窗号、系列、数量 |
| 外框边段 | 对应边高亮 | 型材、颜色、边段尺寸 |
| 中梃 | 梃高亮 | 方向、位置、端接、型材 |
| 区域 | 区域填充高亮 | 开启类型、玻璃、格条 |
| 活动扇 | 扇框高亮 | 开启方式、铰链边、开启幅度 |
| 拼接/转角节点 | 节点高亮 | 类型、角度、正反装、宽度 |
| 包套 | 洞口/包边高亮 | 样式、应用边、墙厚、框位 |
| 组合成员 | 成员窗高亮 | 参照窗、停靠、间隙、旋转 |

## 7. 画布架构

画布应从“直接改数据”升级为“命令驱动”：

```text
用户操作
  -> Command
  -> Domain Model
  -> Validation
  -> ViewModel
  -> SVG / Three.js / ObjectTree
```

命令示例：

| 命令 | 说明 |
| --- | --- |
| `CreateWindowCommand` | 新建门窗 |
| `ResizeWindowCommand` | 修改整窗尺寸 |
| `SetShapeCommand` | 设置矩形、拱形、梯形、DIY异型 |
| `AddMullionCommand` | 添加中梃 |
| `MoveMullionCommand` | 移动中梃 |
| `SetRegionInfillCommand` | 设置固定玻璃、开启扇、面板等 |
| `SetOpeningCommand` | 设置开启方式 |
| `AddEngineeringJointCommand` | 添加拼接/转角节点 |
| `PlaceWindowInAssemblyCommand` | 多窗组合定位 |
| `SetSurroundCommand` | 修改安装包套 |
| `ImportCadCommand` | 导入CAD参考或转换设计对象 |

好处：

- 支持撤销/重做。
- 支持多人协作前的操作日志。
- 支持后端重放和审计。
- 支持测试每个命令的输入输出。

## 8. CAD 与 Blender 导入导出

### 8.1 基本原则

CAD/Blender能力分为两类：

1. 工程数据互通：DXF、PDF、SVG、STEP、IFC等。
2. 展示和建模互通：glTF/GLB、OBJ、STL、Blender可导入文件。

内部门窗设计JSON仍然是主数据。外部文件不能直接替代内部模型，导入时必须经过识别、映射和用户确认。

### 8.2 导出路线

| 格式 | 阶段 | 用途 |
| --- | --- | --- |
| JSON | 立即 | 内部设计、备份、接口 |
| SVG | 立即 | 2D工程图、网页预览 |
| PDF | 近期 | 打印、确认图 |
| DXF | 近期 | CAD平面图、加工参考 |
| glTF/GLB | 近期 | Blender、Web 3D、客户展示 |
| OBJ | 可选 | 通用3D交换 |
| STL | 可选 | 简化三维实体检查 |
| STEP | 后期 | CAD实体交换，需要OpenCascade |
| IFC | 后期 | BIM/建筑协同，需要更完整墙体/洞口模型 |
| Manufacturing Package JSON | 立即/持续 | MES、ERP、WMS、设备接口 |

Blender优先采用 `glTF/GLB`，因为它适合保留材质、层级、对象名和场景结构。导出时需要写入：

- 窗号。
- 对象ID。
- 材料名称。
- 室内/室外方向。
- 活动扇初始状态。
- 分组层级：外框、中梃、玻璃、五金、包套、墙洞。

### 8.3 导入路线

| 来源 | 第一阶段处理 | 后续增强 |
| --- | --- | --- |
| DXF | 作为参考底图/线框导入 | 识别洞口、框线、中梃、标注 |
| DWG | 暂不直接支持，需外部转换DXF | 后续评估ODA/LibreDWG |
| SVG | 导入参考图形 | 转换为异型边界或模板 |
| glTF/GLB | 导入参考3D模型 | 尝试识别墙洞/窗体层级 |
| OBJ/STL | 只作为展示参考 | 不直接生成生产数据 |
| STEP | 后期支持 | 通过OpenCascade识别实体 |
| IFC | 后期支持 | 读取墙体、洞口、空间和构件 |

导入流程：

```text
读取文件
  -> 单位识别
  -> 坐标归一
  -> 图层/对象分类
  -> 几何清理
  -> 候选门窗对象识别
  -> 用户确认映射
  -> 生成内部设计对象
  -> 校验
```

CAD导入不能一次性自动全信任。必须允许用户确认：

- 哪些线是外框。
- 哪些线是中梃。
- 哪些区域是玻璃或开启扇。
- 单位是毫米还是其他单位。
- 室内外方向如何定义。
- 标注尺寸是否覆盖几何尺寸。

### 8.4 对象命名约定

导出到Blender/CAD时应统一命名：

```text
C-01_Frame_Top
C-01_Frame_Left
C-01_Mullion_V_001
C-01_Region_1_1_Glass
C-01_Sash_1_1
C-01_Hardware_Handle_001
C-01_Surround_Left
C-01_Wall_Opening
```

并在扩展属性或用户数据中保存：

```json
{
  "doormesObjectId": "region-abc",
  "doormesObjectType": "region",
  "windowId": "C-01",
  "bomSource": true
}
```

## 9. 后端原型接口建议

Python原型阶段建议先提供这些接口：

| 接口 | 用途 |
| --- | --- |
| `GET /projects` | 项目列表 |
| `POST /projects` | 新建项目 |
| `GET /projects/{id}` | 打开项目 |
| `PUT /projects/{id}` | 保存项目 |
| `POST /projects/{id}/validate` | 校验设计 |
| `POST /projects/{id}/bom` | 计算BOM |
| `POST /projects/{id}/freeze-bom` | 冻结BOM模拟 |
| `GET /catalogs` | 材料/窗型目录 |
| `POST /catalogs/import` | 导入材料目录 |
| `GET /rulesets` | 规则集列表 |
| `POST /exports/dxf` | 导出DXF |
| `POST /exports/glb` | 导出GLB |
| `POST /imports/cad` | CAD导入预解析 |
| `POST /imports/confirm` | 确认导入映射 |

所有接口都应以内部设计JSON为核心输入输出，避免前端和后端各自维护不同结构。

## 10. Java + MySQL 迁移边界

Python阶段不要只写临时代码。必须按未来Java系统边界组织数据：

| Python原型 | Java正式系统 |
| --- | --- |
| JSON文件项目库 | `project`, `order`, `window_unit` 等表 |
| JSON材料目录 | `profile`, `glass`, `hardware`, `seal`, `accessory` |
| JSON规则集 | `rule_set`, `rule_version`, `rule_item` |
| BOM JSON | `bom_header`, `bom_line`, `cut_requirement` |
| 导出文件目录 | 对象存储 + `export_job` |
| 操作日志JSON | `operation_log`, `audit_log` |

数据库建议：

- 关系字段保存可查询业务主数据。
- 完整设计快照保存为JSON字段或独立文档。
- BOM冻结后保存不可变快照。
- 材料和规则使用版本号，不允许历史订单被新目录静默改变。

## 11. app.js 拆分目标

当前 `app.js` 后续拆分为：

```text
src/
  app/
    bootstrap.ts
    state-store.ts
    command-stack.ts
  domain/
    project.ts
    window-unit.ts
    installation.ts
    assembly.ts
    engineering-joint.ts
  geometry/
    primitives.ts
    polygon.ts
    clipping.ts
    topology-graph.ts
  openings/
    opening-types.ts
    opening-motion.ts
  render-svg/
    elevation-renderer.ts
    plan-renderer.ts
    dimension-renderer.ts
  render-three/
    three-scene.ts
    three-window-builder.ts
    three-sash-builder.ts
    three-shape-builder.ts
    three-materials.ts
  object-tree/
    object-tree-builder.ts
    selection-model.ts
  calculation/
    bom-calculator.ts
    manufacturing-package.ts
  import-export/
    export-json.ts
    export-svg.ts
    export-dxf.ts
    export-gltf.ts
    import-dxf.ts
```

拆分顺序：

1. 先抽领域类型和几何函数。
2. 再抽SVG渲染。
3. 再抽Three.js构建。
4. 再抽对象树和选择模型。
5. 最后把界面事件改为命令驱动。

## 12. 执行阶段

### P0：文档与边界冻结

- 固化本技术路线。
- 明确内部设计JSON作为主数据。
- 梳理对象树节点类型和ID规则。

验收：

- 新功能必须能说明自己属于哪个领域对象。
- 2D、3D、BOM必须共用同一对象ID。

### P1：前端模块化

- 引入TypeScript工程结构。
- 从 `app.js` 抽出几何、领域、开启、对象树、3D构建模块。
- 保持现有功能不倒退。

验收：

- 原有测试通过。
- 现有页面功能保持可用。
- 3D异型、局部梃、BOM计算有独立测试。

### P2：对象树重构

- 建立统一对象树构建器。
- 右侧属性、2D选择、3D选择、BOM来源全部引用对象树。
- 支持隐藏、锁定、定位、高亮。

验收：

- 点击对象树能定位到2D和3D对象。
- 点击2D/3D对象能同步右侧树节点。
- BOM行能回跳源对象。

### P3：Python + JSON 后端原型

- 提供项目保存、打开、校验、算料、导出接口。
- 前端从LocalStorage逐步切到API。
- 保留离线模式作为降级。

验收：

- 项目可通过API保存并重新打开。
- BOM由后端服务计算并返回。
- 设计JSON有Schema校验报告。

### P4：CAD/Blender互通

- 先导出SVG、PDF、DXF、GLB。
- CAD导入先做参考底图。
- Blender导入导出优先支持GLB。

验收：

- 一樘窗能导出DXF并在CAD中查看2D工程图。
- 一樘窗能导出GLB并在Blender中看到层级、材质和对象名。
- 导入DXF能作为参考底图对齐画布。

### P5：Java正式后端

- 建立SpringBoot项目。
- MySQL建表。
- 迁移Python原型中稳定的数据结构和服务边界。
- 接入权限、审计、BOM冻结。

验收：

- Python原型中的项目数据可迁移。
- 前端API调用不需要大改。
- BOM冻结后不可被材料库更新影响。

### P6：制造与系统集成

- MES/ERP/WMS接口。
- 型材优化、设备数据、条码、工艺路线。
- 审批、变更、差异审查。

验收：

- 冻结BOM可输出制造接口包。
- 外部系统可按幂等ID接收并回传状态。

## 13. 开发规范

- 所有核心对象必须有稳定ID。
- 所有尺寸单位统一为毫米，显示单位不能改变源数据。
- 所有规则必须有版本号。
- 所有BOM行必须有来源对象ID。
- 所有导出文件必须保留窗号、对象ID和版本信息。
- 所有导入数据必须先进入候选状态，用户确认后才写入正式设计。
- 前端渲染层不得保存制造结果。
- 后端不得根据界面临时状态计算BOM。
- 历史订单不能被新材料库或新规则静默改写。

## 14. 近期优先事项

1. 整理对象树：把窗、框、梃、区域、开启扇、包套、节点、组合统一成可追溯树。
2. 抽离3D构建：把 `buildThreeWindowModel`、异型裁切、开启扇构建、中梃构建拆成独立模块。
3. 建立Python后端原型：先做项目保存、打开、校验、BOM计算。
4. 增加导出GLB和DXF的技术验证。
5. 把LocalStorage保存改成“本地缓存 + 后端保存”双模式。
6. 为异型、中梃、对象树、BOM追溯增加专项测试。

## 15. 决策记录

| 决策 | 结论 |
| --- | --- |
| 是否整体采用开源门窗框架 | 否。没有现成框架覆盖全部中国门窗业务 |
| 2D是否换Canvas框架 | 暂不强制。SVG继续作为工程图主线，可局部引入Konva |
| 3D是否继续Three.js | 是。继续作为Web 3D主线 |
| 是否立即接OpenCascade | 否。后期在STEP/复杂型材实体阶段引入 |
| 后端是否先上Java | 否。先Python + JSON验证，再迁移Java |
| 数据主线是什么 | 内部设计JSON + 版本化Schema |
| Blender优先格式 | glTF/GLB |
| CAD优先格式 | SVG/PDF/DXF，STEP/IFC后置 |
| 对象树是否必须重构 | 是。它是选择、属性、3D、BOM追溯的统一入口 |

