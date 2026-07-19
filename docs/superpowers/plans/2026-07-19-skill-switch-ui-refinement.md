# Skill Switch UI Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Skill Switch desktop visual system while preserving all existing application behavior.

**Architecture:** Keep React component ownership and Tauri command boundaries unchanged. Consolidate the approved visual rules into CSS tokens and component-scoped class rules, then add small semantic markup only where it supports the new hierarchy and test it through the existing mocked UI flow.

**Tech Stack:** Tauri 2, React 19, TypeScript, Vitest, Testing Library, CSS.

## Global Constraints

- Keep the default 1120 x 720 and minimum 900 x 600 desktop window behavior.
- Keep a 170px / flexible / 280px three-column layout at widths >= 900px.
- Keep body type >= 14px, supporting type >= 12px, page title at 22px, and interactive targets >= 32px.
- Preserve all API calls, Rust behavior, accessible roles, and existing UI tests.
- Do not copy Open Design mock content into the live application.

---

### Task 1: Establish approved desktop tokens and responsive shell

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/SkillInspector.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: Existing `.app-shell`, `.sidebar`, `.main-panel`, and `.inspector` markup.
- Produces: Stable semantic CSS variables and a non-overlapping 170px / flexible / 280px desktop shell.

- [ ] **Step 1: Write the failing layout-presence test**

Add a test that renders `App` and asserts the three semantic application regions are present:

```tsx
it("keeps navigation, library, and inspector regions available at the desktop shell", async () => {
  render(<App />);
  expect(await screen.findByRole("navigation", { name: "主导航" })).toBeVisible();
  expect(screen.getByRole("listbox", { name: "已安装 Skills" })).toBeVisible();
  expect(screen.getByRole("complementary", { name: "Skill 详情" })).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- App.test.tsx -t "keeps navigation, library, and inspector regions"`

Expected: FAIL because the inspector does not yet expose a named complementary region.

- [ ] **Step 3: Add semantic region labels and CSS tokens**

Add `aria-label="Skill 详情"` to the inspector `<aside>`. Replace fixed tiny font rules in `src/styles.css` with the approved `--font-body: 14px`, `--font-secondary: 12px`, `--font-title: 22px`, semantic color variables, and shared `--control-height: 36px`. Set `.app-shell` to `grid-template-columns: 170px minmax(0, 1fr) 280px`; remove the 1020px rule that shrinks or overlays the inspector above the 900px minimum.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- App.test.tsx -t "keeps navigation, library, and inspector regions"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css src/components/SkillInspector.tsx src/App.test.tsx
git commit -m "feat: refine Skill Switch desktop shell"
```

### Task 2: Apply hierarchy to the library, navigation, and inspector

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/SkillLibrary.tsx`
- Modify: `src/components/SkillInspector.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: Existing `Section`, `SkillRecord`, `SkillFilter`, visibility state, and callbacks.
- Produces: Larger readable labels, card-based inspector grouping, 32px-or-larger action targets, and unchanged component callbacks.

- [ ] **Step 1: Write the failing hierarchy test**

```tsx
it("keeps visibility and source details in the refined inspector", async () => {
  render(<App />);
  const inspector = await screen.findByRole("complementary", { name: "Skill 详情" });
  expect(within(inspector).getByText("应用可见性")).toBeVisible();
  expect(within(inspector).getByText("数据源")).toBeVisible();
  expect(within(inspector).getByText(snapshot.skills[0].path)).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- App.test.tsx -t "keeps visibility and source details"`

Expected: FAIL until Task 1 adds the named complementary region.

- [ ] **Step 3: Implement the approved hierarchy**

Group the inspector title, visibility list, source path, and destructive action as bordered cards without changing callbacks. Increase navigation, filter, button, list-row, description, path, and settings typography to the approved scale. Keep the current Skill name, description, application visibility, and path content from live snapshot data. Apply 140ms transitions only to hover, focus, selection, and switch color changes.

- [ ] **Step 4: Run focused behavior tests**

Run: `pnpm test -- App.test.tsx -t "searches and filters|keeps disk-derived toggle state|keeps visibility and source details"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css src/components/Sidebar.tsx src/components/SkillLibrary.tsx src/components/SkillInspector.tsx src/App.test.tsx
git commit -m "feat: apply approved Skill Switch visual hierarchy"
```

### Task 3: Verify visual migration without functional regression

**Files:**
- Modify: `src/styles.css` only if verification finds a token or layout defect.
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: Completed visual shell and existing mocked application behavior.
- Produces: A buildable desktop UI that fits 1120 x 720 and retains the full test suite.

- [ ] **Step 1: Run the complete frontend verification suite**

Run: `pnpm test && pnpm typecheck && pnpm build`

Expected: all Vitest tests pass, TypeScript exits 0, and Vite outputs a production bundle.

- [ ] **Step 2: Build the Tauri desktop application**

Run: `pnpm tauri build --debug`

Expected: the macOS debug application bundle is produced without Rust or frontend errors.

- [ ] **Step 3: Perform the 1120 x 720 visual acceptance check**

Run: `pnpm tauri dev`

Expected: at the default window size, navigation, list, and 280px inspector are visible simultaneously; no inspector overlap, horizontal scrolling, or text below 12px is visible.

- [ ] **Step 4: Commit any verification-only correction**

```bash
git add src/styles.css src/App.test.tsx
git commit -m "fix: verify Skill Switch desktop refinement"
```

