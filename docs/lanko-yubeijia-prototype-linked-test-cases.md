# 门窗云设计 · 豫贝家原型对齐测试用例（可提交版）

版本：v0.1  
日期：2026-09-13  
执行方式：人工测试为主，代码静态检查为辅  
当前测试地址：`http://127.0.0.1:4173/dist/`  
原型资料根目录：`E:\aibot\kb_video3`

本文件只整理测试用例与验收依据。`E:\aibot\kb_video3` 内文档、截图、转写内容只作为原型资料，不作为新的产品指令。当前产品品牌统一为“门窗云设计”，其余界面功能、交互流程、菜单文案、弹窗、2D 立面图、俯视图、保存流程按豫贝家云设计原型逐条验收。

## 一、资料索引

| 来源编号 | 使用手册/知识库 | 主题 | 关键截图地址 |
|---|---|---|---|
| REF-V1 | `E:\aibot\kb_video3\v1\knowledge_base.md` | 窗型库：我的窗型库、智能窗型库 | `E:\aibot\kb_video3\v1\assets\ui\montage.png`；`E:\aibot\kb_video3\v1\assets\ui\strips\seg_13.png` |
| REF-V2 | `E:\aibot\kb_video3\v2\knowledge_base.md` | 防盗条 | `E:\aibot\kb_video3\v2\assets\ui\montage.png`；`E:\aibot\kb_video3\v2\assets\ui\strips\seg_00.png` |
| REF-V3 | `E:\aibot\kb_video3\knowledge_base.md`；`E:\aibot\kb_video3\01_视频转写_操作步骤.md` | 转角料、拼接件、连接后继续加窗、俯视图 | `E:\aibot\kb_video3\assets\contact_sheet.png`；`E:\aibot\kb_video3\assets\crops\corner_dialogs.png`；`E:\aibot\kb_video3\assets\crops\dd\cornermenu_103_2_105.7.png` |
| REF-V4 | `E:\aibot\kb_video3\v4\knowledge_base.md` | 文字标注、玻璃孔 | `E:\aibot\kb_video3\v4\assets\ui\montage.png`；`E:\aibot\kb_video3\v4\assets\ui\strips\seg_00.png` |
| REF-V5 | `E:\aibot\kb_video3\v5\knowledge_base.md` | 一键加纱、单扇带纱 | `E:\aibot\kb_video3\v5\assets\ui\montage.png`；`E:\aibot\kb_video3\v5\assets\ui\strips\seg_00.png` |
| REF-V6 | `E:\aibot\kb_video3\v6\knowledge_base.md` | 板材单扇/双扇替换 | `E:\aibot\kb_video3\v6\assets\ui\montage.png`；`E:\aibot\kb_video3\v6\assets\ui\strips\seg_04.png` |
| REF-V7 | `E:\aibot\kb_video3\v7\knowledge_base.md` | 包套设计 | `E:\aibot\kb_video3\v7\assets\ui\montage.png`；`E:\aibot\kb_video3\v7\assets\ui\strips\seg_01.png` |
| REF-V8 | `E:\aibot\kb_video3\v8\knowledge_base.md` | 新建项目 | `E:\aibot\kb_video3\v8\assets\ui\montage.png`；`E:\aibot\kb_video3\v8\assets\ui\strips\seg_01.png` |
| REF-V9 | `E:\aibot\kb_video3\v9\knowledge_base.md` | 项目管理、打开项目、项目进度、手机量房图 | `E:\aibot\kb_video3\v9\assets\ui\montage.png`；`E:\aibot\kb_video3\v9\assets\contact_sheet.png` |
| REF-V10 | `E:\aibot\kb_video3\v10\knowledge_base.md` | 四边框、尺寸编辑、开启扇、推拉扇 | `E:\aibot\kb_video3\v10\assets\ui\montage.png`；`E:\aibot\kb_video3\v10\assets\ui\strips\seg_02.png` |
| REF-V11 | `E:\aibot\kb_video3\v11\knowledge_base.md` | 玻璃护栏 | `E:\aibot\kb_video3\v11\assets\crops\rail_seq.png`；`E:\aibot\kb_video3\v11\assets\crops\canvas_seq.png` |
| REF-V12 | `E:\aibot\kb_video3\v12\knowledge_base.md` | 保存门窗信息、保存并新增窗型 | `E:\aibot\kb_video3\v12\assets\ui\montage.png`；`E:\aibot\kb_video3\v12\assets\ui\strips\seg_01.png` |

