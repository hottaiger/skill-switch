# 使用 Open Design 优化 Skill Switch UI

日期：2026-07-19  
研究范围：仅使用 `nexu-io/open-design` 官方 README、官方插件声明、源码与文档。

## 结论

当前项目应把 Open Design 用作“设计稿生成与评审工具”，再由 Codex 将确认后的方案小步落到 React/CSS。不要让 Open Design 一次性重写整个 Tauri 项目。

推荐路径：

1. 在 Open Design 中用现有三栏信息架构生成一个 HTML/CSS 优化稿。
2. 用 `od-design-refine` 每轮只优化一个方向：先可读性与层级，再细节和响应式。
3. 用 Critique 做证据化评审，确认后把 HTML、CSS token 和变更说明交给 Codex。
4. Codex 只修改 `src/styles.css` 和必要的 React 结构，运行 `pnpm build`、`pnpm test`。

Open Design 的官方链路是 `brief → plugin → direction → design system → artifact → handoff → memory`；本地、具备文件系统能力的 CLI 会写真实项目文件，无文件工具的 BYOK/API 模式只返回完整 `<artifact>`。[官方 README：完整工作流](https://github.com/nexu-io/open-design#-a-full-workflow--from-brief-to-artifact)

## 为什么适合当前项目

Skill Switch 已有明确且应保留的产品结构：macOS、Tauri 2、React、TypeScript、三栏“导航 + 技能列表 + 检查器”、最小窗口 `900 × 600`、系统明暗主题，见 [`docs/superpowers/specs/2026-07-19-skill-switch-design.md`](../../docs/superpowers/specs/2026-07-19-skill-switch-design.md)。因此需求是精修，不是重新定义产品。

当前 CSS 已具备一套颜色语义变量和明暗主题，但字号大量落在 `7–11px`，正文、按钮、元数据和状态标签层级过密；间距、字号、控件尺寸仍是散落常量，见 [`src/styles.css`](../../src/styles.css)。最优先的 UI 目标应是：

- 建立语义化字体、间距、圆角和控件尺寸 token。
- 把常用正文与交互文字提升到可读级别，减少 `7–10px` 文本。
- 保持三栏信息架构和单一靛紫强调色。
- 统一列表行、筛选、按钮、状态、检查器的视觉层级。
- 检查 `900 × 600`、`1020px` 以下布局、键盘焦点和浅/深色对比度。

这些目标正好符合 `od-design-refine` 的官方约束：先检查现有 artifact；只选 clarity、hierarchy、polish、accessibility、responsiveness 或 fidelity 中一个方向；做最小有效补丁；按当前设计系统与用户目标评审；保留产品意图、无障碍和响应式，不擅自引入新的设计语言。[`od-design-refine/SKILL.md`](https://github.com/nexu-io/open-design/blob/main/plugins/_official/scenarios/od-design-refine/SKILL.md)

## 两种使用模式

### A. 生成并精修设计稿，推荐

适用：先看效果，再决定是否改真实代码。

Open Design 的 Prototype 是单页 HTML artifact，可在沙箱 iframe 中预览并下载源码；它会把 functional skill / design template 与当前 `DESIGN.md` 组合。[官方 README：Studio 与 Prototype](https://github.com/nexu-io/open-design#studio--many-artifact-types-in-one-project)

操作：

1. 安装 Open Design 桌面版。桌面版无需为 Open Design 自身配置 Node、pnpm 或克隆源码，并会检测 `PATH` 上的 Codex 等 CLI。[官方 README：Quick start](https://github.com/nexu-io/open-design#quick-start)
2. 创建项目，选择 `default`（Neutral Modern）设计系统作为起点。官方也提供 `linear-app`，但本项目不应直接复制第三方品牌语言；先用中性系统更稳妥。[官方 README：Design Systems](https://github.com/nexu-io/open-design#design-systems)
3. 把下面的“首轮 brief”放入 Studio，生成桌面应用主界面 artifact。
4. 在 Plugin 页面找到 `od-design-refine`，在 Studio 中通过 composer chip 应用。GUI 的插件安装和应用流程由官方 README 明确支持。[官方 README：Using plugins](https://github.com/nexu-io/open-design#using-plugins)
5. 第一轮只选 `hierarchy`，第二轮只选 `accessibility`，第三轮再选 `polish` 或 `responsiveness`。
6. 对最终稿运行 Critique。官方 Critique 从哲学一致性、视觉层级、细节、功能性、创新性五个维度评分，并要求引用具体证据，给出 Keep / Fix / Quick-wins。[`design-templates/critique/SKILL.md`](https://github.com/nexu-io/open-design/blob/main/design-templates/critique/SKILL.md)
7. 导出 HTML/CSS，交给 Codex 对照真实 React 组件做小补丁。

可直接粘贴的首轮 brief：

```text
为现有 macOS 桌面应用 Skill Switch 生成主界面 UI 优化稿。

保持现有产品意图和功能：左侧导航、中间 Skill 列表、右侧 Skill 检查器；默认 1120×720，最小 900×600；浅色/深色跟随系统；技术实现最终为 Tauri 2 + React + TypeScript + 普通 CSS。

本轮只优化“字号可读性与信息层级”。保持精密、低噪声、单一靛紫强调色，不新增功能，不改变信息架构，不模仿特定品牌。正文与交互文字不低于 13px，辅助信息原则上不低于 11px；明确标题、正文、元数据三级层级；扩大必要的点击区域；保留清晰键盘焦点；检查 900×600 和深色模式。

输出：单页 HTML/CSS artifact、语义化 typography/spacing/control tokens、修改前后对照说明、需要工程实现时保留的交互清单。
```

`od-design-refine` 的 manifest 流程为 direction → patch → critique（最多 3 轮或评分收敛）→ handoff，输入为 `refineGoal` 和可选 `direction`，并声明 `fs:read`、`fs:write` 能力。[`od-design-refine/open-design.json`](https://github.com/nexu-io/open-design/blob/main/plugins/_official/scenarios/od-design-refine/open-design.json)

### B. 让 Open Design 直接修改现有仓库，谨慎试用

适用：已有确认过的 `DESIGN.md`，且愿意逐文件检查 diff。

官方 `od-code-migration` 管线是：

```text
code-import
→ design-extract
→ token-map
→ rewrite-plan
→ patch-edit ↔ build-test
→ diff-review
→ handoff
```

它要求 `repoPath`、`targetStack`，可选 `buildCommand`、`testCommand`；验收条件包含 build/tests 通过，并在最多 8 轮后停止。[`od-code-migration/SKILL.md`](https://github.com/nexu-io/open-design/blob/main/plugins/_official/scenarios/od-code-migration/SKILL.md) · [`open-design.json`](https://github.com/nexu-io/open-design/blob/main/plugins/_official/scenarios/od-code-migration/open-design.json)

建议参数：

```text
repoPath=/Users/zhangshuo12/Documents/my-project/skill-switch
targetStack=React 19 + TypeScript + Vite 8 + plain CSS inside Tauri 2
buildCommand=pnpm build
testCommand=pnpm test
```

建议 tune intent：

```text
只优化现有 Skill Switch 的字体可读性和视觉层级。保持三栏结构、所有功能、数据流、Tauri/Rust 代码、浅深色主题和最小窗口约束。优先把散落字号和尺寸归纳为 CSS 语义 token，再逐组件小步修改；禁止整文件重写，禁止增加依赖，禁止修改 src-tauri。每轮展示 diff，build 与 tests 通过后再交付。
```

此路线当前仍有风险：官方 README 把 “comment-mode surgical edits” 标为部分交付、把 “refresh-existing-codebase plugin” 继续列在 roadmap；因此不应把它当成无需人工审核的成熟重构器。[官方 README：Roadmap](https://github.com/nexu-io/open-design#roadmap)

## Codex 接入

安装桌面版后，在 Open Design 的 `Settings → MCP server` 复制 Codex 专用配置。也可运行：

```bash
od mcp install codex
```

macOS 自带 `/usr/bin/od`（octal dump），可能遮蔽 Open Design 的 `od` 命令；官方明确建议桌面版用户优先复制 Settings 中带绝对路径的 MCP 配置。[官方 README：Install into your coding agent](https://github.com/nexu-io/open-design#install-into-your-coding-agent-no-ui)

配置后，Codex 可通过 MCP 读取 Open Design 项目中的实时文件，如 `tokens.css`、组件和 HTML；官方说明 MCP 默认只读，daemon 绑定 `127.0.0.1`。[官方 README：Use Open Design from your coding agent](https://github.com/nexu-io/open-design#use-open-design-from-your-coding-agent)

插件 CLI 与 GUI 对等，官方给出的通用命令形式如下：

```bash
od plugin search "design refine"
od plugin info od-design-refine
od plugin install od-design-refine
od plugin apply od-design-refine \
  --input refineGoal="提高 Skill Switch 字号可读性与信息层级，保持现有结构和功能" \
  --input direction="hierarchy"
```

命令形态来自官方插件 CLI 文档；具体输入名来自 `od-design-refine` manifest。[官方 README：Using plugins](https://github.com/nexu-io/open-design#using-plugins)

## 可复用能力

- `DESIGN.md`：面向 agent 的设计约束正文；新设计系统包还应包含 `manifest.json` 和 `tokens.css`。[`design-systems/README.md`](https://github.com/nexu-io/open-design/blob/main/design-systems/README.md)
- `tokens.css`：语义化颜色、字体、间距等 token，可作为 Skill Switch `src/styles.css` 变量层的设计输入。[`design-systems/README.md`](https://github.com/nexu-io/open-design/blob/main/design-systems/README.md)
- Design Refine：聚焦一个方向，最小补丁，保持现有产品意图。[`od-design-refine/SKILL.md`](https://github.com/nexu-io/open-design/blob/main/plugins/_official/scenarios/od-design-refine/SKILL.md)
- Critique：五维证据化设计评审，可将改进项拆成 Keep / Fix / Quick-wins。[`critique/SKILL.md`](https://github.com/nexu-io/open-design/blob/main/design-templates/critique/SKILL.md)
- Code Migration：提取现有 CSS token、映射到当前设计系统、产生重写计划、小步修改、构建测试、diff 审核。[`od-code-migration/SKILL.md`](https://github.com/nexu-io/open-design/blob/main/plugins/_official/scenarios/od-code-migration/SKILL.md)
- 实时交接：Codex 通过 MCP 读取 Open Design 项目的实时文件，避免重复 ZIP 导出。[官方 README：MCP](https://github.com/nexu-io/open-design#use-open-design-from-your-coding-agent)

## 限制与验收边界

- `od-design-refine` 针对“现有 Open Design artifact”，不能仅凭插件名推断它能可靠理解并重构任意 Tauri/React 仓库。[官方插件说明](https://github.com/nexu-io/open-design/blob/main/plugins/_official/scenarios/od-design-refine/SKILL.md)
- BYOK/plain API 若没有文件系统工具，只生成 `<artifact>`，不会直接维护本地仓库。[官方 README](https://github.com/nexu-io/open-design#-a-full-workflow--from-brief-to-artifact)
- `od-code-migration` 声明了写文件和 subprocess 能力，必须在干净分支使用，限制文件范围，并人工接受 diff。[官方插件 manifest](https://github.com/nexu-io/open-design/blob/main/plugins/_official/scenarios/od-code-migration/open-design.json)
- Open Design 生成的 HTML/CSS 是设计交付物，不自动等于现有 React 组件、Tauri 行为和测试已正确迁移。
- 本项目最终验收必须在真实应用中完成：`pnpm tauri dev` 检查 1120×720、900×600、浅色/深色、键盘操作，再运行 `pnpm build` 和 `pnpm test`。

## 最小落地顺序

1. 用首轮 brief 生成优化稿，不接触真实仓库。
2. hierarchy → accessibility → polish，最多三轮，每轮保留前后截图。
3. Critique 只接受带具体元素证据的 Fix / Quick-wins。
4. 从确认稿抽取 typography、spacing、control-size token。
5. Codex 先只改 `src/styles.css`，必要时再小改组件结构。
6. 真实 Tauri 窗口验收后，再决定是否把设计约束沉淀为 Skill Switch 自有 `DESIGN.md`。
