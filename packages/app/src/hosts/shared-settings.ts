import { z } from "zod";
import { getIsElectron, isWeb } from "@/constants/platform";
import { HOST_COLORS, HOST_BADGE_DISPLAYS } from "./appearance";
import { normalizeHostBrowseRootDirectory, type HostProfile } from "@/types/host-connection";

export const SharedHostSettingsPatchSchema = z.strictObject({
  label: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((value) => [...value].every((char) => char.charCodeAt(0) >= 32))
    .optional(),
  color: z.enum(HOST_COLORS).optional(),
  badgeDisplay: z.enum(HOST_BADGE_DISPLAYS).nullable().optional(),
  browseRootDirectory: z
    .string()
    .max(4096)
    .refine((value) => !!normalizeHostBrowseRootDirectory(value))
    .nullable()
    .optional(),
});
export type SharedHostSettingsPatch = z.infer<typeof SharedHostSettingsPatchSchema>;
const documentSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  hosts: z.record(z.string().regex(/^srv_[A-Za-z0-9_-]{1,124}$/), SharedHostSettingsPatchSchema),
});
export type SharedHostSettingsDocument = z.infer<typeof documentSchema>;
export interface SharedHostSettingsClient {
  discover(): Promise<boolean>;
  read(token: string): Promise<SharedHostSettingsDocument>;
  patch(
    token: string,
    input: { serverId: string; changes: SharedHostSettingsPatch; initialize?: boolean },
  ): Promise<SharedHostSettingsDocument>;
}
export interface SharedHostSettingsState {
  status: "disabled" | "disconnected" | "connected" | "error";
  error: string | null;
}

export function applySharedHostSettings(
  hosts: HostProfile[],
  shared: SharedHostSettingsDocument,
): HostProfile[] {
  return hosts.map((host) => {
    const settings = shared.hosts[host.serverId];
    if (!settings) return host;
    return {
      ...host,
      label: settings.label ?? host.label,
      browseRootDirectory:
        settings.browseRootDirectory === null
          ? undefined
          : (settings.browseRootDirectory ?? host.browseRootDirectory),
      appearance: {
        color: settings.color ?? host.appearance.color,
        badgeDisplay:
          settings.badgeDisplay === undefined
            ? host.appearance.badgeDisplay
            : settings.badgeDisplay,
      },
    };
  });
}

export function createSharedHostSettingsClient(): SharedHostSettingsClient | null {
  if (!isWeb || getIsElectron() || typeof window === "undefined") return null;
  const request = async (
    token: string,
    input?: { serverId: string; changes: SharedHostSettingsPatch; initialize?: boolean },
  ) => {
    const response = await fetch("/api/client-settings", {
      method: input ? "PATCH" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(input ? { "Content-Type": "application/json" } : {}),
      },
      ...(input ? { body: JSON.stringify(input) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "共享配置口令无效，请重新连接。"
          : "共享配置服务不可用，请重试；本地显示已保留。",
      );
    return documentSchema.parse(await response.json());
  };
  return {
    discover: async () => {
      try {
        const response = await fetch("/api/client-settings/info", {
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        return response.ok && (await response.json()).enabled === true;
      } catch {
        return false;
      }
    },
    read: (token) => request(token),
    patch: (token, input) =>
      request(token, { ...input, changes: SharedHostSettingsPatchSchema.parse(input.changes) }),
  };
}
