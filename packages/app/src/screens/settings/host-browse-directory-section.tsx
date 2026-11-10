import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard, SettingsRow, SettingsSection } from "@/components/settings";
import { AdaptiveRenameModal } from "@/components/rename-modal";
import { Button } from "@/components/ui/button";
import { useHostMutations, useHostRuntimeClient } from "@/runtime/host-runtime";
import { normalizeHostBrowseRootDirectory, type HostProfile } from "@/types/host-connection";

export function HostBrowseDirectorySection({ host }: { host: HostProfile }) {
  const { t } = useTranslation();
  const client = useHostRuntimeClient(host.serverId);
  const { setHostBrowseRootDirectory } = useHostMutations();
  const [editing, setEditing] = useState(false);
  const open = useCallback(() => setEditing(true), []);
  const close = useCallback(() => setEditing(false), []);
  const validate = useCallback(
    (value: string) =>
      normalizeHostBrowseRootDirectory(value) ? null : t("settings.host.browse.invalidPath"),
    [t],
  );
  const save = useCallback(
    async (value: string) => {
      const directory = normalizeHostBrowseRootDirectory(value);
      if (!directory) throw new Error(t("settings.host.browse.invalidPath"));
      if (!client) throw new Error(t("settings.host.browse.hostUnavailable"));
      await client.listDirectory(directory, ".");
      await setHostBrowseRootDirectory(host.serverId, directory);
    },
    [client, host.serverId, setHostBrowseRootDirectory, t],
  );
  return (
    <SettingsSection title="Browse">
      <SettingsCard>
        <SettingsRow label={t("settings.host.browse.label")}>
          <Button
            variant="ghost"
            onPress={open}
            testID="host-browse-root-edit"
            accessibilityLabel={t("settings.host.browse.edit")}
          >
            {host.browseRootDirectory ?? "/"}
          </Button>
        </SettingsRow>
      </SettingsCard>
      <AdaptiveRenameModal
        visible={editing}
        title={t("settings.host.browse.edit")}
        initialValue={host.browseRootDirectory ?? "/"}
        placeholder="/"
        submitLabel={t("common.actions.save")}
        validate={validate}
        onSubmit={save}
        onClose={close}
        testID="host-browse-root-modal"
      />
    </SettingsSection>
  );
}
