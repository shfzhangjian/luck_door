import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = "E:\\aibot\\kb_video3";
const outDir = "E:\\doorMES\\DoorMES-Designer\\outputs\\prototype-test-cases";
const outFile = path.join(outDir, "朗科云设计_豫贝家原型对齐测试用例.xlsx");
const previewFile = path.join(outDir, "测试用例预览.png");

const cases = [
  {
    id: "TC-01",
    target: "新建项目：验证新建项目入口、必填校验、保存后进入设计流程。",
    source: `${root}\\v8\\knowledge_base.md`,
    steps: "1. 打开朗科云设计测试地址。\n2. 点击顶部“新建项目”。\n3. 不填写项目名称直接保存。\n4. 填写项目名称“李小姐”、客户电话“1234567890”。\n5. 保存项目。",
    points: "项目名称和客户电话必须校验必填；保存后右侧项目信息同步显示；进入第一步设计门窗方案。",
    images: `${root}\\v8\\assets\\ui\\strips\\seg_01.png\n${root}\\v8\\assets\\ui\\montage.png`,
  },
  {
    id: "TC-02",
    target: "项目管理：验证项目列表、项目预览、编辑项目、项目进度、打开项目、手机量房图。",
    source: `${root}\\v9\\knowledge_base.md`,
    steps: "1. 点击“打开项目”或“项目管理”。\n2. 单击项目卡片。\n3. 点击项目卡片编辑图标并保存修改。\n4. 点击项目进度节点。\n5. 点击“打开项目”。\n6. 点击“手机量房图”。",
    points: "单击卡片只预览，不直接编辑；编辑入口独立；项目进度可切换；打开项目后进入设计；手机量房图按项目显示。",
    images: `${root}\\v9\\assets\\ui\\montage.png\n${root}\\v9\\assets\\contact_sheet.png`,
  },
  {
    id: "TC-03",
    target: "我的窗型库：验证保存已有窗型并从个人窗型库复用。",
    source: `${root}\\v1\\knowledge_base.md`,
    steps: "1. 在项目中画好一个窗型。\n2. 点击“保存到窗型库”。\n3. 选择窗型类型并保存。\n4. 打开“我的窗型库”。\n5. 对保存的窗型点击“立即使用”。",
    points: "保存后的窗型出现在我的窗型库；立即使用后按原尺寸、原款式生成；不需要重新绘制。",
    images: `${root}\\v1\\assets\\ui\\montage.png`,
  },
  {
    id: "TC-04",
    target: "智能窗型库：验证门洞宽高输入、类型筛选、立即使用生成窗型。",
    source: `${root}\\v1\\knowledge_base.md`,
    steps: "1. 打开“智能窗型库”。\n2. 输入门洞宽 3000、门洞高 2000。\n3. 点击“确定门洞尺寸”。\n4. 切换全部、固定、平开、推拉标签。\n5. 选择窗型并点击“立即使用”。",
    points: "对话框按输入尺寸生成候选窗型；标签切换有效；立即使用后在画布生成对应窗型。",
    images: `${root}\\v1\\assets\\ui\\strips\\seg_13.png\n${root}\\v1\\assets\\ui\\montage.png`,
  },
  {
    id: "TC-05",
    target: "四边框与尺寸编辑：验证先生成窗框，再通过双击标尺修改宽高。",
    source: `${root}\\v10\\knowledge_base.md`,
    steps: "1. 左侧打开“门/窗框”。\n2. 点击“四边框”。\n3. 双击底部宽度尺寸，输入 1800，回车。\n4. 双击右侧高度尺寸，输入 1500，回车。",
    points: "先生成窗框；双击标尺出现内联输入框；回车后立面图、尺寸线、俯视图同步更新。",
    images: `${root}\\v10\\assets\\ui\\montage.png`,
  },
  {
    id: "TC-06",
    target: "开启扇添加：验证开启扇作为构件添加到已有窗格，不新建独立门窗。",
    source: `${root}\\v10\\knowledge_base.md`,
    steps: "1. 已有四边框。\n2. 展开“开启扇”。\n3. 选择左外开、右外开、对开扇等。\n4. 对目标窗格左键点击。",
    points: "选工具后进入放置状态；鼠标移到目标区域有提示；左键后目标区域变为对应开启扇；不新增无关窗型卡片。",
    images: `${root}\\v10\\assets\\ui\\strips\\seg_02.png\n${root}\\v10\\assets\\ui\\montage.png`,
  },
  {
    id: "TC-07",
    target: "推拉扇添加：验证推拉样式应用到已有窗框，不替换整张项目图。",
    source: `${root}\\v10\\knowledge_base.md`,
    steps: "1. 已有四边框。\n2. 展开“推拉扇”。\n3. 选择两扇、三扇、四扇四等分等推拉样式。\n4. 对窗框左键点击。",
    points: "推拉样式应用到目标窗框；系列与开启方式信息更新；不新建独立门窗。",
    images: `${root}\\v10\\assets\\ui\\strips\\seg_02.png`,
  },
  {
    id: "TC-08",
    target: "转角料添加：验证按原型顺序在已有四边框左右边添加转角料。",
    source: `${root}\\01_视频转写_操作步骤.md`,
    steps: "1. 已有一个四边框。\n2. 左侧点击“转角料”。\n3. 鼠标移到窗框左边，左键添加。\n4. 鼠标移到窗框右边，左键添加。\n5. 右键取消添加状态。",
    points: "转角料挂在已有窗框边；默认截面 100*100；默认角度内转/外转 90°；编号显示 T1/T2；右键取消后工具退出选中状态。",
    images: `${root}\\assets\\frames\\f03_0054.8s.png\n${root}\\assets\\frames\\f04_0064.8s.png`,
  },
  {
    id: "TC-09",
    target: "转角料右键菜单：验证菜单项、角度子菜单和角度修改同步。",
    source: `${root}\\knowledge_base.md`,
    steps: "1. 左键选中转角料。\n2. 右键转角料。\n3. 展开“修改角度”。\n4. 选择 135。\n5. 再次右键打开菜单。",
    points: "菜单包含转角设置、修改料长、修改角度、转角形状、型材别名显示设置、更换转角料；角度子菜单含 90/135/180/自定义；选 135 后立面和俯视图同步。",
    images: `${root}\\assets\\crops\\dd\\cornermenu_103_2_105.7.png\n${root}\\assets\\crops\\dd\\list_2_105.5.png`,
  },
  {
    id: "TC-10",
    target: "转角设置弹窗：验证样式、转向、尺寸、角度编辑及保存同步。",
    source: `${root}\\knowledge_base.md`,
    steps: "1. 右键转角料，点击“转角设置”。\n2. 切换矩形、弧形面、万能、巨型转角。\n3. 切换正装/反装。\n4. 双击尺寸值改 50，回车。\n5. 双击角度值改 90 或 135，回车。\n6. 点击保存。",
    points: "弹窗标题、下拉、保存、关闭、红色提示文字按原型；中央预览实时变化；保存后画布转角料同步更新。",
    images: `${root}\\assets\\crops\\corner_dialogs.png\n${root}\\assets\\crops\\dd\\sheet_style.png\n${root}\\assets\\crops\\dd\\sheet_dir.png`,
  },
  {
    id: "TC-11",
    target: "拼接件添加与修改：验证竖拼接墙作为一条立柱靠边添加并可改宽度。",
    source: `${root}\\01_视频转写_操作步骤.md`,
    steps: "1. 已有四边框。\n2. 点击拼接料/竖拼接墙。\n3. 鼠标靠近目标边。\n4. 左键添加拼接件。\n5. 右键取消。\n6. 右键拼接件，把宽度 50 改为 100，回车。",
    points: "拼接件是一条立柱，不是转角料；添加到已有窗框边；修改宽度后立面图和俯视图同步更新；不新建独立门窗。",
    images: `${root}\\assets\\frames\\f11_0196.1s.png\n${root}\\assets\\frames\\f13_0229.0s.png`,
  },
  {
    id: "TC-12",
    target: "连接后继续增加窗框：验证通过连接节点继续添加 C2/C3，形成同一组合。",
    source: `${root}\\knowledge_base.md`,
    steps: "1. 创建第一个四边框 C1。\n2. 在 C1 右边添加转角料或拼接件。\n3. 选择门/窗框里的四边框。\n4. 选择停靠位置为右方或自由。\n5. 添加第二个窗框 C2。\n6. 再通过另一侧连接添加 C3。\n7. 刷新页面。",
    points: "新窗框通过连接节点挂到已有窗框；整体图显示 C1/C2/C3 和 T1/T2；总外尺和分段尺寸同时显示；刷新后仍看到完整拼接图。",
    images: `${root}\\assets\\frames\\f14_0250.5s.png\n${root}\\assets\\contact_sheet.png`,
  },
  {
    id: "TC-13",
    target: "俯视图同步：验证立面图下方俯视图存在，并随转角/拼接/缩放同步。",
    source: `${root}\\knowledge_base.md`,
    steps: "1. 勾选“俯视图”。\n2. 添加普通窗框、转角料、拼接件。\n3. 修改转角角度为 135。\n4. 修改正装/反装。\n5. 鼠标滚轮放大缩小 2D 图。",
    points: "俯视图始终在立面图下方；显示室外/室内；转角料显示 L 形、角度弧线和尺寸；拼接件显示截面；滚轮缩放不破坏布局。",
    images: `${root}\\assets\\contact_sheet.png\n${root}\\assets\\frames\\f07_0163.7s.png`,
  },
  {
    id: "TC-14",
    target: "文字标注与玻璃孔：验证文字可放置/编辑，圆孔/方孔可定位和改尺寸。",
    source: `${root}\\v4\\knowledge_base.md`,
    steps: "1. 点击顶部文字标注。\n2. 拖动文字框到玻璃区域。\n3. 双击输入 5+9A，回车。\n4. 选择圆孔或方孔。\n5. 鼠标跟随到玻璃区域，左键放置。\n6. 双击孔尺寸或距离参数，输入新值，回车。",
    points: "标注可拖动、双击编辑、回车确认；孔跟随鼠标并落到目标玻璃；尺寸和定位参数可编辑。",
    images: `${root}\\v4\\assets\\ui\\montage.png\n${root}\\v4\\assets\\ui\\strips\\seg_00.png`,
  },
  {
    id: "TC-15",
    target: "一键加纱与单扇加纱：验证整体加纱和单扇右键开关。",
    source: `${root}\\v5\\knowledge_base.md`,
    steps: "1. 已有开启扇 A1/A2。\n2. 左侧其他功能点击“一键加纱”。\n3. 检查所有开启扇是否加纱。\n4. 对单个开启扇右键。\n5. 选择“是否带纱”。",
    points: "一键加纱作用于所有开启扇；右键是否带纱只作用于目标扇；加纱区域显示纱网效果。",
    images: `${root}\\v5\\assets\\ui\\montage.png\n${root}\\v5\\assets\\ui\\strips\\seg_00.png`,
  },
  {
    id: "TC-16",
    target: "板材单扇/双扇替换：验证同一区域可直接由单扇替换为双扇。",
    source: `${root}\\v6\\knowledge_base.md`,
    steps: "1. 展开其他单元里的板材。\n2. 选择单扇，点击目标玻璃或开启扇。\n3. 再选择双扇，点击同一目标区域。",
    points: "单扇板材添加成功；再点双扇时替换原板材；无需删除重做；只影响目标区域。",
    images: `${root}\\v6\\assets\\ui\\strips\\seg_04.png\n${root}\\v6\\assets\\ui\\montage.png`,
  },
  {
    id: "TC-17",
    target: "包套设计：验证三步弹窗、包套样式/类型/尺寸编辑及保存。",
    source: `${root}\\v7\\knowledge_base.md`,
    steps: "1. 左侧其他单元点击“包套”。\n2. 打开设置包套弹窗。\n3. 选择包套样式。\n4. 选择包套类型：全边框、三边无底框、左上包框、右上包框。\n5. 双击尺寸数值，输入新值，回车。\n6. 滚轮缩放，长按滚轮平移。\n7. 点击确认设计。",
    points: "弹窗三步结构与原型一致；包套尺寸编辑生效；保存后包套显示在门窗外框。",
    images: `${root}\\v7\\assets\\ui\\strips\\seg_01.png\n${root}\\v7\\assets\\ui\\montage.png`,
  },
  {
    id: "TC-18",
    target: "防盗条：验证单侧右键添加和一键添加防盗条。",
    source: `${root}\\v2\\knowledge_base.md`,
    steps: "1. 已有平开窗。\n2. 右键某一侧玻璃区域。\n3. 选择带防盗条。\n4. 另开场景，左侧其他单元点击“一键添加防盗条”。",
    points: "右键添加只作用于单侧目标区域；一键添加作用于左右目标区域；防盗条显示在对应玻璃区域。",
    images: `${root}\\v2\\assets\\ui\\montage.png\n${root}\\v2\\assets\\ui\\strips\\seg_00.png`,
  },
  {
    id: "TC-19",
    target: "玻璃护栏：验证通过玻璃区域右键菜单添加护栏。",
    source: `${root}\\v11\\knowledge_base.md`,
    steps: "1. 已有平开窗。\n2. 右键目标玻璃区域。\n3. 选择“是否带玻璃护栏”或“玻璃带玻璃护栏”。\n4. 左键确认。",
    points: "护栏通过右键菜单添加；只对目标玻璃生效；护栏显示在对应区域。",
    images: `${root}\\v11\\assets\\crops\\rail_seq.png\n${root}\\v11\\assets\\crops\\canvas_seq.png`,
  },
  {
    id: "TC-20",
    target: "保存门窗信息：验证窗号/安装位置/系列/玻璃等必填、计价、确认添加项目、保存并新增。",
    source: `${root}\\v12\\knowledge_base.md`,
    steps: "1. 完成一个窗型。\n2. 填右侧窗号、安装位置、系列、玻璃、颜色、开启方式、计价。\n3. 点击“保存门窗信息”。\n4. 在确认添加到项目弹窗点击“确认添加”。\n5. 再做一个窗型时点击“保存并新增窗型”。",
    points: "窗号、安装位置、系列、玻璃为必填；计价输入后总价汇总；保存门窗信息需要二次确认添加到项目；保存并新增后原窗型保留。",
    images: `${root}\\v12\\assets\\ui\\strips\\seg_01.png\n${root}\\v12\\assets\\ui\\montage.png`,
  },
];

