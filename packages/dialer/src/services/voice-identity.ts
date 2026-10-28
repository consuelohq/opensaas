/** Map the internal rep ID to the identity registered by a browser voice client. */
export const createAgentVoiceIdentity = (userId: string): string =>
  `user_${userId}`;
