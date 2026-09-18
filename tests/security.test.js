import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateIdentity, allowed, calculateInvoice, scheduleGate, normalizeContact } from '../src/domain.js';

const identity = { iss:'https://accounts.google.com', sub:'123', aud:'client', exp:Math.floor(Date.now()/1000)+300, email:'cat@platinumbleutls.com', email_verified:true, hd:'platinumbleutls.com' };
test('identity requires verified exact Workspace and exact email domain',()=>{
  assert.equal(validateIdentity(identity).email,identity.email);
  for (const change of [{hd:undefined},{hd:'evil.com'},{email:'cat@platinumbleutls.com.evil.com'},{email:'cat@gmail.com'},{email_verified:false},{email_verified:'true'},{sub:''}])
    assert.throws(()=>validateIdentity({...identity,...change}));
});
test('bookkeeper and crews cannot gain operational or administrative permissions',()=>{
  assert.equal(allowed(['bookkeeper'],'invoice.read'),true);
  assert.equal(allowed(['bookkeeper'],'job.schedule'),false);
  assert.equal(allowed(['crew'],'invoice.read'),false);
  assert.equal(allowed(['ops'],'member.manage'),false);
  assert.equal(allowed(['owner'],'member.manage'),true);
  assert.equal(allowed(['owner'],'made.up'),false);
});
test('schedule requires approval, signed agreement and confirmed deposit',()=>{
  const job={approved_at:'2026-09-15',agreement_at:'2026-09-15',deposit_required_minor:50000,deposit_paid_minor:50000};
  assert.doesNotThrow(()=>scheduleGate(job));
  assert.throws(()=>scheduleGate({...job,deposit_paid_minor:49999}));
  assert.throws(()=>scheduleGate({...job,agreement_at:null}));
  assert.throws(()=>scheduleGate({...job,approved_at:null}));
});
test('invoice calculation ignores client totals and refuses unsafe amounts',()=>{
  assert.equal(calculateInvoice([{description:'Tree work',quantity:2,unit_minor:12500,tax_minor:1000}]),26000);
  assert.throws(()=>calculateInvoice([{quantity:1,unit_minor:-1,tax_minor:0}]));
  assert.throws(()=>calculateInvoice([{quantity:1,unit_minor:Number.MAX_SAFE_INTEGER,tax_minor:1}]));
  assert.throws(()=>calculateInvoice([]));
});
test('contact normalization preserves plus addressing and handles US numbers',()=>{
  assert.deepEqual(normalizeContact({email:' CAT+Job@Example.com ',phone:'(479) 555-0123'}),{email:'cat+job@example.com',phone:'+14795550123'});
  assert.throws(()=>normalizeContact({phone:'123'}));
});
