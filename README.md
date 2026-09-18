# Skill Switch

在 macOS 上一处管理多款 Agent 的 Skills：集中存放在唯一数据源，按应用做可见性管理，安全导入，并可随时回滚。

支持 Claude、Gemini、OpenCode、Hermes、Codex、Cursor、Zcode。

## 安装

仅支持 **Apple Silicon（arm64）**。从 [最新 Release](https://github.com/hottaiger/skill-switch/releases/latest) 下载 `.dmg` 或 `.zip`。

本版本**未做 Apple 代码签名和公证**。用浏览器下载后，macOS 常会误报「已损坏，无法打开」；应用本身没有坏。右键「打开」或「系统设置 → 隐私与安全性」对这条提示通常无效。

1. 打开 `.dmg`，把 **Skill Switch** 拖到 **应用程序**（或解压 `.zip` 后把 `.app` 拖进去）。
2. 打开「终端」，执行一次：

```bash
xattr -cr "/Applications/Skill Switch.app"
```

3. 打开 **访达 → 应用程序**，双击 **Skill Switch**。不要从 DMG 窗口里直接打开。

安装完成后即可当普通应用使用，不必每次再执行命令。若重新从 DMG / zip 拷贝安装，需要再执行一次上面的命令。

## 功能亮点

- **唯一数据源**：Skill 内容只保存在 `~/.agents/skills/`。Claude / Gemini / OpenCode / Hermes 通过受管软连接接入；Codex / Cursor / Zcode 直接读取该目录，详情中显示为「自动可见」，不可逐 Skill 开关。
- **按应用可见性**：对 Claude / Gemini / OpenCode / Hermes，可在详情里为每个 Skill 单独启用或禁用；侧边栏可按应用筛选。设置页还可整体开关「支持的应用」。
- **本地导入与冲突处理**：扫描已启用的受管应用目录中的 Skill，归一到唯一数据源；同名不同内容时由你选择保留哪一版，并自动备份。
- **可恢复备份**：导入、替换、卸载都会留备份；每个 Skill 最多保留最近 5 份，可在备份页恢复。
- **分类与检索**：列表 / 卡片视图、搜索、按分类分组；支持内置与自定义分类。
- **快捷打开**：用访达、VS Code 或 Cursor 打开 Skill 目录。

> **截图（待补充）**  
> `docs/images/skill-library.png` — 技能库  
> `docs/images/import.png` — 本地导入  
> `docs/images/settings.png` — 设置

## 界面一览

| 模块 | 做什么 |
|---|---|
| 技能库 | 浏览、搜索、分类；查看详情；对受管应用切换可见性；卸载 |
| 本地导入 | 扫描受管应用目录并导入到唯一数据源 |
| 备份 | 查看历史备份并恢复 |
| 设置 | 开关支持的应用、修改受管应用目录、管理自定义分类 |

## 工作原理

`~/.agents/skills/` 是**唯一数据源**（界面中的「数据源」）。Claude、Gemini、OpenCode、Hermes 的 Skill 目录只保存经冲突检查后创建的逐 Skill 软连接；Codex、Cursor、Zcode 直接读取唯一数据源，路径固定为「系统管理 / 固定自动可见」。Claude / Gemini / OpenCode / Hermes 目录可在设置中改为绝对路径。

Skill Switch **不**读取、迁移或依赖 CC Switch 的数据库、配置、进程或代码。

### 默认路径

| 用途 | 路径 |
|---|---|
| 唯一数据源 | `~/.agents/skills/` |
| Claude | `~/.claude/skills/` |
| Gemini | `~/.gemini/skills/` |
| OpenCode | `~/.config/opencode/skills/` |
| Hermes | `$HERMES_HOME/skills/` 或 `~/.hermes/skills/` |
| Codex / Cursor / Zcode | `~/.agents/skills/`（与唯一数据源相同，只读） |
| 配置 | `~/.skill-switch/config.json` |
| 备份 | `~/.skill-switch/backups/` |

### 安全要点

- 不覆盖普通目录、普通文件或未知软连接
- 删除软连接前校验目标确实对应唯一数据源中的 Skill
- 导入先复制到临时目录并校验内容哈希，再提交
- 同名不同内容必须人工选择规范版本
- 导入、替换和卸载均创建可恢复备份
- Skill 内含外部软连接时拒绝复制和备份

## 开发

需要 Node.js 20+、pnpm、稳定版 Rust，以及 macOS 上的 Tauri 构建依赖。技术栈：Tauri 2、React、TypeScript、Rust。

```bash
pnpm install
pnpm tauri dev
```

### 验证

```bash
pnpm typecheck
pnpm test
pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
pnpm tauri build --debug
```

若终端没有控制 Finder 的自动化权限，DMG 美化可能被拦截；使用 `CI=true pnpm tauri build --debug` 可跳过 Finder 美化，应用内容不变。

可用 `SKILL_SWITCH_HOME=/path/to/fixture` 将文件系统操作隔离到测试 HOME。
