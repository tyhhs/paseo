import { create } from "zustand";
import {
  favoriteKey,
  type Favorite,
  type FavoriteMutation,
  type FavoritesDocument,
} from "@/hosts/shared-favorites";

export function createFavoritesStore(
  request: (input?: FavoriteMutation) => Promise<FavoritesDocument>,
) {
  return create<{
    document: FavoritesDocument;
    error: string | null;
    pending: string[];
    refresh(): Promise<void>;
    save(favorite: Favorite, remove: boolean): Promise<void>;
  }>((set, get) => {
    const accept = (document: FavoritesDocument) =>
      set((state) => ({
        document: document.revision >= state.document.revision ? document : state.document,
        error: null,
      }));
    const fail = (error: unknown) =>
      set({ error: error instanceof Error ? error.message : String(error) });
    return {
      document: { revision: 0, entries: [] },
      error: null,
      pending: [],
      refresh: async () => {
        try {
          accept(await request());
        } catch (error) {
          fail(error);
        }
      },
      save: async (favorite, remove) => {
        const key = favoriteKey(favorite);
        if (get().pending.includes(key)) return;
        set((state) => ({ pending: [...state.pending, key] }));
        try {
          accept(await request({ favorite, remove }));
        } catch (error) {
          fail(error);
          throw error;
        } finally {
          set((state) => ({ pending: state.pending.filter((entry) => entry !== key) }));
        }
      },
    };
  });
}
