import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Star, StarOff } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Text } from "react-native";
import { useToast } from "@/contexts/toast-api-context";
import { getHostRuntimeStore } from "@/runtime/host-runtime";
import { favoriteKey } from "@/hosts/shared-favorites";
import { createFavoritesStore } from "./favorites-store";

export const useFavorites = createFavoritesStore((input) =>
  getHostRuntimeStore().requestSharedFavorites(input),
);
export function FavoriteButton({
  serverId,
  agentId,
  title,
  hostLabel,
}: {
  serverId: string;
  agentId: string;
  title: string;
  hostLabel: string;
}) {
  const key = favoriteKey({ serverId, agentId });
  const saved = useFavorites((state) =>
    state.document.entries.find((entry) => favoriteKey(entry) === key),
  );
  const pending = useFavorites((state) => state.pending.includes(key));
  const toast = useToast();
  const { t } = useTranslation();
  const toggle = useCallback(async () => {
    try {
      await useFavorites.getState().save(
        saved ?? {
          serverId,
          agentId,
          title: title.slice(0, 500),
          hostLabel: hostLabel.slice(0, 200),
          addedAt: Date.now(),
        },
        Boolean(saved),
      );
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error));
    }
  }, [saved, serverId, agentId, title, hostLabel, toast]);
  const label = t(saved ? "homeOverview.removeFavorite" : "homeOverview.addFavorite");
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <Button
          size="xs"
          variant={saved ? "secondary" : "ghost"}
          leftIcon={saved ? StarOff : Star}
          accessibilityLabel={label}
          testID={`favorite-${serverId}-${agentId}`}
          disabled={pending}
          onPress={toggle}
        />
      </TooltipTrigger>
      <TooltipContent>
        <Text>{label}</Text>
      </TooltipContent>
    </Tooltip>
  );
}
