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
  deleteBackup: vi.fn(),
  getSettings: vi.fn(),
  updateAppPath: vi.fn(),
  setAppSupport: vi.fn(),
  updateUiPreferences: vi.fn(),
  openSkillWith: vi.fn(),
  openBackupWith: vi.fn(),
  setSkillCategory: vi.fn(),
  createCustomCategory: vi.fn(),
  renameCustomCategory: vi.fn(),
  deleteCustomCategory: vi.fn(),
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
      category: "未分类",
      categorySource: "auto",
      visibility: [
        { app: "claude", enabled: true, mode: "linked" },
        { app: "gemini", enabled: false, mode: "disabled" },
        { app: "openCode", enabled: true, mode: "linked" },
        { app: "hermes", enabled: false, mode: "disabled" },
        { app: "codex", enabled: true, mode: "auto" },
        { app: "cursor", enabled: true, mode: "auto" },
        { app: "zcode", enabled: true, mode: "auto" },
      ],
    },
    {
      name: "using-superpowers",
      description: "Harness the superpowers skill framework",
      path: "/Users/test/.agents/skills/using-superpowers",
      modifiedAtMs: 2,
      sizeBytes: 200,
      category: "superpowers",
      categorySource: "auto",
      visibility: [
        { app: "claude", enabled: false, mode: "disabled" },
        { app: "gemini", enabled: false, mode: "disabled" },
        { app: "openCode", enabled: false, mode: "disabled" },
        { app: "hermes", enabled: false, mode: "disabled" },
        { app: "codex", enabled: true, mode: "auto" },
        { app: "cursor", enabled: true, mode: "auto" },
        { app: "zcode", enabled: true, mode: "auto" },
      ],
    },
    {
      name: "unit-test-skill",
      description: "单元测试规范",
      path: "/Users/test/.agents/skills/unit-test-skill",
      modifiedAtMs: 3,
      sizeBytes: 100,
      category: "未分类",
      categorySource: "auto",
      visibility: [
        { app: "claude", enabled: false, mode: "disabled" },
        { app: "gemini", enabled: false, mode: "disabled" },
        { app: "openCode", enabled: false, mode: "disabled" },
        { app: "hermes", enabled: false, mode: "disabled" },
        { app: "codex", enabled: true, mode: "auto" },
        { app: "cursor", enabled: true, mode: "auto" },
        { app: "zcode", enabled: true, mode: "auto" },
      ],
    },
    {
      name: "implement",
      description: "Build the work described by a spec",
      path: "/Users/test/.agents/skills/implement",
      modifiedAtMs: 4,
      sizeBytes: 300,
      category: "Matt Pocock",
      categorySource: "auto",
      visibility: [
        { app: "claude", enabled: true, mode: "linked" },
        { app: "gemini", enabled: false, mode: "disabled" },
        { app: "openCode", enabled: false, mode: "disabled" },
        { app: "hermes", enabled: false, mode: "disabled" },
        { app: "codex", enabled: true, mode: "auto" },
        { app: "cursor", enabled: true, mode: "auto" },
        { app: "zcode", enabled: true, mode: "auto" },
      ],
    },
  ],
};

const settings: SettingsSnapshot = {
  settings: {
    schemaVersion: 1,
    appPaths: {},
    appSupport: { claude: true, gemini: true, openCode: true, hermes: true, codex: true, cursor: true, zcode: true },
    lastSection: "library",
    libraryView: "list",
    skillCategories: {},
    customCategories: [],
  },
  paths: {
    claude: "/Users/test/.claude/skills",
    gemini: "/Users/test/.gemini/skills",
    openCode: "/Users/test/.config/opencode/skills",
    hermes: "/Users/test/.hermes/skills",
    codex: "/Users/test/.agents/skills",
    cursor: "/Users/test/.agents/skills",
    zcode: "/Users/test/.agents/skills",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.scanSkills.mockResolvedValue(structuredClone(snapshot));
  mocks.getSettings.mockResolvedValue(settings);
  mocks.scanImportCandidates.mockResolvedValue([]);
  mocks.listBackups.mockResolvedValue([]);
  mocks.updateUiPreferences.mockResolvedValue(settings);
  mocks.setAppSupport.mockResolvedValue(settings);
});

afterEach(cleanup);

