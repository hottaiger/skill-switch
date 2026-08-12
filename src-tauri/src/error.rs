use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ErrorCode {
    InvalidSkill,
    InvalidPath,
    PathConflict,
    PermissionDenied,
    SourceMissing,
    CopyFailed,
    VerificationFailed,
    SymlinkFailed,
    BackupFailed,
    RestoreConflict,
    ConfigCorrupted,
    Io,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: ErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

impl CommandError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            path: None,
            detail: None,
        }
    }

    pub fn at_path(mut self, path: &Path) -> Self {
        self.path = Some(path.to_string_lossy().into_owned());
        self
    }

    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }

    pub fn io(message: impl Into<String>, path: &Path, error: &std::io::Error) -> Self {
        let code = if error.kind() == std::io::ErrorKind::PermissionDenied {
            ErrorCode::PermissionDenied
        } else {
            ErrorCode::Io
        };
        Self::new(code, message)
            .at_path(path)
            .with_detail(error.to_string())
    }
}

impl Display for CommandError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}", self.message)
    }
}

impl std::error::Error for CommandError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_stable_error_code() {
        let error = CommandError::new(ErrorCode::PathConflict, "目标已存在")
            .at_path(Path::new("/tmp/alpha"));
        let value = serde_json::to_value(error).unwrap();
        assert_eq!(value["code"], "pathConflict");
        assert_eq!(value["path"], "/tmp/alpha");
    }
}
