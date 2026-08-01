---
name: linkedcare-case-extract
description: 从京州口腔 LinkedCare 门诊管理系统（jingzhou.linkedcare.cn）交易明细报表中批量提取患者收费数据。按电商模板 6 列输出交易级逐笔明细（患者网电咨询师 / 患者姓名 / 病例id / 收费时间 / 现金类实收 / 收费机构），并筛掉网电咨询师为空的行。当用户提到「病例ID提取」「LinkedCare 导数据」「交易明细报表提取」「电商项目明细导出」「网电咨询师非空」时使用。
agent_created: true
---

# LinkedCare 病例明细提取

绕过页面翻页，直接复用系统自身的报表接口批量拉全量数据。
**比手动 F12 → Network → 复制 Response 快 100 倍，且一次拿全，不用管分页。**

## 🚨 铁律：绝不擅自修改查询条件

**每一次执行都必须遵守：**

1. 打开报表页后，**不管当前页面有没有数据**，都先 `request-help` 暂停，**等用户自己设置好当次筛选条件（时间范围 / 诊所 / 诊断等）并点击【继续】**。
2. 用户点继续后才开始提取。**提取时只读取用户在页面上设好的条件，绝不可用代码修改 `body.criteria` 里的日期范围、诊所、诊断等任何筛选参数。**
3. 如果用户的条件只返回少量数据（甚至 0 条保留行），那是用户的选择，**照常输出，不得自作主张放大范围**。
4. 翻页时只允许改 `pageSize` / `pageIndex`，这两个是分页参数，不是查询条件。

> ⚠️ 历史上曾犯过错：用户页面是单日条件、只返 6 条，agent 擅自把日期改成整月重跑。这是**严禁行为**。

## 核心原理

报表页面结构：主页面 → iframe(`app-new/#/entry/reportCenter.dealDetail`) → 内部走 XHR 请求。

关键接口：
```
POST https://volc-api-hn02.linkedcare.cn:9001/api/v1/complex-report/new/search?reportName=DealDetailByItemReport
```

响应结构（顶层，非 data 包裹）：
```json
{ "items": [...], "totalCount": 0, "pageCount": 0, "pageSize": 100 }
```
⚠️ `totalCount`/`pageCount` 默认返回 0（除非页面点过"总计"），**不能用它判断是否结束**。正确的终止条件：`items.length < pageSize`。

## 输出格式（电商模板 6 列）

**不去重**，每笔收费一行。仅保留「患者网电咨询师」非空的行。表头匹配 `工作计划/2026年/电商项目明细导出模板.xlsx`（已按需求剔除「病历号」列，仅保留「病例ID」）。

| 模板表头 | API 字段 | 说明 |
|---|---|---|
| 患者网电咨询师 | `onlineConsultantName` | 过滤条件：非空才保留 |
| 患者姓名 | `patientName` | |
| 病例id | `patientId` | ⚠️ 病例ID = `patientId`（数字，≠ `privateId`） |
| 收费时间 | `payDateTime` | 格式：ISO 8601 |
| 现金类实收 | `actualPrice` | ⚠️ 优先取 `actualPrice`（= 网页"现金类实收"列 = 折后实收，实测验证2026-08-01，读取 ag-Grid 实际渲染列）；兜底 `totalActualPrice`（=应收/折前）。**≠ incomePrice**（分期记录返回0） |
| 收费机构 | `orderOfficeName` | |

输出文件：`电商项目明细_网电咨询师非空_YYYYMMDD_HHMM.{csv,xlsx}`

## 字段参考（API item 部分常用字段）

API 单条 item 包含约 120 个字段，常用映射：

| 业务含义 | API 字段 | 备注 |
|---|---|---|
| 病例ID | `patientId` | 数字ID，系统唯一病例标识（**≠ `privateId`**） |
| 患者姓名 | `patientName` | |
| 电话 | `mobile` | |
| 收费时间 | `payDateTime` | ISO 8601 |
| 项目大类 | `itemSuperType` | 正畸/种植/全科等 |
| 项目名称 | `itemName` | |
| 就诊/收费机构 | `orderOfficeName` / `payOfficeName` | |
| 网电咨询师 | `onlineConsultantName` | 过滤条件：非空才保留 |
| 现金类实收 | `actualPrice` | 优先 `actualPrice`（= 网页"现金类实收"列 = 折后实收，实测验证）；兜底 `totalActualPrice`（=应收/折前，无折扣时二者相等）。**≠ incomePrice**（分期记录为0） |
| 总实收/应收 | `totalActualPrice` | 折前应收总额（含折扣前），与网页"现金类实收"不同 |