it("renders the Switch Loop brand mark in the sidebar", async () => {
  render(<App />);
  expect(await screen.findByText("Skill Switch")).toBeVisible();

  const mark = document.querySelector<SVGSVGElement>(".brand-mark-icon");
  expect(mark).toHaveAttribute("viewBox", "0 0 24 24");
  expect(mark?.querySelectorAll("path")).toHaveLength(2);
  expect(mark?.querySelector("circle")).toBeInTheDocument();
});

it("renders the card view with enabled application icons", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("option", { name: "detail-koala-ui" });

  await user.click(screen.getByRole("button", { name: "卡片" }));

  expect(document.querySelectorAll(".skill-grid .skill-card")).toHaveLength(4);
  expect(screen.getAllByTitle("Zcode")).toHaveLength(4);
});

it("opens the inspector from a selected Skill and renders fixed native visibility", async () => {
  const user = userEvent.setup();
  render(<App />);
  expect(await screen.findByRole("option", { name: "detail-koala-ui" })).toBeVisible();
  expect(screen.queryByRole("dialog", { name: "Skill 详情" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("option", { name: "detail-koala-ui" }));
  expect(await screen.findByRole("heading", { name: "detail-koala-ui" })).toBeVisible();
  expect(screen.getAllByText("Koala UI 组件规范")).toHaveLength(2);
  expect(screen.getAllByText("自动可见")).toHaveLength(3);
  expect(screen.queryByRole("switch", { name: "Codex" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "关闭详情遮罩" }));
  expect(screen.queryByRole("dialog", { name: "Skill 详情" })).not.toBeInTheDocument();
});

it("shows Codex and Cursor in the app filter list", async () => {
  render(<App />);
  expect(await screen.findByRole("button", { name: "Codex" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Cursor" })).toBeVisible();
});

it("updates supported apps and hides a disabled app from navigation", async () => {
  const user = userEvent.setup();
  mocks.setAppSupport.mockResolvedValue({
    ...settings,
    settings: { ...settings.settings, appSupport: { ...settings.settings.appSupport, claude: false } },
  });
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /设置/ }));
  await user.click(screen.getByRole("switch", { name: "Claude" }));
  await waitFor(() => expect(mocks.setAppSupport).toHaveBeenCalledWith("claude", false));
  expect(screen.queryByRole("button", { name: "Claude" })).not.toBeInTheDocument();
});

it("collapses and expands every category with a single toggle", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("option", { name: "detail-koala-ui" });
  const toggleAll = screen.getByRole("button", { name: "全部收起" });
  await user.click(toggleAll);
  expect(screen.queryByRole("option", { name: "detail-koala-ui" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "全部展开" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "全部展开" }));
  expect(screen.getByRole("option", { name: "detail-koala-ui" })).toBeVisible();
});

it("supports keyboard selection in the skill collection", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("option", { name: "detail-koala-ui" });
  const first = screen.getByRole("option", { name: "detail-koala-ui" });
  await user.click(first);
  await waitFor(() => expect(screen.getByRole("dialog", { name: "Skill 详情" })).toBeVisible());
  await user.keyboard("{ArrowDown}");
  await waitFor(() => expect(screen.getByRole("heading", { name: "using-superpowers" })).toBeVisible());
  await user.keyboard("{ArrowDown}");
  expect(await screen.findByRole("heading", { name: "unit-test-skill" })).toBeVisible();
  expect(screen.getByRole("option", { name: "unit-test-skill" })).toHaveFocus();
});

it("searches and filters the live snapshot", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("option", { name: "detail-koala-ui" });
  await user.type(screen.getByRole("textbox", { name: "搜索 Skills" }), "unit-test");
  const listbox = screen.getByRole("listbox", { name: "已安装 Skills" });
  expect(within(listbox).getByText("unit-test-skill")).toBeVisible();
  expect(within(listbox).queryByText("detail-koala-ui")).not.toBeInTheDocument();
});

