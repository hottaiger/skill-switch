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
pub struct AppPaths {
    pub paths: BTreeMap<AppKind, String>,
}
