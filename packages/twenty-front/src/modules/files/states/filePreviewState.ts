import { type FileRecord } from '@/files/types/FileUpload';
import { createState } from '@/ui/utilities/state/utils/createState';

export const filePreviewState = createState<FileRecord | null>({
  key: 'filePreviewState',
  defaultValue: null,
});
