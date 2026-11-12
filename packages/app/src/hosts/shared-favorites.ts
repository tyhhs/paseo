import { z } from "zod";
export const FavoriteSchema = z.strictObject({
  serverId: z.string().regex(/^srv_[A-Za-z0-9_-]{1,124}$/),
  agentId: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
  title: z.string().min(1).max(500),
  hostLabel: z.string().max(200),
  addedAt: z.number().int().nonnegative(),
});
export const FavoritesDocumentSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  entries: z.array(FavoriteSchema).max(2000),
});
export type Favorite = z.infer<typeof FavoriteSchema>;
export type FavoritesDocument = z.infer<typeof FavoritesDocumentSchema>;
export interface FavoriteMutation {
  favorite: Favorite;
  remove: boolean;
}
export const favoriteKey = (entry: Pick<Favorite, "serverId" | "agentId">) =>
  JSON.stringify([entry.serverId, entry.agentId]);