> 📌 **病例ID ≠ 病历号**：系统里 `patientId`（数字，系统唯一病例标识）才是「病例ID」；`privateId`（字符串编号）是「病历号」，二者完全不同。本 skill 输出列只用 `patientId`，绝不用 `privateId`。曾误把 `privateId` 当病例ID，已纠正。

## 执行流程

### 步骤 1：连接浏览器

```bash
bsk browsers                          # 多浏览器时先看实例 ID
bsk session start --browser <id>      # 记下 4 位 session id
bsk tab create --session <id> --url "https://jingzhou.linkedcare.cn/ares3/#/financev2/deal-detail-report-set-v3"
bsk wait-ms 5s
```

⚠️ **不要用 `bsk tab borrow`** —— 用户经常会取消授权弹窗。直接 `tab create` 在 Agent 窗口打开，登录态（cookie）是共享的。

### 步骤 1.5：登录态快速判断（未登录立即终止并等待登录）🚨

打开页面后**先不要进入步骤 2 等条件**，先用脚本快速判断当前是否已登录并真正进入报表页：

```bash
bsk evaluate --session <id> "$(cat scripts/check_login.js)"
```

解析返回的 JSON：

- **`loggedIn: true`** → 已进入报表页，直接往下走步骤 2（等用户设条件）。
- **`loggedIn: false`** → **立刻终止后续所有步骤**，不要傻等用户设条件、也不要空跑提取。改用 `request-help` 等待登录：

```bash
bsk request-help --session <id> \
  --prompt "检测到当前未登录（${reason}），页面停留在登录页或未进入报表页。请先在浏览器完成 jingzhou.linkedcare.cn 登录，等到看到报表页面后，再点击本提示的【继续】。" \
  --title "请先登录 LinkedCare" --timeout 15m
```

用户点【继续】后，**重新执行本步骤（再跑一次 `check_login.js`）**，直到返回 `loggedIn: true` 才进入步骤 2。这样未登录时绝不会浪费用户在页面上设条件，也不会在没登录的情况下空跑提取。

> 判定依据：`reportCenter.dealDetail` 报表在 iframe 内。脚本检测该 iframe 是否存在且内部已渲染报表 UI（含"查询/总计/重置"字样且无登录关键字）；否则在主文档层检测 password 输入框、登录关键字、login 路由。跨域无法读 iframe 内部时给一次机会、提示人工核实。

### 步骤 2：暂停，等用户设好当次条件（无论页面当前有无数据）

🚨 **关键：不先检查数据，直接暂停等用户。** 即使页面已经有数据，也要等用户确认/重设当次条件。
用户每次的查询范围都不同，agent 不得假设、不得沿用、更不得修改上次的筛选条件。

```bash
bsk request-help --session <id> \
  --prompt "请在页面上设置本次的筛选条件（时间范围、诊所、诊断项目），设置好后点击【查询】，然后点本提示的【继续】，我将按你的条件直接提取清洗，不会改动任何筛选参数。" \
  --title "请设置本次查询条件" --timeout 15m
```

用后台方式跑（`run_in_background: true`），再用 TaskOutput 等结果。`outcome=continued` 才往下走。

### 步骤 3：安装请求钩子 + 触发一次查询，抓取真实参数

```bash
bsk evaluate --session <id> "$(cat scripts/install_hook.js)"    # 装 XHR/fetch 钩子
bsk evaluate --session <id> "$(cat scripts/click_query.js)"     # 点 iframe 内的【查询】
bsk wait-ms 3s
```

这一步的意义：**不用手写筛选参数**，直接复用用户在页面上设好的条件（含 Authorization token、诊所ID、日期范围）。
🚨 **严禁修改 `body.criteria` 里的任何筛选参数**（日期/诊所/诊断）。`click_query.js` 只是点页面上的【查询】按钮，触发的是用户已设好的条件；后续翻页只动 `pageSize`/`pageIndex`。

### 步骤 4：全量翻页提取（明细模式）

> 🛡️ **起飞前复检（可选但推荐）**：若步骤 2 等待期间间隔较久、或曾离开页面，提取前可再跑一次 `check_login.js` 确认 `loggedIn: true`，避免 session 过期后 fetch 返回 401 空跑。未登录则按步骤 1.5 的等待逻辑处理。

```bash
bsk evaluate --session <id> "$(cat scripts/extract_detail.js)"
```

捕获 6 字段（电商模板格式），**内联过滤**：跳过 `onlineConsultantName` 为空的行。无需去重。

后台异步跑，每 400ms 一页，pageSize=100。轮询进度：

```bash
bsk evaluate --session <id> "(()=>{const w=Array.from(document.querySelectorAll('iframe')).find(f=>(f.src||'').includes('reportCenter.dealDetail')).contentWindow;const e=w.__extract2;return JSON.stringify({status:e.status,page:e.page,fetched:e.fetched,kept:e.kept,error:e.error})})()"
```

