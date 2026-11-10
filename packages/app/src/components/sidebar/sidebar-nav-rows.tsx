import { router, usePathname } from "expo-router";
import { CalendarClock, History, Plus, Search } from "lucide-react-native";
import { memo, useCallback, useMemo, useRef, type ComponentProps, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DensityIcon } from "@/components/ui/density-icon";
import { Shortcut } from "@/components/ui/shortcut";
import { density } from "@/styles/density";
import { StyleSheet } from "react-native-unistyles";
import { SidebarHeaderRow } from "@/components/sidebar/sidebar-header-row";
import { useShortcutKeys } from "@/hooks/use-shortcut-keys";
import { PluginSidebarItem } from "@/plugins/sidebar-items";
import { canCreateWorktreeForProjectKind } from "@/projects/host-projects";
import { useHostFeature } from "@/runtime/host-features";
import {
  builtinSidebarNavLabelKey,
  builtinSidebarNavShortcutAction,
  type BuiltinSidebarNavId,
} from "@/sidebar-nav/model";
import { useSidebarNavItems } from "@/sidebar-nav/use-sidebar-nav-items";
import { useKeyboardShortcutsStore } from "@/stores/keyboard-shortcuts-store";
import { useActiveWorkspaceSelection } from "@/stores/navigation-active-workspace-store";
import { useWorkspace } from "@/stores/session-store-hooks";
import {
  buildNewWorkspaceRoute,
  buildSchedulesRoute,
  buildSessionsRoute,
} from "@/utils/host-routes";

interface SidebarNavRowProps {
  onBeforeNavigate?: () => void;
  footerIcon?: boolean;
}

