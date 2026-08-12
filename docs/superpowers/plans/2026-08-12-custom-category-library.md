# Custom Category Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist reusable custom Skill categories and manage them safely from Settings.

**Architecture:** Add a normalized `custom_categories` list beside the existing per-Skill override map. Backend commands own mutation and return fresh settings or scan snapshots; the inspector consumes the list for its select, while Settings manages rename/delete.

**Tech Stack:** Rust, Tauri commands, React, TypeScript, Vitest.

## Global Constraints

- Preserve source-defined categories and existing manual category overrides.
- Use `~/.skill-switch/settings.json` through the existing atomic settings store.
- Do not add dependencies.
- Delete must move all referencing Skills to `未分类` only after explicit UI confirmation.

---

### Task 1: Persist and mutate custom category definitions

**Files:**
- Modify: `src-tauri/src/models.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: Rust module tests in `src-tauri/src/commands.rs`

**Interfaces:**
- Produces `create_custom_category(name) -> SettingsSnapshot`, `rename_custom_category(previous_name, next_name) -> ScanSnapshot`, and `delete_custom_category(name) -> ScanSnapshot`.

- [ ] **Step 1: Write failing Rust tests**

```rust
assert_eq!(settings.custom_categories, vec!["瓜子FE"]);
assert_eq!(snapshot.skills[0].category, "瓜子FE");
assert_eq!(snapshot.skills[0].category, UNCATEGORIZED);
```

- [ ] **Step 2: Run the targeted test**

Run: `cargo test --manifest-path src-tauri/Cargo.toml custom_category`

Expected: FAIL until commands and persistence exist.

- [ ] **Step 3: Add normalized storage and Tauri commands**

```rust
#[serde(default)]
pub custom_categories: Vec<String>,
```

Normalize with trimmed, non-empty, unique values. Reject attempts to create names equal to built-in categories. On rename, change every matching `skill_categories` value; on delete, remove every matching map entry.

- [ ] **Step 4: Run Rust tests and clippy**

Run: `cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`

Expected: PASS.

### Task 2: Reuse categories in the Skill inspector

**Files:**
- Modify: `src/types.ts`
- Modify: `src/api.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/SkillInspector.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes `Settings.customCategories` and `api.createCustomCategory(name)`.
- Produces a select with source categories, reusable custom categories, and a `新建分类…` entry.

- [ ] **Step 1: Write the failing frontend test**

```ts
await user.type(screen.getByRole("textbox", { name: "新建分类" }), "瓜子FE");
await user.click(screen.getByRole("button", { name: "保存" }));
expect(within(otherSkillSelector).getByRole("option", { name: "瓜子FE" })).toBeInTheDocument();
```

- [ ] **Step 2: Run the targeted test**

Run: `PATH=/Users/zhangshuo12/.nvm/versions/node/v20.20.0/bin:$PATH pnpm vitest run src/App.test.tsx`

Expected: FAIL until the new API and select grouping exist.

- [ ] **Step 3: Wire creation and grouped selection**

Keep source categories and custom categories visually separate with disabled group labels. After successful creation, refresh settings and assign the new category to the current Skill.

- [ ] **Step 4: Run frontend tests and typecheck**

Run: `PATH=/Users/zhangshuo12/.nvm/versions/node/v20.20.0/bin:$PATH pnpm test && PATH=/Users/zhangshuo12/.nvm/versions/node/v20.20.0/bin:$PATH pnpm typecheck`

Expected: PASS.

### Task 3: Manage custom categories from Settings

**Files:**
- Modify: `src/components/SettingsPage.tsx`
- Modify: `src/styles.css`
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes rename/delete callbacks and the current scan snapshot for reference counts.
- Produces a Settings custom-category list with rename, delete, and delete confirmation.

- [ ] **Step 1: Write failing frontend tests**

```ts
expect(screen.getByText("瓜子FE · 使用于 2 个 Skill")).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: "删除 瓜子FE" }));
await user.click(screen.getByRole("button", { name: "确认移至未分类" }));
expect(mocks.deleteCustomCategory).toHaveBeenCalledWith("瓜子FE");
```

- [ ] **Step 2: Implement Settings management**

Disable rename/delete while busy. Show a confirmation only when reference count is non-zero; deletion text must state the affected Skills will become `未分类`.

- [ ] **Step 3: Run full verification**

Run: `PATH=/Users/zhangshuo12/.nvm/versions/node/v20.20.0/bin:$PATH pnpm test && PATH=/Users/zhangshuo12/.nvm/versions/node/v20.20.0/bin:$PATH pnpm typecheck && PATH=/Users/zhangshuo12/.nvm/versions/node/v20.20.0/bin:$PATH pnpm build && cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings && git diff --check`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src src-tauri docs/superpowers
git commit -m "feat: manage reusable custom categories"
```
