use crate::error::{CommandError, ErrorCode};
use crate::models::{AppKind, ScanSnapshot, Settings, VisibilityMode, VisibilityState};
use crate::paths::{app_root, ssot_dir};
use crate::skill_fs::validate_skill_name;
use std::fs;
use std::path::{Path, PathBuf};

fn source_path(home: &Path, skill_name: &str) -> Result<PathBuf, CommandError> {
    validate_skill_name(skill_name)?;
    let source = ssot_dir(home).join(skill_name);
    let metadata = fs::symlink_metadata(&source)
        .map_err(|error| CommandError::io("Skill 不存在", &source, &error))?;
    if !metadata.file_type().is_dir() || metadata.file_type().is_symlink() {
        return Err(
            CommandError::new(ErrorCode::SourceMissing, "Skill 源目录无效").at_path(&source),
        );
    }
    if !source.join("SKILL.md").is_file() {
        return Err(
            CommandError::new(ErrorCode::InvalidSkill, "Skill 缺少 SKILL.md").at_path(&source),
        );
    }
    Ok(source)
}

fn link_target(destination: &Path) -> Result<PathBuf, CommandError> {
    let target = fs::read_link(destination)
        .map_err(|error| CommandError::io("读取软连接失败", destination, &error))?;
    Ok(if target.is_absolute() {
        target
    } else {
        destination
            .parent()
            .unwrap_or_else(|| Path::new("/"))
            .join(target)
    })
}

fn links_to(destination: &Path, source: &Path) -> bool {
    let Ok(target) = link_target(destination) else {
        return false;
    };
    match (target.canonicalize(), source.canonicalize()) {
        (Ok(target), Ok(source)) => target == source,
        _ => false,
    }
}

pub fn derive_visibility(
    home: &Path,
    settings: &Settings,
    skill_name: &str,
    app: AppKind,
) -> Result<VisibilityState, CommandError> {
    if !settings.app_support.is_enabled(app) {
        return Err(CommandError::new(ErrorCode::InvalidPath, "应用未启用"));
    }
    let source = source_path(home, skill_name)?;
    if app.is_native_ssot() {
        return Ok(VisibilityState {
            app,
            enabled: true,
            mode: VisibilityMode::Auto,
            path: Some(source.to_string_lossy().into_owned()),
        });
    }
    let destination = app_root(home, app, settings).join(skill_name);
    match fs::symlink_metadata(&destination) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(VisibilityState {
            app,
            enabled: false,
            mode: VisibilityMode::Disabled,
            path: Some(destination.to_string_lossy().into_owned()),
        }),
        Err(error) => Err(CommandError::io(
            "读取应用 Skill 状态失败",
            &destination,
            &error,
        )),
        Ok(metadata) if metadata.file_type().is_symlink() && links_to(&destination, &source) => {
            Ok(VisibilityState {
                app,
                enabled: true,
                mode: VisibilityMode::Linked,
                path: Some(destination.to_string_lossy().into_owned()),
            })
        }
        Ok(_) => Ok(VisibilityState {
            app,
            enabled: false,
            mode: VisibilityMode::Conflict,
            path: Some(destination.to_string_lossy().into_owned()),
        }),
    }
}

pub fn set_visibility(
    home: &Path,
    settings: &Settings,
    skill_name: &str,
    app: AppKind,
    enabled: bool,
) -> Result<VisibilityState, CommandError> {
    if !settings.app_support.is_enabled(app) {
        return Err(CommandError::new(ErrorCode::InvalidPath, "应用未启用"));
    }
    if app.is_native_ssot() {
        return Err(CommandError::new(
            ErrorCode::InvalidPath,
            "Codex、Cursor 和 Zcode 固定读取统一 Skill 目录",
        ));
    }
    let source = source_path(home, skill_name)?;
    let root = app_root(home, app, settings);
    fs::create_dir_all(&root)
        .map_err(|error| CommandError::io("创建应用 Skill 目录失败", &root, &error))?;
    let destination = root.join(skill_name);
    let existing = fs::symlink_metadata(&destination);
    if enabled {
        match existing {
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                #[cfg(unix)]
                std::os::unix::fs::symlink(&source, &destination).map_err(|error| {
                    CommandError::new(ErrorCode::SymlinkFailed, "创建应用软连接失败")
                        .at_path(&destination)
                        .with_detail(error.to_string())
                })?;
            }
            Ok(metadata)
                if metadata.file_type().is_symlink() && links_to(&destination, &source) => {}
            Ok(_) => {
                return Err(
                    CommandError::new(ErrorCode::PathConflict, "目标位置已有非受管内容")
                        .at_path(&destination),
                );
            }
            Err(error) => return Err(CommandError::io("读取目标位置失败", &destination, &error)),
        }
    } else {
        match existing {
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Ok(metadata)
                if metadata.file_type().is_symlink() && links_to(&destination, &source) =>
            {
                fs::remove_file(&destination).map_err(|error| {
                    CommandError::io("删除应用软连接失败", &destination, &error)
                })?;
            }
            Ok(_) => {
                return Err(
                    CommandError::new(ErrorCode::PathConflict, "拒绝删除非受管目标")
                        .at_path(&destination),
                );
            }
            Err(error) => return Err(CommandError::io("读取目标位置失败", &destination, &error)),
        }
    }
    let state = derive_visibility(home, settings, skill_name, app)?;
    if state.enabled != enabled {
        return Err(
            CommandError::new(ErrorCode::VerificationFailed, "软连接状态校验失败")
                .at_path(&destination),
        );
    }
    Ok(state)
}

