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
}

impl AppKind {
    pub const MANAGED: [Self; 4] = [Self::Claude, Self::Gemini, Self::OpenCode, Self::Hermes];
    pub const ALL: [Self; 6] = [
        Self::Claude,
        Self::Gemini,
        Self::OpenCode,
        Self::Hermes,
        Self::Codex,
        Self::Cursor,
    ];

    pub fn is_native_ssot(self) -> bool {
        matches!(self, Self::Codex | Self::Cursor)
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
pub struct Settings {
    pub schema_version: u32,
    pub app_paths: AppPathOverrides,
    pub last_section: String,
    pub skill_filter: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            app_paths: AppPathOverrides::default(),
            last_section: "library".into(),
            skill_filter: "all".into(),
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
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupRecord {
    pub id: String,
    pub skill_name: String,
    pub created_at_ms: u64,
    pub operation: BackupOperation,
    pub path: String,
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
