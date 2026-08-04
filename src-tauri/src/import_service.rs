use crate::backup_service::{copy_tree, create_backup};
use crate::error::{CommandError, ErrorCode};
use crate::link_manager::derive_visibility;
use crate::models::{
    AppKind, BackupOperation, ImportCandidate, ImportDecision, ImportOutcome, ImportRequest,
    ImportResult, ImportStatus, Settings,
};
use crate::paths::{app_root, ssot_dir};
use crate::skill_fs::{directory_hash, validate_skill_name};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use walkdir::WalkDir;

fn unix_ms(time: SystemTime) -> u64 {
    time.duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

fn source_path(
    home: &Path,
    settings: &Settings,
    app: AppKind,
    name: &str,
) -> Result<PathBuf, CommandError> {
    validate_skill_name(name)?;
    if app.is_native_ssot() {
        return Err(CommandError::new(
            ErrorCode::InvalidPath,
            "Codex 和 Cursor 不参与本地导入",
        ));
    }
    let source = app_root(home, app, settings).join(name);
    let metadata = fs::symlink_metadata(&source)
        .map_err(|error| CommandError::io("导入源不存在", &source, &error))?;
    if !metadata.file_type().is_dir() || metadata.file_type().is_symlink() {
        return Err(
            CommandError::new(ErrorCode::InvalidSkill, "导入源必须是普通 Skill 目录")
                .at_path(&source),
        );
    }
    let skill_md = source.join("SKILL.md");
    let skill_metadata = fs::symlink_metadata(&skill_md)
        .map_err(|error| CommandError::io("导入源缺少 SKILL.md", &skill_md, &error))?;
    if !skill_metadata.file_type().is_file() || skill_metadata.file_type().is_symlink() {
        return Err(
            CommandError::new(ErrorCode::InvalidSkill, "SKILL.md 必须是普通文件")
                .at_path(&skill_md),
        );
    }
    Ok(source)
}

fn file_hashes(root: &Path) -> Result<BTreeMap<String, String>, CommandError> {
    let mut result = BTreeMap::new();
    for entry in WalkDir::new(root).follow_links(false).min_depth(1) {
        let entry = entry.map_err(|error| {
            CommandError::new(ErrorCode::InvalidPath, "遍历导入目录失败")
                .with_detail(error.to_string())
        })?;
        if entry.file_type().is_symlink() {
            return Err(
                CommandError::new(ErrorCode::InvalidPath, "导入目录包含软连接")
                    .at_path(entry.path()),
            );
        }
        if !entry.file_type().is_file() {
            continue;
        }
        let relative = entry.path().strip_prefix(root).map_err(|_| {
            CommandError::new(ErrorCode::InvalidPath, "导入文件路径越界").at_path(entry.path())
        })?;
        let bytes = fs::read(entry.path())
            .map_err(|error| CommandError::io("读取导入文件失败", entry.path(), &error))?;
        result.insert(
            relative.to_string_lossy().into_owned(),
            format!("{:x}", Sha256::digest(bytes)),
        );
    }
    Ok(result)
}

fn differences(source: &Path, ssot: &Path) -> Result<Vec<String>, CommandError> {
    let source_files = file_hashes(source)?;
    let ssot_files = file_hashes(ssot)?;
    let names = source_files
        .keys()
        .chain(ssot_files.keys())
        .cloned()
        .collect::<BTreeSet<_>>();
    Ok(names
        .into_iter()
        .filter_map(
            |name| match (source_files.get(&name), ssot_files.get(&name)) {
                (Some(_), None) => Some(format!("仅导入源：{name}")),
                (None, Some(_)) => Some(format!("仅统一目录：{name}")),
                (Some(left), Some(right)) if left != right => Some(format!("内容不同：{name}")),
                _ => None,
            },
        )
        .collect())
}

fn is_managed_link(source: &Path, ssot: &Path) -> bool {
    let Ok(metadata) = fs::symlink_metadata(source) else {
        return false;
    };
    if !metadata.file_type().is_symlink() {
        return false;
    }
    let Ok(target) = fs::read_link(source) else {
        return false;
    };
    let target = if target.is_absolute() {
        target
    } else {
        source
            .parent()
            .unwrap_or_else(|| Path::new("/"))
            .join(target)
    };
    matches!((target.canonicalize(), ssot.canonicalize()), (Ok(left), Ok(right)) if left == right)
}

fn is_hidden_or_system_entry(name: &str) -> bool {
    name.starts_with('.') || name == "__MACOSX"
}

fn candidate(home: &Path, settings: &Settings, app: AppKind, name: String) -> ImportCandidate {
    let root = app_root(home, app, settings);
    let source = root.join(&name);
    let modified_at_ms = fs::symlink_metadata(&source)
        .and_then(|metadata| metadata.modified())
        .map(unix_ms)
        .unwrap_or_default();
    let invalid = |error: CommandError| ImportCandidate {
        app,
        name: name.clone(),
        source_path: source.to_string_lossy().into_owned(),
        source_modified_at_ms: modified_at_ms,
        status: ImportStatus::Invalid,
        source_hash: None,
        ssot_hash: None,
        differences: Vec::new(),
        error: Some(error),
    };
    let source = match source_path(home, settings, app, &name) {
        Ok(source) => source,
        Err(error) => return invalid(error),
    };
    let source_hash = match directory_hash(&source) {
        Ok(hash) => hash,
        Err(error) => return invalid(error),
    };
    let destination = ssot_dir(home).join(&name);
    if !destination.exists() {
        return ImportCandidate {
            app,
            name,
            source_path: source.to_string_lossy().into_owned(),
            source_modified_at_ms: modified_at_ms,
            status: ImportStatus::Ready,
            source_hash: Some(source_hash),
            ssot_hash: None,
            differences: Vec::new(),
            error: None,
        };
    }
    let destination_hash = match directory_hash(&destination) {
        Ok(hash) => hash,
        Err(error) => return invalid(error),
    };
    let status = if source_hash == destination_hash {
        ImportStatus::Identical
    } else {
        ImportStatus::Conflict
    };
    let diff = if status == ImportStatus::Conflict {
        differences(&source, &destination).unwrap_or_default()
    } else {
        Vec::new()
    };
    ImportCandidate {
        app,
        name,
        source_path: source.to_string_lossy().into_owned(),
        source_modified_at_ms: modified_at_ms,
        status,
        source_hash: Some(source_hash),
        ssot_hash: Some(destination_hash),
        differences: diff,
        error: None,
    }
}

pub fn scan_import_candidates(
    home: &Path,
    settings: &Settings,
) -> Result<Vec<ImportCandidate>, CommandError> {
    let mut candidates = Vec::new();
    for app in AppKind::MANAGED
        .into_iter()
        .filter(|app| settings.app_support.is_enabled(*app))
    {
        let root = app_root(home, app, settings);
        let entries = match fs::read_dir(&root) {
            Ok(entries) => entries,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => return Err(CommandError::io("读取应用 Skill 目录失败", &root, &error)),
        };
        for entry in entries {
            let entry = entry.map_err(|error| {
                CommandError::new(ErrorCode::Io, "读取导入候选失败").with_detail(error.to_string())
            })?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if is_hidden_or_system_entry(&name) {
                continue;
            }
            let destination = ssot_dir(home).join(&name);
            if is_managed_link(&entry.path(), &destination) {
                continue;
            }
            candidates.push(candidate(home, settings, app, name));
        }
    }
    candidates.sort_by(|left, right| {
        left.name
            .to_lowercase()
            .cmp(&right.name.to_lowercase())
            .then_with(|| left.app.cmp(&right.app))
    });
    Ok(candidates)
}

fn replace_source_with_link(
    source: &Path,
    destination: &Path,
    rollback_content: &Path,
) -> Result<(), CommandError> {
    fs::remove_dir_all(source)
        .map_err(|error| CommandError::io("移除原应用 Skill 失败", source, &error))?;
    if let Err(error) = std::os::unix::fs::symlink(destination, source) {
        let rollback = copy_tree(rollback_content, source);
        return Err(
            CommandError::new(ErrorCode::SymlinkFailed, "创建导入软连接失败")
                .at_path(source)
                .with_detail(match rollback {
                    Ok(()) => error.to_string(),
                    Err(rollback_error) => {
                        format!("{error}; 恢复原目录失败: {}", rollback_error.message)
                    }
                }),
        );
    }
    Ok(())
}

pub fn import_candidate(
    home: &Path,
    settings: &Settings,
    request: ImportRequest,
) -> Result<ImportResult, CommandError> {
    if !request.app.is_native_ssot() && !settings.app_support.is_enabled(request.app) {
        return Err(CommandError::new(ErrorCode::InvalidPath, "应用未启用"));
    }
    let current = candidate(home, settings, request.app, request.name.clone());
    if current.status == ImportStatus::Invalid {
        return Err(current
            .error
            .unwrap_or_else(|| CommandError::new(ErrorCode::InvalidSkill, "导入候选无效")));
    }
    let source = source_path(home, settings, request.app, &request.name)?;
    let destination = ssot_dir(home).join(&request.name);
    fs::create_dir_all(ssot_dir(home))
        .map_err(|error| CommandError::io("创建统一 Skill 目录失败", &ssot_dir(home), &error))?;

    match (current.status, request.decision) {
        (ImportStatus::Ready, ImportDecision::Normalize) => {
            let temporary =
                ssot_dir(home).join(format!(".{}.import-{}", request.name, std::process::id()));
            copy_tree(&source, &temporary)?;
            if directory_hash(&source)? != directory_hash(&temporary)? {
                let _ = fs::remove_dir_all(&temporary);
                return Err(CommandError::new(
                    ErrorCode::VerificationFailed,
                    "导入副本校验失败",
                ));
            }
            fs::rename(&temporary, &destination)
                .map_err(|error| CommandError::io("提交导入 Skill 失败", &destination, &error))?;
            let backup = match create_backup(
                home,
                &request.name,
                &source,
                BackupOperation::Import,
                &source,
                vec![request.app],
            ) {
                Ok(backup) => backup,
                Err(error) => {
                    let _ = fs::remove_dir_all(&destination);
                    return Err(error);
                }
            };
            if let Err(error) = replace_source_with_link(
                &source,
                &destination,
                &PathBuf::from(&backup.path).join("content"),
            ) {
                let _ = fs::remove_dir_all(&destination);
                return Err(error);
            }
            Ok(ImportResult {
                app: request.app,
                name: request.name,
                outcome: ImportOutcome::Imported,
                backup,
            })
        }
        (ImportStatus::Identical, ImportDecision::Normalize)
        | (ImportStatus::Conflict, ImportDecision::KeepSsot) => {
            let backup = create_backup(
                home,
                &request.name,
                &source,
                BackupOperation::Import,
                &source,
                vec![request.app],
            )?;
            replace_source_with_link(
                &source,
                &destination,
                &PathBuf::from(&backup.path).join("content"),
            )?;
            Ok(ImportResult {
                app: request.app,
                name: request.name,
                outcome: if current.status == ImportStatus::Identical {
                    ImportOutcome::Normalized
                } else {
                    ImportOutcome::KeptSsot
                },
                backup,
            })
        }
        (ImportStatus::Conflict, ImportDecision::UseSource) => {
            let visible_apps = AppKind::MANAGED
                .into_iter()
                .filter(|app| {
                    derive_visibility(home, settings, &request.name, *app)
                        .map(|state| state.enabled)
                        .unwrap_or(false)
                })
                .collect();
            let backup = create_backup(
                home,
                &request.name,
                &destination,
                BackupOperation::Replace,
                &destination,
                visible_apps,
            )?;
            let temporary =
                ssot_dir(home).join(format!(".{}.replace-{}", request.name, std::process::id()));
            copy_tree(&source, &temporary)?;
            if directory_hash(&source)? != directory_hash(&temporary)? {
                let _ = fs::remove_dir_all(&temporary);
                return Err(CommandError::new(
                    ErrorCode::VerificationFailed,
                    "替换副本校验失败",
                ));
            }
            fs::remove_dir_all(&destination)
                .map_err(|error| CommandError::io("移除旧统一 Skill 失败", &destination, &error))?;
            if let Err(error) = fs::rename(&temporary, &destination) {
                let _ = copy_tree(&PathBuf::from(&backup.path).join("content"), &destination);
                return Err(CommandError::io(
                    "提交替换 Skill 失败",
                    &destination,
                    &error,
                ));
            }
            replace_source_with_link(&source, &destination, &destination)?;
            Ok(ImportResult {
                app: request.app,
                name: request.name,
                outcome: ImportOutcome::ReplacedSsot,
                backup,
            })
        }
        _ => Err(CommandError::new(
            ErrorCode::PathConflict,
            "导入选择与当前候选状态不匹配，请重新扫描",
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_skill(root: &Path, name: &str, value: &str) -> PathBuf {
        let path = root.join(name);
        fs::create_dir_all(&path).unwrap();
        fs::write(path.join("SKILL.md"), value).unwrap();
        path
    }

    #[test]
    fn identical_content_is_normalized_to_ssot_link() {
        let home = tempfile::tempdir().unwrap();
        let settings = Settings::default();
        make_skill(&ssot_dir(home.path()), "alpha", "same");
        let source = make_skill(
            &app_root(home.path(), AppKind::Claude, &settings),
            "alpha",
            "same",
        );
        let candidates = scan_import_candidates(home.path(), &settings).unwrap();
        assert_eq!(candidates[0].status, ImportStatus::Identical);
        let result = import_candidate(
            home.path(),
            &settings,
            ImportRequest {
                app: AppKind::Claude,
                name: "alpha".into(),
                decision: ImportDecision::Normalize,
            },
        )
        .unwrap();
        assert_eq!(result.outcome, ImportOutcome::Normalized);
        assert!(fs::symlink_metadata(source)
            .unwrap()
            .file_type()
            .is_symlink());
    }

    #[test]
    fn conflict_requires_explicit_canonical_choice() {
        let home = tempfile::tempdir().unwrap();
        let settings = Settings::default();
        let ssot = make_skill(&ssot_dir(home.path()), "alpha", "ssot");
        let source = make_skill(
            &app_root(home.path(), AppKind::Gemini, &settings),
            "alpha",
            "source",
        );
        let candidates = scan_import_candidates(home.path(), &settings).unwrap();
        assert_eq!(candidates[0].status, ImportStatus::Conflict);
        assert_eq!(candidates[0].differences, vec!["内容不同：SKILL.md"]);
        let result = import_candidate(
            home.path(),
            &settings,
            ImportRequest {
                app: AppKind::Gemini,
                name: "alpha".into(),
                decision: ImportDecision::UseSource,
            },
        )
        .unwrap();
        assert_eq!(result.outcome, ImportOutcome::ReplacedSsot);
        assert_eq!(fs::read_to_string(ssot.join("SKILL.md")).unwrap(), "source");
        assert!(fs::symlink_metadata(source)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(
            fs::read_to_string(PathBuf::from(result.backup.path).join("content/SKILL.md")).unwrap(),
            "ssot"
        );
    }

    #[test]
    fn replacement_backup_records_existing_visibility() {
        let home = tempfile::tempdir().unwrap();
        let settings = Settings::default();
        make_skill(&ssot_dir(home.path()), "alpha", "ssot");
        crate::link_manager::set_visibility(home.path(), &settings, "alpha", AppKind::Claude, true)
            .unwrap();
        make_skill(
            &app_root(home.path(), AppKind::Gemini, &settings),
            "alpha",
            "source",
        );
        let result = import_candidate(
            home.path(),
            &settings,
            ImportRequest {
                app: AppKind::Gemini,
                name: "alpha".into(),
                decision: ImportDecision::UseSource,
            },
        )
        .unwrap();
        let metadata: serde_json::Value = serde_json::from_slice(
            &fs::read(PathBuf::from(result.backup.path).join("metadata.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(metadata["visibleApps"], serde_json::json!(["claude"]));
    }

    #[test]
    fn new_skill_is_copied_verified_backed_up_and_linked() {
        let home = tempfile::tempdir().unwrap();
        let settings = Settings::default();
        let source = make_skill(
            &app_root(home.path(), AppKind::Hermes, &settings),
            "alpha",
            "new",
        );
        let result = import_candidate(
            home.path(),
            &settings,
            ImportRequest {
                app: AppKind::Hermes,
                name: "alpha".into(),
                decision: ImportDecision::Normalize,
            },
        )
        .unwrap();
        assert_eq!(result.outcome, ImportOutcome::Imported);
        assert_eq!(
            fs::read_to_string(ssot_dir(home.path()).join("alpha/SKILL.md")).unwrap(),
            "new"
        );
        assert!(fs::symlink_metadata(source)
            .unwrap()
            .file_type()
            .is_symlink());
        assert!(PathBuf::from(result.backup.path)
            .join("content/SKILL.md")
            .is_file());
    }

    #[test]
    fn known_directory_scan_rejects_external_symlink_candidates() {
        let home = tempfile::tempdir().unwrap();
        let settings = Settings::default();
        let root = app_root(home.path(), AppKind::OpenCode, &settings);
        fs::create_dir_all(&root).unwrap();
        std::os::unix::fs::symlink("/tmp/external-skill", root.join("external")).unwrap();
        let candidate = scan_import_candidates(home.path(), &settings)
            .unwrap()
            .remove(0);
        assert_eq!(candidate.status, ImportStatus::Invalid);
        assert_eq!(candidate.error.unwrap().code, ErrorCode::InvalidSkill);
    }

    #[test]
    fn known_directory_scan_ignores_hidden_and_macos_metadata_entries() {
        let home = tempfile::tempdir().unwrap();
        let settings = Settings::default();
        let root = app_root(home.path(), AppKind::Claude, &settings);
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join(".DS_Store"), "metadata").unwrap();
        fs::create_dir_all(root.join(".hidden-skill")).unwrap();
        fs::write(root.join(".hidden-skill/SKILL.md"), "hidden").unwrap();
        fs::create_dir_all(root.join("__MACOSX")).unwrap();
        make_skill(&root, "visible-skill", "visible");

        let candidates = scan_import_candidates(home.path(), &settings).unwrap();

        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].name, "visible-skill");
        assert_eq!(candidates[0].status, ImportStatus::Ready);
    }
}
