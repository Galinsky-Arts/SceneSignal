type User = { id: string; name: string };
type OwnedSession = { tenantId: string; sessionId: string; role: string };
class AccountRequestError extends Error { constructor(readonly status: number) { super('ACCOUNT_REQUEST_FAILED'); } }

/** Same-origin Better Auth client. Credentials are transient form inputs;
 * HttpOnly cookies are owned by the service, never browser storage. */
export class AccountUi {
  private user: User | null = null;
  private sessions: OwnedSession[] = [];
  private busy = false;
  private lastUserId: string | null = null;
  private recoveryAvailable = false;
  private resetToken: string | null = null;
  constructor(private readonly escape: (value: unknown) => string,
    private readonly changed: (message: string) => void,
    private readonly discardDraft: () => void) {}
  signedIn(): boolean { return this.user !== null; }
  view(): string {
    const disabled = this.busy ? 'disabled' : '';
    if (this.user) {
      const owned = this.sessions.filter(item => item.role === 'organizer');
      const membership = owned.length ? `<form id="account-membership"><h3>Collaborator access</h3><label>Session<select name="sessionIndex">${owned.map((item,index) => `<option value="${index}">${this.escape(item.sessionId)}</option>`).join('')}</select></label><label>Collaborator account reference<input name="identityId" required maxlength="128"></label><label>Role<select name="role"><option value="contributor">Speaker contributor</option><option value="performer">Performer</option><option value="operator">Operator</option><option value="steward">Steward</option></select></label><button type="submit" value="POST" ${disabled}>Add or update collaborator</button> <button type="submit" value="DELETE" ${disabled}>Remove collaborator</button><p class="muted">Ask your collaborator for their account reference. Adding access does not share your private files or start their speaker.</p></form>` : '';
      return `<section class="card"><p class="eyebrow">YOUR ACCOUNT</p><h2>${this.escape(this.user.name)}</h2><p>Your account records session ownership. Music, permits and private site details stay on this device.</p><p>Your account reference: <code>${this.escape(this.user.id)}</code></p><button id="account-new-session" class="primary" ${disabled}>Create session reference</button> <button id="account-refresh" ${disabled}>Refresh access</button> <button id="account-sign-out" ${disabled}>Sign out and clear this draft</button><h3>Session references</h3>${this.sessions.length ? `<ul id="account-owned-sessions">${this.sessions.map((item,index) => `<li>${this.escape(item.role)}<br><code>${this.escape(item.tenantId)} / ${this.escape(item.sessionId)}</code>${item.role!=='organizer'?` <button data-leave-session="${index}" ${disabled}>Leave session</button>`:''}</li>`).join('')}</ul>` : '<p>No session references yet.</p>'}${membership}<p class="muted">A session reference identifies ownership. Public activation still needs current site authorization and connected endpoints.</p></section><section class="two-column"><form id="account-change-password" class="card"><p class="eyebrow">ACCOUNT SECURITY</p><h2>Change password</h2><label>Current password<input type="password" name="currentPassword" autocomplete="current-password" required maxlength="128"></label><label>New password<input type="password" name="newPassword" autocomplete="new-password" required minlength="8" maxlength="128"></label><button type="submit" ${disabled}>Change password and sign out other devices</button> <button type="button" id="account-revoke-others" ${disabled}>Sign out other devices only</button></form><form id="account-delete" class="card warm"><p class="eyebrow">LEAVE SCENESIGNAL</p><h2>Delete account</h2><p>This removes your sign-in and your session references. Sessions you organize end for every collaborator. Private drafts on other devices are not reachable from here.</p><label>Password<input type="password" name="password" autocomplete="current-password" required maxlength="128"></label><label class="inline"><input type="checkbox" name="confirm" required> I understand this cannot be undone</label><button type="submit" ${disabled}>Delete my account</button></form></section>`;
    }
    if (this.resetToken) return `<form id="account-reset" class="card"><p class="eyebrow">ACCOUNT RECOVERY</p><h2>Choose a new password</h2><p>This single-use link expires 30 minutes after it was sent. Choosing a new password signs out every device.</p><label>New password<input type="password" name="password" autocomplete="new-password" required minlength="8" maxlength="128"></label><button type="submit" class="primary" ${disabled}>Save new password</button> <button type="button" id="account-reset-cancel" ${disabled}>Cancel</button></form>`;
    const recovery = this.recoveryAvailable ? `<form id="account-forgot" class="card"><p class="eyebrow">FORGOT YOUR PASSWORD?</p><h2>Reset by email</h2><label>Email address<input type="email" name="email" autocomplete="username" required maxlength="254"></label><button type="submit" ${disabled}>Send reset link</button><p class="muted">If an account uses this address, a single-use link arrives shortly. The response is the same either way.</p></form>`
      : '<section class="card"><p class="eyebrow">FORGOT YOUR PASSWORD?</p><p class="muted" id="account-recovery-unavailable">Email recovery is not configured on this host. Ask the host operator to restore access; organizers can re-add collaborators to a new account.</p></section>';
    return `<section class="two-column"><form id="account-sign-in" class="card"><p class="eyebrow">WELCOME BACK</p><h2>Sign in</h2><label>Email address<input type="email" name="email" autocomplete="username" required maxlength="254"></label><label>Password<input type="password" name="password" autocomplete="current-password" required minlength="8" maxlength="128"></label><button type="submit" class="primary" ${disabled}>Sign in</button></form><form id="account-sign-up" class="card"><p class="eyebrow">ORGANIZE TOGETHER</p><h2>Create an account</h2><label>Name<input name="name" autocomplete="name" required maxlength="80"></label><label>Email address<input type="email" name="email" autocomplete="email" required maxlength="254"></label><label>Password<input type="password" name="password" autocomplete="new-password" required minlength="8" maxlength="128"></label><button type="submit" ${disabled}>Create account</button><p class="muted">An account is for organizers and contributors. Visitors can attend for free without signing in.</p></form></section>${recovery}`;
  }
  private async request(path: string, body?: unknown, method?: 'POST' | 'DELETE'): Promise<Record<string, unknown>> {
    const response = await fetch(path, { method: method ?? (body === undefined ? 'GET' : 'POST'),
      credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new AccountRequestError(response.status);
    return await response.json() as Record<string, unknown>;
  }
  private async loadSessions(): Promise<void> {
    const data = await this.request('/api/scene/sessions');
    if (!Array.isArray(data.sessions) || data.sessions.length > 100 || !data.sessions.every(item => item &&
      typeof item.tenantId === 'string' && typeof item.sessionId === 'string' && typeof item.role === 'string')) throw Error('INVALID_ACCOUNT_RESPONSE');
    this.sessions = data.sessions as OwnedSession[];
  }
  private async perform(action: () => Promise<string>): Promise<void> {
    if (this.busy) return;
    this.busy = true; this.changed('Connecting to your account…');
    try { this.changed(await action()); }
    catch (error) {
      if (error instanceof AccountRequestError && error.status === 401) {
        if (this.user) this.discardDraft();
        this.user = null; this.sessions = []; this.changed('Check your sign-in details and try again.');
      } else if (error instanceof AccountRequestError && error.status >= 400 && error.status < 500 && error.status !== 404)
        this.changed('We could not complete that account request. Check your details and try again.');
      else this.changed('The account service is unavailable on this host. Your private draft stays on this device.');
    } finally { this.busy = false; this.changed(''); }
  }
  /** Restores an existing cookie session and reads a reset token from a mailed
   * link, removing that token from the address bar and history immediately. */
  async start(location: Location, history: History): Promise<void> {
    const params = new URLSearchParams(location.search);
    if (params.get('account') === 'reset') {
      const token = params.get('token');
      this.resetToken = token && /^[A-Za-z0-9_-]{8,256}$/.test(token) ? token : null;
      history.replaceState(null, '', location.pathname);
      if (!this.resetToken) this.changed('That password reset link is invalid or has expired. Request a new one.');
    }
    try {
      const capabilities = await this.request('/api/capabilities');
      this.recoveryAvailable = capabilities.passwordRecovery === true;
      const session = await this.request('/api/auth/get-session') as Record<string, unknown> | null;
      const user = session?.user as User | undefined;
      if (user && typeof user.id === 'string' && typeof user.name === 'string' && !this.user) {
        this.user = { id: user.id, name: user.name }; this.lastUserId = user.id; await this.loadSessions();
      }
    } catch { /* Static or offline hosts keep the local draft workspace only. */ }
    this.changed('');
  }
  bind(root: ParentNode): void {
    root.querySelector<HTMLFormElement>('#account-forgot')?.addEventListener('submit', event => {
      event.preventDefault(); if (this.busy) return;
      const form = event.currentTarget as HTMLFormElement, email = String(new FormData(form).get('email'));
      form.reset();
      void this.perform(async () => {
        await this.request('/api/auth/request-password-reset', { email, redirectTo: location.origin + '/?account=reset' });
        return 'If an account uses that address, a reset link is on its way. It expires in 30 minutes.';
      });
    });
    root.querySelector<HTMLFormElement>('#account-reset')?.addEventListener('submit', event => {
      event.preventDefault(); if (this.busy) return;
      const form = event.currentTarget as HTMLFormElement, newPassword = String(new FormData(form).get('password'));
      const token = this.resetToken; form.reset();
      void this.perform(async () => {
        if (!token) throw Error('RESET_TOKEN_REQUIRED');
        try { await this.request('/api/auth/reset-password', { token, newPassword }); }
        finally { this.resetToken = null; }
        return 'Password changed. Sign in with your new password; other devices were signed out.';
      });
    });
    root.querySelector('#account-reset-cancel')?.addEventListener('click', () => { this.resetToken = null; this.changed(''); });
    root.querySelector<HTMLFormElement>('#account-change-password')?.addEventListener('submit', event => {
      event.preventDefault(); if (this.busy) return;
      const form = event.currentTarget as HTMLFormElement, data = new FormData(form);
      const body = { currentPassword: String(data.get('currentPassword')), newPassword: String(data.get('newPassword')), revokeOtherSessions: true };
      form.reset();
      void this.perform(async () => {
        await this.request('/api/auth/change-password', body);
        return 'Password changed. Other devices have been signed out.';
      });
    });
    root.querySelector('#account-revoke-others')?.addEventListener('click', () => { void this.perform(async () => {
      await this.request('/api/auth/revoke-other-sessions', {});
      return 'Other devices have been signed out. This device stays signed in.';
    }); });
    root.querySelector<HTMLFormElement>('#account-delete')?.addEventListener('submit', event => {
      event.preventDefault(); if (this.busy) return;
      const form = event.currentTarget as HTMLFormElement, data = new FormData(form);
      const password = String(data.get('password')), confirmed = data.get('confirm') === 'on';
      form.reset();
      if (!confirmed) return;
      void this.perform(async () => {
        await this.request('/api/auth/delete-user', { password });
        this.discardDraft(); this.user = null; this.sessions = []; this.lastUserId = null;
        return 'Your account and session references were deleted. The private draft has been cleared from this workspace.';
      });
    });
    for (const mode of ['sign-in', 'sign-up'] as const) root.querySelector<HTMLFormElement>('#account-' + mode)?.addEventListener('submit', event => {
      event.preventDefault(); if (this.busy) return;
      const form = event.currentTarget as HTMLFormElement, data = new FormData(form);
      const credentials = { email: String(data.get('email')), password: String(data.get('password')),
        ...(mode === 'sign-up' ? { name: String(data.get('name')) } : {}) };
      form.reset();
      void this.perform(async () => {
        await this.request('/api/auth/' + mode + '/email', credentials);
        const session = await this.request('/api/auth/get-session');
        const user = session.user as User | undefined;
        if (!user || typeof user.id !== 'string' || typeof user.name !== 'string') throw Error('INVALID_ACCOUNT_RESPONSE');
        if (this.lastUserId && this.lastUserId !== user.id) this.discardDraft();
        this.lastUserId = user.id;
        this.user = { id: user.id, name: user.name }; await this.loadSessions();
        return 'Signed in. Private music and site details stay on this device.';
      });
    });
    root.querySelector('#account-new-session')?.addEventListener('click', () => { void this.perform(async () => {
      await this.request('/api/scene/sessions', {}); await this.loadSessions();
      return 'Session ownership recorded. No music, permit or private site details were uploaded.';
    }); });
    root.querySelectorAll<HTMLButtonElement>('[data-leave-session]').forEach(button => button.addEventListener('click', () => {
      const scope = this.sessions[Number(button.dataset.leaveSession)], identityId = this.user?.id;
      void this.perform(async () => {
        if (!scope || !identityId) throw Error('SESSION_SELECTION_REQUIRED');
        await this.request('/api/scene/memberships', { tenantId: scope.tenantId, sessionId: scope.sessionId, identityId }, 'DELETE');
        await this.loadSessions(); return 'You have left the session.';
      });
    }));
    root.querySelector('#account-refresh')?.addEventListener('click', () => { void this.perform(async () => {
      await this.loadSessions(); return 'Session access refreshed.';
    }); });
    root.querySelector<HTMLFormElement>('#account-membership')?.addEventListener('submit', event => {
      event.preventDefault(); if (this.busy) return;
      const data = new FormData(event.currentTarget as HTMLFormElement);
      const scope = this.sessions.filter(item => item.role === 'organizer')[Number(data.get('sessionIndex'))];
      const removing = (event.submitter as HTMLButtonElement | null)?.value === 'DELETE';
      const identityId = String(data.get('identityId')).trim(), role = String(data.get('role'));
      void this.perform(async () => {
        if (!scope) throw Error('SESSION_SELECTION_REQUIRED');
        await this.request('/api/scene/memberships', { tenantId: scope.tenantId, sessionId: scope.sessionId,
          identityId, ...(removing ? {} : { role }) }, removing ? 'DELETE' : 'POST');
        return removing ? 'Collaborator access removed.' : 'Collaborator access updated. Private files have not been shared.';
      });
    });
    root.querySelector('#account-sign-out')?.addEventListener('click', () => {
      if (this.busy) return;
      this.discardDraft();
      void this.perform(async () => {
        await this.request('/api/auth/sign-out', {}); this.user = null; this.sessions = [];
        return 'Signed out. The private draft has been cleared from this workspace.';
      });
    });
  }
}
