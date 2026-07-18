use crate::backup_service;
use crate::config_store::{load_settings, save_settings};
use crate::error::{CommandError, ErrorCode};
use crate::import_service;
use crate::link_manager;
use crate::models::{
    AppKind, BackupRecord, ImportCandidate, ImportExecution, ImportRequest, ImportResult,
    ScanSnapshot, Settings, SettingsSnapshot, VisibilityState,
};
use crate::paths::{app_root, current_home};
use crate::skill_fs;
use std::collections::BTreeMap;
use std::path::Path;

fn settings_snapshot(
    home: &Path,
    settings: Settings,
    warning: Option<CommandError>,
) -> SettingsSnapshot {
    let paths = AppKind::ALL
        .into_iter()
        .map(|app| {
            (
                app,
                app_root(home, app, &settings)
                    .to_string_lossy()
                    .into_owned(),
            )
        })
        .collect::<BTreeMap<_, _>>();
    SettingsSnapshot {
        settings,
        paths,
        warning,
    }
}

fn loaded_settings(home: &Path) -> Result<(Settings, Option<CommandError>), CommandError> {
    let loaded = load_settings(home)?;
    Ok((loaded.settings, loaded.warning))
}

#[tauri::command]
pub fn scan_skills() -> Result<ScanSnapshot, CommandError> {
    let home = current_home()?;
    let (settings, warning) = loaded_settings(&home)?;
    let mut snapshot = skill_fs::scan_skills(&home, &settings)?;
    link_manager::populate_visibility(&home, &settings, &mut snapshot);
    if let Some(warning) = warning {
        snapshot.warnings.push(warning);
    }
    Ok(snapshot)
}

#[tauri::command]
pub fn scan_import_candidates() -> Result<Vec<ImportCandidate>, CommandError> {
    let home = current_home()?;
    let (settings, _) = loaded_settings(&home)?;
    import_service::scan_import_candidates(&home, &settings)
}

#[tauri::command]
pub fn set_skill_visibility(
    skill_name: String,
    app: AppKind,
    enabled: bool,
) -> Result<VisibilityState, CommandError> {
    let home = current_home()?;
    let (settings, _) = loaded_settings(&home)?;
    link_manager::set_visibility(&home, &settings, &skill_name, app, enabled)
}

#[tauri::command]
pub fn import_skills(requests: Vec<ImportRequest>) -> Result<Vec<ImportExecution>, CommandError> {
    let home = current_home()?;
    let (settings, _) = loaded_settings(&home)?;
    Ok(requests
        .into_iter()
        .map(
            |request| match import_service::import_candidate(&home, &settings, request.clone()) {
                Ok(result) => ImportExecution {
                    request,
                    result: Some(result),
                    error: None,
                },
                Err(error) => ImportExecution {
                    request,
                    result: None,
                    error: Some(error),
                },
            },
        )
        .collect())
}

#[tauri::command]
pub fn resolve_import_conflict(request: ImportRequest) -> Result<ImportResult, CommandError> {
    let home = current_home()?;
    let (settings, _) = loaded_settings(&home)?;
    import_service::import_candidate(&home, &settings, request)
}

#[tauri::command]
pub fn uninstall_skill(skill_name: String) -> Result<BackupRecord, CommandError> {
    let home = current_home()?;
    let (settings, _) = loaded_settings(&home)?;
    backup_service::uninstall_skill(&home, &settings, &skill_name)
}

#[tauri::command]
pub fn list_backups() -> Result<Vec<BackupRecord>, CommandError> {
    backup_service::list_backups(&current_home()?)
}

#[tauri::command]
pub fn restore_backup(backup_id: String) -> Result<ScanSnapshot, CommandError> {
    let home = current_home()?;
    let (settings, _) = loaded_settings(&home)?;
    backup_service::restore_backup(&home, &settings, &backup_id)
}

#[tauri::command]
pub fn get_settings() -> Result<SettingsSnapshot, CommandError> {
    let home = current_home()?;
    let (settings, warning) = loaded_settings(&home)?;
    Ok(settings_snapshot(&home, settings, warning))
}

#[tauri::command]
pub fn update_app_path(
    app: AppKind,
    path: Option<String>,
) -> Result<SettingsSnapshot, CommandError> {
    if app.is_native_ssot() {
        return Err(CommandError::new(
            ErrorCode::InvalidPath,
            "Codex 和 Cursor 路径固定为统一目录",
        ));
    }
    let home = current_home()?;
    let (mut settings, _) = loaded_settings(&home)?;
    let normalized = path
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if normalized
        .as_ref()
        .is_some_and(|value| !Path::new(value).is_absolute())
    {
        return Err(CommandError::new(
            ErrorCode::InvalidPath,
            "自定义 Skill 目录必须是绝对路径",
        ));
    }
    match app {
        AppKind::Claude => settings.app_paths.claude = normalized,
        AppKind::Gemini => settings.app_paths.gemini = normalized,
        AppKind::OpenCode => settings.app_paths.open_code = normalized,
        AppKind::Hermes => settings.app_paths.hermes = normalized,
        AppKind::Codex | AppKind::Cursor => unreachable!(),
    }
    save_settings(&home, &settings)?;
    Ok(settings_snapshot(&home, settings, None))
}

#[tauri::command]
pub fn update_ui_preferences(
    last_section: String,
    skill_filter: String,
) -> Result<SettingsSnapshot, CommandError> {
    let allowed_sections = ["library", "import", "backups", "settings"];
    let allowed_filters = ["all", "enabled", "disabled"];
    if !allowed_sections.contains(&last_section.as_str())
        || !allowed_filters.contains(&skill_filter.as_str())
    {
        return Err(CommandError::new(ErrorCode::InvalidPath, "界面偏好值无效"));
    }
    let home = current_home()?;
    let (mut settings, _) = loaded_settings(&home)?;
    settings.last_section = last_section;
    settings.skill_filter = skill_filter;
    save_settings(&home, &settings)?;
    Ok(settings_snapshot(&home, settings, None))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_snapshot_exposes_fixed_native_paths() {
        let home = Path::new("/Users/example");
        let snapshot = settings_snapshot(home, Settings::default(), None);
        assert_eq!(
            snapshot.paths[&AppKind::Codex],
            "/Users/example/.agents/skills"
        );
        assert_eq!(
            snapshot.paths[&AppKind::Cursor],
            "/Users/example/.agents/skills"
        );
        let json = serde_json::to_value(snapshot).unwrap();
        assert_eq!(json["paths"]["codex"], "/Users/example/.agents/skills");
        assert_eq!(
            json["settings"]["appPaths"]["openCode"],
            serde_json::Value::Null
        );
    }

    #[test]
    fn batch_import_result_shape_serializes_per_item_error() {
        let execution = ImportExecution {
            request: ImportRequest {
                app: AppKind::Claude,
                name: "alpha".into(),
                decision: crate::models::ImportDecision::Normalize,
            },
            result: None,
            error: Some(CommandError::new(ErrorCode::PathConflict, "occupied")),
        };
        let value = serde_json::to_value(execution).unwrap();
        assert_eq!(value["error"]["code"], "pathConflict");
        assert_eq!(value["request"]["name"], "alpha");
    }
}
