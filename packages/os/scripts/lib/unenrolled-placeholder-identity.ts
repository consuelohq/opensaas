/**
 * Identity that install seeds on a node that has not enrolled yet.
 *
 * install runs before enrollment and has to write a coherent home, so it stamps this placeholder
 * workspace and node. Enrollment later replaces it with the real identity. Anything keyed to this
 * pair therefore belongs to a node that has never been reachable by the control plane: no
 * credential can have been sealed to it and no grant can reference it, which is what makes it safe
 * to replace rather than a mismatch to refuse.
 */
export const PLACEHOLDER_WORKSPACE_ID = 'local-consuelo-os';
export const PLACEHOLDER_NODE_ID = 'local';

export const isUnenrolledPlaceholderIdentity = (input: {
  workspaceId: string;
  nodeId: string;
}): boolean =>
  input.workspaceId === PLACEHOLDER_WORKSPACE_ID &&
  input.nodeId === PLACEHOLDER_NODE_ID;