## 二、总体验收规则

| ID | 规则 | 对应来源 |
|---|---|---|
| RULE-01 | 左侧构件库是绘图命令库，点击工具后进入放置状态，不应直接新建一樘无关门窗。 | REF-V3、REF-V10 |
| RULE-02 | 操作顺序必须是：先有窗框，再在窗框边/格口/玻璃区域挂接构件。 | REF-V3、REF-V10 |
| RULE-03 | 通用放置交互：左键选构件，移动到目标对象，左键落点，右键取消。 | REF-V3 |
| RULE-04 | 数值编辑交互：双击尺寸/角度/标尺，输入数值，回车确认。 | REF-V3、REF-V7、REF-V10 |
| RULE-05 | 2D 立面图和下方俯视图必须同时存在，并随连接件、转角、尺寸变化同步更新。 | REF-V3 |
| RULE-06 | 滚轮缩放 2D 图，长按滚轮平移按原型保留。 | REF-V3、REF-V7 |
| RULE-07 | 右键菜单作用于当前目标对象或区域，不能影响整张图。 | REF-V2、REF-V5、REF-V11 |
| RULE-08 | 保存流程必须从“设计门窗方案”进入“保存门窗信息”，保存到具体项目需要确认。 | REF-V12 |

## 三、测试用例总表

| 用例 ID | 用例名称 | 使用手册来源 | 主要参考截图 | 当前实现状态 | 人工验证 |
|---|---|---|---|---|---|
| TC-01 | 新建项目 | REF-V8 | `v8\assets\ui\strips\seg_01.png` | 待验收 |  |
| TC-02 | 项目管理/打开项目 | REF-V9 | `v9\assets\ui\montage.png` | 待验收 |  |
| TC-03 | 我的窗型库 | REF-V1 | `v1\assets\ui\montage.png` | 待验收 |  |
| TC-04 | 智能窗型库 | REF-V1 | `v1\assets\ui\strips\seg_13.png` | 待验收 |  |
| TC-05 | 四边框与尺寸编辑 | REF-V10 | `v10\assets\ui\montage.png` | 待验收 |  |
| TC-06 | 开启扇添加 | REF-V10 | `v10\assets\ui\strips\seg_02.png` | 待验收 |  |
| TC-07 | 推拉扇添加 | REF-V10 | `v10\assets\ui\strips\seg_02.png` | 待验收 |  |
| TC-08 | 转角料添加 | REF-V3 | `assets\frames\f03_0054.8s.png`；`assets\frames\f04_0064.8s.png` | 待验收 |  |
| TC-09 | 转角料右键菜单 | REF-V3 | `assets\crops\dd\cornermenu_103_2_105.7.png` | 待验收 |  |
| TC-10 | 转角设置弹窗 | REF-V3 | `assets\crops\corner_dialogs.png` | 待验收 |  |
| TC-11 | 拼接件添加与修改 | REF-V3 | `assets\frames\f11_0196.1s.png`；`assets\frames\f13_0229.0s.png` | 待验收 |  |
| TC-12 | 连接后继续增加窗框 | REF-V3 | `assets\frames\f14_0250.5s.png` | 待验收 |  |
| TC-13 | 俯视图同步 | REF-V3 | `assets\contact_sheet.png`；`assets\frames\f07_0163.7s.png` | 待验收 |  |
| TC-14 | 文字标注与玻璃孔 | REF-V4 | `v4\assets\ui\montage.png` | 待验收 |  |
| TC-15 | 一键加纱与单扇加纱 | REF-V5 | `v5\assets\ui\montage.png` | 待验收 |  |
| TC-16 | 板材单扇/双扇替换 | REF-V6 | `v6\assets\ui\strips\seg_04.png` | 待验收 |  |
| TC-17 | 包套设计 | REF-V7 | `v7\assets\ui\strips\seg_01.png` | 待验收 |  |
| TC-18 | 防盗条 | REF-V2 | `v2\assets\ui\montage.png` | 待验收 | 本地静态验证通过，待人工验收 |
| TC-19 | 玻璃护栏 | REF-V11 | `v11\assets\crops\rail_seq.png` | 待验收 | 本地静态验证通过，待人工验收 |
| TC-20 | 保存门窗信息 | REF-V12 | `v12\assets\ui\strips\seg_01.png` | 待验收 | 本地静态验证通过，待人工验收 |

