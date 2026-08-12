import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { BackupPage } from "./components/BackupPage";
import { ImportPage } from "./components/ImportPage";
import { SettingsPage } from "./components/SettingsPage";
import { Sidebar } from "./components/Sidebar";
import { SkillInspector } from "./components/SkillInspector";
import { SkillLibrary } from "./components/SkillLibrary";
import type {
  AppKind,
  AppSupport,
  BackupRecord,
  CommandError,
  ImportCandidate,
  ImportDecision,
  LibraryView,
  ScanSnapshot,
  Section,
  SettingsSnapshot,
  SkillOpener,
} from "./types";

const DEFAULT_APP_SUPPORT: AppSupport = { claude: true, gemini: true, openCode: true, hermes: true, codex: true, cursor: true, zcode: true };

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) return String((error as CommandError).message);
  return String(error);
}

export default function App() {
  const [section, setSection] = useState<Section>("library");
  const [snapshot, setSnapshot] = useState<ScanSnapshot>();
  const [settings, setSettings] = useState<SettingsSnapshot>();
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [selectedName, setSelectedName] = useState<string>();
  const [search, setSearch] = useState("");
  const [libraryView, setLibraryView] = useState<LibraryView>("list");
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [appFilter, setAppFilter] = useState<AppKind>();
  const [busyKey, setBusyKey] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string }>();

  const refreshSkills = useCallback(async () => {
    setLoading(true);
    try {
      const next = await api.scanSkills();
      setSnapshot(next);
      setSelectedName((current) => current && next.skills.some((skill) => skill.name === current) ? current : undefined);
      if (next.warnings[0]) setMessage({ type: "error", text: next.warnings[0].message });
    } catch (error) {
      setMessage({ type: "error", text: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshImports = useCallback(async () => {
    setLoading(true);
    try { setCandidates(await api.scanImportCandidates()); }
    catch (error) { setMessage({ type: "error", text: errorMessage(error) }); }
    finally { setLoading(false); }
  }, []);

  const refreshBackups = useCallback(async () => {
    setLoading(true);
    try { setBackups(await api.listBackups()); }
    catch (error) { setMessage({ type: "error", text: errorMessage(error) }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void Promise.all([
      refreshSkills(),
      api.getSettings().then((value) => {
        setSettings(value);
        setSection(value.settings.lastSection);
        setLibraryView(value.settings.libraryView);
        if (value.warning) setMessage({ type: "error", text: value.warning.message });
      }).catch((error) => setMessage({ type: "error", text: errorMessage(error) })),
    ]);
  }, [refreshSkills]);

  useEffect(() => {
    const onFocus = () => { void refreshSkills(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshSkills]);

  useEffect(() => {
    if (section === "import") void refreshImports();
    if (section === "backups") void refreshBackups();
  }, [section, refreshBackups, refreshImports]);

  const selectedSkill = useMemo(
    () => snapshot?.skills.find((skill) => skill.name === selectedName),
    [selectedName, snapshot],
  );
  const appSupport = settings?.settings.appSupport || DEFAULT_APP_SUPPORT;

  const persistPreference = (nextSection: Section, nextView = libraryView) => {
    void api.updateUiPreferences(nextSection, nextView).catch(() => undefined);
  };

  const changeSection = (next: Section) => {
    setSection(next); setAppFilter(undefined); persistPreference(next);
  };

  const changeLibraryView = (next: LibraryView) => {
    setLibraryView(next); persistPreference(section, next);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (section !== "library") return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('input[aria-label="搜索 Skills"]')?.focus();
      }
      if (event.key === "Escape" && selectedName) {
        event.preventDefault();
        setSelectedName(undefined);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [section, selectedName]);

  const toggleVisibility = async (app: AppKind, enabled: boolean) => {
    if (!selectedSkill) return;
    const key = `${selectedSkill.name}:${app}`;
    setBusyKey(key); setMessage(undefined);
    try {
      await api.setSkillVisibility(selectedSkill.name, app, enabled);
      await refreshSkills();
    } catch (error) {
      setMessage({ type: "error", text: errorMessage(error) });
    } finally { setBusyKey(undefined); }
  };

  const openSkillWith = async (name: string, opener: SkillOpener) => {
    const key = `${name}:open:${opener}`;
    setBusyKey(key); setMessage(undefined);
    try {
      await api.openSkillWith(name, opener);
    } catch (error) {
      setMessage({ type: "error", text: errorMessage(error) });
    } finally { setBusyKey(undefined); }
  };

  const uninstall = async (reason: string) => {
    if (!selectedSkill) return;
    setBusyKey(`${selectedSkill.name}:uninstall`); setMessage(undefined);
    try {
      await api.uninstallSkill(selectedSkill.name, reason);
      setMessage({ type: "success", text: `${selectedSkill.name} 已备份并卸载` });
      await Promise.all([refreshSkills(), refreshBackups()]);
    } catch (error) { setMessage({ type: "error", text: errorMessage(error) }); }
    finally { setBusyKey(undefined); }
  };

  const runImport = async (candidate: ImportCandidate, decision: ImportDecision) => {
    const key = `${candidate.app}:${candidate.name}`;
    setBusyKey(key); setMessage(undefined);
    try {
      const [execution] = await api.importSkills([{ app: candidate.app, name: candidate.name, decision }]);
      if (execution.error) throw execution.error;
      setMessage({ type: "success", text: `${candidate.name} 导入完成` });
      await Promise.all([refreshImports(), refreshSkills(), refreshBackups()]);
    } catch (error) { setMessage({ type: "error", text: errorMessage(error) }); }
    finally { setBusyKey(undefined); }
  };

  const restore = async (backup: BackupRecord) => {
    setBusyKey(backup.id); setMessage(undefined);
    try {
      const next = await api.restoreBackup(backup.id);
      setSnapshot(next); setSection("library"); setSelectedName(backup.skillName);
      setMessage({ type: "success", text: `${backup.skillName} 已恢复` });
    } catch (error) { setMessage({ type: "error", text: errorMessage(error) }); }
    finally { setBusyKey(undefined); }
  };

  const permanentDelete = async (backup: BackupRecord) => {
    setBusyKey(backup.id); setMessage(undefined);
    try {
      const next = await api.deleteBackup(backup.id);
      setBackups(next);
      setMessage({ type: "success", text: `${backup.skillName} 的备份已彻底删除` });
    } catch (error) { setMessage({ type: "error", text: errorMessage(error) }); }
    finally { setBusyKey(undefined); }
  };

  const openBackupWith = async (backupId: string, opener: SkillOpener) => {
    setBusyKey(`${backupId}:open:${opener}`); setMessage(undefined);
    try {
      await api.openBackupWith(backupId, opener);
    } catch (error) {
      setMessage({ type: "error", text: errorMessage(error) });
    } finally { setBusyKey(undefined); }
  };

  const setSkillCategory = async (skillName: string, category: string) => {
    const key = `${skillName}:category`;
    setBusyKey(key); setMessage(undefined);
    try {
      const next = await api.setSkillCategory(skillName, category);
      setSnapshot(next);
    } catch (error) {
      setMessage({ type: "error", text: errorMessage(error) });
    } finally { setBusyKey(undefined); }
  };

  const savePath = async (app: AppKind, path: string) => {
    setBusyKey(app); setMessage(undefined);
    try {
      const next = await api.updateAppPath(app, path);
      setSettings(next); setMessage({ type: "success", text: `${app} 路径已保存` });
      await refreshSkills();
    } catch (error) { setMessage({ type: "error", text: errorMessage(error) }); }
    finally { setBusyKey(undefined); }
  };

  const toggleAppSupport = async (app: AppKind, enabled: boolean) => {
    const key = `support:${app}`;
    setBusyKey(key); setMessage(undefined);
    try {
      const next = await api.setAppSupport(app, enabled);
      setSettings(next);
      if (!enabled && appFilter === app) setAppFilter(undefined);
      await Promise.all([refreshSkills(), refreshImports()]);
    } catch (error) { setMessage({ type: "error", text: errorMessage(error) }); }
    finally { setBusyKey(undefined); }
  };

  return (
    <div className="app-shell">
      <Sidebar
        section={section}
        skillCount={snapshot?.skills.length || 0}
        appFilter={appFilter}
        appSupport={appSupport}
        onSectionChange={changeSection}
        onAppFilter={(app) => { setSection("library"); setAppFilter(app); persistPreference("library"); }}
      />
      <main className="main-panel">
        {message && <div role={message.type === "error" ? "alert" : "status"} className={`message-banner ${message.type}`}><span>{message.text}</span><button aria-label="关闭提示" onClick={() => setMessage(undefined)}>×</button></div>}
        {section === "library" && <SkillLibrary skills={snapshot?.skills || []} selectedName={selectedName} search={search} appFilter={appFilter} appSupport={appSupport} view={libraryView} loading={loading} groupByCategory={groupByCategory} onSearch={setSearch} onViewChange={changeLibraryView} onToggleGroup={() => setGroupByCategory((value) => !value)} onSelect={setSelectedName} onRefresh={() => void refreshSkills()} onImport={() => changeSection("import")} onClearAppFilter={() => setAppFilter(undefined)} onOpenWith={openSkillWith} />}
        {section === "import" && <ImportPage candidates={candidates} loading={loading} busyKey={busyKey} appSupport={appSupport} onRefresh={() => void refreshImports()} onImport={(candidate, decision) => void runImport(candidate, decision)} />}
        {section === "backups" && <BackupPage backups={backups} loading={loading} busyKey={busyKey} onRefresh={() => void refreshBackups()} onRestore={(backup) => void restore(backup)} onPermanentDelete={(backup) => void permanentDelete(backup)} onOpenWith={(backupId, opener) => void openBackupWith(backupId, opener)} />}
        {section === "settings" && <SettingsPage snapshot={settings} busyKey={busyKey} onSave={(app, path) => void savePath(app, path)} onToggleSupport={(app, enabled) => void toggleAppSupport(app, enabled)} />}
      </main>
      {section === "library" && selectedSkill && <>
        <button className="inspector-backdrop" aria-label="关闭详情遮罩" onClick={() => setSelectedName(undefined)} />
        <SkillInspector skill={selectedSkill} busyKey={busyKey} appSupport={appSupport} onClose={() => setSelectedName(undefined)} onToggle={(app, enabled) => void toggleVisibility(app, enabled)} onUninstall={(reason) => void uninstall(reason)} onSetCategory={(name, category) => void setSkillCategory(name, category)} />
      </>}
    </div>
  );
}
