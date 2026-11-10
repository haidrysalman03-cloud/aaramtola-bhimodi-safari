// Keep one-use email tokens in memory only. The SDK removes them from the URL.
export function createAuthFlow(identity) {
  let mode = 'login', token;
  return {
    get mode() { return mode; },
    async initialize() {
      const result = await identity.handleAuthCallback();
      if (result?.type === 'invite') { mode = 'invite'; token = result.token; }
      else if (result?.type === 'recovery') mode = 'recovery';
      return mode;
    },
    async submit(email, password, confirmation) {
      if (mode !== 'login' && (password.length < 12 || password !== confirmation)) {
        throw new Error('Use at least 12 characters and enter the same password twice.');
      }
      if (mode === 'invite') {
        const user = await identity.acceptInvite(token, password);
        // acceptInvite in SDK 2.0.1 does not write nf_jwt. login does.
        token = undefined; mode = 'login';
        return identity.login(user.email, password);
      }
      if (mode === 'recovery') {
        // initialize verified the recovery link and established its session.
        // Updating that session avoids redeeming a one-use token twice on retry.
        const user = await identity.updateUser({ password });
        mode = 'login';
        return identity.login(user.email, password);
      }
      return identity.login(email.trim(), password);
    },
  };
}