## 四、详细测试用例

### TC-01 新建项目

S - 场景：验证新建项目入口、必填校验、保存后进入设计流程。

来源：`E:\aibot\kb_video3\v8\knowledge_base.md`  
参考截图：`E:\aibot\kb_video3\v8\assets\ui\strips\seg_01.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| PRE-01 | 打开测试地址 | `http://127.0.0.1:4173/dist/` | 页面进入门窗云设计 |
| ACT-01 | 点击顶部“新建项目” | 无 | 出现新建项目弹窗 |
| ACT-02 | 不填项目名称保存 | 空项目名称 | 项目名称必填提示出现 |
| ACT-03 | 填写项目名称、客户电话、地址等并保存 | 项目名称：李小姐；电话：1234567890 | 项目保存成功，右侧项目信息同步 |
| ASSERT-01 | 检查右侧项目区域 | 李小姐、1234567890 | 可见项目名称/电话，不进入错误项目 |

人工验证：

| 步骤/断言 | 结果 | 测试人 | 时间 | 备注 |
|---|---|---|---|---|
| TC-01 |  |  |  |  |

### TC-02 项目管理/打开项目

S - 场景：验证项目作为方案文件夹使用，支持预览、编辑、进度、打开和手机量房图。

来源：`E:\aibot\kb_video3\v9\knowledge_base.md`  
参考截图：`E:\aibot\kb_video3\v9\assets\ui\montage.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| ACT-01 | 点击“打开项目”或“项目管理” | 无 | 左侧出现项目卡片列表 |
| ACT-02 | 单击项目卡片 | 选择任意项目 | 只预览，不直接编辑 |
| ACT-03 | 点击项目卡片编辑图标 | 修改客户电话 | 弹出编辑项目弹窗，保存后项目卡同步 |
| ACT-04 | 点击项目进度节点 | 确认方案 | 项目进度切换到对应节点 |
| ACT-05 | 点击“打开项目” | 目标项目 | 进入该项目门窗设计 |
| ACT-06 | 点击“手机量房图” | 无 | 显示项目门洞图/量房图 |

人工验证：空白，待执行。

### TC-03 我的窗型库

来源：`E:\aibot\kb_video3\v1\knowledge_base.md`  
参考截图：`E:\aibot\kb_video3\v1\assets\ui\montage.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| PRE-01 | 先完成一个窗型 | 任意四边框窗 | 画布存在可保存窗型 |
| ACT-01 | 点击“保存到窗型库” | 选择窗型类型 | 保存成功 |
| ACT-02 | 打开“我的窗型库” | 无 | 可见刚保存的窗型 |
| ACT-03 | 点击“立即使用” | 保存窗型 | 按原尺寸、原款式生成 |

人工验证：空白，待执行。

### TC-04 智能窗型库

来源：`E:\aibot\kb_video3\v1\knowledge_base.md`  
参考截图：`E:\aibot\kb_video3\v1\assets\ui\strips\seg_13.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| ACT-01 | 打开“智能窗型库” | 无 | 出现三步式智能窗型库 |
| ACT-02 | 输入门洞宽高 | 宽 3000，高 2000 | 可确认门洞尺寸 |
| ACT-03 | 切换全部/固定/平开/推拉 | 无 | 候选窗型随标签切换 |
| ACT-04 | 点击“立即使用” | 任意候选窗型 | 画布生成对应窗型 |

人工验证：空白，待执行。

### TC-05 四边框与尺寸编辑

来源：`E:\aibot\kb_video3\v10\knowledge_base.md`  
参考截图：`E:\aibot\kb_video3\v10\assets\ui\montage.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| ACT-01 | 左侧“门/窗框”点击“四边框” | 无 | 画布生成四边框 |
| ACT-02 | 双击底部宽度尺寸 | 1800 | 出现内联输入框，回车后宽度变为 1800 |
| ACT-03 | 双击右侧高度尺寸 | 1500 | 回车后高度变为 1500 |
| ASSERT-01 | 检查立面和俯视图 | 无 | 尺寸线和俯视图同步变化 |

