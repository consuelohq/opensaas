import { type PageLayoutWidget } from '@/page-layout/types/PageLayoutWidget';
import { WidgetSkeletonLoader } from '@/page-layout/widgets/components/WidgetSkeletonLoader';
import { lazy, Suspense } from 'react';

const FilePreviewWidget = lazy(() =>
  import('@/page-layout/widgets/file-preview/components/FilePreviewWidget').then(
    (module) => ({
      default: module.FilePreviewWidget,
    }),
  ),
);

type FilePreviewWidgetRendererProps = {
  widget: PageLayoutWidget;
};

export const FilePreviewWidgetRenderer = ({
  widget,
}: FilePreviewWidgetRendererProps) => {
  return (
    <Suspense fallback={<WidgetSkeletonLoader />}>
      <FilePreviewWidget widget={widget} />
    </Suspense>
  );
};
