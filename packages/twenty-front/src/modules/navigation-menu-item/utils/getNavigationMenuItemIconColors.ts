import type { Theme } from '@emotion/react';

export const getNavigationMenuItemIconColors = (theme: Theme) => ({
  folder: undefined,
  link: theme.color.red,
  view: theme.grayScale.gray8,
  object: theme.color.blue,
});