人工验证：空白，待执行。

### TC-06 开启扇添加

来源：`E:\aibot\kb_video3\v10\knowledge_base.md`  
参考截图：`E:\aibot\kb_video3\v10\assets\ui\strips\seg_02.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| PRE-01 | 已有四边框 | C1 | 画布存在目标窗框 |
| ACT-01 | 选择左外开/右外开/对开扇等开启扇 | 左外开扇 | 工具进入放置状态 |
| ACT-02 | 点击目标窗格 | 目标玻璃区域 | 该区域变为对应开启扇 |
| ASSERT-01 | 检查底部窗型卡片 | 无 | 不新增无关门窗卡片 |

人工验证：空白，待执行。

### TC-07 推拉扇添加

来源：`E:\aibot\kb_video3\v10\knowledge_base.md`  
参考截图：`E:\aibot\kb_video3\v10\assets\ui\strips\seg_02.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| PRE-01 | 已有四边框 | C1 | 画布存在目标窗框 |
| ACT-01 | 选择两扇/三扇/四扇四等分等推拉样式 | 两扇等分 | 工具进入放置状态 |
| ACT-02 | 点击目标窗框 | 目标窗框 | 推拉样式应用到目标窗框 |
| ASSERT-01 | 检查项目图 | 无 | 不替换整张项目图，不新建无关门窗 |

人工验证：空白，待执行。

### TC-08 转角料添加

来源：`E:\aibot\kb_video3\01_视频转写_操作步骤.md`  
参考截图：`E:\aibot\kb_video3\assets\frames\f03_0054.8s.png`；`E:\aibot\kb_video3\assets\frames\f04_0064.8s.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| PRE-01 | 已有四边框 | C1 | 画布存在窗框 |
| ACT-01 | 左侧点击“转角料” | 无 | 鼠标进入转角料放置状态 |
| ACT-02 | 点击窗框左边 | 左边 | 左侧添加转角料 T1 |
| ACT-03 | 点击窗框右边 | 右边 | 右侧添加转角料 T2 |
| ACT-04 | 右键取消 | 无 | 工具退出选中状态 |
| ASSERT-01 | 检查标注 | 无 | 默认显示 100*100、内转90°/外转90°、T1/T2 |

人工验证：空白，待执行。

### TC-09 转角料右键菜单

来源：`E:\aibot\kb_video3\knowledge_base.md`  
参考截图：`E:\aibot\kb_video3\assets\crops\dd\cornermenu_103_2_105.7.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| ACT-01 | 左键选中转角料 | T1 | T1 红色虚线选中 |
| ACT-02 | 右键转角料 | 无 | 出现对象菜单 |
| ACT-03 | 展开“修改角度” | 无 | 子菜单包含 90、135、180、自定义 |
| ACT-04 | 选择 135 | 135 | 立面角度标注和俯视图同步变更 |
| ASSERT-01 | 检查主菜单项 | 无 | 包含转角设置、修改料长、修改角度、转角形状、型材别名显示设置、更换转角料 |

人工验证：空白，待执行。

### TC-10 转角设置弹窗

