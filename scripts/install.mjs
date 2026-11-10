import { copyFile, lstat, mkdir, readFile, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// A node_modules symlink alone does not relocate pnpm's manifest/lock/temp writes.
// Install beside its external target, then copy only the lockfile back, serially.
const root = fileURLToPath(new URL('..', import.meta.url));
const modules = join(root, 'node_modules');
const link = await lstat(modules);
if (!link.isSymbolicLink()) throw Error('node_modules must be a symlink to a directory outside /vagrant.');
const target = await realpath(modules);
if (target === '/vagrant' || target.startsWith('/vagrant/')) throw Error('Refusing to install dependencies under /vagrant.');
const staging = dirname(target);
if (resolve(staging) === resolve(root)) throw Error('Dependency staging must be outside the checkout.');
console.log(`Installing serially in ${staging}`);
await copyFile(join(root, 'package.json'), join(staging, 'package.json'));
await copyFile(join(root, 'pnpm-workspace.yaml'), join(staging, 'pnpm-workspace.yaml'));
try { await copyFile(join(root, 'pnpm-lock.yaml'), join(staging, 'pnpm-lock.yaml')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const cache = join(staging, '.cache');
await mkdir(cache, { recursive: true });
const result = spawnSync('pnpm', ['install', '--ignore-scripts', '--child-concurrency=1', '--network-concurrency=1',
  '--store-dir', join(cache, 'store'), '--state-dir', join(cache, 'state'), ...process.argv.slice(2)], {
  cwd: staging,
  stdio: 'inherit',
  env: { ...process.env, XDG_CACHE_HOME: cache, npm_config_manage_package_manager_versions: 'false' },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
// Confirm staging did not alter the intended manifest before publishing its lock.
if (await readFile(join(staging, 'package.json'), 'utf8') !== await readFile(join(root, 'package.json'), 'utf8')) {
  throw Error('Staged manifest changed; inspect it before copying the lockfile back.');
}
await copyFile(join(staging, 'pnpm-lock.yaml'), join(root, 'pnpm-lock.yaml'));
