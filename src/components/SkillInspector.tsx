import { useEffect, useState } from "react";
import { ALL_APPS, APP_LABELS, isNativeApp, type AppKind, type AppSupport, type SkillRecord } from "../types";

const CATEGORY_SOURCES = {
  "Matt Pocock": {
    label: "Matt Pocock skills",
    url: "https://github.com/mattpocock/skills/tree/main/skills",
  },
  Comet: {
    label: "rpamis/comet · assets/skills-zh",
    url: "https://github.com/rpamis/comet/tree/master/assets/skills-zh",
  },
  GitNexus: {
    label: "abhigyanpatwari/GitNexus v1.6.9 · gitnexus/skills",
    url: "https://github.com/abhigyanpatwari/GitNexus/tree/v1.6.9/gitnexus/skills",
  },
  Obsidian: {
    label: "kepano/obsidian-skills · skills",
    url: "https://github.com/kepano/obsidian-skills/tree/main/skills",
  },
  "Obsidian Visual Skills Pack": {
    label: "axtonliu/axton-obsidian-visual-skills",
    url: "https://github.com/axtonliu/axton-obsidian-visual-skills/tree/main",
  },
  superpowers: {
    label: "obra/superpowers · skills",
    url: "https://github.com/obra/superpowers/tree/main/skills",
  },
  openspec: {
    label: "Fission-AI/OpenSpec · skills",
    url: "https://github.com/Fission-AI/OpenSpec/tree/main/skills",
  },
} as const;

const BUILT_IN_CATEGORIES = Object.keys(CATEGORY_SOURCES);

function categorySource(category: string) {
  return CATEGORY_SOURCES[category as keyof typeof CATEGORY_SOURCES];
}

function categorySelection(category: string, source: SkillRecord["categorySource"], customCategories: string[]) {
  if (source === "auto" && category === "未分类") return "__uncategorized__";
  if (BUILT_IN_CATEGORIES.includes(category) || customCategories.includes(category)) return category;
  return "__legacy_category__";
}

interface SkillInspectorProps {
  skill?: SkillRecord;
  busyKey?: string;
  appSupport: AppSupport;
  customCategories: string[];
  onClose: () => void;
  onToggle: (app: AppKind, enabled: boolean) => void;
  onUninstall: (reason: string) => void;
  onSetCategory: (skillName: string, category: string) => void;
  onCreateCategory: (skillName: string, category: string) => void;
}

