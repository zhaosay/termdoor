(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TermDoorErrors = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const catalog = [
    {"code": "TD-AUTH-001", "key": "invalid token", "zh": "本机访问令牌无效", "en": "Invalid local access token", "hint": "请使用本机最新访问链接 / Use the latest local access link."},
    {"code": "TD-AUTH-002", "key": "invalid key", "zh": "本机二次密钥无效", "en": "Invalid local secondary key", "hint": "运行 auth.sh status 或 auth.bat status / Run auth.sh status or auth.bat status."},
    {"code": "TD-AUTH-003", "key": "too many attempts", "zh": "验证次数过多", "en": "Too many authentication attempts", "hint": "等待五分钟再试 / Wait five minutes and retry."},
    {"code": "TD-AUTH-004", "key": "bad origin", "zh": "请求来源不受信任", "en": "Untrusted request origin", "hint": "从 TermDoor 原始地址打开页面 / Open the original TermDoor address."},
    {"code": "TD-AUTH-005", "key": "local only", "zh": "此操作仅限本机", "en": "This action requires local access", "hint": "在目标电脑访问 localhost 主端口 / Use localhost on the target computer."},
    {"code": "TD-HTTP-400", "key": "invalid json", "zh": "请求内容不是有效 JSON", "en": "Invalid JSON request", "hint": "检查请求格式后重试 / Check the request format and retry."},
    {"code": "TD-HTTP-404", "key": "Not found", "zh": "找不到页面或资源", "en": "Page or resource not found", "hint": "检查地址并刷新页面 / Check the address and refresh."},
    {"code": "TD-HTTP-405", "key": "method not allowed", "zh": "不支持此请求方法", "en": "Request method not allowed", "hint": "更新客户端后重试 / Update the client and retry."},
    {"code": "TD-HTTP-413", "key": "file too large", "zh": "文件超过上传限制", "en": "File exceeds the upload limit", "hint": "缩小文件后重试 / Reduce the file size and retry."},
    {"code": "TD-HTTP-500", "key": "internal error", "zh": "服务处理出错", "en": "Internal server error", "hint": "查看服务日志中的错误码 / Check the error code in the service log."},
    {"code": "TD-INPUT-001", "key": "name required", "zh": "请填写设备名称", "en": "Device name is required", "hint": "填写名称后重试 / Enter a name and retry."},
    {"code": "TD-INPUT-002", "key": "label and command required", "zh": "请填写名称和命令", "en": "Label and command are required", "hint": "补全两个字段 / Complete both fields."},
    {"code": "TD-INPUT-003", "key": "too many quick commands", "zh": "快捷命令数量已达上限", "en": "Quick command limit reached", "hint": "删除不用的命令后再添加 / Remove unused commands first."},
    {"code": "TD-FRP-001", "key": "remote port not configured", "zh": "尚未配置远程端口", "en": "Remote port is not configured", "hint": "参考 README 配置远程端口 / Configure the remote port using the README."},
    {"code": "TD-FRP-002", "key": "invalid body", "zh": "配置格式无效", "en": "Invalid configuration format", "hint": "刷新配置页后重试 / Refresh the settings page and retry."},
    {"code": "TD-FRP-003", "key": "invalid serverAddr", "zh": "frp 服务器地址无效", "en": "Invalid frp server address", "hint": "只填写主机名或 IPv4 / Enter a hostname or IPv4 address."},
    {"code": "TD-FRP-004", "key": "invalid serverPort", "zh": "frp 控制端口无效", "en": "Invalid frp control port", "hint": "填写 1 到 65535 的整数 / Enter an integer from 1 to 65535."},
    {"code": "TD-FRP-005", "key": "invalid remotePort", "zh": "frp 映射端口无效", "en": "Invalid frp mapped port", "hint": "填写 1 到 65535 的整数 / Enter an integer from 1 to 65535."},
    {"code": "TD-FRP-006", "key": "invalid proxyName", "zh": "frp 代理名无效", "en": "Invalid frp proxy name", "hint": "使用字母、数字、下划线或短横线，最多 40 字符 / Use up to 40 letters, digits, underscores or hyphens."},
    {"code": "TD-FRP-008", "key": "token required", "zh": "尚未填写 frp 服务令牌", "en": "frp service token is required", "hint": "填写管理员提供的令牌 / Enter the token provided by the administrator."},
    {"code": "TD-FRP-009", "key": "frp settings failed", "zh": "无法处理 frp 配置", "en": "Unable to process frp settings", "hint": "检查数据目录权限 / Check data directory permissions."},
    {"code": "TD-HTTP-501", "key": "quick commands failed", "zh": "无法保存快捷命令", "en": "Unable to save quick commands", "hint": "检查数据目录权限 / Check data directory permissions."},
    {"code": "TD-UPLOAD-001", "key": "upload failed", "zh": "上传失败", "en": "Upload failed", "hint": "检查文件大小、网络和目录权限 / Check file size, network and directory permissions."},
    {"code": "TD-NET-001", "key": "Failed to fetch", "zh": "无法连接服务", "en": "Unable to reach the service", "hint": "检查服务是否运行及网络连接 / Check that the service is running and the network is connected."},
    {"code": "TD-NET-002", "key": "fetch failed", "zh": "无法连接服务", "en": "Unable to reach the service", "hint": "检查服务地址、HTTPS 证书与网络 / Check the address, HTTPS certificate and network."},
    {"code": "TD-NET-003", "key": "Device unavailable", "zh": "设备暂时无法连接", "en": "Device is unavailable", "hint": "在本机设备接入页检查连接状态 / Check connection status on the local enrollment page."},
    {"code": "TD-NET-004", "key": "connection lost", "zh": "终端连接已断开，正在重连", "en": "Terminal disconnected; reconnecting", "hint": "保持页面打开，检查网络与服务 / Keep this page open and check the network and service."},
    {"code": "TD-NET-005", "key": "connection timeout", "zh": "等待服务恢复超时", "en": "Timed out waiting for the service", "hint": "查看服务日志后刷新页面 / Check service logs and refresh the page."},
    {"code": "TD-PTY-001", "key": "failed to start shell", "zh": "无法启动终端 Shell", "en": "Unable to start the terminal shell", "hint": "检查 Shell 路径及 node-pty 安装 / Check the shell path and node-pty installation."},
    {"code": "TD-PTY-002", "key": "session limit", "zh": "终端会话数量已达上限", "en": "Terminal session limit reached", "hint": "关闭不用的会话后重试 / Close unused sessions and retry."},
    {"code": "TD-SYS-001", "key": "EADDRINUSE", "zh": "端口已被占用", "en": "Port is already in use", "hint": "检查占用进程或更改端口 / Check the owning process or choose another port."},
    {"code": "TD-SYS-002", "key": "EACCES", "zh": "没有足够的访问权限", "en": "Permission denied", "hint": "检查文件或端口权限 / Check file or port permissions."},
    {"code": "TD-SYS-003", "key": "ENOENT", "zh": "所需文件或程序不存在", "en": "Required file or program was not found", "hint": "检查路径和安装状态 / Check the path and installation."},
    {"code": "TD-SYS-004", "key": "uncaught exception", "zh": "服务遇到异常，正在安全退出", "en": "Unexpected exception; shutting down safely", "hint": "保留错误码并检查服务日志 / Keep the error code and inspect service logs."},
    {"code": "TD-SYS-005", "key": "unhandled rejection", "zh": "异步任务失败，正在安全退出", "en": "Async task failed; shutting down safely", "hint": "保留错误码并检查服务日志 / Keep the error code and inspect service logs."},
    {"code": "TD-TLS-001", "key": "TLS setup failed", "zh": "HTTPS 证书准备失败", "en": "HTTPS certificate setup failed", "hint": "检查 openssl 与证书文件，服务将回退 HTTP / Check openssl and certificate files; falling back to HTTP."},
    {"code": "TD-TOKEN-001", "key": "token missing", "zh": "尚未生成本机访问令牌", "en": "Local access token has not been generated", "hint": "先启动一次服务 / Start the service once."},
    {"code": "TD-TOKEN-002", "key": "token empty", "zh": "本机访问令牌文件为空", "en": "Local access token file is empty", "hint": "运行 token.sh regen 或 token.bat regen / Run token.sh regen or token.bat regen."},
    {"code": "TD-CENTER-001", "key": "设备接入码无效、已使用或已过期，请在「设备接入」页面重新生成", "zh": "设备接入码无效、已使用或已过期", "en": "Enrollment code is invalid, used or expired", "hint": "在中心设备接入页生成新码 / Generate a new code on the center enrollment page."},
    {"code": "TD-CENTER-002", "key": "设备数量已达上限", "zh": "设备数量已达上限", "en": "Device limit reached", "hint": "移除不用的设备后重试 / Remove unused devices and retry."},
    {"code": "TD-CENTER-003", "key": "设备凭证无效", "zh": "设备凭证无效", "en": "Invalid device credentials", "hint": "更新本机 TermDoor 后重新接入 / Update local TermDoor and enroll again."},
    {"code": "TD-CENTER-004", "key": "无可用端口", "zh": "中心无可用设备端口", "en": "No device ports available on the center", "hint": "联系中心管理员 / Contact the center administrator."},
    {"code": "TD-CENTER-005", "key": "设备已解绑", "zh": "设备接入已被解除", "en": "Device enrollment has been revoked", "hint": "生成新的设备接入码重新接入 / Generate a new enrollment code and enroll again."},
    {"code": "TD-CENTER-006", "key": "请求来源无效", "zh": "请求来源无效", "en": "Invalid request origin", "hint": "从中心原始地址访问 / Open the original center address."},
    {"code": "TD-CENTER-007", "key": "尝试次数过多，请 5 分钟后重试", "zh": "登录尝试次数过多", "en": "Too many login attempts", "hint": "五分钟后重试 / Retry in five minutes."},
    {"code": "TD-CENTER-008", "key": "用户名或密码错误", "zh": "中心账号或密码错误", "en": "Incorrect center account or password", "hint": "确认账号密码或联系管理员 / Check your credentials or contact the administrator."},
    {"code": "TD-CENTER-009", "key": "请先登录", "zh": "请先登录中心", "en": "Sign in to the center first", "hint": "使用中心账号与密码登录 / Sign in with your center account and password."},
    {"code": "TD-CENTER-010", "key": "新密码需要 12 到 256 个字符", "zh": "新密码需要 12 到 256 个字符", "en": "Password must contain 12 to 256 characters", "hint": "调整密码长度后重试 / Adjust password length and retry."},
    {"code": "TD-CENTER-011", "key": "当前密码错误", "zh": "当前中心密码错误", "en": "Incorrect current center password", "hint": "检查当前密码后重试 / Check the current password and retry."},
    {"code": "TD-CENTER-012", "key": "有效设备接入码过多，请使用已有接入码或等待过期后再生成", "zh": "有效设备接入码过多", "en": "Too many active enrollment codes", "hint": "使用已有接入码或等待过期 / Use an existing code or wait for expiry."},
    {"code": "TD-CENTER-013", "key": "设备不存在", "zh": "设备不存在或不可访问", "en": "Device not found or inaccessible", "hint": "返回设备列表重新选择 / Return to the device list and select again."},
    {"code": "TD-CENTER-014", "key": "此操作仅可在本机执行", "zh": "此操作仅可在本机执行", "en": "This action is only available locally", "hint": "在目标电脑访问 localhost 主端口 / Use localhost on the target computer."},
    {"code": "TD-CENTER-015", "key": "请求处理失败", "zh": "无法处理中心请求", "en": "Unable to process the center request", "hint": "检查请求格式，仍失败时联系管理员 / Check the request format; contact the administrator if it persists."},
    {"code": "TD-CENTER-016", "key": "TERMDOOR_CENTER_URL must be an HTTPS origin on port 443", "zh": "中心地址配置无效", "en": "Invalid center address configuration", "hint": "将 TERMDOOR_CENTER_URL 设为 HTTPS 域名，使用 443 端口 / Set TERMDOOR_CENTER_URL to an HTTPS origin on port 443."},
    {"code": "TD-CENTER-017", "key": "Body too large", "zh": "请求内容超过限制", "en": "Request body is too large", "hint": "缩小请求内容 / Reduce the request size."},
    {"code": "TD-CENTER-018", "key": "User already exists", "zh": "中心账号已存在", "en": "Center account already exists", "hint": "使用另一个账号名称 / Choose another account name."},
    {"code": "TD-CENTER-019", "key": "Usage: node center/admin.js create-user USERNAME", "zh": "创建中心账号的参数不完整", "en": "Missing arguments for account creation", "hint": "运行 node center/admin.js create-user USERNAME / Run node center/admin.js create-user USERNAME."},
    {"code": "TD-ONLINE-001", "key": "请安装 frpc，并通过 WEBCLI_FRPC_PATH 指定路径", "zh": "当前系统需要手动安装 frpc", "en": "Manual frpc installation is required on this platform", "hint": "通过 WEBCLI_FRPC_PATH 指定可执行文件 / Set WEBCLI_FRPC_PATH to the executable."},
    {"code": "TD-ONLINE-002", "key": "无法获取 frpc 下载信息，请先手动安装 frpc", "zh": "无法获取 frpc 下载信息", "en": "Unable to retrieve frpc release information", "hint": "检查 GitHub 连接或手动安装 frpc / Check GitHub connectivity or install frpc manually."},
    {"code": "TD-ONLINE-003", "key": "frpc 下载缺少可信校验信息", "zh": "frpc 下载缺少可信校验信息", "en": "frpc download lacks trusted verification data", "hint": "使用可信来源手动安装 frpc / Install frpc manually from a trusted source."},
    {"code": "TD-ONLINE-004", "key": "frpc 下载失败", "zh": "frpc 下载失败", "en": "frpc download failed", "hint": "检查网络或手动安装 frpc / Check the network or install frpc manually."},
    {"code": "TD-ONLINE-005", "key": "frpc 校验失败", "zh": "frpc 文件校验失败，已停止安装", "en": "frpc verification failed; installation stopped", "hint": "检查网络后重试，勿使用此下载文件 / Check the network and retry; do not use this download."},
    {"code": "TD-ONLINE-006", "key": "中心地址必须是 HTTPS 域名，例如 https://center.example.com", "zh": "中心地址格式无效", "en": "Invalid center address format", "hint": "填写 HTTPS 域名，例如 https://center.example.com / Enter an HTTPS origin, e.g. https://center.example.com."},
    {"code": "TD-ONLINE-007", "key": "设备接入码应为 16 位字符，请在线上中心的「设备接入」页面生成", "zh": "设备接入码需要 16 位字符", "en": "Enrollment code must contain 16 characters", "hint": "在中心设备接入页生成并复制 / Generate and copy it from the center enrollment page."},
    {"code": "TD-ONLINE-008", "key": "请先断开当前线上连接，再绑定新的中心", "zh": "这台电脑已经接入中心", "en": "This computer is already enrolled", "hint": "先断开当前接入再更换中心 / Disconnect before changing centers."},
    {"code": "TD-ONLINE-009", "key": "正在接入设备，请等待当前操作完成", "zh": "设备正在接入", "en": "Device enrollment is in progress", "hint": "等待当前操作完成 / Wait for the current operation to finish."},
    {"code": "TD-ONLINE-010", "key": "接入已取消", "zh": "设备接入已取消", "en": "Device enrollment cancelled", "hint": "需要时重新发起接入 / Start enrollment again if needed."},
    {"code": "TD-ONLINE-011", "key": "接入已取消，请在中心检查并清理刚登记的设备", "zh": "接入取消时设备可能已登记", "en": "Device may have registered before cancellation", "hint": "到中心检查并清理设备记录 / Check and remove the device record on the center."},
    {"code": "TD-ONLINE-012", "key": "中心返回了无效的设备配置", "zh": "中心返回的设备配置无效", "en": "Center returned invalid device settings", "hint": "检查中心版本与配置 / Check the center version and configuration."},
    {"code": "TD-CLI-001", "key": "update failed", "zh": "代码更新失败", "en": "Code update failed", "hint": "先备份并处理本地改动，再重新更新 / Back up and resolve local changes before retrying."},
    {"code": "TD-CLI-002", "key": "install failed", "zh": "依赖安装失败", "en": "Dependency installation failed", "hint": "检查网络和 Node.js，重新运行 npm install / Check network and Node.js, then run npm install."},
    {"code": "TD-CLI-003", "key": "start failed", "zh": "服务启动失败", "en": "Service failed to start", "hint": "查看下方日志中的错误码 / Check the error code in the log below."},
    {"code": "TD-CLI-004", "key": "not running", "zh": "服务尚未运行", "en": "Service is not running", "hint": "先启动 TermDoor / Start TermDoor first."},
    {"code": "TD-CLI-005", "key": "invalid port", "zh": "端口设置无效", "en": "Invalid port setting", "hint": "填写 1 到 65535 的整数 / Enter an integer from 1 to 65535."},
    {"code": "TD-CLI-006", "key": "invalid choice", "zh": "没有这个选项", "en": "Unknown menu option", "hint": "输入菜单中显示的编号 / Enter one of the listed menu numbers."},
    {"code": "TD-FRP-007", "key": "invalid frp token", "zh": "frp 服务令牌无效", "en": "Invalid frp service token", "hint": "检查令牌格式 / Check the token format."},
    {"code": "TD-INPUT-004", "key": "invalid local address", "zh": "本机地址无效", "en": "Invalid local address", "hint": "填写 localhost 主端口，例如 http://localhost:3050 / Enter the localhost main port, e.g. http://localhost:3050."},
    {"code": "TD-CLIP-001", "key": "clipboard failed", "zh": "无法自动复制", "en": "Unable to copy automatically", "hint": "选中内容后手动复制 / Select the text and copy manually."},
    {"code": "TD-DEPLOY-001", "key": "invalid domain", "zh": "中心域名配置无效", "en": "Invalid center domain configuration", "hint": "设置 TERMDOOR_CENTER_DOMAIN 为自己的域名 / Set TERMDOOR_CENTER_DOMAIN to your own hostname."},
    {"code": "TD-DEPLOY-002", "key": "nginx missing", "zh": "找不到 nginx 可执行文件", "en": "nginx executable was not found", "hint": "安装 nginx 或设置 TERMDOOR_NGINX_BIN / Install nginx or set TERMDOOR_NGINX_BIN."},
    {"code": "TD-DEPLOY-003", "key": "frps missing", "zh": "找不到 frps 可执行文件", "en": "frps executable was not found", "hint": "安装 frps 0.71.0 到 /usr/local/bin/frps / Install frps 0.71.0 at /usr/local/bin/frps."},
    {"code": "TD-NET-006", "key": "The operation was aborted due to timeout", "zh": "连接超时", "en": "Connection timed out", "hint": "检查服务状态与网络后重试 / Check service status and network, then retry."},
    {"code": "TD-NET-007", "key": "NetworkError when attempting to fetch resource.", "zh": "网络请求失败", "en": "Network request failed", "hint": "检查网络与服务地址 / Check the network and service address."},
    {"code": "TD-SYS-006", "key": "MODULE_NOT_FOUND", "zh": "缺少所需的程序依赖", "en": "A required program dependency is missing", "hint": "在项目目录运行 npm install 后重试 / Run npm install in the project directory and retry."}
  ];
  const lookup = new Map(catalog.flatMap((entry) => [[entry.key, entry], [entry.code, entry]]));
  const fallback = { code: 'TD-UNKNOWN-001', zh: '操作失败', en: 'Operation failed', hint: '检查服务日志或联系管理员 / Check service logs or contact the administrator.' };
  function describe(value, status) {
    if (value && value.errorCode && value.errorText) return value;
    const key = typeof value === 'string' ? value : value?.error || value?.code || value?.message;
    const entry = lookup.get(key) || lookup.get(value?.message) || ({401: lookup.get('invalid token'), 403: lookup.get('local only'), 404: lookup.get('Not found'), 429: lookup.get('too many attempts'), 500: lookup.get('internal error'), 502: lookup.get('Device unavailable')}[status]) || fallback;
    return { errorCode: entry.code, errorZh: entry.zh, errorEn: entry.en, hint: entry.hint,
      errorText: `[${entry.code}] ${entry.zh} / ${entry.en}\n${entry.hint}` };
  }
  function enrich(data, status) {
    if (data?.errorCode) return data;
    return data && typeof data.error === 'string' && data.error ? { ...data, ...describe(data.error, status) } : data;
  }
  function format(value, status) {
    const text = typeof value === 'string' ? value : value?.errorText || value?.message;
    if (typeof text === 'string' && /^\[TD-[A-Z]+-\d+\]/.test(text)) return text;
    return describe(value, status).errorText;
  }
  return { catalog, describe, enrich, format };
});
