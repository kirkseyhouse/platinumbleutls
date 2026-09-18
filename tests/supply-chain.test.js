import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyChecksum, historyArguments} from '../scripts/secret-scan.js';

test('scanner rejects altered release archive before extraction', () => {
  const bytes = Buffer.from('fixture');
  const expected = createHash('sha256').update(bytes).digest('hex');
  assert.doesNotThrow(() => verifyChecksum(bytes, expected));
  assert.throws(() => verifyChecksum(Buffer.from('altered'), expected), /checksum/);
});
test('history scanning covers every ref and cannot silently accept shallow history', () => {
  assert.throws(() => historyArguments(true, true), /shallow/);
  assert.deepEqual(historyArguments(false, false), []);
  assert.ok(historyArguments(true, false).includes('--log-opts=--all --full-history'));
});
