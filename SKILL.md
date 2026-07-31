---
name: linkedcare-case-extract
description: 从京州口腔 LinkedCare 门诊管理系统（jingzhou.linkedcare.cn）交易明细报表中批量提取患者数据。支持两种输出模式：①去重模式（按病例ID去重，输出5列患者名单）②明细模式（交易级逐笔记录，按电商模板7列输出，筛掉网电咨询师为空行）。当用户提到「病例ID提取」「LinkedCare 导数据」「交易明细报表提取」「拉患者名单去重」「电商项目明细导出」时使用。
agent_created: true
---

# LinkedCare 病例数据提取

绕过页面翻页，直接复用系统自身的报表接口批量拉全量数据。
**比手动 F12 → Network → 复制 Response 快 100 倍，且一次拿全，不用管分页。**

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

## 两种输出模式

### 模式 A：去重模式（默认）

按 `privateId`（病例ID）去重，每人一行。

| 输出列 | API 字段 |
|---|---|
| 姓名 | `patientName` |
| 电话 | `mobile` |
| 病例ID | `privateId` |
| 患者网电咨询师 | `onlineConsultantName` |
| 专属客服 | `attendantName`（⚠️ 填充率极低 <0.1%） |

输出文件：`病例提取_去重_YYYYMMDD_HHMM.{csv,xlsx}`

### 模式 B：交易级明细（电商模板）⭐

**不**去重，每笔收费一行。仅保留「患者网电咨询师」非空的行。表头匹配 `工作计划/2026年/电商项目明细导出模板.xlsx`。

| 模板表头 | API 字段 | 说明 |
|---|---|---|
| 患者网电咨询师 | `onlineConsultantName` | 过滤条件：非空才保留 |
| 患者姓名 | `patientName` | |
| 病例id | `privateId` | |
| 病历号 | `privateId`（同上） | ⚠️ API 无独立病历号字段，与病例ID同值 |
| 收费时间 | `payDateTime` | 格式：ISO 8601 |
| 现金类实收 | `paymentType1Subtotal` | paymentType1 = 现金类 |
| 收费机构 | `orderOfficeName` | |

输出文件：`电商项目明细_网电咨询师非空_YYYYMMDD_HHMM.{csv,xlsx}`

> **何时用哪种？**
> - 用户要「患者名单」「去重」「按病例ID」→ 模式 A
> - 用户提到「电商」「明细」「模板」「网电咨询师非空」→ 模式 B
> - 不确定就问一句：「需要去重的患者名单，还是每笔收费的明细？」

## 完整字段清单（API item 全量字段参考）

API 单条 item 包含约 120 个字段，常用映射：

| 业务含义 | API 字段 | 备注 |
|---|---|---|
| 病例ID / 病历号 | `privateId` | 页面表格第一列"病历号"的底层字段 |
| 患者姓名 | `patientName` | |
| 电话 | `mobile` | |
| 性别 | `sexStr` | |
| 年龄 | `age` | |
| 初诊日期 | `firstVisit` | |
| 患者来源L1/L2/L3 | `patientSourceLevel1/2/3` | |
| 患者类型 | `patientType` | 普通/VIP等 |
| 就诊机构 | `orderOfficeName` / `payOfficeName` | |
| 收费时间 | `payDateTime` | ISO 8601 |
| 项目大类 | `itemSuperType` | 正畸/种植/全科等 |
| 项目名称 | `itemName` | |
| 划扣标记 | `isDeduction` | 是/否 |
| 订单类型 | `orderTypeStr` | 划扣执行/正常收费等 |
| **人员字段** | | |
| 网电咨询师 | `onlineConsultantName` | |
| 专属客服 | `attendantName` | 填充率极低 |
| 咨询师 | `consultantName` | |
| 开发人 | `developerName` | |
| 接待 | `receptionistName` | |
| 医生 | `doctorName` | |
| 护士 | `nurseName` | |
| **金额字段** | | |
| 原价 | `originPrice` | |
| 实价 | `price` | |
| 现金类实收 | `paymentType1Subtotal` | paymentType1=现金类 |
| 实际收入 | `incomePrice` | 含划扣收入等 |
| 总实收 | `totalActualPrice` | |

## 执行流程

### 步骤 1：连接浏览器

```bash
bsk browsers                          # 多浏览器时先看实例 ID
bsk session start --browser <id>      # 记下 4 位 session id
bsk tab create --session <id> --url "https://jingzhou.linkedcare.cn/ares3/#/financev2/deal-detail-report-set-v3"
bsk wait-ms 5s
```

⚠️ **不要用 `bsk tab borrow`** —— 用户经常会取消授权弹窗。直接 `tab create` 在 Agent 窗口打开，登录态（cookie）是共享的。

### 步骤 2：确认页面有数据，无数据则暂停等人工

```bash
bsk evaluate --session <id> "$(cat scripts/check_data.js)"
```
返回 `hasNoData: true` 或 `hasTotal: false` → 说明还没查询。此时必须暂停：

