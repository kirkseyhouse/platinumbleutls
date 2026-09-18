import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir, mkdtemp, rm, copyFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export function verifyChecksum(bytes, expected) {
  if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('Gitleaks archive checksum mismatch');
}
export function historyArguments(hasHead, shallow) {
  if (hasHead && shallow) throw new Error('Full history required; shallow checkout rejected');
  return hasHead ? ['git', '--log-opts=--all --full-history'] : [];
}
function run(exe, args, options = {}) {
  const result = spawnSync(exe, args, {cwd: root, stdio: 'inherit', ...options});
  if (result.error || result.status !== 0) throw new Error(`${path.basename(exe)} failed (${result.status ?? result.error?.code})`);
  return result.stdout?.trim();
}
async function main() {
  const pins = JSON.parse(await readFile(path.join(root, 'deploy/tool-pins.json'), 'utf8')).gitleaks;
  const platform = `${process.platform === 'win32' ? 'windows' : process.platform}_${process.arch}`;
  if (!pins[platform]) throw new Error(`Unsupported scanner platform: ${platform}`);
  const cache = path.join(root, '.runtime', 'tools');
  await mkdir(cache, {recursive: true});
  const archive = path.join(cache, `gitleaks-${pins.version}-${platform}.${process.platform === 'win32' ? 'zip' : 'tar.gz'}`);
  let bytes;
  try { bytes = await readFile(archive); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const extension = process.platform === 'win32' ? 'zip' : 'tar.gz';
    const response = await fetch(`https://github.com/gitleaks/gitleaks/releases/download/v${pins.version}/gitleaks_${pins.version}_${platform}.${extension}`, {signal: AbortSignal.timeout(120000)});
    if (!response.ok) throw new Error(`Gitleaks download failed: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    verifyChecksum(bytes, pins[platform]);
    await writeFile(archive, bytes);
  }
  verifyChecksum(bytes, pins[platform]);
  const scratch = await mkdtemp(path.join(tmpdir(), 'pb-gitleaks-'));
  try {
    run('tar', ['-xf', archive, '-C', scratch]);
    const binary = path.join(scratch, process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks');
    if (run(binary, ['version'], {encoding: 'utf8', stdio: 'pipe'}) !== pins.version) throw new Error('Unexpected scanner version');
    const gitOptions = {encoding: 'utf8', stdio: 'pipe'};
    run('git', ['rev-parse', '--git-dir'], gitOptions);
    // Scan only the Git-eligible working tree, including untracked baseline files.
    // Ignored runtime files and credentials remain outside any commit/build context.
    const files = run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], gitOptions).split('\0').filter(Boolean);
    const tree = path.join(scratch, 'tree');
    await mkdir(tree);
    for (const file of new Set(files)) {
      const target = path.join(tree, file);
      await mkdir(path.dirname(target), {recursive: true});
      await copyFile(path.join(root, file), target);
    }
    const common = ['--redact=100', '--no-banner', '--config', path.join(root, '.gitleaks.toml'), '--report-format=json', '--report-path', path.join(root, '.runtime/gitleaks-report.json')];
    run(binary, ['dir', tree, ...common]);
    const head = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], {...gitOptions, cwd: root});
    if (head.error) throw head.error;
    const shallow = run('git', ['rev-parse', '--is-shallow-repository'], gitOptions) === 'true';
    const args = historyArguments(head.status === 0, shallow);
    if (args.length) run(binary, [...args, root, ...common]);
    else console.log('Unborn repository: working tree scanned; history scan required after first commit.');
    console.log(`Gitleaks ${pins.version}: working tree and available full history passed.`);
  } finally { await rm(scratch, {recursive: true, force: true}); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {console.error(error.message); process.exitCode = 1;});
