# Skill Switch v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify the independent macOS Skill Switch v1 application defined by the approved design spec.

**Architecture:** A Tauri 2 shell exposes small Rust filesystem commands to a React UI. Rust owns the live filesystem model, atomic configuration, symlink transactions, import conflict detection, backup retention, and restore; React renders scan snapshots and never becomes a source of truth.

**Tech Stack:** Tauri 2, Rust 2021, React 19, TypeScript 5, Vite 7, Vitest, Testing Library, pnpm.

## Global Constraints

- macOS only; default window `1120 × 720`, minimum `900 × 600`.
- `~/.agents/skills/` is the only Skill content source.
- Do not read, migrate, or depend on CC Switch data, configuration, processes, or source modules.
- Claude, Gemini, OpenCode, and Hermes use per-Skill symlinks; Codex and Cursor are fixed auto-visible.
- v1 excludes repository discovery, online marketplaces, `skills.sh`, ZIP import, arbitrary-directory import, a menu-bar icon, and a Skill editor.
- Filesystem writes must validate paths, preserve user-owned destinations, and verify resulting disk state.
- Use the approved navigation / Skill list / inspector layout and follow the macOS system theme.

---

## File Map

- `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `tsconfig*.json`, `index.html`: frontend toolchain.
- `src/types.ts`: stable frontend command/result types.
- `src/api.ts`: Tauri invoke boundary.
- `src/App.tsx`: application state orchestration and page routing.
- `src/components/Sidebar.tsx`: navigation only.
- `src/components/SkillLibrary.tsx`: search, filters, list, and selection.
- `src/components/SkillInspector.tsx`: visibility actions and uninstall entry.
- `src/components/ImportPage.tsx`: scan results and conflict choices.
- `src/components/BackupPage.tsx`: backups and restore actions.
- `src/components/SettingsPage.tsx`: editable application paths.
- `src/styles.css`: Open Design-inspired semantic tokens and responsive three-column layout.
- `src-tauri/src/models.rs`: serialized domain contracts.
- `src-tauri/src/error.rs`: stable error codes and command errors.
- `src-tauri/src/paths.rs`: HOME, SSOT, config, backups, and application path resolution.
- `src-tauri/src/config_store.rs`: atomic JSON settings.
- `src-tauri/src/skill_fs.rs`: validation, scanning, description parsing, hashing, and guarded copy/remove helpers.
- `src-tauri/src/link_manager.rs`: visibility derivation and symlink transactions.
- `src-tauri/src/backup_service.rs`: snapshot, retention, listing, uninstall, and restore.
- `src-tauri/src/import_service.rs`: known-directory scan, comparison, import, and conflict resolution.
- `src-tauri/src/commands.rs`: Tauri command adapters.
- `src-tauri/src/lib.rs`, `src-tauri/src/main.rs`: application composition and macOS lifecycle.

---

### Task 1: Scaffold a buildable independent application

**Files:**
- Create: frontend and Tauri toolchain files listed above.
- Test: `src/App.test.tsx`

**Interfaces:**
- Produces: `pnpm test`, `pnpm typecheck`, `pnpm build`, and `pnpm tauri build --debug` commands.

- [ ] **Step 1: Write the failing shell assertion**

```bash
test -f package.json && test -f src-tauri/Cargo.toml && test -f src-tauri/tauri.conf.json
```

Expected before scaffolding: non-zero exit.

- [ ] **Step 2: Create the minimal Vite/Tauri configuration**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b --pretty false",
    "test": "vitest run",
    "tauri": "tauri"
  }
}
```

Set Tauri product name to `Skill Switch`, identifier to `io.skillswitch.app`, frontend URL to `http://localhost:1420`, and window constraints to the exact global values.

- [ ] **Step 3: Install locked dependencies and generate application icons**

```bash
pnpm install
pnpm tauri icon src-tauri/icons/app-icon.svg
```

Expected: lockfile and complete Tauri icon set exist.

- [ ] **Step 4: Verify the empty shell**

```bash
pnpm typecheck && pnpm test && cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml index.html tsconfig*.json vite.config.ts src src-tauri
git commit -m "build: scaffold Skill Switch app"
```

### Task 2: Implement configuration, paths, and live Skill scanning

**Files:**
- Create: `src-tauri/src/models.rs`, `error.rs`, `paths.rs`, `config_store.rs`, `skill_fs.rs`.
- Modify: `src-tauri/src/lib.rs`.
- Test: inline Rust unit tests in each module.

**Interfaces:**
- Produces: `Settings`, `AppKind`, `SkillRecord`, `ScanSnapshot`, `scan_skills(home, settings)`, `load_settings(home)`, and `save_settings(home, settings)`.

- [ ] **Step 1: Write failing tests for path resolution and scanning**

