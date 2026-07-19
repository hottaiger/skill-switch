import { APP_LABELS, type ImportCandidate, type ImportDecision } from "../types";

interface ImportPageProps {
  candidates: ImportCandidate[];
  loading: boolean;
  busyKey?: string;
  onRefresh: () => void;
  onImport: (candidate: ImportCandidate, decision: ImportDecision) => void;
}

function formatModifiedAt(value: number) {
  return value ? new Date(value).toLocaleString("zh-CN") : "未知";
}

export function ImportPage({ candidates, loading, busyKey, onRefresh, onImport }: ImportPageProps) {
  return (
    <section className="secondary-page import-page">
      <div className="page-title-row"><div><h1>本地导入</h1><p>仅扫描 Claude、Gemini、OpenCode 和 Hermes</p></div><button className="ghost-button" onClick={onRefresh} disabled={loading}>↻ 重新扫描</button></div>
      <div className="notice-card">导入后内容归一到 <code>~/.agents/skills/</code>，原位置替换为软连接，并保留可恢复备份。</div>
      <div className="card-list">
        {candidates.map((candidate) => {
          const key = `${candidate.app}:${candidate.name}`;
          return (
            <article className="data-card" key={key}>
              <div className="card-heading"><div><strong>{candidate.name}</strong><small>{APP_LABELS[candidate.app]} · {candidate.sourcePath}</small><small>修改时间：{formatModifiedAt(candidate.sourceModifiedAtMs)}</small></div><span className={`status ${candidate.status}`}>{candidate.status === "ready" ? "可导入" : candidate.status === "identical" ? "内容相同" : candidate.status === "conflict" ? "需要选择" : "无效"}</span></div>
              {candidate.differences.length > 0 && <ul className="diff-list">{candidate.differences.map((item) => <li key={item}>{item}</li>)}</ul>}
              {candidate.error && <p className="inline-error">{candidate.error.message}</p>}
              <div className="card-actions">
                {candidate.status === "ready" && <button className="primary-button" disabled={busyKey === key} onClick={() => onImport(candidate, "normalize")}>导入</button>}
                {candidate.status === "identical" && <button className="primary-button" disabled={busyKey === key} onClick={() => onImport(candidate, "normalize")}>归一化为软连接</button>}
                {candidate.status === "conflict" && <><button className="ghost-button" disabled={busyKey === key} onClick={() => onImport(candidate, "keepSsot")}>保留统一版本</button><button className="primary-button" disabled={busyKey === key} onClick={() => onImport(candidate, "useSource")}>使用导入版本</button></>}
              </div>
            </article>
          );
        })}
        {!loading && !candidates.length && <div className="empty-state"><strong>没有待导入 Skill</strong><span>已知应用目录均已归一化</span></div>}
      </div>
    </section>
  );
}
