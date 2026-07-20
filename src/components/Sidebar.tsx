import { ALL_APPS, APP_LABELS, type AppKind, type AppSupport, type Section } from "../types";
import { AppIcon } from "./AppIcon";

interface SidebarProps {
  section: Section;
  skillCount: number;
  appFilter?: AppKind;
  appSupport: AppSupport;
  onSectionChange: (section: Section) => void;
  onAppFilter: (app: AppKind) => void;
}

const navigation: Array<{ id: Section; icon: string; label: string }> = [
  { id: "library", icon: "◫", label: "技能库" },
  { id: "import", icon: "↓", label: "本地导入" },
  { id: "backups", icon: "↺", label: "备份" },
];

export function Sidebar({
  section,
  skillCount,
  appFilter,
  appSupport,
  onSectionChange,
  onAppFilter,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">SS</span><span>Skill Switch</span></div>
      <div className="nav-group-label">管理</div>
      <nav aria-label="主导航">
        {navigation.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${section === item.id && !appFilter ? "active" : ""}`}
            onClick={() => onSectionChange(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>{item.label}
            {item.id === "library" && <span className="nav-count">{skillCount}</span>}
          </button>
        ))}
      </nav>
      <div className="nav-group-label">应用</div>
      <nav aria-label="应用筛选">
        {ALL_APPS.filter((app) => appSupport[app]).map((app) => (
          <button
            key={app}
            className={`nav-item ${section === "library" && appFilter === app ? "active" : ""}`}
            onClick={() => onAppFilter(app)}
          >
            <span className="app-monogram"><AppIcon app={app} /></span>
            {APP_LABELS[app]}
          </button>
        ))}
      </nav>
      <div className="nav-group-label">系统</div>
      <button
        className={`nav-item ${section === "settings" ? "active" : ""}`}
        onClick={() => onSectionChange("settings")}
      >
        <span className="nav-icon">⚙</span>设置
      </button>
      <span className="version">Skill Switch · v0.1</span>
    </aside>
  );
}
