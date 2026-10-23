# 错误码 / Error Codes

TermDoor 的网页、接口与终端共用 `public/errors.js` 错误目录。错误码一经发布，不更换用途。

每条错误包含：稳定编号、中文原因、英文原因和处理建议。接口保留原有 `error` 字段，新增 `errorCode`、`errorZh`、`errorEn`、`hint`、`errorText`，旧客户端仍然兼容。

无法识别的异常显示 `TD-UNKNOWN-001`，不会直接向用户展示可能包含令牌或本机路径的异常文本。管理员可在本机设置 `TERMDOOR_DEBUG=1` 查看原始技术堆栈；请勿公开原始日志。Git、npm、Shell 与操作系统自身的输出保留原样，TermDoor 在可处理的失败出口追加自己的双语错误说明。

颜色遵循 TTY 检测及 `NO_COLOR`；`TERM=dumb` 与日志重定向使用纯文本。`FORCE_COLOR=1` 可用于预览；`NO_COLOR` 优先。

| 序号 | 错误码 | 中文 | English | 处理建议 / Next Step |
| --- | --- | --- | --- | --- |
| 1 | `TD-AUTH-001` | 本机访问令牌无效 | Invalid local access token | 请使用本机最新访问链接 / Use the latest local access link. |
| 2 | `TD-AUTH-002` | 本机二次密钥无效 | Invalid local secondary key | 运行 auth.sh status 或 auth.bat status / Run auth.sh status or auth.bat status. |
| 3 | `TD-AUTH-003` | 验证次数过多 | Too many authentication attempts | 等待五分钟再试 / Wait five minutes and retry. |
| 4 | `TD-AUTH-004` | 请求来源不受信任 | Untrusted request origin | 从 TermDoor 原始地址打开页面 / Open the original TermDoor address. |
| 5 | `TD-AUTH-005` | 此操作仅限本机 | This action requires local access | 在目标电脑访问 localhost 主端口 / Use localhost on the target computer. |
| 6 | `TD-HTTP-400` | 请求内容不是有效 JSON | Invalid JSON request | 检查请求格式后重试 / Check the request format and retry. |
| 7 | `TD-HTTP-404` | 找不到页面或资源 | Page or resource not found | 检查地址并刷新页面 / Check the address and refresh. |
| 8 | `TD-HTTP-405` | 不支持此请求方法 | Request method not allowed | 更新客户端后重试 / Update the client and retry. |
| 9 | `TD-HTTP-413` | 文件超过上传限制 | File exceeds the upload limit | 缩小文件后重试 / Reduce the file size and retry. |
| 10 | `TD-HTTP-500` | 服务处理出错 | Internal server error | 查看服务日志中的错误码 / Check the error code in the service log. |
| 11 | `TD-INPUT-001` | 请填写设备名称 | Device name is required | 填写名称后重试 / Enter a name and retry. |
| 12 | `TD-INPUT-002` | 请填写名称和命令 | Label and command are required | 补全两个字段 / Complete both fields. |
| 13 | `TD-INPUT-003` | 快捷命令数量已达上限 | Quick command limit reached | 删除不用的命令后再添加 / Remove unused commands first. |
| 14 | `TD-FRP-001` | 尚未配置远程端口 | Remote port is not configured | 参考 README 配置远程端口 / Configure the remote port using the README. |
| 15 | `TD-FRP-002` | 配置格式无效 | Invalid configuration format | 刷新配置页后重试 / Refresh the settings page and retry. |
| 16 | `TD-FRP-003` | frp 服务器地址无效 | Invalid frp server address | 只填写主机名或 IPv4 / Enter a hostname or IPv4 address. |
| 17 | `TD-FRP-004` | frp 控制端口无效 | Invalid frp control port | 填写 1 到 65535 的整数 / Enter an integer from 1 to 65535. |
| 18 | `TD-FRP-005` | frp 映射端口无效 | Invalid frp mapped port | 填写 1 到 65535 的整数 / Enter an integer from 1 to 65535. |
| 19 | `TD-FRP-006` | frp 代理名无效 | Invalid frp proxy name | 使用字母、数字、下划线或短横线，最多 40 字符 / Use up to 40 letters, digits, underscores or hyphens. |
| 20 | `TD-FRP-008` | 尚未填写 frp 服务令牌 | frp service token is required | 填写管理员提供的令牌 / Enter the token provided by the administrator. |
| 21 | `TD-FRP-009` | 无法处理 frp 配置 | Unable to process frp settings | 检查数据目录权限 / Check data directory permissions. |
| 22 | `TD-HTTP-501` | 无法保存快捷命令 | Unable to save quick commands | 检查数据目录权限 / Check data directory permissions. |
| 23 | `TD-UPLOAD-001` | 上传失败 | Upload failed | 检查文件大小、网络和目录权限 / Check file size, network and directory permissions. |
| 24 | `TD-NET-001` | 无法连接服务 | Unable to reach the service | 检查服务是否运行及网络连接 / Check that the service is running and the network is connected. |
| 25 | `TD-NET-002` | 无法连接服务 | Unable to reach the service | 检查服务地址、HTTPS 证书与网络 / Check the address, HTTPS certificate and network. |
| 26 | `TD-NET-003` | 设备暂时无法连接 | Device is unavailable | 在本机设备接入页检查连接状态 / Check connection status on the local enrollment page. |
| 27 | `TD-NET-004` | 终端连接已断开，正在重连 | Terminal disconnected; reconnecting | 保持页面打开，检查网络与服务 / Keep this page open and check the network and service. |
| 28 | `TD-NET-005` | 等待服务恢复超时 | Timed out waiting for the service | 查看服务日志后刷新页面 / Check service logs and refresh the page. |
| 29 | `TD-PTY-001` | 无法启动终端 Shell | Unable to start the terminal shell | 检查 Shell 路径及 node-pty 安装 / Check the shell path and node-pty installation. |
| 30 | `TD-PTY-002` | 终端会话数量已达上限 | Terminal session limit reached | 关闭不用的会话后重试 / Close unused sessions and retry. |
| 31 | `TD-SYS-001` | 端口已被占用 | Port is already in use | 检查占用进程或更改端口 / Check the owning process or choose another port. |
| 32 | `TD-SYS-002` | 没有足够的访问权限 | Permission denied | 检查文件或端口权限 / Check file or port permissions. |
| 33 | `TD-SYS-003` | 所需文件或程序不存在 | Required file or program was not found | 检查路径和安装状态 / Check the path and installation. |
| 34 | `TD-SYS-004` | 服务遇到异常，正在安全退出 | Unexpected exception; shutting down safely | 保留错误码并检查服务日志 / Keep the error code and inspect service logs. |
| 35 | `TD-SYS-005` | 异步任务失败，正在安全退出 | Async task failed; shutting down safely | 保留错误码并检查服务日志 / Keep the error code and inspect service logs. |
| 36 | `TD-TLS-001` | HTTPS 证书准备失败 | HTTPS certificate setup failed | 检查 openssl 与证书文件，服务将回退 HTTP / Check openssl and certificate files; falling back to HTTP. |
| 37 | `TD-TOKEN-001` | 尚未生成本机访问令牌 | Local access token has not been generated | 先启动一次服务 / Start the service once. |
| 38 | `TD-TOKEN-002` | 本机访问令牌文件为空 | Local access token file is empty | 运行 token.sh regen 或 token.bat regen / Run token.sh regen or token.bat regen. |
| 39 | `TD-CENTER-001` | 设备接入码无效、已使用或已过期 | Enrollment code is invalid, used or expired | 在中心设备接入页生成新码 / Generate a new code on the center enrollment page. |
| 40 | `TD-CENTER-002` | 设备数量已达上限 | Device limit reached | 移除不用的设备后重试 / Remove unused devices and retry. |
| 41 | `TD-CENTER-003` | 设备凭证无效 | Invalid device credentials | 更新本机 TermDoor 后重新接入 / Update local TermDoor and enroll again. |
| 42 | `TD-CENTER-004` | 中心无可用设备端口 | No device ports available on the center | 联系中心管理员 / Contact the center administrator. |
| 43 | `TD-CENTER-005` | 设备接入已被解除 | Device enrollment has been revoked | 生成新的设备接入码重新接入 / Generate a new enrollment code and enroll again. |
| 44 | `TD-CENTER-006` | 请求来源无效 | Invalid request origin | 从中心原始地址访问 / Open the original center address. |
| 45 | `TD-CENTER-007` | 登录尝试次数过多 | Too many login attempts | 五分钟后重试 / Retry in five minutes. |
| 46 | `TD-CENTER-008` | 中心账号或密码错误 | Incorrect center account or password | 确认账号密码或联系管理员 / Check your credentials or contact the administrator. |
| 47 | `TD-CENTER-009` | 请先登录中心 | Sign in to the center first | 使用中心账号与密码登录 / Sign in with your center account and password. |
| 48 | `TD-CENTER-010` | 新密码需要 10 到 256 个字符 | Password must contain 10 to 256 characters | 调整密码长度后重试 / Adjust password length and retry. |
| 49 | `TD-CENTER-011` | 当前中心密码错误 | Incorrect current center password | 检查当前密码后重试 / Check the current password and retry. |
| 50 | `TD-CENTER-012` | 有效设备接入码过多 | Too many active enrollment codes | 使用已有接入码或等待过期 / Use an existing code or wait for expiry. |
| 51 | `TD-CENTER-013` | 设备不存在或不可访问 | Device not found or inaccessible | 返回设备列表重新选择 / Return to the device list and select again. |
| 52 | `TD-CENTER-014` | 此操作仅可在本机执行 | This action is only available locally | 在目标电脑访问 localhost 主端口 / Use localhost on the target computer. |
| 53 | `TD-CENTER-015` | 无法处理中心请求 | Unable to process the center request | 检查请求格式，仍失败时联系管理员 / Check the request format; contact the administrator if it persists. |
| 54 | `TD-CENTER-016` | 中心地址配置无效 | Invalid center address configuration | 将 TERMDOOR_CENTER_URL 设为 HTTPS 域名，使用 443 端口 / Set TERMDOOR_CENTER_URL to an HTTPS origin on port 443. |
| 55 | `TD-CENTER-017` | 请求内容超过限制 | Request body is too large | 缩小请求内容 / Reduce the request size. |
| 56 | `TD-CENTER-018` | 中心账号已存在 | Center account already exists | 使用另一个账号名称 / Choose another account name. |
| 57 | `TD-CENTER-019` | 创建中心账号的参数不完整 | Missing arguments for account creation | 运行 node center/admin.js create-user USERNAME / Run node center/admin.js create-user USERNAME. |
| 58 | `TD-ONLINE-001` | 当前系统需要手动安装 frpc | Manual frpc installation is required on this platform | 通过 WEBCLI_FRPC_PATH 指定可执行文件 / Set WEBCLI_FRPC_PATH to the executable. |
| 59 | `TD-ONLINE-002` | 无法获取 frpc 下载信息 | Unable to retrieve frpc release information | 检查 GitHub 连接或手动安装 frpc / Check GitHub connectivity or install frpc manually. |
| 60 | `TD-ONLINE-003` | frpc 下载缺少可信校验信息 | frpc download lacks trusted verification data | 使用可信来源手动安装 frpc / Install frpc manually from a trusted source. |
| 61 | `TD-ONLINE-004` | frpc 下载失败 | frpc download failed | 检查网络或手动安装 frpc / Check the network or install frpc manually. |
| 62 | `TD-ONLINE-005` | frpc 文件校验失败，已停止安装 | frpc verification failed; installation stopped | 检查网络后重试，勿使用此下载文件 / Check the network and retry; do not use this download. |
| 63 | `TD-ONLINE-006` | 中心地址格式无效 | Invalid center address format | 填写 HTTPS 域名，例如 https://center.example.com / Enter an HTTPS origin, e.g. https://center.example.com. |
| 64 | `TD-ONLINE-007` | 设备接入码需要 16 位字符 | Enrollment code must contain 16 characters | 在中心设备接入页生成并复制 / Generate and copy it from the center enrollment page. |
| 65 | `TD-ONLINE-008` | 这台电脑已经接入中心 | This computer is already enrolled | 先断开当前接入再更换中心 / Disconnect before changing centers. |
| 66 | `TD-ONLINE-009` | 设备正在接入 | Device enrollment is in progress | 等待当前操作完成 / Wait for the current operation to finish. |
| 67 | `TD-ONLINE-010` | 设备接入已取消 | Device enrollment cancelled | 需要时重新发起接入 / Start enrollment again if needed. |
| 68 | `TD-ONLINE-011` | 接入取消时设备可能已登记 | Device may have registered before cancellation | 到中心检查并清理设备记录 / Check and remove the device record on the center. |
| 69 | `TD-ONLINE-012` | 中心返回的设备配置无效 | Center returned invalid device settings | 检查中心版本与配置 / Check the center version and configuration. |
| 70 | `TD-CLI-001` | 代码更新失败 | Code update failed | 先备份并处理本地改动，再重新更新 / Back up and resolve local changes before retrying. |
| 71 | `TD-CLI-002` | 依赖安装失败 | Dependency installation failed | 检查网络和 Node.js，重新运行 npm install / Check network and Node.js, then run npm install. |
| 72 | `TD-CLI-003` | 服务启动失败 | Service failed to start | 查看下方日志中的错误码 / Check the error code in the log below. |
| 73 | `TD-CLI-004` | 服务尚未运行 | Service is not running | 先启动 TermDoor / Start TermDoor first. |
| 74 | `TD-CLI-005` | 端口设置无效 | Invalid port setting | 填写 1 到 65535 的整数 / Enter an integer from 1 to 65535. |
| 75 | `TD-CLI-006` | 没有这个选项 | Unknown menu option | 输入菜单中显示的编号 / Enter one of the listed menu numbers. |
| 76 | `TD-FRP-007` | frp 服务令牌无效 | Invalid frp service token | 检查令牌格式 / Check the token format. |
| 77 | `TD-INPUT-004` | 本机地址无效 | Invalid local address | 填写 localhost 主端口，例如 http://localhost:3050 / Enter the localhost main port, e.g. http://localhost:3050. |
| 78 | `TD-CLIP-001` | 无法自动复制 | Unable to copy automatically | 选中内容后手动复制 / Select the text and copy manually. |
| 79 | `TD-DEPLOY-001` | 中心域名配置无效 | Invalid center domain configuration | 设置 TERMDOOR_CENTER_DOMAIN 为自己的域名 / Set TERMDOOR_CENTER_DOMAIN to your own hostname. |
| 80 | `TD-DEPLOY-002` | 找不到 nginx 可执行文件 | nginx executable was not found | 安装 nginx 或设置 TERMDOOR_NGINX_BIN / Install nginx or set TERMDOOR_NGINX_BIN. |
| 81 | `TD-DEPLOY-003` | 找不到 frps 可执行文件 | frps executable was not found | 安装 frps 0.71.0 到 /usr/local/bin/frps / Install frps 0.71.0 at /usr/local/bin/frps. |
| 82 | `TD-NET-006` | 连接超时 | Connection timed out | 检查服务状态与网络后重试 / Check service status and network, then retry. |
| 83 | `TD-NET-007` | 网络请求失败 | Network request failed | 检查网络与服务地址 / Check the network and service address. |

