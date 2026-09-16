# Manufacturing Package v1

门窗云设计第一阶段对外输出 `door-mes-manufacturing-package.v1`。

该接口包不是完整 MES 数据库，而是设计平台向后续系统交付的稳定数据边界。

## 生成来源

```text
设计 JSON
  -> EBOM
  -> 算料
  -> MBOM
  -> cutRequirements
  -> procurementRequirements
  -> manufacturing package
```

## 顶层结构

```json
{
  "schemaVersion": "door-mes-manufacturing-package.v1",
  "generatedAt": "2026-09-11T00:00:00.000Z",
  "project": {},
  "order": {},
  "calculation": {},
  "designModel": {},
  "ebom": [],
  "mbom": {},
  "assemblies": [],
  "cutRequirements": [],
  "procurementRequirements": [],
  "integrationEvents": [],
  "reservedInterfaces": {}
}
```

## 字段用途

| 字段 | 面向系统 | 用途 |
| --- | --- | --- |
| `project` | ERP / MES | 项目、客户、地址等基础信息 |
| `order` | ERP / MES | 销售单号、生产批次、外部订单号 |
| `calculation` | MES / PLM | 算料状态、BOM版本、源数据哈希 |
| `designModel` | 设计平台 / PLM | 可视化门窗 JSON，可回放绘图 |
| `ebom` | 设计平台 / 工艺 | 设计层部件，说明每个窗由什么组成 |
| `mbom.lines` | MES / ERP / WMS | 制造物料行，支持采购、领料、生产 |
| `assemblies` | 设计平台 / MES / 安装 | 多窗组合外包尺寸、成员窗、连接节点和对应MBOM行 |
| `cutRequirements` | 下料优化 / 设备 | 型材和压条切割需求 |
| `procurementRequirements` | ERP / 采购 | 汇总后的采购需求 |
| `integrationEvents` | 集成平台 | 设计提交、BOM确认、BOM冻结等事件 |
| `reservedInterfaces` | 系统集成 | 预留 MES、ERP、WMS、设备适配器名称 |

## 开启方式编码

设计模型和 EBOM 保留 `cell.type`、`cell.opening` 与 `cell.openingAssembly`，后续 MES、报价和工艺系统应直接使用编码，不依赖界面中文名称。

| 构件 | `type` | `opening` |
| --- | --- | --- |
| 平开/门扇 | `turn` / `door` | `left_in`、`right_in`、`left_out`、`right_out` |
| 内开内倒 | `turn_tilt` | `left_in`、`right_in` |
| 上悬 | `top_hung` | `top_out`、`top_in` |
| 下悬 | `bottom_hung` | `bottom_in`、`bottom_out` |
| 普通推拉 | `sliding` | `slide_left`、`slide_right` |
| 提升推拉 | `lift_slide` | `lift_slide_left`、`lift_slide_right` |
| PSK平移内倒 | `psk` | `psk_left`、`psk_right` |
| 平行推拉 | `parallel_slide` | `parallel_slide_left`、`parallel_slide_right` |
| 平行推出 | `parallel_project` | `parallel_out` |
| 入墙推拉 | `pocket_slide` | `pocket_left`、`pocket_right`、`pocket_both` |
| 转角推拉 | `corner_slide` | `corner_left`、`corner_right`、`corner_both` |
| 上下提拉 | `vertical_slide` | `slide_up`、`slide_down` |
| 折叠 | `folding` | `fold_left`、`fold_right` |
| 固定类构件 | 其他非开启类型 | `fixed` |

## 组合开启结构

`opening` 表达单扇的基本方向，`openingAssembly` 表达同一洞口内的组合和联动规则：

| 字段 | 用途 |
| --- | --- |
| `panelCount` / `activePanelCount` | 总扇数与活动扇数 |
| `trackCount` | 推拉、提升推拉或提拉结构的轨道数 |
| `stackSide` | 左收、右收、双向收、上提、下拉或上下双动 |
| `primarySide` / `operationSequence` | 主扇位置和主从开合顺序 |
| `mullionMode` | 固定中梃或假中梃/无中梃 |
| `openPlane` | 折叠扇向室内或室外开启 |
| `operationPriority` / `ventilationMode` | 内开内倒执手逻辑与通风档位 |
| `trafficDoor` | 折叠门中的独立通行扇位置 |
| `screenMode` | 固定、平开、推拉或卷轴纱窗 |
| `cornerAngleDeg` / `cornerPostMode` | 转角推拉角度与带柱/无柱结构 |
| `pocketDepthMm` | 入墙推拉墙腔设计深度；0表示按扇宽自动计算 |
| `panels` | 每扇的编号、主从角色、活动状态、轨道和动作顺序 |

旧设计 JSON 未包含 `openingAssembly` 时，平台会根据 `type` 与 `opening` 自动补齐默认组合，保证第一版数据仍可导入。

## 多窗组合与安装包套

`designModel.assemblies` 保存根窗、参照窗、停靠关系、三维毫米坐标和连接节点；顶层 `assemblies` 保存组合外包尺寸及其对应的MBOM行号。

包套保存在每樘窗的 `installation.surround` 中。启用后，EBOM增加 `installation_surround` 对象，MBOM生成内外包套型材、洞口衬板、转角连接件和收口密封。所有行使用 `installation.surround.*` 作为来源构件编码，可直接追溯到窗号及安装对象。

## BOM状态

| 状态 | 含义 |
| --- | --- |
| `draft` | 设计中，尚未形成正式算料结果 |
| `calculated` | 已自动算料，但未人工确认 |
| `confirmed` | 算料已确认，可以进入生产准备 |
| `frozen` | BOM版本已冻结，可以下发后续系统 |
| `changed` | 已确认或冻结后又发生设计变更 |

## 预留事件

```text
design.submitted
bom.calculated
bom.confirmed
bom.frozen
manufacturing_package.ready
design.revised
```

## 后续扩展

第二阶段建议在不破坏当前包结构的前提下增加：

- `routing`：工艺路线、工序、设备、班组建议
- `barcodes`：窗号、构件号、生产流水码
- `inventoryReservations`：库存占用和余料匹配结果
- `machineOutputs`：雷德、Stürtz、国产锯切中心等设备文件
- `approvalRecords`：算料确认、BOM冻结、生产许可记录