it("keeps disk-derived toggle state and shows backend errors", async () => {
  const user = userEvent.setup();
  mocks.setSkillVisibility.mockRejectedValue({ code: "symlinkFailed", message: "权限不足" });
  render(<App />);
  await user.click(await screen.findByRole("option", { name: "detail-koala-ui" }));
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
  expect(screen.getByText("仅扫描 Claude、Gemini、OpenCode、Hermes")).toBeVisible();
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

it("explains conflicting import decisions inline", async () => {
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
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /本地导入/ }));
  await user.click(await screen.findByLabelText("查看选项区别"));
  const helpPanel = screen.getByText("两个选项的区别").closest(".decision-help-panel") as HTMLElement;
  expect(helpPanel).toBeVisible();
  expect(within(helpPanel).getByText("保留统一版本")).toBeVisible();
  expect(within(helpPanel).getByText(/当前版本，把来源目录替换成软链接/)).toBeVisible();
  expect(within(helpPanel).getByText(/用来源目录版本覆盖统一库/)).toBeVisible();
  expect(within(helpPanel).getByText("两者都会保留可恢复备份。")).toBeVisible();
});

it("lists and restores verified backups", async () => {
  const user = userEvent.setup();
  const backup = { id: "alpha/1", skillName: "alpha", createdAtMs: 1, operation: "uninstall" as const, path: "/backup/alpha/1", reason: "已被替代" };
  mocks.listBackups.mockResolvedValue([backup]);
  mocks.restoreBackup.mockResolvedValue(snapshot);
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /备份/ }));
  expect(await screen.findByText("alpha")).toBeVisible();
  expect(screen.getByText("原因：已被替代")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "恢复" }));
  expect(await screen.findByRole("status")).toHaveTextContent("alpha 已恢复");
  expect(mocks.restoreBackup).toHaveBeenCalledWith("alpha/1");
});

it("permanently deletes a backup snapshot", async () => {
  const user = userEvent.setup();
  const backup = { id: "alpha/1", skillName: "alpha", createdAtMs: 1, operation: "uninstall" as const, path: "/backup/alpha/1" };
  mocks.listBackups.mockResolvedValue([backup]);
  mocks.deleteBackup.mockResolvedValue([]);
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /备份/ }));
  await user.click(await screen.findByRole("button", { name: "彻底删除" }));
  await waitFor(() => expect(mocks.deleteBackup).toHaveBeenCalledWith("alpha/1"));
  expect(await screen.findByRole("status")).toHaveTextContent("彻底删除");
  expect(screen.queryByText("alpha")).not.toBeInTheDocument();
});

it("opens a backup snapshot with an external app", async () => {
  const user = userEvent.setup();
  const backup = { id: "alpha/1", skillName: "alpha", createdAtMs: 1, operation: "uninstall" as const, path: "/backup/alpha/1" };
  mocks.listBackups.mockResolvedValue([backup]);
  mocks.openBackupWith.mockResolvedValue(undefined);
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /备份/ }));
  await user.click(await screen.findByRole("button", { name: "打开 alpha 方式" }));
  await user.click(await screen.findByRole("menuitem", { name: "用 访达 打开" }));
  await waitFor(() => expect(mocks.openBackupWith).toHaveBeenCalledWith("alpha/1", "finder"));
});

it("groups skills by category by default and can toggle off", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("option", { name: "using-superpowers" });
  const headers = document.querySelectorAll(".skill-group-header");
  const headerNames = Array.from(headers).map((el) => el.textContent || "");
  expect(headerNames.some((t) => t.includes("superpowers"))).toBe(true);
  expect(headerNames.some((t) => t.includes("Matt Pocock"))).toBe(true);
  expect(headerNames.some((t) => t.includes("未分类"))).toBe(true);
  await user.click(screen.getByRole("button", { name: "已分组" }));
  expect(document.querySelectorAll(".skill-group-header")).toHaveLength(0);
});

it("shows a GitHub source link without exposing automatic recognition", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole("option", { name: "implement" }));
  expect(screen.getByRole("link", { name: "github.com/mattpocock/skills/tree/main/skills" }))
    .toHaveAttribute("href", "https://github.com/mattpocock/skills/tree/main/skills");
  expect(screen.queryByText(/自动识别/)).not.toBeInTheDocument();
});

it("shows an automatically categorized skill only once in the category selector", async () => {
  const user = userEvent.setup();
  const cometSnapshot = structuredClone(snapshot);
  const skill = cometSnapshot.skills.find((item) => item.name === "implement");
  if (!skill) throw new Error("implement fixture missing");
  skill.category = "Comet";
  mocks.scanSkills.mockResolvedValue(cometSnapshot);
  render(<App />);
  await user.click(await screen.findByRole("option", { name: "implement" }));
  const selector = screen.getByRole("combobox", { name: "Skill 分类" });
  expect(within(selector).getAllByRole("option", { name: "Comet" })).toHaveLength(1);
  expect(within(selector).queryByRole("option", { name: /默认分类/ })).not.toBeInTheDocument();
});

