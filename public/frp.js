// The "frp" settings dialog in the settings menu. Classic script: app.js calls
// initFrp() once the app is up.
//
// The entry only appears when the server accepts this browser as the owner at
// this machine (GET /api/frp answers 403 for everyone else). The token goes to
// the server and never comes back, so the field is always empty on open.
function initFrp({ authQuery, closeAllDropdowns }) {
  const API = `/api/frp?${authQuery}`;
  const $ = (id) => document.getElementById(id);
  const row = $('frp-row');
  const modal = $('frp-modal');
  const fields = {
    serverAddr: $('frp-server-addr'),
    serverPort: $('frp-server-port'),
    token: $('frp-token'),
    remotePort: $('frp-remote-port'),
    proxyName: $('frp-proxy-name'),
  };
  const info = $('frp-info');
  const msg = $('frp-msg');
  const saveBtn = $('frp-save');

  const ERRORS = {
    'invalid serverAddr': '服务器地址只能是主机名或 IPv4，不能带空格、协议或端口',
    'invalid serverPort': '控制端口要是 1 到 65535 的整数',
    'invalid remotePort': '远程端口要是 1 到 65535 的整数',
    'invalid proxyName': '代理名只能用字母、数字、下划线、短横线，最长 40 个字符',
    'invalid token': '令牌只能用字母、数字和 . _ ~ + / = - ，长度 8 到 128',
    'token required': '还没有保存过令牌，请填写',
    'remote port not configured': '还没有配置远程端口，见 README 的「远程端口」',
  };

  function say(text, bad, command) {
    msg.textContent = text;
    msg.classList.toggle('bad', !!bad);
    msg.classList.toggle('show', !!text);
    const code = $('frp-cmd');
    code.textContent = command || '';
    code.classList.toggle('show', !!command);
  }

  function fill(st) {
    fields.serverAddr.value = st.serverAddr || '';
    fields.serverPort.value = st.serverPort || 7000;
    fields.remotePort.value = st.remotePort || '';
    fields.proxyName.value = st.proxyName || 'termdoor';
    fields.token.value = '';
    fields.token.placeholder = st.hasToken ? '已保存，留空表示保持不变' : '必填';
    $('frp-clear').hidden = !st.configured;
    if (st.remoteListenerPort) {
      info.textContent = `映射到本机 ${st.remoteListenerPort} 端口（TermDoor 的远程端口，永远要二次密钥）`;
      saveBtn.disabled = false;
    } else {
      info.textContent = '还没有配置远程端口，保存已禁用。配置方法见 README 的「远程端口」。';
      saveBtn.disabled = true;
    }
  }

  async function call(method, body) {
    const res = await fetch(API, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(ERRORS[data.error] || '保存失败');
    return data;
  }

  fetch(API).then((r) => (r.ok ? r.json() : null)).then((st) => {
    if (!st) return;
    row.hidden = false;
    $('frp-btn').addEventListener('click', async () => {
      closeAllDropdowns();
      say('');
      try {
        fill(await call('GET'));
      } catch (err) {
        say(err.message, true);
      }
      modal.classList.add('show');
    });
  }).catch(() => {});

  $('frp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    say('');
    try {
      const st = await call('POST', {
        serverAddr: fields.serverAddr.value,
        serverPort: fields.serverPort.value,
        token: fields.token.value,
        remotePort: fields.remotePort.value,
        proxyName: fields.proxyName.value,
      });
      fill(st);
      say('已保存。重启 frpc 后生效：', false, `frpc -c ${st.configPath}`);
    } catch (err) {
      say(err.message, true);
    }
  });

  $('frp-clear').addEventListener('click', async () => {
    if (!confirm('清除 frp 配置？已保存的令牌也会一起删除。')) return;
    say('');
    try {
      fill(await call('DELETE'));
      say('已清除。');
    } catch (err) {
      say(err.message, true);
    }
  });

  $('frp-cancel').addEventListener('click', () => modal.classList.remove('show'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('show');
  });
}
