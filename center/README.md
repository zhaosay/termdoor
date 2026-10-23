# TermDoor center

中文部署与自定义域名教程：[自建线上设备中心](SELF_HOSTING.zh-CN.md)。

The center is an optional application. LAN-only users run `server.js` as before.
The center provides password login, per-account device ownership, one-time
enrollment, device status, HTTP/WebSocket proxying, and device revocation.

## Deployment layout (example)

- Application: `/opt/termdoor-center`.
- Database and initial credentials: `/var/lib/termdoor-center`, mode 0700.
- Public website: `https://center.example.com` behind Cloudflare and nginx.
- Center: `127.0.0.1:17001`.
- frps authorization plugin: `127.0.0.1:17002`.
- Dedicated frps: `127.0.0.1:17000`, reached through nginx `/~!frp` over WSS.
- Device mappings: `127.0.0.1:16000` through `127.0.0.1:16999`.
- Existing frps on port 7000 and its existing proxies are independent.

`center.example.com` needs an A record pointing at the server. Cloudflare proxying is
supported; use Full (strict) with the valid origin certificate. The new center
does not depend on the separate `frp.example.com:7000` manual connection.
No new public control or mapped ports are needed. Exempt `/~!frp` and
`/api/device/*` from interactive Cloudflare challenges if custom WAF rules are
added later: these are authenticated machine-to-machine endpoints.

The center has no public signup. Each device has a separate random secret;
frps calls the loopback plugin to authorize Login, NewProxy, Ping and
NewWorkConn. The plugin permits only the device's allocated TCP port and proxy
name. Mapped ports are never bound to public interfaces. The center checks the
browser session and ownership for both HTTP and WebSocket requests, injects
local terminal credentials upstream, and strips browser cookies before
forwarding. Unbinding and logout close affected live browser sockets.

Sessions last 12 hours and are kept in memory. Restarting the center requires
users to log in again. Passwords use salted scrypt; login attempts are limited.
Changing a password invalidates all sessions for that account.
The device database contains terminal credentials and must remain private.

## Files to deploy

Copy `center/`, `lib/qr.js`, `lib/cli-ui.js`, `public/errors.js`, `public/online-page.css`, and `public/vendor/zhaoui.css` into the same layout
under `/opt/termdoor-center`. Install `qrcode-terminal@0.12.0` in that root.
Node.js 18+ is required. frps 0.71.0 is expected at `/usr/local/bin/frps`.

The public `/setup` page guides users through preparing the local computer,
generating a device enrollment code, and verifying the terminal connection.
Use TermDoor 0.13.0+ on the local computer for the matching `/online.html`
guide. The center address is taken from the current website origin.

`center/deploy/bootstrap.sh` targets a Linux server with systemd and nginx.
It creates a restricted system user, issues a Let's Encrypt certificate using
the HTTP webroot challenge, installs systemd services, validates nginx and
reloads it. Set `TERMDOOR_CENTER_DOMAIN` to your actual domain before running
the script as root. The example domain is not a hosted service. The script
writes the public URL to `/etc/termdoor-center.env`, loaded by the systemd unit.
The default nginx binary is `/usr/sbin/nginx`, and its site configuration is
`/etc/nginx/conf.d/termdoor-center.conf`. Override these with
`TERMDOOR_NGINX_BIN` and `TERMDOOR_NGINX_VHOST` for a custom installation.
Review the paths and existing site configuration before deploying. This
script enables and restarts services; it is only for the center server.
Certificate renewal runs daily
via `/etc/cron.d/termdoor-cert` and reloads nginx after renewal.

## Create another account

Stop the center while changing the file database with the admin CLI. Do not
run the CLI concurrently with the service, because both hold the store in
memory.

```bash
systemctl stop termdoor-center
cd /opt/termdoor-center
TERMDOOR_CENTER_URL=https://center.example.com TERMDOOR_CENTER_DATA=/var/lib/termdoor-center node center/admin.js create-user USERNAME
chown -R termdoor:termdoor /var/lib/termdoor-center
systemctl start termdoor-center
```

The CLI generates a random initial password and writes it to
`/var/lib/termdoor-center/USERNAME-credentials.txt` with mode 0600. It never
prints the password. Deliver it privately; users can change it after login.
The initial-credentials file does not update after a password change.

## Operations

```bash
systemctl status termdoor-center termdoor-frps
journalctl -u termdoor-center -u termdoor-frps --since '10 minutes ago'
nginx -t
```

Back up `/var/lib/termdoor-center` securely. Stop the center for a consistent
file backup. Keep certificates and the ACME account under `/opt/termdoor-acme`
and `/var/lib/termdoor-cert`. Device-side online settings live outside the
repository, in `../data/webcli/online.json`.

For local validation, use `node --test test/*.test.js` from the repository root.
The tests create isolated data directories and cover login, cross-account
denial, one-time enrollment, proxy credential handling, WebSocket forwarding,
revocation, LAN PTY operation, remote-port authentication, and config injection.
The test listeners use local ports 17701-17704 and 16000.