it("assigns a category to an uncategorized skill", async () => {
  const user = userEvent.setup();
  mocks.setSkillCategory.mockResolvedValue(snapshot);
  render(<App />);
  await user.click(await screen.findByRole("option", { name: "detail-koala-ui" }));
  const selector = screen.getByRole("combobox", { name: "Skill 分类" });
  expect(selector).toHaveValue("__uncategorized__");
  expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  await user.selectOptions(selector, "Comet");
  await user.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(mocks.setSkillCategory).toHaveBeenCalledWith("detail-koala-ui", "Comet"));
});

it("restores a manual category to the default category", async () => {
  const user = userEvent.setup();
  const manualSnapshot = structuredClone(snapshot);
  const skill = manualSnapshot.skills.find((item) => item.name === "implement");
  if (!skill) throw new Error("implement fixture missing");
  skill.category = "项目专用";
  skill.categorySource = "manual";
  mocks.scanSkills.mockResolvedValue(manualSnapshot);
  mocks.setSkillCategory.mockResolvedValue(snapshot);
  render(<App />);
  await user.click(await screen.findByRole("option", { name: "implement" }));
  await user.click(screen.getByRole("button", { name: "恢复默认" }));
  await waitFor(() => expect(mocks.setSkillCategory).toHaveBeenCalledWith("implement", ""));
});

it("saves a stored custom category from the inspector", async () => {
  const user = userEvent.setup();
  mocks.getSettings.mockResolvedValue({
    ...settings,
    settings: { ...settings.settings, customCategories: ["前端"] },
  });
  mocks.setSkillCategory.mockResolvedValue(snapshot);
  render(<App />);
  await user.click(await screen.findByRole("option", { name: "detail-koala-ui" }));
  const selector = screen.getByRole("combobox", { name: "Skill 分类" });
  expect(within(selector).getByRole("option", { name: "来源分类" })).toBeDisabled();
  expect(within(selector).getByRole("option", { name: "自定义分类" })).toBeDisabled();
  await user.selectOptions(selector, "前端");
  await user.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(mocks.setSkillCategory).toHaveBeenCalledWith("detail-koala-ui", "前端"));
});

it("creates a reusable custom category from the inspector", async () => {
  const user = userEvent.setup();
  const categorizedSnapshot = structuredClone(snapshot);
  const skill = categorizedSnapshot.skills.find((item) => item.name === "detail-koala-ui");
  if (!skill) throw new Error("detail-koala-ui fixture missing");
  skill.category = "瓜子FE";
  skill.categorySource = "manual";
  mocks.createCustomCategory.mockResolvedValue({
    ...settings,
    settings: { ...settings.settings, customCategories: ["瓜子FE"] },
  });
  mocks.setSkillCategory.mockResolvedValue(categorizedSnapshot);
  render(<App />);
  await user.click(await screen.findByRole("option", { name: "detail-koala-ui" }));
  await user.selectOptions(screen.getByRole("combobox", { name: "Skill 分类" }), "__new_category__");
  await user.type(screen.getByRole("textbox", { name: "新建分类" }), "瓜子FE");
  await user.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(mocks.createCustomCategory).toHaveBeenCalledWith("瓜子FE"));
  await waitFor(() => expect(mocks.setSkillCategory).toHaveBeenCalledWith("detail-koala-ui", "瓜子FE"));
  await user.click(screen.getByRole("button", { name: "关闭详情" }));
  await user.click(screen.getByRole("option", { name: "using-superpowers" }));
  const otherSkillSelector = screen.getByRole("combobox", { name: "Skill 分类" });
  expect(within(otherSkillSelector).getByRole("option", { name: "瓜子FE" })).toBeInTheDocument();
});

