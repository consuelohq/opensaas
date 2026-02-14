import { createState } from '@/ui/utilities/state/utils/createState';

export type FileBrowserView = 'grid' | 'list';

export const fileBrowserViewState = createState<FileBrowserView>({
  key: 'fileBrowserViewState',
  defaultValue: 'grid',
});
