// Cloud Build only: retrieve a short-lived, read-only connection token in memory.
// Git receives it through process environment, never URL, arguments, file or log.
import {spawnSync} from 'node:child_process';

async function json(url, options = {}) {
  const response = await fetch(url, {...options, signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`Source authorization failed (${response.status})`);
  return response.json();
}
async function main() {
  const resource = process.env.PB_REPOSITORY_RESOURCE || '';
  if (!/^projects\/platinum-bleu-drive\/locations\/us-central1\/connections\/[\w-]+\/repositories\/[\w-]+$/.test(resource)) {
    throw new Error('Reviewed Cloud Build repository resource is required');
  }
  const credential = await json('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    {headers: {'Metadata-Flavor': 'Google'}});
  const authorization = await json(`https://cloudbuild.googleapis.com/v2/${resource}:accessReadToken`,
    {method: 'POST', headers: {Authorization: `Bearer ${credential.access_token}`, 'Content-Type': 'application/json'}, body: '{}'});
  if (!authorization.token) throw new Error('Repository read token missing');
  const env = {...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: 'AUTHORIZATION: basic ' + Buffer.from(`x-access-token:${authorization.token}`).toString('base64')};
  // Do not inherit debug tracing that could print credential headers.
  for (const key of Object.keys(env)) if (key.startsWith('GIT_TRACE') || key === 'GIT_CURL_VERBOSE') delete env[key];
  function git(args, capture = false) {
    const result = spawnSync('git', args, {env, encoding: 'utf8', stdio: 'pipe', timeout: 180000});
    if (result.error || result.status !== 0) throw new Error('Full repository history retrieval failed');
    return capture ? result.stdout.trim() : undefined;
  }
  git(['rev-parse', '--git-dir']);
  const shallow = git(['rev-parse', '--is-shallow-repository'], true) === 'true';
  git(['fetch', '--force', '--tags', ...(shallow ? ['--unshallow'] : []),
    'https://github.com/kirkseyhouse/platinumbleutls.git', '+refs/heads/*:refs/remotes/origin/*']);
  if (git(['rev-parse', 'HEAD'], true) !== process.env.PB_EXPECTED_COMMIT) throw new Error('Checkout commit mismatch');
  if (git(['rev-parse', '--is-shallow-repository'], true) !== 'false') throw new Error('Shallow history rejected');
  console.log('Complete branch/tag history retrieved for the exact build commit.');
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