const refs = [
  ["REF-V1", "窗型库", `${root}\\v1\\knowledge_base.md`, `${root}\\v1\\assets\\ui\\montage.png`, `${root}\\v1\\assets\\ui\\strips\\seg_13.png`],
  ["REF-V2", "防盗条", `${root}\\v2\\knowledge_base.md`, `${root}\\v2\\assets\\ui\\montage.png`, `${root}\\v2\\assets\\ui\\strips\\seg_00.png`],
  ["REF-V3", "转角料、拼接件、俯视图", `${root}\\knowledge_base.md`, `${root}\\assets\\contact_sheet.png`, `${root}\\assets\\crops\\corner_dialogs.png`],
  ["REF-V4", "文字标注、玻璃孔", `${root}\\v4\\knowledge_base.md`, `${root}\\v4\\assets\\ui\\montage.png`, `${root}\\v4\\assets\\ui\\strips\\seg_00.png`],
  ["REF-V5", "纱窗", `${root}\\v5\\knowledge_base.md`, `${root}\\v5\\assets\\ui\\montage.png`, `${root}\\v5\\assets\\ui\\strips\\seg_00.png`],
  ["REF-V6", "板材", `${root}\\v6\\knowledge_base.md`, `${root}\\v6\\assets\\ui\\montage.png`, `${root}\\v6\\assets\\ui\\strips\\seg_04.png`],
  ["REF-V7", "包套", `${root}\\v7\\knowledge_base.md`, `${root}\\v7\\assets\\ui\\montage.png`, `${root}\\v7\\assets\\ui\\strips\\seg_01.png`],
  ["REF-V8", "新建项目", `${root}\\v8\\knowledge_base.md`, `${root}\\v8\\assets\\ui\\montage.png`, `${root}\\v8\\assets\\ui\\strips\\seg_01.png`],
  ["REF-V9", "项目管理", `${root}\\v9\\knowledge_base.md`, `${root}\\v9\\assets\\ui\\montage.png`, `${root}\\v9\\assets\\contact_sheet.png`],
  ["REF-V10", "四边框、开启扇、推拉扇", `${root}\\v10\\knowledge_base.md`, `${root}\\v10\\assets\\ui\\montage.png`, `${root}\\v10\\assets\\ui\\strips\\seg_02.png`],
  ["REF-V11", "玻璃护栏", `${root}\\v11\\knowledge_base.md`, `${root}\\v11\\assets\\crops\\rail_seq.png`, `${root}\\v11\\assets\\crops\\canvas_seq.png`],
  ["REF-V12", "保存门窗信息", `${root}\\v12\\knowledge_base.md`, `${root}\\v12\\assets\\ui\\montage.png`, `${root}\\v12\\assets\\ui\\strips\\seg_01.png`],
];

