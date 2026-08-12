# Skill Switch CSS-Only Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply approved typography, spacing, color, and desktop layout rules by editing only `src/styles.css`.

**Architecture:** The existing React tree, component props, accessibility attributes, Tauri commands, and backend state remain immutable. The stylesheet maps the approved design tokens onto the existing class names.

**Tech Stack:** CSS, React 19, Vitest, TypeScript, Vite, Tauri 2.

## Global Constraints

- Modify only `src/styles.css`.
- Keep the existing DOM tree, component code, API calls, Rust behavior, and tests unchanged.
- Keep the default 1120 x 720 and minimum 900 x 600 window behavior.
- At widths >= 900px, use a 170px / flexible / 280px non-overlapping three-column layout.
- Use body type >= 14px, secondary type >= 12px, page titles at 22px, and controls >= 32px.
- Preserve system light and dark themes and use `#5e6ad2` as the primary accent.
- Use only lightweight 140-150ms CSS transitions.

---

### Task 1: Apply approved CSS-only desktop refinement

**Files:**
- Modify: `src/styles.css`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: Existing CSS class names emitted by `App.tsx`, `Sidebar.tsx`, `SkillLibrary.tsx`, `SkillInspector.tsx`, `ImportPage.tsx`, `BackupPage.tsx`, and `SettingsPage.tsx`.
- Produces: An unchanged application interface with larger type, consistent controls, semantic surfaces, and a 1120px-safe three-column shell.

- [x] **Step 1: Capture the CSS-only baseline**

Run:

```bash
git diff -- src/styles.css
pnpm test
pnpm typecheck
```

Expected: no uncommitted stylesheet diff; frontend tests and TypeScript pass before the visual change.

- [x] **Step 2: Replace visual rules without changing selectors consumed by React**

In `src/styles.css`:

```css
:root {
  --font-body: 14px;
  --font-secondary: 12px;
  --font-title: 22px;
  --control-height: 36px;
  --accent: #5e6ad2;
}

.app-shell {
  grid-template-columns: 170px minmax(0, 1fr) 280px;
}

@media (max-width: 899px) {
  .app-shell {
    grid-template-columns: 145px minmax(0, 1fr);
  }

  .inspector {
    display: none;
  }
}
```

Raise existing textual rules to the token scale, make buttons and filters at least 32px tall, retain all current colors as semantic variables in both themes, and retain only 140-150ms hover, focus, selected-row, and switch transitions.

- [x] **Step 3: Run regression verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: all tests pass; TypeScript exits 0; Vite creates the production bundle.

- [x] **Step 4: Verify the desktop application**

Run:

```bash
pnpm tauri build --debug
```

Expected: a macOS debug application bundle is produced. At 1120 x 720, the navigation, library, and inspector fit without horizontal overflow or inspector overlap.

- [x] **Step 5: Commit**

```bash
git add src/styles.css docs/superpowers/plans/2026-07-19-skill-switch-ui-refinement.md docs/superpowers/specs/2026-07-19-skill-switch-ui-refinement-design.md
git commit -m "feat: refine Skill Switch visual system"
```
