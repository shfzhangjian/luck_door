# 全局物理编辑与 3D 附属对象返修记录

日期：2026-09-14  
本地地址：`http://127.0.0.1:4173/dist/`  
页面资源版本：`20260914-10`  
验证边界：本记录只标记代码静态检查和自动化模型回归；浏览器人工结果由验收人填写。

## 工作目标与完成状态

| 编号 | 目标 | 代码状态 | 人工状态 |
| --- | --- | --- | --- |
| PG-01 | 开启扇、推拉扇、格条等窗格叠加工具只等待点击目标窗格，不显示左/右/上/下接窗区 | 已完成并静态通过 | 待人工验证 |
| PG-02 | 单窗已有开启状态在加入第二、第三樘窗后仍在全局立面图和俯视图显示 | 已完成并静态通过 | 待人工验证 |
| PG-03 | 两窗贴合但没有连接件时，中缝出现可点击区域，可直接插入拼接料或转角料 | 已完成并模型通过 | 待人工验证 |
| PG-04 | 窗框右边、下边可拖动改宽高；分格中线可拖动改变相邻格占比 | 已完成并静态通过 | 待人工验证 |
| PG-05 | 新增锁具工具；锁具具有格口宿主、可拖动/双击改参数，并在 2D、3D 显示 | 已完成并静态通过 | 待人工验证 |
| PG-06 | 上拱、左右斜顶、双斜顶、左右缺角、DIY 等框型进入多窗总图后仍按各自外框形状绘制 | 已完成并静态通过 | 待人工验证 |
| PG-07 | 圆孔、方孔、文字和锁具必须保存宿主窗 ID 与宿主格 ID；复制窗体会重建 ID；3D 中附属对象挂到命中的活动扇并随扇运动 | 已完成并静态通过 | 待人工验证 |
| PG-08 | 3D 固定为多选；去掉单选入口；窗扇收紧到框内；尺寸、文字/孔位/锁具、室内/室外均有独立显隐开关 | 已完成并静态通过 | 待人工验证 |
| PG-09 | 3D“图面显示”复选框保持标准 16px 横向布局，不被全局表单输入框样式撑大或挤压文字 | 已完成并静态通过 | 待人工验证 |
| PG-10 | 3D 预览保留构件列表但去掉“多选模式”文案条；平开/门扇/上悬/下悬按窗框侧固定合页机构旋转，不允许悬空 | 已完成并静态通过 | 待人工验证 |
| PG-11 | 3D 开启扇闭合时嵌入窗框内槽口，0% 开启不外露；打开后围绕槽口侧合页机构运动；可开启构件默认进入可操作选择 | 已完成并静态通过 | 待人工验证 |

## 修改文件与位置

| 文件 | 修改位置 | 说明 |
| --- | --- | --- |
| `E:/doorMES/DoorMES-Designer/dist/assets/app.js` | `renderCanvasCommandZones`、`renderAssemblyCommandZones` | 窗格叠加命令不再生成四周接窗区域；只有连接件/接窗命令显示全局放置区。 |
| 同上 | `renderAssemblyWindowCells` | 多窗立面复用单窗开启扇绘制和开启符号，不因进入拼接总图丢失。 |
| 同上 | `renderAssemblyInternalJointZones`、`insertEngineeringJointAtPlacement` | 识别没有连接件的相邻中缝，点击后建立连接节点并同步间距、旋转、选择和对象树。 |
| 同上 | `renderWindowGeometryHandles`、`bindCanvasGeometryDrag` | 增加窗框宽高及行列分隔拖动柄，提交后写回毫米尺寸/分格权重并触发装配重算。 |
| 同上 | `normalizeCellMarkup`、`createCellMarkup`、`renderCellMarkups`、`bindCanvasMarkupPlacement` | 统一文字、圆孔、方孔、锁具的数据和交互；非文字对象限制在宿主格内。 |
| 同上 | `normalizeProject`、`duplicateWindow`、`cloneCell` | 修复旧数据宿主关系；复制窗体重新生成格、标注和中梃 ID，避免跨窗指向旧对象。 |
| 同上 | `frameShapePath` 在 `renderAssemblySvg` 中的调用 | 多窗总图不再把异形框简化成矩形。 |
| 同上 | `addThreeCellHostedObjects`、`mountThreeCellHostedObjects` | 3D 渲染文字、孔位和锁具；活动扇上的附属对象挂到扇组并随开合运动。 |
| 同上 | `buildThreeWindowModel`、`addThreeDimensionGuides`、`addThreeOrientationLabels` | 3D 尺寸和室内/室外标记；无墙体预览；窗扇几何收紧并保持连续。 |
| 同上 | `threeOperablePocket`、`addThreeFrameRebate`、`addSideHungAssembly`、`addThreeCustomOperableCell`、`addFixedVerticalHingePlates`、`addFixedHorizontalHingePlates`、`mountThreeCellHostedObjects` | 3D 平开/门扇/上悬/下悬先生成窗框内槽口和挡边，再把扇体挂到槽口侧机构根节点；固定合页留在框上，扇体和附属对象随机构轴运动。 |
| 同上 | `ensurePreviewPartSelection`、`updatePreviewPartOptions` | 3D 打开后自动选择首个可开启构件，避免右侧没有选中导致无法直接调开启幅度。 |
| 同上 | `setPreviewSelectionMode`、`updatePreviewDisplayOptions` | 3D 固定多选并保存三个显示开关。 |
| `E:/doorMES/DoorMES-Designer/dist/assets/openings.js` | `openingTransformState` | 支持 `hingeAxis`，3D 机构根节点开合时保持在窗框铰链轴上，只做旋转不漂移。 |
| `E:/doorMES/DoorMES-Designer/dist/assets/app.css` | `.cell-lock-*`、`.internal-joint-zone`、`.geometry-drag-*`、`.preview-visibility` | 锁具、中缝命中、拖动柄和 3D 显隐控件样式。 |
| `E:/doorMES/DoorMES-Designer/dist/index.html` | 顶部标注工具、3D 预览侧栏、资源引用 | 增加“锁具”；移除 3D 单选按钮；去掉“多选模式”文案条；增加尺寸、附属对象和方向标记开关；更新缓存版本。 |
| `E:/doorMES/DoorMES-Designer/docs/door-window-design.v2.schema.json` | `$defs.cellMarkup`、`viewOptions` | 模型支持四类格口附属对象，强制宿主窗/格；保存 3D 三类显隐状态。 |
| `E:/doorMES/DoorMES-Designer/tests/physical-global-editing.test.mjs` | 新增 | 覆盖本轮八项约束，并用数值模型验证贴合、300 mm 连接间距和改宽后的连续性。 |
| `E:/doorMES/DoorMES-Designer/tests/global-canvas-regressions.test.mjs` | 画布渲染测试上下文 | 纳入异形外框、开启投影、内部中缝和尺寸拖动函数。 |
| `E:/doorMES/DoorMES-Designer/tests/lanko-yubeijia-parity.test.mjs` | TC-14 | 验证附属对象的宿主格、拖动保存和边界约束。 |

