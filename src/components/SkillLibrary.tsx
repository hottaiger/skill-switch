import { APP_LABELS, MANAGED_APPS, type AppKind, type SkillFilter, type SkillRecord } from "../types";

interface SkillLibraryProps {
  skills: SkillRecord[];
  selectedName?: string;
  search: string;
  filter: SkillFilter;
  appFilter?: AppKind;
  loading: boolean;
  onSearch: (value: string) => void;
  onFilter: (filter: SkillFilter) => void;
  onSelect: (name: string) => void;
  onRefresh: () => void;
  onImport: () => void;
  onClearAppFilter: () => void;
}

function managedEnabled(skill: SkillRecord) {
  return skill.visibility.some((state) => MANAGED_APPS.includes(state.app) && state.enabled);
}

export function SkillLibrary({
  skills,
  selectedName,
  search,
  filter,
  appFilter,
  loading,
  onSearch,
  onFilter,
  onSelect,
  onRefresh,
  onImport,
  onClearAppFilter,
}: SkillLibraryProps) {
  const needle = search.trim().toLocaleLowerCase();
  const visible = skills.filter((skill) => {
    const matchesSearch = !needle || skill.name.toLocaleLowerCase().includes(needle)
      || (skill.description || "").toLocaleLowerCase().includes(needle);
    const enabled = managedEnabled(skill);
    const matchesFilter = filter === "all" || (filter === "enabled" ? enabled : !enabled);
    const matchesApp = !appFilter || skill.visibility.some((state) => state.app === appFilter && state.enabled);
    return matchesSearch && matchesFilter && matchesApp;
  });

  return (
    <section className="library-page">
      <header className="toolbar">
        <label className="search-box">
          <span>⌕</span>
          <input
            aria-label="搜索 Skills"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="搜索已安装的 Skills…"
          />
          <kbd>⌘ K</kbd>
        </label>
        <button className="primary-button" onClick={onImport}>＋ 导入 Skill</button>
      </header>
      <div className="page-body">
        <div className="page-title-row">
          <div><h1>技能库</h1><p>实时读取 ~/.agents/skills/ · {skills.length} 个 Skill</p></div>
          <button className="ghost-button" onClick={onRefresh} disabled={loading}>↻ {loading ? "刷新中" : "刷新"}</button>
        </div>
        <div className="filters" role="group" aria-label="Skill 筛选">
          {(["all", "enabled", "disabled"] as SkillFilter[]).map((value) => (
            <button key={value} className={filter === value ? "active" : ""} onClick={() => onFilter(value)}>
              {value === "all" ? `全部 ${skills.length}` : value === "enabled" ? "已启用" : "未启用"}
            </button>
          ))}
          {appFilter && <button className="active" onClick={onClearAppFilter}>{APP_LABELS[appFilter]} ×</button>}
        </div>
        <div className="skill-list" role="listbox" aria-label="已安装 Skills">
          {visible.map((skill) => (
            <button
              role="option"
              aria-selected={skill.name === selectedName}
              className={`skill-row ${skill.name === selectedName ? "selected" : ""}`}
              key={skill.name}
              onClick={() => onSelect(skill.name)}
            >
              <span className="skill-mark">{skill.name.slice(0, 2).toUpperCase()}</span>
              <span className="skill-copy"><strong>{skill.name}</strong><small>{skill.description || "暂无描述"}</small></span>
              <span className="app-chips" aria-label="已启用应用">
                {MANAGED_APPS.map((app) => {
                  const state = skill.visibility.find((item) => item.app === app);
                  return <span key={app} className={state?.enabled ? "enabled" : ""}>{APP_LABELS[app].slice(0, 2)}</span>;
                })}
              </span>
            </button>
          ))}
          {!visible.length && (
            <div className="empty-state"><strong>没有匹配的 Skill</strong><span>调整搜索或筛选条件</span></div>
          )}
        </div>
      </div>
    </section>
  );
}
