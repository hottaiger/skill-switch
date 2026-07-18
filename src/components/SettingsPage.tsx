import { useEffect, useState } from "react";
import { APP_LABELS, MANAGED_APPS, type AppKind, type SettingsSnapshot } from "../types";

interface SettingsPageProps {
  snapshot?: SettingsSnapshot;
  busyKey?: string;
  onSave: (app: AppKind, path: string) => void;
}

export function SettingsPage({ snapshot, busyKey, onSave }: SettingsPageProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (snapshot) setValues(Object.fromEntries(MANAGED_APPS.map((app) => [app, snapshot.paths[app]])));
  }, [snapshot]);
  return (
    <section className="secondary-page settings-page">
      <div className="page-title-row"><div><h1>设置</h1><p>应用 Skill 目录与固定数据源</p></div></div>
      {snapshot?.warning && <div className="error-banner">{snapshot.warning.message}</div>}
      <div className="settings-card">
        {MANAGED_APPS.map((app) => (
          <label className="path-setting" key={app}>
            <span><strong>{APP_LABELS[app]}</strong><small>完整 Skill 根目录</small></span>
            <input value={values[app] || ""} onChange={(event) => setValues((current) => ({ ...current, [app]: event.target.value }))} />
            <button className="ghost-button" disabled={busyKey === app} onClick={() => onSave(app, values[app] || "")}>保存</button>
          </label>
        ))}
      </div>
      <div className="settings-card fixed-paths">
        {(["codex", "cursor"] as AppKind[]).map((app) => <div className="path-setting" key={app}><span><strong>{APP_LABELS[app]}</strong><small>固定自动可见</small></span><code>{snapshot?.paths[app]}</code></div>)}
      </div>
    </section>
  );
}
