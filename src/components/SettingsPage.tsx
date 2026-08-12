import { useEffect, useState } from "react";
import { ALL_APPS, APP_LABELS, MANAGED_APPS, NATIVE_APPS, type AppKind, type ScanSnapshot, type SettingsSnapshot } from "../types";
import { AppIcon } from "./AppIcon";

interface SettingsPageProps {
  snapshot?: SettingsSnapshot;
  skills?: ScanSnapshot;
  busyKey?: string;
  onSave: (app: AppKind, path: string) => void;
  onToggleSupport: (app: AppKind, enabled: boolean) => void;
  onRenameCustomCategory: (previousName: string, nextName: string) => void;
  onDeleteCustomCategory: (name: string) => void;
}

export function SettingsPage({ snapshot, skills, busyKey, onSave, onToggleSupport, onRenameCustomCategory, onDeleteCustomCategory }: SettingsPageProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [confirmingDeletion, setConfirmingDeletion] = useState<string>();
  useEffect(() => {
    if (snapshot) setValues(Object.fromEntries(MANAGED_APPS.map((app) => [app, snapshot.paths[app]])));
  }, [snapshot]);
  const appSupport = snapshot?.settings.appSupport;
  const managedApps = MANAGED_APPS.filter((app) => appSupport?.[app]);
  const nativeApps = NATIVE_APPS.filter((app) => appSupport?.[app]);
  const customCategories = snapshot?.settings.customCategories || [];
  const categoryUsage = (category: string) => skills?.skills.filter((skill) => skill.category === category).length || 0;
  const customCategoryBusy = Boolean(busyKey);
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
      <div className="settings-card custom-category-settings" aria-labelledby="custom-category-title">
        <div className="settings-card-heading"><div><h2 className="settings-section-title" id="custom-category-title">自定义分类</h2><p>仅管理手动创建的可复用分类。</p></div></div>
        {customCategories.length === 0 ? <p className="settings-empty-state">尚未创建自定义分类。</p> : <div className="custom-category-list" aria-label="自定义分类列表">
          {customCategories.map((category) => {
            const usage = categoryUsage(category);
            const draft = renameDrafts[category] ?? category;
            const categoryBusy = customCategoryBusy || busyKey === `custom-category:${category}`;
            return <div className="custom-category-row" key={category}>
              <div className="custom-category-main"><p>{category} · 使用于 {usage} 个 Skill</p><input aria-label={`重命名 ${category}`} value={draft} disabled={categoryBusy} onChange={(event) => setRenameDrafts((current) => ({ ...current, [category]: event.target.value }))} /></div>
              <div className="custom-category-actions"><button className="ghost-button" disabled={categoryBusy || !draft.trim() || draft.trim() === category} onClick={() => onRenameCustomCategory(category, draft.trim())}>重命名 {category}</button><button className="ghost-button danger-text" disabled={categoryBusy} onClick={() => usage > 0 ? setConfirmingDeletion(category) : onDeleteCustomCategory(category)}>删除 {category}</button></div>
              {confirmingDeletion === category && <div className="confirm-custom-category-delete" role="alertdialog" aria-label={`删除 ${category}`} aria-describedby={`delete-category-warning-${category}`}>
                <p id={`delete-category-warning-${category}`}>引用此分类的 Skills 将变为未分类。</p>
                <div className="confirm-actions"><button className="ghost-button" disabled={categoryBusy} onClick={() => setConfirmingDeletion(undefined)}>取消</button><button className="danger-button" disabled={categoryBusy} onClick={() => onDeleteCustomCategory(category)}>确认移至未分类</button></div>
              </div>}
            </div>;
          })}
        </div>}
      </div>
    </section>
  );
}
