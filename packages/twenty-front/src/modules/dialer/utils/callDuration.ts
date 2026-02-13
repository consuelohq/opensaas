/** Format seconds into MM:SS display string */
export const formatDuration = (totalSeconds: number): string => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
