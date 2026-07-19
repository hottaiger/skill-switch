# Skill Switch UI Refinement Design

## Goal

Apply the approved Open Design desktop artifact to the existing Skill Switch React interface without changing its filesystem, visibility, import, backup, or restore behavior.

## Source of truth

The approved artifact is stored by Open Design at:

`/Users/zhangshuo12/Library/Application Support/Open Design/namespaces/release-stable/data/projects/cfa2540f-10a0-4e7f-a56f-03b400898e45/artifact.html`

Its critique score is 4/5. The implementation uses the artifact's semantic token system and desktop information hierarchy, not its mock data or standalone JavaScript.

## Visual contract

- Keep the macOS window minimum at 900 x 600 and default at 1120 x 720.
- At widths from 900px upward, render a true three-column layout: 170px navigation, flexible library content, and 280px inspector. Do not use a fixed or overlapping inspector panel.
- Use a 52px application toolbar, 36px search field, and controls with a minimum 32px hit area.
- Use `#5e6ad2` as the only primary accent, with semantic surface, border, success, and danger tokens in both system themes.
- Use system-first Inter typography. Body text is 14px or larger; secondary text is 12px or larger; page titles are 22px.
- Preserve the existing search, filter, section navigation, visibility toggle, import, backup, restore, error, and uninstall behaviors and accessible roles.
- Use only lightweight 140-150ms color, border, and selection transitions. Do not add decorative animation.

## Component mapping

| Existing unit | Visual responsibility |
| --- | --- |
| `src/styles.css` | Semantic tokens, layout grid, typography scale, shared controls, responsive behavior |
| `src/components/Sidebar.tsx` | Semantic navigation sections and source/policy summaries only when supported by live data |
| `src/components/SkillLibrary.tsx` | Toolbar, list hierarchy, filter controls, and selected-row state |
| `src/components/SkillInspector.tsx` | Inspector cards, visibility controls, source path, and destructive action hierarchy |
| `src/App.test.tsx` | Preserve interaction behavior while asserting key semantic layout regions remain available |

## Explicit exclusions

- Do not copy mock Skill records, metrics, event feeds, or demo content from the artifact.
- Do not add a database, provider, repository discovery, online marketplace, remote download, or migration workflow.
- Do not modify Rust commands, data models, filesystem transactions, or Tauri capabilities.

