import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  openSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const colors = new Set([
  "none",
  "violet",
  "sky",
  "emerald",
  "orange",
  "pink",
  "indigo",
  "teal",
  "red",
  "amber",
  "blue",
]);
const fields = new Set(["label", "color", "badgeDisplay", "browseRootDirectory"]);
const noControls = (value) => [...value].every((char) => char.charCodeAt(0) >= 32);
function validChanges(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (!Object.keys(value).length || Object.keys(value).some((key) => !fields.has(key)))
    return false;
  return Object.entries(value).every(([key, entry]) => {
    if (key === "label")
      return (
        typeof entry === "string" &&
        entry.trim().length > 0 &&
        entry.length <= 200 &&
        noControls(entry)
      );
    if (key === "color") return colors.has(entry);
    if (key === "badgeDisplay") return entry === null || ["name", "icon", "hidden"].includes(entry);
    return (
      entry === null ||
      (typeof entry === "string" &&
        entry.length <= 4096 &&
        /^(?:\/|[A-Za-z]:[\\/])/.test(entry) &&
        noControls(entry))
    );
  });
}
const mergeChanges = (existing, input) =>
  input.initialize ? { ...input.changes, ...existing } : { ...existing, ...input.changes };
const validId = (id) => typeof id === "string" && /^srv_[A-Za-z0-9_-]{1,124}$/.test(id);
const digest = (value) => createHash("sha256").update(value).digest();
function validInput(input) {
  return (
    input &&
    Object.keys(input).every((key) => ["serverId", "changes", "initialize"].includes(key)) &&
    validId(input.serverId) &&
    validChanges(input.changes) &&
    (input.initialize === undefined || typeof input.initialize === "boolean")
  );
}

function saveDocument(filename, directory, next) {
  const temporary = `${filename}.tmp`;
  writeFileSync(temporary, JSON.stringify(next) + "\n", { mode: 0o600 });
  const fd = openSync(temporary, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temporary, filename);
  const dir = openSync(directory, "r");
  try {
    fsyncSync(dir);
  } finally {
    closeSync(dir);
  }
}
const validFavorite = (value) =>
  value &&
  typeof value === "object" &&
  Object.keys(value).every((key) =>
    ["serverId", "agentId", "title", "hostLabel", "addedAt"].includes(key),
  ) &&
  validId(value.serverId) &&
  typeof value.agentId === "string" &&
  /^[A-Za-z0-9_-]{1,200}$/.test(value.agentId) &&
  typeof value.title === "string" &&
  value.title.length > 0 &&
  value.title.length <= 500 &&
  noControls(value.title) &&
  typeof value.hostLabel === "string" &&
  value.hostLabel.length <= 200 &&
  noControls(value.hostLabel) &&
  Number.isSafeInteger(value.addedAt) &&
  value.addedAt >= 0;
const favoriteKey = (value) => JSON.stringify([value.serverId, value.agentId]);

export function createSettingsServer({ directory, token, origin }) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) throw new Error("Invalid settings token");
  if (new URL(origin).origin !== origin) throw new Error("Invalid settings origin");
  const expected = digest(`Bearer ${token}`);
  const filename = join(directory, "host-settings.json");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  let document = { revision: 0, hosts: {} };
  try {
    document = JSON.parse(readFileSync(filename, "utf8"));
    if (
      !Number.isSafeInteger(document.revision) ||
      !document.hosts ||
      Array.isArray(document.hosts) ||
      Object.entries(document.hosts).some(([id, value]) => !validId(id) || !validChanges(value))
    )
      throw new Error("Invalid stored host settings");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const favoritesFile = join(directory, "favorites.json");
  let favorites = { revision: 0, entries: [] };
  try {
    favorites = JSON.parse(readFileSync(favoritesFile, "utf8"));
    if (
      !Number.isSafeInteger(favorites.revision) ||
      favorites.revision < 0 ||
      !Array.isArray(favorites.entries) ||
      favorites.entries.length > 2000 ||
      !favorites.entries.every(validFavorite) ||
      new Set(favorites.entries.map(favoriteKey)).size !== favorites.entries.length
    )
      throw new Error("Invalid stored favorites");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  function patchFavorites(input, send) {
    if (
      !input ||
      Object.keys(input).some((key) => !["favorite", "remove"].includes(key)) ||
      typeof input.remove !== "boolean" ||
      !validFavorite(input.favorite)
    )
      return send(400, { error: "Invalid favorite" });
    const key = favoriteKey(input.favorite);
    const entries = favorites.entries.filter((entry) => favoriteKey(entry) !== key);
    if (!input.remove)
      entries.push({
        ...input.favorite,
        addedAt:
          favorites.entries.find((entry) => favoriteKey(entry) === key)?.addedAt ?? Date.now(),
      });
    if (entries.length > 2000) return send(409, { error: "Favorite limit reached" });
    const next = { revision: favorites.revision + 1, entries };
    saveDocument(favoritesFile, directory, next);
    favorites = next;
    return send(200, favorites);
  }
  function patchHosts(input, send) {
    if (!validInput(input)) return send(400, { error: "Invalid host settings" });
    if (
      !Object.hasOwn(document.hosts, input.serverId) &&
      Object.keys(document.hosts).length >= 1000
    )
      return send(409, { error: "Host limit reached" });
    const existing = document.hosts[input.serverId];
    const settings = mergeChanges(existing, input);
    const next = {
      revision: document.revision + 1,
      hosts: {
        ...document.hosts,
        [input.serverId]: settings,
      },
    };
    saveDocument(filename, directory, next);
    document = next;
    return send(200, document);
  }
  return createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(body));
    };
    if (req.url === "/api/client-settings/info" && req.method === "GET")
      return send(200, { enabled: true });
    const isFavorites = req.url === "/api/client-settings/favorites";
    if (req.url !== "/api/client-settings" && !isFavorites)
      return send(404, { error: "Not found" });
    if (!timingSafeEqual(expected, digest(req.headers.authorization ?? "")))
      return send(401, { error: "Invalid sync key" });
    if (req.headers.origin && req.headers.origin !== origin)
      return send(403, { error: "Origin not allowed" });
    if (req.method === "GET") return send(200, isFavorites ? favorites : document);
    if (req.method !== "PATCH") return send(405, { error: "Method not allowed" });
    if (req.headers.origin !== origin || req.headers["content-type"] !== "application/json")
      return send(403, { error: "Same-origin JSON required" });
    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 16384) return send(413, { error: "Request too large" });
      }
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        return send(400, { error: "Invalid JSON" });
      }
      return isFavorites ? patchFavorites(input, send) : patchHosts(input, send);
    } catch (error) {
      console.error("[settings] Unable to save:", error.code ?? error.name);
      return send(500, { error: "Unable to save host settings" });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createSettingsServer({
    directory: process.env.SETTINGS_DIRECTORY,
    token: readFileSync(process.env.SETTINGS_TOKEN_FILE, "utf8").trim(),
    origin: process.env.SETTINGS_ORIGIN,
  });
  server.listen(
    Number(process.env.SETTINGS_PORT ?? 8788),
    process.env.SETTINGS_BIND ?? "127.0.0.1",
  );
}
