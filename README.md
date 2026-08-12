# Skill Switch

独立的 macOS Agent Skills 管理应用。使用 Tauri 2、React、TypeScript 和 Rust 构建。

## 数据模型

`~/.agents/skills/` 是唯一受管 Skill 内容源。Claude、Gemini、OpenCode、Hermes 的 Skill 目录只保存经过冲突检查后创建的逐 Skill 软连接；Codex 和 Cursor 直接读取统一目录。

Skill Switch 不读取、不迁移、不依赖 CC Switch 的数据库、配置、进程或代码。

## 默认目录

| 应用 | 目录 |
|---|---|
| 统一数据源 | `~/.agents/skills/` |
| Claude | `~/.claude/skills/` |
| Gemini | `~/.gemini/skills/` |
| OpenCode | `~/.config/opencode/skills/` |
| Hermes | `$HERMES_HOME/skills/` 或 `~/.hermes/skills/` |
| 配置 | `~/.skill-switch/config.json` |
| 备份 | `~/.skill-switch/backups/` |

四个应用目录可在设置页改为绝对路径。Codex 和 Cursor 路径固定。

## 安全行为

- 不覆盖普通目录、普通文件或未知软连接。
- 删除软连接前校验其目标确实是对应 SSOT Skill。
- 导入先复制到临时目录并校验内容哈希，再提交到统一目录。
- 同名不同内容必须人工选择规范版本。
- 导入、替换和卸载均创建可恢复备份；每个 Skill 保留最近 5 份。
- Skill 内含外部软连接时拒绝复制和备份。

## 开发

需要 Node.js 20 或更新版本、pnpm、稳定版 Rust 和 macOS Tauri 构建依赖。

```bash
pnpm install
pnpm tauri dev
```

## 验证

```bash
pnpm typecheck
pnpm test
pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
pnpm tauri build --debug
```

若当前终端没有控制 Finder 的自动化权限，DMG 美化脚本会被 macOS 拦截；使用 `CI=true pnpm tauri build --debug` 跳过 Finder 美化，应用内容与功能不变。

可通过 `SKILL_SWITCH_HOME=/path/to/fixture` 将所有文件系统操作隔离到测试 HOME。应用不会读取该目录之外的 Skill Switch 数据。
