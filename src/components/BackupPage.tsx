import type { BackupRecord, SkillOpener } from "../types";
import { OpenWithMenu } from "./OpenWithMenu";

interface BackupPageProps {
  backups: BackupRecord[];
  loading: boolean;
  busyKey?: string;
  onRefresh: () => void;
  onRestore: (backup: BackupRecord) => void;
  onPermanentDelete: (backup: BackupRecord) => void;
  onOpenWith: (backupId: string, opener: SkillOpener) => void;
}

const operationLabel = { import: "导入", replace: "替换", uninstall: "卸载" } as const;

export function BackupPage({ backups, loading, busyKey, onRefresh, onRestore, onPermanentDelete, onOpenWith }: BackupPageProps) {
  return (
    <section className="secondary-page">
      <div className="page-title-row"><div><h1>备份</h1><p>每个 Skill 保留最近 5 份已校验备份</p></div><button className="ghost-button" onClick={onRefresh} disabled={loading}>↻ 刷新</button></div>
      <div className="card-list">
        {backups.map((backup) => (
          <article className="data-card compact" key={backup.id}>
            <div className="card-heading">
              <div>
                <strong>{backup.skillName}</strong>
                <small>{new Date(backup.createdAtMs).toLocaleString()} · {operationLabel[backup.operation]}</small>
              </div>
              <div className="card-actions">
                <OpenWithMenu
                  label={backup.skillName}
                  busyKey={busyKey}
                  busyPrefix={backup.id}
                  onOpenWith={(opener) => onOpenWith(backup.id, opener)}
                />
                <button className="ghost-button" disabled={busyKey === backup.id} onClick={() => onRestore(backup)}>恢复</button>
                <button className="ghost-button danger-text" disabled={busyKey === backup.id} onClick={() => onPermanentDelete(backup)}>彻底删除</button>
              </div>
            </div>
            {backup.reason && <p className="card-reason">原因：{backup.reason}</p>}
            <code>{backup.path}</code>
          </article>
        ))}
        {!loading && !backups.length && <div className="empty-state"><strong>暂无备份</strong><span>导入、替换或卸载后会自动生成</span></div>}
      </div>
    </section>
  );
}
