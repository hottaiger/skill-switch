import { useEffect, useState } from "react";
import { ALL_APPS, APP_LABELS, MANAGED_APPS, NATIVE_APPS, type AppKind, type ScanSnapshot, type SettingsSnapshot } from "../types";
import { AppIcon } from "./AppIcon";

interface SettingsPageProps {
  snapshot?: SettingsSnapshot;
  skills?: ScanSnapshot;
  busyKey?: string;
  onSave: (app: AppKind, path: string) => void;
  onToggleSupport: (app: AppKind, enabled: boolean) => void;
  onCreateCustomCategory: (name: string) => void;
  onRenameCustomCategory: (previousName: string, nextName: string) => void;
  onDeleteCustomCategory: (name: string) => void;
}

export function SettingsPage({ snapshot, skills, busyKey, onSave, onToggleSupport, onCreateCustomCategory, onRenameCustomCategory, onDeleteCustomCategory }: SettingsPageProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [editingPath, setEditingPath] = useState<AppKind>();
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [editingCategory, setEditingCategory] = useState<string>();
  const [renameDraft, setRenameDraft] = useState("");
  const [openCategoryMenu, setOpenCategoryMenu] = useState<string>();
  const [confirmingDeletion, setConfirmingDeletion] = useState<string>();

  useEffect(() => {
    if (snapshot) setValues(Object.fromEntries(MANAGED_APPS.map((app) => [app, snapshot.paths[app]])));
  }, [snapshot]);

  const appSupport = snapshot?.settings.appSupport;
  const enabledApps = ALL_APPS.filter((app) => appSupport?.[app]);
  const customCategories = snapshot?.settings.customCategories || [];
  const categoryUsage = (category: string) => skills && skills.skills.filter((skill) => skill.category === category).length;
  const customCategoryBusy = Boolean(busyKey?.startsWith("custom-category:"));
  const isNativeApp = (app: AppKind) => NATIVE_APPS.includes(app);

  const cancelPathEdit = () => {
    if (editingPath) setValues((current) => ({ ...current, [editingPath]: snapshot?.paths[editingPath] || "" }));
    setEditingPath(undefined);
  };
  const cancelRename = () => {
    setEditingCategory(undefined);
    setRenameDraft("");
  };

  return (
    <section className="secondary-page settings-page">
      <div className="page-title-row"><div><h1>设置</h1><p>管理支持的应用、Skill 目录和自定义分类。</p></div></div>
      {snapshot?.warning && <div className="error-banner">{snapshot.warning.message}</div>}

      <section className="settings-card support-settings-card" aria-labelledby="support-apps-title">
        <div className="settings-card-heading"><div><h2 className="settings-section-title" id="support-apps-title">支持的应用</h2><p>选择需要同步管理的应用。</p></div></div>
        <div className="app-support-list">
          {ALL_APPS.map((app) => <button className="app-support-toggle" key={app} type="button" role="switch" aria-checked={Boolean(appSupport?.[app])} disabled={busyKey === `support:${app}`} onClick={() => onToggleSupport(app, !appSupport?.[app])}>
            <span className="app-support-icon"><AppIcon app={app} /></span><span className="app-support-name">{APP_LABELS[app]}</span><span className="support-switch" />
          </button>)}
        </div>
      </section>

      <section className="settings-card application-directory-settings" aria-labelledby="application-directory-title">
        <div className="settings-card-heading"><div><h2 className="settings-section-title" id="application-directory-title">应用目录</h2><p>管理各应用读取 Skill 的目录位置。</p></div></div>
        <div className="application-directory-list">
          {enabledApps.map((app) => {
            const editing = editingPath === app;
            const native = isNativeApp(app);
            const path = native ? snapshot?.paths[app] || "" : values[app] || "";
            return <div className="application-directory-row" key={app}>
              <span className="application-directory-icon"><AppIcon app={app} /></span>
              <div className="application-directory-main"><strong>{APP_LABELS[app]}</strong><span>{native ? "系统管理" : "自定义目录"}</span></div>
              {editing ? <input aria-label={`${APP_LABELS[app]} Skill 目录`} value={path} disabled={busyKey === app} onChange={(event) => setValues((current) => ({ ...current, [app]: event.target.value }))} /> : <code title={path}>{path}</code>}
              <div className="application-directory-actions">
                {editing ? <><button className="ghost-button" disabled={busyKey === app || !path.trim()} onClick={() => { onSave(app, path); setEditingPath(undefined); }}>保存</button><button className="ghost-button" disabled={busyKey === app} onClick={cancelPathEdit}>取消</button></> : native ? <span className="directory-status">固定自动可见</span> : <button className="ghost-button" disabled={Boolean(busyKey)} aria-label={`修改 ${APP_LABELS[app]} 目录`} onClick={() => setEditingPath(app)}>修改</button>}
              </div>
            </div>;
          })}
        </div>
      </section>

      <section className="settings-card custom-category-settings" aria-labelledby="custom-category-title">
        <div className="settings-card-heading"><div><h2 className="settings-section-title" id="custom-category-title">自定义分类</h2><p>仅管理手动创建的可复用分类。</p></div><button className="ghost-button" disabled={customCategoryBusy} onClick={() => setCreatingCategory(true)}>新建分类</button></div>
        {creatingCategory && <div className="create-custom-category"><input aria-label="分类名称" autoFocus value={categoryDraft} disabled={customCategoryBusy} onChange={(event) => setCategoryDraft(event.target.value)} /><button className="ghost-button" disabled={customCategoryBusy || !categoryDraft.trim()} onClick={() => { onCreateCustomCategory(categoryDraft.trim()); setCategoryDraft(""); setCreatingCategory(false); }}>创建</button><button className="ghost-button" disabled={customCategoryBusy} onClick={() => { setCategoryDraft(""); setCreatingCategory(false); }}>取消</button></div>}
        {customCategories.length === 0 ? <p className="settings-empty-state">尚未创建自定义分类。</p> : <div className="custom-category-list" aria-label="自定义分类列表">
          {customCategories.map((category) => {
            const usage = categoryUsage(category);
            const categoryBusy = customCategoryBusy || busyKey === `custom-category:${category}`;
            const renaming = editingCategory === category;
            return <div className="custom-category-row" key={category}>
              {renaming ? <div className="custom-category-edit"><input aria-label={`重命名 ${category}`} value={renameDraft} disabled={categoryBusy} onChange={(event) => setRenameDraft(event.target.value)} /><div><button className="ghost-button" disabled={categoryBusy || !renameDraft.trim() || renameDraft.trim() === category} onClick={() => { onRenameCustomCategory(category, renameDraft.trim()); cancelRename(); }}>保存</button><button className="ghost-button" disabled={categoryBusy} onClick={cancelRename}>取消</button></div></div> : <><div className="custom-category-main"><strong>{category}</strong><span>· {usage === undefined ? "使用情况待确认" : `使用于 ${usage} 个 Skill`}</span></div><div className="custom-category-menu-wrap"><button className="icon-button" aria-label={`${category} 操作`} aria-expanded={openCategoryMenu === category} disabled={categoryBusy} onClick={() => setOpenCategoryMenu((current) => current === category ? undefined : category)}>···</button>{openCategoryMenu === category && <div className="custom-category-menu" role="menu"><button role="menuitem" type="button" onClick={() => { setEditingCategory(category); setRenameDraft(category); setOpenCategoryMenu(undefined); }}>重命名</button><button className="danger-text" role="menuitem" type="button" onClick={() => { setOpenCategoryMenu(undefined); usage === undefined || usage > 0 ? setConfirmingDeletion(category) : onDeleteCustomCategory(category); }}>删除</button></div>}</div></>}
              {confirmingDeletion === category && <div className="confirm-custom-category-delete" role="group" aria-label={`删除 ${category} 确认`} aria-describedby={`delete-category-warning-${category}`}><p id={`delete-category-warning-${category}`}>{usage === undefined ? "使用情况待确认，删除后引用此分类的 Skills 将变为未分类。" : `引用此分类的 ${usage} 个 Skill 将变为未分类。`}</p><div className="confirm-actions"><button className="ghost-button" disabled={categoryBusy} onClick={() => setConfirmingDeletion(undefined)}>取消</button><button className="danger-button" disabled={categoryBusy} onClick={() => onDeleteCustomCategory(category)}>确认移至未分类</button></div></div>}
            </div>;
          })}
        </div>}
      </section>
    </section>
  );
}