| 84 | `TD-SYS-006` | 缺少所需的程序依赖 | A required program dependency is missing | 在项目目录运行 npm install 后重试 / Run npm install in the project directory and retry. |
| - | `TD-UNKNOWN-001` | 操作失败 | Operation failed | 检查服务日志或联系管理员 / Check service logs or contact the administrator. |

新增错误必须同步到目录并通过 `node --test test/*.test.js`。不能只抛出一条面向用户的裸字符串。

## 连接诊断

| 序号 | 错误码 | 中文 | English | 处理 |
| --- | --- | --- | --- | --- |
| 1 | `TD-CONNECT-001` | 设备未通信 | Device is not reporting | 在目标电脑启动 TermDoor，再点重新检查 / Start TermDoor on the target computer and retry. |
| 2 | `TD-CONNECT-002` | 通路验证失败 | Tunnel authentication failed | 在目标电脑打开设备接入页，检查本机凭据 / Open Device enrollment on the target computer and check local credentials. |
| 3 | `TD-CONNECT-003` | 通路未连通 | Tunnel is unavailable | 在目标电脑的设备接入页检查网络与连接状态，再重试 / Check network and tunnel status on the target computer, then retry. |
| 4 | `TD-CONNECT-004` | 应用未启用 | Application is not enabled | 在目标电脑的应用与维护页启用应用 / Enable the application in Applications and maintenance on the target computer. |
| 5 | `TD-CONNECT-005` | 应用访问密钥不可用 | Application access key is unavailable | 在目标电脑的应用与维护页检查密钥文件 / Check the key file in Applications and maintenance on the target computer. |
| 6 | `TD-CONNECT-006` | 应用服务未就绪 | Application service is not ready | 在目标电脑启动应用并测试连接 / Start the application on the target computer and test its connection. |
