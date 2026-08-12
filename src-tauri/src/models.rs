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

/// 来自 mattpocock/skills 的 skills/engineering 目录。
pub const MATT_POCOCK_ENGINEERING_SKILLS: [&str; 18] = [
    "ask-matt",
    "code-review",
    "codebase-design",
    "diagnosing-bugs",
    "domain-modeling",
    "grill-with-docs",
    "implement",
    "improve-codebase-architecture",
    "prototype",
    "research",
    "resolving-merge-conflicts",
    "setup-matt-pocock-skills",
    "tdd",
    "to-spec",
    "to-tickets",
    "triage",
    "wayfinder",
    "wizard",
];

/// 来自 mattpocock/skills 的 skills/productivity 目录。
pub const MATT_POCOCK_PRODUCTIVITY_SKILLS: [&str; 7] = [
    "grill-me",
    "grilling",
    "handoff",
    "teach",
    "to-questionnaire",
    "wait-what",
    "writing-for-agents",
];

/// 来自 rpamis/comet 的 assets/skills-zh 目录。
pub const COMET_SKILLS: [&str; 11] = [
    "comet",
    "comet-any",
    "comet-archive",
    "comet-build",
    "comet-classic",
    "comet-design",
    "comet-hotfix",
    "comet-native",
    "comet-open",
    "comet-tweak",
    "comet-verify",
];

/// 来自 abhigyanpatwari/GitNexus v1.6.9 的 gitnexus/skills 目录。
pub const GITNEXUS_SKILLS: [&str; 9] = [
    "gitnexus-cli",
    "gitnexus-debugging",
    "gitnexus-exploring",
    "gitnexus-guide",
    "gitnexus-impact-analysis",
    "gitnexus-pdg-query",
    "gitnexus-pr-review",
    "gitnexus-refactoring",
    "gitnexus-taint-analysis",
];

/// 来自 kepano/obsidian-skills 的 skills 目录。
pub const OBSIDIAN_SKILLS: [&str; 5] = [
    "defuddle",
    "json-canvas",
    "obsidian-bases",
    "obsidian-cli",
    "obsidian-markdown",
];

/// 来自 axtonliu/axton-obsidian-visual-skills 仓库。
pub const OBSIDIAN_VISUAL_SKILLS_PACK: [&str; 3] = [
    "excalidraw-diagram",
    "mermaid-visualizer",
    "obsidian-canvas-creator",
];

pub const MATT_POCOCK_CATEGORY: &str = "Matt Pocock";
pub const COMET_CATEGORY: &str = "Comet";
pub const GITNEXUS_CATEGORY: &str = "GitNexus";
pub const OBSIDIAN_CATEGORY: &str = "Obsidian";
pub const OBSIDIAN_VISUAL_SKILLS_PACK_CATEGORY: &str = "Obsidian Visual Skills Pack";
pub const SUPERPOWERS_CATEGORY: &str = "superpowers";
pub const OPENSPEC_CATEGORY: &str = "openspec";
pub const UNCATEGORIZED: &str = "未分类";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CategorySource {
    Auto,
    Manual,
}

/// 计算单个 Skill 的分类：用户标记优先，其次内置来源规则，否则未分类。
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
    if MATT_POCOCK_ENGINEERING_SKILLS.contains(&skill_name)
        || MATT_POCOCK_PRODUCTIVITY_SKILLS.contains(&skill_name)
    {
        return MATT_POCOCK_CATEGORY.into();
    }
    if COMET_SKILLS.contains(&skill_name) {
        return COMET_CATEGORY.into();
    }
    if GITNEXUS_SKILLS.contains(&skill_name) {
        return GITNEXUS_CATEGORY.into();
    }
    if OBSIDIAN_SKILLS.contains(&skill_name) {
        return OBSIDIAN_CATEGORY.into();
    }
    if OBSIDIAN_VISUAL_SKILLS_PACK.contains(&skill_name) {
        return OBSIDIAN_VISUAL_SKILLS_PACK_CATEGORY.into();
    }
    UNCATEGORIZED.into()
}

pub fn resolve_category_source(
    skill_name: &str,
    user_categories: &BTreeMap<String, String>,
) -> CategorySource {
    user_categories
        .get(skill_name)
        .filter(|category| !category.trim().is_empty())
        .map_or(CategorySource::Auto, |_| CategorySource::Manual)
}

#[cfg(test)]
mod category_tests {
    use super::*;

    #[test]
    fn matt_pocock_engineering_skills_use_the_matt_pocock_category() {
        assert_eq!(
            resolve_category("implement", &BTreeMap::new()),
            "Matt Pocock"
        );
    }

    #[test]
    fn matt_pocock_productivity_skills_use_the_matt_pocock_category() {
        assert_eq!(
            resolve_category("handoff", &BTreeMap::new()),
            MATT_POCOCK_CATEGORY
        );
    }

    #[test]
    fn comet_skills_use_the_comet_category() {
        assert_eq!(resolve_category("comet-native", &BTreeMap::new()), "Comet");
    }

    #[test]
    fn gitnexus_skills_use_the_gitnexus_category() {
        assert_eq!(
            resolve_category("gitnexus-pr-review", &BTreeMap::new()),
            "GitNexus"
        );
    }

    #[test]
    fn obsidian_skills_use_the_obsidian_category() {
        assert_eq!(resolve_category("obsidian-markdown", &BTreeMap::new()), "Obsidian");
    }

    #[test]
    fn obsidian_visual_skills_pack_uses_its_own_category() {
        assert_eq!(
            resolve_category("excalidraw-diagram", &BTreeMap::new()),
            OBSIDIAN_VISUAL_SKILLS_PACK_CATEGORY
        );
    }

    #[test]
    fn manual_category_overrides_the_matt_pocock_rule() {
        let categories = BTreeMap::from([("implement".into(), "项目专用".into())]);
        assert_eq!(resolve_category("implement", &categories), "项目专用");
        assert_eq!(
            resolve_category_source("implement", &categories),
            CategorySource::Manual
        );
    }

    #[test]
    fn unrecognized_skills_fall_back_to_uncategorized() {
        assert_eq!(
            resolve_category("my-local-skill", &BTreeMap::new()),
            UNCATEGORIZED
        );
    }
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
    pub category_source: CategorySource,
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