来源：`E:\aibot\kb_video3\knowledge_base.md`  
参考截图：`E:\aibot\kb_video3\assets\crops\corner_dialogs.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| ACT-01 | 右键转角料，点击“转角设置” | T1 | 打开“转角设置”弹窗 |
| ACT-02 | 切换转角样式 | 矩形、弧形面、万能、巨型 | 中央预览图同步变化 |
| ACT-03 | 切换转角转向 | 正装/反装 | 预览方向变化 |
| ACT-04 | 双击尺寸值修改 | 100 改 50 | 回车后预览尺寸变为 50 |
| ACT-05 | 双击角度值修改 | 90 或 135 | 回车后预览角度变化 |
| ACT-06 | 点击保存 | 无 | 画布转角料同步更新 |

人工验证：空白，待执行。

### TC-11 拼接件添加与修改

来源：`E:\aibot\kb_video3\01_视频转写_操作步骤.md`  
参考截图：`E:\aibot\kb_video3\assets\frames\f11_0196.1s.png`；`E:\aibot\kb_video3\assets\frames\f13_0229.0s.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| PRE-01 | 已有四边框 | C1 | 画布存在目标窗框 |
| ACT-01 | 左侧点击拼接料/竖拼接墙 | 无 | 进入放置状态 |
| ACT-02 | 靠目标边左键点击 | 左边或右边 | 添加一条立柱式拼接件 |
| ACT-03 | 右键取消 | 无 | 退出放置状态 |
| ACT-04 | 右键拼接件修改宽度 | 50 改 100 | 宽度更新 |
| ASSERT-01 | 检查俯视图 | 无 | 拼接件截面同步变宽 |

人工验证：空白，待执行。

### TC-12 连接后继续增加窗框

来源：`E:\aibot\kb_video3\knowledge_base.md`  
参考截图：`E:\aibot\kb_video3\assets\frames\f14_0250.5s.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| PRE-01 | 创建第一个四边框 | C1 | 画布有 C1 |
| ACT-01 | 在 C1 右边添加转角料或拼接件 | T1 或拼接件 | 连接节点挂在 C1 边上 |
| ACT-02 | 再选择四边框 | 右方/自由停靠 | 新窗框挂到连接节点后方 |
| ACT-03 | 继续通过另一侧连接添加 C3 | C3 | 形成 C1/C2/C3 组合 |
| ASSERT-01 | 刷新页面后检查 | 无 | 仍显示完整拼接图，不只剩一个窗 |

人工验证：空白，待执行。

### TC-13 俯视图同步

来源：`E:\aibot\kb_video3\knowledge_base.md`  
参考截图：`E:\aibot\kb_video3\assets\contact_sheet.png`；`E:\aibot\kb_video3\assets\frames\f07_0163.7s.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| ACT-01 | 勾选“俯视图” | 无 | 立面图下方显示俯视图 |
| ACT-02 | 修改转角角度 | 135 | 俯视图显示对应角度弧线 |
| ACT-03 | 修改正装/反装 | 反装 | 俯视图方向同步变化 |
| ACT-04 | 添加拼接件 | 宽 100 | 俯视图显示拼接件截面 |
| ACT-05 | 鼠标滚轮缩放 2D 图 | 放大/缩小 | 立面和俯视图一起缩放，不丢失 |

人工验证：空白，待执行。

### TC-14 文字标注与玻璃孔

来源：`E:\aibot\kb_video3\v4\knowledge_base.md`  
参考截图：`E:\aibot\kb_video3\v4\assets\ui\montage.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| ACT-01 | 点击文字标注 | 5+9A | 标注可放置到玻璃区域 |
| ACT-02 | 双击文字标注 | 改文字 | 回车后文字更新 |
| ACT-03 | 选择圆孔/方孔 | 任意孔型 | 鼠标跟随预览 |
| ACT-04 | 左键放置玻璃孔 | 目标玻璃 | 孔落到目标玻璃 |
| ACT-05 | 双击孔尺寸/距离 | 新数值 | 回车后尺寸/定位更新 |

人工验证：空白，待执行。

### TC-15 一键加纱与单扇加纱

来源：`E:\aibot\kb_video3\v5\knowledge_base.md`  
参考截图：`E:\aibot\kb_video3\v5\assets\ui\montage.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| PRE-01 | 已有开启扇 | A1/A2 | 画布有可加纱的开启扇 |
| ACT-01 | 左侧“其他”点击“一键加纱” | 无 | 所有开启扇加纱 |
| ACT-02 | 对单个开启扇右键 | 是否带纱 | 只给目标扇切换纱窗 |
| ASSERT-01 | 检查画布 | 无 | 加纱区域显示纱网效果 |

人工验证：空白，待执行。

### TC-16 板材单扇/双扇替换

