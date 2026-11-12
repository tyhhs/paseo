import { useFavorites } from "@/home-overview/favorites";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard, SettingsRow, SettingsSection } from "@/components/settings";
import { AdaptiveRenameModal } from "@/components/rename-modal";
import { Button } from "@/components/ui/button";
import {
  getHostRuntimeStore,
  useHostRegistryLoaded,
  useSharedHostSettingsState,
} from "@/runtime/host-runtime";
import { isWeb } from "@/constants/platform";

export function SharedHostSettingsBootstrap() {
  const loaded = useHostRegistryLoaded();
  const state = useSharedHostSettingsState();
  useEffect(() => {
    if (!isWeb || !loaded || state.status !== "connected") return;
    const refresh = () => {
      if (document.visibilityState === "visible") void useFavorites.getState().refresh();
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 15000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loaded, state.status]);
  useEffect(() => {
    if (!isWeb || !loaded || state.status === "disabled") return;
    const store = getHostRuntimeStore();
    const activate = () => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const token = params.get("settingsSync");
      if (token) {
        params.delete("settingsSync");
        const fragment = params.toString();
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname + window.location.search + (fragment ? `#${fragment}` : ""),
        );
        void store.connectSharedHostSettings(token).catch(() => undefined);
      }
    };
    activate();
    window.addEventListener("hashchange", activate);
    const refresh = () => {
      if (document.visibilityState === "visible")
        void store.refreshSharedHostSettings().catch(() => undefined);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 30000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("hashchange", activate);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loaded, state.status]);
  return null;
}

export function SharedHostSettingsSection() {
  const { t } = useTranslation();
  const state = useSharedHostSettingsState();
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const open = useCallback(() => setEditing(true), []);
  const close = useCallback(() => setEditing(false), []);
  const connect = useCallback(
    async (token: string) => getHostRuntimeStore().connectSharedHostSettings(token),
    [],
  );
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await getHostRuntimeStore().refreshSharedHostSettings();
    } catch {
      /* The persisted sync status renders the error and retry action. */
    } finally {
      setRefreshing(false);
    }
  }, []);
  if (state.status === "disabled") return null;
  return (
    <SettingsSection title={t("sharedHostSettings.title")}>
      <SettingsCard>
        <SettingsRow
          label={t(`sharedHostSettings.${state.status}`)}
          hint={t("sharedHostSettings.hint")}
          error={state.error ?? undefined}
          testID="shared-settings-status"
        >
          <Button variant="secondary" onPress={open} testID="shared-settings-connect">
            {t("sharedHostSettings.connect")}
          </Button>
          {state.status !== "disconnected" && (
            <Button
              variant="ghost"
              onPress={refresh}
              disabled={refreshing}
              testID="shared-settings-refresh"
            >
              {t("sharedHostSettings.refresh")}
            </Button>
          )}
        </SettingsRow>
      </SettingsCard>
      <AdaptiveRenameModal
        visible={editing}
        title={t("sharedHostSettings.connect")}
        initialValue=""
        placeholder={t("sharedHostSettings.key")}
        secureTextEntry
        maxLength={128}
        onClose={close}
        onSubmit={connect}
        submitLabel={t("sharedHostSettings.connect")}
        testID="shared-settings-key"
      />
    </SettingsSection>
  );
}
