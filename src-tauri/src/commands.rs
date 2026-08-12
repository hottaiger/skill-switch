use crate::backup_service;
use crate::config_store::{load_settings, save_settings};
use crate::error::{CommandError, ErrorCode};
use crate::import_service;
use crate::link_manager;
use crate::models::{
    AppKind, BackupRecord, ImportCandidate, ImportExecution, ImportRequest, ImportResult,
    ScanSnapshot, Settings, SettingsSnapshot, VisibilityState, BUILT_IN_CATEGORIES,
};
use crate::paths::{app_root, current_home};
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

fn normalized_category_name(name: &str) -> Result<String, CommandError> {
    let normalized = name.trim();
    if normalized.is_empty() {
        return Err(CommandError::new(
            ErrorCode::InvalidPath,
            "分类名称不能为空",
        ));
    }
    if BUILT_IN_CATEGORIES.contains(&normalized) {
        return Err(CommandError::new(
            ErrorCode::InvalidPath,
            "内置分类不能作为自定义分类",
        ));
    }
    Ok(normalized.into())
}

fn normalize_custom_categories(categories: &mut Vec<String>) {
    let mut normalized = Vec::new();
    for category in std::mem::take(categories) {
        let category = category.trim();
        if !category.is_empty()
            && !BUILT_IN_CATEGORIES.contains(&category)
            && !normalized.iter().any(|existing| existing == category)
        {
            normalized.push(category.into());
        }
    }
    *categories = normalized;
}

fn scan_snapshot(home: &Path, settings: &Settings) -> Result<ScanSnapshot, CommandError> {
    let mut snapshot = crate::skill_fs::scan_skills(home, settings)?;
    link_manager::populate_visibility(home, settings, &mut snapshot);
    Ok(snapshot)
}

fn set_skill_category_at(
    home: &Path,
    skill_name: String,
    category: String,
) -> Result<ScanSnapshot, CommandError> {
    crate::skill_fs::validate_skill_name(&skill_name)?;
    let trimmed = category.trim();
    let (mut settings, _) = loaded_settings(home)?;
    if trimmed.is_empty() {
        settings.skill_categories.remove(&skill_name);
    } else {
        settings
            .skill_categories
            .insert(skill_name, trimmed.to_string());
    }
    save_settings(home, &settings)?;
    scan_snapshot(home, &settings)
}

fn create_custom_category_at(home: &Path, name: String) -> Result<SettingsSnapshot, CommandError> {
    let name = normalized_category_name(&name)?;
    let (mut settings, _) = loaded_settings(home)?;
    normalize_custom_categories(&mut settings.custom_categories);
    if !settings.custom_categories.contains(&name) {
        settings.custom_categories.push(name);
    }
    save_settings(home, &settings)?;
    Ok(settings_snapshot(home, settings, None))
}

fn rename_custom_category_at(
    home: &Path,
    previous_name: String,
    next_name: String,
) -> Result<ScanSnapshot, CommandError> {
    let previous_name = previous_name.trim();
    let next_name = normalized_category_name(&next_name)?;
    let (mut settings, _) = loaded_settings(home)?;
    normalize_custom_categories(&mut settings.custom_categories);
    if !settings
        .custom_categories
        .iter()
        .any(|name| name == previous_name)
    {
        return Err(CommandError::new(
            ErrorCode::InvalidPath,
            "自定义分类不存在",
        ));
    }
    for category in &mut settings.custom_categories {
        if category == previous_name {
            *category = next_name.clone();
        }
    }
    normalize_custom_categories(&mut settings.custom_categories);
    for category in settings.skill_categories.values_mut() {
        if category == previous_name {
            *category = next_name.clone();
        }
    }
    save_settings(home, &settings)?;
    scan_snapshot(home, &settings)
}

fn delete_custom_category_at(home: &Path, name: String) -> Result<ScanSnapshot, CommandError> {
    let name = name.trim();
    let (mut settings, _) = loaded_settings(home)?;
    normalize_custom_categories(&mut settings.custom_categories);
    let original_count = settings.custom_categories.len();
    settings
        .custom_categories
        .retain(|category| category != name);
    if settings.custom_categories.len() == original_count {
        return Err(CommandError::new(
            ErrorCode::InvalidPath,
            "自定义分类不存在",
        ));
    }
    settings
        .skill_categories
        .retain(|_, category| category != name);
    save_settings(home, &settings)?;
    scan_snapshot(home, &settings)
}

