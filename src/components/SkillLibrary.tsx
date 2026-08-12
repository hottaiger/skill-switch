import { useRef, useState } from "react";
import { APP_LABELS, type AppKind, type AppSupport, type LibraryView, type SkillOpener, type SkillRecord } from "../types";
import { AppIcon } from "./AppIcon";
import { OpenWithMenu } from "./OpenWithMenu";

interface SkillLibraryProps {
  skills: SkillRecord[];
  selectedName?: string;
  search: string;
  appFilter?: AppKind;
  appSupport: AppSupport;
  view: LibraryView;
  loading: boolean;
  busyKey?: string;
  groupByCategory: boolean;
  onSearch: (value: string) => void;
  onViewChange: (view: LibraryView) => void;
  onToggleGroup: () => void;
  onSelect: (name: string) => void;
  onRefresh: () => void;
  onImport: () => void;
  onClearAppFilter: () => void;
  onOpenWith: (name: string, opener: SkillOpener) => void;
}

function supportedApps(skill: SkillRecord, appSupport: AppSupport) {
  return skill.visibility.filter((state) => appSupport[state.app] && state.enabled).map((state) => state.app);
}

function matchesAppFilter(skill: SkillRecord, appFilter?: AppKind) {
  return !appFilter || skill.visibility.some((state) => state.app === appFilter && state.enabled);
}

function groupSkills(skills: SkillRecord[]): Array<{ name: string; items: SkillRecord[] }> {
  const groups = new Map<string, SkillRecord[]>();
  for (const skill of skills) {
    const key = skill.category || "未分类";
    const bucket = groups.get(key);
    if (bucket) bucket.push(skill);
    else groups.set(key, [skill]);
  }
  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right, "zh"))
    .map(([name, items]) => ({ name, items }));
}

export function SkillLibrary({
  skills,
  selectedName,
  search,
  appFilter,
  appSupport,
  view,
  loading,
  busyKey,
  groupByCategory,
  onSearch,
  onViewChange,
  onToggleGroup,
  onSelect,
  onRefresh,
  onImport,
  onClearAppFilter,
  onOpenWith,
}: SkillLibraryProps) {
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const needle = search.trim().toLocaleLowerCase();
  const visible = skills.filter((skill) => {
    const matchesSearch = !needle || skill.name.toLocaleLowerCase().includes(needle)
      || (skill.description || "").toLocaleLowerCase().includes(needle);
    return matchesSearch && matchesAppFilter(skill, appFilter);
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

  const toggleGroup = (name: string) => {
    setCollapsed((current) => {
        const next = new Set(current);
        if (next.has(name)) next.delete(name); else next.add(name);
        return next;
      });
  };

  const renderSkill = (skill: SkillRecord) => (
    <div
      className={`${view === "list" ? "skill-row" : "skill-card"} ${skill.name === selectedName ? "selected" : ""}`}
      key={skill.name}
    >
      <button
        role="option"
        aria-selected={skill.name === selectedName}
        aria-label={skill.name}
        className="skill-main"
        ref={(node) => {
          if (node) optionRefs.current.set(skill.name, node);
          else optionRefs.current.delete(skill.name);
        }}
        onClick={() => onSelect(skill.name)}
        onKeyDown={(event) => moveSelection(event, skill.name)}
      >
        {view === "list" ? (
          <span className="skill-copy"><strong>{skill.name}</strong><small>{skill.description || "暂无描述"}</small></span>
        ) : (
          <>
            <strong className="skill-card-name">{skill.name}</strong>
            <span className="skill-card-apps" aria-label="支持的应用">
              {supportedApps(skill, appSupport).map((app) => <span className="skill-card-app" key={app} title={APP_LABELS[app]}><AppIcon app={app} /></span>)}
            </span>
          </>
        )}
      </button>
      {view === "list" && (
        <OpenWithMenu
          label={skill.name}
          busyKey={busyKey}
          busyPrefix={skill.name}
          onOpenWith={(opener) => onOpenWith(skill.name, opener)}
          onNavigate={() => onSelect(skill.name)}
        />
      )}
    </div>
  );

  const emptyState = (
    <div className="empty-state"><strong>没有匹配的 Skill</strong><span>调整搜索或筛选条件</span></div>
  );

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
            <svg viewBox="0 0 24 24" aria-hidden="true" className="search-icon">
              <path d="M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm6.32 7.9 1 1 3.5 3.5-1.42 1.42-3.5-3.5 1.42-1.42z" />
            </svg>
            <input
              aria-label="搜索 Skills"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="搜索已安装的 Skills…"
            />
            <kbd>⌘ K</kbd>
          </label>
          {appFilter && <button className="app-filter-chip" onClick={onClearAppFilter}>{APP_LABELS[appFilter]} ×</button>}
          <div className="view-switch" role="group" aria-label="视图切换">
            <button className={view === "list" ? "active" : ""} aria-pressed={view === "list"} onClick={() => onViewChange("list")}>列表</button>
            <button className={view === "cards" ? "active" : ""} aria-pressed={view === "cards"} onClick={() => onViewChange("cards")}>卡片</button>
          </div>
          <button className="ghost-button group-toggle" onClick={onToggleGroup} aria-pressed={groupByCategory}>
            {groupByCategory ? "已分组" : "未分组"}
          </button>
        </div>
        <div className="collection-scroll">
          {groupByCategory ? (
            <div className="skill-grouped" role="listbox" aria-label="已安装 Skills">
              {groupSkills(visible).map((group) => {
                const isCollapsed = collapsed.has(group.name);
                return (
                  <section className="skill-group" key={group.name}>
                    <button
                      className="skill-group-header"
                      aria-expanded={!isCollapsed}
                      onClick={() => toggleGroup(group.name)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" className={`skill-group-chevron ${isCollapsed ? "" : "skill-group-chevron--open"}`}>
                        <path d="M9 6l6 6-6 6V6z" />
                      </svg>
                      <strong>{group.name}</strong>
                      <small>{group.items.length}</small>
                    </button>
                    {!isCollapsed && (
                      <div className={view === "list" ? "skill-list" : "skill-grid"}>
                        {group.items.map(renderSkill)}
                      </div>
                    )}
                  </section>
                );
              })}
              {!visible.length && emptyState}
            </div>
          ) : (
            <div className={view === "list" ? "skill-list" : "skill-grid"} role="listbox" aria-label="已安装 Skills">
              {visible.map(renderSkill)}
              {!visible.length && emptyState}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}