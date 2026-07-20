import { useEffect, useState } from "react";
import { ALL_APPS, APP_LABELS, MANAGED_APPS, type AppKind, type SettingsSnapshot } from "../types";
import { AppIcon } from "./AppIcon";

interface SettingsPageProps {
  snapshot?: SettingsSnapshot;
  busyKey?: string;
  onSave: (app: AppKind, path: string) => void;
  onToggleSupport: (app: AppKind, enabled: boolean) => void;
}

export function SettingsPage({ snapshot, busyKey, onSave, onToggleSupport }: SettingsPageProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (snapshot) setValues(Object.fromEntries(MANAGED_APPS.map((app) => [app, snapshot.paths[app]])));
  }, [snapshot]);
  const appSupport = snapshot?.settings.appSupport;
  const managedApps = MANAGED_APPS.filter((app) => appSupport?.[app]);
  const nativeApps = (["codex", "cursor"] as AppKind[]).filter((app) => appSupport?.[app]);
  return (
    <section className="secondary-page settings-page">
      <div className="page-title-row"><div><h1>设置</h1><p>应用 Skill 目录与固定数据源</p></div></div>
      {snapshot?.warning && <div className="error-banner">{snapshot.warning.message}</div>}
      <div className="settings-card support-settings-card">
        <h2 className="settings-section-title">支持的应用</h2>
        <div className="app-support-list">
          {ALL_APPS.map((app) => <button className="app-support-toggle" key={app} type="button" role="switch" aria-checked={Boolean(appSupport?.[app])} disabled={busyKey === `support:${app}`} onClick={() => onToggleSupport(app, !appSupport?.[app])}>
            <span className="app-support-icon"><AppIcon app={app} /></span><span className="app-support-name">{APP_LABELS[app]}</span><span className="support-switch" />
          </button>)}
        </div>
      </div>
      {managedApps.length > 0 && <div className="settings-card">
        {managedApps.map((app) => (
          <label className="path-setting" key={app}>
            <span><strong>{APP_LABELS[app]}</strong><small>完整 Skill 根目录</small></span>
            <input value={values[app] || ""} onChange={(event) => setValues((current) => ({ ...current, [app]: event.target.value }))} />
            <button className="ghost-button" disabled={busyKey === app} onClick={() => onSave(app, values[app] || "")}>保存</button>
          </label>
        ))}
      </div>}
      {nativeApps.length > 0 && <div className="settings-card fixed-paths">
        {nativeApps.map((app) => <div className="path-setting" key={app}><span><strong>{APP_LABELS[app]}</strong><small>固定自动可见</small></span><code>{snapshot?.paths[app]}</code></div>)}
      </div>}
    </section>
  );
}