it("keeps the renamed category list correct when a Settings refresh fails", async () => {
  const user = userEvent.setup();
  const categorizedSnapshot = structuredClone(snapshot);
  categorizedSnapshot.skills[0].category = "瓜子FE";
  categorizedSnapshot.skills[0].categorySource = "manual";
  categorizedSnapshot.skills[1].category = "瓜子FE";
  categorizedSnapshot.skills[1].categorySource = "manual";
  const renamedSnapshot = structuredClone(categorizedSnapshot);
  renamedSnapshot.skills[0].category = "新瓜子FE";
  renamedSnapshot.skills[1].category = "新瓜子FE";
  const categorizedSettings = {
    ...settings,
    settings: { ...settings.settings, customCategories: ["瓜子FE"] },
  };
  let settingsRequests = 0;
  mocks.scanSkills.mockResolvedValue(categorizedSnapshot);
  mocks.getSettings.mockImplementation(() => {
    settingsRequests += 1;
    return settingsRequests === 1 ? Promise.resolve(categorizedSettings) : Promise.reject({ message: "刷新失败" });
  });
  mocks.renameCustomCategory.mockResolvedValue(renamedSnapshot);
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /设置/ }));
  expect(await screen.findByText("瓜子FE")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "瓜子FE 操作" }));
  await user.click(screen.getByRole("menuitem", { name: "重命名" }));
  const input = screen.getByRole("textbox", { name: "重命名 瓜子FE" });
  await user.clear(input);
  await user.type(input, "新瓜子FE");
  await user.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(mocks.renameCustomCategory).toHaveBeenCalledWith("瓜子FE", "新瓜子FE"));
  expect(await screen.findByText("新瓜子FE")).toBeVisible();
  expect(mocks.getSettings).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("刷新失败")).not.toBeInTheDocument();
});

it("confirms moving referenced custom-category Skills to uncategorized before deletion", async () => {
  const user = userEvent.setup();
  const categorizedSnapshot = structuredClone(snapshot);
  categorizedSnapshot.skills[0].category = "瓜子FE";
  categorizedSnapshot.skills[0].categorySource = "manual";
  categorizedSnapshot.skills[1].category = "瓜子FE";
  categorizedSnapshot.skills[1].categorySource = "manual";
  const deletedSnapshot = structuredClone(categorizedSnapshot);
  deletedSnapshot.skills[0].category = "未分类";
  deletedSnapshot.skills[0].categorySource = "auto";
  deletedSnapshot.skills[1].category = "未分类";
  deletedSnapshot.skills[1].categorySource = "auto";
  const categorizedSettings = {
    ...settings,
    settings: { ...settings.settings, customCategories: ["瓜子FE"] },
  };
  let settingsRequests = 0;
  mocks.scanSkills.mockResolvedValue(categorizedSnapshot);
  mocks.getSettings.mockImplementation(() => {
    settingsRequests += 1;
    return settingsRequests === 1 ? Promise.resolve(categorizedSettings) : Promise.reject({ message: "刷新失败" });
  });
  mocks.deleteCustomCategory.mockResolvedValue(deletedSnapshot);
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /设置/ }));
  expect(await screen.findByText("瓜子FE")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "瓜子FE 操作" }));
  await user.click(screen.getByRole("menuitem", { name: "删除" }));
  const confirmation = await screen.findByRole("group", { name: "删除 瓜子FE 确认" });
  expect(within(confirmation).getByText("引用此分类的 2 个 Skill 将变为未分类。")).toBeVisible();
  await user.click(within(confirmation).getByRole("button", { name: "确认移至未分类" }));
  await waitFor(() => expect(mocks.deleteCustomCategory).toHaveBeenCalledWith("瓜子FE"));
  expect(screen.queryByText("瓜子FE")).not.toBeInTheDocument();
  expect(mocks.getSettings).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("刷新失败")).not.toBeInTheDocument();
});

it("requires confirmation before deleting while Skill usage is unknown", async () => {
  const user = userEvent.setup();
  const categorizedSettings = {
    ...settings,
    settings: { ...settings.settings, customCategories: ["瓜子FE"] },
  };
  mocks.scanSkills.mockRejectedValue({ message: "扫描失败" });
  mocks.getSettings.mockResolvedValue(categorizedSettings);
  mocks.deleteCustomCategory.mockResolvedValue(snapshot);
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /设置/ }));
  expect(await screen.findByText("瓜子FE")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "瓜子FE 操作" }));
  await user.click(screen.getByRole("menuitem", { name: "删除" }));
  const confirmation = await screen.findByRole("group", { name: "删除 瓜子FE 确认" });
  expect(within(confirmation).getByRole("button", { name: "确认移至未分类" })).toBeVisible();
  expect(mocks.deleteCustomCategory).not.toHaveBeenCalled();
});

