use crate::error::{CommandError, ErrorCode};
use crate::models::{AppKind, Settings};
use std::ffi::OsStr;
use std::path::{Path, PathBuf};

pub fn current_home() -> Result<PathBuf, CommandError> {
    if let Some(home) = std::env::var_os("SKILL_SWITCH_HOME") {
        if !home.is_empty() {
            return Ok(PathBuf::from(home));
        }
    }
    dirs::home_dir().ok_or_else(|| CommandError::new(ErrorCode::InvalidPath, "无法确定用户主目录"))
}

pub fn ssot_dir(home: &Path) -> PathBuf {
    home.join(".agents").join("skills")
}

pub fn app_data_dir(home: &Path) -> PathBuf {
    home.join(".skill-switch")
}

pub fn config_path(home: &Path) -> PathBuf {
    app_data_dir(home).join("config.json")
}

pub fn backups_dir(home: &Path) -> PathBuf {
    app_data_dir(home).join("backups")
}

pub fn app_root(home: &Path, app: AppKind, settings: &Settings) -> PathBuf {
    app_root_with_hermes_home(
        home,
        app,
        settings,
        std::env::var_os("HERMES_HOME").as_deref(),
    )
}

fn configured(path: &Option<String>) -> Option<PathBuf> {
    path.as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
}

fn app_root_with_hermes_home(
    home: &Path,
    app: AppKind,
    settings: &Settings,
    hermes_home: Option<&OsStr>,
) -> PathBuf {
    match app {
        AppKind::Claude => configured(&settings.app_paths.claude)
            .unwrap_or_else(|| home.join(".claude").join("skills")),
        AppKind::Gemini => configured(&settings.app_paths.gemini)
            .unwrap_or_else(|| home.join(".gemini").join("skills")),
        AppKind::OpenCode => configured(&settings.app_paths.open_code)
            .unwrap_or_else(|| home.join(".config").join("opencode").join("skills")),
        AppKind::Hermes => configured(&settings.app_paths.hermes).unwrap_or_else(|| {
            hermes_home
                .filter(|value| !value.is_empty())
                .map(PathBuf::from)
                .unwrap_or_else(|| home.join(".hermes"))
                .join("skills")
        }),
        AppKind::Codex | AppKind::Cursor => ssot_dir(home),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_all_default_paths() {
        let home = Path::new("/Users/example");
        let settings = Settings::default();
        assert_eq!(
            app_root_with_hermes_home(home, AppKind::Claude, &settings, None),
            home.join(".claude/skills")
        );
        assert_eq!(
            app_root_with_hermes_home(home, AppKind::Gemini, &settings, None),
            home.join(".gemini/skills")
        );
        assert_eq!(
            app_root_with_hermes_home(home, AppKind::OpenCode, &settings, None),
            home.join(".config/opencode/skills")
        );
        assert_eq!(
            app_root_with_hermes_home(home, AppKind::Hermes, &settings, None),
            home.join(".hermes/skills")
        );
        assert_eq!(
            app_root_with_hermes_home(home, AppKind::Codex, &settings, None),
            home.join(".agents/skills")
        );
        assert_eq!(
            app_root_with_hermes_home(home, AppKind::Cursor, &settings, None),
            home.join(".agents/skills")
        );
    }

    #[test]
    fn custom_path_and_hermes_home_take_precedence() {
        let home = Path::new("/Users/example");
        let mut settings = Settings::default();
        settings.app_paths.claude = Some("/custom/claude".into());
        assert_eq!(
            app_root_with_hermes_home(home, AppKind::Claude, &settings, None),
            PathBuf::from("/custom/claude")
        );
        assert_eq!(
            app_root_with_hermes_home(
                home,
                AppKind::Hermes,
                &settings,
                Some(OsStr::new("/custom/hermes"))
            ),
            PathBuf::from("/custom/hermes/skills")
        );
    }
}
