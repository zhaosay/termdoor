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
    const diagnosis = TermDoorDeviceStatus.describe(device);
    if (!device.heartbeat) { $('status').textContent = TermDoorErrors.format(diagnosis.key); return; }
    $('device-stage').className = 'online';
    if (!device.online) { $('status').textContent = TermDoorErrors.format(diagnosis.key); return; }
    $('tunnel-stage').className = 'online';
    const app = device.apps.find((a) => a.id === params.get('app'));
    const appIssue = TermDoorDeviceStatus.application(app);
    if (appIssue) { $('status').textContent = TermDoorErrors.format(appIssue); return; }
    $('title').textContent = app.name;
    $('app-stage').className = 'online';
    $('status').textContent = '检查完成。首次打开可能需要加载数据，请稍候。';
    $('open').href = `/d/${device.id}/apps/${encodeURIComponent(app.id)}/`; $('open').hidden = false;
    location.replace($('open').href);
  } catch (error) { $('status').textContent = TermDoorErrors.format(error); }
  finally { busy = false; $('retry').disabled = false; }
}
$('retry').onclick = check;
check();
