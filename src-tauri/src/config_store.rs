use crate::error::{CommandError, ErrorCode};
use crate::models::{Settings, SettingsLoad};
use crate::paths::{app_data_dir, config_path};
use std::fs;
use std::io::Write;
use std::path::Path;

pub fn load_settings(home: &Path) -> Result<SettingsLoad, CommandError> {
    let path = config_path(home);
    if !path.exists() {
        return Ok(SettingsLoad {
            settings: Settings::default(),
            warning: None,
        });
    }
    let bytes = fs::read(&path).map_err(|error| CommandError::io("读取配置失败", &path, &error))?;
    match serde_json::from_slice::<Settings>(&bytes) {
        Ok(settings) if settings.schema_version == 1 => Ok(SettingsLoad {
            settings,
            warning: None,
        }),
        Ok(_) => Ok(SettingsLoad {
            settings: Settings::default(),
            warning: Some(
                CommandError::new(ErrorCode::ConfigCorrupted, "配置版本不受支持").at_path(&path),
            ),
        }),
        Err(error) => Ok(SettingsLoad {
            settings: Settings::default(),
            warning: Some(
                CommandError::new(ErrorCode::ConfigCorrupted, "配置文件损坏，已加载默认设置")
                    .at_path(&path)
                    .with_detail(error.to_string()),
            ),
        }),
    }
}

pub fn save_settings(home: &Path, settings: &Settings) -> Result<(), CommandError> {
    let directory = app_data_dir(home);
    fs::create_dir_all(&directory)
        .map_err(|error| CommandError::io("创建配置目录失败", &directory, &error))?;
    let destination = config_path(home);
    let temporary = directory.join(format!("config.json.tmp-{}", std::process::id()));
    let payload = serde_json::to_vec_pretty(settings).map_err(|error| {
        CommandError::new(ErrorCode::Io, "序列化配置失败").with_detail(error.to_string())
    })?;
    let mut file = fs::File::create(&temporary)
        .map_err(|error| CommandError::io("创建临时配置失败", &temporary, &error))?;
    file.write_all(&payload)
        .map_err(|error| CommandError::io("写入临时配置失败", &temporary, &error))?;
    file.sync_all()
        .map_err(|error| CommandError::io("同步临时配置失败", &temporary, &error))?;
    fs::rename(&temporary, &destination)
        .map_err(|error| CommandError::io("替换配置失败", &destination, &error))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_round_trip_atomically() {
        let home = tempfile::tempdir().unwrap();
        let mut expected = Settings::default();
        expected.app_paths.claude = Some("/tmp/claude-skills".into());
        save_settings(home.path(), &expected).unwrap();
        assert_eq!(load_settings(home.path()).unwrap().settings, expected);
        assert!(!home.path().join(".skill-switch/config.json.tmp").exists());
    }

    #[test]
    fn corrupted_config_is_preserved_and_reported() {
        let home = tempfile::tempdir().unwrap();
        fs::create_dir_all(home.path().join(".skill-switch")).unwrap();
        let path = home.path().join(".skill-switch/config.json");
        fs::write(&path, b"not json").unwrap();
        let loaded = load_settings(home.path()).unwrap();
        assert_eq!(loaded.settings, Settings::default());
        assert_eq!(loaded.warning.unwrap().code, ErrorCode::ConfigCorrupted);
        assert_eq!(fs::read(&path).unwrap(), b"not json");
    }

    #[test]
    fn legacy_settings_default_to_list_view() {
        let home = tempfile::tempdir().unwrap();
        fs::create_dir_all(home.path().join(".skill-switch")).unwrap();
        fs::write(
            home.path().join(".skill-switch/config.json"),
            br#"{"schemaVersion":1,"appPaths":{},"lastSection":"library","skillFilter":"all"}"#,
        )
        .unwrap();
        let settings = load_settings(home.path()).unwrap().settings;
        assert_eq!(settings.library_view, "list");
        assert!(settings.app_support.claude);
        assert!(settings.app_support.cursor);
    }
}
