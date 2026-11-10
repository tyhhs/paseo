# Shared host settings on a web gateway

The optional `scripts/gateway-settings/server.mjs` service stores host aliases, colors,
badge choices and Browse roots on a self-hosted web gateway. Browser clients discover it
at `/api/client-settings/info`. Gateways without the service, Electron and native clients
keep their existing local settings.

The browser connects once with a separate settings key in a masked field under a host's
Overview → Shared host settings. A `#settingsSync=<key>` activation link also works; the
fragment is removed after consumption. Treat that link as a credential. The key is stored
locally, outside the host registry. It grants access to this gateway's one shared settings
collection, not to agents or pairing credentials. This is a single-owner deployment, not
a multi-user account service. Use HTTPS when the gateway is exposed beyond a trusted VPN.

Connection imports only the four permitted fields, filling missing remote values without
overwriting existing ones. Subsequent edits patch one field on one stable server ID.
Different-field writes merge; the last accepted edit wins for the same field. Pairing
passwords, connections, keys, workspace content and UI layout never enter this API.
Removing a paired host locally does not remove its shared metadata from other devices.

After connection, startup, window focus and a 30-second visible-page refresh retrieve
remote settings. A remote save must succeed before local display changes. Network/auth
errors retain cached display and appear in the Overview sync section with a retry action.
There is no offline write queue. Local persistence failure after a remote commit requires
a retry or refresh; it cannot roll the remote commit back.

Run the service with Node 22 and these environment variables:

- `SETTINGS_DIRECTORY`: private, persistent data directory outside the static web root.
- `SETTINGS_TOKEN_FILE`: private file containing a random 32–128-character base64url key.
- `SETTINGS_ORIGIN`: exact browser origin, including scheme and port.
- `SETTINGS_BIND`, `SETTINGS_PORT`: private listening interface and port (default loopback:8788).

Proxy `/api/client-settings` and its `/info` subpath through the existing gateway. Preserve
Authorization and Origin. Do not enable CORS. Only `/info` is public; reads and writes need
the key. Writes also require the configured Origin and JSON content type. Requests and
stored fields are bounded and validated. JSON snapshots are fsynced and atomically replaced
with mode 0600; invalid stored data prevents startup. Back up the data and key separately
from static releases. Rotate the key file and restart only this settings service to revoke
all browser sync access; reconnect devices with the replacement key.

Validation:

```sh
node --test scripts/gateway-settings/server.test.mjs
cd packages/app
npx --no-install vitest run src/runtime/host-runtime.test.ts src/i18n/resources.test.ts --bail=1
```
