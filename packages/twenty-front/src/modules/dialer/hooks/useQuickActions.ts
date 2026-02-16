import { useCallback, useState } from 'react';

import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { type Note } from '@/activities/types/Note';
import { type NoteTarget } from '@/activities/types/NoteTarget';
import { type Task } from '@/activities/types/Task';
import { type TaskTarget } from '@/activities/types/TaskTarget';

// twenty's open task status value
const TASK_STATUS_OPEN = 'TODO'; // TODO(DEV-719) twenty's ActivityStatus enum value

type UseQuickActionsProps = {
  contactId: string | null;
  callSid: string | null;
};

export const useQuickActions = ({
  contactId,
  callSid,
}: UseQuickActionsProps) => {
  const [isSaving, setIsSaving] = useState(false);

  const { createOneRecord: createNote } = useCreateOneRecord<Note>({
    objectNameSingular: CoreObjectNameSingular.Note,
  });

  const { createOneRecord: createNoteTarget } =
    useCreateOneRecord<NoteTarget>({
      objectNameSingular: CoreObjectNameSingular.NoteTarget,
      shouldMatchRootQueryFilter: true,
    });

  const { createOneRecord: createTask } = useCreateOneRecord<Task>({
    objectNameSingular: CoreObjectNameSingular.Task,
  });

  const { createOneRecord: createTaskTarget } =
    useCreateOneRecord<TaskTarget>({
      objectNameSingular: CoreObjectNameSingular.TaskTarget,
      shouldMatchRootQueryFilter: true,
    });

  const saveNote = useCallback(
    async (content: string) => {
      if (!contactId || !content.trim()) return;
      setIsSaving(true);
      try {
        const title = callSid ? `Call note (${callSid})` : 'Call note';
        const note = await createNote({
          title,
          bodyV2: { blocknote: null, markdown: content.trim() },
          position: 'last',
        } as Partial<Note>);
        await createNoteTarget({
          noteId: note.id,
          personId: contactId,
        } as Partial<NoteTarget>);
        return true;
      } catch (_err: unknown) {
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [contactId, callSid, createNote, createNoteTarget],
  );

  const scheduleFollowUp = useCallback(
    async (dueAt: Date, contactName: string, note?: string) => {
      if (!contactId) return;
      setIsSaving(true);
      try {
        const title = `Follow-up: ${contactName || 'Unknown'}`;
        const task = await createTask({
          title,
          status: TASK_STATUS_OPEN,
          dueAt: dueAt.toISOString(),
          ...(note
            ? { bodyV2: { blocknote: null, markdown: note } }
            : {}),
          position: 'last',
        } as Partial<Task>);
        await createTaskTarget({
          taskId: task.id,
          personId: contactId,
        } as Partial<TaskTarget>);
        return true;
      } catch (_err: unknown) {
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [contactId, createTask, createTaskTarget],
  );

  return { saveNote, scheduleFollowUp, isSaving };
};
