import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";
import type { ScanSnapshot, SettingsSnapshot } from "./types";

const mocks = vi.hoisted(() => ({
  scanSkills: vi.fn(),
  scanImportCandidates: vi.fn(),
  setSkillVisibility: vi.fn(),
  importSkills: vi.fn(),
  resolveImportConflict: vi.fn(),
  uninstallSkill: vi.fn(),
  listBackups: vi.fn(),
  restoreBackup: vi.fn(),
  getSettings: vi.fn(),
  updateAppPath: vi.fn(),
  updateUiPreferences: vi.fn(),
}));

vi.mock("./api", () => ({ api: mocks }));

const snapshot: ScanSnapshot = {
  ssotPath: "/Users/test/.agents/skills",
  scannedAtMs: 1,
  warnings: [],
  skills: [
    {
      name: "detail-koala-ui",
      description: "Koala UI 组件规范",
      path: "/Users/test/.agents/skills/detail-koala-ui",
      modifiedAtMs: 1,
      sizeBytes: 2300,
      visibility: [
        { app: "claude", enabled: true, mode: "linked" },
        { app: "gemini", enabled: false, mode: "disabled" },
        { app: "openCode", enabled: true, mode: "linked" },
        { app: "hermes", enabled: false, mode: "disabled" },
        { app: "codex", enabled: true, mode: "auto" },
        { app: "cursor", enabled: true, mode: "auto" },
      ],
    },
    {
      name: "unit-test-skill",
      description: "单元测试规范",
      path: "/Users/test/.agents/skills/unit-test-skill",
      modifiedAtMs: 2,
      sizeBytes: 100,
      visibility: [
        { app: "claude", enabled: false, mode: "disabled" },
        { app: "gemini", enabled: false, mode: "disabled" },
        { app: "openCode", enabled: false, mode: "disabled" },
        { app: "hermes", enabled: false, mode: "disabled" },
        { app: "codex", enabled: true, mode: "auto" },
        { app: "cursor", enabled: true, mode: "auto" },
      ],
    },
  ],
};

const settings: SettingsSnapshot = {
  settings: { schemaVersion: 1, appPaths: {}, lastSection: "library", skillFilter: "all" },
  paths: {
    claude: "/Users/test/.claude/skills",
    gemini: "/Users/test/.gemini/skills",
    openCode: "/Users/test/.config/opencode/skills",
    hermes: "/Users/test/.hermes/skills",
    codex: "/Users/test/.agents/skills",
    cursor: "/Users/test/.agents/skills",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.scanSkills.mockResolvedValue(structuredClone(snapshot));
  mocks.getSettings.mockResolvedValue(settings);
  mocks.scanImportCandidates.mockResolvedValue([]);
  mocks.listBackups.mockResolvedValue([]);
  mocks.updateUiPreferences.mockResolvedValue(settings);
});

afterEach(cleanup);

it("selects the first Skill and renders fixed native visibility", async () => {
  render(<App />);
  expect(await screen.findByRole("heading", { name: "detail-koala-ui" })).toBeVisible();
  expect(screen.getAllByText("Koala UI 组件规范")).toHaveLength(2);
  expect(screen.getAllByText("自动可见")).toHaveLength(2);
  expect(screen.queryByRole("switch", { name: "Codex" })).not.toBeInTheDocument();
});

it("searches and filters the live snapshot", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "detail-koala-ui" });
  await user.type(screen.getByRole("textbox", { name: "搜索 Skills" }), "unit-test");
  const listbox = screen.getByRole("listbox", { name: "已安装 Skills" });
  expect(within(listbox).getByText("unit-test-skill")).toBeVisible();
  expect(within(listbox).queryByText("detail-koala-ui")).not.toBeInTheDocument();
});

it("keeps disk-derived toggle state and shows backend errors", async () => {
  const user = userEvent.setup();
  mocks.setSkillVisibility.mockRejectedValue({ code: "symlinkFailed", message: "权限不足" });
  render(<App />);
  const claude = await screen.findByRole("switch", { name: "Claude" });
  expect(claude).toBeChecked();
  await user.click(claude);
  expect(await screen.findByRole("alert")).toHaveTextContent("权限不足");
  await waitFor(() => expect(screen.getByRole("switch", { name: "Claude" })).toBeChecked());
});

