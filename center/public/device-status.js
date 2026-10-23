(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TermDoorDeviceStatus = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function describe(device) {
    if (!device.heartbeat) return { label: '设备未通信', key: 'device heartbeat offline' };
    if (device.tunnel?.state === 'blocked') return { label: '通路验证失败', key: 'device tunnel blocked' };
    if (!device.online) return { label: '通路未连通', key: 'device tunnel unavailable' };
    return { label: '在线', key: null };
  }
  function application(app) {
    if (!app || app.health?.state === 'disabled') return 'application disabled';
    if (app.health?.state === 'credentials') return 'application credentials unavailable';
    if (app.health?.state === 'unavailable') return 'application service unavailable';
    return null;
  }
  return { describe, application };
});
