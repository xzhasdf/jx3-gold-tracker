# 夏天の记账小工具

面向剑网3玩家的桌面收支记账工具：多角色收支记录、副本 CD 追踪、OCR 截图录入，外加技艺收益、交易行物价等实用小工具。

基于 Electron + Vue 3 + TypeScript + Naive UI 构建。

---

## 功能

### 总览

- 工作台布局：收支趋势、角色收支明细 / 黑本收益、角色收益排行、特殊掉落一屏可见
- 按赛季或日期范围查询（二选一），角色、服务器、门派、团牌多维度筛选，角色支持多选
- 角色收益排行可点击筛选；特殊掉落按物品聚合次数，可展开看角色明细

### 收支明细

- 按角色、副本、日期、赛季、团牌筛选，关键字模糊搜索团牌 / 团长 / 黑本人
- 新增记录可上传截图，OCR 自动识别并填充日期、角色、副本、金额等字段
- 团牌下拉可搜索，输入新团牌自动创建；显示常用团牌与该团牌的历史团长，点击即填
- 记录特殊掉落（按当前副本 / 周常挂件 / 侠客秘籍 / 材料分组多选）
- 代清角色可设工资比例，录入时可临时调整单次比例
- 滚动到底自动加载，可自定义显示哪些列

### 角色管理

- 双列卡片：维护角色（ID、服务器、门派），标记代清角色及工资比例
- 显示本周各副本通关情况，「计入 CD 统计」开关，拖动排序

### 副本管理

- 卡片布局：难度标签直接显示本周通关进度，可一次新建多个难度、整组重命名、拖动排序
- 可将副本「设为默认」，新增收支时默认选中；副本可隐藏并随时恢复
- 团牌管理：新增、拉黑 / 取消拉黑、删除团牌；可删除历史团长（团牌仅剩一个团长时不可删），对应记录的团长显示「--」

### 小工具

- **技艺收益**：烹饪 / 缝纫 / 铸造 / 医术 / 梓匠分页签，列出当前版本全部配方，按交易行实时价计算成本、收益、利润、单件成本与每点精力利润
  - NPC 商店有售的材料固定按 NPC 价，其余材料与产物默认交易行价，可改为自定义单价；交易行手续费按 5% 计
  - 每个配方可设制作次数、自备材料数量（可部分自备，不计成本）、产物单次期望数量
  - 可选转神餐 / 佛跳墙补精力并计入成本，分「买」和「自制」两部分计价，个数可手动调整
  - 页签顶部显示各技艺中间件（锭、布、酱料、药引、木板等）实时价；配方下显示产物效果
- **交易行物价**：按名字搜索物品，查看最低单价、在售数量与每日最低价走势，查过的物品保存在常查列表
- **久物主义**：记录装备购入价与日期，算出分摊到每天的使用成本；支持录入收支时联动入账
- **增益计算**：按门派套用根骨 / 体质，按基础属性与启用的小吃小药计算可达层数
- **特殊掉落**：维护各副本的特殊掉落物品（内置通用掉落），供收支记录选用
- **家园藏酒**：记录藏酒进度，到期前自动提醒
- **试炼翻牌占卜**：梅花易数 / 小六壬

### 其他

- 顶栏显示万宝楼当前区服最低金价，可在设置中切换金价区服（技艺收益、交易行物价也使用该区服）
- 赛季设置：内置当前赛季，支持自定义赛季与「结束时间未知」
- 一周从周一 7:00（周 CD 重置）开始计算

---

## 数据来源

| 数据 | 来源 | 说明 |
|---|---|---|
| 金价 | 万宝楼（trade-api.seasunwbl.com） | 官方接口，取当前区服最低金价 |
| 交易行物价 | JX3Box（`POST next2.jx3box.com/api/auction/`） | 玩家插件上传，非官方；取小时聚合的最低单价，主进程缓存 5 分钟 |
| 物品搜索 | JX3Box（`node.jx3box.com/item_merged/name/<关键字>`） | 过滤拾取绑定（不可交易）的物品 |
| 技艺配方 / 产物效果 | JX3Box | 离线打包在 `src/modules/tools/craft/craftData.json` |
| NPC 材料售价 | 游戏内商店截图手动录入 | `src/modules/tools/craft/npcPrices.ts` |

### 更新技艺配方数据

新资料片上线后重跑生成脚本即可（需要联网，约 1~2 分钟）：

```bash
python3 scripts/build-craft-data.py
```

脚本保留最近两个资料片的配方（梓匠全部保留），并解析产物效果、各技艺的中间件。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + TypeScript + Naive UI + Vite |
| 桌面 | Electron (main.cjs + preload.cjs) |
| OCR | Python (PaddleOCR) 常驻子进程，通过 stdin/stdout JSON 行协议通信 |
| 图表 | ECharts 6（按需引入） |
| 打包 | electron-builder (macOS dmg / Windows nsis) |

---

## 打包

### 完整版（含 OCR）

```bash
npm run pack:win    # Windows
npm run pack:mac    # macOS
```

CI：手动触发 GitHub Actions `build-win.yml`（workflow_dispatch）。

完整版包含 Python 运行时和 PaddleOCR 模型，支持截图识别录入。

### Lite 版（无 OCR）

```bash
npm run pack:win-lite
```

CI：手动触发 GitHub Actions `build-win-lite.yml`（workflow_dispatch）。

Lite 版不包含 Python 运行时，安装包体积大幅缩小。OCR 相关功能自动禁用，其余功能完全正常。运行时通过检测 Python 可执行文件是否存在自动区分，无需代码分支。

---

## 开发

```bash
# 安装依赖
npm install

# 启动开发环境（Vite + Electron）
npm run dev:app

# 仅启动前端（浏览器模式，数据存 localStorage；交易行、金价、OCR 等依赖主进程的功能不可用）
npm run dev

# 类型检查 + 构建
npm run build
```

> 修改 `electron/` 下的主进程 / preload 代码后需要重启 `dev:app`，Vite 热更新只刷新渲染进程。

### 目录结构

```
├── electron/               # Electron 主进程（金价、交易行物价、OCR、数据读写）& preload
├── python/                 # OCR worker 脚本 & 图标模板
├── src/
│   ├── composables/        # 全局状态 (useTracker, useGoldPrice, useOcrState, useWineBury, useLineChart)
│   ├── modules/            # 业务模块 (record, role, dungeon, overview, tools, shared)
│   │   └── tools/craft/    # 技艺收益：计算逻辑、配方数据、NPC 价格、金额显示
│   ├── views/              # 页面视图
│   └── assets/             # 静态资源
├── build/                  # NSIS 覆盖脚本 & Lite 版打包配置
├── python-runtime/         # Windows 嵌入式 Python (CI 构建时生成)
├── ocr-models/             # 预下载的 OCR 模型 (CI 构建时生成)
├── scripts/                # 构建辅助脚本（含技艺配方数据生成脚本）
└── example/                # 参考图片/文档
```

### 数据持久化

- **Electron 模式**：JSON 文件存储 (`data/state.json`)，支持自定义数据目录
- **浏览器模式**：localStorage
- 支持导入 / 导出 JSON 备份文件（包含技艺收益设置、交易行常查列表等全部数据）
- 便携模式：所有文件均基于 app 根目录，支持 U 盘运行
