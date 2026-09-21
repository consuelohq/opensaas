export const classifyTwilioCreateFailure = (
  cause: unknown,
): 'not_created' | 'unknown' => {
  if (typeof cause !== 'object' || cause === null || !('status' in cause))
    return 'unknown';
  // Only explicit request rejections prove that the create did not take effect.
  return typeof cause.status === 'number' &&
    [400, 401, 403, 404, 405, 422, 429].includes(cause.status)
    ? 'not_created'
    : 'unknown';
};
