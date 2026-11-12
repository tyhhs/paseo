import { FavoriteButton, useFavorites } from "./favorites";
import { favoriteKey, type Favorite } from "@/hosts/shared-favorites";
import { Button } from "@/components/ui/button";
import { isNative } from "@/constants/platform";
import { Folder, Globe, X } from "lucide-react-native";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useSessionStore } from "@/stores/session-store";
import { useDismissedSessions } from "./sidebar-dismissed";
import { ResizeHandle } from "@/components/resize-handle";
import { resolveActiveSessionHeight, useActiveSessionHeight } from "./sidebar-height";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useMemo, useState } from "react";
import { useStableEvent } from "@/hooks/use-stable-event";
import { FlatList, Pressable, Text, View, useWindowDimensions } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { todaySessions, type HomeSession } from "./model";

export function ActiveSessionSidebarView({
  sessions,
  favorites = [],
  favoritesError = null,
  selectedKey = null,
  loading,
  openSession,
  compact = false,
  onBeforeNavigate,
}: {
  sessions: readonly HomeSession[];
  favorites?: readonly Favorite[];
  favoritesError?: string | null;
  selectedKey?: string | null;
  loading: boolean;
  compact?: boolean;
  onBeforeNavigate?: () => void;
  openSession(serverId: string, agentId: string): void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"today" | "favorites">("today");
  const todayTabState = useMemo(() => ({ selected: tab === "today" }), [tab]);
  const favoritesTabState = useMemo(() => ({ selected: tab === "favorites" }), [tab]);
  const showToday = useStableEvent(() => setTab("today"));
  const showFavorites = useStableEvent(() => {
    setTab("favorites");
    void useFavorites.getState().refresh();
  });
  const { height: windowHeight } = useWindowDimensions();
  const savedHeight = useActiveSessionHeight((state) => state.height);
  const saveHeight = useActiveSessionHeight((state) => state.setHeight);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);
  const sectionHeight = resolveActiveSessionHeight(previewHeight ?? savedHeight, windowHeight);
  const splitSizes = useMemo(
    () => [sectionHeight / windowHeight, 1 - sectionHeight / windowHeight],
    [sectionHeight, windowHeight],
  );
  const previewResize = useStableEvent((_groupId: string, sizes: number[]) => {
    setPreviewHeight(resolveActiveSessionHeight(sizes[0]! * windowHeight, windowHeight));
  });
  const commitResize = useStableEvent((_groupId: string, sizes: number[]) => {
    saveHeight(resolveActiveSessionHeight(sizes[0]! * windowHeight, windowHeight));
    setPreviewHeight(null);
  });
  const sectionStyle = useMemo(
    () => [
      styles.section,
      compact ? styles.compactSection : { height: sectionHeight, maxHeight: sectionHeight },
    ],
    [compact, sectionHeight],
  );
  const [signalFilter, setSignalFilter] = useState<HomeSession["state"] | null>(null);
  const toggleSignal = useStableEvent((state: HomeSession["state"]) => {
    setSignalFilter((current) =>
      current !== null && signalGroup(current) === signalGroup(state) ? null : state,
    );
  });
  const clearSignal = useStableEvent(() => setSignalFilter(null));
  const [day, setDay] = useState(() => new Date().toDateString());
  const dismissals = useDismissedSessions();
  const dismissSession = useStableEvent((key: string) => dismissals.dismiss(day, key));
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(
      () => setDay(new Date().toDateString()),
      midnight.getTime() - now.getTime() + 50,
    );
    return () => clearTimeout(timer);
  }, [day]);
  const active = useMemo(() => todaySessions(sessions, new Date(day)), [sessions, day]);
  const favoriteKeys = useMemo(() => new Set(favorites.map(favoriteKey)), [favorites]);
  const missingFavorites = useMemo(
    () =>
      favorites.filter(
        (entry) => !sessions.some((session) => sessionKey(session) === favoriteKey(entry)),
      ),
    [favorites, sessions],
  );
  const visibleSessions = useMemo(
    () =>
      (tab === "today"
        ? active
        : sessions
            .filter((row) => favoriteKeys.has(sessionKey(row)))
            .sort((a, b) => b.agent.lastActivityAt.getTime() - a.agent.lastActivityAt.getTime())
      ).filter(
        (row) =>
          (tab === "favorites" ||
            !(dismissals.day === day && dismissals.hidden.includes(sessionKey(row)))) &&
          (signalFilter === null || signalGroup(row.state) === signalGroup(signalFilter)),
      ),
    [active, signalFilter, dismissals, day, tab, sessions, favoriteKeys],
  );
  const empty = useMemo(() => {
    let message = t(tab === "favorites" ? "homeOverview.favoritesEmpty" : "homeOverview.empty");
    if (tab === "favorites" && missingFavorites.length) return null;
    if (loading) message = t("homeOverview.loading");
    return <Text style={styles.empty}>{message}</Text>;
  }, [loading, t, tab, missingFavorites.length]);
  const unavailableFavorites = useMemo(
    () =>
      tab === "favorites" ? (
        <View>
          {missingFavorites.map((entry) => (
            <View key={favoriteKey(entry)} style={styles.unavailable}>
              <View style={styles.unavailableText}>
                <Text numberOfLines={1} style={styles.label}>
                  {entry.title}
                </Text>
                <Text style={styles.label}>
                  {entry.hostLabel} · {t("homeOverview.favoriteUnavailable")}
                </Text>
              </View>
              <FavoriteButton {...entry} />
            </View>
          ))}
        </View>
      ) : null,
    [tab, missingFavorites, t],
  );
  const handleOpenSession = useStableEvent((serverId: string, agentId: string) => {
    onBeforeNavigate?.();
    openSession(serverId, agentId);
  });
  const renderItem = useStableEvent(({ item }: { item: HomeSession }) => (
    <ActiveSessionRow
      item={item}
      selected={sessionKey(item) === selectedKey}
      favoriteMode={tab === "favorites"}
      compact={compact}
      openSession={handleOpenSession}
      toggleSignal={toggleSignal}
      signalFilter={signalFilter}
      dismissSession={dismissSession}
    />
  ));
  return (
    <View style={sectionStyle} testID="sidebar-cross-host-active">
      <View style={styles.heading}>
        <View style={styles.tabs} accessibilityRole="tablist">
          <Pressable
            accessibilityRole="tab"
            accessibilityState={todayTabState}
            testID="sidebar-tab-today"
            onPress={showToday}
            style={[styles.tab, tab === "today" && styles.tabSelected]}
          >
            <Text style={styles.label}>{t("homeOverview.today")}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={favoritesTabState}
            testID="sidebar-tab-favorites"
            onPress={showFavorites}
            style={[styles.tab, tab === "favorites" && styles.tabSelected]}
          >
            <Text style={styles.label}>{t("homeOverview.favorites")}</Text>
          </Pressable>
        </View>
        {signalFilter !== null && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("homeOverview.clearSignalFilter")}
            testID="sidebar-clear-signal-filter"
            onPress={clearSignal}
            style={styles.signalFilter}
          >
            <Text numberOfLines={1} style={[styles.signal, signalStyle(signalFilter)]}>
              {t(`homeOverview.signal.${signalGroup(signalFilter)}`)}
            </Text>
          </Pressable>
        )}
      </View>
      {tab === "favorites" && favoritesError && (
        <Text accessibilityRole="alert" style={styles.empty}>
          {favoritesError}
        </Text>
      )}
      <FlatList
        nestedScrollEnabled
        data={visibleSessions}
        extraData={`${selectedKey}:${tab}`}
        style={styles.list}
        keyExtractor={sessionKey}
        ListEmptyComponent={empty}
        ListFooterComponent={unavailableFavorites}
        renderItem={renderItem}
      />
      {!compact && (
        <View style={styles.resizeBoundary}>
          <ResizeHandle
            testID="active-session-sidebar-resize"
            direction="vertical"
            groupId="active-session-sidebar"
            index={0}
            sizes={splitSizes}
            containerSize={windowHeight}
            onPreviewResizeSplit={previewResize}
            onResizeSplit={commitResize}
          />
        </View>
      )}
    </View>
  );
}
const sessionKey = (row: HomeSession) => JSON.stringify([row.agent.serverId, row.agent.id]);
const rowStyle = ({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
  styles.row,
  (hovered || pressed) && styles.hover,
];
function ActiveSessionRow({
  item,
  selected: sessionSelected,
  favoriteMode,
  compact,
  openSession,
  toggleSignal,
  signalFilter,
  dismissSession,
}: {
  item: HomeSession;
  selected: boolean;
  favoriteMode: boolean;
  dismissSession(key: string): void;
  compact: boolean;
  signalFilter: HomeSession["state"] | null;
  toggleSignal(state: HomeSession["state"]): void;
  openSession(serverId: string, agentId: string): void;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const enter = useStableEvent(() => setHovered(true));
  const leave = useStableEvent(() => setHovered(false));
  const focus = useStableEvent(() => setFocused(true));
  const blur = useStableEvent(() => setFocused(false));
  const showActions = hovered || focused || compact || isNative;
  const dismiss = useStableEvent(() => dismissSession(sessionKey(item)));
  const filterSignal = useStableEvent(() => toggleSignal(item.state));
  const selected = signalFilter !== null && signalGroup(signalFilter) === signalGroup(item.state);
  const signalAccessibilityState = useMemo(() => ({ selected }), [selected]);
  const sessionAccessibilityState = useMemo(
    () => ({ selected: sessionSelected }),
    [sessionSelected],
  );
  const open = useStableEvent(() => openSession(item.agent.serverId, item.agent.id));
  const pressableStyle = useStableEvent((state: Parameters<typeof rowStyle>[0]) => [
    rowStyle(state),
    compact && styles.compactRow,
    sessionSelected && styles.selectedRow,
  ]);
  return (
    <View style={styles.rowContainer} onPointerEnter={enter} onPointerLeave={leave}>
      <HoverCard disabled={compact}>
        <HoverCardTrigger>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.agent.serverLabel} · ${item.agent.title || item.agent.provider} · ${t(`homeOverview.state.${item.state}`)}`}
            testID={`sidebar-active-session-${item.agent.serverId}-${item.agent.id}`}
            accessibilityState={sessionAccessibilityState}
            onPress={open}
            onFocus={focus}
            onBlur={blur}
            style={pressableStyle}
          >
            <View style={styles.line}>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.title}
                testID="sidebar-active-title"
              >
                {item.agent.title || item.agent.provider}
              </Text>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.meta}
                testID="sidebar-active-host"
              >
                {item.agent.serverLabel}
              </Text>
            </View>
          </Pressable>
        </HoverCardTrigger>
        <HoverCardContent
          placement="right"
          alignment="start"
          style={styles.sessionCard}
          testID="sidebar-session-hover-card"
        >
          <SessionHoverDetails item={item} />
        </HoverCardContent>
      </HoverCard>
      <View
        style={[
          styles.removeSlot,
          compact && styles.compactRemoveSlot,
          !showActions && styles.hiddenActions,
        ]}
        pointerEvents={showActions ? "auto" : "none"}
      >
        {favoriteMode ? (
          <FavoriteButton
            serverId={item.agent.serverId}
            agentId={item.agent.id}
            title={item.agent.title || item.agent.provider}
            hostLabel={item.agent.serverLabel}
          />
        ) : (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <Button
                size="xs"
                variant="ghost"
                leftIcon={X}
                accessibilityLabel={t("homeOverview.removeToday", {
                  name: item.agent.title || item.agent.provider,
                })}
                onPress={dismiss}
                onFocus={focus}
                onBlur={blur}
                disabled={!showActions}
              />
            </TooltipTrigger>
            <TooltipContent side="right">
              <Text>{t("homeOverview.removeTodayHint")}</Text>
            </TooltipContent>
          </Tooltip>
        )}
      </View>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Pressable
            testID={`sidebar-signal-${item.agent.serverId}-${item.agent.id}`}
            accessibilityRole="button"
            accessibilityLabel={t("homeOverview.filterSignal", {
              state: t(`homeOverview.state.${item.state}`),
            })}
            accessibilityState={signalAccessibilityState}
            onPress={filterSignal}
            style={[styles.signalSlot, compact && styles.compactSignalSlot]}
          >
            <Text numberOfLines={1} style={[styles.signal, signalStyle(item.state)]}>
              {t(`homeOverview.signal.${signalGroup(item.state)}`)}
            </Text>
          </Pressable>
        </TooltipTrigger>
        <TooltipContent side="right">
          <Text>{t(`homeOverview.state.${item.state}`)}</Text>
        </TooltipContent>
      </Tooltip>
    </View>
  );
}
const ThemedFolder = withUnistyles(Folder);
const ThemedGlobe = withUnistyles(Globe);
const cardIconColor = (theme: import("@/styles/theme").Theme) => ({
  color: theme.colors.foregroundMuted,
});

function SessionHoverDetails({ item }: { item: HomeSession }) {
  const { t, i18n } = useTranslation();
  const workspace = useSessionStore((state) =>
    state.sessions[item.agent.serverId]?.workspaces.get(item.agent.workspaceId ?? ""),
  );
  const workspaceName =
    workspace?.projectCustomName ||
    workspace?.projectDisplayName ||
    workspace?.name ||
    item.agent.cwd;
  return (
    <>
      <View style={styles.cardHeading}>
        <Text style={styles.cardTitle}>{item.agent.title || item.agent.provider}</Text>
        <Text
          style={styles.cardTime}
          accessibilityLabel={`${t("homeOverview.lastActivity")}: ${item.agent.lastActivityAt.toLocaleString(i18n.language)}`}
        >
          {item.agent.lastActivityAt.toLocaleString(i18n.language, {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
      <View style={styles.cardInfo}>
        <ThemedFolder size={16} uniProps={cardIconColor} />
        <Text style={styles.cardText}>{workspaceName}</Text>
      </View>
      <View style={styles.cardInfo}>
        <ThemedGlobe size={16} uniProps={cardIconColor} />
        <Text style={styles.cardText}>{item.agent.serverLabel}</Text>
      </View>
    </>
  );
}
function signalGroup(state: HomeSession["state"]) {
  if (state === "running" || state === "starting") return "running";
  if (state === "waiting" || state === "attention") return "waiting";
  if (state === "finished" || state === "failed") return state;
  return "idle";
}
function signalStyle(state: HomeSession["state"]) {
  switch (state) {
    case "finished":
      return styles.signalSuccess;
    case "running":
    case "starting":
      return styles.signalRunning;
    case "failed":
      return styles.signalDanger;
    case "waiting":
    case "attention":
      return styles.signalWarning;
    default:
      return styles.signalUnknown;
  }
}
const styles = StyleSheet.create((theme) => ({
  sessionCard: {
    width: 380,
    maxWidth: "90%",
    padding: theme.spacing[3],
    gap: theme.spacing[2],
    backgroundColor: theme.colors.surface1,
    borderWidth: 1,
    borderColor: theme.colors.borderAccent,
    borderRadius: theme.borderRadius.lg,
  },
  cardHeading: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing[3] },
  cardTitle: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
  },
  cardTime: { color: theme.colors.foregroundMuted, fontSize: theme.fontSize.sm, flexShrink: 0 },
  cardInfo: { flexDirection: "row", alignItems: "center", gap: theme.spacing[2] },
  cardText: { flex: 1, minWidth: 0, color: theme.colors.foreground, fontSize: theme.fontSize.base },
  tabs: { flexDirection: "row", gap: 16 },
  tab: { paddingVertical: 6, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabSelected: { borderBottomColor: theme.colors.foreground },
  unavailable: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  unavailableText: { flex: 1, minWidth: 0 },
  section: {
    maxHeight: 300,
    flexShrink: 1,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 8,
  },
  resizeBoundary: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10 },
  compactSection: { maxHeight: "40%" },
  compactRow: { minHeight: 48, paddingRight: 100 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  rowContainer: { position: "relative" },
  signalFilter: {
    minWidth: 48,
    paddingHorizontal: 8,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
  },
  label: { fontSize: theme.fontSize.sm, color: theme.colors.foregroundMuted },
  meta: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
    flexGrow: 1,
    flexBasis: theme.fontSize.sm,
    minWidth: 0,
  },
  list: { flexGrow: 0, flexShrink: 1 },
  row: {
    marginHorizontal: 8,
    borderRadius: 8,
    paddingLeft: 10,
    paddingRight: 72,
    paddingVertical: 7,
    minHeight: 36,
    justifyContent: "center",
  },
  selectedRow: { backgroundColor: theme.colors.surfaceSidebarSelected },
  hover: { backgroundColor: theme.colors.surface2 },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
  hiddenActions: { opacity: 0 },
  removeSlot: {
    position: "absolute",
    right: 48,
    top: 0,
    width: 28,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  compactRemoveSlot: { right: 56, width: 40, height: 48 },
  signalSlot: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 48,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  compactSignalSlot: { width: 52, height: 48, right: 4 },
  signal: { fontSize: theme.fontSize.sm },
  signalSuccess: { color: theme.colors.statusDotSuccess },
  signalRunning: { color: theme.colors.statusDotRunning },
  signalDanger: { color: theme.colors.statusDotDanger },
  signalWarning: { color: theme.colors.statusDotWarning },
  signalUnknown: { color: theme.colors.foregroundExtraMuted },
  title: {
    fontSize: theme.fontSize.base,
    color: theme.colors.foreground,
    flexGrow: 3,
    flexBasis: 0,
    minWidth: 0,
  },
  empty: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
}));
