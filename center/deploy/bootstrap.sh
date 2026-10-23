#!/bin/sh
set -eu

APP=/opt/termdoor-center
DOMAIN=${TERMDOOR_CENTER_DOMAIN:-}
[ -n "$DOMAIN" ] || { node "$APP/lib/cli-ui.js" error "invalid domain"; exit 1; }
case "$DOMAIN" in
    *[!a-zA-Z0-9.-]*|.*|*..*|*.) node "$APP/lib/cli-ui.js" error "invalid domain"; exit 1 ;;
esac
NGINX=${TERMDOOR_NGINX_BIN:-/usr/sbin/nginx}
VHOST=${TERMDOOR_NGINX_VHOST:-/etc/nginx/conf.d/termdoor-center.conf}
[ -x "$NGINX" ] || { node "$APP/lib/cli-ui.js" error "nginx missing"; exit 1; }
[ -x /usr/local/bin/frps ] || { node "$APP/lib/cli-ui.js" error "frps missing"; exit 1; }

id termdoor >/dev/null 2>&1 || useradd --system --home-dir /var/lib/termdoor-center --shell /sbin/nologin termdoor
mkdir -p /var/lib/termdoor-center /var/lib/termdoor-acme/.well-known/acme-challenge /var/lib/termdoor-cert
chmod 700 /var/lib/termdoor-center /var/lib/termdoor-cert
chown termdoor:termdoor /var/lib/termdoor-center
chown -R root:root "$APP"
chmod -R go-w "$APP"
cd "$APP"
if [ ! -d node_modules/qrcode-terminal ]; then
    npm install --omit=dev --ignore-scripts --package-lock=false qrcode-terminal@0.12.0
fi

if [ ! -f /var/lib/termdoor-cert/fullchain.pem ]; then
    if [ -f "$VHOST" ]; then cp -p "$VHOST" "$VHOST.backup-$(date +%Y%m%d%H%M%S)"; fi
    sed "s/center\.example\.com/$DOMAIN/g" > "$VHOST" <<'NGINXHTTP'
server {
    listen 80;
    server_name center.example.com;
    root /var/lib/termdoor-acme;
    location ^~ /.well-known/acme-challenge/ { try_files $uri =404; }
    location / { return 503; }
}
NGINXHTTP
    "$NGINX" -t
    "$NGINX" -s reload
    mkdir -p /opt/termdoor-acme
    if [ ! -s /opt/termdoor-acme/acme.sh ]; then
        curl --connect-timeout 10 --max-time 30 -fsSL https://raw.githubusercontent.com/acmesh-official/acme.sh/master/acme.sh -o /opt/termdoor-acme/acme.sh
    fi
    chmod 700 /opt/termdoor-acme/acme.sh
    if [ ! -s "/opt/termdoor-acme/${DOMAIN}_ecc/fullchain.cer" ]; then
        /opt/termdoor-acme/acme.sh --issue --server letsencrypt --home /opt/termdoor-acme -d "$DOMAIN" -w /var/lib/termdoor-acme --keylength ec-256
    fi
    /opt/termdoor-acme/acme.sh --install-cert --home /opt/termdoor-acme -d "$DOMAIN" --ecc \
        --key-file /var/lib/termdoor-cert/privkey.pem --fullchain-file /var/lib/termdoor-cert/fullchain.pem \
        --reloadcmd "'$NGINX' -t && '$NGINX' -s reload"
    printf '%s\n' '23 3 * * * root /opt/termdoor-acme/acme.sh --cron --home /opt/termdoor-acme > /var/log/termdoor-cert-renew.log 2>&1' > /etc/cron.d/termdoor-cert
fi

sed "s/center\.example\.com/$DOMAIN/g" "$APP/center/deploy/nginx.conf" > "$VHOST"
"$NGINX" -t
printf 'TERMDOOR_CENTER_URL=https://%s\n' "$DOMAIN" > /etc/termdoor-center.env
chmod 600 /etc/termdoor-center.env
cp "$APP/center/deploy/termdoor-center.service" /etc/systemd/system/
cp "$APP/center/deploy/termdoor-frps.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable termdoor-center termdoor-frps
systemctl restart termdoor-center termdoor-frps
"$NGINX" -s reload
systemctl is-active termdoor-center termdoor-frps