来源：`E:\aibot\kb_video3\v6\knowledge_base.md`  
参考截图：`E:\aibot\kb_video3\v6\assets\ui\strips\seg_04.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| ACT-01 | 左侧“其他单元”展开板材 | 单扇 | 进入单扇板材放置状态 |
| ACT-02 | 点击目标玻璃/开启扇 | 目标区域 | 单扇板材添加成功 |
| ACT-03 | 再选择双扇点击同一区域 | 双扇 | 直接替换为双扇，不需要删除重做 |
| ASSERT-01 | 检查影响范围 | 无 | 只影响目标区域 |

人工验证：空白，待执行。

### TC-17 包套设计

来源：`E:\aibot\kb_video3\v7\knowledge_base.md`  
参考截图：`E:\aibot\kb_video3\v7\assets\ui\strips\seg_01.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| ACT-01 | 左侧“其他单元”点击“包套” | 无 | 打开设置包套弹窗 |
| ACT-02 | 选择包套样式 | 左右包框等 | 样式选中 |
| ACT-03 | 选择包套类型 | 全边框/三边无底框/左上包框/右上包框 | 类型切换成功 |
| ACT-04 | 双击包套尺寸 | 200 | 回车后尺寸更新 |
| ACT-05 | 滚轮缩放/长按滚轮平移 | 无 | 弹窗视图缩放和平移 |
| ACT-06 | 点击确认设计 | 无 | 包套显示在门窗外框 |

人工验证：空白，待执行。

### TC-18 防盗条

来源：`E:\aibot\kb_video3\v2\knowledge_base.md`  
参考截图：`E:\aibot\kb_video3\v2\assets\ui\montage.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| ACT-01 | 右键目标玻璃区域 | 带防盗条 | 只给目标区域加防盗条 |
| ACT-02 | 左侧“其他”点击“一键添加防盗条” | 无 | 左右目标区域同时加防盗条 |
| ASSERT-01 | 检查影响范围 | 无 | 单侧/整体效果符合原型 |

人工验证：空白，待执行。

### TC-19 玻璃护栏

来源：`E:\aibot\kb_video3\v11\knowledge_base.md`  
参考截图：`E:\aibot\kb_video3\v11\assets\crops\rail_seq.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| ACT-01 | 右键目标玻璃区域 | 是否带玻璃护栏 | 出现玻璃护栏相关菜单项 |
| ACT-02 | 左键确认目标区域 | 无 | 该玻璃添加护栏 |
| ASSERT-01 | 检查影响范围 | 无 | 只对目标玻璃生效 |

人工验证：空白，待执行。

### TC-20 保存门窗信息

来源：`E:\aibot\kb_video3\v12\knowledge_base.md`  
参考截图：`E:\aibot\kb_video3\v12\assets\ui\strips\seg_01.png`

| ID | 操作 | 输入数据 | 预期结果 |
|---|---|---|---|
| PRE-01 | 完成一个窗型 | 任意窗型 | 右侧当前窗信息可填写 |
| ACT-01 | 填写窗号、安装位置、系列、玻璃、颜色、计价 | 窗号 C7 等 | 必填项完整 |
| ACT-02 | 点击“保存门窗信息” | 无 | 出现添加到项目确认弹窗 |
| ACT-03 | 点击“确认添加” | 无 | 当前门窗保存到项目 |
| ACT-04 | 点击“保存并新增窗型” | 无 | 原窗型保留，进入下一窗型设计 |
| ASSERT-01 | 检查底部窗型卡片 | 无 | 已保存窗型仍可切换打开 |

人工验证：空白，待执行。

## 五、缺陷登记模板

| 缺陷 ID | 对应用例 | 实际现象 | 参考截图 | 期望行为 | 严重级别 | 状态 |
|---|---|---|---|---|---|---|
| BUG-001 |  |  |  |  |  |  |

## 六、提交说明

1. 提交测试用例时，使用 TC 编号描述问题，例如：`TC-08 ACT-02：点击窗框左边未添加转角料`。
2. 每个问题必须带一个原型截图路径和一个当前页面截图，方便对比。
3. 人工验证结果先留空，执行后再填“通过/不通过/阻塞”。
4. 本测试包不代表当前实现已通过，只代表验收依据已经和使用手册、参考截图绑定。
