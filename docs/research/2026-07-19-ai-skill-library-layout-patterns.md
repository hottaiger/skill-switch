# AI 技能库列表与卡片展示模式研究

日期：2026-07-19  
范围：为 Skill Switch 的“技能库”页面优化列表屏效、减少重复信息、增加卡片视图提供设计输入。仅采用产品方官方文档、官方产品页或官方 Marketplace 页面。

## 当前页面的设计约束

当前实现是固定三栏应用：170px 导航、中心技能库、280px 检查器。中心区域的每个行项目同时展示 Skill 图标、名称、完整描述和全部受管应用的状态方块；行高最小为 64px。搜索已覆盖名称和描述，已有“全部 / 已启用 / 未启用”筛选。该信息在 [SkillLibrary.tsx](../../src/components/SkillLibrary.tsx) 与 [styles.css](../../src/styles.css) 中可确认。

本次优化应保持现有业务语义（Skill、受管应用可见性、选中后在检查器查看详情），只改变技能库的信息编排与视图模式。

## 官方产品证据

### VS Code Extensions：高密度列表是管理已安装扩展的默认形态

[VS Code Extension Marketplace 官方文档](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace) 明确说明：扩展视图中的每一项展示**简短描述、发布者、下载量、五星评分**；选择条目后才进入详情页。安装完成后，原“Install”按钮会替换为管理入口。它还提供安装、已启用、已禁用、已过期、推荐、热门等状态筛选，支持按安装量、评分、名称、发布日期、更新时间排序，以及可组合的 `@installed @category:themes` 类查询。

可迁移结论：

- 默认列表行只保留快速比较所需的名称、单行摘要、关键状态和一个紧凑元数据；路径、完整描述、具体应用开关等放在右侧检查器。
- “已启用 / 未启用”应是可检索的状态筛选，不应在每行重复完整解释。
- 视图顶部应把搜索、状态筛选、排序收拢为同一个控制区；列表不需要统计卡片来重复总数。

### Cursor Marketplace / Customize：发现与管理分层，安装动作靠近条目

