function initOnline({ authQuery, closeAllDropdowns }) {
  const row = document.getElementById('online-row');
  const dialog = document.getElementById('online-dialog');
  const info = document.getElementById('online-info');
  const center = document.getElementById('online-center');
  const code = document.getElementById('online-code');
  const button = document.getElementById('online-bind');
  const disconnect = document.getElementById('online-disconnect');
  async function call(method = 'GET', body) {
    const endpoint = `/api/online?${typeof authQuery === 'function' ? authQuery() : authQuery}`;
    const response = await terminalFetch(endpoint, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || '连接失败');
      error.status = response.status;
      throw error;
    }
    return result;
  }
  function fill(state) {
    if (state.center) center.value = state.center;
    center.disabled = state.configured; code.disabled = state.configured; button.disabled = state.configured;
    disconnect.hidden = !state.configured;
    info.textContent = state.error || (state.configured ? state.running && state.lastHeartbeat ? '已接入线上中心。请在中心设备列表确认终端通路。' : '已绑定，正在连接…' : '可选功能。绑定后可从线上访问，原有局域网功能继续可用。');
  }
  function showError(err) {
    center.disabled = true; code.disabled = true; button.disabled = true; disconnect.hidden = true;
    if (err.status === 403) info.textContent = '请在目标电脑自己的浏览器中打开 localhost 主端口的 /online.html 页面；局域网地址和远程代理不能修改线上接入。';
    else if (err.status === 401) info.textContent = '请先填写本机 TermDoor 的访问令牌和二次密钥（若已启用），再点击验证。';
    else if (err.status === 404) info.textContent = '当前服务缺少线上接入接口，请更新并重启 TermDoor，然后刷新本页。';
    else info.textContent = `无法读取线上接入状态：${err.message}。请检查本机服务后重试。`;
  }
  async function refresh() {
    closeAllDropdowns();
    if (dialog && !dialog.open) dialog.showModal();
    try { fill(await call()); return true; } catch (err) { showError(err); return false; }
  }
  if (row) row.hidden = false;
  const opener = document.getElementById('online-button');
  if (opener) opener.onclick = refresh;
  call().then(fill).catch(showError);
  document.getElementById('online-form').onsubmit = async (event) => {
    event.preventDefault(); button.disabled = true; info.textContent = '正在准备客户端并绑定设备…';
    try { fill(await call('POST', { center: center.value.trim(), code: code.value.trim() })); code.value = ''; }
    catch (err) { info.textContent = err.message; button.disabled = false; }
  };
  disconnect.onclick = async () => {
    if (!confirm('断开线上连接？局域网功能继续可用，中心设备记录可在网站中解绑。')) return;
    try { fill(await call('DELETE')); } catch (err) { info.textContent = err.message; }
  };
  return { refresh };
}