```rust
#[test]
fn scan_accepts_only_direct_children_with_skill_md() {
    let home = tempfile::tempdir().unwrap();
    make_skill(home.path(), "valid", "description: works");
    std::fs::create_dir_all(home.path().join(".agents/skills/invalid")).unwrap();
    let snapshot = scan_skills(home.path(), &Settings::default()).unwrap();
    assert_eq!(snapshot.skills.iter().map(|s| s.name.as_str()).collect::<Vec<_>>(), vec!["valid"]);
}
```

Add tests for the four default paths, `HERMES_HOME`, path overrides, invalid names, frontmatter description, corrupted config preservation, and atomic settings round-trip.

- [ ] **Step 2: Run focused Rust tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml paths config_store skill_fs
```

Expected: failures because modules/functions are absent.

- [ ] **Step 3: Implement domain contracts and pure filesystem readers**

```rust
pub fn scan_skills(home: &Path, settings: &Settings) -> Result<ScanSnapshot, CommandError>;
pub fn resolve_app_root(home: &Path, app: AppKind, settings: &Settings) -> PathBuf;
pub fn load_settings(home: &Path) -> Result<SettingsLoad, CommandError>;
pub fn save_settings(home: &Path, settings: &Settings) -> Result<(), CommandError>;
```

Use direct children only, `symlink_metadata`, safe relative names, deterministic sort order, and temp-file-plus-rename writes.

- [ ] **Step 4: Run the complete Rust test set**

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src
git commit -m "feat: scan skills from unified source"
```

### Task 3: Implement per-application visibility links

**Files:**
- Create: `src-tauri/src/link_manager.rs`.
- Modify: `models.rs`, `skill_fs.rs`.
- Test: `link_manager.rs` unit tests.

**Interfaces:**
- Consumes: `AppKind`, `Settings`, SSOT and application roots.
- Produces: `derive_visibility(home, settings, skill_name)` and `set_visibility(home, settings, skill_name, app, enabled)`.

- [ ] **Step 1: Write failing symlink safety tests**

```rust
#[test]
fn disable_never_removes_a_user_owned_directory() {
    let fixture = Fixture::new();
    fixture.make_skill("alpha");
    fixture.make_app_directory(AppKind::Claude, "alpha");
    let error = set_visibility(fixture.home(), &fixture.settings(), "alpha", AppKind::Claude, false).unwrap_err();
    assert_eq!(error.code, ErrorCode::PathConflict);
    assert!(fixture.app_skill(AppKind::Claude, "alpha").is_dir());
}
```

Cover enable, disable, idempotency, unknown symlink targets, broken symlinks, missing source, and Codex/Cursor rejection.

- [ ] **Step 2: Verify tests fail**

```bash
cargo test --manifest-path src-tauri/Cargo.toml link_manager
```

Expected: compile failure before implementation.

- [ ] **Step 3: Implement verified symlink transactions**

```rust
pub fn set_visibility(
    home: &Path,
    settings: &Settings,
    skill_name: &str,
    app: AppKind,
    enabled: bool,
) -> Result<VisibilityState, CommandError>;
```

Only unlink a symlink whose canonical target equals the selected SSOT Skill. Re-read disk state before returning.

- [ ] **Step 4: Run Rust tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src
git commit -m "feat: manage per-app skill visibility"
```

### Task 4: Implement backups, uninstall, import, conflict resolution, and restore

**Files:**
- Create: `src-tauri/src/backup_service.rs`, `import_service.rs`.
- Modify: `models.rs`, `skill_fs.rs`.
- Test: module unit tests using isolated temporary HOME directories.

**Interfaces:**
- Produces: `list_backups`, `create_backup`, `uninstall_skill`, `restore_backup`, `scan_import_candidates`, `import_candidate`, and `resolve_import_conflict`.

- [ ] **Step 1: Write failing transaction tests**

```rust
#[test]
fn sixth_verified_backup_removes_only_the_oldest_snapshot() {
    let fixture = Fixture::new();
    fixture.make_skill("alpha");
    for sequence in 0..6 { fixture.create_snapshot_at("alpha", sequence); }
    prune_backups(fixture.home(), "alpha").unwrap();
    assert_eq!(fixture.snapshot_sequences("alpha"), vec![1, 2, 3, 4, 5]);
}
```

Add tests for zero deletion on backup failure, same-content normalization, different-content conflict, per-item batch continuation, import-version backup, external symlink rejection, and visibility restoration.

- [ ] **Step 2: Verify tests fail**

```bash
cargo test --manifest-path src-tauri/Cargo.toml backup_service import_service
```

Expected: compile failure before implementation.

- [ ] **Step 3: Implement backup and import state machines**

```rust
pub fn uninstall_skill(home: &Path, settings: &Settings, name: &str) -> Result<BackupRecord, CommandError>;
pub fn restore_backup(home: &Path, settings: &Settings, backup_id: &str) -> Result<ScanSnapshot, CommandError>;
pub fn scan_import_candidates(home: &Path, settings: &Settings) -> Result<Vec<ImportCandidate>, CommandError>;
pub fn import_candidate(home: &Path, settings: &Settings, request: ImportRequest) -> Result<ImportResult, CommandError>;
```

Use content hashes over sorted relative file paths, never follow external symlinks, and retain five verified snapshots per Skill.

- [ ] **Step 4: Run Rust tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src
git commit -m "feat: add safe import and backup workflows"
```