⏱️ 实测速度：约 **每分钟 40 页 / 4000 条**。一个月全集团数据约 487 页 / 4.9 万条，耗时约 12 分钟。
用 `sleep 110` + 查询进度的方式轮询（bsk wait-ms 超过 100s 容易被 SIGKILL）。

脚本内置 `MAX_PAGE=600` 页上限保护。若撞上限未完成，改脚本里的 `MAX_PAGE` 续跑。

### 步骤 5：导出

```bash
# ⚠️ 先清空旧分块，避免混入历史数据（曾因此把 1.8万数据误并入本次结果）
rm -f /tmp/lc_chunk_*.json
# 分批导出 __extract2.rows（已过滤，无需去重）
for i in $(seq 0 N); do
  start=$((i*1000))
  bsk evaluate --session <id> "(()=>{...return JSON.stringify(fr.contentWindow.__extract2.rows.slice($start,$start+1000));})()" > /tmp/lc_chunk_$i.json
done

# 用模板格式合并
~/.workbuddy/binaries/python/envs/default/bin/python scripts/merge_export_template.py [输出目录]
```

输出到 `~/病例提取/电商项目明细_网电咨询师非空_YYYYMMDD_HHMM.{csv,xlsx}`

### 步骤 6：收尾

```bash
bsk session stop <id>
```

## 踩过的坑

1. **快照看不到表格** —— 内容在 iframe 里，`bsk snapshot` 只能看到外壳。必须用 `bsk evaluate` + `iframe.contentDocument`（同源可直接访问）。
2. **`evaluate` 报 "Identifier already declared"** —— 脚本在同一上下文重复执行。所有 JS 必须包在 IIFE `(()=>{ ... })()` 里。
3. **`bsk wait-ms 120s` 被 SIGKILL（exit 137）** —— 超时保护。改用 `sleep 110` 分段等待。
4. **会话卡死 "previous session command is still running"** —— `request-help` 被中断会留下悬挂命令。解法：`pkill -f "bsk.*daemon"` 重启守护进程，会话全清。
5. **`tab borrow` 被取消** —— 用户点了拒绝。直接 `tab create` 即可，不影响登录态。
6. **多浏览器实例** —— `bsk session start` 会报错要求指定 `--browser`。先跑 `bsk browsers` 看列表。
7. **`totalCount` 恒为 0** —— 不要拿它算总页数，用 `items.length < pageSize` 判终止。
8. **`patientId` ≠ `privateId`** —— **病例ID = `patientId`（数字）**，**病历号 = `privateId`（字符串）**，两者完全不同。曾误把 `privateId` 当病例ID，已纠正；模板"病例id"列必须用 `patientId`。
9. **未登录就跑 = 白忙** —— 打开报表页后先用 `check_login.js` 快速判断登录态。未登录（停在登录页 / 目标 iframe 缺失）必须**立即终止**并 `request-help` 等用户登录，绝不能继续等设条件或空跑提取。判定核心：目标报表在 `reportCenter.dealDetail` iframe 内，检查该 iframe 是否真实渲染了报表 UI。

## 数据质量提示

- `onlineConsultantName`（网电咨询师）填充率约 21-25%，明细模式下会大幅缩减行数（仅保留非空的行）。
- `attendantName`（专属客服）填充率极低（<0.1%），本模式不输出该字段；若用户需要，可自行改 `extract_detail.js` 加回。

## 跨用户分享 / 部署

本 skill 已做成**零硬编码**：筛选条件（诊所ID、日期范围、token）全部在运行时从用户自己的查询抓取，不依赖任何特定账号或机器路径。分享只需三步：

1. **前置依赖**：同事必须已装 **browser-skill**（提供 `bsk` 命令），且自己的浏览器已登录 `jingzhou.linkedcare.cn`（skill 复用其登录态，无需账号密码）。
2. **放置目录**：把 `linkedcare-case-extract/` 整个文件夹放进同事的 skills 目录：
   - macOS/Linux：`~/.workbuddy/skills/`
   - Windows：`C:\Users\<用户名>\.workbuddy\skills\`
   - 或放进项目工作区 `.workbuddy/skills/`（对打开该工作区的人自动生效）
3. **触发**：重启 WorkBuddy（或新开对话），说「导出电商明细」或「网电咨询师非空」即可。

> 路径可移植性：输出目录默认 `~/病例提取`，可由脚本参数覆盖；Python 用 managed 运行时 `~/.workbuddy/binaries/python/envs/default/bin/python`，无需随用户名改。详见随包附带的 `README.md`（人类可读版安装指南）。
