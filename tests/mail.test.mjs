import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resendPasswordResetMailer } from '../dist/server/mail.js';

test('password-reset mail stays disabled without configuration and rejects partial configuration', () => {
  assert.equal(resendPasswordResetMailer({}), undefined);
  assert.throws(() => resendPasswordResetMailer({ RESEND_API_KEY: 're_test' }), /MAIL_CONFIGURATION_INVALID/);
  assert.throws(() => resendPasswordResetMailer({ SCENESIGNAL_MAIL_FROM: 'a@example.test' }), /MAIL_CONFIGURATION_INVALID/);
  assert.throws(() => resendPasswordResetMailer({ RESEND_API_KEY: 'k', SCENESIGNAL_MAIL_FROM: 'bad\r\nBcc: x@example.test' }), /MAIL_CONFIGURATION_INVALID/);
});

test('configured mail sends only the HTTPS link to the account address and surfaces provider failure', async () => {
  const sent = [];
  const mailer = resendPasswordResetMailer({ RESEND_API_KEY: 're_test', SCENESIGNAL_MAIL_FROM: 'SceneSignal <accounts@example.test>' },
    async (url, init) => { sent.push({ url, init }); return new Response('{}', { status: sent.length === 1 ? 200 : 500 }); });
  await mailer({ to: 'person@example.test', url: 'https://scenesignal.example/api/auth/reset-password/tok?callbackURL=x' });
  assert.equal(sent[0].url, 'https://api.resend.com/emails');
  assert.equal(sent[0].init.redirect, 'error');
  const body = JSON.parse(sent[0].init.body);
  assert.deepEqual(body.to, ['person@example.test']);
  assert.ok(body.text.includes('https://scenesignal.example/api/auth/reset-password/tok'));
  await assert.rejects(mailer({ to: 'person@example.test', url: 'https://scenesignal.example/r' }), /MAIL_DELIVERY_FAILED/);
  await assert.rejects(mailer({ to: 'person@example.test', url: 'http://scenesignal.example/r' }), /RESET_LINK_HTTPS_REQUIRED/);
  assert.equal(sent.length, 2);
});
