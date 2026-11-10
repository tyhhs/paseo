import { navigateToAgent } from "@/utils/navigate-to-agent";
import { useSidebarViewStore } from "@/stores/sidebar-view-store";
import { useHomeOverview } from "./use-home-overview";
import { ActiveSessionSidebarView } from "./sidebar-view";
const openSession = (serverId: string, agentId: string) => {
  useSidebarViewStore.getState().selectHostFilter(serverId);
  navigateToAgent({ serverId, agentId });
};
export function ActiveSessionSidebar({
  compact = false,
  onBeforeNavigate,
}: {
  compact?: boolean;
  onBeforeNavigate?: () => void;
}) {
  const overview = useHomeOverview();
  return (
    <ActiveSessionSidebarView
      compact={compact}
      onBeforeNavigate={onBeforeNavigate}
      sessions={overview.sessions}
      loading={overview.isInitialLoad}
      openSession={openSession}
    />
  );
}