function formatSize(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function formatTime(ms: number) {
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function SkillInspector({ skill, busyKey, appSupport, customCategories, onClose, onToggle, onUninstall, onSetCategory, onCreateCategory }: SkillInspectorProps) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [categoryMode, setCategoryMode] = useState("__uncategorized__");
  useEffect(() => {
    if (!skill) return;
    setCategoryDraft(skill.category);
    setCategoryMode(categorySelection(skill.category, skill.categorySource, customCategories));
  }, [skill?.name, skill?.category, skill?.categorySource, customCategories]);
  if (!skill) return null;
  const uninstalling = busyKey === `${skill.name}:uninstall`;
  const savingCategory = busyKey === `${skill.name}:category`;
  const draft = categoryDraft;
  const availableCustomCategories = Array.from(new Set(customCategories.filter((category) => category !== "未分类" && !BUILT_IN_CATEGORIES.includes(category))));
  const canSaveExistingCategory = (BUILT_IN_CATEGORIES.includes(categoryMode) || availableCustomCategories.includes(categoryMode)) && draft.trim() !== skill.category;
  const source = skill.categorySource === "auto" ? categorySource(skill.category) : undefined;
  return (
    <aside className="inspector" role="dialog" aria-label="Skill 详情">
      <div className="inspector-topbar"><span className="eyebrow">SKILL 详情</span><button className="inspector-close" aria-label="关闭详情" onClick={onClose}>×</button></div>
      <h2>{skill.name}</h2>
      <p className="meta">本地 · {formatSize(skill.sizeBytes)} · 修改于 {formatTime(skill.modifiedAtMs)}</p>
      <div className="category-edit">
        <span className="category-edit-label">分类</span>
        <div className="category-edit-row">
          {categoryMode === "__new_category__" ? (
            <input
              aria-label="新建分类"
              value={draft}
              onChange={(event) => setCategoryDraft(event.target.value)}
              placeholder="例如：项目专用"
              disabled={savingCategory}
              className="category-edit-input"
            />
          ) : (
            <select
              aria-label="Skill 分类"
              value={categoryMode}
              onChange={(event) => {
                const value = event.target.value;
                setCategoryMode(value);
                if (value === "__uncategorized__" || value === "__new_category__") setCategoryDraft("");
                else setCategoryDraft(value);
              }}
              disabled={savingCategory}
              className="category-edit-input"
            >
              {skill.categorySource === "auto" && skill.category === "未分类" && <option value="__uncategorized__">未分类</option>}
              {categoryMode === "__legacy_category__" && <option value="__legacy_category__" disabled>{skill.category}</option>}
              <option value="__source_categories__" disabled>来源分类</option>
              {BUILT_IN_CATEGORIES.map((category) => <option value={category} key={category}>{category}</option>)}
              <option value="__custom_categories__" disabled>自定义分类</option>
              {availableCustomCategories.map((category) => <option value={category} key={category}>{category}</option>)}
              <option value="__new_category__">新建分类…</option>
            </select>
          )}
          <button
            className="ghost-button category-edit-action"
            disabled={savingCategory || !draft.trim() || (categoryMode === "__new_category__" ? draft.trim() === skill.category : !canSaveExistingCategory)}
            onClick={() => categoryMode === "__new_category__" ? onCreateCategory(skill.name, draft.trim()) : onSetCategory(skill.name, draft.trim())}
          >
            {savingCategory ? "保存中" : "保存"}
          </button>
          {skill.categorySource === "manual" && (
            <button
              className="ghost-button category-edit-action"
              disabled={savingCategory}
              onClick={() => { setCategoryDraft(""); onSetCategory(skill.name, ""); }}
            >
              恢复默认
            </button>
          )}
        </div>
        {skill.categorySource === "manual" ? <small>已手动设置分类。</small> : source && <small>
          来源：{source.label}。<a className="category-source-link" href={source.url} target="_blank" rel="noreferrer">{source.url.replace("https://", "")}</a>
        </small>}
      </div>
      <div className="description">{skill.description || "该 Skill 未提供 description。"}</div>
      <h3>应用可见性</h3>
      <div className="visibility-list">
        {ALL_APPS.filter((app) => appSupport[app]).map((app) => {
          const state = skill.visibility.find((item) => item.app === app);
          const native = isNativeApp(app);
          const busy = busyKey === `${skill.name}:${app}`;
          return (
            <div className="visibility-row" key={app}>
              <div>
                <strong>{APP_LABELS[app]}</strong>
                <small>{native ? "读取唯一数据源" : state?.mode === "conflict" ? "目标路径冲突" : "逐项软连接"}</small>
                {state?.mode === "conflict" && state.path && <code className="conflict-path">{state.path}</code>}
              </div>
              {native ? <span className="auto-badge">自动可见</span> : (
                <label className="switch">
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={APP_LABELS[app]}
                    checked={Boolean(state?.enabled)}
                    disabled={busy || state?.mode === "conflict"}
                    onChange={(event) => onToggle(app, event.target.checked)}
                  />
                  <span />
                </label>
              )}
            </div>
          );
        })}
      </div>
      <h3>数据源</h3>
      <code className="path-box">{skill.path}</code>
      {confirming ? (
        <div className="confirm-uninstall" role="alertdialog" aria-label={`确认卸载 ${skill.name}`}>
          <p className="confirm-warning">卸载前会备份到 <code>~/.skill-switch/backups/</code>,每个 Skill 最多保留 5 份。此操作会移除统一目录中的 Skill 及所有软链接。</p>
          <label className="confirm-reason">
            <span>卸载原因(选填)</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value.slice(0, 200))}
              placeholder="例如:不再使用 / 已被替代 / 内容过时"
              rows={2}
              maxLength={200}
            />
          </label>
          <div className="confirm-actions">
            <button className="ghost-button" disabled={uninstalling} onClick={() => { setConfirming(false); setReason(""); }}>取消</button>
            <button className="danger-button" disabled={uninstalling} onClick={() => onUninstall(reason.trim())}>
              {uninstalling ? "卸载中…" : "确认卸载"}
            </button>
          </div>
        </div>
      ) : (
        <button className="danger-button" disabled={uninstalling} onClick={() => setConfirming(true)}>
          移至备份并卸载…
        </button>
      )}
    </aside>
  );
}