#[tauri::command]
pub fn scan_skills() -> Result<ScanSnapshot, CommandError> {
    let home = current_home()?;
    let (settings, warning) = loaded_settings(&home)?;
    let mut snapshot = scan_snapshot(&home, &settings)?;
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
pub fn uninstall_skill(skill_name: String, reason: String) -> Result<BackupRecord, CommandError> {
    let home = current_home()?;
    let (settings, _) = loaded_settings(&home)?;
    backup_service::uninstall_skill(&home, &settings, &skill_name, &reason)
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
pub fn delete_backup(backup_id: String) -> Result<Vec<BackupRecord>, CommandError> {
    let home = current_home()?;
    backup_service::delete_backup(&home, &backup_id)?;
    backup_service::list_backups(&home)
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
            "Codex、Cursor 和 Zcode 路径固定为统一目录",
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
        AppKind::Codex | AppKind::Cursor | AppKind::Zcode => unreachable!(),
    }
    save_settings(&home, &settings)?;
    Ok(settings_snapshot(&home, settings, None))
}

#[tauri::command]
pub fn set_app_support(app: AppKind, enabled: bool) -> Result<SettingsSnapshot, CommandError> {
    let home = current_home()?;
    let (mut settings, _) = loaded_settings(&home)?;
    settings.app_support.set_enabled(app, enabled);
    save_settings(&home, &settings)?;
    Ok(settings_snapshot(&home, settings, None))
}

#[tauri::command]
pub fn update_ui_preferences(
    last_section: String,
    library_view: String,
) -> Result<SettingsSnapshot, CommandError> {
    let allowed_sections = ["library", "import", "backups", "settings"];
    let allowed_views = ["list", "cards"];
    if !allowed_sections.contains(&last_section.as_str())
        || !allowed_views.contains(&library_view.as_str())
    {
        return Err(CommandError::new(ErrorCode::InvalidPath, "界面偏好值无效"));
    }
    let home = current_home()?;
    let (mut settings, _) = loaded_settings(&home)?;
    settings.last_section = last_section;
    settings.library_view = library_view;
    save_settings(&home, &settings)?;
    Ok(settings_snapshot(&home, settings, None))
}

#[tauri::command]
pub fn set_skill_category(
    skill_name: String,
    category: String,
) -> Result<ScanSnapshot, CommandError> {
    let home = current_home()?;
    set_skill_category_at(&home, skill_name, category)
}

#[tauri::command]
pub fn create_custom_category(name: String) -> Result<SettingsSnapshot, CommandError> {
    create_custom_category_at(&current_home()?, name)
}

#[tauri::command]
pub fn rename_custom_category(
    previous_name: String,
    next_name: String,
) -> Result<ScanSnapshot, CommandError> {
    rename_custom_category_at(&current_home()?, previous_name, next_name)
}

#[tauri::command]
pub fn delete_custom_category(name: String) -> Result<ScanSnapshot, CommandError> {
    delete_custom_category_at(&current_home()?, name)
}

fn launch_opener(path: &Path, opener: &str) -> Result<(), CommandError> {
    let app_name = match opener {
        "finder" => "Finder",
        "vscode" => "Visual Studio Code",
        "cursor" => "Cursor",
        _ => {
            return Err(CommandError::new(
                ErrorCode::InvalidPath,
                "不支持的打开方式",
            ));
        }
    };
    let status = std::process::Command::new("open")
        .arg("-a")
        .arg(app_name)
        .arg(path)
        .status()
        .map_err(|error| {
            CommandError::new(ErrorCode::Io, "无法启动外部应用").with_detail(error.to_string())
        })?;
    if !status.success() {
        return Err(CommandError::new(ErrorCode::Io, "打开外部应用失败"));
    }
    Ok(())
}

#[tauri::command]
pub fn open_skill_with(skill_name: String, opener: String) -> Result<(), CommandError> {
    let home = current_home()?;
    crate::skill_fs::validate_skill_name(&skill_name)?;
    let source = crate::paths::ssot_dir(&home).join(&skill_name);
    if !source.is_dir() {
        return Err(CommandError::new(
            ErrorCode::InvalidPath,
            "Skill 目录不存在",
        ));
    }
    launch_opener(&source, &opener)
}

#[tauri::command]
pub fn open_backup_with(backup_id: String, opener: String) -> Result<(), CommandError> {
    let home = current_home()?;
    let content = backup_service::backup_content_path(&home, &backup_id)?;
    launch_opener(&content, &opener)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::UNCATEGORIZED;
    use std::fs;

    fn create_skill(home: &Path, name: &str) {
        let skill_dir = home.join(".agents/skills").join(name);
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(skill_dir.join("SKILL.md"), "---\nname: local-skill\n---\n").unwrap();
    }

    #[test]
    fn custom_category_creation_persists_trimmed_unique_names() {
        let home = tempfile::tempdir().unwrap();

        let snapshot = create_custom_category_at(home.path(), "  瓜子FE  ".into()).unwrap();
        let duplicate = create_custom_category_at(home.path(), "瓜子FE".into()).unwrap();

        assert_eq!(snapshot.settings.custom_categories, vec!["瓜子FE"]);
        assert_eq!(duplicate.settings.custom_categories, vec!["瓜子FE"]);
        assert_eq!(
            load_settings(home.path())
                .unwrap()
                .settings
                .custom_categories,
            vec!["瓜子FE"]
        );
    }

    #[test]
    fn custom_category_creation_rejects_built_in_categories() {
        let home = tempfile::tempdir().unwrap();

        let error = create_custom_category_at(home.path(), "superpowers".into()).unwrap_err();

        assert_eq!(error.code, ErrorCode::InvalidPath);
    }

    #[test]
    fn custom_category_creation_rejects_the_uncategorized_fallback() {
        let home = tempfile::tempdir().unwrap();

        let error = create_custom_category_at(home.path(), UNCATEGORIZED.into()).unwrap_err();

        assert_eq!(error.code, ErrorCode::InvalidPath);
    }

    #[test]
    fn custom_category_rename_updates_manual_skill_mappings() {
        let home = tempfile::tempdir().unwrap();
        create_skill(home.path(), "local-skill");
        create_custom_category_at(home.path(), "瓜子FE".into()).unwrap();
        set_skill_category_at(home.path(), "local-skill".into(), "瓜子FE".into()).unwrap();

        let snapshot =
            rename_custom_category_at(home.path(), " 瓜子FE ".into(), " 新瓜子FE ".into()).unwrap();

        assert_eq!(snapshot.skills[0].category, "新瓜子FE");
        let settings = load_settings(home.path()).unwrap().settings;
        assert_eq!(settings.custom_categories, vec!["新瓜子FE"]);
        assert_eq!(
            settings.skill_categories.get("local-skill"),
            Some(&"新瓜子FE".to_string())
        );
    }

    #[test]
    fn custom_category_deletion_removes_manual_mappings() {
        let home = tempfile::tempdir().unwrap();
        create_skill(home.path(), "local-skill");
        create_skill(home.path(), "implement");
        create_custom_category_at(home.path(), "瓜子FE".into()).unwrap();
        set_skill_category_at(home.path(), "local-skill".into(), "瓜子FE".into()).unwrap();
        set_skill_category_at(home.path(), "implement".into(), "瓜子FE".into()).unwrap();

        let snapshot = delete_custom_category_at(home.path(), "瓜子FE".into()).unwrap();

        assert_eq!(
            snapshot
                .skills
                .iter()
                .find(|skill| skill.name == "local-skill")
                .unwrap()
                .category,
            UNCATEGORIZED
        );
        assert_eq!(
            snapshot
                .skills
                .iter()
                .find(|skill| skill.name == "implement")
                .unwrap()
                .category,
            "Matt Pocock"
        );
        assert!(!load_settings(home.path())
            .unwrap()
            .settings
            .skill_categories
            .contains_key("local-skill"));
    }

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
