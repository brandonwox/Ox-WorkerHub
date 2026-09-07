import { WorkRequestTask } from '@/types';

/**
 * Scope-driven automatic tasks on a work request: selecting the 'Delivery'
 * scope injects the delivery check tasks, and checking "Are any of the Windows
 * Casements?" injects the gather-cranks task. Deselecting removes the injected
 * tasks again — but only ones the installers haven't checked off (a done task
 * is a record of real work; it stays).
 */

/** Tasks auto-added the moment the 'Delivery' scope is selected, in order. */
export const DELIVERY_AUTO_TASKS = [
  'Check delivery for hardware',
  'Delivery complete, no issues.',
];

/**
 * Stable lead-in of the casement task — used to find the task again for
 * removal regardless of which Field Super's name was injected into it.
 */
export const CASEMENT_TASK_PREFIX = 'Gather casement cranks';

/**
 * The casement task text, with the responsible Field Super's name injected
 * ("…back to Tim Baird's bay…"). Falls back to a generic phrasing when the
 * card has no parent job / assigned Field Super to name.
 */
export function casementTaskText(fieldSuperName?: string): string {
  const owner = fieldSuperName?.trim()
    ? `${fieldSuperName.trim()}'s`
    : "the field super's";
  return `${CASEMENT_TASK_PREFIX} and bring them back to ${owner} bay in the warehouse.`;
}

/** Append (with fresh ids) any of `texts` not already present in `tasks`. */
export function withAutoTasks(
  tasks: WorkRequestTask[],
  texts: string[],
  makeId: () => string
): WorkRequestTask[] {
  const missing = texts.filter(
    (text) => !tasks.some((task) => task.text === text)
  );
  return [
    ...tasks,
    ...missing.map((text) => ({ id: makeId(), text, done: false })),
  ];
}

/**
 * Drop every not-yet-done task `matches` — the un-inject counterpart of
 * {@link withAutoTasks}. Checked-off tasks are kept.
 */
export function withoutAutoTasks(
  tasks: WorkRequestTask[],
  matches: (text: string) => boolean
): WorkRequestTask[] {
  return tasks.filter((task) => task.done || !matches(task.text));
}
