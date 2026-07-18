use crate::error::{CommandError, ErrorCode};
use crate::link_manager::{derive_visibility, populate_visibility, set_visibility};
use crate::models::{
    AppKind, BackupMetadata, BackupOperation, BackupRecord, ScanSnapshot, Settings,
};
use crate::paths::{backups_dir, ssot_dir};
use crate::skill_fs::{directory_hash, scan_skills, validate_skill_name};
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use walkdir::WalkDir;

static BACKUP_SEQUENCE: AtomicU64 = AtomicU64::new(0);
static LAST_BACKUP_MS: AtomicU64 = AtomicU64::new(0);

fn now_ms() -> u64 {
    let wall_clock: u64 = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX);
    let mut previous = LAST_BACKUP_MS.load(Ordering::Relaxed);
    loop {
        let next = wall_clock.max(previous.saturating_add(1));
        match LAST_BACKUP_MS.compare_exchange_weak(
            previous,
            next,
            Ordering::Relaxed,
            Ordering::Relaxed,
        ) {
            Ok(_) => return next,
            Err(actual) => previous = actual,
        }
    }
}

pub(crate) fn copy_tree(source: &Path, destination: &Path) -> Result<(), CommandError> {
    let metadata = fs::symlink_metadata(source)
        .map_err(|error| CommandError::io("读取备份源失败", source, &error))?;
    if !metadata.file_type().is_dir() || metadata.file_type().is_symlink() {
        return Err(
            CommandError::new(ErrorCode::InvalidPath, "备份源必须是普通目录").at_path(source),
        );
    }
    fs::create_dir_all(destination)
        .map_err(|error| CommandError::io("创建目标目录失败", destination, &error))?;
    for entry in WalkDir::new(source).follow_links(false).min_depth(1) {
        let entry = entry.map_err(|error| {
            CommandError::new(ErrorCode::CopyFailed, "遍历 Skill 失败")
                .with_detail(error.to_string())
        })?;
        if entry.file_type().is_symlink() {
            return Err(
                CommandError::new(ErrorCode::InvalidPath, "Skill 内包含软连接，拒绝复制")
                    .at_path(entry.path()),
            );
        }
        let relative = entry.path().strip_prefix(source).map_err(|_| {
            CommandError::new(ErrorCode::InvalidPath, "复制源路径越界").at_path(entry.path())
        })?;
        let target = destination.join(relative);
        if entry.file_type().is_dir() {
            fs::create_dir_all(&target)
                .map_err(|error| CommandError::io("创建备份子目录失败", &target, &error))?;
        } else if entry.file_type().is_file() {
            fs::copy(entry.path(), &target)
                .map_err(|error| CommandError::io("复制 Skill 文件失败", &target, &error))?;
        }
    }
    Ok(())
}

fn metadata_path(snapshot: &Path) -> PathBuf {
    snapshot.join("metadata.json")
}

fn read_metadata(snapshot: &Path) -> Result<BackupMetadata, CommandError> {
    let path = metadata_path(snapshot);
    let bytes =
        fs::read(&path).map_err(|error| CommandError::io("读取备份元数据失败", &path, &error))?;
    serde_json::from_slice(&bytes).map_err(|error| {
        CommandError::new(ErrorCode::BackupFailed, "备份元数据损坏")
            .at_path(&path)
            .with_detail(error.to_string())
    })
}

fn record(snapshot: &Path, metadata: &BackupMetadata) -> BackupRecord {
    BackupRecord {
        id: metadata.id.clone(),
        skill_name: metadata.skill_name.clone(),
        created_at_ms: metadata.created_at_ms,
        operation: metadata.operation,
        path: snapshot.to_string_lossy().into_owned(),
    }
}

fn safe_snapshot(home: &Path, id: &str) -> Result<PathBuf, CommandError> {
    let parts = Path::new(id).components().collect::<Vec<_>>();
    if parts.len() != 2
        || parts
            .iter()
            .any(|part| !matches!(part, Component::Normal(_)))
    {
        return Err(CommandError::new(ErrorCode::InvalidPath, "备份 ID 无效"));
    }
    Ok(backups_dir(home).join(id))
}

