const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { once } = require('events');

test('SIGTERM and SIGINT shut down cleanly with a numeric exit code', { timeout: 15000 }, async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'termdoor-shutdown-test-'));
  const app = path.join(temporary, 'app');
  fs.mkdirSync(app);
  for (const name of ['lib', 'public', 'server.js', 'package.json', 'version.json']) {
    fs.cpSync(path.resolve(name), path.join(app, name), { recursive: true });
  }
  fs.symlinkSync(path.resolve('node_modules'), path.join(app, 'node_modules'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  for (const signal of ['SIGTERM', 'SIGINT']) {
    const child = spawn(process.execPath, ['server.js'], {
      cwd: app,
      env: { ...process.env, PROJECT_PORT: '0', WEBCLI_REMOTE_PORT: '0', WEBCLI_NO_OPEN: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
    let errors = '';
    child.stderr.on('data', (chunk) => { errors += chunk; });
    await new Promise((resolve, reject) => {
      child.stdout.on('data', (chunk) => { if (chunk.toString().includes('open:')) resolve(); });
      child.once('error', reject);
      child.once('exit', (code) => reject(new Error(`Server exited before readiness: ${code}`)));
    });
    const exited = once(child, 'exit');
    child.kill(signal);
    const [code, exitSignal] = await exited;
    assert.equal(code, 0, `${signal}: ${errors}`);
    assert.equal(exitSignal, null);
    assert.doesNotMatch(errors, /uncaught exception|ERR_INVALID_ARG_TYPE/);
    assert.equal(fs.existsSync(path.join(temporary, 'data/webcli/server.pid')), false);
  }
});
