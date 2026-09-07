import type { DisplayPhoto } from '@/components/photos/useJobPhotos';
import { JobTodo } from '@/types';

/**
 * Whether a photo was taken FOR a job TO-DO: tagged with a task id but no
 * work request (work request task photos carry both). TO-DO photos live only
 * inside their TO-DO — the job pages keep them off the Pictures wall and out
 * of the cover-photo picker.
 */
export function isTodoPhoto(photo: Pick<DisplayPhoto, 'taskId' | 'workRequestId'>): boolean {
  return !!photo.taskId && !photo.workRequestId;
}

/**
 * Pure list edits for a job's TO-DOs (the Field Super's check-off list on the
 * job details page). Each returns the next list for `updateJob(id, { todos })`
 * — the job row is written whole, like every other job edit.
 */

/** Append a TO-DO with the given text (trimmed; blank = unchanged list). */
export function addTodo(
  todos: JobTodo[] | undefined,
  text: string,
  makeId: () => string
): JobTodo[] {
  const t = text.trim();
  const list = todos ?? [];
  if (!t) return list;
  return [...list, { id: makeId(), text: t, done: false }];
}

/** Retitle a TO-DO, keeping its id (so linked photos/issues stay attached). */
export function editTodoText(
  todos: JobTodo[] | undefined,
  id: string,
  text: string
): JobTodo[] {
  const t = text.trim();
  return (todos ?? []).map((todo) => (todo.id === id ? { ...todo, text: t } : todo));
}

/** Check a TO-DO off (stamping who/when) or un-check it (clearing both). */
export function setTodoDone(
  todos: JobTodo[] | undefined,
  id: string,
  done: boolean,
  byId: string | undefined
): JobTodo[] {
  return (todos ?? []).map((todo) =>
    todo.id === id
      ? {
          ...todo,
          done,
          doneById: done ? byId : undefined,
          doneAt: done ? new Date().toISOString() : undefined,
        }
      : todo
  );
}

/** Drop a TO-DO. Its photos and issues keep their task id and stay on the job. */
export function removeTodo(todos: JobTodo[] | undefined, id: string): JobTodo[] {
  return (todos ?? []).filter((todo) => todo.id !== id);
}
