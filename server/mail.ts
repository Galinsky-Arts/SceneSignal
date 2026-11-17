import type { EmailVerificationMailer, PasswordResetMailer } from './accounts.js';

const sender = /^(?:[^<>\r\n"]{1,64} <)?[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}>?$/;

/** Optional password-reset delivery through Resend's HTTPS API. Both
 * RESEND_API_KEY and SCENESIGNAL_MAIL_FROM are required; with neither,
 * recovery stays disabled and the UI says so. Partial configuration fails startup. */
function resendConfiguration(env: Record<string, string | undefined>): { key: string; from: string } | undefined {
  const key = env.RESEND_API_KEY, from = env.SCENESIGNAL_MAIL_FROM;
  if (!key && !from) return undefined;
  if (!key || !from || !sender.test(from) || (from.includes('<') !== from.endsWith('>'))) throw Error('MAIL_CONFIGURATION_INVALID');
  return { key, from };
}

/** Optional email-ownership verification through the same Resend settings.
 * Undefined (feature off) unless RESEND_API_KEY and SCENESIGNAL_MAIL_FROM are set. */
export function resendEmailVerificationMailer(env: Record<string, string | undefined>,
  fetcher: typeof fetch = fetch): EmailVerificationMailer | undefined {
  const settings = resendConfiguration(env);
  if (!settings) return undefined;
  return async ({ to, url }) => {
    const link = new URL(url);
    if (link.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(link.hostname)) throw Error('VERIFY_LINK_HTTPS_REQUIRED');
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { Authorization: 'Bearer ' + settings.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: settings.from, to: [to], subject: 'Confirm your SceneSignal email address',
        text: 'Confirm that this address belongs to your SceneSignal account by opening this link within 24 hours:\n' +
          link.href + '\n\nIf you did not create a SceneSignal account, ignore this message.' }) });
    if (!response.ok) throw Error('MAIL_DELIVERY_FAILED');
  };
}

export function resendPasswordResetMailer(env: Record<string, string | undefined>,
  fetcher: typeof fetch = fetch): PasswordResetMailer | undefined {
  const key = env.RESEND_API_KEY, from = env.SCENESIGNAL_MAIL_FROM;
  if (!key && !from) return undefined;
  if (!key || !from || !sender.test(from) || (from.includes('<') !== from.endsWith('>'))) throw Error('MAIL_CONFIGURATION_INVALID');
  return async ({ to, url }) => {
    const link = new URL(url);
    if (link.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(link.hostname)) throw Error('RESET_LINK_HTTPS_REQUIRED');
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: 'Reset your SceneSignal password',
        text: 'Someone asked to reset the password for your SceneSignal account.\n\n' +
          'Open this single-use link within 30 minutes to choose a new password:\n' + link.href +
          '\n\nIf this was not you, ignore this message. Your password stays the same.' }) });
    if (!response.ok) throw Error('MAIL_DELIVERY_FAILED');
  };
}
