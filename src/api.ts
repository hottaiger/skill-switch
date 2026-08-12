import { invoke } from "@tauri-apps/api/core";
import type {
  AppKind,
  BackupRecord,
  ImportCandidate,
  ImportExecution,
  ImportRequest,
  LibraryView,
  ScanSnapshot,
  Section,
  SettingsSnapshot,
  SkillOpener,
  VisibilityState,
} from "./types";

export const api = {
  scanSkills: () => invoke<ScanSnapshot>("scan_skills"),
  scanImportCandidates: () => invoke<ImportCandidate[]>("scan_import_candidates"),
  setSkillVisibility: (skillName: string, app: AppKind, enabled: boolean) =>
    invoke<VisibilityState>("set_skill_visibility", { skillName, app, enabled }),
  importSkills: (requests: ImportRequest[]) =>
    invoke<ImportExecution[]>("import_skills", { requests }),
  resolveImportConflict: (request: ImportRequest) =>
    invoke("resolve_import_conflict", { request }),
  uninstallSkill: (skillName: string, reason: string) =>
    invoke<BackupRecord>("uninstall_skill", { skillName, reason }),
  listBackups: () => invoke<BackupRecord[]>("list_backups"),
  restoreBackup: (backupId: string) =>
    invoke<ScanSnapshot>("restore_backup", { backupId }),
  deleteBackup: (backupId: string) =>
    invoke<BackupRecord[]>("delete_backup", { backupId }),
  getSettings: () => invoke<SettingsSnapshot>("get_settings"),
  updateAppPath: (app: AppKind, path?: string) =>
    invoke<SettingsSnapshot>("update_app_path", { app, path: path || null }),
  setAppSupport: (app: AppKind, enabled: boolean) =>
    invoke<SettingsSnapshot>("set_app_support", { app, enabled }),
  setSkillCategory: (skillName: string, category: string) =>
    invoke<ScanSnapshot>("set_skill_category", { skillName, category }),
  createCustomCategory: (name: string) =>
    invoke<SettingsSnapshot>("create_custom_category", { name }),
  updateUiPreferences: (lastSection: Section, libraryView: LibraryView) =>
    invoke<SettingsSnapshot>("update_ui_preferences", { lastSection, libraryView }),
  openSkillWith: (skillName: string, opener: SkillOpener) =>
    invoke<void>("open_skill_with", { skillName, opener }),
  openBackupWith: (backupId: string, opener: SkillOpener) =>
    invoke<void>("open_backup_with", { backupId, opener }),
};