interface SidebarNavRowsProps extends SidebarNavRowProps {
  pluginsOnly?: boolean;
  /** Style for the group wrapper, which the sidebar owns. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Top-level sidebar navigation, ordered and filtered by the user's
 * `sidebarNavItems` preference. Renders nothing — not even the bordered group
 * wrapper — when every item is hidden.
 */
export function SidebarNavRows({
  style,
  onBeforeNavigate,
  pluginsOnly = false,
}: SidebarNavRowsProps) {
  const { items } = useSidebarNavItems("header");
  const visibleItems = useMemo(
    () => items.filter((item) => item.visible && (!pluginsOnly || item.kind === "plugin")),
    [items, pluginsOnly],
  );
  const groupRef = useRef<View | null>(null);

  if (visibleItems.length === 0) return null;

  return (
    <View ref={groupRef} collapsable={false} style={style}>
      {visibleItems.map((item) => {
        if (item.kind === "plugin") {
          return (
            <PluginSidebarItem
              key={item.key}
              group={item.group}
              section="header"
              fallbackAnchorRef={groupRef}
              onBeforeNavigate={onBeforeNavigate}
            />
          );
        }
        const Row = BUILTIN_ROWS[item.id];
        return <Row key={item.key} onBeforeNavigate={onBeforeNavigate} />;
      })}
    </View>
  );
}

const SidebarNewWorkspaceRow = memo(function SidebarNewWorkspaceRow({
  onBeforeNavigate,
  footerIcon,
}: SidebarNavRowProps) {
  const { t } = useTranslation();
  const shortcutKeys = useShortcutKeys(builtinSidebarNavShortcutAction("new-workspace"));
  const activeWorkspaceSelection = useActiveWorkspaceSelection();
  const activeWorkspaceServerId = activeWorkspaceSelection?.serverId ?? null;
  const activeWorkspaceId = activeWorkspaceSelection?.workspaceId ?? null;
  const activeWorkspace = useWorkspace(activeWorkspaceServerId, activeWorkspaceId);
  const supportsWorkspaceMultiplicity = useHostFeature(
    activeWorkspaceServerId,
    "workspaceMultiplicity",
  );
  const canUseActiveWorkspaceContext = Boolean(
    activeWorkspace &&
    (supportsWorkspaceMultiplicity || canCreateWorktreeForProjectKind(activeWorkspace.projectKind)),
  );

  const handlePress = useCallback(() => {
    onBeforeNavigate?.();
    router.push(
      activeWorkspaceServerId
        ? buildNewWorkspaceRoute(
            activeWorkspace && canUseActiveWorkspaceContext
              ? {
                  serverId: activeWorkspaceServerId,
                  sourceDirectory: activeWorkspace.projectRootPath,
                  projectId: activeWorkspace.projectId,
                }
              : { serverId: activeWorkspaceServerId },
          )
        : buildNewWorkspaceRoute(),
    );
  }, [activeWorkspace, activeWorkspaceServerId, canUseActiveWorkspaceContext, onBeforeNavigate]);

  return (
    <SidebarNavItem
      footerIcon={footerIcon}
      icon={Plus}
      label={t(builtinSidebarNavLabelKey("new-workspace"))}
      onPress={handlePress}
      testID="sidebar-global-new-workspace"
      variant="compact"
      shortcutKeys={shortcutKeys}
    />
  );
});

function SidebarHistoryRow({ onBeforeNavigate, footerIcon }: SidebarNavRowProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const handlePress = useCallback(() => {
    onBeforeNavigate?.();
    router.push(buildSessionsRoute());
  }, [onBeforeNavigate]);

  return (
    <SidebarNavItem
      footerIcon={footerIcon}
      icon={History}
      label={t(builtinSidebarNavLabelKey("history"))}
      onPress={handlePress}
      isActive={pathname.includes("/sessions")}
      testID="sidebar-sessions"
      variant="compact"
    />
  );
}

function SidebarSearchRow({ onBeforeNavigate, footerIcon }: SidebarNavRowProps) {
  const { t } = useTranslation();
  const shortcutKeys = useShortcutKeys(builtinSidebarNavShortcutAction("search"));
  const setCommandCenterOpen = useKeyboardShortcutsStore((state) => state.setCommandCenterOpen);
  const handlePress = useCallback(() => {
    onBeforeNavigate?.();
    setCommandCenterOpen(true);
  }, [onBeforeNavigate, setCommandCenterOpen]);

  return (
    <SidebarNavItem
      footerIcon={footerIcon}
      icon={Search}
      label={t(builtinSidebarNavLabelKey("search"))}
      onPress={handlePress}
      testID="sidebar-search"
      variant="compact"
      shortcutKeys={shortcutKeys}
    />
  );
}

function SidebarSchedulesRow({ onBeforeNavigate, footerIcon }: SidebarNavRowProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const handlePress = useCallback(() => {
    onBeforeNavigate?.();
    router.push(buildSchedulesRoute());
  }, [onBeforeNavigate]);

  return (
    <SidebarNavItem
      footerIcon={footerIcon}
      icon={CalendarClock}
      label={t(builtinSidebarNavLabelKey("schedules"))}
      onPress={handlePress}
      isActive={pathname.includes("/schedules")}
      testID="sidebar-schedules"
      variant="compact"
    />
  );
}

const BUILTIN_ROWS: Record<BuiltinSidebarNavId, ComponentType<SidebarNavRowProps>> = {
  "new-workspace": SidebarNewWorkspaceRow,
  history: SidebarHistoryRow,
  search: SidebarSearchRow,
  schedules: SidebarSchedulesRow,
};

function SidebarNavItem({
  footerIcon,
  ...props
}: ComponentProps<typeof SidebarHeaderRow> & { footerIcon?: boolean }) {
  const accessibilityState = useMemo(
    () => ({ selected: props.isActive ?? false }),
    [props.isActive],
  );
  if (!footerIcon) return <SidebarHeaderRow {...props} />;
  return (
    <View style={styles.footerItem}>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.label}
            accessibilityState={accessibilityState}
            testID={props.testID}
            onPress={props.onPress}
            style={styles.footerButton}
          >
            {({ hovered, pressed }) =>
              props.icon ? (
                <DensityIcon
                  icon={props.icon}
                  size="md"
                  color={hovered || pressed || props.isActive ? "foreground" : "foregroundMuted"}
                />
              ) : null
            }
          </Pressable>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" offset={8} testID={`${props.testID}-tooltip`}>
          <View style={styles.tooltipRow}>
            <Text style={styles.tooltipText}>{props.label}</Text>
            {props.shortcutKeys ? <Shortcut chord={props.shortcutKeys} /> : null}
          </View>
        </TooltipContent>
      </Tooltip>
    </View>
  );
}

export function SidebarFooterNavigation({ onBeforeNavigate }: SidebarNavRowProps) {
  const { items } = useSidebarNavItems("header");
  const visibleItems = items.filter((item) => item.visible && item.kind === "builtin");
  if (!visibleItems.length) return null;
  return (
    <View style={styles.footerNavigation} testID="sidebar-footer-navigation">
      {visibleItems.map((item) => {
        if (item.kind !== "builtin") return null;
        const Row = BUILTIN_ROWS[item.id];
        return <Row key={item.key} footerIcon onBeforeNavigate={onBeforeNavigate} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  footerNavigation: { flexDirection: "row", alignItems: "center" },
  footerItem: { width: density.iconButton, height: density.iconButton },
  footerButton: {
    width: density.iconButton,
    height: density.iconButton,
    alignItems: "center",
    justifyContent: "center",
  },
  tooltipRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing[2] },
  tooltipText: { fontSize: theme.fontSize.base, color: theme.colors.popoverForeground },
}));
