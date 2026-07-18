# Skill Switch 独立应用设计

日期：2026-07-19
状态：已确认

## 1. 目标

Skill Switch 是独立于 CC Switch 的 macOS Skill 管理应用。它只管理本机 Agent Skills，不读取、不迁移、不依赖 CC Switch 的数据库、配置、进程或发布产物。

核心目标：

- 以 `~/.agents/skills/` 作为唯一 Skill 数据源。
- 查看已安装 Skill，并控制它们对不同 AI 应用的可见性。
- 从已知应用目录导入遗留 Skill，完成去重、冲突处理和软连接归一化。
- 卸载前自动备份，并支持恢复。
- 保持产品边界小，不引入仓库发现、在线市场或 `skills.sh`。

## 2. 范围

### v1 包含

- 已安装 Skill 列表、搜索、筛选和详情。
- Claude、Gemini、OpenCode、Hermes 的逐 Skill 启用/禁用。
- Codex、Cursor 的自动可见状态展示。
- 从 Claude、Gemini、OpenCode、Hermes 已知目录扫描并导入 Skill。
- 同名冲突比较与人工裁决。
- 卸载、备份、恢复和备份保留策略。
- 应用目录自动检测与自定义路径。
- 跟随 macOS 系统的浅色/深色主题。

### v1 不包含

- CC Switch 数据库迁移、读取或兼容层。
- Git 仓库发现、在线 Skill 市场、远程下载。
- `skills.sh` 集成。
- ZIP 或任意目录选择器导入。
- Windows、Linux 支持。
- 菜单栏常驻图标。
- Skill 内容编辑器。
- 后台常驻文件监听；外部文件变化在窗口重新获得焦点或手动刷新时重新扫描。

## 3. 产品与仓库边界

- 仓库：`/Users/zhangshuo12/Documents/my-project/skill-switch`
- 产品名：`Skill Switch`
- 平台：macOS
- 技术栈：Tauri 2、React、TypeScript、Rust
- 独立 Git 历史、Tauri 包标识、应用数据目录和发布流程。
- CC Switch 现有代码与未提交改动保持不变。
- 允许参考并重写 CC Switch 中与 Skill 有关的行为，但不复制 Provider、Proxy、MCP、数据库或迁移模块。

## 4. 信息架构与布局

主界面采用已批准的「技能库 + 检查器」三栏布局：

1. 左栏：技能库、本地导入、备份、应用快捷入口、设置。
2. 中栏：搜索、筛选、Skill 列表、刷新和导入入口。
3. 右栏：当前 Skill 的元数据、描述、应用可见性、源路径和卸载入口。

默认窗口为 `1120 × 720`，允许缩放，最小尺寸为 `900 × 600`。

主题跟随 macOS 系统外观。浅色和深色模式使用同一信息层级、间距与组件结构，只切换语义颜色令牌。视觉方向遵循 Open Design 的 artifact-first 和 design-token 方法，采用精密、低噪声、单一靛紫强调色的生产力工具风格。

关闭窗口时应用继续驻留；点击 Dock 图标重新打开窗口；`⌘Q` 退出。v1 不提供菜单栏图标。

## 5. 核心模块

### 5.1 `skill_fs`

负责扫描和校验 `~/.agents/skills/`。

- 一个直接子目录代表一个 Skill。
- 有效 Skill 必须包含普通文件 `SKILL.md`。
- Skill 标识使用目录名；不读取数据库生成 ID。
- 列表状态、修改时间、大小和描述均由文件系统实时派生。
- 描述优先读取 `SKILL.md` frontmatter 的 `description`，缺失时显示空描述，不阻断管理。

### 5.2 `app_registry`

负责应用定义、默认路径、路径覆盖和能力声明。

| 应用 | 默认 Skill 目录 | 行为 |
|---|---|---|
| Claude | `~/.claude/skills/` | 逐 Skill 软连接，可编辑根路径 |
| Gemini | `~/.gemini/skills/` | 逐 Skill 软连接，可编辑根路径 |
| OpenCode | `~/.config/opencode/skills/` | 逐 Skill 软连接，可编辑根路径 |
| Hermes | `$HERMES_HOME/skills/`，未设置时 `~/.hermes/skills/` | 逐 Skill 软连接，可编辑根路径 |
| Codex | `~/.agents/skills/` | 原生读取，固定自动可见 |
| Cursor | `~/.agents/skills/` | 原生读取，固定自动可见 |

