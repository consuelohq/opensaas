export function parseStreamArea(branch: string): string | null {
  const match = /^stream\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(branch.trim());
  return match?.[1] ?? null;
}

export function discoverStreamAreas(input: {
  localBranches?: string[];
  remoteBranches?: string[];
  directoryNames?: string[];
  requestedArea?: string;
}): string[] {
  const areas = new Set<string>();
  for (const branch of [...(input.localBranches ?? []), ...(input.remoteBranches ?? [])]) {
    const normalized = branch.replace(/^origin\//, '');
    const area = parseStreamArea(normalized);
    if (area) areas.add(area);
  }
  if (input.requestedArea) areas.add(input.requestedArea);
  return Array.from(areas).sort((left, right) => left.localeCompare(right));
}