function styleTitle(range) {
  range.format.font = { name: "Arial", size: 14, bold: true, color: "#111827" };
}

function styleHeader(range) {
  range.format = {
    fill: "#1F2937",
    font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
    borders: { preset: "all", style: "thin", color: "#FFFFFF" },
  };
  range.format.horizontalAlignment = "center";
  range.format.verticalAlignment = "center";
}

function styleBody(range) {
  range.format.font = { name: "Arial", size: 10, color: "#111827" };
  range.format.borders = { preset: "all", style: "thin", color: "#D9E2EC" };
  range.format.wrapText = true;
  range.format.verticalAlignment = "top";
}

const workbook = Workbook.create();
const testSheet = workbook.worksheets.add("测试用例");
const refSheet = workbook.worksheets.add("原型资料索引");

testSheet.showGridLines = false;
refSheet.showGridLines = false;
testSheet.tabColor = "#1F2937";
refSheet.tabColor = "#64748B";

testSheet.getRange("A1:I1").merge();
testSheet.getRange("A1").values = [["朗科云设计 · 豫贝家原型对齐测试用例"]];
styleTitle(testSheet.getRange("A1"));
testSheet.getRange("A2:I2").values = [["资料基础：E:\\aibot\\kb_video3。测试结果列留空，由人工验收填写。"]];
testSheet.getRange("A2:I2").merge();
testSheet.getRange("A2").format.font = { name: "Arial", size: 10, italic: true, color: "#475569" };