### Task 5: Expose stable Tauri commands and macOS lifecycle

**Files:**
- Create: `src-tauri/src/commands.rs`.
- Modify: `src-tauri/src/lib.rs`, `main.rs`, `capabilities/default.json`.
- Test: command adapter tests with injected HOME.

**Interfaces:**
- Produces commands named exactly as the design spec: `scan_skills`, `scan_import_candidates`, `set_skill_visibility`, `import_skills`, `resolve_import_conflict`, `uninstall_skill`, `list_backups`, `restore_backup`, `get_settings`, and `update_app_path`.

- [ ] **Step 1: Write failing serialization tests**

```rust
#[test]
fn command_error_serializes_stable_code_and_path() {
    let error = CommandError::path_conflict("destination occupied", "/tmp/alpha");
    let json = serde_json::to_value(error).unwrap();
    assert_eq!(json["code"], "pathConflict");
    assert_eq!(json["path"], "/tmp/alpha");
}
```

- [ ] **Step 2: Implement command adapters and app lifecycle**

```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![commands::scan_skills, commands::set_skill_visibility])
    .run(tauri::generate_context!());
```

Register every declared command. On macOS, keep the process running after the last window closes and reopen the main window on Dock activation; preserve standard `Cmd+Q` termination.

- [ ] **Step 3: Run backend checks**

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Expected: all commands exit 0.

- [ ] **Step 4: Commit**

```bash
git add src-tauri
git commit -m "feat: expose Skill Switch desktop commands"
```

### Task 6: Build the approved three-column React interface

**Files:**
- Create: all `src/` files in the file map.
- Test: `src/App.test.tsx` and component test files.

**Interfaces:**
- Consumes: command contracts from `src/types.ts` and `src/api.ts`.
- Produces: library, import, backups, and settings pages.

- [ ] **Step 1: Write failing UI behavior tests**

```tsx
it("rolls back a visibility toggle when the command fails", async () => {
  api.setSkillVisibility.mockRejectedValue({ code: "symlinkFailed", message: "denied" });
  render(<App />);
  await user.click(await screen.findByRole("switch", { name: "Claude" }));
  expect(await screen.findByText("denied")).toBeVisible();
  expect(screen.getByRole("switch", { name: "Claude" })).toBeChecked();
});
```

Cover list-to-inspector selection, search, enabled filters, Codex/Cursor fixed status, loading prevention, import conflicts, backups, settings, empty/error states, and navigation.

- [ ] **Step 2: Verify UI tests fail**

```bash
pnpm test
```

Expected: missing component/module failures.

- [ ] **Step 3: Implement UI and semantic tokens**

```css
:root { color-scheme: light dark; --accent: #5e6ad2; --window-bg: #f8f9fb; --panel-bg: #ffffff; }
@media (prefers-color-scheme: dark) { :root { --window-bg: #0f1011; --panel-bg: #191a1b; } }
```

Use the approved sidebar/list/inspector hierarchy, keyboard-accessible controls, single-item loading states, and backend snapshots after every mutation.

- [ ] **Step 4: Run frontend verification**

```bash
pnpm typecheck && pnpm test && pnpm build
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add src package.json pnpm-lock.yaml
git commit -m "feat: add Skill Switch management interface"
```

### Task 7: Complete integration and macOS acceptance

**Files:**
- Modify: only files required by discovered verification failures.
- Create: `README.md` with build, test, data-source, path, and safety behavior.

**Interfaces:**
- Consumes: completed backend and frontend.
- Produces: independently buildable v1 application.

- [ ] **Step 1: Run full automated verification**

```bash
pnpm typecheck
pnpm test
pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
pnpm tauri build --debug
```

Expected: every command exits 0 and a debug macOS application bundle is produced.

- [ ] **Step 2: Run a local smoke test with an isolated HOME**

```bash
fixture_home="$(mktemp -d)"
HOME="$fixture_home" pnpm tauri dev
```

Verify first launch creates no CC Switch files, scans only `~/.agents/skills/`, renders at 1120×720, supports 900×600, refreshes on focus, and matches Finder-visible symlinks.

- [ ] **Step 3: Write operational documentation**

```markdown
## Data model
`~/.agents/skills/` is the only managed Skill content source. Application directories contain only per-Skill symbolic links created after conflict checks.
```

- [ ] **Step 4: Re-run all verification after fixes and documentation**

Run the Step 1 command block again. Expected: every command exits 0.

- [ ] **Step 5: Commit**

```bash
git add README.md package.json pnpm-lock.yaml src src-tauri
git commit -m "docs: add Skill Switch verification guide"
```