pub fn populate_visibility(home: &Path, settings: &Settings, snapshot: &mut ScanSnapshot) {
    for skill in &mut snapshot.skills {
        skill.visibility = AppKind::ALL
            .into_iter()
            .filter(|app| settings.app_support.is_enabled(*app))
            .filter_map(|app| derive_visibility(home, settings, &skill.name, app).ok())
            .collect();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Fixture {
        home: tempfile::TempDir,
        settings: Settings,
    }

    impl Fixture {
        fn new() -> Self {
            Self {
                home: tempfile::tempdir().unwrap(),
                settings: Settings::default(),
            }
        }

        fn make_skill(&self, name: &str) -> PathBuf {
            let path = ssot_dir(self.home.path()).join(name);
            fs::create_dir_all(&path).unwrap();
            fs::write(path.join("SKILL.md"), "---\ndescription: test\n---\n").unwrap();
            path
        }

        fn destination(&self, app: AppKind, name: &str) -> PathBuf {
            app_root(self.home.path(), app, &self.settings).join(name)
        }
    }

    #[test]
    fn enable_and_disable_are_verified_and_idempotent() {
        let fixture = Fixture::new();
        fixture.make_skill("alpha");
        let enabled = set_visibility(
            fixture.home.path(),
            &fixture.settings,
            "alpha",
            AppKind::Claude,
            true,
        )
        .unwrap();
        assert_eq!(enabled.mode, VisibilityMode::Linked);
        set_visibility(
            fixture.home.path(),
            &fixture.settings,
            "alpha",
            AppKind::Claude,
            true,
        )
        .unwrap();
        let disabled = set_visibility(
            fixture.home.path(),
            &fixture.settings,
            "alpha",
            AppKind::Claude,
            false,
        )
        .unwrap();
        assert_eq!(disabled.mode, VisibilityMode::Disabled);
        set_visibility(
            fixture.home.path(),
            &fixture.settings,
            "alpha",
            AppKind::Claude,
            false,
        )
        .unwrap();
    }

    #[test]
    fn disabled_app_rejects_visibility_changes() {
        let mut fixture = Fixture::new();
        fixture.settings.app_support.claude = false;
        fixture.make_skill("alpha");
        assert_eq!(
            set_visibility(
                fixture.home.path(),
                &fixture.settings,
                "alpha",
                AppKind::Claude,
                true
            )
            .unwrap_err()
            .code,
            ErrorCode::InvalidPath
        );
    }

    #[test]
    fn disable_never_removes_user_owned_directory() {
        let fixture = Fixture::new();
        fixture.make_skill("alpha");
        let destination = fixture.destination(AppKind::Claude, "alpha");
        fs::create_dir_all(&destination).unwrap();
        let error = set_visibility(
            fixture.home.path(),
            &fixture.settings,
            "alpha",
            AppKind::Claude,
            false,
        )
        .unwrap_err();
        assert_eq!(error.code, ErrorCode::PathConflict);
        assert!(destination.is_dir());
    }

    #[test]
    fn unknown_and_broken_symlinks_are_conflicts() {
        let fixture = Fixture::new();
        fixture.make_skill("alpha");
        let destination = fixture.destination(AppKind::Gemini, "alpha");
        fs::create_dir_all(destination.parent().unwrap()).unwrap();
        std::os::unix::fs::symlink("/missing/target", &destination).unwrap();
        let state = derive_visibility(
            fixture.home.path(),
            &fixture.settings,
            "alpha",
            AppKind::Gemini,
        )
        .unwrap();
        assert_eq!(state.mode, VisibilityMode::Conflict);
        let error = set_visibility(
            fixture.home.path(),
            &fixture.settings,
            "alpha",
            AppKind::Gemini,
            true,
        )
        .unwrap_err();
        assert_eq!(error.code, ErrorCode::PathConflict);
        assert!(fs::symlink_metadata(destination)
            .unwrap()
            .file_type()
            .is_symlink());
    }

    #[test]
    fn native_apps_are_always_auto_and_cannot_toggle() {
        let fixture = Fixture::new();
        fixture.make_skill("alpha");
        for app in [AppKind::Codex, AppKind::Cursor, AppKind::Zcode] {
            let state =
                derive_visibility(fixture.home.path(), &fixture.settings, "alpha", app).unwrap();
            assert!(state.enabled);
            assert_eq!(state.mode, VisibilityMode::Auto);
            assert_eq!(
                set_visibility(fixture.home.path(), &fixture.settings, "alpha", app, false)
                    .unwrap_err()
                    .code,
                ErrorCode::InvalidPath
            );
        }
    }
}