pub fn create_backup(
    home: &Path,
    skill_name: &str,
    source: &Path,
    operation: BackupOperation,
    original_path: &Path,
    visible_apps: Vec<AppKind>,
) -> Result<BackupRecord, CommandError> {
    validate_skill_name(skill_name)?;
    let created_at_ms = now_ms();
    let suffix = BACKUP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let folder = format!("{created_at_ms}-{suffix}");
    let id = format!("{skill_name}/{folder}");
    let skill_root = backups_dir(home).join(skill_name);
    fs::create_dir_all(&skill_root)
        .map_err(|error| CommandError::io("创建备份根目录失败", &skill_root, &error))?;
    let temporary = skill_root.join(format!(".{folder}.tmp"));
    let snapshot = skill_root.join(&folder);
    let content = temporary.join("content");
    copy_tree(source, &content)?;
    let source_hash = directory_hash(source)?;
    let copied_hash = directory_hash(&content)?;
    if source_hash != copied_hash {
        let _ = fs::remove_dir_all(&temporary);
        return Err(
            CommandError::new(ErrorCode::VerificationFailed, "备份内容校验失败")
                .at_path(&temporary),
        );
    }
    let metadata = BackupMetadata {
        id: id.clone(),
        skill_name: skill_name.to_string(),
        created_at_ms,
        operation,
        original_path: original_path.to_string_lossy().into_owned(),
        visible_apps,
        content_hash: source_hash,
    };
    let metadata_file = metadata_path(&temporary);
    let mut file = fs::File::create(&metadata_file)
        .map_err(|error| CommandError::io("创建备份元数据失败", &metadata_file, &error))?;
    let bytes = serde_json::to_vec_pretty(&metadata).map_err(|error| {
        CommandError::new(ErrorCode::BackupFailed, "序列化备份元数据失败")
            .with_detail(error.to_string())
    })?;
    file.write_all(&bytes)
        .map_err(|error| CommandError::io("写入备份元数据失败", &metadata_file, &error))?;
    file.sync_all()
        .map_err(|error| CommandError::io("同步备份元数据失败", &metadata_file, &error))?;
    fs::rename(&temporary, &snapshot)
        .map_err(|error| CommandError::io("提交备份失败", &snapshot, &error))?;
    let created = record(&snapshot, &read_metadata(&snapshot)?);
    prune_backups(home, skill_name)?;
    Ok(created)
}

pub fn list_backups(home: &Path) -> Result<Vec<BackupRecord>, CommandError> {
    let root = backups_dir(home);
    if !root.exists() {
        return Ok(Vec::new());
    }
    let mut records = Vec::new();
    for skill_entry in
        fs::read_dir(&root).map_err(|error| CommandError::io("读取备份目录失败", &root, &error))?
    {
        let skill_entry = skill_entry.map_err(|error| {
            CommandError::new(ErrorCode::Io, "读取备份 Skill 失败").with_detail(error.to_string())
        })?;
        if !skill_entry
            .file_type()
            .map(|kind| kind.is_dir())
            .unwrap_or(false)
        {
            continue;
        }
        for snapshot_entry in fs::read_dir(skill_entry.path())
            .map_err(|error| CommandError::io("读取 Skill 备份失败", &skill_entry.path(), &error))?
        {
            let snapshot_entry = snapshot_entry.map_err(|error| {
                CommandError::new(ErrorCode::Io, "读取备份项失败").with_detail(error.to_string())
            })?;
            if snapshot_entry
                .file_name()
                .to_string_lossy()
                .starts_with('.')
            {
                continue;
            }
            if let Ok(metadata) = read_metadata(&snapshot_entry.path()) {
                records.push(record(&snapshot_entry.path(), &metadata));
            }
        }
    }
    records.sort_by(|left, right| {
        right
            .created_at_ms
            .cmp(&left.created_at_ms)
            .then_with(|| right.id.cmp(&left.id))
    });
    Ok(records)
}

fn prune_backups(home: &Path, skill_name: &str) -> Result<(), CommandError> {
    let mut records = list_backups(home)?
        .into_iter()
        .filter(|record| record.skill_name == skill_name)
        .collect::<Vec<_>>();
    records.sort_by(|left, right| {
        left.created_at_ms
            .cmp(&right.created_at_ms)
            .then_with(|| left.id.cmp(&right.id))
    });
    let remove_count = records.len().saturating_sub(5);
    for record in records.into_iter().take(remove_count) {
        let path = safe_snapshot(home, &record.id)?;
        fs::remove_dir_all(&path)
            .map_err(|error| CommandError::io("清理旧备份失败", &path, &error))?;
    }
    Ok(())
}

pub fn uninstall_skill(
    home: &Path,
    settings: &Settings,
    skill_name: &str,
) -> Result<BackupRecord, CommandError> {
    validate_skill_name(skill_name)?;
    let source = ssot_dir(home).join(skill_name);
    let visible_apps = AppKind::MANAGED
        .into_iter()
        .filter(|app| {
            derive_visibility(home, settings, skill_name, *app)
                .map(|state| state.enabled)
                .unwrap_or(false)
        })
        .collect::<Vec<_>>();
    let backup = create_backup(
        home,
        skill_name,
        &source,
        BackupOperation::Uninstall,
        &source,
        visible_apps.clone(),
    )?;
    for app in visible_apps {
        set_visibility(home, settings, skill_name, app, false)?;
    }
    fs::remove_dir_all(&source)
        .map_err(|error| CommandError::io("删除统一 Skill 失败", &source, &error))?;
    Ok(backup)
}

