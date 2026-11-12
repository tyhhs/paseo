import { expect, it } from "vitest";
import { createFavoritesStore } from "./favorites-store";
import type { FavoritesDocument } from "@/hosts/shared-favorites";
const favorite = {
  serverId: "srv_mac",
  agentId: "old-session",
  title: "Old session",
  hostLabel: "Mac",
  addedAt: 1,
};
it("ignores stale refreshes and preserves confirmed favorites when a write fails", async () => {
  let finishRead!: (document: FavoritesDocument) => void;
  let fail = false;
  const store = createFavoritesStore(async (input) => {
    if (!input)
      return new Promise((resolve) => {
        finishRead = resolve;
      });
    if (fail) throw new Error("Offline");
    return { revision: 2, entries: [favorite] };
  });
  const read = store.getState().refresh();
  await store.getState().save(favorite, false);
  finishRead({ revision: 1, entries: [] });
  await read;
  expect(store.getState().document.entries).toEqual([favorite]);
  fail = true;
  await expect(store.getState().save(favorite, true)).rejects.toThrow("Offline");
  expect(store.getState().document.entries).toEqual([favorite]);
  expect(store.getState().pending).toEqual([]);
});
