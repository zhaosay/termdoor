# 接入 aimini 中枢

TermDoor 支持通过现有设备隧道访问 aimini。设备卡显示“打开 aimini”，页面、接口、上传和下载都使用同一条 HTTPS 连接。

## 本机配置

先启动 aimini。在 TermDoor 的数据目录（与 `online.json` 同目录）创建 `apps.json`，权限设为 0600：

```json
[
  {
    "id": "aimini",
    "name": "aimini 中枢",
    "type": "aimini",
    "enabled": true,
    "port": 8317,
    "keyFile": "/absolute/path/to/aimini/data/access.key"
  }
]
```

此文件由设备管理员在本机配置，不提供远程修改接口。目标固定为本机回环地址；浏览器不能指定代理主机或端口。需要支持路径前缀的 aimini 网页版本（包含 `web/path-base.js`）。首次升级 TermDoor 后重启；修改配置后等待下一次设备心跳。

## 使用与权限

登录自己的线上中心，在该设备卡点击“打开 aimini”。地址为 `/d/<device-id>/apps/aimini/`。只有设备所属账号可以访问；该账号可以查看中枢资料并调用 aimini 原有调度接口，权限等同于已登录中枢。共享线上账号也会共享这项能力，当前没有额外的只读角色。

每次请求均检查中心会话、设备归属、设备访问令牌和二次密钥。修改请求还必须通过中心的同源检查。中枢访问码只从设备上的文件读取，用于生成短时服务端会话，不传给中心或浏览器。代理使用独立 Host，远程请求不能获得 aimini 的本机自动登录及本机修改访问码权限。中心登录、注销及设备撤销沿用已有机制。

任务由现有 aimini Worker / Agent 执行。网页可访问不等于任务成功；请检查任务状态、阶段日志和产物。电脑断网、休眠或关闭时，中枢不可访问。

## 停用与排错

将 `enabled` 改为 `false` 可立即禁止新的应用请求，入口在下一次心跳后消失。删除此配置不会删除 aimini 数据。应用错误码：`TD-APP-001` 未配置、`TD-APP-002` 本机凭据不可用、`TD-APP-003` 中枢暂时不可连接。

中心更新前备份 `center/server.js`、`center/public/center.js` 和 `center/public/center.css`。只重启中心服务，不需要重启 frps。中心重启会使现有线上登录失效，需要重新登录。
