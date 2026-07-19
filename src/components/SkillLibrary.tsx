import { useRef } from "react";
import { APP_LABELS, MANAGED_APPS, type AppKind, type LibraryView, type SkillFilter, type SkillRecord } from "../types";
import { AppIcon } from "./AppIcon";

interface SkillLibraryProps {
  skills: SkillRecord[];
  selectedName?: string;
  search: string;
  filter: SkillFilter;
  appFilter?: AppKind;
  view: LibraryView;
  loading: boolean;
  onSearch: (value: string) => void;
  onFilter: (filter: SkillFilter) => void;
  onViewChange: (view: LibraryView) => void;
  onSelect: (name: string) => void;
  onRefresh: () => void;
  onImport: () => void;
  onClearAppFilter: () => void;
}

function managedEnabled(skill: SkillRecord) {
  return skill.visibility.some((state) => MANAGED_APPS.includes(state.app) && state.enabled);
}

function visibilitySummary(skill: SkillRecord) {
  const count = skill.visibility.filter((state) => MANAGED_APPS.includes(state.app) && state.enabled).length;
  return count ? `${count}/4 已启用` : "未启用";
}

function supportedApps(skill: SkillRecord) {
  return skill.visibility.filter((state) => state.enabled).map((state) => state.app);
}

export function SkillLibrary({
  skills,
  selectedName,
  search,
  filter,
  appFilter,
  view,
  loading,
  onSearch,
  onFilter,
  onViewChange,
  onSelect,
  onRefresh,
  onImport,
  onClearAppFilter,
}: SkillLibraryProps) {
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const needle = search.trim().toLocaleLowerCase();
  const visible = skills.filter((skill) => {
    const matchesSearch = !needle || skill.name.toLocaleLowerCase().includes(needle)
      || (skill.description || "").toLocaleLowerCase().includes(needle);
    const enabled = managedEnabled(skill);
    const matchesFilter = filter === "all" || (filter === "enabled" ? enabled : !enabled);
    const matchesApp = !appFilter || skill.visibility.some((state) => state.app === appFilter && state.enabled);
    return matchesSearch && matchesFilter && matchesApp;
  });

  const moveSelection = (event: React.KeyboardEvent<HTMLButtonElement>, name: string) => {
    const current = visible.findIndex((skill) => skill.name === name);
    let next = current;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = Math.min(visible.length - 1, current + 1);
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = Math.max(0, current - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = visible.length - 1;
    else return;
    event.preventDefault();
    const nextName = visible[next].name;
    onSelect(nextName);
    optionRefs.current.get(nextName)?.focus();
  };

  return (
    <section className="library-page">
      <div className="page-body library-body">
        <div className="page-title-row">
          <div><h1>技能库</h1><p>实时读取 ~/.agents/skills/ · {skills.length} 个 Skill</p></div>
          <div className="page-actions">
            <button className="ghost-button" onClick={onRefresh} disabled={loading}>↻ {loading ? "刷新中" : "刷新"}</button>
            <button className="primary-button" onClick={onImport}>＋ 导入 Skill</button>
          </div>
        </div>
        <div className="library-controls">
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
          <div className="filters" role="group" aria-label="Skill 筛选">
            {(["all", "enabled", "disabled"] as SkillFilter[]).map((value) => (
              <button key={value} className={filter === value ? "active" : ""} onClick={() => onFilter(value)}>
                {value === "all" ? `全部 ${skills.length}` : value === "enabled" ? "已启用" : "未启用"}
              </button>
            ))}
            {appFilter && <button className="active" onClick={onClearAppFilter}>{APP_LABELS[appFilter]} ×</button>}
          </div>
          <div className="view-switch" role="group" aria-label="视图切换">
            <button className={view === "list" ? "active" : ""} aria-pressed={view === "list"} onClick={() => onViewChange("list")}>列表</button>
            <button className={view === "cards" ? "active" : ""} aria-pressed={view === "cards"} onClick={() => onViewChange("cards")}>卡片</button>
          </div>
        </div>
        <div className="collection-scroll">
        <div className={view === "list" ? "skill-list" : "skill-grid"} role="listbox" aria-label="已安装 Skills">
          {visible.map((skill) => (
            <button
              role="option"
              aria-selected={skill.name === selectedName}
              aria-label={skill.name}
              className={`${view === "list" ? "skill-row" : "skill-card"} ${skill.name === selectedName ? "selected" : ""}`}
              key={skill.name}
              ref={(node) => {
                if (node) optionRefs.current.set(skill.name, node);
                else optionRefs.current.delete(skill.name);
              }}
              onClick={() => onSelect(skill.name)}
              onKeyDown={(event) => moveSelection(event, skill.name)}
            >
              {view === "list" ? <>
                <span className="skill-copy"><strong>{skill.name}</strong><small>{skill.description || "暂无描述"}</small></span>
                <span className={`visibility-summary ${managedEnabled(skill) ? "" : "disabled"}`}>{visibilitySummary(skill)}</span>
              </> : <>
                <strong className="skill-card-name">{skill.name}</strong>
                <span className="skill-card-apps" aria-label="支持的应用">
                  {supportedApps(skill).map((app) => <span className="skill-card-app" key={app} title={APP_LABELS[app]}><AppIcon app={app} /></span>)}
                </span>
              </>}
            </button>
          ))}
          {!visible.length && (
            <div className="empty-state"><strong>没有匹配的 Skill</strong><span>调整搜索或筛选条件</span></div>
          )}
        </div>
        </div>
      </div>
    </section>
  );
}
