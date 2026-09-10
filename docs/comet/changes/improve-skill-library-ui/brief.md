# Outcome

改进 Skill Switch 应用的 Skill 库与详情页交互体验：优化卡片视图排版、详情页显示最近修改时间、新增 zcode 应用支持、新增"用其他软件打开"的交互入口。

# Scope

- 卡片视图（skill-grid / skill-card）排版优化，解决不整齐、不好看的问题。
- Skill 详情页（SkillInspector）展示最近修改时间（modifiedAtMs）。
- 新增应用 zcode，作为 native SSOT 类型（直接读取 ~/.agents/skills），与 Codex/Cursor 同类。
- 新增"打开方式"交互：点击箭头下拉出可打开该文件/目录的软件列表（参考用户第二张截图）。
- 品牌统一使用第一个 Switch Loop logo 方向：替换 Sidebar 品牌标记、沉淀可复用 SVG 标记组件，并同步替换 macOS Dock / Finder 应用包图标（`src-tauri/icons`）。

# Non-goals

- 不改动已删除的"已启用/未启用"筛选逻辑（上一轮已完成）。
- 不修改软链接类应用（Claude/Gemini/OpenCode/Hermes）的路径与软链接机制。
- 不改变备份/导入流程。
- 不替换第三方应用图标（Claude、Cursor 等 AppIcon）。

# Acceptance examples

- 卡片视图在多行多列时视觉整齐，名称与图标对齐，无参差。
- 详情页可见"最近修改时间"字段，格式清晰。
- zcode 出现在应用列表、Sidebar、详情页可见性列表、卡片图标中，路径为 ~/.agents/skills，状态为"自动可见"，不可逐项启停。
- 点击某处箭头后弹出"打开方式"下拉，可选用指定软件打开对应文件/目录。
- Sidebar 品牌标记显示 Switch Loop 图形，浅色/深色主题下均清晰，缩小后仍保持可识别；第三方应用图标语义不变。
- Dock / Finder 显示的应用包图标为 Switch Loop（非旧版 SS 字母图标）。

# Constraints and invariants

- zcode 必须走 native SSOT 分支（is_native_ssot 返回 true），路径固定为 ssot_dir，set_visibility 拒绝修改。
- 保持 AppKind 枚举、ALL/MANAGED 常量、APP_LABELS、AppIcon 的完整性。
- Tauri capability 当前为 core:default，打开外部软件需确认权限方案。

# Decisions

- zcode 归类为 native SSOT，路径 = ~/.agents/skills（用户明确："它也支持读取 .agents/skill 目录"）。
- 第 4 需求交互：在列表每行末尾（及卡片视图）放箭头按钮，点击弹出"打开方式"下拉，打开该 Skill 目录。支持的软件：访达 (Finder)、VS Code、Cursor。
- 卡片视图优化方向：采用等高自适应卡片（去掉 aspect-ratio:1 强制正方形，名称两行截断，图标贴底对齐）——用户未明确反对推荐项，按最稳妥默认推进。
- 详情页修改时间格式：绝对时间（YYYY-MM-DD HH:mm）——用户未明确反对推荐项，按最稳妥默认推进。
- Logo 方向采用第一个 Switch Loop；应用内品牌入口与 macOS Dock/Finder 应用包图标一并替换（用户反馈任务栏仍为旧图标后明确要求）；不替换第三方应用图标。

# Open questions

（无）

# Verification expectations

- pnpm typecheck 通过
- pnpm test 通过（含新增 zcode 相关 fixture）
- cargo test 通过（含 zcode 路径与 native 分支测试）
- cargo clippy 无警告
