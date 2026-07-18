import { ALL_APPS, APP_LABELS, type AppKind, type SkillRecord } from "../types";

interface SkillInspectorProps {
  skill?: SkillRecord;
  busyKey?: string;
  onToggle: (app: AppKind, enabled: boolean) => void;
  onUninstall: () => void;
}

function formatSize(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function SkillInspector({ skill, busyKey, onToggle, onUninstall }: SkillInspectorProps) {
  if (!skill) {
    return <aside className="inspector inspector-empty"><span>选择一个 Skill 查看详情</span></aside>;
  }
  return (
    <aside className="inspector">
      <span className="eyebrow">SKILL 详情</span>
      <h2>{skill.name}</h2>
      <p className="meta">本地 · {formatSize(skill.sizeBytes)}</p>
      <div className="description">{skill.description || "该 Skill 未提供 description。"}</div>
      <h3>应用可见性</h3>
      <div className="visibility-list">
        {ALL_APPS.map((app) => {
          const state = skill.visibility.find((item) => item.app === app);
          const native = app === "codex" || app === "cursor";
          const busy = busyKey === `${skill.name}:${app}`;
          return (
            <div className="visibility-row" key={app}>
              <div><strong>{APP_LABELS[app]}</strong><small>{native ? "读取唯一数据源" : state?.mode === "conflict" ? "目标路径冲突" : "逐项软连接"}</small></div>
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
