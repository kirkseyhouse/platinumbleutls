import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
import {seal,unseal} from '../src/connectors.js';
import {verifyHmac} from '../src/webhooks.js';
test('token vault encrypts and authenticates provider credentials',()=>{
 const key=randomBytes(32).toString('base64'),token={access_token:'synthetic-test-token',refresh_token:'synthetic-test-refresh'};
 const sealed=seal(token,key);assert.ok(!sealed.includes(token.access_token));assert.deepEqual(unseal(sealed,key),token);assert.notEqual(seal(token,key),sealed);
 assert.throws(()=>unseal(sealed,randomBytes(32).toString('base64')));
 assert.throws(()=>seal(token,''));
});
test('QBO webhook signature rejects tampered payloads and missing configuration',()=>{
 const body=Buffer.from('{"eventNotifications":[]}'),key='synthetic-webhook-key',signature=createHmac('sha256',key).update(body).digest('base64');
 assert.equal(verifyHmac(body,signature,key),true);assert.equal(verifyHmac(Buffer.from('tampered'),signature,key),false);assert.equal(verifyHmac(body,signature,''),false);assert.equal(verifyHmac(body,'bad',key),false);
});
