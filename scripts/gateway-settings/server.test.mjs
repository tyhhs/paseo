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
