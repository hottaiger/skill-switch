use crate::error::CommandError;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AppKind {
    Claude,
    Gemini,
    OpenCode,
    Hermes,
    Codex,
    Cursor,
    Zcode,
}

/// 来自 obra/superpowers 仓库 skills 目录的内置清单。
/// 命中这些名字的 Skill 自动归为 "superpowers" 分类，无需用户标记。
pub const SUPERPOWERS_SKILLS: [&str; 14] = [
    "brainstorming",
    "dispatching-parallel-agents",
    "executing-plans",
    "finishing-a-development-branch",
    "receiving-code-review",
    "requesting-code-review",
    "subagent-driven-development",
    "systematic-debugging",
    "test-driven-development",
    "using-git-worktrees",
    "using-superpowers",
    "verification-before-completion",
    "writing-plans",
    "writing-skills",
];

/// 来自 Fission-AI/OpenSpec 仓库 skills 目录的内置清单。
/// 命中这些名字的 Skill 自动归为 "openspec" 分类。
pub const OPENSPEC_SKILLS: [&str; 12] = [
    "openspec-apply-change",
    "openspec-archive-change",
    "openspec-bulk-archive-change",
    "openspec-continue-change",
    "openspec-explore",
    "openspec-ff-change",
    "openspec-new-change",
    "openspec-onboard",
    "openspec-propose",
    "openspec-sync-specs",
    "openspec-update-change",
    "openspec-verify-change",
];

pub const SUPERPOWERS_CATEGORY: &str = "superpowers";
pub const OPENSPEC_CATEGORY: &str = "openspec";
pub const UNCATEGORIZED: &str = "未分类";

/// 计算单个 Skill 的分类：用户标记优先，其次内置 superpowers / openspec 规则，否则未分类。
pub fn resolve_category(skill_name: &str, user_categories: &BTreeMap<String, String>) -> String {
    if let Some(custom) = user_categories.get(skill_name) {
        if !custom.trim().is_empty() {
            return custom.clone();
        }
    }
    if SUPERPOWERS_SKILLS.contains(&skill_name) {
        return SUPERPOWERS_CATEGORY.into();
    }
    if OPENSPEC_SKILLS.contains(&skill_name) {
        return OPENSPEC_CATEGORY.into();
    }
    UNCATEGORIZED.into()
}

impl AppKind {
    pub const MANAGED: [Self; 4] = [Self::Claude, Self::Gemini, Self::OpenCode, Self::Hermes];
    pub const ALL: [Self; 7] = [
        Self::Claude,
        Self::Gemini,
        Self::OpenCode,
        Self::Hermes,
        Self::Codex,
        Self::Cursor,
        Self::Zcode,
    ];

    pub fn is_native_ssot(self) -> bool {
        matches!(self, Self::Codex | Self::Cursor | Self::Zcode)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppPathOverrides {
    pub claude: Option<String>,
    pub gemini: Option<String>,
    pub open_code: Option<String>,
    pub hermes: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSupport {
    #[serde(default = "default_true")]
    pub claude: bool,
    #[serde(default = "default_true")]
    pub gemini: bool,
    #[serde(default = "default_true")]
    pub open_code: bool,
    #[serde(default = "default_true")]
    pub hermes: bool,
    #[serde(default = "default_true")]
    pub codex: bool,
    #[serde(default = "default_true")]
    pub cursor: bool,
    #[serde(default = "default_true")]
    pub zcode: bool,
}

impl AppSupport {
    pub fn is_enabled(&self, app: AppKind) -> bool {
        match app {
            AppKind::Claude => self.claude,
            AppKind::Gemini => self.gemini,
            AppKind::OpenCode => self.open_code,
            AppKind::Hermes => self.hermes,
            AppKind::Codex => self.codex,
            AppKind::Cursor => self.cursor,
            AppKind::Zcode => self.zcode,
        }
    }

    pub fn set_enabled(&mut self, app: AppKind, enabled: bool) {
        match app {
            AppKind::Claude => self.claude = enabled,
            AppKind::Gemini => self.gemini = enabled,
            AppKind::OpenCode => self.open_code = enabled,
            AppKind::Hermes => self.hermes = enabled,
            AppKind::Codex => self.codex = enabled,
            AppKind::Cursor => self.cursor = enabled,
            AppKind::Zcode => self.zcode = enabled,
        }
    }
}

impl Default for AppSupport {
    fn default() -> Self {
        Self {
            claude: true,
            gemini: true,
            open_code: true,
            hermes: true,
            codex: true,
            cursor: true,
            zcode: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub schema_version: u32,
    pub app_paths: AppPathOverrides,
    #[serde(default)]
    pub app_support: AppSupport,
    pub last_section: String,
    #[serde(default = "default_library_view")]
    pub library_view: String,
    #[serde(default)]
    pub skill_categories: BTreeMap<String, String>,
}

fn default_library_view() -> String {
    "list".into()
}

fn default_true() -> bool {
    true
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            app_paths: AppPathOverrides::default(),
            app_support: AppSupport::default(),
            last_section: "library".into(),
            library_view: default_library_view(),
            skill_categories: BTreeMap::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VisibilityMode {
    Linked,
    Disabled,
    Auto,
    Conflict,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisibilityState {
    pub app: AppKind,
    pub enabled: bool,
    pub mode: VisibilityMode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillRecord {
    pub name: String,
    pub description: Option<String>,
    pub path: String,
    pub modified_at_ms: u64,
    pub size_bytes: u64,
    pub visibility: Vec<VisibilityState>,
    pub category: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSnapshot {
    pub ssot_path: String,
    pub scanned_at_ms: u64,
    pub skills: Vec<SkillRecord>,
    pub warnings: Vec<CommandError>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsLoad {
    pub settings: Settings,
    pub warning: Option<CommandError>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsSnapshot {
    pub settings: Settings,
    pub paths: BTreeMap<AppKind, String>,
    pub warning: Option<CommandError>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BackupOperation {
    Import,
    Replace,
    Uninstall,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupMetadata {
    pub id: String,
    pub skill_name: String,
    pub created_at_ms: u64,
    pub operation: BackupOperation,
    pub original_path: String,
    pub visible_apps: Vec<AppKind>,
    pub content_hash: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupRecord {
    pub id: String,
    pub skill_name: String,
    pub created_at_ms: u64,
    pub operation: BackupOperation,
    pub path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ImportStatus {
    Ready,
    Identical,
    Conflict,
    Invalid,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportCandidate {
    pub app: AppKind,
    pub name: String,
    pub source_path: String,
    pub source_modified_at_ms: u64,
    pub status: ImportStatus,
    pub source_hash: Option<String>,
    pub ssot_hash: Option<String>,
    pub differences: Vec<String>,
    pub error: Option<CommandError>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ImportDecision {
    Normalize,
    KeepSsot,
    UseSource,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportRequest {
    pub app: AppKind,
    pub name: String,
    pub decision: ImportDecision,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ImportOutcome {
    Imported,
    Normalized,
    KeptSsot,
    ReplacedSsot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub app: AppKind,
    pub name: String,
    pub outcome: ImportOutcome,
    pub backup: BackupRecord,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportExecution {
    pub request: ImportRequest,
    pub result: Option<ImportResult>,
    pub error: Option<CommandError>,
}
