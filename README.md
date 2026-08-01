# LinkedCare 病例明细提取 Skill — 同事安装与使用指南

## 这个 skill 是干什么的
自动从京州口腔 LinkedCare 门诊系统的「交易明细报表」里批量拉数据，按**电商模板 6 列**输出交易级逐笔明细。

**输出字段（患者网电咨询师 / 患者姓名 / 病例id / 收费时间 / 现金类实收 / 收费机构）**，仅保留「患者网电咨询师」非空的行。
适合：电商项目对账、网电渠道效果分析、按咨询师拆分业绩。

> 📌 **字段映射提醒**：
> - 「病例id」对应系统 `patientId`（数字，系统唯一病例标识），**注意 ≠ 病历号 `privateId`**（字符串编号）。两者完全不同，曾误用已纠正。本 skill 只输出「病例id」，绝不输出「病历号」。
> - 「现金类实收」对应系统 `totalActualPrice`（实测验证=网页"现金类实收"列，2026-08-01）。**历史误用链**：`paymentType1Subtotal`(大量0) → `incomePrice`(分期记录为0) → `totalActualPrice`(✓)。兜底 `actualPrice`。

原理：复用系统自带报表接口直接翻页拉全量，比手动 F12 复制快 100 倍，且一次拿全、不用管分页。

## 前提条件（必看）
1. 已安装 WorkBuddy。
2. 已安装 **browser-skill**（提供 `bsk` 命令行，本 skill 依赖它）。
3. 你自己的浏览器已登录 `jingzhou.linkedcare.cn`（skill 复用你的登录态，不需要知道账号密码）。
4. Python 可选：要导出 Excel(.xlsx) 需 `openpyxl`；CSV 不需要。

## 安装方式（任选其一）

### 方式 A：压缩包（最快，适合临时给一个人）
1. 拿到的 `linkedcare-case-extract-skill.zip` 解压。
2. 把解压出的 `linkedcare-case-extract/` 整个文件夹，放进：
   - macOS / Linux：`~/.workbuddy/skills/`
   - Windows：`C:\Users\<你的用户名>\.workbuddy\skills\`
3. 重启 WorkBuddy（或直接新开对话），说一句「导出电商明细」即可触发。

### 方式 B：Git 仓库（推荐团队长期使用，可版本更新）
1. 把 skill 文件夹推到一个内部仓库（工蜂 / GitLab / GitHub 都行）。
2. 同事克隆到本地 skills 目录：
   ```bash
   git clone <仓库地址> ~/.workbuddy/skills/linkedcare-case-extract
   ```
3. 后续更新只需 `git pull`。

### 方式 C：项目级 skill（适合共享同一个工作区的人）
把文件夹放到项目工作区的 `.workbuddy/skills/`（例如 `J京州口腔/.workbuddy/skills/`），对打开该工作区的人自动生效。

## 怎么用
1. 打开 WorkBuddy，说「导出电商明细」或「网电咨询师非空」。
2. 我会打开报表页，**无论当前页面有没有数据，都会先停下来等你**——你在页面上设好**本次**的筛选条件（时间范围、诊所、诊断项目）点【查询】，然后点【继续】。**我绝不会改动你设的任何筛选参数，也不会替你放大或缩小查询范围**（哪怕只返回几行也是你选的）。
3. 剩下的全自动：抓参数 → 全量翻页 → 过滤（仅留网电咨询师非空）→ 导出到 `~/病例提取/`。

## 已知问题
- 「专属客服」字段（attendantName）在系统里填充率极低（<0.1%），本模式不输出该字段；如确有需要可自行改 `scripts/extract_detail.js` 加回。

## 需要改代码的地方
- 输出目录：默认 `~/病例提取`，可在运行 `merge_export_template.py` 时传参覆盖。
- 续跑：若数据超过 6 万条（撞 600 页上限），改 `scripts/extract_detail.js` 里的 `MAX_PAGE` 再跑。
