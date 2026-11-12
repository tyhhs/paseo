import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, statSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createSettingsServer } from "./server.mjs";

const token = "test_sync_key_".padEnd(43, "x");
const origin = "http://127.0.0.1";
test("authenticated per-field updates survive reload without exposing or accepting credentials", async () => {
  const directory = mkdtempSync(join(tmpdir(), "paseo-settings-"));
  let server;
  const start = async () => {
    server = createSettingsServer({ directory, token, origin });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    return `http://127.0.0.1:${server.address().port}/api/client-settings`;
  };
  try {
    let url = await start();
    const headers = {
      Authorization: `Bearer ${token}`,
      Origin: origin,
      "Content-Type": "application/json",
    };
    const patch = (changes, extra = {}) =>
      fetch(url, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ serverId: "srv_mac", changes, ...extra }),
      });
    assert.equal((await fetch(url)).status, 401);
    assert.deepEqual(await (await fetch(`${url}/info`)).json(), { enabled: true });
    assert.equal(
      (await fetch(url, { headers: { ...headers, Origin: "http://evil.example" } })).status,
      403,
    );
    assert.equal((await patch({ password: "secret" })).status, 400);
    assert.equal((await patch({ label: "x" }, { serverId: "../../escape" })).status, 400);
    assert.equal((await patch({ browseRootDirectory: "relative" })).status, 400);
    assert.equal((await patch({ color: "unknown" })).status, 400);
    assert.equal((await patch({ label: "Mac" })).status, 200);
    assert.equal(
      (await patch({ label: "Stale", color: "teal" }, { initialize: true })).status,
      200,
    );
    assert.equal((await (await fetch(url, { headers })).json()).hosts.srv_mac.label, "Mac");
    await Promise.all([patch({ color: "teal" }), patch({ badgeDisplay: "icon" })]);
    assert.equal((await patch({ browseRootDirectory: "/home/user/repos" })).status, 200);
    assert.deepEqual((await (await fetch(url, { headers })).json()).hosts, {
      srv_mac: {
        label: "Mac",
        color: "teal",
        badgeDisplay: "icon",
        browseRootDirectory: "/home/user/repos",
      },
    });
    assert.equal(statSync(join(directory, "host-settings.json")).mode & 0o777, 0o600);
    assert.equal(
      readFileSync(join(directory, "host-settings.json"), "utf8").includes(token),
      false,
    );
    await new Promise((resolve) => server.close(resolve));
    url = await start();
    assert.equal((await (await fetch(url, { headers })).json()).hosts.srv_mac.label, "Mac");
    const before = readFileSync(join(directory, "host-settings.json"), "utf8");
    mkdirSync(join(directory, "host-settings.json.tmp"));
    assert.equal((await patch({ label: "Failed" })).status, 500);
    assert.equal((await (await fetch(url, { headers })).json()).hosts.srv_mac.label, "Mac");
    assert.equal(readFileSync(join(directory, "host-settings.json"), "utf8"), before);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});

test("favorites merge across clients, survive restart, and keep host documents compatible", async () => {
  const directory = mkdtempSync(join(tmpdir(), "paseo-favorites-"));
  let server;
  const start = async () => {
    server = createSettingsServer({ directory, token, origin });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    return `http://127.0.0.1:${server.address().port}/api/client-settings`;
  };
  try {
    let base = await start();
    const headers = {
      Authorization: `Bearer ${token}`,
      Origin: origin,
      "Content-Type": "application/json",
    };
    const favorite = {
      serverId: "srv_mac",
      agentId: "session-1",
      title: "Old session",
      hostLabel: "Mac",
      addedAt: 0,
    };
    const patch = (entry, remove = false, override = {}) =>
      fetch(`${base}/favorites`, {
        method: "PATCH",
        headers: { ...headers, ...override },
        body: JSON.stringify({ favorite: entry, remove }),
      });
    assert.equal((await fetch(`${base}/favorites`)).status, 401);
    assert.equal((await patch(favorite, false, { Origin: "http://evil.example" })).status, 403);
    assert.equal((await patch({ ...favorite, agentId: "../../secret" })).status, 400);
    assert.equal((await patch({ ...favorite, password: "secret" })).status, 400);
    const responses = await Promise.all([
      patch(favorite),
      patch({ ...favorite, serverId: "srv_remote" }),
    ]);
    assert.ok(responses.every((response) => response.status === 200));
    assert.equal((await (await fetch(`${base}/favorites`, { headers })).json()).entries.length, 2);
    await patch(favorite);
    assert.equal((await (await fetch(`${base}/favorites`, { headers })).json()).entries.length, 2);
    assert.deepEqual(Object.keys(await (await fetch(base, { headers })).json()).sort(), [
      "hosts",
      "revision",
    ]);
    await new Promise((resolve) => server.close(resolve));
    base = await start();
    let saved = await (await fetch(`${base}/favorites`, { headers })).json();
    assert.equal(saved.entries.length, 2);
    assert.equal(statSync(join(directory, "favorites.json")).mode & 0o777, 0o600);
    await patch(favorite, true);
    saved = await (await fetch(`${base}/favorites`, { headers })).json();
    assert.equal(saved.entries.length, 1);
    assert.equal(saved.entries[0].serverId, "srv_remote");
    mkdirSync(join(directory, "favorites.json.tmp"));
    assert.equal((await patch(saved.entries[0], true)).status, 500);
    assert.deepEqual(await (await fetch(`${base}/favorites`, { headers })).json(), saved);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});