it("opens known-directory import without repository discovery", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /本地导入/ }));
  expect(await screen.findByRole("heading", { name: "本地导入" })).toBeVisible();
  expect(screen.getByText("仅扫描 Claude、Gemini、OpenCode 和 Hermes")).toBeVisible();
  expect(mocks.scanImportCandidates).toHaveBeenCalled();
});

it("requires an explicit decision for different-content imports", async () => {
  const user = userEvent.setup();
  mocks.scanImportCandidates.mockResolvedValue([{
    app: "gemini",
    name: "conflicted-skill",
    sourcePath: "/Users/test/.gemini/skills/conflicted-skill",
    sourceModifiedAtMs: 2,
    status: "conflict",
    sourceHash: "source",
    ssotHash: "ssot",
    differences: ["内容不同：SKILL.md"],
  }]);
  mocks.importSkills.mockResolvedValue([{
    request: { app: "gemini", name: "conflicted-skill", decision: "useSource" },
    result: {
      app: "gemini",
      name: "conflicted-skill",
      outcome: "replacedSsot",
      backup: { id: "conflicted-skill/1", skillName: "conflicted-skill", createdAtMs: 1, operation: "replace", path: "/backup" },
    },
  }]);
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /本地导入/ }));
  expect(await screen.findByText("内容不同：SKILL.md")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "使用导入版本" }));
  await waitFor(() => expect(mocks.importSkills).toHaveBeenCalledWith([
    { app: "gemini", name: "conflicted-skill", decision: "useSource" },
  ]));
});

it("lists and restores verified backups", async () => {
  const user = userEvent.setup();
  const backup = { id: "alpha/1", skillName: "alpha", createdAtMs: 1, operation: "uninstall" as const, path: "/backup/alpha/1" };
  mocks.listBackups.mockResolvedValue([backup]);
  mocks.restoreBackup.mockResolvedValue(snapshot);
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /备份/ }));
  expect(await screen.findByText("alpha")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "恢复" }));
  expect(await screen.findByRole("status")).toHaveTextContent("alpha 已恢复");
  expect(mocks.restoreBackup).toHaveBeenCalledWith("alpha/1");
});

it("saves editable managed-app paths while native paths remain fixed", async () => {
  const user = userEvent.setup();
  mocks.updateAppPath.mockResolvedValue({
    ...settings,
    paths: { ...settings.paths, claude: "/custom/claude" },
  });
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /设置/ }));
  const input = await screen.findByDisplayValue("/Users/test/.claude/skills");
  await user.clear(input);
  await user.type(input, "/custom/claude");
  const claudeRow = input.closest("label")!;
  await user.click(within(claudeRow).getByRole("button", { name: "保存" }));
  await waitFor(() => expect(mocks.updateAppPath).toHaveBeenCalledWith("claude", "/custom/claude"));
  expect(screen.getAllByText("/Users/test/.agents/skills")).toHaveLength(2);
});

it("surfaces a corrupted configuration warning", async () => {
  mocks.getSettings.mockResolvedValue({
    ...settings,
    warning: { code: "configCorrupted", message: "配置文件损坏，已加载默认设置" },
  });
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("配置文件损坏，已加载默认设置");
});

it("shows the actual conflicting application path", async () => {
  const conflictSnapshot = structuredClone(snapshot);
  conflictSnapshot.skills[0].visibility[0] = {
    app: "claude",
    enabled: false,
    mode: "conflict",
    path: "/Users/test/.claude/skills/detail-koala-ui",
  };
  mocks.scanSkills.mockResolvedValue(conflictSnapshot);
  render(<App />);
  expect(await screen.findByText("/Users/test/.claude/skills/detail-koala-ui")).toBeVisible();
});

it("states backup location and retention in uninstall confirmation", async () => {
  const user = userEvent.setup();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /移至备份并卸载/ }));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining("~/.skill-switch/backups/"));
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining("最多保留 5 份"));
  confirm.mockRestore();
});

it("shows candidate modification time in the import comparison", async () => {
  const user = userEvent.setup();
  mocks.scanImportCandidates.mockResolvedValue([{
    app: "gemini",
    name: "conflicted-skill",
    sourcePath: "/Users/test/.gemini/skills/conflicted-skill",
    sourceModifiedAtMs: 1_700_000_000_000,
    status: "conflict",
    sourceHash: "source",
    ssotHash: "ssot",
    differences: ["内容不同：SKILL.md"],
  }]);
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /本地导入/ }));
  expect(await screen.findByText(/修改时间：/)).toBeVisible();
});
