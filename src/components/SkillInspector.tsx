import { ALL_APPS, APP_LABELS, type AppKind, type AppSupport, type SkillRecord } from "../types";

interface SkillInspectorProps {
  skill?: SkillRecord;
  busyKey?: string;
  appSupport: AppSupport;
  onClose: () => void;
  onToggle: (app: AppKind, enabled: boolean) => void;
  onUninstall: () => void;
}

function formatSize(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function SkillInspector({ skill, busyKey, appSupport, onClose, onToggle, onUninstall }: SkillInspectorProps) {
  if (!skill) return null;
  return (
    <aside className="inspector" role="dialog" aria-label="Skill 详情">
      <div className="inspector-topbar"><span className="eyebrow">SKILL 详情</span><button className="inspector-close" aria-label="关闭详情" onClick={onClose}>×</button></div>
      <h2>{skill.name}</h2>
      <p className="meta">本地 · {formatSize(skill.sizeBytes)}</p>
      <div className="description">{skill.description || "该 Skill 未提供 description。"}</div>
      <h3>应用可见性</h3>
      <div className="visibility-list">
        {ALL_APPS.filter((app) => appSupport[app]).map((app) => {
          const state = skill.visibility.find((item) => item.app === app);
          const native = app === "codex" || app === "cursor";
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
      <button className="danger-button" disabled={busyKey === `${skill.name}:uninstall`} onClick={onUninstall}>
        移至备份并卸载…
      </button>
    </aside>
  );
}
