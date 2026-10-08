// Pure helpers used by app.js (no access to app state). Classic script.

function formatAgo(ts) {
  const mins = Math.floor(Math.max(0, Date.now() - ts) / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

// These three need the project directory as cwd (update/restart) and a
// per-OS open-file-manager command, so they're built at render time
// instead of living in the static arrays above.
function buildManagementPresets(platform, projectRoot) {
  const cwd = projectRoot || '';
  if (platform === 'win32') {
    return [
      { label: '更新TermDoor', command: 'start "" /B update.bat', cwd },
      { label: '重启TermDoor', command: 'start "" /B restart.bat', cwd },
      { label: '打开目录', command: 'explorer .' },
    ];
  }
  return [
    { label: '更新TermDoor', command: 'nohup ./update.sh > /tmp/webcli-update.log 2>&1 & disown', cwd },
    { label: '重启TermDoor', command: 'nohup ./restart.sh --bg > /tmp/webcli-restart.log 2>&1 & disown', cwd },
    { label: '打开目录', command: platform === 'linux' ? 'xdg-open .' : 'open .' },
  ];
}
