import { execFileSync } from 'node:child_process';

export function buildVersion(cwd) {
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    const [timestamp, hash] = git(['log', '-1', '--format=%ct %H']).split(' ');
    const date = new Date(Number(timestamp) * 1000).toISOString().slice(2, 10).replaceAll('-', '.');
    const dirty = git(['status', '--porcelain']) ? '-dirty' : '';
    return `${date}-${hash.slice(0, 3)}${dirty}`;
  } catch {
    return 'dev';
  }
}