## 人工逐条验证

| 编号 | 操作步骤 | 通过要点 | 参考图片 | 人工结果 |
| --- | --- | --- | --- | --- |
| PG-01 | 空项目添加四边框；选平开扇；点击格口 | 只显示鼠标落位提示；不出现上/下/左/右黄色区域；格口变为开扇 | `codex-clipboard-d22e85be-25af-4455-9564-345dc6649605.png` | 待填写 |
| PG-02 | 在 C-01 加平开扇；从右侧再接 C-02；继续接 C-03 | 全局立面和俯视图始终保留 C-01 的开启线；可给其他窗继续加开启 | `codex-clipboard-a94f8243-0b37-4d51-90ca-d7d7fcc3a515.png`、`codex-clipboard-a4ac01e5-de26-4968-b728-8f99638c12a9.png` | 待填写 |
| PG-03 | 放置两樘贴合窗且不带连接件；选拼接料；点击中缝 | 中缝有明显命中区；点击一次只增加一个节点；立面、俯视、对象树同步 | `codex-clipboard-6aedde7c-03a6-42ac-82cf-b9d5748704d0.png` | 待填写 |
| PG-04 | 选窗框，拖右边和下边；建立两列后拖中线 | 尺寸实时预览；松开后标尺、对象树属性、相邻窗位置一致；两格总尺寸不变 | 本轮文字需求 | 待填写 |
| PG-05 | 选锁具；点击具体格口；拖动；双击输入尺寸和位置；打开 3D 并开扇 | 2D/对象树/3D 均出现同一锁具；位置不越出格口；活动扇开合时锁具随扇运动 | 本轮文字需求 | 待填写 |
| PG-06 | 分别建立上拱、斜顶、缺角、DIY 窗并组成多窗 | 每樘在总图中保持原框型边界，不被矩形替代；3D 同样保持框型 | 本轮文字需求 | 待填写 |
| PG-07 | 在不同窗格各加圆孔、方孔、文字；拖动；复制窗体；保存并刷新 | 对象均属于点击格口；不可悬空；复制件有独立 ID；刷新后宿主和位置不串窗 | 本轮文字需求 | 待填写 |
| PG-08 | 打开 3D；选择多个可动扇；依次关闭三个显示开关 | 没有单选模式；窗框/窗扇连续；三类图面信息可分别隐藏和恢复；无墙体 | `codex-clipboard-965b4e3e-661f-4575-90e5-2fea3f362ecb.png` | 待填写 |
| PG-09 | 打开 3D，查看右侧“图面显示”并逐项点击 | 三个复选框均为标准小方框，文字横向完整显示，整行可点击 | `codex-clipboard-05a17382-15bf-4386-a68a-a9ff0d2b48b2.png` | 待填写 |
| PG-10 | 单窗加平开扇，进入 3D，拖到侧向和主立面观察，调整开启幅度 0%-100% | 右侧构件列表上方没有“多选模式”文案条；扇体始终嵌在窗框内侧合页轴上运动；合页/锁具随机构连接，不出现悬空板片 | `codex-clipboard-ab8be597-36a7-45e2-8260-ab4628f73489.png`、`codex-clipboard-81378cb9-03ac-44ef-8b9a-d62530390378.png` | 待填写 |
| PG-11 | 单窗加平开扇；进入 3D；分别查看 0%、50%、100% 开启和侧向视角 | 0% 时活动扇在框内槽口中，不压在窗框外侧；打开后沿固定合页轴转动；右侧默认已有可开启构件被选中 | `codex-clipboard-5141dae0-49e0-4162-a9c1-707aa4103d4e.png`、`codex-clipboard-93e04888-f589-45b5-ab86-6580a814e64d.png` | 待填写 |

## 静态验证结果

- JavaScript 语法检查：通过。
- 开启方式与 3D 运动：14 类通过。
- 拓扑、中梃和 BOM：通过。
- 工程连接节点、尺寸和删除同步：通过。
- 多窗布局、组合 BOM 和制造接口：通过。
- 安装包套与固定基准：通过。
- 全局画布、13 类俯视开启、对象树菜单与收起：通过。
- 原型一致性静态约束、TC-14、滚轮缩放：通过。
- 本轮物理全局编辑专项：通过。
- 3D 固定合页机构专项：通过。
- 未执行浏览器人工验收；未推送代码。
