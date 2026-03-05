// Lightweight RecoilRoot wrapper for testing dialer hooks
// Follows pattern from testing/jest/getJestMetadataAndApolloMocksWrapper.tsx

import { type ReactNode } from 'react';
import { RecoilRoot, type MutableSnapshot } from 'recoil';

type RecoilTestWrapperProps = {
  initializeState?: (snapshot: MutableSnapshot) => void;
  children: ReactNode;
};

export const RecoilTestWrapper = ({
  initializeState,
  children,
}: RecoilTestWrapperProps) => (
  <RecoilRoot initializeState={initializeState}>{children}</RecoilRoot>
);

// Factory for renderHook wrapper option
export const getRecoilTestWrapper = (
  initializeState?: (snapshot: MutableSnapshot) => void,
) => {
  return ({ children }: { children: ReactNode }) => (
    <RecoilRoot initializeState={initializeState}>{children}</RecoilRoot>
  );
};
