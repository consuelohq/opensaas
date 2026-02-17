export const maskApiKey = (key: string): string => {
  if (key.length <= 8) {
    return '*'.repeat(key.length);
  }
  return key.slice(0, 4) + '...' + key.slice(-4);
};
