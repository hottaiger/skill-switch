# Skill Switch

在 macOS 上一处管理多款 Agent 的 Skills：统一存放、按应用开关、安全导入，并可随时回滚。

支持 Claude、Gemini、OpenCode、Hermes、Codex、Cursor、Zcode。

## 安装

仅支持 **Apple Silicon（arm64）**。从 [最新 Release](https://github.com/hottaiger/skill-switch/releases/latest) 下载 `.dmg` 或 `.app` zip。

本版本**未做 Apple 代码签名**。若提示无法验证开发者：

1. 在 Finder 中右键应用 →「打开」→ 再次「打开」
2. 或到「系统设置 → 隐私与安全性」中允许打开

## 功能亮点

- **一处存放，多处使用**：Skill 内容统一在 `~/.agents/skills/`；Claude / Gemini / OpenCode / Hermes 通过受管软链接接入，Codex / Cursor / Zcode 直接读统一目录。
- **按应用启用**：在技能详情里为每个 Skill 开关支持的应用，侧边栏可按应用筛选。
- **本地导入与冲突处理**：扫描已知应用目录中的 Skill，归一到统一库；同名不同内容时由你选择保留哪一版，并自动备份。
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
| 技能库 | 浏览、搜索、分类；查看详情并按应用启用 / 卸载 |
| 本地导入 | 扫描并导入分散在各应用目录中的 Skill |
| 备份 | 查看历史备份并恢复 |
| 设置 | 开关支持的应用、调整可配置目录、管理自定义分类 |

## 工作原理

`~/.agents/skills/` 是唯一受管内容源。Claude、Gemini、OpenCode、Hermes 的 Skill 目录只保存经冲突检查后创建的逐 Skill 软链接；Codex、Cursor、Zcode 直接读取统一目录。Claude / Gemini / OpenCode / Hermes 目录可在设置中改为绝对路径；Codex / Cursor / Zcode 路径固定。

Skill Switch **不**读取、迁移或依赖 CC Switch 的数据库、配置、进程或代码。

### 默认路径

| 用途 | 路径 |
|---|---|
| 统一数据源 | `~/.agents/skills/` |
| Claude | `~/.claude/skills/` |
| Gemini | `~/.gemini/skills/` |
| OpenCode | `~/.config/opencode/skills/` |
| Hermes | `$HERMES_HOME/skills/` 或 `~/.hermes/skills/` |
| 配置 | `~/.skill-switch/config.json` |
| 备份 | `~/.skill-switch/backups/` |

### 安全要点

- 不覆盖普通目录、普通文件或未知软链接
- 删除软链接前校验目标确实对应统一库中的 Skill
- 导入先复制到临时目录并校验内容哈希，再提交
- 同名不同内容必须人工选择规范版本
- 导入、替换和卸载均创建可恢复备份
- Skill 内含外部软链接时拒绝复制和备份

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
