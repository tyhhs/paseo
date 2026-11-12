import { useFavorites } from "./favorites";
import { useActiveWorkspaceSelection } from "@/stores/navigation-active-workspace-store";
import { useWorkspaceLayoutStore } from "@/stores/workspace-layout-store";
import { selectedSessionKey } from "./sidebar-selection";
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
  const favorites = useFavorites((state) => state.document.entries);
  const favoritesError = useFavorites((state) => state.error);
  const workspace = useActiveWorkspaceSelection();
  const selectedKey = useWorkspaceLayoutStore((state) => selectedSessionKey(state, workspace));
  return (
    <ActiveSessionSidebarView
      favorites={favorites}
      favoritesError={favoritesError}
      selectedKey={selectedKey}
      compact={compact}
      onBeforeNavigate={onBeforeNavigate}
      sessions={overview.sessions}
      loading={overview.isInitialLoad}
      openSession={openSession}
    />
  );
}
