import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chicagoToISO} from '../public/time.js';
test('scheduling uses Chicago independently of browser timezone',()=>{
 assert.equal(chicagoToISO('2026-10-07T09:00'),'2026-10-07T14:00:00.000Z');
 assert.equal(chicagoToISO('2026-12-07T09:00'),'2026-12-07T15:00:00.000Z');
});
test('nonexistent and ambiguous Chicago clock times require a different choice',()=>{
 assert.throws(()=>chicagoToISO('2026-03-08T02:30'),/does not exist/);
 assert.throws(()=>chicagoToISO('2026-11-01T01:30'),/occurs twice/);
 assert.throws(()=>chicagoToISO('2026-02-30T09:00'),/valid/);
});
