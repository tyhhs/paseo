import { expect, it } from "vitest";
import { selectedSessionKey } from "./sidebar-selection";
import {
  createTabInLayout,
  createWorkspaceLayoutWithExplorerSidebar,
} from "@/stores/workspace-layout-actions";
import type { ConversationLayout } from "@/stores/conversation-layout";
import type { WorkspaceTabTarget } from "@/workspace-tabs/model";

it("tracks the selected conversation and its root host, clearing outside the workspace", () => {
  const conversation = (id: string, target: WorkspaceTabTarget): ConversationLayout => {
    const result = createTabInLayout({
      layout: createWorkspaceLayoutWithExplorerSidebar(),
      target,
      now: 0,
      placement: { mode: "focused" },
      explorerSidebarPaneId: null,
      createTabId: () => id,
    })!;
    return { id, rootTabId: result.tabId, createdAt: 0, layout: result.layout };
  };
  const first = conversation("one", { kind: "agent", agentId: "same-id" });
  const second = conversation("two", {
    kind: "scoped",
    serverId: "remote",
    workspaceId: "other",
    target: { kind: "agent", agentId: "same-id" },
  });
  const state = {
    activeConversationByWorkspace: { "mac:work": "one" },
    conversationsByWorkspace: { "mac:work": { one: first, two: second } },
  };
  const workspace = { serverId: "mac", workspaceId: "work" };
  expect(selectedSessionKey(state, workspace)).toBe(JSON.stringify(["mac", "same-id"]));
  state.activeConversationByWorkspace["mac:work"] = "two";
  expect(selectedSessionKey(state, workspace)).toBe(JSON.stringify(["remote", "same-id"]));
  expect(selectedSessionKey(state, null)).toBeNull();
  expect(selectedSessionKey(state, { ...workspace, workspaceId: "elsewhere" })).toBeNull();
  second.endedAt = "2026-11-12";
  expect(selectedSessionKey(state, workspace)).toBeNull();
});
