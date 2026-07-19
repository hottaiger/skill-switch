export type AppKind = "claude" | "gemini" | "openCode" | "hermes" | "codex" | "cursor";
export type VisibilityMode = "linked" | "disabled" | "auto" | "conflict";
export type Section = "library" | "import" | "backups" | "settings";
export type SkillFilter = "all" | "enabled" | "disabled";
export type LibraryView = "list" | "cards";

export interface CommandError {
  code: string;
  message: string;
  path?: string;
  detail?: string;
}

export interface VisibilityState {
  app: AppKind;
  enabled: boolean;
  mode: VisibilityMode;
  path?: string;
}

export interface SkillRecord {
  name: string;
  description?: string;
  path: string;
  modifiedAtMs: number;
  sizeBytes: number;
  visibility: VisibilityState[];
}

export interface ScanSnapshot {
  ssotPath: string;
  scannedAtMs: number;
  skills: SkillRecord[];
  warnings: CommandError[];
}

export interface AppPathOverrides {
  claude?: string;
  gemini?: string;
  openCode?: string;
  hermes?: string;
}

export interface Settings {
  schemaVersion: number;
  appPaths: AppPathOverrides;
  lastSection: Section;
  skillFilter: SkillFilter;
  libraryView: LibraryView;
}

export interface SettingsSnapshot {
  settings: Settings;
  paths: Record<AppKind, string>;
  warning?: CommandError;
}

export type BackupOperation = "import" | "replace" | "uninstall";

export interface BackupRecord {
  id: string;
  skillName: string;
  createdAtMs: number;
  operation: BackupOperation;
  path: string;
}

export type ImportStatus = "ready" | "identical" | "conflict" | "invalid";
export type ImportDecision = "normalize" | "keepSsot" | "useSource";

export interface ImportCandidate {
  app: AppKind;
  name: string;
  sourcePath: string;
  sourceModifiedAtMs: number;
  status: ImportStatus;
  sourceHash?: string;
  ssotHash?: string;
  differences: string[];
  error?: CommandError;
}

export interface ImportRequest {
  app: AppKind;
  name: string;
  decision: ImportDecision;
}

export interface ImportResult {
  app: AppKind;
  name: string;
  outcome: "imported" | "normalized" | "keptSsot" | "replacedSsot";
  backup: BackupRecord;
}

export interface ImportExecution {
  request: ImportRequest;
  result?: ImportResult;
  error?: CommandError;
}

export const APP_LABELS: Record<AppKind, string> = {
  claude: "Claude",
  gemini: "Gemini",
  openCode: "OpenCode",
  hermes: "Hermes",
  codex: "Codex",
  cursor: "Cursor",
};

export const MANAGED_APPS: AppKind[] = ["claude", "gemini", "openCode", "hermes"];
export const ALL_APPS: AppKind[] = [...MANAGED_APPS, "codex", "cursor"];
