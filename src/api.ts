import { invoke } from "@tauri-apps/api/core";
import type {
  AppKind,
  BackupRecord,
  ImportCandidate,
  ImportExecution,
  ImportRequest,
  ScanSnapshot,
  LibraryView,
  Section,
  SettingsSnapshot,
  SkillFilter,
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
  uninstallSkill: (skillName: string) =>
    invoke<BackupRecord>("uninstall_skill", { skillName }),
  listBackups: () => invoke<BackupRecord[]>("list_backups"),
  restoreBackup: (backupId: string) =>
    invoke<ScanSnapshot>("restore_backup", { backupId }),
  getSettings: () => invoke<SettingsSnapshot>("get_settings"),
  updateAppPath: (app: AppKind, path?: string) =>
    invoke<SettingsSnapshot>("update_app_path", { app, path: path || null }),
  setAppSupport: (app: AppKind, enabled: boolean) =>
    invoke<SettingsSnapshot>("set_app_support", { app, enabled }),
  updateUiPreferences: (lastSection: Section, skillFilter: SkillFilter, libraryView: LibraryView) =>
    invoke<SettingsSnapshot>("update_ui_preferences", { lastSection, skillFilter, libraryView }),
};
