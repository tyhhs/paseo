import type { Logger } from "pino";
import type { AgentManager } from "./agent-manager.js";
import type { AgentStorage } from "./agent-storage.js";
import type { ProviderSnapshotManager } from "./provider-snapshot-manager.js";
import type { StructuredGenerationDaemonConfig } from "./structured-generation-providers.js";
import { resolveCreateAgentTitles } from "./create-agent-title.js";
import { generateBranchNameFromFirstAgentContext } from "../worktree-branch-name-generator.js";

export function attachAgentAutoTitle(options: {
  agentManager: AgentManager;
  agentStorage: AgentStorage;
  providerSnapshotManager?: Pick<ProviderSnapshotManager, "listProviders">;
  readDaemonConfig: () => StructuredGenerationDaemonConfig;
  logger: Logger;
  generate?: typeof generateBranchNameFromFirstAgentContext;
}): () => void {
  const { agentManager, agentStorage, logger } = options;
  const pending = new Set<string>();
  const completed = new Set<string>();
  let stopped = false;
  const generate = options.generate ?? generateBranchNameFromFirstAgentContext;
  const name = async (agentId: string) => {
    const stored = await agentStorage.get(agentId);
    if (!stored || stored.internal || stored.archivedAt) return;
    const first = (await agentManager.getTimelineRows(agentId)).find(
      (row) => row.item.type === "user_message",
    );
    if (first?.item.type !== "user_message") return;
    const { provisionalTitle } = resolveCreateAgentTitles({ initialPrompt: first.item.text });
    if (!provisionalTitle || (stored.title && stored.title !== provisionalTitle)) return;
    const result = await generate({
      agentManager,
      cwd: stored.cwd,
      providerSnapshotManager: options.providerSnapshotManager,
      daemonConfig: options.readDaemonConfig(),
      currentSelection: {
        provider: stored.provider,
        model: stored.config?.model,
        thinkingOptionId: stored.config?.thinkingOptionId,
      },
      firstAgentContext: { prompt: first.item.text },
      logger: logger.child({ module: "agent-auto-title", agentId }),
    });
    if (stopped || !result?.title || !agentManager.getAgent(agentId)) return;
    await agentManager.setTitle(agentId, result.title, { expectedTitle: stored.title ?? null });
    completed.add(agentId);
    logger.info({ agentId }, "Conversation automatic title generation completed");
  };
  const unsubscribe = agentManager.subscribe(
    (event) => {
      if (event.type !== "agent_stream" || event.event.type !== "turn_completed") return;
      const agentId = event.agentId;
      if (stopped || pending.has(agentId) || completed.has(agentId)) return;
      pending.add(agentId);
      void name(agentId)
        .catch((err) =>
          logger.warn({ err, agentId }, "Conversation automatic title generation failed"),
        )
        .finally(() => pending.delete(agentId));
    },
    { replayState: false },
  );
  return () => {
    stopped = true;
    unsubscribe();
  };
}
