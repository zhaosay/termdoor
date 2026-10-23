# 自建线上设备中心与自定义域名

开发者需要使用自己的服务器和域名。项目不提供默认公共中心，下载或启动 TermDoor 不会自动连接任何线上中心。局域网功能可以独立使用。

本文的 `center.example.com` 是示例，所有命令中的示例域名都要替换成自己的域名。

## 域名在哪里设置

| 位置 | 设置方式 | 用途 |
| --- | --- | --- |
| 中心首次部署 | 环境变量 `TERMDOOR_CENTER_DOMAIN` | 生成 nginx 域名配置、申请 HTTPS 证书并写入服务配置 |
| 中心服务 | `/etc/termdoor-center.env` 中的 `TERMDOOR_CENTER_URL` | 中心对外地址、请求来源校验和设备连接地址 |
| 每台电脑 | 本机 TermDoor → 设置 → 设备接入 → 中心地址 | 选择要绑定的中心，保存到该电脑的数据目录 |

目前没有后台域名设置页。服务端的域名还涉及 DNS、证书和 nginx，需要由部署者配置；客户端可以直接在页面填写，无需改源码。

## 一、准备服务器与 DNS

以下部署脚本适用于有 systemd 和 nginx 的 Linux 服务器。需要：

- 一个自己的域名，将中心子域名的 A 记录指向服务器公网 IP。
- 对外开放 TCP 80 和 443；证书申请使用 80 端口，设备与浏览器使用 HTTPS/WSS 443。
- 安装 Node.js 18 或更新版本、npm、nginx、curl、tar。
- 安装 frp 0.71.0，将服务端可执行文件 `frps` 放到 `/usr/local/bin/frps`，并赋予执行权限。
- 将本仓库完整代码放到 `/opt/termdoor-center`。

如果使用 Cloudflare，SSL/TLS 模式设为 Full (strict)。不要对 `/~!frp` 和 `/api/device/*` 启用交互式人机验证，否则设备无法自动连接。

中心应用、frps 控制端口和设备映射端口只监听回环地址，无需向公网开放 16000–16999、17000、17001 或 17002。

## 二、部署中心

先检查 `center/deploy/` 下的配置，确认与服务器现有站点没有冲突。以下命令需要在服务器以 root 身份执行：

```sh
cd /opt/termdoor-center
TERMDOOR_CENTER_DOMAIN=center.example.com sh center/deploy/bootstrap.sh
```

脚本会申请证书、生成 nginx 站点配置、创建专用系统用户，并启用及重启 `termdoor-center` 和 `termdoor-frps` 服务。

如果 nginx 安装在其他位置，可以指定二进制和站点配置路径：

```sh
TERMDOOR_CENTER_DOMAIN=center.example.com \
TERMDOOR_NGINX_BIN=/your/nginx/sbin/nginx \
TERMDOOR_NGINX_VHOST=/your/nginx/conf.d/termdoor-center.conf \
sh center/deploy/bootstrap.sh
```

部署后 `/etc/termdoor-center.env` 内容类似：

```ini
TERMDOOR_CENTER_URL=https://center.example.com
```

该文件留在服务器上，不需要提交 Git。域名应使用 HTTPS 的标准 443 端口，不带子路径；中心地址必须与浏览器实际访问的地址一致。

## 三、创建中心账号

当前没有公开注册。管理员创建账号时，先停止中心，避免命令行与运行中的服务同时写数据库：

```sh
systemctl stop termdoor-center
cd /opt/termdoor-center
TERMDOOR_CENTER_URL=https://center.example.com \
TERMDOOR_CENTER_DATA=/var/lib/termdoor-center \
node center/admin.js create-user developer
chown -R termdoor:termdoor /var/lib/termdoor-center
systemctl start termdoor-center
```

生成的用户名与初始密码保存在 `/var/lib/termdoor-center/developer-credentials.txt`，权限为 600。管理员在服务器本机读取后私下交给账号使用者；不要提交或公开此文件。登录中心后可以修改密码。

## 四、接入电脑

1. 浏览器访问自己的中心地址并登录，点击「设备接入」进入 `/setup` 三步向导，获取设备接入码；设备接入码有效期为 10 分钟。
2. 在目标电脑更新到 TermDoor 0.13.0 或更新版本，保存终端工作并重启服务。
3. 用目标电脑自己的浏览器打开 `http://localhost:3050`，端口按实际配置，完成原有身份验证。
4. 打开 `http://localhost:3050/online.html` 独立接入网页，或从「设置 → 设备接入」进入。中心地址填写自己的 `https://center.example.com`，再填设备接入码，点击「接入这台电脑」。中心网站也提供「打开本机接入网页」按钮，自动带入当前中心地址。
5. 等中心设备列表显示「在线」，点击「打开终端」。每台电脑使用单独的设备接入码。

本地端会寻找 frpc，缺少时尝试下载并校验 frp 0.71.0。如果网络无法访问 GitHub，可自行安装对应系统的 frpc，在启动 TermDoor 前设置 `WEBCLI_FRPC_PATH` 为其可执行文件绝对路径。Windows 使用 `frpc.exe`。

线上中心地址和设备凭证保存在电脑上的 `../data/webcli/online.json`，位于项目目录之外；文件包含设备密钥，不要上传 GitHub。重启 TermDoor 时会尝试恢复已保存的连接。

## 五、常见问题

- 没有「设备接入」入口：更新并重启服务后刷新页面，或直接打开 `http://localhost:3050/online.html`（端口按实际配置，需 0.12.1 或更新版本）。新版入口始终可见，权限不足时会显示说明；执行绑定仍须在目标电脑上访问 `localhost` 主端口。
- 设备接入码无效：重新生成设备接入码，确认未过期、未被其他电脑使用，而且中心地址填写正确。
- 绑定后离线：检查客户端错误提示、frpc 安装、域名 HTTPS 证书及中心服务状态；Cloudflare 验证页也可能拦截机器请求。
- 请求来源无效：检查 `/etc/termdoor-center.env` 的地址与浏览器域名一致，再重启中心。nginx 需要保留 Host 与 WebSocket 升级头。

服务器排查命令：

```sh
systemctl status termdoor-center termdoor-frps
journalctl -u termdoor-center -u termdoor-frps --since '10 minutes ago'
nginx -t
```

## 六、更换域名

先为新域名配置 DNS、证书和 nginx，再修改 `/etc/termdoor-center.env` 的 `TERMDOOR_CENTER_URL`，重启中心服务。只修改环境变量不会自动更新证书或 nginx。更换域名会影响已有登录和连接，应安排维护时间。

每台电脑的中心地址在绑定期间锁定。更换中心地址时，先在本机「设备接入」断开，在中心清理旧设备记录，再生成新设备接入码，使用新域名重新绑定。
