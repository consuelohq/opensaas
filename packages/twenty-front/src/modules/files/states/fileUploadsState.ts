import { createState } from '@/ui/utilities/state/utils/createState';

import { type FileUploadItem } from '@/files/types/FileUpload';

export const fileUploadsState = createState<FileUploadItem[]>({
  key: 'fileUploadsState',
  defaultValue: [],
});
