const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
let busy = false;
async function check() {
  if (busy) return;
  busy = true; $('retry').disabled = true; $('open').hidden = true;
  for (const id of ['account', 'device', 'tunnel', 'app']) $(id + '-stage').className = '';
  try {
    $('status').textContent = '正在验证账号并检查设备…';
    const response = await fetch('/api/devices');
    const data = await response.json();
    if (response.status === 401) return location.replace('/');
    if (!response.ok) throw new Error(TermDoorErrors.format(data, response.status));
    $('account-stage').className = 'online';
    const device = data.devices.find((d) => d.id === params.get('device'));
    if (!device) throw new Error(TermDoorErrors.format('设备不存在'));
    if (!device.heartbeat) { $('status').textContent = '设备未通信，请在目标电脑检查 TermDoor 是否运行。'; return; }
    $('device-stage').className = 'online';
    if (!device.online) { $('status').textContent = '设备已通信，通路未就绪。请在目标电脑的「设备接入」页检查连接。'; return; }
    $('tunnel-stage').className = 'online';
    const app = device.apps.find((a) => a.id === params.get('app'));
    if (!app) { $('status').textContent = '应用未启用，请在目标电脑的「应用与维护」页配置。'; return; }
    $('title').textContent = app.name;
    if (app.health?.state && app.health.state !== 'ready' && app.health.state !== 'unknown') { $('status').textContent = app.health.state === 'credentials' ? '访问密钥不可用，请在本机重新选择密钥文件。' : '应用服务未启动，请在目标电脑启动应用后重试。'; return; }
    $('app-stage').className = 'online';
    $('status').textContent = '检查完成。首次打开可能需要加载数据，请稍候。';
    $('open').href = `/d/${device.id}/apps/${encodeURIComponent(app.id)}/`; $('open').hidden = false;
    location.replace($('open').href);
  } catch (error) { $('status').textContent = TermDoorErrors.format(error); }
  finally { busy = false; $('retry').disabled = false; }
}
$('retry').onclick = check;
check();
