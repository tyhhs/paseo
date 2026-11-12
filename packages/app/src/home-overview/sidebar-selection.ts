import type { ActiveWorkspaceSelection } from "@/stores/last-workspace-selection";
import type { ConversationState } from "@/stores/conversation-layout";
import { conversationTarget } from "@/stores/conversation-layout";
import { collectAllTabs } from "@/stores/workspace-layout-actions";

export function selectedSessionKey(
  state: Pick<ConversationState, "activeConversationByWorkspace" | "conversationsByWorkspace">,
  workspace: ActiveWorkspaceSelection | null,
): string | null {
  if (!workspace) return null;
  const key = `${workspace.serverId}:${workspace.workspaceId}`;
  const id = state.activeConversationByWorkspace[key];
  const entry = id && state.conversationsByWorkspace[key]?.[id];
  if (!entry || entry.endedAt) return null;
  const root = collectAllTabs(entry.layout.root).find((tab) => tab.tabId === entry.rootTabId);
  const target = root && conversationTarget(root.target);
  if (!root || target?.kind !== "agent") return null;
  const serverId = root.target.kind === "scoped" ? root.target.serverId : workspace.serverId;
  return JSON.stringify([serverId, target.agentId]);
}