const headers = ["测试用例编号", "测试目标", "使用手册来源", "测试步骤", "测试要点", "参考图片地址", "测试结果", "测试人", "备注"];
testSheet.getRange("A4:I4").values = [headers];
styleHeader(testSheet.getRange("A4:I4"));

const rows = cases.map((item) => [
  item.id,
  item.target,
  item.source,
  item.steps,
  item.points,
  item.images,
  "",
  "",
  "",
]);
testSheet.getRangeByIndexes(4, 0, rows.length, headers.length).values = rows;
styleBody(testSheet.getRangeByIndexes(4, 0, rows.length, headers.length));
testSheet.tables.add(`A4:I${rows.length + 4}`, true, "PrototypeTestCases");
testSheet.freezePanes.freezeRows(4);
testSheet.getRange(`G5:G${rows.length + 4}`).dataValidation = {
  rule: { type: "list", values: ["", "通过", "不通过", "阻塞", "待测试"] },
};
testSheet.getRange("A:A").format.columnWidth = 14;
testSheet.getRange("B:B").format.columnWidth = 42;
testSheet.getRange("C:C").format.columnWidth = 42;
testSheet.getRange("D:D").format.columnWidth = 55;
testSheet.getRange("E:E").format.columnWidth = 52;
testSheet.getRange("F:F").format.columnWidth = 55;
testSheet.getRange("G:G").format.columnWidth = 14;
testSheet.getRange("H:H").format.columnWidth = 12;
testSheet.getRange("I:I").format.columnWidth = 28;
testSheet.getRange(`A5:I${rows.length + 4}`).format.rowHeight = 96;

