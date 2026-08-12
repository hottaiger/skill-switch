use crate::error::{CommandError, ErrorCode};
use crate::models::{
    resolve_category, resolve_category_source, ScanSnapshot, Settings, SkillRecord,
};
use crate::paths::ssot_dir;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Component, Path};
use std::time::{SystemTime, UNIX_EPOCH};
use walkdir::WalkDir;

pub fn validate_skill_name(name: &str) -> Result<(), CommandError> {
    if name.is_empty()
        || name == "."
        || name == ".."
        || name.contains('/')
        || name.contains('\\')
        || name.contains('\0')
        || Path::new(name)
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
    {
        return Err(CommandError::new(
            ErrorCode::InvalidSkill,
            "Skill 名称不是安全的单层目录名",
        ));
    }
    Ok(())
}

fn unix_ms(time: SystemTime) -> u64 {
    time.duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

fn parse_description(text: &str) -> Option<String> {
    let mut lines = text.lines();
    if lines.next()?.trim() != "---" {
        return None;
    }
    for line in lines {
        let trimmed = line.trim();
        if trimmed == "---" {
            break;
        }
        if let Some(value) = trimmed.strip_prefix("description:") {
            let value = value
                .trim()
                .trim_matches(|character| character == '\'' || character == '"');
            return (!value.is_empty()).then(|| value.to_string());
        }
    }
    None
}

fn directory_size(path: &Path) -> u64 {
    WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file() && !entry.file_type().is_symlink())
        .filter_map(|entry| entry.metadata().ok().map(|metadata| metadata.len()))
        .sum()
}

pub fn directory_hash(path: &Path) -> Result<String, CommandError> {
    let mut files = WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file() && !entry.file_type().is_symlink())
        .map(|entry| entry.into_path())
        .collect::<Vec<_>>();
    files.sort_by_key(|file| file.strip_prefix(path).unwrap_or(file).to_path_buf());
    let mut digest = Sha256::new();
    for file in files {
        let relative = file.strip_prefix(path).map_err(|_| {
            CommandError::new(ErrorCode::InvalidPath, "文件不在 Skill 目录内").at_path(&file)
        })?;
        digest.update(relative.to_string_lossy().as_bytes());
        digest.update([0]);
        let bytes = fs::read(&file)
            .map_err(|error| CommandError::io("读取 Skill 文件失败", &file, &error))?;
        digest.update(bytes);
        digest.update([0]);
    }
    Ok(format!("{:x}", digest.finalize()))
}

pub fn scan_skills(home: &Path, settings: &Settings) -> Result<ScanSnapshot, CommandError> {
    let root = ssot_dir(home);
    fs::create_dir_all(&root)
        .map_err(|error| CommandError::io("创建统一 Skill 目录失败", &root, &error))?;
    let entries = fs::read_dir(&root)
        .map_err(|error| CommandError::io("读取统一 Skill 目录失败", &root, &error))?;
    let mut skills = Vec::new();
    let mut warnings = Vec::new();
    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                warnings.push(
                    CommandError::new(ErrorCode::Io, "读取 Skill 目录项失败")
                        .with_detail(error.to_string()),
                );
                continue;
            }
        };
        let name = entry.file_name().to_string_lossy().into_owned();
        if let Err(error) = validate_skill_name(&name) {
            warnings.push(error.at_path(&entry.path()));
            continue;
        }
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(error) => {
                warnings.push(CommandError::io(
                    "读取 Skill 类型失败",
                    &entry.path(),
                    &error,
                ));
                continue;
            }
        };
        if !file_type.is_dir() || file_type.is_symlink() {
            continue;
        }
        let path = entry.path();
        let skill_md = path.join("SKILL.md");
        let metadata = match fs::symlink_metadata(&skill_md) {
            Ok(metadata)
                if metadata.file_type().is_file() && !metadata.file_type().is_symlink() =>
            {
                metadata
            }
            _ => continue,
        };
        let description = fs::read_to_string(&skill_md)
            .ok()
            .and_then(|content| parse_description(&content));
        let modified_at_ms = metadata.modified().map(unix_ms).unwrap_or_default();
        skills.push(SkillRecord {
            name: name.clone(),
            description,
            path: path.to_string_lossy().into_owned(),
            modified_at_ms,
            size_bytes: directory_size(&path),
            visibility: Vec::new(),
            category: resolve_category(&name, &settings.skill_categories),
            category_source: resolve_category_source(&name, &settings.skill_categories),
        });
    }
    skills.sort_by_key(|skill| skill.name.to_lowercase());
    Ok(ScanSnapshot {
        ssot_path: root.to_string_lossy().into_owned(),
        scanned_at_ms: unix_ms(SystemTime::now()),
        skills,
        warnings,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_skill(home: &Path, name: &str, frontmatter: &str) -> std::path::PathBuf {
        let path = home.join(".agents/skills").join(name);
        fs::create_dir_all(&path).unwrap();
        fs::write(
            path.join("SKILL.md"),
            format!("---\n{frontmatter}\n---\n# {name}\n"),
        )
        .unwrap();
        path
    }

    #[test]
    fn scan_accepts_only_direct_children_with_regular_skill_md() {
        let home = tempfile::tempdir().unwrap();
        make_skill(home.path(), "valid", "description: works");
        fs::create_dir_all(home.path().join(".agents/skills/invalid")).unwrap();
        fs::write(home.path().join(".agents/skills/plain.txt"), "ignored").unwrap();
        let snapshot = scan_skills(home.path(), &Settings::default()).unwrap();
        assert_eq!(snapshot.skills.len(), 1);
        assert_eq!(snapshot.skills[0].name, "valid");
        assert_eq!(snapshot.skills[0].description.as_deref(), Some("works"));
    }

    #[test]
    fn scan_creates_missing_ssot_and_sorts_names() {
        let home = tempfile::tempdir().unwrap();
        let empty = scan_skills(home.path(), &Settings::default()).unwrap();
        assert!(empty.skills.is_empty());
        make_skill(home.path(), "zeta", "description: z");
        make_skill(home.path(), "Alpha", "description: a");
        let names = scan_skills(home.path(), &Settings::default())
            .unwrap()
            .skills
            .into_iter()
            .map(|skill| skill.name)
            .collect::<Vec<_>>();
        assert_eq!(names, vec!["Alpha", "zeta"]);
    }

    #[test]
    fn hashes_ignore_modification_times_but_include_paths_and_content() {
        let first = tempfile::tempdir().unwrap();
        let second = tempfile::tempdir().unwrap();
        fs::write(first.path().join("SKILL.md"), "same").unwrap();
        fs::write(second.path().join("SKILL.md"), "same").unwrap();
        assert_eq!(
            directory_hash(first.path()).unwrap(),
            directory_hash(second.path()).unwrap()
        );
        fs::write(second.path().join("extra.md"), "same").unwrap();
        assert_ne!(
            directory_hash(first.path()).unwrap(),
            directory_hash(second.path()).unwrap()
        );
    }

    #[test]
    fn rejects_unsafe_skill_names() {
        for name in ["", ".", "..", "a/b", "a\\b", "bad\0name"] {
            assert!(
                validate_skill_name(name).is_err(),
                "{name:?} must be rejected"
            );
        }
        assert!(validate_skill_name("detail-koala-ui").is_ok());
    }
}