```bash
bsk request-help --session <id> \
  --prompt "请设置好筛选条件（时间范围、诊所、诊断项目）并点击【查询】，出数据后点继续" \
  --title "请设置查询条件" --timeout 15m
```
用后台方式跑（`run_in_background: true`），再用 TaskOutput 等结果。`outcome=continued` 才往下走。

### 步骤 3：安装请求钩子 + 触发一次查询，抓取真实参数

```bash
bsk evaluate --session <id> "$(cat scripts/install_hook.js)"    # 装 XHR/fetch 钩子
bsk evaluate --session <id> "$(cat scripts/click_query.js)"     # 点 iframe 内的【查询】
bsk wait-ms 3s
```

这一步的意义：**不用手写筛选参数**，直接复用用户在页面上设好的条件（含 Authorization token、诊所ID、日期范围）。

### 步骤 4：全量翻页提取（选模式）

#### 模式 A（去重）：scripts/extract_all.js

```bash
bsk evaluate --session <id> "$(cat scripts/extract_all.js)"
```
捕获 5 字段：name/mobile/privateId/online/attendant。后续步骤 5 去重。

#### 模式 B（明细）：scripts/extract_detail.js

```bash
bsk evaluate --session <id> "$(cat scripts/extract_detail.js)"
```
捕获 7 字段（电商模板格式），**内联过滤**：跳过 `onlineConsultantName` 为空的行。无需后续去重。

后台异步跑，每 400ms 一页，pageSize=100。轮询进度：

```bash
# 模式 A 查 __extract，模式 B 查 __extract2
bsk evaluate --session <id> "(()=>{const w=Array.from(document.querySelectorAll('iframe')).find(f=>(f.src||'').includes('reportCenter.dealDetail')).contentWindow;const e=w.__extract2;return JSON.stringify({status:e.status,page:e.page,fetched:e.fetched,kept:e.kept,error:e.error})})()"
```

⏱️ 实测速度：约 **每分钟 40 页 / 4000 条**。一个月全集团数据约 487 页 / 4.9 万条，耗时约 12 分钟。
用 `sleep 110` + 查询进度的方式轮询（bsk wait-ms 超过 100s 容易被 SIGKILL）。

脚本内置 600 页上限保护。若撞上限未完成，修改脚本里的起止页续跑。

### 步骤 5：导出

#### 模式 A：去重 → 分批导出 → 合并

```bash
# 去重（按 privateId，保留首次出现）
bsk evaluate --session <id> "$(cat scripts/dedupe.js)"

# 分批导出（单次 evaluate 返回值有大小限制，必须切块，1000 条/批）
for i in $(seq 0 N); do
  start=$((i*1000))
  bsk evaluate --session <id> "(()=>{...return JSON.stringify(fr.contentWindow.__uniq.slice($start,$start+1000));})()" > /tmp/lc_chunk_$i.json
done

# 合并生成 CSV + Excel
~/.workbuddy/binaries/python/envs/default/bin/python scripts/merge_export.py [输出目录]
```

#### 模式 B：明细 → 直接分批导出 → 合并

```bash
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
8. **「病历号」≠ 独立字段** —— 页面表格显示"病历号"，但 API 底层就是 `privateId`（病例ID）。系统无独立病历号字段。若业务上两者不同，需从其他数据源补充。

## 数据质量提示

- 一条病例ID通常对应多条收费明细（实测均值 2.7 条）。**去重模式必须做去重；明细模式保留全部交易记录。**
- `attendantName`（专属客服）填充率极低（<0.1%），若用户需要这个数据，先确认系统里是否真的在维护该字段。
- `onlineConsultantName`（网电咨询师）填充率约 21-25%，明细模式下会大幅缩减行数。

## 跨用户分享 / 部署

本 skill 已做成**零硬编码**：筛选条件（诊所ID、日期范围、token）全部在运行时从用户自己的查询抓取，不依赖任何特定账号或机器路径。分享只需三步：

1. **前置依赖**：同事必须已装 **browser-skill**（提供 `bsk` 命令），且自己的浏览器已登录 `jingzhou.linkedcare.cn`（skill 复用其登录态，无需账号密码）。
2. **放置目录**：把 `linkedcare-case-extract/` 整个文件夹放进同事的 skills 目录：
   - macOS/Linux：`~/.workbuddy/skills/`
   - Windows：`C:\Users\<用户名>\.workbuddy\skills\`
   - 或放进项目工作区 `.workbuddy/skills/`（对打开该工作区的人自动生效）
3. **触发**：重启 WorkBuddy（或新开对话），说「提取病例ID」或「导出电商明细」即可。

> 路径可移植性：输出目录默认 `~/病例提取`，可由脚本参数覆盖；Python 用 managed 运行时 `~/.workbuddy/binaries/python/envs/default/bin/python`，无需随用户名改。详见随包附带的 `README.md`（人类可读版安装指南）。
