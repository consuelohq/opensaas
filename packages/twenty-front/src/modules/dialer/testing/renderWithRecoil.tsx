import { type ReactNode } from 'react';
import { RecoilRoot, type MutableSnapshot } from 'recoil';
import { renderHook, render, type RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { THEME_LIGHT } from 'twenty-ui/theme';

type WrapperProps = {
  initializeState?: (snap: MutableSnapshot) => void;
};

const createWrapper =
  ({ initializeState }: WrapperProps = {}) =>
  ({ children }: { children: ReactNode }) => (
    <RecoilRoot initializeState={initializeState}>
      <ThemeProvider theme={THEME_LIGHT}>{children}</ThemeProvider>
    </RecoilRoot>
  );

export const renderHookWithRecoil = <TResult,>(
  hook: () => TResult,
  options?: WrapperProps,
) => renderHook(hook, { wrapper: createWrapper(options) });

export const renderWithRecoil = (
  ui: ReactNode,
  options?: WrapperProps & Omit<RenderOptions, 'wrapper'>,
) => {
  const { initializeState, ...renderOptions } = options ?? {};
  return render(ui, {
    wrapper: createWrapper({ initializeState }),
    ...renderOptions,
  });
};