Claude、Gemini、OpenCode、Hermes 的自定义值表示完整 Skill 根目录。Codex、Cursor 不提供路径编辑和开关。

### 5.3 `link_manager`

负责 Claude、Gemini、OpenCode、Hermes 的逐 Skill 软连接。

- 启用：创建 `<app-root>/<skill-name> -> ~/.agents/skills/<skill-name>`。
- 禁用：仅删除指向当前 SSOT Skill 的软连接。
- 若目标位置是普通目录、普通文件或指向其他位置的软连接，不覆盖，返回冲突。
- 开关操作即时执行；成功后更新 UI，失败时保持原状态并显示原因。
- 每次变更后重新读取链接状态，避免前端乐观状态与磁盘不一致。

### 5.4 `import_service`

只扫描 Claude、Gemini、OpenCode、Hermes 的当前配置目录。

每个导入项独立执行以下事务：

1. 校验源目录、名称和 `SKILL.md`。
2. 比较 `~/.agents/skills/<name>` 是否存在。
3. 不存在时复制到 SSOT 临时目录。
4. 校验临时副本，再以原子重命名进入 SSOT。
5. 通过 `backup_service` 将原应用目录中的 Skill 写入来源操作为 `import` 的可恢复备份。
6. 在原位置创建指向 SSOT 的软连接。
7. 重新扫描并确认源、SSOT、软连接三方状态。

同名处理：

- 内容完全相同：不复制第二份；保留 SSOT，并把来源目录归一化为软连接。
- 内容不同：暂停该项，展示来源路径、修改时间和文件差异，让用户选择保留 SSOT 版本或导入版本。
- 用户未裁决时不修改该冲突项；其他无冲突项继续导入。
- 选择导入版本时，旧 SSOT 版本先进入备份，再替换。

内容比较基于目录内所有普通文件的相对路径和内容哈希，忽略文件修改时间，不跟随目录中的外部软连接。

### 5.5 `backup_service`

备份根目录为 `~/.skill-switch/backups/`。

- 卸载前将 Skill 复制到 `<skill-name>/<timestamp>/content/`。
- 每份备份包含 `metadata.json`，记录 Skill 名、时间、来源操作、原路径和操作前应用可见性；导入备份、替换备份和卸载备份统一执行相同的保留策略。
- 每个 Skill 最多保留 5 份备份；第 6 份成功写入并校验后删除最旧备份。
- 恢复时先检查 SSOT 同名冲突；无冲突则恢复内容，并按元数据重建仍有效的应用软连接。
- 恢复不会删除备份本身。

卸载事务：

1. 创建并校验备份。
2. 删除由 Skill Switch 管理、且确实指向该 SSOT Skill 的应用软连接。
3. 删除 SSOT Skill。
4. 重新扫描状态。

备份失败时不得删除任何 Skill 内容或软连接。

### 5.6 `config_store`

配置文件为 `~/.skill-switch/config.json`，仅保存：

- Claude、Gemini、OpenCode、Hermes 的自定义 Skill 根目录。
- UI 偏好，例如最近选择的导航项和列表筛选。
- 配置 schema 版本。

配置使用临时文件加原子重命名写入。配置损坏时保留原文件、加载默认值并提示用户，不静默覆盖。Skill、启用状态和备份索引不写入配置文件或数据库。

### 5.7 `tauri_commands`

Rust 向前端暴露小粒度、可测试的命令边界：

- `scan_skills`
- `scan_import_candidates`
- `set_skill_visibility`
- `import_skills`
- `resolve_import_conflict`
- `uninstall_skill`
- `list_backups`
- `restore_backup`
- `get_settings`
- `update_app_path`

所有命令返回结构化结果和稳定错误码，不把 Rust 错误字符串当作前端业务协议。

## 6. 数据流

### 启动与刷新

1. 读取配置。
2. 解析应用目录。
3. 扫描 `~/.agents/skills/`。
4. 检查四个可配置应用目录中的对应软连接。
5. 合成前端只读视图模型。

窗口重新获得焦点、用户点击刷新或任何写操作完成后，重复步骤 3 至 5。v1 不运行后台目录监听器。

### 可见性切换

1. 前端发送 Skill 名、应用和目标状态。
2. Rust 重新校验 Skill 与应用根目录。
3. 创建或删除软连接。
4. Rust 重新读取实际状态并返回。
5. 前端用返回状态替换当前行和检查器状态。

### 导入