refSheet.getRange("A1:E1").merge();
refSheet.getRange("A1").values = [["原型资料索引"]];
styleTitle(refSheet.getRange("A1"));
refSheet.getRange("A3:E3").values = [["来源编号", "主题", "使用手册路径", "主要参考图片", "补充参考图片"]];
styleHeader(refSheet.getRange("A3:E3"));
refSheet.getRangeByIndexes(3, 0, refs.length, 5).values = refs;
styleBody(refSheet.getRangeByIndexes(3, 0, refs.length, 5));
refSheet.tables.add(`A3:E${refs.length + 3}`, true, "PrototypeReferenceIndex");
refSheet.freezePanes.freezeRows(3);
refSheet.getRange("A:A").format.columnWidth = 12;
refSheet.getRange("B:B").format.columnWidth = 28;
refSheet.getRange("C:E").format.columnWidth = 58;
refSheet.getRange(`A4:E${refs.length + 3}`).format.rowHeight = 54;

workbook.recalculate();

await fs.mkdir(outDir, { recursive: true });
const preview = await workbook.render({
  sheetName: "测试用例",
  range: "A1:I14",
  scale: 1,
  format: "png",
});
await fs.writeFile(previewFile, new Uint8Array(await preview.arrayBuffer()));

const inspect = await workbook.inspect({
  kind: "table",
  sheetId: "测试用例",
  range: "A4:I24",
  tableMaxRows: 6,
  tableMaxCols: 9,
  maxChars: 4000,
});
console.log(inspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outFile);
console.log(JSON.stringify({ outFile, previewFile, rows: rows.length, refs: refs.length }, null, 2));
