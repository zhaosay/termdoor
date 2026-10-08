# TermDoor

浏览器里的终端之门。局域网网页终端：浏览器里操作这台电脑的真实终端。Node.js + node-pty + ws，前端 xterm.js。功能和用法见 README.md。

项目原名 webcli。只改了显示名，运行时标识符保留旧名，改动前先看下面「保留的旧名」。

## ZhaoUI 依赖

界面用的是自己的组件库 ZhaoUI（`@zhaoui/ui`，当前复制的是 0.1.0）。源在 `/Users/zhaowei/project/sheji/zhaoui/packages/ui/dist/`。

项目里复制了三个文件，没有做软链接：

| 项目里 | 来源（dist 下） |
|---|---|
| `public/vendor/zhaoui.css` | `zhaoui.min.css` |
| `public/vendor/zhaoui.js` | `zhaoui.min.js` |
| `public/vendor/zhaoui-icons.js` | `zhaoui-icons.min.js` |

- 颜色、间距、圆角、字体只用 `--zh-*` 变量，不写死数值。`public/termdoor.css` 开头把旧变量名（`--bg`、`--accent` 等）映射到了 ZhaoUI 变量。
- 主题由 `<html>` 上的 `data-mode`（light/dark）控制，不是 `data-theme`。`public/theme-init.js` 在首屏前设置，`app.js` 的设置菜单切换。
- 图标用 `<i data-i="名字">`（Lucide），不用 emoji。
- 不要为了这个项目去改 ZhaoUI 本体，要改回 sheji 项目走它自己的流程。

### 更新 ZhaoUI

1. 把上表三个文件从 dist 重新复制过来，覆盖。
2. 把 `lib/routes.js` 里 service worker 的 `CACHE` 名字加一档（现在是 `webcli-v2`）。`/vendor/` 在客户端是缓存优先，不改名的话老客户端一直用旧文件。
3. 本机亮色、暗色、手机窄屏各看一次页面，再提交。

## 保留的旧名（改了会让已部署的机器出问题）

数据目录 `../data/webcli`（token、端口、证书）、上传目录 `~/webcli-uploads`、环境变量 `WEBCLI_*`、浏览器存储键 `webcli-*`、请求头 `x-webcli-filename`、脚本 `webcli.sh/.bat/.command` 与全局命令 `webcli`、自启动项 `com.webcli.server` 和 Windows 计划任务 `webcli`。要迁移就整体写迁移步骤，不要零散地改。

## 代码约定

- 单个功能文件不超过 1000 行。`public/app.js` 现在约 980 行，已经接近，新逻辑不要往里加，放进新的小文件（参考 `public/upload.js`、`public/helpers.js`：经典脚本，函数挂全局，依赖用参数传入）。
- 新增的前端文件要在 `lib/routes.js` 的 `buildAssets()` 里注册，并在 `public/index.html` 里按顺序引入（在 `app.js` 之前）。
- 页面脚本的 CSP 是 `script-src 'self'`，不能写内联脚本。

## 验证

没有自动化测试。改前端后：用项目的临时副本起一个实例，不要碰真实数据目录。

```bash
mkdir -p /tmp/td && rsync -a --exclude .git --exclude node_modules ./ /tmp/td/termdoor/
ln -s "$PWD/node_modules" /tmp/td/termdoor/node_modules
cd /tmp/td/termdoor && WEBCLI_NO_OPEN=1 PROJECT_PORT=3077 node server.js
```

数据目录是代码目录上一级的 `data/webcli`（真实实例在 `~/data/webcli`），副本放在 `/tmp/td/termdoor` 时数据落在 `/tmp/td/data/webcli`，和真实实例隔离。用无头 Chrome 截图时，终端内容区可能是空的（WebSocket 在无头模式下不一定连得上），要在真实浏览器里确认输入输出。