导入页先展示候选项和冲突状态。用户确认后按项执行事务，并持续返回成功、跳过、冲突、失败四类结果。单项失败不回滚已经成功的其他项。

## 7. 文件系统安全

- 所有 Skill 名必须是单层合法目录名，拒绝空值、`.`、`..`、路径分隔符和 NUL。
- 所有写操作在执行前重新 canonicalize 根目录和目标路径。
- 不跟随来自应用目录的外部目录软连接执行复制。
- 删除软连接时使用 `symlink_metadata` 检查链接本身，绝不递归删除链接目标。
- 不覆盖用户拥有的普通目录或未知软连接。
- 临时目录、备份和最终目标必须位于各自声明的根目录下。
- UI 必须展示发生冲突的实际路径，便于用户人工处理。

## 8. 错误处理

错误按以下稳定类别返回：

- `invalid_skill`
- `invalid_path`
- `path_conflict`
- `permission_denied`
- `source_missing`
- `copy_failed`
- `verification_failed`
- `symlink_failed`
- `backup_failed`
- `restore_conflict`
- `config_corrupted`

原则：

- 写操作先准备、再校验、最后替换。
- 能保持原状态时必须保持原状态。
- 部分批量成功要逐项呈现，不使用一个模糊的全局失败提示。
- 可操作错误显示路径、失败步骤和建议动作；未知错误保留技术详情供复制。

## 9. 前端状态与交互

- React 状态只缓存当前扫描快照，不作为事实来源。
- 选择 Skill 后右侧检查器更新；未选择时显示引导空态。
- 应用开关点击后进入单项 loading，防止重复操作。
- Codex、Cursor 显示“自动可见”，控件不可交互。
- 搜索匹配 Skill 名和描述；筛选支持全部、已启用、未启用。
- “已启用”表示至少有一个 Claude、Gemini、OpenCode、Hermes 软连接存在；Codex、Cursor 不参与筛选计数。
- 导入冲突使用独立对比视图，不在主列表内展开复杂 diff。
- 卸载必须二次确认，并明确说明备份位置和保留数量。

## 10. 测试策略

### Rust 单元测试

- Skill 名和路径校验。
- 有效 Skill 识别与 frontmatter 描述解析。
- 目录内容哈希与同内容判断。
- 应用默认路径和自定义路径解析。
- 软连接启用、禁用、未知目标保护和断链处理。
- 备份保留 5 份、恢复元数据和冲突保护。
- 配置原子写入与损坏恢复。

### Rust 集成测试

使用隔离临时 HOME 覆盖完整文件系统场景：

- 首次启动时不存在任何目录。
- 从四类应用目录导入。
- 同名同内容自动归一化。
- 同名不同内容暂停并分别裁决。
- 导入复制成功但建链失败时保留可恢复副本。
- 卸载备份失败时零删除。
- 恢复后按元数据重建链接。

### React 测试

- 三栏布局的选择联动。
- 搜索、筛选和空态。
- 即时开关的 loading、成功和失败回退。
- Codex、Cursor 固定状态。
- 导入结果和冲突裁决流程。
- 浅色、深色语义令牌与最小窗口布局。

### macOS 验收

- 默认与最小窗口尺寸可用，无水平内容丢失。
- 系统主题切换后界面正确更新。
- 关闭窗口、Dock 重开和 `⌘Q` 行为符合设计。
- Finder 与终端中观察到的软连接和应用内状态一致。

## 11. 验收标准

- 应用首次打开不访问 CC Switch 数据库或配置。
- `~/.agents/skills/` 是唯一 Skill 内容源，不产生第二份受管副本。
- Claude、Gemini、OpenCode、Hermes 可按 Skill 独立切换，且磁盘状态即时生效。
- Codex、Cursor 始终显示自动可见，不提供单独切换。
- 本地导入只扫描四个已知应用目录。
- 同名不同内容永不自动覆盖。
- 卸载前必须产生可验证备份，每个 Skill 保留最近 5 份。
- 普通目录、未知软连接和 SSOT 外部路径不会被误删。
- 主界面使用已批准的三栏 A 布局，并跟随系统主题。

## 12. 实施拆分边界

该设计可以作为一个实施计划，但实施应按以下独立边界分阶段：

1. 应用骨架、配置和只读扫描。
2. 三栏主界面与系统主题。
3. 应用路径和软连接管理。
4. 本地导入与冲突裁决。
5. 卸载、备份与恢复。
6. macOS 生命周期和整体验收。

每个阶段完成后均可独立验证，不依赖 CC Switch 运行。
