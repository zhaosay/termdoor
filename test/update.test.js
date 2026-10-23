const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { updater } = require('../lib/update');

function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'termdoor-update-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const remote = path.join(temp, 'remote.git');
  const seed = path.join(temp, 'seed');
  const root = path.join(temp, 'client');
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(temp, 'init', '--bare', remote);
  fs.mkdirSync(seed); git(seed, 'init', '-b', 'main');
  git(seed, 'config', 'user.email', 'test@example.com'); git(seed, 'config', 'user.name', 'Test');
  for (const file of ['server.js', 'lib/routes.js', 'center/server.js', 'public/errors.js']) {
    fs.mkdirSync(path.dirname(path.join(seed, file)), { recursive: true }); fs.writeFileSync(path.join(seed, file), 'void 0;\n');
  }
  fs.writeFileSync(path.join(seed, '.gitignore'), 'node_modules/\n');
  fs.writeFileSync(path.join(seed, 'package.json'), '{"name":"fixture","version":"1.0.0"}\n');
  fs.writeFileSync(path.join(seed, 'package-lock.json'), '{}\n');
  git(seed, 'add', '.'); git(seed, 'commit', '-m', 'initial'); git(seed, 'remote', 'add', 'origin', remote); git(seed, 'push', '-u', 'origin', 'main');
  git(temp, 'clone', '-b', 'main', remote, root);
  fs.mkdirSync(path.join(root, 'node_modules')); fs.writeFileSync(path.join(root, 'node_modules/state'), 'old');
  const before = git(root, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(seed, 'package.json'), '{"name":"fixture","version":"2.0.0"}\n');
  git(seed, 'add', '.'); git(seed, 'commit', '-m', 'candidate'); git(seed, 'push');
  const bin = path.join(temp, 'bin'); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'npm'), '#!/bin/sh\nmkdir -p node_modules\nprintf new > node_modules/state\nif [ "$TASK_UPDATE_TEST_FAIL" = 1 ]; then exit 4; fi\n', { mode: 0o755 });
  const previousPath = process.env.PATH;
  process.env.PATH = bin + path.delimiter + previousPath;
  t.after(() => { process.env.PATH = previousPath; delete process.env.TASK_UPDATE_TEST_FAIL; });
  return { root, seed, git, before };
}

test('failed candidate dependency installation preserves the live checkout and dependencies', { skip: process.platform === 'win32' }, (t) => {
  const { root, git, before } = fixture(t);
  process.env.TASK_UPDATE_TEST_FAIL = '1';
  assert.throws(() => updater(root).prepare());
  assert.equal(git(root, 'rev-parse', 'HEAD'), before);
  assert.equal(fs.readFileSync(path.join(root, 'node_modules/state'), 'utf8'), 'old');
  assert.equal(git(root, 'status', '--porcelain'), '');
  assert.equal(git(root, 'worktree', 'list', '--porcelain').match(/^worktree /gm).length, 1);
});

test('prepared update can recover its previous commit and exact dependency directory', { skip: process.platform === 'win32' }, (t) => {
  const { root, git, before } = fixture(t);
  const service = updater(root);
  assert.equal(service.prepare().changed, true);
  assert.notEqual(git(root, 'rev-parse', 'HEAD'), before);
  assert.equal(fs.readFileSync(path.join(root, 'node_modules/state'), 'utf8'), 'new');
  assert.equal(service.prepare().changed, false);
  fs.writeFileSync(path.join(root, 'user-work.txt'), 'keep');
  assert.throws(() => service.recover(), /update has local changes/);
  assert.equal(fs.readFileSync(path.join(root, 'user-work.txt'), 'utf8'), 'keep');
  fs.unlinkSync(path.join(root, 'user-work.txt'));
  assert.equal(service.recover().recovered, true);
  assert.equal(git(root, 'rev-parse', 'HEAD'), before);
  assert.equal(fs.readFileSync(path.join(root, 'node_modules/state'), 'utf8'), 'old');
  assert.match(git(root, 'branch', '--show-current'), /^codex\/update-recovery-/);
});

test('invalid candidate JavaScript never reaches the live checkout', { skip: process.platform === 'win32' }, (t) => {
  const { root, seed, git, before } = fixture(t);
  fs.writeFileSync(path.join(seed, 'public/broken.js'), 'const = ;');
  git(seed, 'add', '.'); git(seed, 'commit', '-m', 'bad syntax'); git(seed, 'push');
  assert.throws(() => updater(root).prepare());
  assert.equal(git(root, 'rev-parse', 'HEAD'), before);
  assert.equal(fs.readFileSync(path.join(root, 'node_modules/state'), 'utf8'), 'old');
});

test('dirty checkout stops before update preparation', { skip: process.platform === 'win32' }, (t) => {
  const { root, git, before } = fixture(t);
  fs.writeFileSync(path.join(root, 'server.js'), 'userChanges();\n');
  assert.throws(() => updater(root).prepare(), /update has local changes/);
  assert.equal(git(root, 'rev-parse', 'HEAD'), before);
  assert.equal(fs.readFileSync(path.join(root, 'server.js'), 'utf8'), 'userChanges();\n');
});