it("deletes an unused custom category without confirmation", async () => {
  const user = userEvent.setup();
  const categorizedSettings = {
    ...settings,
    settings: { ...settings.settings, customCategories: ["闲置"] },
  };
  mocks.getSettings.mockResolvedValue(categorizedSettings);
  mocks.deleteCustomCategory.mockResolvedValue(snapshot);
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /设置/ }));
  expect(await screen.findByText("闲置")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "闲置 操作" }));
  await user.click(screen.getByRole("menuitem", { name: "删除" }));
  expect(screen.queryByRole("group", { name: /删除.*确认/ })).not.toBeInTheDocument();
  await waitFor(() => expect(mocks.deleteCustomCategory).toHaveBeenCalledWith("闲置"));
});

it("saves editable managed-app paths while native paths remain fixed", async () => {
  const user = userEvent.setup();
  mocks.updateAppPath.mockResolvedValue({
    ...settings,
    paths: { ...settings.paths, claude: "/custom/claude" },
  });
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /设置/ }));
  expect(screen.queryByDisplayValue("/Users/test/.claude/skills")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "修改 Claude 目录" }));
  const input = await screen.findByDisplayValue("/Users/test/.claude/skills");
  await user.clear(input);
  await user.type(input, "/custom/claude");
  const claudeRow = input.closest(".application-directory-row") as HTMLElement;
  await user.click(within(claudeRow).getByRole("button", { name: "保存" }));
  await waitFor(() => expect(mocks.updateAppPath).toHaveBeenCalledWith("claude", "/custom/claude"));
  expect(screen.getAllByText("/Users/test/.agents/skills")).toHaveLength(3);
});

it("creates a reusable custom category from Settings", async () => {
  const user = userEvent.setup();
  mocks.createCustomCategory.mockResolvedValue({
    ...settings,
    settings: { ...settings.settings, customCategories: ["前端"] },
  });
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /设置/ }));
  await user.click(screen.getByRole("button", { name: "新建分类" }));
  await user.type(screen.getByRole("textbox", { name: "分类名称" }), "前端");
  await user.click(screen.getByRole("button", { name: "创建" }));
  await waitFor(() => expect(mocks.createCustomCategory).toHaveBeenCalledWith("前端"));
  expect(await screen.findByText("前端")).toBeVisible();
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
  const user = userEvent.setup();
  const conflictSnapshot = structuredClone(snapshot);
  conflictSnapshot.skills[0].visibility[0] = {
    app: "claude",
    enabled: false,
    mode: "conflict",
    path: "/Users/test/.claude/skills/detail-koala-ui",
  };
  mocks.scanSkills.mockResolvedValue(conflictSnapshot);
  render(<App />);
  await user.click(await screen.findByRole("option", { name: "detail-koala-ui" }));
  expect(await screen.findByText("/Users/test/.claude/skills/detail-koala-ui")).toBeVisible();
});

it("expands an inline uninstall confirmation with optional reason", async () => {
  const user = userEvent.setup();
  mocks.uninstallSkill.mockResolvedValue({
    id: "detail-koala-ui/1",
    skillName: "detail-koala-ui",
    createdAtMs: 1,
    operation: "uninstall",
    path: "/backup",
  });
  render(<App />);
  await user.click(await screen.findByRole("option", { name: "detail-koala-ui" }));
  await user.click(await screen.findByRole("button", { name: /移至备份并卸载/ }));
  const dialog = await screen.findByRole("alertdialog", { name: "确认卸载 detail-koala-ui" });
  expect(within(dialog).getByText(/~\/\.skill-switch\/backups\//)).toBeVisible();
  expect(within(dialog).getByText(/最多保留 5 份/)).toBeVisible();
  await user.type(within(dialog).getByPlaceholderText(/选填|不再使用/), "已被替代");
  await user.click(within(dialog).getByRole("button", { name: "确认卸载" }));
  await waitFor(() => expect(mocks.uninstallSkill).toHaveBeenCalledWith("detail-koala-ui", "已被替代"));
});

it("cancels the inline uninstall confirmation", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole("option", { name: "detail-koala-ui" }));
  await user.click(await screen.findByRole("button", { name: /移至备份并卸载/ }));
  await user.click(await screen.findByRole("button", { name: "取消" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(mocks.uninstallSkill).not.toHaveBeenCalled();
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
