import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import pino from "pino";
import { AgentManager } from "./agent-manager.js";
import { AgentStorage } from "./agent-storage.js";
import { createTestAgentClient } from "../test-utils/fake-agent-client.js";
import type { GenerateBranchNameFromFirstAgentContextOptions } from "../worktree-branch-name-generator.js";
import { attachAgentAutoTitle } from "./agent-auto-title.js";

const logger = pino({ level: "silent" });
test("titles a blank conversation after its first turn using the current metadata model, and protects a concurrent rename", async () => {
  const dir = mkdtempSync(join(tmpdir(), "paseo-auto-title-"));
  const storage = new AgentStorage(join(dir, "agents"), logger);
  const manager = new AgentManager({
    registry: storage,
    logger,
    clients: { codex: createTestAgentClient("codex") },
  });
  const generate = vi.fn(async (_options: GenerateBranchNameFromFirstAgentContextOptions) => ({
    title: "检查预览页测试问题",
    branch: "unused",
  }));
  let model = "chosen-model";
  const dispose = attachAgentAutoTitle({
    agentManager: manager,
    agentStorage: storage,
    logger,
    readDaemonConfig: () => ({ metadataGeneration: { providers: [{ provider: "codex", model }] } }),
    generate,
  });
  const agent = await manager.createAgent({ provider: "codex", cwd: dir }, undefined, {
    workspaceId: "existing-workspace",
  });
  try {
    for await (const _event of manager.streamAgent(agent.id, "https://example.test/ 看看测试问题", {
      clientMessageId: "first",
    })) {
      /* drain */
    }
    await vi.waitFor(async () =>
      expect((await storage.get(agent.id))?.title).toBe("检查预览页测试问题"),
    );
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0]?.[0]).toMatchObject({
      daemonConfig: {
        metadataGeneration: { providers: [{ provider: "codex", model: "chosen-model" }] },
      },
    });
    for await (const _event of manager.streamAgent(agent.id, "继续")) {
      /* drain */
    }
    expect(generate).toHaveBeenCalledTimes(1);
    model = "new-selection";
    const other = await manager.createAgent({ provider: "codex", cwd: dir }, undefined, {
      workspaceId: "existing-workspace",
    });
    generate.mockImplementationOnce(async () => {
      await manager.setTitle(other.id, "我的手动标题");
      return { title: "不可覆盖", branch: "unused" };
    });
    for await (const _event of manager.streamAgent(other.id, "另一个任务", {
      clientMessageId: "other-first",
    })) {
      /* drain */
    }
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(2));
    await vi.waitFor(async () => expect((await storage.get(other.id))?.title).toBe("我的手动标题"));
    expect(generate.mock.calls[1]?.[0]).toMatchObject({
      daemonConfig: {
        metadataGeneration: { providers: [{ provider: "codex", model: "new-selection" }] },
      },
    });
    await manager.closeAgent(other.id);
  } finally {
    dispose();
    await manager.closeAgent(agent.id);
    await storage.flush();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("skips explicit titles and retries provisional titles after a generation failure", async () => {
  const dir = mkdtempSync(join(tmpdir(), "paseo-auto-title-"));
  const storage = new AgentStorage(join(dir, "agents"), logger);
  const manager = new AgentManager({
    registry: storage,
    logger,
    clients: { codex: createTestAgentClient("codex") },
  });
  const generate = vi
    .fn<
      typeof import("../worktree-branch-name-generator.js").generateBranchNameFromFirstAgentContext
    >()
    .mockResolvedValueOnce(null)
    .mockResolvedValue({ title: "生成后的标题", branch: "unused" });
  const dispose = attachAgentAutoTitle({
    agentManager: manager,
    agentStorage: storage,
    logger,
    readDaemonConfig: () => ({}),
    generate,
  });
  try {
    const manual = await manager.createAgent(
      { provider: "codex", cwd: dir, title: "手动指定" },
      undefined,
      { workspaceId: "test-workspace" },
    );
    for await (const _ of manager.streamAgent(manual.id, "任务", {
      clientMessageId: "manual-first",
    })) {
    }
    const agent = await manager.createAgent(
      { provider: "codex", cwd: dir, title: "任务" },
      undefined,
      { workspaceId: "test-workspace" },
    );
    for await (const _ of manager.streamAgent(agent.id, "任务", { clientMessageId: "first" })) {
    }
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    expect((await storage.get(agent.id))?.title).toBe("任务");
    for await (const _ of manager.streamAgent(agent.id, "继续", { clientMessageId: "second" })) {
    }
    await vi.waitFor(async () => expect((await storage.get(agent.id))?.title).toBe("生成后的标题"));
    expect(generate).toHaveBeenCalledTimes(2);
    expect((await storage.get(manual.id))?.title).toBe("手动指定");
  } finally {
    dispose();
    for (const agent of manager.listAgents({ includeInternal: true }))
      await manager.closeAgent(agent.id);
    await storage.flush();
    rmSync(dir, { recursive: true, force: true });
  }
});
