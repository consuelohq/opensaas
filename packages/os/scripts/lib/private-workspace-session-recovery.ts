export const PRIVATE_WORKSPACE_SESSION_RECOVERY_JAVASCRIPT = `
(() => {
  const nativeFetch = window.fetch.bind(window);
  let workspaceSessionRecoveryStarted = false;

  window.fetch = async (...arguments_) => {
    const response = await nativeFetch(...arguments_);
    if (response.status !== 401 || workspaceSessionRecoveryStarted) return response;

    let payload = null;
    try { payload = await response.clone().json(); } catch {}
    if (!payload || payload.error !== 'workspace_session_required') return response;

    workspaceSessionRecoveryStarted = true;
    const loginUrl = new URL('/login/google/start', 'https://os.consuelohq.com');
    loginUrl.searchParams.set('purpose', 'web');
    loginUrl.searchParams.set(
      'return_to',
      window.location.pathname + window.location.search + window.location.hash,
    );
    window.location.assign(loginUrl.toString());

    return new Promise(() => {});
  };
})();
`;