[Cursor Marketplace 官方页](https://cursor.com/marketplace) 使用一个 “Search plugins and automations” 入口，并把内容先分成 Featured Plugins 和 Featured Automations；每张推荐条目以 logo、名称和一句能力摘要建立识别。[Cursor 的官方产品页](https://cursor.com/product) 将 Plugins、Skills、MCP 作为不同能力类别，Skills 列表使用命令名加单行任务摘要来呈现。[Cursor Customize 更新说明](https://cursor.com/changelog/customize) 则说明其将 plugins、skills、MCPs、subagents、rules、commands、hooks 集中在一个管理面，并提供“最受欢迎”排行榜与一键添加。

可迁移结论：

- **浏览 / 发现**适合卡片：视觉 logo、名称、单行用途、一个显式动作即可；卡片解决“选择哪一个”。
- **已安装 / 管理**适合列表：状态、范围与批量筛选优先；列表解决“快速定位、核对和操作”。
- 如果引入卡片视图，应与“列表”并列为展示切换，不要将两种结构混在同一行里；卡片仅展示名称、描述截断、启用应用数（如 `2/4 个应用已启用`）和状态，不复述右侧详情。

### ChatGPT Apps / GPTs：目录、能力与连接状态分离

[ChatGPT Apps 官方文档](https://help.openai.com/en/articles/11487775-apps-in-chatgpt) 说明 App Directory 负责集中浏览发现；用户可在目录中按类别浏览，点击条目进入详情查看能力，再点击 Connect。工作区管理员使用 Directory、Enabled、Drafts 分组；Enabled 中支持搜索、筛选和对一组 app 的批量动作，例如筛选具有 write actions 的 app 后批量禁用。[GPTs 官方说明](https://help.openai.com/en/articles/8554407-gpts-faq) 规定用户通过 Explore GPTs 浏览可用 GPT，打开后先查看描述或 conversation starters，再开始使用；[GPT 创建指南](https://help.openai.com/en/articles/8554397-browsing-with-chatgpt) 进一步说明名称和描述会出现在搜索结果、GPT Store、分享链接与会话顶部。

可迁移结论：

- 条目名称与短描述是目录层的稳定“可发现性”信息；能力、权限、连接状态属于详情或可筛选元数据。
- 将“目录 / 已启用（已安装）/ 草稿（可替换为未启用）”转换为轻量状态分组或筛选，能直接减少每项重复的状态符号。
- 批量管理是状态筛选后的后续能力，不应预先占用每个条目的常驻空间。

### Claude Skills：目录发现与已安装管理分开，Skill 以聚焦工作流定义

[Claude 官方统一目录说明](https://support.claude.com/en/articles/14328846-browse-skills-connectors-and-plugins-in-one-directory) 将 Skills、Connectors、Plugins 汇总到同一个 Browse 入口；安装后在 Customize > Skills 中管理，默认启用。它证明“发现目录”和“已安装管理”可分层，而不是让本地管理列表兼任市场页。[Claude 官方自定义 Skills 文档](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills) 将 Skill 定义为面向特定、可重复任务的专门知识和工作流；每个 Skill 至少由含名称与描述元数据的目录组成，并建议保持“一个 workflow”，不要把一切都装进同一 Skill。

可迁移结论：Skill Switch 的列表主视觉应以 **Skill 名称 + 工作流摘要** 为核心，而不是以文件路径或所有宿主应用状态为核心；这些运维细节应按需展开。

## 建议的页面信息架构

| 区域 | 列表视图（默认） | 卡片视图（可切换） | 详情检查器 |
| --- | --- | --- | --- |
| 识别 | 图标、名称、单行摘要 | 图标、名称、两行摘要 | 完整名称、完整描述 |
| 状态 | `已启用` / `未启用` + `2/4` 应用计数 | 同一状态摘要，不铺开四枚应用方块 | 各应用开关与完整状态 |
| 元数据 | 可选的更新时间或来源，最多一项 | 不显示，避免卡片噪声 | 路径、来源、具体修改时间 |
| 操作 | 选中并查看详情 | 选中并查看详情 | 启用、禁用、卸载等具体操作 |

## 可落地原则（供 Open Design 与技术方案使用）

1. **默认高密度列表，卡片作为显式切换。**列表行目标高度应压到约 48–56px；卡片用于扫读工作流与空白较多的场景，建议两列自适应，而非默认替换列表。
2. **每个条目只显示一次状态摘要。**把现在的四枚应用 chip 收敛为 `2/4 已启用` 或单个语义状态 badge；具体哪几个应用由检查器展示。
3. **名称、摘要、状态优先，路径与完整描述后置。**路径不进入列表或卡片默认面；描述在列表截为一行、卡片最多两行。
4. **把搜索、状态筛选、排序、视图切换做成同一工具栏。**至少提供全部、已启用、未启用与名称/最近修改排序；后续可按宿主应用筛选，不在 v1 强制加入复杂语法。
5. **卡片不等于新增信息。**卡片和列表必须绑定同一 `SkillRecord` 与选中行为，字段一致、密度不同；不新增统计、推荐、市场下载量或示例数据。

## 不建议引入的模式

- 不复制 Marketplace 的下载量、评分、热门榜等外部发现指标：本地 Skill 管理没有对应可靠数据源。
- 不在每张卡片重复路径、所有应用开关、完整描述或危险操作：会降低屏效并与检查器重复。
- 不把“卡片列表”与传统行列表同时堆叠：通过一个可见的列表/卡片切换保持单一阅读模型。

## 设计验收点

- 1120px 宽度的三栏窗口中，中心区域在不横向滚动的条件下能显示比当前更多的技能条目。
- 列表与卡片使用相同的搜索、筛选、选中和检查器数据流。
- 任何受管应用的具体启用状态仍可在检查器中完整查看和操作。
- 视觉只改变展示层；扫描、软连接、导入、备份、恢复与数据模型不变。
