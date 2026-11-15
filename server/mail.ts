import type { PasswordResetMailer } from './accounts.js';

const sender = /^(?:[^<>\r\n"]{1,64} <)?[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}>?$/;

/** Optional password-reset delivery through Resend's HTTPS API. Both
 * RESEND_API_KEY and SCENESIGNAL_MAIL_FROM are required; with neither,
 * recovery stays disabled and the UI says so. Partial configuration fails startup. */
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