pub fn restore_backup(
    home: &Path,
    settings: &Settings,
    backup_id: &str,
) -> Result<ScanSnapshot, CommandError> {
    let snapshot = safe_snapshot(home, backup_id)?;
    let metadata = read_metadata(&snapshot)?;
    validate_skill_name(&metadata.skill_name)?;
    let destination = ssot_dir(home).join(&metadata.skill_name);
    if fs::symlink_metadata(&destination).is_ok() {
        return Err(
            CommandError::new(ErrorCode::RestoreConflict, "统一目录中已存在同名 Skill")
                .at_path(&destination),
        );
    }
    fs::create_dir_all(ssot_dir(home))
        .map_err(|error| CommandError::io("创建统一 Skill 目录失败", &ssot_dir(home), &error))?;
    let temporary = ssot_dir(home).join(format!(
        ".{}.restore-{}",
        metadata.skill_name,
        std::process::id()
    ));
    copy_tree(&snapshot.join("content"), &temporary)?;
    if directory_hash(&temporary)? != metadata.content_hash {
        let _ = fs::remove_dir_all(&temporary);
        return Err(
            CommandError::new(ErrorCode::VerificationFailed, "恢复内容校验失败").at_path(&snapshot),
        );
    }
    fs::rename(&temporary, &destination)
        .map_err(|error| CommandError::io("提交恢复内容失败", &destination, &error))?;
    let mut warnings = Vec::new();
    for app in metadata.visible_apps {
        if let Err(error) = set_visibility(home, settings, &metadata.skill_name, app, true) {
            warnings.push(error);
        }
    }
    let mut result = scan_skills(home, settings)?;
    populate_visibility(home, settings, &mut result);
    result.warnings.extend(warnings);
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_skill(home: &Path, name: &str, value: &str) -> PathBuf {
        let path = ssot_dir(home).join(name);
        fs::create_dir_all(&path).unwrap();
        fs::write(path.join("SKILL.md"), value).unwrap();
        path
    }

    #[test]
    fn sixth_verified_backup_removes_only_oldest_snapshot() {
        let home = tempfile::tempdir().unwrap();
        let source = make_skill(home.path(), "alpha", "v1");
        for _ in 0..6 {
            create_backup(
                home.path(),
                "alpha",
                &source,
                BackupOperation::Import,
                &source,
                Vec::new(),
            )
            .unwrap();
        }
        let backups = list_backups(home.path()).unwrap();
        assert_eq!(backups.len(), 5);
        assert!(backups
            .windows(2)
            .all(|pair| pair[0].created_at_ms >= pair[1].created_at_ms));
    }

    #[test]
    fn uninstall_requires_verified_backup_and_restore_keeps_snapshot() {
        let home = tempfile::tempdir().unwrap();
        make_skill(home.path(), "alpha", "v1");
        let settings = Settings::default();
        set_visibility(home.path(), &settings, "alpha", AppKind::Claude, true).unwrap();
        let backup = uninstall_skill(home.path(), &settings, "alpha").unwrap();
        assert!(!ssot_dir(home.path()).join("alpha").exists());
        assert!(list_backups(home.path())
            .unwrap()
            .iter()
            .any(|item| item.id == backup.id));
        let restored = restore_backup(home.path(), &settings, &backup.id).unwrap();
        assert_eq!(restored.skills.len(), 1);
        assert!(
            derive_visibility(home.path(), &settings, "alpha", AppKind::Claude)
                .unwrap()
                .enabled
        );
        assert!(list_backups(home.path())
            .unwrap()
            .iter()
            .any(|item| item.id == backup.id));
    }

    #[test]
    fn backup_rejects_external_symlinks_without_deleting_source() {
        let home = tempfile::tempdir().unwrap();
        let source = make_skill(home.path(), "alpha", "v1");
        std::os::unix::fs::symlink("/tmp/outside", source.join("external")).unwrap();
        let error = create_backup(
            home.path(),
            "alpha",
            &source,
            BackupOperation::Uninstall,
            &source,
            Vec::new(),
        )
        .unwrap_err();
        assert_eq!(error.code, ErrorCode::InvalidPath);
        assert!(source.exists());
    }
}
