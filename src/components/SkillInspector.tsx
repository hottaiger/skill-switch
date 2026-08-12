import { useEffect, useState } from "react";
import { ALL_APPS, APP_LABELS, isNativeApp, type AppKind, type AppSupport, type SkillRecord } from "../types";

const BUILT_IN_CATEGORIES = ["Matt Pocock", "Comet", "GitNexus", "superpowers", "openspec"];

function categoryRule(category: string) {
  if (category === "Matt Pocock") return "Matt Pocock skills";
  if (category === "Comet") return "rpamis/comet · assets/skills-zh";
  if (category === "GitNexus") return "abhigyanpatwari/GitNexus v1.6.9 · gitnexus/skills";
  if (category === "superpowers") return "obra/superpowers";
  if (category === "openspec") return "Fission-AI/OpenSpec";
  return "未命中内置来源规则";
}

function categorySelection(category: string, source: SkillRecord["categorySource"]) {
  if (source === "auto") return "__auto__";
  return BUILT_IN_CATEGORIES.includes(category) ? category : "__custom__";
}

interface SkillInspectorProps {
  skill?: SkillRecord;
  busyKey?: string;
  appSupport: AppSupport;
  onClose: () => void;
  onToggle: (app: AppKind, enabled: boolean) => void;
  onUninstall: (reason: string) => void;
  onSetCategory: (skillName: string, category: string) => void;
}

function formatSize(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function formatTime(ms: number) {
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function SkillInspector({ skill, busyKey, appSupport, onClose, onToggle, onUninstall, onSetCategory }: SkillInspectorProps) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [categoryMode, setCategoryMode] = useState("__auto__");
  useEffect(() => {
    if (!skill) return;
    setCategoryDraft(skill.category);
    setCategoryMode(categorySelection(skill.category, skill.categorySource));
  }, [skill?.name, skill?.category, skill?.categorySource]);
  if (!skill) return null;
  const uninstalling = busyKey === `${skill.name}:uninstall`;
  const savingCategory = busyKey === `${skill.name}:category`;
  const draft = categoryDraft;
  return (
    <aside className="inspector" role="dialog" aria-label="Skill 详情">
      <div className="inspector-topbar"><span className="eyebrow">SKILL 详情</span><button className="inspector-close" aria-label="关闭详情" onClick={onClose}>×</button></div>
      <h2>{skill.name}</h2>
      <p className="meta">本地 · {formatSize(skill.sizeBytes)} · 修改于 {formatTime(skill.modifiedAtMs)}</p>
      <label className="category-edit">
        <span>分类</span>
        <div className="category-edit-row">
          <select
            aria-label="Skill 分类"
            value={categoryMode}
            onChange={(event) => {
              const value = event.target.value;
              setCategoryMode(value);
              if (value === "__auto__" || value === "__custom__") setCategoryDraft("");
              else setCategoryDraft(value);
            }}
            disabled={savingCategory}
          >
            <option value="__auto__">自动识别（{skill.category}）</option>
            {BUILT_IN_CATEGORIES.map((category) => <option value={category} key={category}>{category}</option>)}
            <option value="__custom__">自定义分类…</option>
          </select>
          {categoryMode === "__custom__" && (
            <input
              aria-label="自定义分类"
              value={draft}
              onChange={(event) => setCategoryDraft(event.target.value)}
              placeholder="例如：项目专用"
              disabled={savingCategory}
            />
          )}
          <button
            className="ghost-button"
            disabled={savingCategory || (draft === skill.category && skill.categorySource === "manual")}
            onClick={() => onSetCategory(skill.name, draft.trim())}
          >
            {savingCategory ? "保存中" : "保存"}
          </button>
          {skill.categorySource === "manual" && (
            <button
              className="ghost-button"
              disabled={savingCategory}
              onClick={() => { setCategoryDraft(""); onSetCategory(skill.name, ""); }}
            >
              恢复自动
            </button>
          )}
        </div>
        <small>{skill.categorySource === "manual" ? "手动分类，优先于自动识别。" : `自动识别：${categoryRule(skill.category)}。`}</small>
      </label>
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
