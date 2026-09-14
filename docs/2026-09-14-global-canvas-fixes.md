# 全景画布返修与人工验收记录

日期：2026-09-14。预览：http://127.0.0.1:4173/dist/ 。页面资源版本：20260914-05。

本轮目标：修正连接件选中、删除、尺寸同步；保持全景编辑并补齐俯视开启状态；补齐对象树菜单和折叠。

## 修改文件

| 文件 | 修改位置 | 本轮修改内容 |
| --- | --- | --- |
| `E:/doorMES/DoorMES-Designer/dist/assets/app.js` | `deleteSelectedJoint`、`resolveAssemblyElevationLayout` | 删除连接件同时清除关联间距和旋转；无连接件的相邻窗不再生成虚假型材。 |
| 同上 | `renderAssemblySvg`、`renderAssemblyWindowCells`、`renderAssemblyPlanView` | 连接件选中时排除窗框、玻璃选中样式；俯视图不再显示已删除节点。 |
| 同上 | `renderJointSettingsPreview`、`renderJointDetailPreview`、`editJointLengthOrWidthFromMenu`、`addThreeEngineeringJoints` | 拼接宽度统一使用 A 尺寸，B 为独立进深；右键改宽同步关联窗位置；3D 拼接实体横跨间距。 |
| 同上 | `render`、`startCellPresetPlacement`、`switchDrawingMode` | 已有拼接场景时，开启、推拉、格条、标注等工具保持完整场景。 |
| 同上 | `assemblyPlanOpenings`、`renderAssemblyPlanView` | 复用开启运动计算，映射到各窗空间位置和转角；适配开启后的范围，尺寸标注仍取窗框尺寸。 |
| 同上 | `renderObjectTree`、`handleObjectTreeClick`、`handleObjectTreeContextMenu`、`showTreeMarkupMenu` | 节点展开收起、选择保持、按对象类型打开右键菜单；标注菜单可编辑和删除。 |
| `E:/doorMES/DoorMES-Designer/dist/assets/assemblies.js` | `placementGapForJoint` | 拼接间距取实际宽度 A，不再受进深 B 的较大值影响。 |
| `E:/doorMES/DoorMES-Designer/dist/assets/app.css` | `.object-tree-heading`、`.inspector-panel.collapsed`、`.assembly-plan-openings` | 树控件、可收起面板、画布释放宽度、开启投影线宽控制和重复说明文字隐藏。 |
| `E:/doorMES/DoorMES-Designer/dist/index.html` | 对象树标题栏、资源引用 | 增加展开全部、收起全部、面板折叠按钮；更新缓存版本。 |
| `E:/doorMES/DoorMES-Designer/tests/global-canvas-regressions.test.mjs` | 新增 | 执行应用实际函数，验证删除、尺寸、3D几何参数、开启投影、全景工具、排他高亮和树菜单折叠。 |
| `E:/doorMES/DoorMES-Designer/tests/lanko-yubeijia-parity.test.mjs` | TC-11、TC-12 | 更新为独立宽度/进深、工具激活时也保持全景的验收约束。 |

## 人工验收表

参考图片均来自本轮用户反馈，位于 `C:/Users/LENOVO/AppData/Local/Temp/`。以下只将代码验证标为通过，人工结果待填写。

| 编号 | 测试目标与步骤 | 测试要点 | 参考图片文件名 | 自检 | 人工结果 |
| --- | --- | --- | --- | --- | --- |
| RF-01 | 两窗之间增加拼接件；点击树中 S1，再点击画布 S1；之后切换到窗体 | 选连接件时仅该件在立面、俯视高亮；窗框和玻璃不跟随高亮；选窗时对应窗恢复高亮 | `codex-clipboard-8bd9c37c-396c-4b90-85bf-53755be7f41f.png` | 运行时渲染输出通过 | 待人工验收 |
| RF-02 | 分别在左、右、上、下接窗；删除连接件；刷新项目 | 窗体保留、间距归零、转角归零；立面无残留型材；俯视无残留连接点 | `codex-clipboard-c002fb2e-e2bc-4e86-8cd6-a60ed115b9f2.png` | 四方向布局、删除和序列化通过 | 待人工验收 |
| RF-03 | 拼接设置中双击宽度；依次输入50、100、300；保存；也通过右键修改宽度 | 输入、设置标注、属性、立面宽度、俯视宽度一致；B侧进深保持独立；附属窗跟随宽度平移 | `codex-clipboard-63a9fa96-1963-4a67-9115-e8d7497eb183.png`、`codex-clipboard-54d41445-5e85-4bf1-94d1-fd7e5af96b0d.png`、`codex-clipboard-7288075d-22da-4c4c-84bd-451e24885c9f.png` | 10/50/100/300数值检查通过 | 待人工验收 |
| RF-04 | 拼接宽度设为300，打开3D，旋转观察 | 拼接实体正面宽300，进深取B；填满两窗间对应间距；修改后重建3D | `codex-clipboard-e4bb693e-58b0-418e-9fe4-72215c8a823c.png` | 3D创建参数及位置检查通过；未做真实WebGL截图验收 | 待人工验收 |
| RF-05 | 在同一总图依次给不同窗格添加平开、推拉、格条；开关“开启状态”；测试带转角的拼接窗 | 工具激活及落位后均保持全景；仅修改点击窗格；俯视显示各窗开启投影且跟随空间转角；开启范围不被底栏遮挡 | 本轮文字要求及前述全景参考图 | 全景模式和13种开启投影检查通过；待真实落点操作 | 待人工验收 |
| RF-06 | 右键连接件、窗格、窗体和已有文字/孔位节点 | 对应菜单出现；操作作用于右键对象；标注编辑输入框留在画布可见区 | 本轮文字要求 | 连接件菜单分发、选中保持检查通过 | 待人工验收 |
| RF-07 | 点击树节点箭头；点击全部收起/展开；收起再展开整个右面板 | 子节点可折叠；当前选择不变；收起面板后画布获得空间；展开恢复树和属性区 | 本轮文字要求 | 节点折叠状态检查通过；面板布局待人工验收 | 待人工验收 |

## 自检范围

- JavaScript 语法检查通过。
- 新增全景回归测试和原有六个测试文件通过。
- 静态出图：`E:/doorMES/DoorMES-Designer/outputs/global-canvas-20260914/selected-joint-open-plan.png`。这是渲染函数在受控测试环境中的输出，窗格装饰和尺寸线使用测试适配器，不是完整网页截图，也不是人工验收证据。
- 本地预览地址响应200，未推送代码或部署到线上。
- 当前进度：本轮代码修复和自检完成，RF-01至RF-07等待人工验收。未声明与原型全部功能完全一致。
