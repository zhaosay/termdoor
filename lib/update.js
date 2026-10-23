const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const cli = require('./cli-ui');

function updater(root) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const clean = () => { if (git('status', '--porcelain')) throw new Error('update has local changes'); };
  const checkpoint = path.join(git('rev-parse', '--absolute-git-dir'), 'termdoor-update.json');
  function save(state) {
    fs.writeFileSync(checkpoint + '.tmp', JSON.stringify(state), { mode: 0o600 });
    fs.renameSync(checkpoint + '.tmp', checkpoint);
  }
  function recover() {
    clean();
    const state = JSON.parse(fs.readFileSync(checkpoint, 'utf8'));
    const head = git('rev-parse', 'HEAD');
    if (![state.before, state.target].includes(head)) throw new Error('update recovery changed');
    if (head !== state.before) {
      git('switch', '-c', `codex/update-recovery-${Date.now()}`, state.before);
      git('branch', '--set-upstream-to', state.upstream);
    }
    if (state.dependenciesChanged && fs.existsSync(state.dependenciesBackup)) {
      const failed = path.join(path.dirname(checkpoint), `termdoor-failed-dependencies-${Date.now()}`);
      if (fs.existsSync(path.join(root, 'node_modules'))) fs.renameSync(path.join(root, 'node_modules'), failed);
      fs.renameSync(state.dependenciesBackup, path.join(root, 'node_modules'));
    }
    save({ ...state, recovered: true });
    return { recovered: true };
  }
  function prepare() {
    clean();
    const before = git('rev-parse', 'HEAD');
    const branch = git('symbolic-ref', '--short', 'HEAD');
    const upstream = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}');
    const remote = git('config', `branch.${branch}.remote`);
    git('fetch', '--quiet', remote);
    const target = git('rev-parse', '@{u}');
    git('merge-base', '--is-ancestor', before, target);
    if (before === target) return { changed: false };
    const changed = git('diff', '--name-only', before, target).split('\n');
    const dependenciesChanged = changed.some((name) => ['package.json', 'package-lock.json'].includes(name)) || !fs.existsSync(path.join(root, 'node_modules'));
    // Keep candidate dependencies on the checkout's filesystem for rename.
    const temp = fs.mkdtempSync(path.join(path.dirname(root), '.termdoor-update-'));
    const stage = path.join(temp, 'source');
    try {
      git('worktree', 'add', '--detach', stage, target);
      if (dependenciesChanged) {
        const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        // npm lifecycle scripts run only in the isolated candidate checkout.
        execFileSync(npm, ['ci', '--no-audit', '--no-fund'], { cwd: stage, stdio: 'inherit', shell: process.platform === 'win32' });
      }
      const scripts = new Set(['server.js', 'lib/routes.js', 'center/server.js', 'public/errors.js', ...changed.filter((file) => file.endsWith('.js') && fs.existsSync(path.join(stage, file)))]);
      for (const file of scripts) {
        execFileSync(process.execPath, ['--check', path.join(stage, file)], { stdio: 'pipe' });
      }
      clean();
      if (git('rev-parse', 'HEAD') !== before) throw new Error('update recovery changed');
      const dependenciesBackup = path.join(path.dirname(checkpoint), `termdoor-dependencies-${Date.now()}`);
      save({ before, target, upstream, dependenciesChanged, dependenciesBackup, createdAt: new Date().toISOString() });
      git('merge', '--ff-only', target);
      if (dependenciesChanged) {
        const modules = path.join(root, 'node_modules');
        if (fs.existsSync(modules)) fs.renameSync(modules, dependenciesBackup);
        try { fs.renameSync(path.join(stage, 'node_modules'), modules); }
        catch (error) {
          if (fs.existsSync(dependenciesBackup) && !fs.existsSync(modules)) fs.renameSync(dependenciesBackup, modules);
          throw error;
        }
      }
      return { changed: true };
    } finally {
      // Remove only the disposable checkout created by this invocation.
      if (fs.existsSync(stage)) git('worktree', 'remove', '--force', stage);
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
  return { prepare, recover };
}

if (require.main === module) {
  try {
    const service = updater(path.resolve(__dirname, '..'));
    const result = process.argv[2] === 'recover' ? service.recover() : service.prepare();
    cli.line('Update', result.recovered ? '已恢复，启动前请核对版本 / Recovered; check version before starting' : result.changed ? '更新准备完成 / Update is ready' : '已是最新版本 / Already up to date');
  } catch (error) {
    cli.report(['update has local changes', 'update recovery changed'].includes(error.message) ? error : new Error('update preparation failed'));
    process.exitCode = 1;
  }
}
module.exports = { updater };
