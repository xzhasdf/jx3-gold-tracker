# 夏天の记账小工具

面向剑网3玩家的桌面收支记账工具，支持多角色管理、副本追踪、OCR 截图识别录入。

基于 Electron + Vue 3 + TypeScript + Naive UI 构建。

---

## 功能

### 收支记录

- 按角色、副本、日期范围筛选记录，支持快捷日期（本周/本月等）
- 关键字模糊搜索团牌/团长/黑本人
- 新增记录时支持上传截图，通过 OCR 自动识别并填充日期、角色、副本、金额等字段
- 支持代清角色：可设置工资比例，录入时可临时调整单次比例
- 记录团牌与团长 ID，支持将团牌加入黑名单并在录入时提示
- 汇总展示总收入、总支出、收支净额

### 角色管理

- 维护角色列表（ID、服务器、门派），支持标记代清角色及设置工资比例
- 本周 CD 查询：按角色展示各副本本周通关状态与整体进度

### 副本管理

- 自定义副本（人数/难度/名称），支持关注副本以纳入 CD 统计，支持隐藏副本
- 团牌名单：汇总所有记录中出现过的团牌和团长 ID，含黑名单状态
- 支持团长/团牌模糊查询

### 小工具

- **家园藏酒**：选择酒类、埋藏目标和角色，进度条展示藏酒进度
- 到期前 24 小时自动弹窗提醒，支持按角色筛选
- 支持汾酒/玉露酒/葡萄酒/女儿红/状元红/高粱酒/关外白酒，埋藏目标：今朝醉/六日醉/旬又三/醉月香/藏百日

### 总览

- 按角色汇总收支，可展开查看各副本明细
- 折线图展示指定时段内按角色或副本的收支趋势
- 支持按角色、服务器、门派、日期范围多维度筛选

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + TypeScript + Naive UI + Vite |
| 桌面 | Electron (main.cjs + preload.cjs) |
| OCR | Python (PaddleOCR) 常驻子进程，通过 stdin/stdout JSON 行协议通信 |
| 图表 | ECharts 6 |
| 打包 | electron-builder (macOS dmg / Windows nsis) |

---

## 打包

项目支持两种打包模式：

### 完整版（含 OCR）

```bash
# 本地打包
npm run pack:win    # Windows
npm run pack:mac    # macOS

# CI 打包
# 触发 GitHub Actions: build-win.yml (workflow_dispatch)
```

完整版包含 Python 运行时和 PaddleOCR 模型，支持截图识别录入。

### Lite 版（无 OCR）

```bash
# 本地打包
npm run pack:win-lite

# CI 打包
# 触发 GitHub Actions: build-win-lite.yml (workflow_dispatch)
```

Lite 版不包含 Python 运行时，安装包体积大幅缩小。OCR 相关功能自动禁用，其余功能完全正常。

运行时通过检测 Python 可执行文件是否存在自动区分，无需代码分支。

---

## 开发

```bash
# 安装依赖
npm install

# 启动开发环境（Vite + Electron）
npm run dev:app

# 仅启动前端（浏览器模式，数据存 localStorage）
npm run dev
```

### 目录结构

```
├── electron/           # Electron 主进程 & preload
├── python/             # OCR worker 脚本 & 图标模板
├── src/
│   ├── composables/    # 全局状态 (useTracker, useOcrState, useWineBury)
│   ├── modules/        # 业务模块 (record, role, dungeon, overview, tools)
│   ├── views/          # 页面视图
│   └── assets/         # 静态资源
├── build/              # NSIS 覆盖脚本 & Lite 版打包配置
├── python-runtime/     # Windows 嵌入式 Python (CI 构建时生成)
├── ocr-models/         # 预下载的 OCR 模型 (CI 构建时生成)
├── scripts/            # 构建辅助脚本
└── example/            # 参考图片/文档
```

### 数据持久化

- **Electron 模式**: JSON 文件存储 (`data/state.json`)，支持自定义数据目录
- **浏览器模式**: localStorage
- 支持导入/导出 JSON 备份文件
- 便携模式：所有文件均基于 app 根目录，支持 U 盘运行

---

## 功能排期

### 1. 新增特殊掉落记录功能（含特殊物品录入）

> 状态：待开发

- 支持特殊掉落条目的记录
- 支持自定义特殊物品的录入与管理
