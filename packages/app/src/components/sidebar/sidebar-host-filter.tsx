import { useCallback, useMemo } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { useHosts } from "@/runtime/host-runtime";
import {
  useActiveWorkspaceSelection,
  useLastWorkspaceSelection,
} from "@/stores/navigation-active-workspace-store";
import { resolveSidebarHostFilters, useSidebarViewStore } from "@/stores/sidebar-view-store";

const ALL_HOSTS = "@all";

/** A directory filter; never changes navigation or the pane's execution host. */
export function SidebarHostFilter() {
  const { t } = useTranslation();
  const hosts = useHosts();
  const active = useActiveWorkspaceSelection();
  const last = useLastWorkspaceSelection();
  const filters = useSidebarViewStore((state) => state.hostFilters);
  const selectHost = useSidebarViewStore((state) => state.selectHostFilter);
  const resolved = resolveSidebarHostFilters(
    filters,
    hosts.map((host) => host.serverId),
    active?.serverId ?? last?.serverId,
  );
  const select = useCallback(
    (id: string) => selectHost(id === ALL_HOSTS ? null : id),
    [selectHost],
  );
  return (
    <ScrollView
      horizontal
      style={styles.container}
      contentContainerStyle={styles.tabs}
      accessibilityRole="tablist"
      accessibilityLabel={t("sidebar.display.hostFilter.label")}
      testID="sidebar-host-filter"
    >
      <HostTab
        id={ALL_HOSTS}
        label={t("sidebar.display.hostFilter.all")}
        selected={filters.length === 0}
        onSelect={select}
      />
      {hosts.map((host) => (
        <HostTab
          key={host.serverId}
          id={host.serverId}
          label={host.label || host.serverId}
          selected={filters.length > 0 && resolved.includes(host.serverId)}
          onSelect={select}
        />
      ))}
    </ScrollView>
  );
}

function HostTab({
  id,
  label,
  selected,
  onSelect,
}: {
  id: string;
  label: string;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const choose = useCallback(() => onSelect(id), [id, onSelect]);
  const state = useMemo(() => ({ selected }), [selected]);
  const tabStyle = useCallback(
    ({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
      styles.tab,
      selected && styles.selectedTab,
      (hovered || pressed) && styles.hoveredTab,
    ],
    [selected],
  );
  const textStyle = useMemo(() => [styles.label, selected && styles.selectedLabel], [selected]);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={state}
      aria-selected={selected}
      focusable
      style={tabStyle}
      onPress={choose}
      testID={`sidebar-host-tab-${id}`}
    >
      <Text numberOfLines={1} style={textStyle}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: { flexGrow: 0, flexShrink: 0 },
  tabs: {
    paddingHorizontal: theme.spacing[2],
    paddingBottom: theme.spacing[1],
    gap: theme.spacing[1],
  },
  tab: {
    maxWidth: 160,
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[2],
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  selectedTab: { borderBottomColor: theme.colors.foreground },
  hoveredTab: { backgroundColor: theme.colors.surface1 },
  label: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.sm },
  selectedLabel: { color: theme.colors.foreground },
}));
