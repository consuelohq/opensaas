import type { Effect } from 'effect';

import type { StreamServiceError } from './errors';

export type StreamInstructionResult = {
  exists: boolean;
  path: string;
  content: string;
};

export type StreamInstructionSeedResult = {
  status: 'created' | 'preserved';
  path: string;
};

export type StreamBranchState = {
  sha: string;
  treeSha: string;
};

export type StreamCommitFile = {
  path: string;
  content: string;
};

export type StreamCreationContext = {
  remote: {
    getBranch: (branch: string) => Effect.Effect<StreamBranchState | null, StreamServiceError>;
    createBranch: (input: { branch: string; sha: string }) => Effect.Effect<StreamBranchState, StreamServiceError>;
    commitFiles: (input: {
      parentSha: string;
      files: StreamCommitFile[];
      message: string;
    }) => Effect.Effect<StreamBranchState, StreamServiceError>;
  };
  local: {
    fetchOrigin: () => Effect.Effect<unknown, StreamServiceError>;
    branchExists: (branch: string) => Effect.Effect<boolean, StreamServiceError>;
    createTrackingBranch: (input: { branch: string; upstream: string }) => Effect.Effect<unknown, StreamServiceError>;
  };
};

export type StreamCreateInput = {
  area: string;
  sourceBranch?: string;
};

export type StreamCreateResult = {
  stream: string;
  sourceBranch: string;
  commitSha: string;
  instructionPaths: string[];
  localTrackingCreated: boolean;
};

export type WorkpadRow = {
  title?: string;
  category?: string;
  created_at?: string;
  content?: string;
};

export type StreamWorkpad = {
  title?: string;
  category?: string;
  date: string;
  content: string;
};
