export type CoachingScript = {
  id: string;
  title: string;
  content: string;
  revision: number;
  updatedAt: string;
  canEdit: boolean;
};
export type CoachingLibrary = { scripts: CoachingScript[] };
export type ScriptDraft = {
  id: string;
  title: string;
  content: string;
  expectedRevision: number;
};
export const readScriptFile = async (
  file: File,
): Promise<{ title: string; content: string }> => {
  if (!/\.(txt|md)$/i.test(file.name) || file.size > 100_000)
    throw new Error('Choose a text or Markdown file under 100 KB.');
  let content: string;
  try {
    content = await file.text();
  } catch (cause: unknown) {
    throw new Error(
      'This file could not be read. Try another text or Markdown file.',
      { cause },
    );
  }
  if (!content.trim() || content.includes('\0'))
    throw new Error('Choose a nonempty text script.');
  return { title: file.name.replace(/\.(txt|md)$/i, ''), content };
};
